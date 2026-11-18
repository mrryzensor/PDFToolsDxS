import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, User, Bot, Send, PauseCircle, PlayCircle, 
  ExternalLink, Edit3, Check, RefreshCw, Sparkles, AlertCircle,
  Clock, CheckCircle2, ChevronRight, Phone, ShieldCheck, Tag
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { getRecordsCases, saveRecordCase } from '../../utils/storage';

const API_BASE = 'http://localhost:8089';

export const WhatsAppConversationsView = ({ onNavigateToRecords }) => {
  const { showToast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [manualMessage, setManualMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Contact Details Edit State
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailForm, setDetailForm] = useState({
    name: '',
    type: 'interesado',
    characteristics: '',
    orders: '',
  });

  const messagesEndRef = useRef(null);

  const fetchConversations = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`${API_BASE}/api/whatsapp/conversations`);
      if (!res.ok) throw new Error('Error al cargar conversaciones');
      const data = await res.json();
      setConversations(data || []);
      
      // Auto-select first if none selected
      if (!selectedPhone && data && data.length > 0) {
        setSelectedPhone(data[0].phone);
      }
    } catch (err) {
      if (!silent) showToast('No se pudieron obtener las conversaciones', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(() => {
      fetchConversations(true);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const activeConv = conversations.find(c => c.phone === selectedPhone) || null;

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConv?.messages]);

  // Sync form when activeConv changes
  useEffect(() => {
    if (activeConv) {
      setDetailForm({
        name: activeConv.name || '',
        type: activeConv.type || 'interesado',
        characteristics: activeConv.characteristics || '',
        orders: activeConv.orders || '',
      });
      setEditingDetails(false);
    }
  }, [activeConv?.phone]);

  const handleTogglePause = async (phone) => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/conversations/toggle-pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.isPaused ? `Bot pausado para +${phone}` : `Bot reactivado para +${phone}`, 'info');
        fetchConversations(true);
      }
    } catch (err) {
      showToast('Error al alternar pausa del bot', 'error');
    }
  };

  const handleSaveDetails = async () => {
    if (!activeConv) return;
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/conversations/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: activeConv.phone,
          name: detailForm.name,
          type: detailForm.type,
          characteristics: detailForm.characteristics,
          orders: detailForm.orders,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Datos del contacto actualizados', 'success');
        setEditingDetails(false);
        fetchConversations(true);
      }
    } catch (err) {
      showToast('Error al actualizar datos', 'error');
    }
  };

  const handleSendManual = async (e) => {
    e?.preventDefault();
    if (!manualMessage.trim() || !activeConv || isSending) return;

    try {
      setIsSending(true);
      const res = await fetch(`${API_BASE}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: [activeConv.phone],
          message: manualMessage.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setManualMessage('');
        showToast('Mensaje enviado', 'success');
        fetchConversations(true);
      } else {
        showToast('Error al enviar mensaje', 'error');
      }
    } catch (err) {
      showToast('Error de red al enviar mensaje', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleExportToRecords = () => {
    if (!activeConv) return;
    const records = getRecordsCases();
    
    // Check if already registered
    const existing = records.find(r => r.phone && r.phone.replace(/\D/g, '') === activeConv.phone);
    if (existing) {
      showToast(`Este contacto ya está registrado como expediente (${existing.code})`, 'info');
      if (onNavigateToRecords) onNavigateToRecords();
      return;
    }

    const year = new Date().getFullYear();
    const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      code: `EXP-${year}-${randomCode}`,
      type: activeConv.type || 'interesado',
      fullName: activeConv.name || `Contacto WhatsApp +${activeConv.phone}`,
      docType: 'DNI',
      docNumber: '',
      email: '',
      phone: activeConv.phone,
      category: activeConv.type === 'alumno' ? 'Estudiante Virtual' : 'Atención WhatsApp',
      status: 'Nuevo',
      progress: 10,
      dueDate: '',
      description: `Importado desde Chat WhatsApp.\n\nCaracterísticas:\n${activeConv.characteristics || 'Sin notas'}\n\nPedidos / Solicitud:\n${activeConv.orders || 'Sin pedidos registrados'}\n\nResumen Histórico IA:\n${activeConv.summary || 'Sin resumen previo'}`,
      notes: [
        {
          id: `note_${Date.now()}`,
          text: `Vinculado automáticamente desde la suite de WhatsApp DocuCraft.`,
          date: new Date().toISOString(),
          author: 'Sistema WhatsApp',
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveRecordCase(newRecord);
    showToast(`¡Expediente ${newRecord.code} creado exitosamente en Gestión & Casos!`, 'success');
    if (onNavigateToRecords) {
      onNavigateToRecords();
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-surface-container-lowest/40 dark:bg-slate-950">
      {/* LEFT: Conversation List */}
      <aside className="w-80 border-r border-outline-variant/30 dark:border-slate-800 bg-surface-container-low/70 dark:bg-slate-900/60 flex flex-col shrink-0">
        <div className="p-3 border-b border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-on-surface">Conversaciones ({conversations.length})</span>
          </div>
          <button
            type="button"
            onClick={() => fetchConversations()}
            disabled={loading}
            className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
            title="Refrescar chats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* List of Contacts */}
        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10 dark:divide-slate-800/40">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-on-surface-variant space-y-2">
              <MessageSquare className="w-8 h-8 text-outline mx-auto stroke-1" />
              <p>Aún no hay conversaciones registradas.</p>
              <p className="text-[11px] text-outline">Los clientes que escriban a tu WhatsApp aparecerán aquí automáticamente.</p>
            </div>
          ) : (
            conversations.map((c) => {
              const isSelected = c.phone === selectedPhone;
              const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null;
              return (
                <button
                  key={c.phone}
                  type="button"
                  onClick={() => setSelectedPhone(c.phone)}
                  className={`w-full text-left p-3 transition-colors flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-primary/10 border-l-4 border-primary'
                      : 'hover:bg-surface-container-high/60'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs shrink-0 relative">
                    <User className="w-4 h-4" />
                    {c.isPaused && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] text-white" title="Bot pausado">
                        ⏸
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-bold text-on-surface truncate">
                        {c.name || `+${c.phone}`}
                      </span>
                      {c.isPaused ? (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 shrink-0">
                          Pausado
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 shrink-0">
                          Bot Activo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-on-surface-variant truncate font-mono">
                      +{c.phone}
                    </p>
                    {lastMsg && (
                      <p className="text-[11px] text-outline truncate mt-1">
                        {lastMsg.fromMe ? 'Tú: ' : ''}{lastMsg.text}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* CENTER & RIGHT: Active Chat Window & CRM Detail Panel */}
      {activeConv ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Conversation Column */}
          <section className="flex-1 flex flex-col border-r border-outline-variant/30 dark:border-slate-800 bg-surface-container-lowest dark:bg-slate-950">
            {/* Header */}
            <div className="h-14 px-4 border-b border-outline-variant/20 bg-surface-container-low dark:bg-slate-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-on-surface flex items-center gap-2">
                    {activeConv.name || `+${activeConv.phone}`}
                    <span className="text-[10px] font-normal text-outline">({activeConv.type})</span>
                  </h3>
                  <span className="text-[10px] text-on-surface-variant font-mono">+{activeConv.phone}</span>
                </div>
              </div>

              {/* Bot Control Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTogglePause(activeConv.phone)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeConv.isPaused
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  }`}
                  title={activeConv.isPaused ? 'Reanudar respuestas del bot IA' : 'Pausar bot para atender manualmente'}
                >
                  {activeConv.isPaused ? (
                    <>
                      <PlayCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Reanudar Bot</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Pausar Bot</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleExportToRecords}
                  className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                  title="Crear o enlazar este contacto en el módulo Gestión & Casos"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Vincular a Expediente</span>
                </button>
              </div>
            </div>

            {/* Context Summary Box (Rolling Context) */}
            {activeConv.summary && (
              <div className="m-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2 shrink-0">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong className="block text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Memoria / Contexto Histórico Resumido:
                  </strong>
                  <p className="text-[11px] leading-relaxed mt-0.5 text-on-surface-variant dark:text-amber-200">
                    {activeConv.summary}
                  </p>
                </div>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(!activeConv.messages || activeConv.messages.length === 0) ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-on-surface-variant space-y-1">
                  <Clock className="w-6 h-6 text-outline" />
                  <p>No hay mensajes en este chat.</p>
                </div>
              ) : (
                activeConv.messages.map((m, idx) => {
                  const isBot = m.fromMe;
                  return (
                    <div
                      key={m.id || idx}
                      className={`flex flex-col ${isBot ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        {isBot ? (
                          <>
                            <span className="text-[10px] font-bold text-primary">DocuCraft Bot</span>
                            <Bot className="w-3 h-3 text-primary" />
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-on-surface-variant" />
                            <span className="text-[10px] font-bold text-on-surface">{activeConv.name || 'Cliente'}</span>
                          </>
                        )}
                        <span className="text-[9px] text-outline">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm whitespace-pre-wrap ${
                          isBot
                            ? 'bg-primary text-on-primary rounded-tr-none'
                            : 'bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant/20'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Manual Chat Input */}
            <form onSubmit={handleSendManual} className="p-3 border-t border-outline-variant/20 bg-surface-container-low dark:bg-slate-900 flex items-center gap-2">
              <input
                type="text"
                value={manualMessage}
                onChange={(e) => setManualMessage(e.target.value)}
                placeholder={activeConv.isPaused ? "Escribe como asesor humano (el bot está pausado)..." : "Enviar mensaje manual (o interactuar con el cliente)..."}
                className="flex-1 px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="submit"
                disabled={!manualMessage.trim() || isSending}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </form>
          </section>

          {/* CRM Profile Column (Characteristics, Orders, Type) */}
          <aside className="w-80 border-l border-outline-variant/30 dark:border-slate-800 bg-surface-container-low/50 dark:bg-slate-900/40 p-4 flex flex-col overflow-y-auto space-y-4 shrink-0">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" />
                Ficha del Contacto / CRM
              </span>
              <button
                type="button"
                onClick={() => {
                  if (editingDetails) handleSaveDetails();
                  else setEditingDetails(true);
                }}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                {editingDetails ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </>
                )}
              </button>
            </div>

            {/* Profile Fields */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Nombre Asignado:</label>
                {editingDetails ? (
                  <input
                    type="text"
                    value={detailForm.name}
                    onChange={(e) => setDetailForm({ ...detailForm, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <p className="font-bold text-on-surface">{activeConv.name || 'Sin nombre asignado'}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Tipo de Contacto:</label>
                {editingDetails ? (
                  <select
                    value={detailForm.type}
                    onChange={(e) => setDetailForm({ ...detailForm, type: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="alumno">Alumno / Estudiante</option>
                    <option value="cliente">Cliente Comercial</option>
                    <option value="solicitud">Solicitud / Trámite</option>
                    <option value="interesado">Interesado / Prospecto</option>
                  </select>
                ) : (
                  <span className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-[10px] capitalize">
                    {activeConv.type || 'interesado'}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Características / Preferencias:</label>
                {editingDetails ? (
                  <textarea
                    rows={3}
                    value={detailForm.characteristics}
                    onChange={(e) => setDetailForm({ ...detailForm, characteristics: e.target.value })}
                    placeholder="Ej: Docente de 6to primaria, interesado en sesiones CNEB de Personal Social..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <p className="text-on-surface-variant leading-relaxed text-[11px] bg-surface-container-lowest/60 p-2 rounded-lg border border-outline-variant/20 whitespace-pre-wrap">
                    {activeConv.characteristics || 'Sin características registradas.'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">Pedidos / Solicitudes:</label>
                {editingDetails ? (
                  <textarea
                    rows={3}
                    value={detailForm.orders}
                    onChange={(e) => setDetailForm({ ...detailForm, orders: e.target.value })}
                    placeholder="Ej: Sesión Perú y Ecuador PDF entregada. Pendiente rúbrica analítica."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <p className="text-on-surface-variant leading-relaxed text-[11px] bg-surface-container-lowest/60 p-2 rounded-lg border border-outline-variant/20 whitespace-pre-wrap">
                    {activeConv.orders || 'Sin pedidos registrados.'}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Record Action Banner */}
            <div className="pt-3 border-t border-outline-variant/20 space-y-2 mt-auto">
              <button
                type="button"
                onClick={handleExportToRecords}
                className="w-full py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Registrar en Gestión & Casos</span>
              </button>
              <p className="text-[10px] text-outline text-center">
                Crea un expediente formal con seguimiento, porcentaje de avance y emisión de constancias PDF.
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-xs text-on-surface-variant space-y-2">
          <MessageSquare className="w-10 h-10 text-outline stroke-1" />
          <p className="font-semibold text-on-surface">Selecciona una conversación</p>
          <p className="text-[11px] text-outline">Elige un contacto de la lista izquierda para ver el historial y asignarle datos.</p>
        </div>
      )}
    </div>
  );
};
