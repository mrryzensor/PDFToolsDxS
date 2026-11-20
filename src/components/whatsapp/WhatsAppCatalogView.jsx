import React, { useState, useEffect } from 'react';
import {
  Package, Briefcase, Plus, Edit3, Trash2, Search, Check, X,
  ShieldCheck, Terminal, Clock, DollarSign, Tag, Sparkles, RefreshCw
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const API_BASE = import.meta.env.DEV ? 'http://localhost:8089' : '';

export const WhatsAppCatalogView = ({ statusData, onUpdateConfig }) => {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKind, setFilterKind] = useState('all'); // 'all' | 'servicio' | 'producto'

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    id: '',
    kind: 'servicio',
    name: '',
    price: '',
    currency: 'USD',
    category: 'Curso',
    duration: '',
    modality: 'Online',
    characteristics: '',
    description: '',
    active: true,
  });

  // Config state (Authorized Numbers, Command, Debounce)
  const [authNumberInput, setAuthNumberInput] = useState('');
  const [catalogCommand, setCatalogCommand] = useState(statusData?.config?.catalogCommand || '/espacio');
  const [debounceSeconds, setDebounceSeconds] = useState(statusData?.config?.messageDebounceSeconds ?? 5);

  useEffect(() => {
    if (statusData?.config) {
      setCatalogCommand(statusData.config.catalogCommand || '/espacio');
      setDebounceSeconds(statusData.config.messageDebounceSeconds ?? 5);
    }
  }, [statusData?.config?.catalogCommand, statusData?.config?.messageDebounceSeconds]);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/whatsapp/catalog`);
      if (!res.ok) throw new Error('Error al cargar catálogo');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('No se pudo cargar el catálogo', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleOpenNew = () => {
    setForm({
      id: '',
      kind: 'servicio',
      name: '',
      price: '',
      currency: 'USD',
      category: 'Curso',
      duration: '',
      modality: 'Online',
      characteristics: '',
      description: '',
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setForm({
      id: item.id,
      kind: item.kind || 'servicio',
      name: item.name || '',
      price: item.price ?? '',
      currency: item.currency || 'USD',
      category: item.category || '',
      duration: item.duration || '',
      modality: item.modality || '',
      characteristics: item.characteristics || '',
      description: item.description || '',
      active: item.active !== false,
    });
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('El nombre es obligatorio', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/catalog/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(form.id ? 'Elemento actualizado' : 'Producto/Servicio agregado al catálogo', 'success');
        setIsModalOpen(false);
        fetchCatalog();
      }
    } catch (err) {
      showToast('Error al guardar en el catálogo', 'error');
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/catalog/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Elemento eliminado del catálogo', 'info');
        fetchCatalog();
      }
    } catch (err) {
      showToast('Error al eliminar', 'error');
    }
  };

  const handleToggleActive = async (item) => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/catalog/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, active: !item.active }),
      });
      const data = await res.json();
      if (data.success) {
        fetchCatalog();
      }
    } catch (err) {
      showToast('Error al cambiar estado', 'error');
    }
  };

  const handleAddAuthorizedNumber = () => {
    const clean = authNumberInput.replace(/[\s+\-()]/g, '').trim();
    if (!clean) return;
    const current = statusData?.config?.authorizedNumbers || [];
    if (current.includes(clean)) {
      showToast('Ese número ya está autorizado', 'info');
      return;
    }
    onUpdateConfig({ authorizedNumbers: [...current, clean] });
    setAuthNumberInput('');
  };

  const handleRemoveAuthorizedNumber = (num) => {
    const current = statusData?.config?.authorizedNumbers || [];
    onUpdateConfig({ authorizedNumbers: current.filter((n) => n !== num) });
  };

  const handleSaveSettings = () => {
    const cmd = catalogCommand.trim() || '/espacio';
    const sec = Math.max(0, parseInt(debounceSeconds, 10) || 0);
    onUpdateConfig({
      catalogCommand: cmd.startsWith('/') ? cmd : `/${cmd}`,
      messageDebounceSeconds: sec,
    });
  };

  const filteredItems = items.filter((item) => {
    if (filterKind !== 'all' && item.kind !== filterKind) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (item.name || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const authorizedNumbers = statusData?.config?.authorizedNumbers || [];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-6xl mx-auto w-full">
      {/* Top Config Panel: Authorized Numbers, Custom Command & Message Debounce */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: WhatsApp Command & Authorized Numbers */}
        <div className="p-4 rounded-2xl bg-surface-container-low dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Control por WhatsApp (Números Autorizados y Comando)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                Comando Personalizable:
              </label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Terminal className="w-3.5 h-3.5 text-outline absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={catalogCommand}
                    onChange={(e) => setCatalogCommand(e.target.value)}
                    placeholder="/espacio"
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-xs font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-2.5 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                Agregar Número Autorizado:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={authNumberInput}
                  onChange={(e) => setAuthNumberInput(e.target.value)}
                  placeholder="Ej: 51987654321"
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-xs font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={handleAddAuthorizedNumber}
                  disabled={!authNumberInput.trim()}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                >
                  + Agregar
                </button>
              </div>
            </div>
          </div>

          {authorizedNumbers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {authorizedNumbers.map((num) => (
                <span
                  key={num}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-mono font-semibold"
                >
                  +{num}
                  <button
                    type="button"
                    onClick={() => handleRemoveAuthorizedNumber(num)}
                    className="hover:text-rose-500"
                    title="Quitar autorización"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              * Agrega al menos un número autorizado para poder crear/editar/eliminar desde WhatsApp.
            </p>
          )}

          <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/15 text-[11px] text-on-surface-variant">
            <strong>Ejemplo en WhatsApp:</strong>{' '}
            <code className="font-mono text-primary">
              {catalogCommand || '/espacio'} crea el curso de Apps en Desktop Windows + Técnico PC a precio de 37 USD
            </code>
          </div>
        </div>

        {/* Card 2: Message Grouping / Debounce */}
        <div className="p-4 rounded-2xl bg-surface-container-low dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              Agrupación Inteligente de Mensajes (Anti-Spam / Debounce)
            </h3>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Si un cliente envía varios mensajes seguidos en menos de este tiempo, el bot esperará y los agrupará en una sola consulta para dar una única respuesta coherente.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <label className="text-xs font-semibold text-on-surface">Tiempo de espera (segundos):</label>
            <input
              type="number"
              min="0"
              max="60"
              value={debounceSeconds}
              onChange={(e) => setDebounceSeconds(e.target.value)}
              className="w-20 px-2.5 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-xs font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleSaveSettings}
              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>

      {/* Catalog Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Catálogo de Productos y Servicios ({items.length})
          </h2>
          <p className="text-xs text-on-surface-variant">
            El chatbot de WhatsApp conoce automáticamente este catálogo para responder precios y detalles a tus clientes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchCatalog}
            className="p-2 rounded-xl border border-outline-variant/30 hover:bg-surface-container-high text-on-surface-variant transition-colors"
            title="Refrescar catálogo"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenNew}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto / Servicio</span>
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-outline absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, categoría o descripción..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-xl border border-outline-variant/20">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'servicio', label: 'Servicios / Cursos' },
            { id: 'producto', label: 'Productos' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterKind(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterKind === f.id
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-lowest/50 space-y-2">
          <Package className="w-10 h-10 text-outline mx-auto stroke-1" />
          <p className="text-sm font-semibold text-on-surface">No hay productos o servicios registrados</p>
          <p className="text-xs text-on-surface-variant">
            Agrega uno manualmente con el botón superior o envía un comando <code className="font-mono text-primary">{catalogCommand}</code> por WhatsApp.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                item.active !== false
                  ? 'bg-surface-container-lowest dark:bg-slate-900 border-outline-variant/30 dark:border-slate-800 shadow-sm'
                  : 'bg-surface-container-low/50 border-outline-variant/20 opacity-60'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                      item.kind === 'producto'
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                        : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                    }`}
                  >
                    {item.kind === 'producto' ? <Package className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
                    {item.kind}
                  </span>

                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {Number(item.price || 0).toFixed(2)} {item.currency || 'USD'}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-on-surface leading-snug">{item.name}</h4>

                <div className="flex flex-wrap gap-1.5 text-[10px] text-on-surface-variant">
                  {item.category && (
                    <span className="px-2 py-0.5 rounded bg-surface-container-high font-medium">{item.category}</span>
                  )}
                  {item.modality && (
                    <span className="px-2 py-0.5 rounded bg-surface-container-high font-medium">{item.modality}</span>
                  )}
                  {item.duration && (
                    <span className="px-2 py-0.5 rounded bg-surface-container-high font-medium">{item.duration}</span>
                  )}
                </div>

                {item.characteristics && (
                  <p className="text-[11px] text-on-surface-variant bg-surface-container-low/70 p-2 rounded-lg border border-outline-variant/15">
                    <strong>Características:</strong> {item.characteristics}
                  </p>
                )}

                {item.description && (
                  <p className="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleToggleActive(item)}
                  className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-colors ${
                    item.active !== false
                      ? 'text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20'
                      : 'text-slate-500 bg-slate-500/10 hover:bg-slate-500/20'
                  }`}
                >
                  {item.active !== false ? 'Activo' : 'Inactivo'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Editar"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveItem}
            className="bg-surface dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 className="text-base font-bold text-on-surface">
                {form.id ? 'Editar Producto / Servicio' : 'Nuevo Producto / Servicio'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Tipo:</label>
                <select
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface"
                >
                  <option value="servicio">Servicio (Curso, Asesoría, etc.)</option>
                  <option value="producto">Producto (Software, Libro, Equipo)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Categoría:</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Ej: Curso, Software, Taller"
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Nombre *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Curso de Inteligencia Artificial"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Precio:</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="37.00"
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs font-mono text-on-surface"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Moneda:</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface"
                >
                  <option value="USD">USD</option>
                  <option value="PEN">PEN (S/)</option>
                  <option value="EUR">EUR</option>
                  <option value="MXN">MXN</option>
                  <option value="COP">COP</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Modalidad:</label>
                <input
                  type="text"
                  value={form.modality}
                  onChange={(e) => setForm({ ...form, modality: e.target.value })}
                  placeholder="Online / Presencial / Digital"
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Duración / Acceso:</label>
                <input
                  type="text"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  placeholder="Ej: 4 semanas / De por vida"
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Características Clave:</label>
              <textarea
                rows={2}
                value={form.characteristics}
                onChange={(e) => setForm({ ...form, characteristics: e.target.value })}
                placeholder="Ej: Certificado incluido, clases en vivo, soporte por WhatsApp..."
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Descripción:</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalles completos del producto o servicio..."
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold shadow-sm"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
