import React, { useState, useEffect } from 'react';
import {
  CreditCard, Plus, Edit3, Trash2, X, Upload, Image as ImageIcon,
  RefreshCw, CheckCircle2, Sparkles
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const API_BASE = 'http://localhost:8089';

/**
 * Optimizes an uploaded image file to WebP at 85% quality using HTML5 Canvas.
 * Resizes proportionally if width > 1200px to keep WhatsApp payloads fast.
 */
const optimizeImageToWebP85 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Archivo de imagen inválido'));
      img.onload = () => {
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const webpDataUrl = canvas.toDataURL('image/webp', 0.85);
        resolve(webpDataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

export const WhatsAppPaymentsView = () => {
  const { showToast } = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [optimizingImg, setOptimizingImg] = useState(false);

  const [form, setForm] = useState({
    id: '',
    name: '',
    accountInfo: '',
    instructions: '',
    imageBase64: '',
    active: true,
  });

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/whatsapp/payments`);
      if (!res.ok) throw new Error('Error cargando métodos de pago');
      const data = await res.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('No se pudieron cargar los métodos de pago', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleOpenNew = () => {
    setForm({
      id: '',
      name: '',
      accountInfo: '',
      instructions: '',
      imageBase64: '',
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pm) => {
    setForm({
      id: pm.id,
      name: pm.name || '',
      accountInfo: pm.accountInfo || '',
      instructions: pm.instructions || '',
      imageBase64: pm.imageBase64 || '',
      active: pm.active !== false,
    });
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setOptimizingImg(true);
      const webpDataUrl = await optimizeImageToWebP85(file);
      setForm((prev) => ({ ...prev, imageBase64: webpDataUrl }));
      showToast('Imagen optimizada a WebP (85%)', 'success');
    } catch (err) {
      showToast('No se pudo procesar la imagen', 'error');
    } finally {
      setOptimizingImg(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('El nombre del método de pago es obligatorio', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/payments/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        showToast(form.id ? 'Método de pago actualizado' : 'Método de pago agregado', 'success');
        setIsModalOpen(false);
        fetchPayments();
      }
    } catch (err) {
      showToast('Error al guardar método de pago', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/payments/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Método de pago eliminado', 'info');
        fetchPayments();
      }
    } catch (err) {
      showToast('Error al eliminar', 'error');
    }
  };

  const handleToggleActive = async (pm) => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/payments/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pm, active: !pm.active }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPayments();
      }
    } catch (err) {
      showToast('Error al cambiar estado', 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Métodos de Pago y QR ({payments.length})
          </h2>
          <p className="text-xs text-on-surface-variant">
            Configura tus cuentas y códigos QR (optimizados automáticamente a WebP 85%). El chatbot enviará estas imágenes por WhatsApp cuando el cliente pregunte cómo pagar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPayments}
            className="p-2 rounded-xl border border-outline-variant/30 hover:bg-surface-container-high text-on-surface-variant transition-colors"
            title="Refrescar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenNew}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Método de Pago</span>
          </button>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-lowest/50 space-y-2">
          <CreditCard className="w-10 h-10 text-outline mx-auto stroke-1" />
          <p className="text-sm font-semibold text-on-surface">No hay métodos de pago configurados</p>
          <p className="text-xs text-on-surface-variant">
            Agrega Yape, Plin, BCP, PayPal o cualquier medio de pago con su imagen QR para que el bot responda automáticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {payments.map((pm) => (
            <div
              key={pm.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                pm.active !== false
                  ? 'bg-surface-container-lowest dark:bg-slate-900 border-outline-variant/30 dark:border-slate-800 shadow-sm'
                  : 'bg-surface-container-low/50 border-outline-variant/20 opacity-60'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-primary" />
                    {pm.name}
                  </h4>
                  {pm.imageBase64 && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                      WebP 85%
                    </span>
                  )}
                </div>

                {pm.accountInfo && (
                  <p className="text-xs font-mono text-on-surface bg-surface-container-low p-2 rounded-lg border border-outline-variant/15 break-all">
                    {pm.accountInfo}
                  </p>
                )}

                {pm.instructions && (
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    {pm.instructions}
                  </p>
                )}

                {pm.imageBase64 && (
                  <div className="rounded-xl overflow-hidden border border-outline-variant/20 bg-white flex items-center justify-center p-2 max-h-44">
                    <img
                      src={pm.imageBase64}
                      alt={pm.name}
                      className="max-h-40 object-contain rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleToggleActive(pm)}
                  className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-colors ${
                    pm.active !== false
                      ? 'text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20'
                      : 'text-slate-500 bg-slate-500/10 hover:bg-slate-500/20'
                  }`}
                >
                  {pm.active !== false ? 'Activo' : 'Inactivo'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(pm)}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Editar"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(pm.id)}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-surface dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 className="text-base font-bold text-on-surface">
                {form.id ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Nombre *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Yape, Plin, BCP Soles, PayPal"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Número / Cuenta / Enlace:</label>
              <input
                type="text"
                value={form.accountInfo}
                onChange={(e) => setForm({ ...form, accountInfo: e.target.value })}
                placeholder="Ej: 987654321 - David Salcedo"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs font-mono text-on-surface"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Instrucciones:</label>
              <textarea
                rows={2}
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                placeholder="Ej: Envía la captura de tu pago por este chat para activar tu acceso."
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs text-on-surface"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Imagen QR / Comprobante (Se optimiza a WebP 85%):
              </label>
              <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors text-xs font-semibold text-primary">
                <Upload className="w-4 h-4" />
                <span>{optimizingImg ? 'Optimizando a WebP 85%...' : 'Seleccionar Imagen (PNG, JPG, WebP)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              {form.imageBase64 && (
                <div className="mt-2 relative rounded-xl overflow-hidden border border-outline-variant/30 bg-white p-2 flex justify-center">
                  <img
                    src={form.imageBase64}
                    alt="Preview WebP"
                    className="max-h-36 object-contain rounded"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, imageBase64: '' })}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-500 text-white hover:bg-rose-600 shadow"
                    title="Quitar imagen"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
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
                disabled={optimizingImg}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold shadow-sm disabled:opacity-50"
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
