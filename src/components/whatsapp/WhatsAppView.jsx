import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Send, Users, QrCode, RefreshCw, Power, 
  Settings2, Paperclip, CheckCircle2, AlertCircle, FileText, 
  Bot, ShieldAlert, Sparkles, Phone, Upload, Trash2, Check,
  Radio, X, GraduationCap, PauseCircle, PlayCircle, Ban, MessagesSquare, Package, CreditCard
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { getStoredGeminiKeys } from '../../utils/storage';
import { WhatsAppConversationsView } from './WhatsAppConversationsView';
import { WhatsAppCatalogView } from './WhatsAppCatalogView';
import { WhatsAppPaymentsView } from './WhatsAppPaymentsView';

const API_BASE = 'http://localhost:8089';

export const WhatsAppView = ({ onOpenApiKeysModal, onNavigateToRecords }) => {
  const { showToast } = useToast();
  
  // Connection state
  const [statusData, setStatusData] = useState({
    status: 'checking',
    connected: false,
    phone: '',
    qr: '',
    config: {
      allowGroups: false,
      allowBroadcast: false,
      autoReply: true,
      geminiKey: '',
    },
  });
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [serverOnline, setServerOnline] = useState(true);

  // Group extraction state
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Send message form
  const [recipientInput, setRecipientInput] = useState('');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [attachment, setAttachment] = useState(null); // { name, data, type }
  const [isSending, setIsSending] = useState(false);

  // Phone pairing code state
  const [phoneForPairing, setPhoneForPairing] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [showPairPhoneModal, setShowPairPhoneModal] = useState(false);

  // Sub tab: 'send' | 'groups' | 'bot_config'
  const [subTab, setSubTab] = useState('send');

  // Input for pausing individual chat
  const [pauseChatInput, setPauseChatInput] = useState('');

  // Fetch status from Go backend
  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch(`${API_BASE}/api/whatsapp/status`);
      if (!res.ok) throw new Error('Servidor Go no responde');
      const data = await res.json();
      setStatusData(data);
      setServerOnline(true);
    } catch (err) {
      setServerOnline(false);
      setStatusData((prev) => ({ ...prev, status: 'offline', connected: false }));
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  // Sync all Gemini keys with Go backend for failover
  useEffect(() => {
    const keys = getStoredGeminiKeys();
    if (keys && keys.length > 0) {
      const allKeyStrings = keys.map((k) => k.key).filter(Boolean);
      // If backend doesn't have the list of keys or needs updating
      const currentKeys = statusData.config?.geminiKeys || [];
      if (allKeyStrings.length !== currentKeys.length || JSON.stringify(allKeyStrings) !== JSON.stringify(currentKeys)) {
        updateConfig({
          geminiKey: allKeyStrings[0] || '',
          geminiKeys: allKeyStrings,
        });
      }
    }
  }, [statusData.config]);

  // Update backend config
  const updateConfig = async (newConfigPartial) => {
    try {
      const payload = {
        ...statusData.config,
        ...newConfigPartial,
      };
      const res = await fetch(`${API_BASE}/api/whatsapp/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json();
        setStatusData((prev) => ({ ...prev, config: saved }));
        showToast('Configuración de WhatsApp guardada', 'success');
      }
    } catch (err) {
      showToast('Error guardando configuración: ' + err.message, 'error');
    }
  };

  // Fetch joined groups from Go backend
  const handleFetchGroups = async () => {
    if (!statusData.connected) {
      showToast('Conecta WhatsApp primero escaneando el código QR', 'warning');
      return;
    }
    try {
      setLoadingGroups(true);
      const res = await fetch(`${API_BASE}/api/whatsapp/groups`);
      if (!res.ok) throw new Error('Error al consultar grupos');
      const data = await res.json();
      setGroups(data || []);
      showToast(`¡Se extrajeron ${data?.length || 0} grupos de WhatsApp!`, 'success');
    } catch (err) {
      showToast('Error extrayendo grupos: ' + err.message, 'error');
    } finally {
      setLoadingGroups(false);
    }
  };

  // Toggle group selection for messaging
  const toggleGroupSelection = (jid) => {
    if (selectedGroups.includes(jid)) {
      setSelectedGroups(selectedGroups.filter((g) => g !== jid));
    } else {
      setSelectedGroups([...selectedGroups, jid]);
    }
  };

  // File attachment handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      showToast('El archivo supera los 25 MB permitidos por WhatsApp', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: file.type || 'application/octet-stream',
        data: reader.result,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      });
      showToast(`Archivo adjunto: ${file.name}`, 'info');
    };
    reader.readAsDataURL(file);
  };

  // Send message or mass campaign
  const handleSendMessage = async () => {
    if (!statusData.connected) {
      showToast('Debes vincular WhatsApp escaneando el código QR primero', 'warning');
      return;
    }

    // Combine recipients from text input and selected groups
    const rawNumbers = recipientInput
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    const allRecipients = Array.from(new Set([...rawNumbers, ...selectedGroups]));

    if (allRecipients.length === 0) {
      showToast('Agrega al menos un número telefónico o selecciona un grupo', 'warning');
      return;
    }

    if (!messageText.trim() && !attachment) {
      showToast('Escribe un mensaje o adjunta un archivo', 'warning');
      return;
    }

    try {
      setIsSending(true);
      showToast(`Enviando a ${allRecipients.length} destinatario(s)...`, 'info');

      const payload = {
        recipients: allRecipients,
        message: messageText.trim(),
        fileName: attachment ? attachment.name : '',
        fileData: attachment ? attachment.data : '',
        mimeType: attachment ? attachment.type : '',
      };

      const res = await fetch(`${API_BASE}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Error al procesar envío');
      const data = await res.json();

      showToast(`¡Mensaje(s) enviado(s) exitosamente a ${data.sentCount} destinatario(s)!`, 'success');
      setMessageText('');
      setAttachment(null);
      setSelectedGroups([]);
    } catch (err) {
      showToast('Error enviando mensaje: ' + err.message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Reset and request new QR
  const handleResetQR = async () => {
    try {
      showToast('Generando nuevo código QR...', 'info');
      await fetch(`${API_BASE}/api/whatsapp/reset-qr`, { method: 'POST' });
      fetchStatus();
    } catch (err) {
      showToast('Error al regenerar QR: ' + err.message, 'error');
    }
  };

  // Toggle individual chat pause
  const handleTogglePauseChat = (targetPhone) => {
    const clean = targetPhone.replace(/[^0-9]/g, '');
    if (!clean) return;

    const currentPaused = statusData.config?.pausedChats || [];
    let updated;
    if (currentPaused.includes(clean)) {
      updated = currentPaused.filter((p) => p !== clean);
      showToast(`Chat con ${clean} reanudado`, 'info');
    } else {
      updated = [...currentPaused, clean];
      showToast(`Chat con ${clean} pausado (no responderá la IA)`, 'warning');
    }

    updateConfig({ pausedChats: updated });
    setPauseChatInput('');
  };

  // Toggle global bot pause
  const handleToggleGlobalPause = () => {
    const current = statusData.config?.autoReply ?? true;
    updateConfig({ autoReply: !current });
    showToast(!current ? 'Chatbot activado globalmente' : 'Chatbot pausado globalmente', !current ? 'success' : 'warning');
  };

  // Logout WhatsApp
  const handleLogout = async () => {
    try {
      setStatusData((prev) => ({
        ...prev,
        connected: false,
        phone: '',
        status: 'scan_qr',
      }));
      await fetch(`${API_BASE}/api/whatsapp/logout`, { method: 'POST' });
      fetchStatus();
      showToast('Sesión de WhatsApp cerrada exitosamente', 'info');
    } catch (err) {
      showToast('Error cerrando sesión: ' + err.message, 'error');
    }
  };

  // Request pairing code with phone number
  const handleRequestPairCode = async () => {
    const clean = phoneForPairing.replace(/[^0-9]/g, '');
    if (!clean || clean.length < 9) {
      showToast('Ingresa un número telefónico válido con código de país (ej. 51987654321)', 'warning');
      return;
    }
    try {
      setPairingLoading(true);
      showToast('Solicitando código de vinculación...', 'info');
      const res = await fetch(`${API_BASE}/api/whatsapp/pair-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener código');
      setPairingCode(data.code);
      showToast('¡Código de vinculación generado!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPairingLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-surface text-on-surface">
      {/* Sidebar: Status & Connection */}
      <aside className="w-full md:w-80 bg-surface-container-low dark:bg-slate-900 border-r border-outline-variant/30 dark:border-slate-800 p-5 flex flex-col gap-4 overflow-y-auto shrink-0 select-none">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-headline font-bold text-on-surface flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              WhatsApp Suite (Go)
            </h2>
            <button
              type="button"
              onClick={fetchStatus}
              disabled={loadingStatus}
              className="p-1.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container-high transition-colors"
              title="Actualizar estado"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin text-primary' : ''}`} />
            </button>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            Motor ultra-rápido en <strong>Go (whatsmeow)</strong> con IA Gemini para respuestas inteligentes cortas y envíos masivos.
          </p>
        </div>

        {/* Server Status Indicator */}
        {!serverOnline ? (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Servidor Go Inactivo</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Para activar el servicio de WhatsApp, inicia el servidor en la carpeta <code>server-go</code> ejecutando:
            </p>
            <div className="p-2 rounded bg-slate-950 text-slate-100 font-mono text-[10px]">
              cd server-go && go run .
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface-variant">Estado del Servicio</span>
              {statusData.connected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Radio className="w-3 h-3 animate-pulse" />
                  Esperando QR
                </span>
              )}
            </div>

            {statusData.connected ? (
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs">
                  <div className="text-[10px] text-outline">Número Vinculado:</div>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    +{statusData.phone}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-1.5 px-3 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Desvincular WhatsApp</span>
                </button>
              </div>
            ) : statusData.qr ? (
              <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-outline-variant/30 text-center">
                <img src={statusData.qr} alt="Código QR WhatsApp" className="w-48 h-48 rounded-lg shadow-sm" />
                <span className="text-[10px] font-mono text-slate-800 font-bold mt-2">
                  ESCANEA CON TU WHATSAPP
                </span>
                <span className="text-[9px] text-slate-500 mb-2">
                  Abre WhatsApp ➔ Dispositivos vinculados ➔ Vincular dispositivo
                </span>
                <div className="flex items-center gap-2 mt-2 w-full">
                  <button
                    type="button"
                    onClick={handleResetQR}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerar QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPairPhoneModal(true)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1 text-[11px] font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors border border-primary/20"
                  >
                    <Phone className="w-3 h-3" />
                    Vincular con Código
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 flex flex-col items-center justify-center gap-2 text-center text-xs text-outline">
                <span>Iniciando sesión segura...</span>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={handleResetQR}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors border border-primary/20"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Generar QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPairPhoneModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors border border-emerald-500/20"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Por Código
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI & Chatbot Quick Toggles & Pause Control */}
        <div className="p-3.5 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-primary" />
              Control del Chatbot
            </span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
              statusData.config?.autoReply !== false
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            }`}>
              {statusData.config?.autoReply !== false ? 'Activo' : 'Pausado'}
            </span>
          </div>

          {/* Global Pause Button */}
          <button
            type="button"
            onClick={handleToggleGlobalPause}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
              statusData.config?.autoReply !== false
                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {statusData.config?.autoReply !== false ? (
              <>
                <PauseCircle className="w-4 h-4 text-amber-500" />
                <span>Pausar Chat Globalmente</span>
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 text-emerald-500" />
                <span>Reanudar Chat Global</span>
              </>
            )}
          </button>

          {/* Individual Chat Pause Section */}
          <div className="pt-2 border-t border-outline-variant/20 dark:border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
              <Ban className="w-3.5 h-3.5 text-rose-500" />
              Pausar Chat Independiente:
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={pauseChatInput}
                onChange={(e) => setPauseChatInput(e.target.value)}
                placeholder="Número (ej: 51987654321)"
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-low text-[11px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <button
                type="button"
                onClick={() => handleTogglePauseChat(pauseChatInput)}
                disabled={!pauseChatInput.trim()}
                className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-[11px] font-bold transition-all disabled:opacity-40 shrink-0"
              >
                Pausar
              </button>
            </div>

            {/* List of individually paused chats */}
            {(statusData.config?.pausedChats && statusData.config.pausedChats.length > 0) && (
              <div className="space-y-1 pt-1">
                <span className="text-[10px] text-outline font-semibold">Chats pausados individualmente:</span>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {statusData.config.pausedChats.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-mono"
                    >
                      +{p}
                      <button
                        type="button"
                        onClick={() => handleTogglePauseChat(p)}
                        className="hover:text-rose-800 dark:hover:text-rose-200"
                        title="Reanudar chat"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-outline-variant/20 dark:border-slate-800 space-y-2">
            <label className="flex items-center justify-between cursor-pointer text-xs">
              <span className="text-on-surface-variant">Responder en Grupos:</span>
              <input
                type="checkbox"
                checked={statusData.config?.allowGroups ?? false}
                onChange={(e) => updateConfig({ allowGroups: e.target.checked })}
                className="accent-primary w-4 h-4 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer text-xs">
              <span className="text-on-surface-variant">Responder en Difusiones:</span>
              <input
                type="checkbox"
                checked={statusData.config?.allowBroadcast ?? false}
                onChange={(e) => updateConfig({ allowBroadcast: e.target.checked })}
                className="accent-primary w-4 h-4 cursor-pointer"
              />
            </label>
          </div>

          <div className="pt-1 text-[10px] text-outline border-t border-outline-variant/20">
            * Al pausar global o individualmente, podrás chatear tú directamente de forma manual sin que la IA intervenga.
          </div>
        </div>

        {/* Gemini API Key Indicator */}
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-primary flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              IA Gemini Conectada
            </span>
            <button
              type="button"
              onClick={onOpenApiKeysModal}
              className="text-[10px] text-primary underline font-semibold"
            >
              Cambiar
            </button>
          </div>
          <p className="text-[10px] text-on-surface-variant">
            El chatbot está preparado para responder en WhatsApp con <strong>lenguaje natural, directo, cálido y sumamente breve</strong> (máximo 2 a 3 líneas).
          </p>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col overflow-hidden bg-surface-container-lowest/40 dark:bg-slate-950">
        {/* Navigation Tabs */}
        <div className="h-12 border-b border-outline-variant/30 dark:border-slate-800 bg-surface-container-low dark:bg-slate-900 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {[
              { id: 'send', label: 'Envío Individual / Masivo', icon: Send },
              { id: 'conversations', label: 'Conversaciones / CRM', icon: MessagesSquare },
              { id: 'catalog', label: 'Productos & Servicios', icon: Package },
              { id: 'payments', label: 'Métodos de Pago', icon: CreditCard },
              { id: 'groups', label: `Grupos Extraídos (${groups.length})`, icon: Users },
              { id: 'bot_info', label: 'Habilidades del Chatbot (CNEB/PDF)', icon: Sparkles },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFetchGroups}
              disabled={loadingGroups || !statusData.connected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 text-primary dark:text-sky-300 text-xs font-semibold hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              <Users className={`w-3.5 h-3.5 ${loadingGroups ? 'animate-spin' : ''}`} />
              <span>{loadingGroups ? 'Extrayendo...' : 'Extraer Grupos'}</span>
            </button>
          </div>
        </div>

        {/* Tab 0: CONVERSATIONS / CRM */}
        {subTab === 'conversations' && (
          <WhatsAppConversationsView onNavigateToRecords={onNavigateToRecords} />
        )}

        {/* Tab: CATALOG (PRODUCTS & SERVICES) */}
        {subTab === 'catalog' && (
          <WhatsAppCatalogView statusData={statusData} onUpdateConfig={updateConfig} />
        )}

        {/* Tab: PAYMENT METHODS */}
        {subTab === 'payments' && (
          <WhatsAppPaymentsView />
        )}

        {/* Tab 1: SEND MESSAGE / MASSIVE CAMPAIGN */}
        {subTab === 'send' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
            <div>
              <h2 className="text-xl font-headline font-bold text-on-surface">Envío de Mensajes y Documentos por WhatsApp</h2>
              <p className="text-xs text-on-surface-variant">Envía mensajes directos a números específicos, listas masivas o grupos seleccionados.</p>
            </div>

            {/* Selected Groups Chips */}
            {selectedGroups.length > 0 && (
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-primary flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Grupos seleccionados para el envío ({selectedGroups.length}):
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedGroups([])}
                    className="text-[10px] text-rose-500 hover:underline"
                  >
                    Quitar todos
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedGroups.map((jid) => {
                    const gInfo = groups.find((g) => g.jid === jid);
                    return (
                      <span
                        key={jid}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-lowest text-xs border border-primary/30 text-primary font-medium"
                      >
                        <span>{gInfo ? gInfo.name : jid}</span>
                        <button
                          type="button"
                          onClick={() => toggleGroupSelection(jid)}
                          className="hover:text-rose-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Form */}
            <div className="space-y-4 p-5 rounded-2xl bg-surface-container-low dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800 shadow-sm">
              <div>
                <label className="text-xs font-bold text-on-surface block mb-1.5">
                  Destinatarios (Números individuales o masivos, uno por línea con código de país):
                </label>
                <textarea
                  rows={3}
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  placeholder="Ejemplo:&#10;51987654321&#10;51912345678&#10;+51 999 888 777"
                  className="w-full p-3 text-xs rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface font-mono outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-[10px] text-outline block mt-1">
                  Puedes pegar columnas de números directamente desde Excel o WhatsApp.
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface block mb-1.5">
                  Mensaje a Enviar:
                </label>
                <textarea
                  rows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Escribe el mensaje que deseas enviar a los destinatarios..."
                  className="w-full p-3 text-xs rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Attachment preview / upload */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-on-surface block">Adjuntar Documento o Archivo Multimedia</span>
                {attachment ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-primary/30">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-5 h-5 text-primary" />
                      <div>
                        <div className="font-semibold text-xs text-on-surface">{attachment.name}</div>
                        <div className="text-[10px] text-outline">{attachment.size} • {attachment.type}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Quitar adjunto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-outline-variant/40 hover:border-primary cursor-pointer text-xs font-medium text-primary bg-surface-container-lowest dark:bg-slate-950 transition-colors">
                    <Paperclip className="w-4 h-4" />
                    <span>Seleccionar Documento (PDF, Word, Imágenes, etc.)</span>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isSending || !statusData.connected}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  <Send className={`w-4 h-4 ${isSending ? 'animate-pulse' : ''}`} />
                  <span>{isSending ? 'Enviando...' : 'Enviar por WhatsApp'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: EXTRACTED GROUPS */}
        {subTab === 'groups' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-headline font-bold text-on-surface">Grupos de WhatsApp ({groups.length})</h2>
                <p className="text-xs text-on-surface-variant">Selecciona los grupos a los que deseas enviar mensajes o comunicados oficiales.</p>
              </div>
              <button
                type="button"
                onClick={handleFetchGroups}
                disabled={loadingGroups || !statusData.connected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-surface-tint shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingGroups ? 'animate-spin' : ''}`} />
                <span>Actualizar Grupos</span>
              </button>
            </div>

            {groups.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-outline-variant/40 space-y-3">
                <Users className="w-8 h-8 text-outline mx-auto" />
                <p className="text-xs text-outline">
                  {statusData.connected
                    ? 'Aún no se han extraído los grupos. Haz clic en "Extraer Grupos" para listarlos.'
                    : 'Conecta tu cuenta de WhatsApp para poder extraer tus grupos.'}
                </p>
                {statusData.connected && (
                  <button
                    type="button"
                    onClick={handleFetchGroups}
                    className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold"
                  >
                    Extraer Grupos Ahora
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groups.map((g) => {
                  const isSelected = selectedGroups.includes(g.jid);
                  return (
                    <div
                      key={g.jid}
                      onClick={() => toggleGroupSelection(g.jid)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-primary/10 border-primary shadow-sm'
                          : 'bg-surface-container-low dark:bg-slate-900 border-outline-variant/30 hover:border-outline-variant/60'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <span className="font-bold text-xs text-on-surface truncate block">{g.name}</span>
                        <span className="text-[10px] text-outline flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {g.participants} participantes
                        </span>
                      </div>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        isSelected ? 'bg-primary border-primary text-on-primary' : 'border-outline-variant/40'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: CHATBOT CAPABILITIES (CNEB + PDF) */}
        {subTab === 'bot_info' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
            <div>
              <h2 className="text-xl font-headline font-bold text-on-surface">Capacidades del Chatbot Inteligente en WhatsApp</h2>
              <p className="text-xs text-on-surface-variant">Conexión directa entre WhatsApp y el motor pedagógico y documental de DocuCraft Pro.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-surface-container-low dark:bg-slate-900 border border-outline-variant/30 space-y-2">
                <div className="flex items-center gap-2 font-bold text-primary text-sm">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  <span>Generador de Sesiones CNEB por Chat</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Cualquier docente puede escribirle al número de WhatsApp solicitudes como:
                </p>
                <div className="p-2.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] leading-relaxed">
                  "Elabora una sesión de aprendizaje acerca del tratamiento del agua para niños de 5to grado de primaria"
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  El chatbot procesará la competencia, capacidades y secuencia didáctica oficial y enviará de inmediato el <strong>documento PDF formateado como archivo adjunto</strong>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container-low dark:bg-slate-900 border border-outline-variant/30 space-y-2">
                <div className="flex items-center gap-2 font-bold text-primary text-sm">
                  <Bot className="w-5 h-5 text-emerald-500" />
                  <span>Respuestas Ultracortas y Humanas</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  El prompt de sistema de WhatsApp está especialmente afinado para:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-xs text-on-surface-variant">
                  <li>Limitar respuestas a un máximo de <strong>2 a 3 líneas directas</strong>.</li>
                  <li>Evitar saludos o despedidas redundantes.</li>
                  <li>Tono cercano y empático propio de mensajería instantánea.</li>
                  <li>Aislamiento de grupos y difusiones por seguridad.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Pairing Code with Phone Number */}
      {showPairPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface dark:bg-slate-900 border border-outline-variant/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Phone className="w-5 h-5" />
                </div>
                <h3 className="text-base font-headline font-bold text-on-surface">
                  Vincular WhatsApp con Código
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPairPhoneModal(false);
                  setPairingCode('');
                }}
                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Si tu cámara no escanea el QR o WhatsApp dice <em>"No se pudo vincular"</em>, usa este método oficial de WhatsApp con código de 8 caracteres:
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface">Número con código de país:</label>
              <input
                type="tel"
                value={phoneForPairing}
                onChange={(e) => setPhoneForPairing(e.target.value)}
                placeholder="Ej: 51987654321"
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
              <span className="text-[10px] text-outline">Incluye tu prefijo internacional sin signo + ni espacios.</span>
            </div>

            {pairingCode && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                  Ingresa este código en tu WhatsApp móvil:
                </span>
                <div className="font-mono text-2xl font-black tracking-widest text-emerald-600 dark:text-emerald-400 selection:bg-emerald-200">
                  {pairingCode}
                </div>
                <p className="text-[10px] text-on-surface-variant">
                  En tu móvil: <strong>Dispositivos vinculados ➔ Vincular dispositivo ➔ Vincular con el número de teléfono</strong>
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPairPhoneModal(false);
                  setPairingCode('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleRequestPairCode}
                disabled={pairingLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {pairingLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{pairingCode ? 'Generar Otro Código' : 'Obtener Código'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
