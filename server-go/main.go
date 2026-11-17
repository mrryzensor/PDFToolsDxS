package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
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
	AutoReply      bool     `json:"autoReply"`      // Chatbot toggle
}

type WhatsAppServer struct {
	client     *whatsmeow.Client
	container  *sqlstore.Container
	config     Config
	configLock sync.RWMutex
	qrCode     string
	qrLock     sync.RWMutex
	status     string
	statusLock sync.RWMutex
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

	return &WhatsAppServer{
		config: cfg,
		status: "disconnected",
	}
}

func (s *WhatsAppServer) SaveConfig() {
	s.configLock.RLock()
	defer s.configLock.RUnlock()
	bytes, _ := json.MarshalIndent(s.config, "", "  ")
	_ = os.WriteFile("whatsapp_config.json", bytes, 0644)
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

	if !autoReply {
		return
	}

	isGroup := msg.Info.IsGroup
	if isGroup && !allowGroups {
		return // Ignore group messages per user setting
	}

	isBroadcast := strings.HasSuffix(msg.Info.Chat.String(), "@broadcast")
	if isBroadcast && !allowBroadcast {
		return // Ignore broadcasts per user setting
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

	log.Printf("[WhatsApp In] De: %s | Mensaje: %s\n", msg.Info.Sender.User, text)

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
		s.sendTextMessage(msg.Info.Chat, "¡Entendido! Estoy elaborando tu sesión de aprendizaje CNEB completa y generando el documento PDF. Dame unos segundos...")

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
				pdfBytes, pdfErr := GenerateSessionPDF(&sData)
				if pdfErr == nil && len(pdfBytes) > 0 {
					filename := fmt.Sprintf("Sesion_%s.pdf", strings.ReplaceAll(sData.Titulo, " ", "_"))
					s.sendDocument(msg.Info.Chat, pdfBytes, filename, "application/pdf", fmt.Sprintf("¡Listo! Aquí tienes tu sesión pedagógica oficial en PDF: *%s*", sData.Titulo))
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

	// General short chat
	chatSystemPrompt := `Eres el asistente virtual de DocuCraft Pro en WhatsApp.
REGLAS:
1. Responde de forma muy concisa, cercana y en máximo 2 a 3 oraciones.
2. Si te piden una sesión pedagógica, di '¡Claro! Enseguida la preparo' y no pidas más preguntas.
3. Ayudas con: Sesiones de aprendizaje CNEB, Certificados con QR y documentos PDF.`

	respText, _, err := CallGeminiWithKeys(allKeys, models, chatSystemPrompt, text, false)
	if err != nil {
		log.Printf("[WhatsApp Bot] Error general Gemini: %v\n", err)
		s.sendTextMessage(msg.Info.Chat, "Hola! Tuve una breve pausa con la IA, por favor repíteme tu consulta.")
		return
	}

	s.sendTextMessage(msg.Info.Chat, respText)
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

	port := 8089
	log.Printf("[WhatsApp Server Go] Escuchando en http://localhost:%d\n", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%d", port), nil); err != nil {
		log.Fatalf("Error iniciando servidor Go: %v", err)
	}
}
