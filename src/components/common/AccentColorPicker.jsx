import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, RotateCcw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Selector del color principal de la app.
 *
 * - 8 colores predeterminados (muestras circulares).
 * - Selector libre: cualquier color con el input nativo + su código hex.
 * - La elección se aplica al instante a toda la app y se guarda en
 *   localStorage (ver ThemeContext), así que persiste entre sesiones.
 */
export const AccentColorPicker = () => {
  const {
    accentColor,
    setAccentColor,
    resetAccentColor,
    presetColors,
    accentColorName,
    isDefaultAccent,
  } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Cerrar al hacer clic fuera o pulsar Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={`Color principal: ${accentColorName} (${accentColor})`}
        aria-label="Cambiar color principal"
        aria-expanded={isOpen}
        className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors relative"
      >
        <Palette className="w-4 h-4 text-primary" />
        <span
          className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full ring-2 ring-surface-container-lowest dark:ring-slate-950"
          style={{ backgroundColor: accentColor }}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-outline-variant/30 dark:border-slate-800 bg-surface-container-lowest dark:bg-slate-900 shadow-xl shadow-black/10 dark:shadow-black/50 p-4 z-50 select-none">
          <p className="text-xs font-bold text-on-surface">Color principal</p>
          <p className="text-[11px] text-on-surface-variant dark:text-slate-400 mt-0.5">
            Se aplica a botones, iconos y detalles de toda la app.
          </p>

          {/* Colores predeterminados */}
          <div className="grid grid-cols-8 gap-2 mt-3">
            {presetColors.map((preset) => {
              const isActive = accentColor === preset.color;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAccentColor(preset.color)}
                  title={`${preset.name} (${preset.color})`}
                  aria-label={`Color ${preset.name}`}
                  aria-pressed={isActive}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${
                    isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-lowest dark:ring-offset-slate-900 scale-110' : ''
                  }`}
                  style={{ backgroundColor: preset.color }}
                >
                  {isActive && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>

          {/* Color personalizado */}
          <div className="flex items-center gap-2.5 mt-4 pt-3 border-t border-outline-variant/20 dark:border-slate-800">
            <label
              className="relative w-9 h-9 rounded-full overflow-hidden ring-1 ring-outline-variant/40 dark:ring-slate-700 cursor-pointer shrink-0 hover:scale-105 transition-transform"
              style={{ backgroundColor: accentColor }}
              title="Elegir un color personalizado"
            >
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                aria-label="Elegir un color personalizado"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-on-surface truncate">
                {accentColorName}
              </span>
              <span className="block text-[11px] font-mono text-on-surface-variant dark:text-slate-400 uppercase">
                {accentColor}
              </span>
            </div>
            {!isDefaultAccent && (
              <button
                type="button"
                onClick={resetAccentColor}
                title="Volver al azul predeterminado"
                className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                Restablecer
              </button>
            )}
          </div>

          <p className="text-[11px] text-on-surface-variant dark:text-slate-500 mt-3">
            Tu elección se guarda automáticamente en este navegador.
          </p>
        </div>
      )}
    </div>
  );
};
