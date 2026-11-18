package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/proto/waCompanionReg"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite"
)

type Config struct {
	AllowGroups    bool     `json:"allowGroups"`    // Default false
	AllowBroadcast bool     `json:"allowBroadcast"` // Default false
	GeminiKey      string   `json:"geminiKey"`
	GeminiKeys     []string `json:"geminiKeys"`
	Models         []string `json:"models"`
	AutoReply      bool     `json:"autoReply"`      // Chatbot toggle (global pause)
	PausedChats    []string `json:"pausedChats"`    // List of phone numbers / JIDs paused individually
}

type ChatMessage struct {
	ID        string `json:"id"`
	FromMe    bool   `json:"fromMe"`
	Sender    string `json:"sender"`
	Text      string `json:"text"`
	Timestamp int64  `json:"timestamp"`
}

type ContactConversation struct {
	Phone          string        `json:"phone"`          // e.g. "51987654321"
	Name           string        `json:"name"`           // Custom assigned name or contact name
	Type           string        `json:"type"`           // "alumno", "cliente", "solicitud", "interesado"
	Characteristics string       `json:"characteristics"` // Notes / custom features / preferences
	Orders         string        `json:"orders"`         // Orders / Pedidos / Solicitudes
	IsPaused       bool          `json:"isPaused"`       // Individual pause
	Summary        string        `json:"summary"`        // Rolling summary of old context
	Messages       []ChatMessage `json:"messages"`       // Last 15-20 messages
	LastMessageAt  int64         `json:"lastMessageAt"`
}

type WhatsAppServer struct {
	client            *whatsmeow.Client
	container         *sqlstore.Container
	config            Config
	configLock        sync.RWMutex
	qrCode            string
	qrLock            sync.RWMutex
	status            string
	statusLock        sync.RWMutex
	sessions          []map[string]interface{}
	sessionsLock      sync.RWMutex
	conversations     map[string]*ContactConversation
	conversationsLock sync.RWMutex
}

var serverInstance *WhatsAppServer

func NewWhatsAppServer() *WhatsAppServer {
	cfg := Config{
		AllowGroups:    false,
		AllowBroadcast: false,
		AutoReply:      true,
		Models: []string{
			"gemini-3.5-flash-lite",
			"gemini-3.5-flash",
			"gemini-2.5-flash-lite",
			"gemini-2.5-flash",
			"gemini-2.0-flash",
			"gemini-1.5-flash",
		},
	}

	// Try loading saved config
	if data, err := os.ReadFile("whatsapp_config.json"); err == nil {
		_ = json.Unmarshal(data, &cfg)
	}

	var savedSessions []map[string]interface{}
	if data, err := os.ReadFile("whatsapp_sessions.json"); err == nil {
		_ = json.Unmarshal(data, &savedSessions)
	}

	savedConversations := make(map[string]*ContactConversation)
	if data, err := os.ReadFile("whatsapp_conversations.json"); err == nil {
		_ = json.Unmarshal(data, &savedConversations)
	}

	return &WhatsAppServer{
		config:        cfg,
		status:        "disconnected",
		sessions:      savedSessions,
		conversations: savedConversations,
	}
}

func (s *WhatsAppServer) SaveConfig() {
	s.configLock.RLock()
	defer s.configLock.RUnlock()
	bytes, _ := json.MarshalIndent(s.config, "", "  ")
	_ = os.WriteFile("whatsapp_config.json", bytes, 0644)
}

func (s *WhatsAppServer) SaveConversations() {
	s.conversationsLock.RLock()
	defer s.conversationsLock.RUnlock()
	bytes, _ := json.MarshalIndent(s.conversations, "", "  ")
	_ = os.WriteFile("whatsapp_conversations.json", bytes, 0644)
}

func (s *WhatsAppServer) GetOrCreateConversation(phone string, senderName string) *ContactConversation {
	s.conversationsLock.Lock()
	defer s.conversationsLock.Unlock()

	cleanPhone := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(phone, "+", ""), " ", ""), "-", "")
	conv, exists := s.conversations[cleanPhone]
	if !exists {
		// Determine if phone is paused in config
		isPaused := false
		s.configLock.RLock()
		for _, p := range s.config.PausedChats {
			if strings.ReplaceAll(p, "+", "") == cleanPhone {
				isPaused = true
				break
			}
		}
		s.configLock.RUnlock()

		name := senderName
		if name == "" {
			name = "Contacto +" + cleanPhone
		}

		conv = &ContactConversation{
			Phone:           cleanPhone,
			Name:            name,
			Type:            "interesado",
			Characteristics: "",
			Orders:          "",
			IsPaused:        isPaused,
			Summary:         "",
			Messages:        []ChatMessage{},
			LastMessageAt:   time.Now().UnixMilli(),
		}
		s.conversations[cleanPhone] = conv
	}
	return conv
}

func (s *WhatsAppServer) AddMessageToConversation(phone string, senderName string, fromMe bool, text string, allKeys []string, models []string) {
	conv := s.GetOrCreateConversation(phone, senderName)

	s.conversationsLock.Lock()
	conv.LastMessageAt = time.Now().UnixMilli()
	if !fromMe && senderName != "" && (conv.Name == "" || strings.HasPrefix(conv.Name, "Contacto +")) {
		conv.Name = senderName
	}

	msg := ChatMessage{
		ID:        fmt.Sprintf("msg_%d", time.Now().UnixNano()),
		FromMe:    fromMe,
		Sender:    conv.Name,
		Text:      text,
		Timestamp: time.Now().UnixMilli(),
	}
	conv.Messages = append(conv.Messages, msg)

	// Rolling context management: When message count exceeds 20, summarize older messages with Gemini
	if len(conv.Messages) > 20 {
		oldBatch := conv.Messages[:10]
		conv.Messages = conv.Messages[10:] // Keep the last 10+ messages

		// Asynchronously summarize old batch in background
		go func(oldMsgs []ChatMessage, existingSummary string, convPhone string) {
			var sb strings.Builder
			if existingSummary != "" {
				sb.WriteString("Resumen previo del caso: " + existingSummary + "\n\n")
			}
			sb.WriteString("Mensajes anteriores de la conversación:\n")
			for _, m := range oldMsgs {
				who := "Usuario"
				if m.FromMe {
					who = "Asesor/Bot"
				}
				sb.WriteString(fmt.Sprintf("- %s: %s\n", who, m.Text))
			}
			prompt := "Resume de forma muy concisa en 2 o 3 líneas los puntos clave tratados, pedidos, acuerdos y datos del cliente para mantener el contexto histórico."
			summaryResult, _, err := CallGeminiWithKeys(allKeys, models, prompt, sb.String(), false)
			if err == nil && summaryResult != "" {
				s.conversationsLock.Lock()
				if c, ok := s.conversations[convPhone]; ok {
					c.Summary = strings.TrimSpace(summaryResult)
				}
				s.conversationsLock.Unlock()
				s.SaveConversations()
			}
		}(oldBatch, conv.Summary, conv.Phone)
	}

	s.conversationsLock.Unlock()
	s.SaveConversations()
}

func (s *WhatsAppServer) SaveSessionRecord(record map[string]interface{}) {
	s.sessionsLock.Lock()
	defer s.sessionsLock.Unlock()
	s.sessions = append([]map[string]interface{}{record}, s.sessions...)
	bytes, _ := json.MarshalIndent(s.sessions, "", "  ")
	_ = os.WriteFile("whatsapp_sessions.json", bytes, 0644)
}

func (s *WhatsAppServer) InitWhatsApp() error {
	// Standard OS metadata aligned with WhatsApp Web
	store.SetOSInfo("macOS", [3]uint32{14, 4, 1})
	store.DeviceProps.PlatformType = waCompanionReg.DeviceProps_SAFARI.Enum()
	store.DeviceProps.RequireFullSync = proto.Bool(false)

	dbLog := waLog.Stdout("Database", "ERROR", true)
	ctx := context.Background()
	// WAL mode and busy_timeout=5000 prevent database locked (SQLITE_BUSY) errors on high socket concurrency
	dbURI := "file:whatsapp_session.db?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"
	container, err := sqlstore.New(ctx, "sqlite", dbURI, dbLog)
	if err != nil {
		return fmt.Errorf("error inicializando store: %w", err)
	}
	s.container = container

	deviceStore, err := container.GetFirstDevice(ctx)
	if err != nil {
		return fmt.Errorf("error obteniendo dispositivo: %w", err)
	}

	clientLog := waLog.Stdout("WhatsApp", "INFO", true)
	client := whatsmeow.NewClient(deviceStore, clientLog)
	s.client = client

	client.AddEventHandler(s.eventHandler)

	if client.Store.ID == nil {
		// New login required
		qrChan, _ := client.GetQRChannel(ctx)
		err = client.Connect()
		if err != nil {
			return fmt.Errorf("error conectando: %w", err)
		}

		go func() {
			for evt := range qrChan {
				log.Printf("[WhatsApp QR Event] %s\n", evt.Event)
				if evt.Event == "code" {
					// Generate base64 png
					png, err := qrcode.Encode(evt.Code, qrcode.Medium, 256)
					if err == nil {
						s.qrLock.Lock()
						s.qrCode = "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
						s.qrLock.Unlock()
						log.Println("[WhatsApp] Nuevo código QR generado exitosamente.")
					} else {
						log.Printf("[WhatsApp] Error codificando QR a PNG: %v\n", err)
					}
					s.statusLock.Lock()
					s.status = "scan_qr"
					s.statusLock.Unlock()
				} else {
					s.statusLock.Lock()
					s.status = evt.Event
					s.statusLock.Unlock()
					if evt.Event == "timeout" {
						log.Println("[WhatsApp QR] El código QR expiró.")
					}
				}
			}
		}()
	} else {
		// Existing session
		err = client.Connect()
		if err != nil {
			return fmt.Errorf("error reconectando: %w", err)
		}
		s.statusLock.Lock()
		s.status = "connected"
		s.statusLock.Unlock()
	}

	return nil
}

func (s *WhatsAppServer) ResetAndGetQR() error {
	if s.client != nil {
		s.client.Disconnect()
	}
	if s.container != nil {
		_ = s.container.Close()
	}

	// Remove session db so a completely fresh QR session starts
	_ = os.Remove("whatsapp_session.db")
	_ = os.Remove("whatsapp_session.db-wal")
	_ = os.Remove("whatsapp_session.db-shm")

	s.qrLock.Lock()
	s.qrCode = ""
	s.qrLock.Unlock()

	s.statusLock.Lock()
	s.status = "scan_qr"
	s.statusLock.Unlock()

	return s.InitWhatsApp()
}

func (s *WhatsAppServer) eventHandler(evt interface{}) {
	switch v := evt.(type) {
	case *events.Connected:
		s.statusLock.Lock()
		s.status = "connected"
		s.qrCode = ""
		s.statusLock.Unlock()
		log.Println("[WhatsApp] Conectado exitosamente!")

	case *events.LoggedOut:
		s.statusLock.Lock()
		s.status = "logged_out"
		s.statusLock.Unlock()
		log.Println("[WhatsApp] Sesi�n cerrada.")

	case *events.Message:
		go s.handleIncomingMessage(v)
	}
}

func (s *WhatsAppServer) handleIncomingMessage(msg *events.Message) {
	// Don't reply to self messages
	if msg.Info.IsFromMe {
		return
	}

	// Group and Broadcast filter (Default false / disabled)
	s.configLock.RLock()
	allowGroups := s.config.AllowGroups
	allowBroadcast := s.config.AllowBroadcast
	autoReply := s.config.AutoReply
	pausedChats := s.config.PausedChats
	apiKey := s.config.GeminiKey
	apiKeys := s.config.GeminiKeys
	models := s.config.Models
	s.configLock.RUnlock()

	var allKeys []string
	if len(apiKeys) > 0 {
		allKeys = append(allKeys, apiKeys...)
	}
	if apiKey != "" {
		allKeys = append(allKeys, apiKey)
	}

	// 1. GLOBAL PAUSE: If autoReply is false, bot never answers
	if !autoReply {
		return
	}

	senderUser := msg.Info.Sender.User
	chatUser := msg.Info.Chat.User
	chatString := msg.Info.Chat.String()

	// 2. INDIVIDUAL PAUSE: Check if this sender or chat is individually paused
	for _, p := range pausedChats {
		cleanP := strings.ReplaceAll(strings.ReplaceAll(p, "+", ""), " ", "")
		if cleanP != "" && (cleanP == senderUser || cleanP == chatUser || strings.Contains(chatString, cleanP)) {
			log.Printf("[WhatsApp Bot] Chat pausado individualmente para %s. Ignorando respuesta automática.\n", senderUser)
			return
		}
	}

	isGroup := msg.Info.IsGroup
	if isGroup && !allowGroups {
		return // Ignore group messages per user setting
	}

	chatStr := msg.Info.Chat.String()
	isBroadcast := strings.HasSuffix(chatStr, "@broadcast") || strings.HasSuffix(chatStr, "@newsletter")
	if isBroadcast && !allowBroadcast {
		return // Ignore broadcasts and channels per user setting
	}
	if strings.Contains(chatStr, "newsletter") {
		return // Never reply to WhatsApp broadcast channels
	}

	text := ""
	if msg.Message.Conversation != nil {
		text = *msg.Message.Conversation
	} else if msg.Message.ExtendedTextMessage != nil && msg.Message.ExtendedTextMessage.Text != nil {
		text = *msg.Message.ExtendedTextMessage.Text
	}

	text = strings.TrimSpace(text)
	if text == "" {
		return
	}

	senderUser = msg.Info.Sender.User
	senderPushName := msg.Info.PushName
	if senderPushName == "" {
		senderPushName = msg.Info.Sender.User
	}

	log.Printf("[WhatsApp In] De: %s (%s) | Mensaje: %s\n", senderUser, senderPushName, text)

	// Save incoming message in contact conversation
	s.AddMessageToConversation(senderUser, senderPushName, false, text, allKeys, models)

	// Retrieve conversation to check individual pause
	conv := s.GetOrCreateConversation(senderUser, senderPushName)
	if conv.IsPaused {
		log.Printf("[WhatsApp Bot] Chat pausado individualmente para %s en conversaciones. Ignorando respuesta automática.\n", senderUser)
		return
	}

	// If no Gemini Key is configured, notify politely
	if len(allKeys) == 0 {
		s.sendTextMessage(msg.Info.Chat, "Hola! El chatbot est� activo pero a�n no tiene configurada su Gemini API Key en el panel de DocuCraft Pro.")
		return
	}

	// Check if user is asking for a learning session / sesion de aprendizaje
	lower := strings.ToLower(text)
	pedagogicalTrigger := strings.Contains(lower, "sesion") || 
		strings.Contains(lower, "sesión") || 
		strings.Contains(lower, "planifica") || 
		strings.Contains(lower, "clase") || 
		strings.Contains(lower, "primaria") || 
		strings.Contains(lower, "secundaria") || 
		strings.Contains(lower, "grado") || 
		strings.Contains(lower, "cneb") || 
		strings.Contains(lower, "rúbrica") || 
		strings.Contains(lower, "rubrica")

	if pedagogicalTrigger {
		ackMsg := "¡Entendido! Estoy elaborando tu sesión de aprendizaje CNEB completa y generando el documento PDF. Dame unos segundos..."
		s.sendTextMessage(msg.Info.Chat, ackMsg)
		s.AddMessageToConversation(senderUser, "DocuCraft Bot", true, ackMsg, allKeys, models)

		systemPrompt := `Eres un especialista pedagógico del Ministerio de Educación del Perú (MINEDU) y experto en el Currículo Nacional (CNEB).
El usuario te pide una sesión de aprendizaje o tema educativo.
Genera SIEMPRE una sesión pedagógica completa directamente sin hacer preguntas ni pedir datos adicionales. Asigna tú mismo el área curricular (Personal Social, Ciencia y Tecnología, Comunicación, etc.), la competencia y la secuencia didáctica según tu mejor criterio profesional.
Devuelve ÚNICAMENTE un JSON válido con la siguiente estructura exacta:
{
  "titulo": "Título de la sesión",
  "numeroSesion": "01",
  "institucion": "I.E. República del Perú",
  "docente": "Docente Virtual DocuCraft",
  "area": "Personal Social",
  "grado": "6° Grado de Primaria",
  "seccion": "A",
  "duracion": 90,
  "competencia": "Construye interpretaciones históricas",
  "capacidades": ["Interpreta críticamente fuentes diversas", "Comprende el tiempo histórico", "Elabora explicaciones sobre procesos históricos"],
  "desempenos": "Explica hechos o procesos históricos clave, reconociendo causas y consecuencias y valorando la paz y la integración.",
  "evidencia": "Línea de tiempo o cuadro comparativo sobre los hitos de integración y paz.",
  "instrumentoEvaluacion": "Rúbrica analítica de evaluación",
  "secuenciaInicio": "Problematización, motivación, saberes previos y propósito de la sesión...",
  "tiempoInicio": 15,
  "secuenciaDesarrollo": "Gestión y acompañamiento del aprendizaje, análisis de información, toma de decisiones...",
  "tiempoDesarrollo": 60,
  "secuenciaCierre": "Metacognición: ¿Qué aprendimos hoy? ¿Para qué nos sirve? Evaluación formativa...",
  "tiempoCierre": 15,
  "recursosMateriales": "Textos escolares MINEDU, papelógrafos, plumones, mapas históricos"
}`

		jsonText, usedModel, err := CallGeminiWithKeys(allKeys, models, systemPrompt, text, false)
		if err == nil {
			log.Printf("[WhatsApp Bot] Sesión generada exitosamente con modelo: %s\n", usedModel)
			cleanJSON := strings.TrimSpace(jsonText)
			if start := strings.Index(cleanJSON, "{"); start != -1 {
				if end := strings.LastIndex(cleanJSON, "}"); end != -1 && end > start {
					cleanJSON = cleanJSON[start : end+1]
				}
			}
			var sData SessionPedagogicaData
			if jsonErr := json.Unmarshal([]byte(cleanJSON), &sData); jsonErr == nil && sData.Titulo != "" {
				// Record session in bank with destination "WhatsApp"
				nowStr := time.Now().Format("02/01/2006 15:04")
				record := map[string]interface{}{
					"id":                     fmt.Sprintf("ses_wa_%d", time.Now().UnixMilli()),
					"titulo":                 sData.Titulo,
					"numeroSesion":           sData.NumeroSesion,
					"institucion":            sData.Institucion,
					"docente":                sData.Docente,
					"area":                   sData.Area,
					"grado":                  sData.Grado,
					"seccion":                sData.Seccion,
					"duracion":               sData.Duracion,
					"competencia":            sData.Competencia,
					"capacidades":            sData.Capacidades,
					"desempenos":             sData.Desempenos,
					"evidencia":              sData.Evidencia,
					"instrumentoEvaluacion":  sData.InstrumentoEvaluacion,
					"secuenciaInicio":        sData.SecuenciaInicio,
					"tiempoInicio":           sData.TiempoInicio,
					"secuenciaDesarrollo":    sData.SecuenciaDesarrollo,
					"tiempoDesarrollo":       sData.TiempoDesarrollo,
					"secuenciaCierre":        sData.SecuenciaCierre,
					"tiempoCierre":           sData.TiempoCierre,
					"recursosMateriales":     sData.RecursosMateriales,
					"fecha":                  nowStr,
					"modelUsed":              usedModel,
					"origin":                 "WhatsApp",
					"recipient":              msg.Info.Sender.User,
				}
				s.SaveSessionRecord(record)

				pdfBytes, pdfErr := GenerateSessionPDF(&sData)
				if pdfErr == nil && len(pdfBytes) > 0 {
					filename := fmt.Sprintf("Sesion_%s.pdf", strings.ReplaceAll(sData.Titulo, " ", "_"))
					botCaption := fmt.Sprintf("¡Listo! Aquí tienes tu sesión pedagógica oficial en PDF: *%s*", sData.Titulo)
					s.sendDocument(msg.Info.Chat, pdfBytes, filename, "application/pdf", botCaption)
					s.AddMessageToConversation(senderUser, "DocuCraft Bot", true, botCaption+" [Archivo PDF Adjunto]", allKeys, models)
					return
				} else {
					log.Printf("[WhatsApp Bot] Error generando PDF: %v\n", pdfErr)
				}
			} else {
				log.Printf("[WhatsApp Bot] Error parseando JSON: %v\n", jsonErr)
			}
		} else {
			log.Printf("[WhatsApp Bot] Error llamando a Gemini para sesión: %v\n", err)
		}
	}

	// General short chat with conversation history context
	chatSystemPrompt := `Eres el asesor virtual inteligente de DocuCraft Pro en WhatsApp.
REGLAS:
1. Responde de forma muy concisa, cordial y en máximo 2 a 3 oraciones.
2. Si te piden una sesión pedagógica, di '¡Claro! Enseguida la preparo' y no te quedes en bucles ni pidas más datos; créala.
3. Ayudas con: Sesiones de aprendizaje CNEB, Certificados con QR, registro de alumnos/clientes y expedientes.
4. Conoce al cliente por su nombre o pedidos previos si ya te los ha dado en la conversación.`

	// Build chat history for CallGeminiChatWithKeys
	var chatHistory []GeminiContent
	s.conversationsLock.RLock()
	if conv.Summary != "" {
		chatHistory = append(chatHistory, GeminiContent{
			Role:  "user",
			Parts: []GeminiPart{{Text: "[RESUMEN PREVIO DE LA CONVERSACIÓN]: " + conv.Summary}},
		}, GeminiContent{
			Role:  "model",
			Parts: []GeminiPart{{Text: "Entendido, tengo presente todo el contexto anterior."}},
		})
	}

	for _, m := range conv.Messages {
		role := "user"
		if m.FromMe {
			role = "model"
		}
		chatHistory = append(chatHistory, GeminiContent{
			Role:  role,
			Parts: []GeminiPart{{Text: m.Text}},
		})
	}
	s.conversationsLock.RUnlock()

	respText, _, err := CallGeminiChatWithKeys(allKeys, models, chatSystemPrompt, chatHistory)
	if err != nil {
		log.Printf("[WhatsApp Bot] Error general Gemini: %v\n", err)
		s.sendTextMessage(msg.Info.Chat, "Hola! Tuve una breve pausa con la IA, por favor repíteme tu consulta.")
		return
	}

	s.sendTextMessage(msg.Info.Chat, respText)
	s.AddMessageToConversation(senderUser, "DocuCraft Bot", true, respText, allKeys, models)
}

func (s *WhatsAppServer) sendTextMessage(to types.JID, text string) {
	if s.client == nil || !s.client.IsConnected() {
		return
	}
	msg := &waProto.Message{
		Conversation: proto.String(text),
	}
	_, err := s.client.SendMessage(context.Background(), to, msg)
	if err != nil {
		log.Printf("[WhatsApp] Error enviando mensaje a %s: %v\n", to, err)
	}
}

func (s *WhatsAppServer) sendDocument(to types.JID, data []byte, filename, mime, caption string) {
	if s.client == nil || !s.client.IsConnected() {
		return
	}

	uploaded, err := s.client.Upload(context.Background(), data, whatsmeow.MediaDocument)
	if err != nil {
		log.Printf("[WhatsApp] Error subiendo documento: %v\n", err)
		return
	}

	msg := &waProto.Message{
		DocumentMessage: &waProto.DocumentMessage{
			URL: proto.String(uploaded.URL),
			DirectPath:    proto.String(uploaded.DirectPath),
			MediaKey:      uploaded.MediaKey,
			FileEncSHA256: uploaded.FileEncSHA256,
			FileSHA256: uploaded.FileSHA256,
			FileLength:    proto.Uint64(uint64(len(data))),
			Mimetype: proto.String(mime),
			Title:         proto.String(filename),
			FileName:      proto.String(filename),
			Caption:       proto.String(caption),
		},
	}
	_, err = s.client.SendMessage(context.Background(), to, msg)
	if err != nil {
		log.Printf("[WhatsApp] Error enviando documento: %v\n", err)
	}
}

// ---------------- REST API HANDLERS ----------------

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	s := serverInstance
	s.statusLock.RLock()
	st := s.status
	s.statusLock.RUnlock()

	s.qrLock.RLock()
	qr := s.qrCode
	s.qrLock.RUnlock()

	s.configLock.RLock()
	cfg := s.config
	s.configLock.RUnlock()

	connected := s.client != nil && s.client.IsConnected()
	phone := ""
	if s.client != nil && s.client.Store.ID != nil {
		phone = s.client.Store.ID.User
	}
	// Only count as connected if client is connected AND has a paired phone/ID
	isReallyConnected := connected && phone != ""

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    st,
		"connected": isReallyConnected,
		"phone":     phone,
		"qr":        qr,
		"config":    cfg,
	})
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	s := serverInstance
	if r.Method == "POST" {
		var newCfg Config
		if err := json.NewDecoder(r.Body).Decode(&newCfg); err == nil {
			s.configLock.Lock()
			s.config.AllowGroups = newCfg.AllowGroups
			s.config.AllowBroadcast = newCfg.AllowBroadcast
			s.config.AutoReply = newCfg.AutoReply
			if newCfg.GeminiKey != "" {
				s.config.GeminiKey = newCfg.GeminiKey
			}
			if len(newCfg.GeminiKeys) > 0 {
				s.config.GeminiKeys = newCfg.GeminiKeys
			}
			if newCfg.PausedChats != nil {
				s.config.PausedChats = newCfg.PausedChats
			}
			s.configLock.Unlock()
			s.SaveConfig()
		}
	}

	s.configLock.RLock()
	cfg := s.config
	s.configLock.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cfg)
}

func handleGetGroups(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	s := serverInstance
	if s.client == nil || !s.client.IsConnected() {
		http.Error(w, `{"error":"WhatsApp no conectado"}`, http.StatusBadRequest)
		return
	}

	groups, err := s.client.GetJoinedGroups(context.Background())
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}

	type GroupItem struct {
		JID          string `json:"jid"`
		Name         string `json:"name"`
		Participants int    `json:"participants"`
	}

	var res []GroupItem
	for _, g := range groups {
		res = append(res, GroupItem{
			JID:          g.JID.String(),
			Name:         g.Name,
			Participants: len(g.Participants),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

type SendMessageRequest struct {
	Recipients []string `json:"recipients"` // Numbers or JIDs
	Message    string   `json:"message"`
	FileName   string   `json:"fileName,omitempty"`
	FileData   string   `json:"fileData,omitempty"` // base64
	MimeType   string   `json:"mimeType,omitempty"`
}

func handleSendMessage(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	s := serverInstance
	if s.client == nil || !s.client.IsConnected() {
		http.Error(w, `{"error":"WhatsApp no conectado"}`, http.StatusBadRequest)
		return
	}

	var req SendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload invalido"}`, http.StatusBadRequest)
		return
	}

	sentCount := 0
	var fileBytes []byte
	if req.FileData != "" {
		// Clean base64 header if present
		cleanB64 := req.FileData
		if idx := strings.Index(cleanB64, ","); idx != -1 {
			cleanB64 = cleanB64[idx+1:]
		}
		fileBytes, _ = base64.StdEncoding.DecodeString(cleanB64)
	}

	for _, recipient := range req.Recipients {
		rec := strings.TrimSpace(recipient)
		if rec == "" {
			continue
		}

		var jid types.JID
		if strings.Contains(rec, "@") {
			jid, _ = types.ParseJID(rec)
		} else {
			cleanNum := strings.ReplaceAll(strings.ReplaceAll(rec, "+", ""), " ", "")
			jid = types.NewJID(cleanNum, types.DefaultUserServer)
		}

		if len(fileBytes) > 0 {
			mime := req.MimeType
			if mime == "" {
				mime = "application/pdf"
			}
			s.sendDocument(jid, fileBytes, req.FileName, mime, req.Message)
		} else {
			s.sendTextMessage(jid, req.Message)
		}

		sentCount++
		// Gentle throttle for mass messaging
		time.Sleep(200 * time.Millisecond)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"sentCount": sentCount,
	})
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	s := serverInstance
	// Force disconnect immediately and wipe session database so it instantly resets to QR
	if s.client != nil {
		go func() {
			_ = s.client.Logout(context.Background())
		}()
		s.client.Disconnect()
	}
	if s.container != nil {
		_ = s.container.Close()
	}

	_ = os.Remove("whatsapp_session.db")
	_ = os.Remove("whatsapp_session.db-wal")
	_ = os.Remove("whatsapp_session.db-shm")

	s.qrLock.Lock()
	s.qrCode = ""
	s.qrLock.Unlock()

	s.statusLock.Lock()
	s.status = "scan_qr"
	s.statusLock.Unlock()

	// Reinitialize in background immediately
	go func() {
		_ = s.InitWhatsApp()
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func handleResetQR(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	s := serverInstance
	if err := s.ResetAndGetQR(); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

type PairPhoneRequest struct {
	Phone string `json:"phone"`
}

func handlePairPhone(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	s := serverInstance
	if s.client == nil {
		http.Error(w, `{"error":"Cliente no inicializado"}`, http.StatusBadRequest)
		return
	}

	var req PairPhoneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Payload inválido"}`, http.StatusBadRequest)
		return
	}

	cleanPhone := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(req.Phone, "+", ""), " ", ""), "-", "")
	if cleanPhone == "" {
		http.Error(w, `{"error":"Número telefónico requerido"}`, http.StatusBadRequest)
		return
	}

	code, err := s.client.PairPhone(context.Background(), cleanPhone, true, whatsmeow.PairClientSafari, "Safari (macOS)")
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"code":    code,
	})
}

func handleGetSessions(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	s := serverInstance
	s.sessionsLock.RLock()
	sessionsList := s.sessions
	s.sessionsLock.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	if sessionsList == nil {
		sessionsList = []map[string]interface{}{}
	}
	json.NewEncoder(w).Encode(sessionsList)
}

func handleGetConversations(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	s := serverInstance
	s.conversationsLock.RLock()
	defer s.conversationsLock.RUnlock()

	var convList []*ContactConversation
	for _, conv := range s.conversations {
		convList = append(convList, conv)
	}

	// Sort newest first
	sort.Slice(convList, func(i, j int) bool {
		return convList[i].LastMessageAt > convList[j].LastMessageAt
	})

	w.Header().Set("Content-Type", "application/json")
	if convList == nil {
		convList = []*ContactConversation{}
	}
	json.NewEncoder(w).Encode(convList)
}

type UpdateConversationRequest struct {
	Phone           string `json:"phone"`
	Name            string `json:"name"`
	Type            string `json:"type"`
	Characteristics string `json:"characteristics"`
	Orders          string `json:"orders"`
	IsPaused        *bool  `json:"isPaused,omitempty"`
}

func handleUpdateConversation(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	var req UpdateConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload invalido"}`, http.StatusBadRequest)
		return
	}

	cleanPhone := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(req.Phone, "+", ""), " ", ""), "-", "")
	if cleanPhone == "" {
		http.Error(w, `{"error":"teléfono requerido"}`, http.StatusBadRequest)
		return
	}

	s := serverInstance
	conv := s.GetOrCreateConversation(cleanPhone, req.Name)

	s.conversationsLock.Lock()
	if req.Name != "" {
		conv.Name = req.Name
	}
	if req.Type != "" {
		conv.Type = req.Type
	}
	conv.Characteristics = req.Characteristics
	conv.Orders = req.Orders
	if req.IsPaused != nil {
		conv.IsPaused = *req.IsPaused
	}
	s.conversationsLock.Unlock()
	s.SaveConversations()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "conversation": conv})
}

type TogglePauseConversationRequest struct {
	Phone string `json:"phone"`
}

func handleTogglePauseConversation(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}

	var req TogglePauseConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload invalido"}`, http.StatusBadRequest)
		return
	}

	cleanPhone := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(req.Phone, "+", ""), " ", ""), "-", "")
	if cleanPhone == "" {
		http.Error(w, `{"error":"teléfono requerido"}`, http.StatusBadRequest)
		return
	}

	s := serverInstance
	conv := s.GetOrCreateConversation(cleanPhone, "")

	s.conversationsLock.Lock()
	conv.IsPaused = !conv.IsPaused
	newState := conv.IsPaused
	s.conversationsLock.Unlock()
	s.SaveConversations()

	// Also sync into pausedChats in config
	s.configLock.Lock()
	var updatedPaused []string
	found := false
	for _, p := range s.config.PausedChats {
		if strings.ReplaceAll(strings.ReplaceAll(p, "+", ""), " ", "") == cleanPhone {
			found = true
			if !newState {
				continue // remove if unpaused
			}
		}
		updatedPaused = append(updatedPaused, p)
	}
	if newState && !found {
		updatedPaused = append(updatedPaused, cleanPhone)
	}
	s.config.PausedChats = updatedPaused
	s.configLock.Unlock()
	s.SaveConfig()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "phone": cleanPhone, "isPaused": newState})
}

func main() {
	serverInstance = NewWhatsAppServer()
	log.Println("[WhatsApp Server Go] Inicializando cliente whatsmeow...")
	if err := serverInstance.InitWhatsApp(); err != nil {
		log.Printf("[WhatsApp Server Go] Aviso al inicializar: %v\n", err)
	}

	http.HandleFunc("/api/whatsapp/status", handleStatus)
	http.HandleFunc("/api/whatsapp/config", handleConfig)
	http.HandleFunc("/api/whatsapp/groups", handleGetGroups)
	http.HandleFunc("/api/whatsapp/send", handleSendMessage)
	http.HandleFunc("/api/whatsapp/logout", handleLogout)
	http.HandleFunc("/api/whatsapp/reset-qr", handleResetQR)
	http.HandleFunc("/api/whatsapp/pair-phone", handlePairPhone)
	http.HandleFunc("/api/whatsapp/sessions", handleGetSessions)
	http.HandleFunc("/api/whatsapp/conversations", handleGetConversations)
	http.HandleFunc("/api/whatsapp/conversations/update", handleUpdateConversation)
	http.HandleFunc("/api/whatsapp/conversations/toggle-pause", handleTogglePauseConversation)

	port := 8089
	log.Printf("[WhatsApp Server Go] Escuchando en http://localhost:%d\n", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%d", port), nil); err != nil {
		log.Fatalf("Error iniciando servidor Go: %v", err)
	}
}
