import React, { useState, useEffect } from 'react';
import { 
  Key, Plus, Trash2, CheckCircle2, AlertTriangle, XCircle, 
  RefreshCw, Sparkles, ExternalLink, ShieldCheck, Cpu
} from 'lucide-react';
import { Modal } from './Modal';
import { 
  getStoredGeminiKeys, addStoredGeminiKey, removeStoredGeminiKey, 
  updateStoredGeminiKey 
} from '../../utils/storage';
import { testGeminiApiKey, DEFAULT_MODEL_PRIORITY } from '../../utils/geminiService';
import { useToast } from '../../context/ToastContext';

export const ApiKeysModal = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [keys, setKeys] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [testingId, setTestingId] = useState(null);
  const [discoveredModels, setDiscoveredModels] = useState({});

  const reloadKeys = () => {
    setKeys(getStoredGeminiKeys());
  };

  useEffect(() => {
    if (isOpen) {
      reloadKeys();
    }
  }, [isOpen]);

  const handleAdd = async () => {
    if (!newKey.trim()) {
      showToast('Ingresa una API Key válida', 'warning');
      return;
    }

    const success = addStoredGeminiKey(newKey, newLabel);
    if (!success) {
      showToast('Esta clave ya se encuentra registrada', 'warning');
      return;
    }

    showToast('API Key registrada con éxito. Probando conexión...', 'info');
    const updated = getStoredGeminiKeys();
    setKeys(updated);
    const addedItem = updated[updated.length - 1];

    setNewKey('');
    setNewLabel('');

    // Immediately test newly added key
    if (addedItem) {
      await runTest(addedItem.id, addedItem.key);
    }
  };

  const runTest = async (id, apiKey) => {
    setTestingId(id);
    const result = await testGeminiApiKey(apiKey);
    setTestingId(null);

    if (result.ok) {
      updateStoredGeminiKey(id, {
        status: 'valid',
        lastTested: new Date().toISOString(),
        modelsCount: result.models.length,
      });
      setDiscoveredModels((prev) => ({ ...prev, [id]: result.models }));
      showToast(`¡Conexión exitosa! ${result.models.length} modelos detectados`, 'success');
    } else {
      updateStoredGeminiKey(id, {
        status: 'invalid',
        lastTested: new Date().toISOString(),
        lastError: result.error,
      });
      showToast(`Error al validar: ${result.error}`, 'error', 4500);
    }
    reloadKeys();
  };

  const handleRemove = (id) => {
    removeStoredGeminiKey(id);
    reloadKeys();
    showToast('API Key removida', 'info');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gestión de API Keys de Google Gemini (Failover Dinámico)"
      subtitle="Configura una o varias claves gratuitas para alternancia automática si una alcanza la cuota de uso"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Helper Banner with Link */}
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-xs text-on-surface flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-primary">¿Cómo obtener tus claves gratuitas de Gemini?</p>
            <p className="text-on-surface-variant leading-relaxed">
              Puedes generar tus claves en segundos desde <strong>Google AI Studio</strong>. Cada cuenta de Google tiene cuota gratuita diaria con acceso a modelos como <em>Gemini 2.5 Flash / Flash-Lite</em>. Si registras varias, el sistema cambiará de clave automáticamente si una se agota.
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline pt-1"
            >
              <span>Obtener API Key en Google AI Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Add Key Form (Custom styled without native prompt) */}
        <div className="p-4 rounded-xl bg-surface-container-low dark:bg-slate-950/60 border border-outline-variant/30 dark:border-slate-800 space-y-3">
          <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
            <Key className="w-4 h-4 text-primary" />
            Agregar Nueva API Key de Gemini
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <input
              type="text"
              placeholder="Etiqueta (ej: Cuenta Principal, Secundaria...)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/40 dark:border-slate-700 text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="password"
              placeholder="Pega aquí tu clave (AIzaSy...)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="md:col-span-2 px-3 py-2 text-xs rounded-xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/40 dark:border-slate-700 text-on-surface outline-none focus:ring-1 focus:ring-primary font-mono"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-primary text-on-primary font-semibold text-xs hover:bg-surface-tint shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Registrar y Probar Clave
          </button>
        </div>

        {/* Registered Keys List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface-variant flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Claves Registradas ({keys.length})
            </span>
            <span className="text-[11px] text-outline">
              Prioridad: se prueban en orden de arriba hacia abajo
            </span>
          </div>

          {keys.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-dashed border-outline-variant/40 text-xs text-outline">
              No tienes ninguna clave registrada. Agrega al menos una para activar las funciones de IA.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {keys.map((k, idx) => {
                const isTesting = testingId === k.id;
                let statusBadge = (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container-high text-on-surface-variant">
                    Sin verificar
                  </span>
                );

                if (k.status === 'valid') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      Activa y Válida
                    </span>
                  );
                } else if (k.status === 'quota_exceeded') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <AlertTriangle className="w-3 h-3" />
                      Cuota Excedida (Failover activo)
                    </span>
                  );
                } else if (k.status === 'invalid') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      <XCircle className="w-3 h-3" />
                      Clave Inválida
                    </span>
                  );
                }

                return (
                  <div
                    key={k.id}
                    className="p-3 rounded-xl bg-surface-container-low dark:bg-slate-950/40 border border-outline-variant/30 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-on-surface truncate">{k.label}</span>
                        {statusBadge}
                      </div>
                      <p className="font-mono text-[11px] text-outline truncate">
                        {k.key.substring(0, 8)}••••••••••••••••{k.key.substring(k.key.length - 4)}
                      </p>
                      {k.lastUsedModel && (
                        <p className="text-[10px] text-primary flex items-center gap-1">
                          <Cpu className="w-3 h-3" />
                          Último modelo usado: {k.lastUsedModel}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => runTest(k.id, k.key)}
                        disabled={isTesting}
                        title="Probar conexión"
                        className="p-1.5 rounded-lg border border-outline-variant/30 dark:border-slate-700 hover:bg-surface-container-high dark:hover:bg-slate-800 text-on-surface-variant transition-colors disabled:opacity-40"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-primary' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(k.id)}
                        title="Eliminar clave"
                        className="p-1.5 rounded-lg border border-rose-500/30 hover:bg-rose-500/10 text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Models Hierarchy Information */}
        <div className="p-3.5 rounded-xl bg-surface-container-low/60 dark:bg-slate-950/40 border border-outline-variant/20 dark:border-slate-800 text-xs text-on-surface-variant space-y-1">
          <span className="font-semibold text-on-surface flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-primary" />
            Cadena de Modelos Dinámica (Prioridad de Ejecución):
          </span>
          <p className="text-[11px] text-outline font-mono leading-relaxed">
            {DEFAULT_MODEL_PRIORITY.join('  ➔  ')}
          </p>
          <p className="text-[10px] text-outline">
            El sistema detecta automáticamente los modelos disponibles en tu cuenta y utiliza el más reciente sin costo.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-xs hover:bg-surface-tint shadow-md transition-all active:scale-[0.98]"
          >
            Aceptar y Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
};
