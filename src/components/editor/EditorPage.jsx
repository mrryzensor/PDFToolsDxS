import React, { useRef, useState, useEffect } from 'react';
import { ShapeRenderer } from './ShapeRenderer';
import { 
  Trash2, Move, Plus, Minus, GripVertical, Image as ImageIcon 
} from 'lucide-react';

export const EditorPage = ({
  pageIndex,
  elements,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onAddElement,
  zoom = 1.0,
}) => {
  const containerRef = useRef(null);
  const [dragState, setDragState] = useState(null);

  // Handle Dragging Elements across canvas
  const handleMouseDown = (e, elem) => {
    e.stopPropagation();
    onSelectElement(elem.id);

    setDragState({
      id: elem.id,
      startX: e.clientX,
      startY: e.clientY,
      initialElemX: elem.x || 0,
      initialElemY: elem.y || 0,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragState) return;

      const deltaX = (e.clientX - dragState.startX) / zoom;
      const deltaY = (e.clientY - dragState.startY) / zoom;

      const newX = Math.max(10, Math.min(500, dragState.initialElemX + deltaX));
      const newY = Math.max(10, Math.min(950, dragState.initialElemY + deltaY));

      onUpdateElement(dragState.id, { x: newX, y: newY }, false);
    };

    const handleMouseUp = () => {
      if (dragState) {
        setDragState(null);
      }
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, zoom, onUpdateElement]);

  const baseWidth = 595; // A4 standard width (pt/px scale)
  const baseHeight = 842; // A4 standard height

  return (
    /* Outer layout reservation wrapper for zoom so scrollbars adapt perfectly */
    <div 
      style={{
        width: `${baseWidth * zoom}px`,
        height: `${baseHeight * zoom}px`,
      }}
      className="relative shrink-0 mx-auto my-6 transition-all duration-75"
    >
      <div
        ref={containerRef}
        onClick={() => onSelectElement(null)}
        className="w-[595px] h-[842px] bg-surface-container-lowest dark:bg-surface-container-low rounded-xl shadow-2xl border border-outline-variant/50 dark:border-slate-700 overflow-hidden select-none transition-colors duration-200 document-page-sheet flex flex-col absolute top-0 left-0"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Top simulated ruler */}
        <div className="w-full bg-surface-container-low dark:bg-surface-container px-6 py-1.5 flex items-center justify-between text-outline dark:text-slate-400 text-[10px] font-mono select-none border-b border-outline-variant/30 dark:border-slate-700/80">
          <div className="flex items-center gap-5">
            <span>0</span>
            <span>|</span>
            <span>2</span>
            <span>|</span>
            <span>4</span>
            <span className="text-primary font-bold">▲ 8 cm</span>
            <span>|</span>
            <span>12</span>
            <span>|</span>
            <span>16</span>
          </div>
          <span className="text-primary font-semibold text-[11px]">Página {pageIndex + 1} (A4)</span>
        </div>

        {/* Printable page body */}
        <div className="relative w-full flex-1 p-6 overflow-hidden">
          {elements.map((elem) => {
            const isSelected = selectedElementId === elem.id;

            return (
              <div
                key={elem.id}
                style={{
                  position: 'absolute',
                  left: `${elem.x || 30}px`,
                  top: `${elem.y || 30}px`,
                  width: elem.width ? `${elem.width}px` : 'auto',
                  maxWidth: '535px',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectElement(elem.id);
                }}
                className={`group transition-all cursor-default ${
                  isSelected
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-lowest dark:ring-offset-slate-900 rounded-lg'
                    : 'hover:ring-1 hover:ring-outline-variant/60 rounded-lg'
                }`}
              >
                {/* Drag Handle & Quick Actions Toolbar (Only when selected) */}
                {isSelected && (
                  <div className="absolute -top-9 left-0 flex items-center gap-1.5 bg-slate-900 text-white dark:bg-primary-container/25 dark:text-primary px-2.5 py-1 rounded-md shadow-xl z-30 animate-in fade-in border border-slate-700 dark:border-primary/40">
                    <button
                      type="button"
                      onMouseDown={(e) => handleMouseDown(e, elem)}
                      title="Arrastrar para mover elemento"
                      className="p-1 hover:bg-white/20 dark:hover:bg-primary/30 rounded cursor-grab active:cursor-grabbing text-white dark:text-primary transition-colors"
                    >
                      <Move className="w-4 h-4 stroke-[2.2]" />
                    </button>
                    <div className="w-px h-3.5 bg-white/30 dark:bg-primary/40" />
                    <button
                      type="button"
                      onClick={() => onDeleteElement(elem.id)}
                      title="Eliminar elemento"
                      className="p-1 hover:bg-rose-600 rounded text-rose-300 hover:text-white transition-colors"
                    >
                      <Trash2 className="w-4 h-4 stroke-[2]" />
                    </button>
                  </div>
                )}

                {/* Render Type 1: Text */}
                {elem.type === 'text' && (
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onUpdateElement(elem.id, { content: e.currentTarget.innerText })}
                    style={{
                      fontSize: `${elem.fontSize || 14}px`,
                      fontWeight: elem.fontWeight || 'normal',
                      fontStyle: elem.fontStyle || 'normal',
                      textDecoration: elem.textDecoration || 'none',
                      textAlign: elem.textAlign || 'left',
                      color: elem.color || 'inherit',
                      wordBreak: 'break-word',
                    }}
                    className="p-1.5 outline-none rounded bg-transparent focus:bg-surface-container-high/40 dark:focus:bg-slate-700/50 transition-colors leading-relaxed"
                  >
                    {elem.content}
                  </div>
                )}

                {/* Render Type 2: Shape */}
                {elem.type === 'shape' && (
                  <div className="p-0.5">
                    <ShapeRenderer
                      shapeType={elem.shapeType}
                      sides={elem.sides}
                      width={elem.width || 120}
                      height={elem.height || 100}
                      fill={elem.fill}
                      stroke={elem.stroke}
                      strokeWidth={elem.strokeWidth}
                    />
                  </div>
                )}

                {/* Render Type 3: Table */}
                {elem.type === 'table' && (
                  <div className="border border-outline-variant/50 dark:border-slate-600 rounded-lg overflow-hidden shadow-sm bg-surface-container-lowest dark:bg-surface-container">
                    <table className="w-full border-collapse">
                      <tbody>
                        {(elem.data || []).map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={rIdx === 0 && elem.hasHeader ? 'bg-primary/10 dark:bg-primary/20 font-semibold text-primary dark:text-primary' : 'border-t border-outline-variant/30 dark:border-slate-700'}
                          >
                            {row.map((cellText, cIdx) => (
                              <td
                                key={cIdx}
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newData = [...elem.data];
                                  newData[rIdx][cIdx] = e.currentTarget.innerText;
                                  onUpdateElement(elem.id, { data: newData });
                                }}
                                className="border border-outline-variant/30 dark:border-slate-700/80 px-2.5 py-1.5 text-xs text-on-surface outline-none focus:bg-primary/20"
                              >
                                {cellText}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Render Type 4: Image */}
                {elem.type === 'image' && (
                  <div className="relative rounded-lg overflow-hidden border border-outline-variant/40 dark:border-slate-700 shadow-sm max-w-full">
                    <img
                      src={elem.src}
                      alt="Insertado en documento"
                      className="w-full h-auto object-contain block pointer-events-none"
                      style={{ maxHeight: '300px' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
