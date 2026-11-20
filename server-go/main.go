package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
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
	AllowGroups            bool     `json:"allowGroups"`            // Default false
	AllowBroadcast         bool     `json:"allowBroadcast"`         // Default false
	GeminiKey              string   `json:"geminiKey"`
	GeminiKeys             []string `json:"geminiKeys"`
	Models                 []string `json:"models"`
	AutoReply              bool     `json:"autoReply"`              // Chatbot toggle (global pause)
	PausedChats            []string `json:"pausedChats"`            // List of phone numbers / JIDs paused individually
	AuthorizedNumbers      []string `json:"authorizedNumbers"`      // Numbers allowed to manage catalog via WhatsApp
	CatalogCommand         string   `json:"catalogCommand"`         // Custom command prefix, e.g. "/espacio"
	MessageDebounceSeconds int      `json:"messageDebounceSeconds"` // Seconds to group consecutive messages (default 5)
}

type CatalogItem struct {
	ID              string  `json:"id"`
	Kind            string  `json:"kind"`            // "producto" | "servicio"
	Name            string  `json:"name"`
	Price           float64 `json:"price"`
	Currency        string  `json:"currency"`        // e.g. "USD", "PEN"
	Category        string  `json:"category"`        // e.g. "Curso", "Software", "Asesoría"
	Duration        string  `json:"duration"`        // e.g. "4 semanas", "Acceso de por vida"
	Modality        string  `json:"modality"`        // e.g. "Online", "Presencial", "Digital"
	Characteristics string  `json:"characteristics"` // Key features
	Description     string  `json:"description"`
	Active          bool    `json:"active"`
	CreatedAt       int64   `json:"createdAt"`
	UpdatedAt       int64   `json:"updatedAt"`
}

type PaymentMethod struct {
	ID           string `json:"id"`
	Name         string `json:"name"`         // e.g. "Yape", "Plin", "BCP", "PayPal"
	AccountInfo  string `json:"accountInfo"`  // e.g. "987654321 - Titular"
	Instructions string `json:"instructions"` // e.g. "Enviar captura de pago"
	ImageBase64  string `json:"imageBase64"`  // Optimized WebP 85% data URL
	Active       bool   `json:"active"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
}

type PendingMessageBatch struct {
	ChatJID    types.JID
	SenderUser string
	PushName   string
	Texts      []string
	Timer      *time.Timer
}

type ChatMessage struct {
	ID        string `json:"id"`
	FromMe    bool   `json:"fromMe"`
	Sender    string `json:"sender"`
	Text      string `json:"text"`
	Timestamp int64  `json:"timestamp"`
}

type ContactConversation struct {
	Phone           string        `json:"phone"`           // e.g. "51987654321"
	Name            string        `json:"name"`            // Custom assigned name or contact name
	Type            string        `json:"type"`            // "alumno", "cliente", "solicitud", "interesado"
	Characteristics string        `json:"characteristics"`  // Notes / custom features / preferences
	Orders          string        `json:"orders"`          // Orders / Pedidos / Solicitudes
	AppointmentDate string        `json:"appointmentDate"` // ISO string or human date e.g. "2026-11-20 16:00"
	CaseSynced      bool          `json:"caseSynced"`      // True if automatically synced or registered in records
	CaseCode        string        `json:"caseCode"`        // e.g. "EXP-2026-ABCD"
	IsPaused        bool          `json:"isPaused"`        // Individual pause
	Summary         string        `json:"summary"`         // Rolling summary of old context
	Messages        []ChatMessage `json:"messages"`        // Last 15-20 messages
	LastMessageAt   int64         `json:"lastMessageAt"`
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
	catalog           []CatalogItem
	catalogLock       sync.RWMutex
	paymentMethods    []PaymentMethod
	paymentLock       sync.RWMutex
	pendingBatches    map[string]*PendingMessageBatch
	pendingLock       sync.Mutex
	startedAt         time.Time
}

var serverInstance *WhatsAppServer

func dataPath(filename string) string {
	dir := os.Getenv("DATA_DIR")
	if dir == "" {
		dir = "."
	} else {
		_ = os.MkdirAll(dir, 0755)
	}
	return filepath.Join(dir, filename)
}

func NewWhatsAppServer() *WhatsAppServer {
	cfg := Config{
		AllowGroups:            false,
		AllowBroadcast:         false,
		AutoReply:              true,
		CatalogCommand:         "/espacio",
		MessageDebounceSeconds: 5,
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
	if data, err := os.ReadFile(dataPath("whatsapp_config.json")); err == nil {
		_ = json.Unmarshal(data, &cfg)
	}
	if strings.TrimSpace(cfg.CatalogCommand) == "" {
		cfg.CatalogCommand = "/espacio"
	}
	if cfg.MessageDebounceSeconds <= 0 {
		cfg.MessageDebounceSeconds = 5
	}

	var savedSessions []map[string]interface{}
	if data, err := os.ReadFile(dataPath("whatsapp_sessions.json")); err == nil {
		_ = json.Unmarshal(data, &savedSessions)
	}

	savedConversations := make(map[string]*ContactConversation)
	if data, err := os.ReadFile(dataPath("whatsapp_conversations.json")); err == nil {
		_ = json.Unmarshal(data, &savedConversations)
	}

	var savedCatalog []CatalogItem
	if data, err := os.ReadFile(dataPath("whatsapp_catalog.json")); err == nil {
		_ = json.Unmarshal(data, &savedCatalog)
	}

	var savedPayments []PaymentMethod
	if data, err := os.ReadFile(dataPath("whatsapp_payments.json")); err == nil {
		_ = json.Unmarshal(data, &savedPayments)
	}

	return &WhatsAppServer{
		config:         cfg,
		status:         "disconnected",
		sessions:       savedSessions,
		conversations:  savedConversations,
		catalog:        savedCatalog,
		paymentMethods: savedPayments,
		pendingBatches: make(map[string]*PendingMessageBatch),
		startedAt:      time.Now(),
	}
}

func (s *WhatsAppServer) SaveCatalog() {
	s.catalogLock.RLock()
	defer s.catalogLock.RUnlock()
	bytes, _ := json.MarshalIndent(s.catalog, "", "  ")
	_ = os.WriteFile("whatsapp_catalog.json", bytes, 0644)
}

func (s *WhatsAppServer) SavePaymentMethods() {
	s.paymentLock.RLock()
	defer s.paymentLock.RUnlock()
	bytes, _ := json.MarshalIndent(s.paymentMethods, "", "  ")
	_ = os.WriteFile("whatsapp_payments.json", bytes, 0644)
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

	// If this is an incoming message from the user, run asynchronous CRM & Appointment entity extraction
	if !fromMe && len(allKeys) > 0 {
		go s.ExtractCRMEntitiesAsync(phone, text, allKeys, models)
	}
}

// ExtractedCRMInfo represents automatic intent & entity parsing from chat
type ExtractedCRMInfo struct {
	Name            string `json:"name,omitempty"`
	Type            string `json:"type,omitempty"`            // "alumno", "cliente", "solicitud", "interesado"
	Orders          string `json:"orders,omitempty"`          // specific request / trámite / pedido
	Characteristics string `json:"characteristics,omitempty"` // preferences / notes
	AppointmentDate string `json:"appointmentDate,omitempty"` // Date or time of appointment, e.g. "2026-11-20 16:00" o "Viernes 20, 4:00 PM"
	IsAppointment   bool   `json:"isAppointment,omitempty"`
}

func (s *WhatsAppServer) ExtractCRMEntitiesAsync(phone string, incomingText string, allKeys []string, models []string) {
	// Look up conversation
	s.conversationsLock.RLock()
	conv, exists := s.conversations[phone]
	if !exists {
		s.conversationsLock.RUnlock()
		return
	}
	currentName := conv.Name
	currentType := conv.Type
	currentOrders := conv.Orders
	currentCharacteristics := conv.Characteristics
	currentAppointment := conv.AppointmentDate
	s.conversationsLock.RUnlock()

	systemPrompt := `Eres un analizador de CRM para atención al cliente y gestión educativa.
Analiza el mensaje del usuario y extrae información para el registro del expediente:
1. "name": Nombre del usuario si se presenta (ej. "Soy Carlos Mendoza", "mi nombre es Juan"). Si no menciona nombre, devuelve cadena vacía "".
2. "type": Si menciona ser alumno/estudiante ("alumno"), cliente comercial ("cliente"), persona con trámite o reclamo ("solicitud"), o prospecto general ("interesado"). Si no es claro, devuelve "".
3. "orders": Petición, trámite, compra o pedido concreto (ej. "Cotización de certificados", "Asesoría para sesión de aprendizaje CNEB", "Revisión de expediente").
4. "characteristics": Rasgos o preferencias mencionadas (ej. "Profesor de 6to de primaria", "Empresa distribuidora").
5. "appointmentDate": Si solicita o acuerda una cita, reunión, llamada o fecha de entrega (ej. "mañana a las 4pm", "viernes 20 de noviembre 16:00").
6. "isAppointment": true si está solicitando o acordando una cita/reunión/entrevista, false en caso contrario.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con los campos:
{
  "name": "",
  "type": "",
  "orders": "",
  "characteristics": "",
  "appointmentDate": "",
  "isAppointment": false
}`

	userPrompt := fmt.Sprintf("Datos actuales:\nNombre: %s\nTipo: %s\nPedidos actuales: %s\nCaracterísticas: %s\nCita actual: %s\n\nNuevo mensaje recibido del cliente:\n\"%s\"",
		currentName, currentType, currentOrders, currentCharacteristics, currentAppointment, incomingText)

	jsonResult, _, err := CallGeminiWithKeys(allKeys, models, systemPrompt, userPrompt, false)
	if err != nil {
		return
	}

	cleanJSON := strings.TrimSpace(jsonResult)
	if start := strings.Index(cleanJSON, "{"); start != -1 {
		if end := strings.LastIndex(cleanJSON, "}"); end != -1 && end > start {
			cleanJSON = cleanJSON[start : end+1]
		}
	}

	var extracted ExtractedCRMInfo
	if err := json.Unmarshal([]byte(cleanJSON), &extracted); err != nil {
		return
	}

	updated := false
	s.conversationsLock.Lock()
	if c, ok := s.conversations[phone]; ok {
		if extracted.Name != "" && (c.Name == "" || strings.HasPrefix(c.Name, "Contacto +")) {
			c.Name = strings.TrimSpace(extracted.Name)
			updated = true
		}
		if extracted.Type != "" && (c.Type == "" || c.Type == "interesado") {
			c.Type = strings.TrimSpace(extracted.Type)
			updated = true
		}
		if extracted.Orders != "" {
			if c.Orders == "" {
				c.Orders = strings.TrimSpace(extracted.Orders)
			} else if !strings.Contains(c.Orders, extracted.Orders) {
				c.Orders = c.Orders + " | " + strings.TrimSpace(extracted.Orders)
			}
			updated = true
		}
		if extracted.Characteristics != "" {
			if c.Characteristics == "" {
				c.Characteristics = strings.TrimSpace(extracted.Characteristics)
			} else if !strings.Contains(c.Characteristics, extracted.Characteristics) {
				c.Characteristics = c.Characteristics + " | " + strings.TrimSpace(extracted.Characteristics)
			}
			updated = true
		}
		if extracted.AppointmentDate != "" {
			c.AppointmentDate = strings.TrimSpace(extracted.AppointmentDate)
			updated = true
		}
	}
	s.conversationsLock.Unlock()

	if updated {
		s.SaveConversations()
		log.Printf("[CRM Auto-Extract] Contacto +%s actualizado automáticamente con pedidos/citas de IA\n", phone)
	}
}

func (s *WhatsAppServer) SaveSessionRecord(record map[string]interface{}) {
	s.sessionsLock.Lock()
	defer s.sessionsLock.Unlock()
	s.sessions = append([]map[string]interface{}{record}, s.sessions...)
	bytes, _ := json.MarshalIndent(s.sessions, "", "  ")
	_ = os.WriteFile(dataPath("whatsapp_sessions.json"), bytes, 0644)
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
	_ = os.Remove(dataPath("whatsapp_session.db"))
	_ = os.Remove(dataPath("whatsapp_session.db-wal"))
	_ = os.Remove(dataPath("whatsapp_session.db-shm"))

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
	// Ignore historical/offline messages sent before the server started
	if !s.startedAt.IsZero() && msg.Info.Timestamp.Before(s.startedAt) {
		return
	}

	// Extract text early so we can allow self-sent catalog commands (e.g. /espacio)
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

	s.configLock.RLock()
	allowGroups := s.config.AllowGroups
	allowBroadcast := s.config.AllowBroadcast
	autoReply := s.config.AutoReply
	pausedChats := s.config.PausedChats
	apiKey := s.config.GeminiKey
	apiKeys := s.config.GeminiKeys
	models := s.config.Models
	catalogCmd := strings.TrimSpace(s.config.CatalogCommand)
	debounceSec := s.config.MessageDebounceSeconds
	s.configLock.RUnlock()

	if catalogCmd == "" {
		catalogCmd = "/espacio"
	}

	var allKeys []string
	if len(apiKeys) > 0 {
		allKeys = append(allKeys, apiKeys...)
	}
	if apiKey != "" {
		allKeys = append(allKeys, apiKey)
	}

	isCatalogCmd := strings.HasPrefix(strings.ToLower(text), strings.ToLower(catalogCmd))

	// Don't reply to self messages UNLESS it's a catalog command (/espacio ...)
	if msg.Info.IsFromMe && !isCatalogCmd {
		return
	}

	if isCatalogCmd {
		s.handleCatalogCommand(msg.Info.Chat, msg.Info.Sender.User, msg.Info.Chat.User, text, catalogCmd, msg.Info.IsFromMe, allKeys, models)
		return
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

	senderUser = msg.Info.Sender.User
	senderPushName := msg.Info.PushName
	if senderPushName == "" {
		senderPushName = msg.Info.Sender.User
	}

	log.Printf("[WhatsApp In] De: %s (%s) | Mensaje: %s\n", senderUser, senderPushName, text)

	// Save incoming message in contact conversation immediately
	s.AddMessageToConversation(senderUser, senderPushName, false, text, allKeys, models)

	// Retrieve conversation to check individual pause
	conv := s.GetOrCreateConversation(senderUser, senderPushName)
	if conv.IsPaused {
		log.Printf("[WhatsApp Bot] Chat pausado individualmente para %s en conversaciones. Ignorando respuesta automática.\n", senderUser)
		return
	}

	// Debounce / Group consecutive messages within N seconds (default 5s)
	if debounceSec <= 0 {
		s.processIncomingText(msg.Info.Chat, senderUser, senderPushName, text, allKeys, models)
		return
	}

	s.pendingLock.Lock()
	batch, exists := s.pendingBatches[senderUser]
	if exists {
		batch.Texts = append(batch.Texts, text)
		if batch.Timer != nil {
			batch.Timer.Stop()
		}
	} else {
		batch = &PendingMessageBatch{
			ChatJID:    msg.Info.Chat,
			SenderUser: senderUser,
			PushName:   senderPushName,
			Texts:      []string{text},
		}
		s.pendingBatches[senderUser] = batch
	}

	batch.Timer = time.AfterFunc(time.Duration(debounceSec)*time.Second, func() {
		s.pendingLock.Lock()
		b, ok := s.pendingBatches[senderUser]
		if !ok {
			s.pendingLock.Unlock()
			return
		}
		delete(s.pendingBatches, senderUser)
		combinedText := strings.Join(b.Texts, "\n")
		s.pendingLock.Unlock()

		log.Printf("[WhatsApp Debounce] Procesando %d mensajes agrupados de %s\n", len(b.Texts), senderUser)
		s.processIncomingText(b.ChatJID, b.SenderUser, b.PushName, combinedText, allKeys, models)
	})
	s.pendingLock.Unlock()
}

func (s *WhatsAppServer) processIncomingText(chatJID types.JID, senderUser string, senderPushName string, text string, allKeys []string, models []string) {
	conv := s.GetOrCreateConversation(senderUser, senderPushName)
	if conv.IsPaused {
		return
	}

	// If no Gemini Key is configured, notify politely
	if len(allKeys) == 0 {
		s.sendTextMessage(chatJID, "Hola! El chatbot est� activo pero a�n no tiene configurada su Gemini API Key en el panel de DocuCraft Pro.")
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
		s.sendTextMessage(chatJID, ackMsg)
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
					"recipient":              senderUser,
				}
				s.SaveSessionRecord(record)

				pdfBytes, pdfErr := GenerateSessionPDF(&sData)
				if pdfErr == nil && len(pdfBytes) > 0 {
					filename := fmt.Sprintf("Sesion_%s.pdf", strings.ReplaceAll(sData.Titulo, " ", "_"))
					botCaption := fmt.Sprintf("¡Listo! Aquí tienes tu sesión pedagógica oficial en PDF: *%s*", sData.Titulo)
					s.sendDocument(chatJID, pdfBytes, filename, "application/pdf", botCaption)
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

	// Build active catalog context for the AI assistant
	var catalogContext strings.Builder
	s.catalogLock.RLock()
	activeCount := 0
	for _, item := range s.catalog {
		if !item.Active {
			continue
		}
		activeCount++
		if activeCount == 1 {
			catalogContext.WriteString("\nCATÁLOGO OFICIAL DE PRODUCTOS Y SERVICIOS DISPONIBLES:\n")
		}
		catalogContext.WriteString(fmt.Sprintf("- [%s] %s | Precio: %.2f %s | Categoría: %s | Modalidad: %s | Duración: %s | Características: %s | Descripción: %s\n",
			strings.ToUpper(item.Kind), item.Name, item.Price, item.Currency, item.Category, item.Modality, item.Duration, item.Characteristics, item.Description))
	}
	s.catalogLock.RUnlock()

	// Build active payment methods context
	var paymentContext strings.Builder
	s.paymentLock.RLock()
	payCount := 0
	for _, pm := range s.paymentMethods {
		if !pm.Active {
			continue
		}
		payCount++
		if payCount == 1 {
			paymentContext.WriteString("\nMÉTODOS DE PAGO DISPONIBLES:\n")
		}
		hasImg := "No"
		if pm.ImageBase64 != "" {
			hasImg = "Sí (ID: " + pm.ID + ")"
		}
		paymentContext.WriteString(fmt.Sprintf("- %s | Cuenta/Dato: %s | Instrucciones: %s | Imagen QR/Pago: %s\n",
			pm.Name, pm.AccountInfo, pm.Instructions, hasImg))
	}
	s.paymentLock.RUnlock()

	// General short chat with conversation history context
	chatSystemPrompt := `Eres el asesor virtual inteligente de DocuCraft Pro en WhatsApp.
REGLAS:
1. Responde de forma muy concisa, cordial y en máximo 2 a 3 oraciones.
2. Si te piden una sesión pedagógica, di '¡Claro! Enseguida la preparo' y no te quedes en bucles ni pidas más datos; créala.
3. Ayudas con: Sesiones de aprendizaje CNEB, Certificados con QR, registro de alumnos/clientes, citas, productos y servicios.
4. Conoce al cliente por su nombre o pedidos previos si ya te los ha dado en la conversación.
5. Si preguntan por cursos, productos o servicios, usa EXACTAMENTE la información y precios del catálogo oficial.
6. Si preguntan cómo pagar o piden métodos de pago/QR, indícales los datos del método de pago y si tiene imagen disponible incluye al final de tu respuesta la etiqueta exacta [SEND_PAYMENT_IMG:ID_DEL_METODO] (por ejemplo [SEND_PAYMENT_IMG:pay_123456]) para que se envíe la imagen automáticamente.` + catalogContext.String() + paymentContext.String()

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
		s.sendTextMessage(chatJID, "Hola! Tuve una breve pausa con la IA, por favor repíteme tu consulta.")
		return
	}

	// Check if Gemini requested sending payment method image(s) via [SEND_PAYMENT_IMG:<id>]
	var paymentImgsToSend []PaymentMethod
	s.paymentLock.RLock()
	for _, pm := range s.paymentMethods {
		tag := fmt.Sprintf("[SEND_PAYMENT_IMG:%s]", pm.ID)
		if strings.Contains(respText, tag) {
			respText = strings.ReplaceAll(respText, tag, "")
			if pm.ImageBase64 != "" {
				paymentImgsToSend = append(paymentImgsToSend, pm)
			}
		}
	}
	s.paymentLock.RUnlock()
	respText = strings.TrimSpace(respText)

	if respText != "" {
		s.sendTextMessage(chatJID, respText)
		s.AddMessageToConversation(senderUser, "DocuCraft Bot", true, respText, allKeys, models)
	}

	for _, pm := range paymentImgsToSend {
		cleanB64 := pm.ImageBase64
		if idx := strings.Index(cleanB64, ","); idx != -1 {
			cleanB64 = cleanB64[idx+1:]
		}
		if imgBytes, decErr := base64.StdEncoding.DecodeString(cleanB64); decErr == nil && len(imgBytes) > 0 {
			s.sendImage(chatJID, imgBytes, "image/webp", fmt.Sprintf("💳 *%s*\n%s", pm.Name, pm.AccountInfo))
		}
	}
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

func (s *WhatsAppServer) sendImage(to types.JID, data []byte, mime, caption string) {
	if s.client == nil || !s.client.IsConnected() {
		return
	}
	uploaded, err := s.client.Upload(context.Background(), data, whatsmeow.MediaImage)
	if err != nil {
		log.Printf("[WhatsApp] Error subiendo imagen: %v\n", err)
		return
	}
	msg := &waProto.Message{
		ImageMessage: &waProto.ImageMessage{
			Caption:       proto.String(caption),
			Mimetype:      proto.String(mime),
			URL:           proto.String(uploaded.URL),
			DirectPath:    proto.String(uploaded.DirectPath),
			MediaKey:      uploaded.MediaKey,
			FileEncSHA256: uploaded.FileEncSHA256,
			FileSHA256:    uploaded.FileSHA256,
			FileLength:    proto.Uint64(uint64(len(data))),
		},
	}
	_, err = s.client.SendMessage(context.Background(), to, msg)
	if err != nil {
		log.Printf("[WhatsApp] Error enviando imagen a %s: %v\n", to, err)
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
			if newCfg.AuthorizedNumbers != nil {
				s.config.AuthorizedNumbers = newCfg.AuthorizedNumbers
			}
			if strings.TrimSpace(newCfg.CatalogCommand) != "" {
				s.config.CatalogCommand = strings.TrimSpace(newCfg.CatalogCommand)
			}
			if newCfg.MessageDebounceSeconds >= 0 {
				s.config.MessageDebounceSeconds = newCfg.MessageDebounceSeconds
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

	_ = os.Remove(dataPath("whatsapp_session.db"))
	_ = os.Remove(dataPath("whatsapp_session.db-wal"))
	_ = os.Remove(dataPath("whatsapp_session.db-shm"))

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
	AppointmentDate string `json:"appointmentDate"`
	CaseSynced      *bool  `json:"caseSynced,omitempty"`
	CaseCode        string `json:"caseCode,omitempty"`
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
	if req.AppointmentDate != "" {
		conv.AppointmentDate = req.AppointmentDate
	}
	if req.CaseSynced != nil {
		conv.CaseSynced = *req.CaseSynced
	}
	if req.CaseCode != "" {
		conv.CaseCode = req.CaseCode
	}
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

type CatalogCommandIntent struct {
	Target          string  `json:"target"`          // "catalog" | "payment"
	Action          string  `json:"action"`          // "create" | "update" | "delete" | "list"
	TargetName      string  `json:"targetName"`      // Name to match for update/delete
	Kind            string  `json:"kind"`            // "producto" | "servicio"
	Name            string  `json:"name"`
	Price           float64 `json:"price"`
	Currency        string  `json:"currency"`        // "USD", "PEN", etc.
	Category        string  `json:"category"`
	Duration        string  `json:"duration"`
	Modality        string  `json:"modality"`
	Characteristics string  `json:"characteristics"`
	Description     string  `json:"description"`
	AccountInfo     string  `json:"accountInfo"`     // For payment: phone, account number, CCI, link
	Instructions    string  `json:"instructions"`    // For payment: instructions
}

func (s *WhatsAppServer) handleCatalogCommand(chatJID types.JID, senderUser string, chatUser string, fullText string, cmdPrefix string, isFromMe bool, allKeys []string, models []string) {
	// 1. Check authorization
	s.configLock.RLock()
	authNums := s.config.AuthorizedNumbers
	s.configLock.RUnlock()

	isAuthorized := isFromMe
	if !isAuthorized {
		var candidateUsers []string
		candidateUsers = append(candidateUsers, senderUser, chatUser)

		// Resolve LID to Phone Number if WhatsApp sent a @lid JID
		if s.client != nil && s.client.Store != nil && s.client.Store.LIDs != nil {
			if pnJID, err := s.client.Store.LIDs.GetPNForLID(context.Background(), chatJID); err == nil && pnJID.User != "" {
				candidateUsers = append(candidateUsers, pnJID.User)
			}
		}

		for _, cand := range candidateUsers {
			cleanCand := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(cand, "+", ""), " ", ""), "-", "")
			if cleanCand == "" {
				continue
			}
			for _, n := range authNums {
				cleanAuth := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(n, "+", ""), " ", ""), "-", "")
				if cleanAuth != "" && (cleanAuth == cleanCand || strings.HasSuffix(cleanCand, cleanAuth) || strings.HasSuffix(cleanAuth, cleanCand)) {
					isAuthorized = true
					break
				}
			}
			if isAuthorized {
				break
			}
		}
	}

	if !isAuthorized {
		reply := "⛔ No tienes autorización para usar el comando de gestión de catálogo (" + cmdPrefix + ")."
		s.sendTextMessage(chatJID, reply)
		s.AddMessageToConversation(senderUser, "DocuCraft Bot", true, reply, allKeys, models)
		return
	}

	if len(allKeys) == 0 {
		reply := "⚠️ No hay claves de Gemini configuradas para interpretar el comando."
		s.sendTextMessage(chatJID, reply)
		return
	}

	// Strip command prefix
	instruction := strings.TrimSpace(fullText[len(cmdPrefix):])
	if instruction == "" {
		reply := fmt.Sprintf("ℹ️ Usa *%s* seguido de tu instrucción.\nEjemplo: _%s crea el curso de Apps en Desktop Windows + Técnico PC a precio de 37 USD_", cmdPrefix, cmdPrefix)
		s.sendTextMessage(chatJID, reply)
		s.AddMessageToConversation(senderUser, "DocuCraft Bot", true, reply, allKeys, models)
		return
	}

	// Build existing catalog & payment names for update/delete matching
	s.catalogLock.RLock()
	var existingNames []string
	for _, item := range s.catalog {
		existingNames = append(existingNames, fmt.Sprintf("[CATÁLOGO] %s (%s - %.2f %s)", item.Name, item.Kind, item.Price, item.Currency))
	}
	s.catalogLock.RUnlock()

	s.paymentLock.RLock()
	for _, pm := range s.paymentMethods {
		existingNames = append(existingNames, fmt.Sprintf("[PAGO] %s (%s)", pm.Name, pm.AccountInfo))
	}
	s.paymentLock.RUnlock()

	systemPrompt := `Eres un intérprete de comandos administrativos para:
1) Catálogo de Productos y Servicios ("target": "catalog")
2) Métodos de Pago ("target": "payment") — ej. Yape, Plin, BCP, Interbank, PayPal, Binance, transferencias, cuentas, números de pago.

Analiza la instrucción y devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "target": "catalog" | "payment",
  "action": "create" | "update" | "delete" | "list",
  "targetName": "nombre existente si es update o delete",
  "kind": "producto" | "servicio",
  "name": "Nombre del producto/servicio o del método de pago",
  "price": 37.0,
  "currency": "USD",
  "category": "Curso" | "Software" | "Asesoría" | "Servicio Técnico" | "Otro",
  "duration": "",
  "modality": "Online" | "Presencial" | "Digital" | "",
  "characteristics": "",
  "description": "",
  "accountInfo": "número, cuenta, CCI o enlace si es método de pago",
  "instructions": "instrucciones de pago si se mencionan"
}
Reglas:
- Si menciona método de pago, Yape, Plin, banco, cuenta, CCI, PayPal o Binance -> "target": "payment".
- Si menciona curso, producto, servicio, software, taller -> "target": "catalog".`

	userPrompt := fmt.Sprintf("Catálogo actual:\n%s\n\nInstrucción del administrador:\n%s", strings.Join(existingNames, "\n"), instruction)
	jsonText, _, err := CallGeminiWithKeys(allKeys, models, systemPrompt, userPrompt, false)
	if err != nil {
		reply := "❌ Error al interpretar el comando con IA. Intenta nuevamente."
		s.sendTextMessage(chatJID, reply)
		return
	}

	cleanJSON := strings.TrimSpace(jsonText)
	if start := strings.Index(cleanJSON, "{"); start != -1 {
		if end := strings.LastIndex(cleanJSON, "}"); end != -1 && end > start {
			cleanJSON = cleanJSON[start : end+1]
		}
	}

	var intent CatalogCommandIntent
	if err := json.Unmarshal([]byte(cleanJSON), &intent); err != nil {
		reply := "❌ No pude entender la estructura del comando. Especifica si deseas crear, editar o eliminar un producto/servicio."
		s.sendTextMessage(chatJID, reply)
		return
	}

	now := time.Now().UnixMilli()
	var reply string

	if strings.ToLower(intent.Target) == "payment" {
		switch strings.ToLower(intent.Action) {
		case "list":
			s.paymentLock.RLock()
			if len(s.paymentMethods) == 0 {
				reply = "💳 No hay métodos de pago registrados actualmente."
			} else {
				var sb strings.Builder
				sb.WriteString("💳 *Métodos de Pago:*\n")
				for i, pm := range s.paymentMethods {
					status := "✅"
					if !pm.Active {
						status = "⏸️"
					}
					sb.WriteString(fmt.Sprintf("%d. %s *%s* — %s\n", i+1, status, pm.Name, pm.AccountInfo))
				}
				reply = sb.String()
			}
			s.paymentLock.RUnlock()

		case "create":
			newPM := PaymentMethod{
				ID:           fmt.Sprintf("pay_%d", now),
				Name:         intent.Name,
				AccountInfo:  intent.AccountInfo,
				Instructions: intent.Instructions,
				Active:       true,
				CreatedAt:    now,
				UpdatedAt:    now,
			}
			s.paymentLock.Lock()
			s.paymentMethods = append([]PaymentMethod{newPM}, s.paymentMethods...)
			s.paymentLock.Unlock()
			s.SavePaymentMethods()
			reply = fmt.Sprintf("✅ *Método de pago agregado:*\n💳 *Nombre:* %s\n🔢 *Cuenta/Dato:* %s", newPM.Name, newPM.AccountInfo)

		case "update":
			target := strings.ToLower(strings.TrimSpace(intent.TargetName))
			if target == "" {
				target = strings.ToLower(strings.TrimSpace(intent.Name))
			}
			updated := false
			var updatedName string
			s.paymentLock.Lock()
			for i := range s.paymentMethods {
				if strings.Contains(strings.ToLower(s.paymentMethods[i].Name), target) || strings.Contains(target, strings.ToLower(s.paymentMethods[i].Name)) {
					if intent.Name != "" {
						s.paymentMethods[i].Name = intent.Name
					}
					if intent.AccountInfo != "" {
						s.paymentMethods[i].AccountInfo = intent.AccountInfo
					}
					if intent.Instructions != "" {
						s.paymentMethods[i].Instructions = intent.Instructions
					}
					s.paymentMethods[i].UpdatedAt = now
					updatedName = s.paymentMethods[i].Name
					updated = true
					break
				}
			}
			s.paymentLock.Unlock()
			if updated {
				s.SavePaymentMethods()
				reply = fmt.Sprintf("✏️ *Método de pago actualizado:* %s", updatedName)
			} else {
				reply = fmt.Sprintf("⚠️ No encontré ningún método de pago que coincida con *%s*.", intent.TargetName)
			}

		case "delete":
			target := strings.ToLower(strings.TrimSpace(intent.TargetName))
			if target == "" {
				target = strings.ToLower(strings.TrimSpace(intent.Name))
			}
			deleted := false
			var deletedName string
			s.paymentLock.Lock()
			var remaining []PaymentMethod
			for _, pm := range s.paymentMethods {
				if !deleted && (strings.Contains(strings.ToLower(pm.Name), target) || strings.Contains(target, strings.ToLower(pm.Name))) {
					deleted = true
					deletedName = pm.Name
					continue
				}
				remaining = append(remaining, pm)
			}
			s.paymentMethods = remaining
			s.paymentLock.Unlock()
			if deleted {
				s.SavePaymentMethods()
				reply = fmt.Sprintf("🗑️ *Método de pago eliminado:* %s", deletedName)
			} else {
				reply = fmt.Sprintf("⚠️ No encontré ningún método de pago para eliminar con el nombre *%s*.", intent.TargetName)
			}

		default:
			reply = "ℹ️ Acción no reconocida para métodos de pago."
		}

		s.sendTextMessage(chatJID, reply)
		s.AddMessageToConversation(senderUser, "DocuCraft Bot", true, reply, allKeys, models)
		return
	}

	switch strings.ToLower(intent.Action) {
	case "list":
		s.catalogLock.RLock()
		if len(s.catalog) == 0 {
			reply = "📦 El catálogo está vacío actualmente."
		} else {
			var sb strings.Builder
			sb.WriteString("📦 *Catálogo Actual:*\n")
			for i, item := range s.catalog {
				status := "✅"
				if !item.Active {
					status = "⏸️"
				}
				sb.WriteString(fmt.Sprintf("%d. %s *%s* (%s) - %.2f %s\n", i+1, status, item.Name, item.Kind, item.Price, item.Currency))
			}
			reply = sb.String()
		}
		s.catalogLock.RUnlock()

	case "create":
		kind := intent.Kind
		if kind != "producto" && kind != "servicio" {
			kind = "servicio"
		}
		currency := intent.Currency
		if currency == "" {
			currency = "USD"
		}
		newItem := CatalogItem{
			ID:              fmt.Sprintf("cat_%d", now),
			Kind:            kind,
			Name:            intent.Name,
			Price:           intent.Price,
			Currency:        currency,
			Category:        intent.Category,
			Duration:        intent.Duration,
			Modality:        intent.Modality,
			Characteristics: intent.Characteristics,
			Description:     intent.Description,
			Active:          true,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		s.catalogLock.Lock()
		s.catalog = append([]CatalogItem{newItem}, s.catalog...)
		s.catalogLock.Unlock()
		s.SaveCatalog()
		reply = fmt.Sprintf("✅ *%s creado exitosamente:*\n📌 *Nombre:* %s\n💰 *Precio:* %.2f %s\n🏷️ *Categoría:* %s",
			strings.Title(kind), newItem.Name, newItem.Price, newItem.Currency, newItem.Category)

	case "update":
		target := strings.ToLower(strings.TrimSpace(intent.TargetName))
		if target == "" {
			target = strings.ToLower(strings.TrimSpace(intent.Name))
		}
		updated := false
		var updatedName string
		s.catalogLock.Lock()
		for i := range s.catalog {
			if strings.Contains(strings.ToLower(s.catalog[i].Name), target) || strings.Contains(target, strings.ToLower(s.catalog[i].Name)) {
				if intent.Name != "" {
					s.catalog[i].Name = intent.Name
				}
				if intent.Price > 0 {
					s.catalog[i].Price = intent.Price
				}
				if intent.Currency != "" {
					s.catalog[i].Currency = intent.Currency
				}
				if intent.Category != "" {
					s.catalog[i].Category = intent.Category
				}
				if intent.Characteristics != "" {
					s.catalog[i].Characteristics = intent.Characteristics
				}
				if intent.Description != "" {
					s.catalog[i].Description = intent.Description
				}
				s.catalog[i].UpdatedAt = now
				updatedName = s.catalog[i].Name
				updated = true
				break
			}
		}
		s.catalogLock.Unlock()
		if updated {
			s.SaveCatalog()
			reply = fmt.Sprintf("✏️ *Catálogo actualizado:* %s", updatedName)
		} else {
			reply = fmt.Sprintf("⚠️ No encontré ningún producto/servicio que coincida con *%s*.", intent.TargetName)
		}

	case "delete":
		target := strings.ToLower(strings.TrimSpace(intent.TargetName))
		if target == "" {
			target = strings.ToLower(strings.TrimSpace(intent.Name))
		}
		deleted := false
		var deletedName string
		s.catalogLock.Lock()
		var remaining []CatalogItem
		for _, item := range s.catalog {
			if !deleted && (strings.Contains(strings.ToLower(item.Name), target) || strings.Contains(target, strings.ToLower(item.Name))) {
				deleted = true
				deletedName = item.Name
				continue
			}
			remaining = append(remaining, item)
		}
		s.catalog = remaining
		s.catalogLock.Unlock()
		if deleted {
			s.SaveCatalog()
			reply = fmt.Sprintf("🗑️ *Eliminado del catálogo:* %s", deletedName)
		} else {
			reply = fmt.Sprintf("⚠️ No encontré ningún elemento para eliminar con el nombre *%s*.", intent.TargetName)
		}

	default:
		reply = "ℹ️ Acción no reconocida. Usa crear, actualizar, eliminar o listar."
	}

	s.sendTextMessage(chatJID, reply)
	s.AddMessageToConversation(senderUser, "DocuCraft Bot", true, reply, allKeys, models)
}

func handleGetCatalog(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}
	s := serverInstance
	s.catalogLock.RLock()
	items := s.catalog
	s.catalogLock.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	if items == nil {
		items = []CatalogItem{}
	}
	json.NewEncoder(w).Encode(items)
}

func handleSaveCatalogItem(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}
	var item CatalogItem
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		http.Error(w, `{"error":"payload invalido"}`, http.StatusBadRequest)
		return
	}

	now := time.Now().UnixMilli()
	s := serverInstance
	s.catalogLock.Lock()
	if item.ID == "" {
		item.ID = fmt.Sprintf("cat_%d", now)
		item.CreatedAt = now
		item.UpdatedAt = now
		s.catalog = append([]CatalogItem{item}, s.catalog...)
	} else {
		found := false
		for i := range s.catalog {
			if s.catalog[i].ID == item.ID {
				item.CreatedAt = s.catalog[i].CreatedAt
				item.UpdatedAt = now
				s.catalog[i] = item
				found = true
				break
			}
		}
		if !found {
			item.CreatedAt = now
			item.UpdatedAt = now
			s.catalog = append([]CatalogItem{item}, s.catalog...)
		}
	}
	s.catalogLock.Unlock()
	s.SaveCatalog()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "item": item})
}

func handleDeleteCatalogItem(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
		http.Error(w, `{"error":"id requerido"}`, http.StatusBadRequest)
		return
	}

	s := serverInstance
	s.catalogLock.Lock()
	var remaining []CatalogItem
	for _, item := range s.catalog {
		if item.ID != req.ID {
			remaining = append(remaining, item)
		}
	}
	s.catalog = remaining
	s.catalogLock.Unlock()
	s.SaveCatalog()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func handleGetPayments(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}
	s := serverInstance
	s.paymentLock.RLock()
	items := s.paymentMethods
	s.paymentLock.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	if items == nil {
		items = []PaymentMethod{}
	}
	json.NewEncoder(w).Encode(items)
}

func handleSavePayment(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}
	var pm PaymentMethod
	if err := json.NewDecoder(r.Body).Decode(&pm); err != nil {
		http.Error(w, `{"error":"payload invalido"}`, http.StatusBadRequest)
		return
	}

	now := time.Now().UnixMilli()
	s := serverInstance
	s.paymentLock.Lock()
	if pm.ID == "" {
		pm.ID = fmt.Sprintf("pay_%d", now)
		pm.CreatedAt = now
		pm.UpdatedAt = now
		s.paymentMethods = append([]PaymentMethod{pm}, s.paymentMethods...)
	} else {
		found := false
		for i := range s.paymentMethods {
			if s.paymentMethods[i].ID == pm.ID {
				pm.CreatedAt = s.paymentMethods[i].CreatedAt
				pm.UpdatedAt = now
				s.paymentMethods[i] = pm
				found = true
				break
			}
		}
		if !found {
			pm.CreatedAt = now
			pm.UpdatedAt = now
			s.paymentMethods = append([]PaymentMethod{pm}, s.paymentMethods...)
		}
	}
	s.paymentLock.Unlock()
	s.SavePaymentMethods()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "paymentMethod": pm})
}

func handleDeletePayment(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == "OPTIONS" {
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
		http.Error(w, `{"error":"id requerido"}`, http.StatusBadRequest)
		return
	}

	s := serverInstance
	s.paymentLock.Lock()
	var remaining []PaymentMethod
	for _, pm := range s.paymentMethods {
		if pm.ID != req.ID {
			remaining = append(remaining, pm)
		}
	}
	s.paymentMethods = remaining
	s.paymentLock.Unlock()
	s.SavePaymentMethods()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
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
	http.HandleFunc("/api/whatsapp/catalog", handleGetCatalog)
	http.HandleFunc("/api/whatsapp/catalog/save", handleSaveCatalogItem)
	http.HandleFunc("/api/whatsapp/catalog/delete", handleDeleteCatalogItem)
	http.HandleFunc("/api/whatsapp/payments", handleGetPayments)
	http.HandleFunc("/api/whatsapp/payments/save", handleSavePayment)
	http.HandleFunc("/api/whatsapp/payments/delete", handleDeletePayment)

	// Serve built frontend static files in production (Docker / Coolify)
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		if _, err := os.Stat("./dist"); err == nil {
			staticDir = "./dist"
		}
	}
	if staticDir != "" {
		fs := http.FileServer(http.Dir(staticDir))
		http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.NotFound(w, r)
				return
			}
			fullPath := filepath.Join(staticDir, filepath.Clean(r.URL.Path))
			if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
				fs.ServeHTTP(w, r)
				return
			}
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
		})
		log.Printf("[WhatsApp Server Go] Sirviendo frontend estático desde %s\n", staticDir)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8089"
	}
	log.Printf("[WhatsApp Server Go] Escuchando en http://localhost:%s\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Error iniciando servidor Go: %v", err)
	}
}
