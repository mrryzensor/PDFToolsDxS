import React, { useRef } from 'react';
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Type, Table, Shapes, Image as ImageIcon, Trash2, 
  Download, FileText, Undo, Redo, ZoomIn, ZoomOut, Layers, Maximize2
} from 'lucide-react';

export const WordRibbon = ({
  activeTab,
  setActiveTab,
  onAddText,
  onOpenTableModal,
  onOpenShapesModal,
  onTriggerImageUpload,
  onDeleteSelected,
  selectedElement,
  onUpdateElement,
  onExportWord,
  onExportPDF,
  zoom,
  setZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}) => {
  const tabs = [
    { id: 'inicio', label: 'Inicio' },
    { id: 'insertar', label: 'Insertar' },
    { id: 'diseno', label: 'Diseño de Página' },
    { id: 'herramientas', label: 'Herramientas PDF' },
  ];

  return (
    <div className="bg-surface-container-low dark:bg-slate-900 border-b border-outline-variant/40 dark:border-slate-800 flex flex-col select-none shadow-sm shrink-0">
      {/* Top Ribbon Tabs Bar */}
      <div className="flex items-center gap-1 px-4 pt-1 border-b border-outline-variant/30 dark:border-slate-800/80 bg-surface-container-lowest dark:bg-slate-950">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-t-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === tab.id
                ? 'bg-surface-container-low dark:bg-slate-900 text-primary dark:text-primary border-t-2 border-primary dark:border-primary shadow-sm'
                : 'text-on-surface-variant dark:text-slate-400 hover:text-on-surface hover:bg-surface-container-high/40'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {/* Global Undo / Redo & Adaptive Zoom Controls */}
        <div className="ml-auto flex items-center gap-1.5 pb-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Deshacer (Ctrl+Z)"
            className="p-1.5 rounded-lg text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Rehacer (Ctrl+Y)"
            className="p-1.5 rounded-lg text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-outline-variant/30 dark:bg-slate-800 mx-1" />

          {/* Zoom controls */}
          <button
            type="button"
            onClick={() => setZoom(prev => Math.max(0.4, Number((prev - 0.1).toFixed(1))))}
            title="Reducir zoom"
            className="p-1.5 rounded-lg text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high dark:hover:bg-slate-800 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Quick preset selector */}
          <select
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="bg-surface-container-low dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-lg px-2 py-0.5 text-xs font-mono font-medium text-on-surface focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="0.5">50%</option>
            <option value="0.7">70%</option>
            <option value="0.8">80%</option>
            <option value="0.9">90%</option>
            <option value="1.0">100%</option>
            <option value="1.15">115%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
          </select>

          <button
            type="button"
            onClick={() => setZoom(prev => Math.min(2.0, Number((prev + 0.1).toFixed(1))))}
            title="Aumentar zoom"
            className="p-1.5 rounded-lg text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high dark:hover:bg-slate-800 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoom(0.85)}
            title="Ajustar a ancho óptimo (85%)"
            className="p-1.5 rounded-lg text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high dark:hover:bg-slate-800 transition-colors hidden sm:block"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Ribbon Action Deck */}
      <div className="px-4 py-2 flex items-center gap-3 overflow-x-auto min-h-[58px]">
        {activeTab === 'inicio' && (
          <>
            {/* Text Styling Group */}
            <div className="flex items-center gap-1 pr-3 border-r border-outline-variant/30 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  if (selectedElement?.type === 'text') {
                    const isBold = selectedElement.fontWeight === 'bold';
                    onUpdateElement(selectedElement.id, { fontWeight: isBold ? 'normal' : 'bold' });
                  }
                }}
                disabled={selectedElement?.type !== 'text'}
                title="Negrita"
                className={`p-1.5 rounded-lg transition-colors ${
                  selectedElement?.fontWeight === 'bold'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface hover:bg-surface-container-high dark:hover:bg-slate-800 disabled:opacity-30'
                }`}
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedElement?.type === 'text') {
                    const isItalic = selectedElement.fontStyle === 'italic';
                    onUpdateElement(selectedElement.id, { fontStyle: isItalic ? 'normal' : 'italic' });
                  }
                }}
                disabled={selectedElement?.type !== 'text'}
                title="Cursiva"
                className={`p-1.5 rounded-lg transition-colors ${
                  selectedElement?.fontStyle === 'italic'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface hover:bg-surface-container-high dark:hover:bg-slate-800 disabled:opacity-30'
                }`}
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedElement?.type === 'text') {
                    const isUnderline = selectedElement.textDecoration === 'underline';
                    onUpdateElement(selectedElement.id, { textDecoration: isUnderline ? 'none' : 'underline' });
                  }
                }}
                disabled={selectedElement?.type !== 'text'}
                title="Subrayado"
                className={`p-1.5 rounded-lg transition-colors ${
                  selectedElement?.textDecoration === 'underline'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface hover:bg-surface-container-high dark:hover:bg-slate-800 disabled:opacity-30'
                }`}
              >
                <Underline className="w-4 h-4" />
              </button>

              <div className="h-5 w-px bg-outline-variant/30 dark:bg-slate-800 mx-1" />

              {/* Text Alignments */}
              <button
                type="button"
                onClick={() => selectedElement?.type === 'text' && onUpdateElement(selectedElement.id, { textAlign: 'left' })}
                disabled={selectedElement?.type !== 'text'}
                title="Alinear Izquierda"
                className={`p-1.5 rounded-lg transition-colors ${
                  selectedElement?.textAlign === 'left' ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container-high dark:hover:bg-slate-800 disabled:opacity-30'
                }`}
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => selectedElement?.type === 'text' && onUpdateElement(selectedElement.id, { textAlign: 'center' })}
                disabled={selectedElement?.type !== 'text'}
                title="Centrar"
                className={`p-1.5 rounded-lg transition-colors ${
                  selectedElement?.textAlign === 'center' ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container-high dark:hover:bg-slate-800 disabled:opacity-30'
                }`}
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => selectedElement?.type === 'text' && onUpdateElement(selectedElement.id, { textAlign: 'right' })}
                disabled={selectedElement?.type !== 'text'}
                title="Alinear Derecha"
                className={`p-1.5 rounded-lg transition-colors ${
                  selectedElement?.textAlign === 'right' ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container-high dark:hover:bg-slate-800 disabled:opacity-30'
                }`}
              >
                <AlignRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Size selector */}
            {selectedElement?.type === 'text' && (
              <div className="flex items-center gap-1.5 pr-3 border-r border-outline-variant/30 dark:border-slate-800">
                <span className="text-xs text-on-surface-variant font-medium">Tamaño:</span>
                <select
                  value={selectedElement.fontSize || 14}
                  onChange={(e) => onUpdateElement(selectedElement.id, { fontSize: parseInt(e.target.value, 10) })}
                  className="bg-surface-container-lowest dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-primary cursor-pointer text-on-surface"
                >
                  {[10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32].map(s => (
                    <option key={s} value={s}>{s} pt</option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Delete Element */}
            {selectedElement && (
              <button
                type="button"
                onClick={onDeleteSelected}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition-colors text-xs font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar Elemento
              </button>
            )}
          </>
        )}

        {activeTab === 'insertar' && (
          <>
            <button
              type="button"
              onClick={onAddText}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-lowest dark:bg-slate-800 hover:bg-surface-container-high dark:hover:bg-slate-700 border border-outline-variant/30 dark:border-slate-700 text-xs font-semibold text-on-surface transition-all shadow-sm"
            >
              <Type className="w-4 h-4 text-primary" />
              <span>Caja de Texto</span>
            </button>

            <button
              type="button"
              onClick={onOpenTableModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-lowest dark:bg-slate-800 hover:bg-surface-container-high dark:hover:bg-slate-700 border border-outline-variant/30 dark:border-slate-700 text-xs font-semibold text-on-surface transition-all shadow-sm"
            >
              <Table className="w-4 h-4 text-primary" />
              <span>Insertar Tabla</span>
            </button>

            <button
              type="button"
              onClick={onOpenShapesModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-lowest dark:bg-slate-800 hover:bg-surface-container-high dark:hover:bg-slate-700 border border-outline-variant/30 dark:border-slate-700 text-xs font-semibold text-on-surface transition-all shadow-sm"
            >
              <Shapes className="w-4 h-4 text-secondary dark:text-amber-400" />
              <span>Formas y Recursos (N lados)</span>
            </button>

            <button
              type="button"
              onClick={onTriggerImageUpload}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-lowest dark:bg-slate-800 hover:bg-surface-container-high dark:hover:bg-slate-700 border border-outline-variant/30 dark:border-slate-700 text-xs font-semibold text-on-surface transition-all shadow-sm"
            >
              <ImageIcon className="w-4 h-4 text-primary" />
              <span>Insertar Imagen (Ctrl+V)</span>
            </button>
          </>
        )}

        {activeTab === 'diseno' && (
          <div className="flex items-center gap-4 text-xs text-on-surface-variant font-medium">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" />
              Formato de Hoja: <strong className="text-on-surface">A4 (210 × 297 mm)</strong>
            </span>
            <div className="h-4 w-px bg-outline-variant/30 dark:bg-slate-800" />
            <span>Márgenes estándar: <strong>2.5 cm</strong></span>
            <div className="h-4 w-px bg-outline-variant/30 dark:bg-slate-800" />
            <span>Orientación: <strong>Vertical</strong></span>
          </div>
        )}

        {activeTab === 'herramientas' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExportWord}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 dark:bg-primary/10 hover:bg-primary/20 dark:hover:bg-primary/20 text-primary dark:text-primary border border-primary/30 dark:border-primary/30 text-xs font-semibold transition-all"
            >
              <FileText className="w-3.5 h-3.5" />
              Exportar a Word (.docx)
            </button>
            <button
              type="button"
              onClick={onExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary hover:bg-surface-tint text-xs font-semibold shadow-md shadow-primary/20 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar PDF Listo
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
