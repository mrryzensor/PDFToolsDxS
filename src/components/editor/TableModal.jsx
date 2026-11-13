import React, { useState } from 'react';
import { Table, Plus, Columns, Rows } from 'lucide-react';
import { Modal } from '../common/Modal';

export const TableModal = ({ isOpen, onClose, onAddTable }) => {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [hasHeader, setHasHeader] = useState(true);

  const handleInsert = () => {
    // Generate initial table data
    const data = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        if (r === 0 && hasHeader) {
          row.push(`Columna ${c + 1}`);
        } else {
          row.push(`Dato ${r},${c + 1}`);
        }
      }
      data.push(row);
    }

    onAddTable({
      type: 'table',
      rows,
      cols,
      data,
      hasHeader,
      width: Math.min(525, cols * 130),
      height: rows * 40 + 20,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Insertar Tabla de Datos Estilo Word"
      subtitle="Define la estructura de celdas con filas y columnas editables interactivas"
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-surface-container-low dark:bg-slate-950/60 border border-outline-variant/30 dark:border-slate-800 space-y-2">
            <label className="text-xs font-semibold text-on-surface-variant dark:text-slate-400 flex items-center gap-1.5">
              <Rows className="w-4 h-4 text-primary dark:text-primary" />
              Filas: {rows}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={rows}
              onChange={(e) => setRows(parseInt(e.target.value, 10))}
              className="w-full accent-primary dark:accent-primary cursor-pointer"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low dark:bg-slate-950/60 border border-outline-variant/30 dark:border-slate-800 space-y-2">
            <label className="text-xs font-semibold text-on-surface-variant dark:text-slate-400 flex items-center gap-1.5">
              <Columns className="w-4 h-4 text-primary dark:text-primary" />
              Columnas: {cols}
            </label>
            <input
              type="range"
              min="1"
              max="8"
              value={cols}
              onChange={(e) => setCols(parseInt(e.target.value, 10))}
              className="w-full accent-primary dark:accent-primary cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low/60 dark:bg-slate-950/60 border border-outline-variant/30 dark:border-slate-800">
          <input
            type="checkbox"
            id="has-header"
            checked={hasHeader}
            onChange={(e) => setHasHeader(e.target.checked)}
            className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary dark:accent-primary cursor-pointer"
          />
          <label htmlFor="has-header" className="text-sm font-medium text-on-surface dark:text-slate-300 cursor-pointer">
            Incluir fila de encabezado resaltada
          </label>
        </div>

        {/* Visual grid preview */}
        <div className="p-4 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 flex flex-col items-center justify-center min-h-[120px]">
          <div className="border border-outline-variant/40 dark:border-slate-800 rounded overflow-hidden max-w-full">
            {Array.from({ length: Math.min(5, rows) }).map((_, rIdx) => (
              <div key={rIdx} className="flex">
                {Array.from({ length: Math.min(6, cols) }).map((_, cIdx) => (
                  <div
                    key={cIdx}
                    className={`w-10 h-7 border border-outline-variant/30 dark:border-slate-800 flex items-center justify-center text-[10px] ${
                      rIdx === 0 && hasHeader ? 'bg-primary-container/20 dark:bg-primary-container/20 font-bold text-primary dark:text-primary' : 'bg-surface-container-low/20 dark:bg-slate-900/40 text-outline dark:text-slate-500'
                    }`}
                  >
                    •
                  </div>
                ))}
              </div>
            ))}
          </div>
          <span className="text-[11px] text-outline dark:text-slate-400 mt-2">
            Matriz seleccionada: {rows} × {cols}
          </span>
        </div>

        <div className="flex gap-3 pt-2">
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
            Insertar Tabla
          </button>
        </div>
      </div>
    </Modal>
  );
};
