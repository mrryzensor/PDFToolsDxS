import React, { useState } from 'react';
import { 
  Square, Circle, Diamond, Triangle, ArrowRight, 
  Hexagon, Star, Shapes, Plus, Palette, Sliders
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ShapeRenderer } from './ShapeRenderer';

export const ShapesModal = ({ isOpen, onClose, onAddShape }) => {
  const [selectedShape, setSelectedShape] = useState('rectangle');
  const [polygonSides, setPolygonSides] = useState(5);
  const [fillColor, setFillColor] = useState('#eaedff');
  const [strokeColor, setStrokeColor] = useState('#004ac6');
  const [strokeWidth, setStrokeWidth] = useState(2);

  const predefinedShapes = [
    { id: 'rectangle', name: 'Rectángulo', icon: Square },
    { id: 'circle', name: 'Círculo / Elipse', icon: Circle },
    { id: 'diamond', name: 'Rombo', icon: Diamond },
    { id: 'triangle', name: 'Triángulo', icon: Triangle },
    { id: 'arrow-right', name: 'Flecha Derecha', icon: ArrowRight },
    { id: 'hexagon', name: 'Hexágono', icon: Hexagon },
    { id: 'polygon', name: 'Polígono Convexo N Lados', icon: Shapes },
    { id: 'star', name: 'Estrella Convexa', icon: Star },
  ];

  const colorPalette = [
    '#ffffff', '#eaedff', '#dbe1ff', '#fea619', '#d22348', '#22c55e', '#a855f7', '#0f172a'
  ];

  const strokePalette = [
    '#004ac6', '#2563eb', '#855300', '#ad0033', '#15803d', '#7e22ce', '#334155', '#000000'
  ];

  const handleInsert = () => {
    onAddShape({
      type: 'shape',
      shapeType: selectedShape,
      sides: polygonSides,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      width: selectedShape === 'arrow-right' ? 180 : 140,
      height: 120,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Insertar Recurso o Forma Geométrica"
      subtitle="Figuras vectoriales avanzadas con parámetros geométricos configurables"
      maxWidth="max-w-3xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Shape Selectors */}
        <div className="space-y-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-slate-400 flex items-center gap-1.5">
            <Shapes className="w-4 h-4 text-primary dark:text-primary" />
            Catálogo de Figuras y Flechas
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {predefinedShapes.map((shape) => {
              const Icon = shape.icon;
              const isSelected = selectedShape === shape.id;
              return (
                <button
                  key={shape.id}
                  type="button"
                  onClick={() => setSelectedShape(shape.id)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-sm transition-all ${
                    isSelected
                      ? 'border-primary dark:border-primary bg-primary/10 dark:bg-primary-container/20 text-primary dark:text-primary font-semibold shadow-sm'
                      : 'border-outline-variant/30 dark:border-slate-800 hover:border-outline-variant dark:hover:border-slate-700 text-on-surface dark:text-slate-300 bg-surface-container-low/40 dark:bg-slate-950/40'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="truncate">{shape.name}</span>
                </button>
              );
            })}
          </div>

          {/* Polygon / Star Sides Slider */}
          {(selectedShape === 'polygon' || selectedShape === 'star') && (
            <div className="p-4 rounded-xl bg-surface-container-low/80 dark:bg-slate-950/60 border border-outline-variant/30 dark:border-slate-800 space-y-2 animate-in fade-in">
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="text-on-surface dark:text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-primary dark:text-primary" />
                  Número de lados / vértices (N):
                </span>
                <span className="px-2 py-0.5 rounded bg-primary dark:bg-primary text-on-primary dark:text-on-primary font-mono font-bold text-xs">
                  {polygonSides}
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="16"
                value={polygonSides}
                onChange={(e) => setPolygonSides(parseInt(e.target.value, 10))}
                className="w-full accent-primary dark:accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-outline dark:text-slate-400">
                <span>3 (Triángulo)</span>
                <span>8 (Octágono)</span>
                <span>16 lados</span>
              </div>
            </div>
          )}

          {/* Color Palettes */}
          <div className="space-y-3 pt-2">
            <div>
              <span className="text-xs font-medium text-on-surface-variant dark:text-slate-400 flex items-center gap-1 mb-2">
                <Palette className="w-3.5 h-3.5 text-primary dark:text-primary" />
                Color de Fondo (Relleno)
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {colorPalette.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setFillColor(col)}
                    className={`w-7 h-7 rounded-full border border-black/10 transition-transform ${
                      fillColor === col ? 'scale-125 ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-medium text-on-surface-variant dark:text-slate-400 flex items-center gap-1 mb-2">
                <Palette className="w-3.5 h-3.5 text-secondary dark:text-amber-400" />
                Color del Borde (Trazo)
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {strokePalette.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setStrokeColor(col)}
                    className={`w-7 h-7 rounded-full border border-black/10 transition-transform ${
                      strokeColor === col ? 'scale-125 ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview Canvas */}
        <div className="flex flex-col items-center justify-between p-6 rounded-2xl bg-surface-container-low dark:bg-slate-950/60 border border-outline-variant/30 dark:border-slate-800">
          <span className="text-xs font-semibold text-outline dark:text-slate-400 tracking-wider uppercase mb-4">
            Vista Previa en Tiempo Real
          </span>

          <div className="flex-1 w-full flex items-center justify-center p-4">
            <ShapeRenderer
              shapeType={selectedShape}
              sides={polygonSides}
              width={180}
              height={140}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          </div>

          <div className="w-full pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-outline-variant/40 dark:border-slate-800 text-on-surface-variant dark:text-slate-300 font-medium text-sm hover:bg-surface-container-high dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleInsert}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:bg-surface-tint shadow-md shadow-primary/20 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Insertar en Hoja
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
