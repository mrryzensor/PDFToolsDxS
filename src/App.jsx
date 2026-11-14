import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/layout/Header';
import { WordRibbon } from './components/editor/WordRibbon';
import { EditorPage } from './components/editor/EditorPage';
import { ShapesModal } from './components/editor/ShapesModal';
import { TableModal } from './components/editor/TableModal';
import { ExportConvertModal } from './components/editor/ExportConvertModal';
import { PdfToolsView } from './components/tools/PdfToolsView';
import { CertificatesView } from './components/certificates/CertificatesView';
import { LearningSessionsView } from './components/sessions/LearningSessionsView';
import { RubricsView } from './components/rubrics/RubricsView';
import { ApiKeysModal } from './components/common/ApiKeysModal';
import { useToast } from './context/ToastContext';
import { Plus, Layers } from 'lucide-react';
import { exportToWord, exportEditorToPDF } from './utils/pdfEngine';
import { saveAs } from 'file-saver';

export const App = () => {
  const { showToast } = useToast();
  // Active module view: 'editor' | 'tools' | 'certificates' | 'sessions' | 'rubrics'
  const [currentView, setCurrentView] = useState('editor');
  const [activeRibbonTab, setActiveRibbonTab] = useState('inicio');

  // Modal states
  const [isShapesModalOpen, setIsShapesModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isApiKeysModalOpen, setIsApiKeysModalOpen] = useState(false);

  // Document Pages State - Sized specifically for A4 (595px width)
  const [pages, setPages] = useState([
    {
      id: 'page-1',
      elements: [
        {
          id: 'elem-header',
          type: 'text',
          x: 35,
          y: 40,
          width: 525,
          fontSize: 20,
          fontWeight: 'bold',
          textAlign: 'center',
          color: '#004ac6',
          content: 'ACUERDO DE PRESTACIÓN DE SERVICIOS',
        },
        {
          id: 'elem-sub',
          type: 'text',
          x: 35,
          y: 85,
          width: 525,
          fontSize: 12,
          fontWeight: 'normal',
          textAlign: 'center',
          color: '#737686',
          content: 'Emitido en el marco de la Suite de Precisión DocuCraft • Ref: DC-2026-X',
        },
        {
          id: 'elem-intro',
          type: 'text',
          x: 35,
          y: 130,
          width: 525,
          fontSize: 13,
          fontWeight: 'normal',
          textAlign: 'justify',
          content: 'El presente instrumento contractual formaliza los compromisos operacionales, las cláusulas de propiedad intelectual y el cronograma de ejecución estipulado entre las partes firmantes. Las tarifas acordadas se desglosan en las matrices financieras referenciadas a continuación:',
        },
        {
          id: 'elem-table',
          type: 'table',
          x: 35,
          y: 225,
          width: 525,
          rows: 3,
          cols: 4,
          hasHeader: true,
          data: [
            ['Fase / Hito', 'Entregable Clave', 'Fecha Límite', 'Estado'],
            ['Fase 1: Especificaciones', 'Arquitectura del Documento', 'Semana 1', 'Completado'],
            ['Fase 2: Implementación', 'Suite de Conversión & Vectorial', 'Semana 3', 'En Progreso'],
          ]
        },
        {
          id: 'elem-shape-arrow',
          type: 'shape',
          shapeType: 'arrow-right',
          x: 35,
          y: 360,
          width: 170,
          height: 50,
          fill: '#dbe1ff',
          stroke: '#004ac6',
          strokeWidth: 2,
        },
        {
          id: 'elem-shape-diamond',
          type: 'shape',
          shapeType: 'diamond',
          x: 235,
          y: 350,
          width: 75,
          height: 70,
          fill: '#ffddb8',
          stroke: '#855300',
          strokeWidth: 2,
        },
        {
          id: 'elem-shape-poly',
          type: 'shape',
          shapeType: 'polygon',
          sides: 6,
          x: 345,
          y: 345,
          width: 75,
          height: 75,
          fill: '#eaedff',
          stroke: '#2563eb',
          strokeWidth: 2,
        },
        {
          id: 'elem-notes',
          type: 'text',
          x: 35,
          y: 445,
          width: 525,
          fontSize: 12,
          fontWeight: 'normal',
          content: 'Nota técnica: Puedes editar cualquier texto haciendo clic sobre él, insertar más figuras geométricas o tablas, o pegar directamente imágenes desde tu portapapeles con Ctrl + V.',
        }
      ]
    }
  ]);

  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState(null);
  
  // Adaptive initial zoom based on window width
  const [zoom, setZoom] = useState(() => {
    return window.innerWidth < 1200 ? 0.85 : 1.0;
  });

  // History state for Undo/Redo
  const [history, setHistory] = useState([pages]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Hidden file input for Image Upload button
  const fileInputRef = useRef(null);

  // Push new state to history
  const updatePagesWithHistory = (newPages) => {
    setPages(newPages);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newPages);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setPages(history[historyIndex - 1]);
      showToast('Acción deshecha', 'info', 1800);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setPages(history[historyIndex + 1]);
      showToast('Acción rehecha', 'info', 1800);
    }
  };

  // Keyboard shortcut listener for Ctrl+V (Paste Image) & Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handlePaste = (e) => {
      // Only paste into canvas if we are inside editor view
      if (currentView !== 'editor') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target.result;
            handleAddImageElement(base64);
            showToast('Imagen insertada exitosamente desde el portapapeles (Ctrl+V)', 'success');
          };
          reader.readAsDataURL(blob);
          e.preventDefault();
          break;
        }
      }
    };

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [historyIndex, history, pages, currentView]);

  // Insert elements into the currently active page
  const handleAddText = () => {
    const newElem = {
      id: `text-${Date.now()}`,
      type: 'text',
      x: 60,
      y: 180,
      width: 350,
      fontSize: 14,
      fontWeight: 'normal',
      textAlign: 'left',
      content: 'Escribe tu nuevo texto aquí...',
    };

    const updatedPages = [...pages];
    updatedPages[activePageIndex].elements.push(newElem);
    updatePagesWithHistory(updatedPages);
    setSelectedElementId(newElem.id);
    showToast('Caja de texto agregada', 'info', 2000);
  };

  const handleAddShape = (shapeConfig) => {
    const newElem = {
      id: `shape-${Date.now()}`,
      ...shapeConfig,
      x: 80,
      y: 200,
    };

    const updatedPages = [...pages];
    updatedPages[activePageIndex].elements.push(newElem);
    updatePagesWithHistory(updatedPages);
    setSelectedElementId(newElem.id);
    showToast('Figura geométrica insertada', 'success', 2500);
  };

  const handleAddTable = (tableConfig) => {
    const newElem = {
      id: `table-${Date.now()}`,
      ...tableConfig,
      x: 40,
      y: 220,
    };

    const updatedPages = [...pages];
    updatedPages[activePageIndex].elements.push(newElem);
    updatePagesWithHistory(updatedPages);
    setSelectedElementId(newElem.id);
    showToast('Tabla editable insertada', 'success', 2500);
  };

  const handleAddImageElement = (dataUrl) => {
    const newElem = {
      id: `img-${Date.now()}`,
      type: 'image',
      src: dataUrl,
      x: 60,
      y: 180,
      width: 280,
      height: 180,
    };

    const updatedPages = [...pages];
    updatedPages[activePageIndex].elements.push(newElem);
    updatePagesWithHistory(updatedPages);
    setSelectedElementId(newElem.id);
  };

  // Update specific element
  const handleUpdateElement = (id, updates, recordHistory = true) => {
    const updatedPages = pages.map((page, pIdx) => {
      if (pIdx !== activePageIndex) return page;
      return {
        ...page,
        elements: page.elements.map(el => el.id === id ? { ...el, ...updates } : el)
      };
    });

    if (recordHistory) {
      updatePagesWithHistory(updatedPages);
    } else {
      setPages(updatedPages);
    }
  };

  // Delete element
  const handleDeleteElement = (id) => {
    const updatedPages = pages.map((page, pIdx) => {
      if (pIdx !== activePageIndex) return page;
      return {
        ...page,
        elements: page.elements.filter(el => el.id !== id)
      };
    });
    updatePagesWithHistory(updatedPages);
    setSelectedElementId(null);
    showToast('Elemento eliminado', 'info', 2000);
  };

  // Add new blank page
  const handleAddNewPage = () => {
    const newPage = {
      id: `page-${Date.now()}`,
      elements: []
    };
    const updated = [...pages, newPage];
    updatePagesWithHistory(updated);
    setActivePageIndex(updated.length - 1);
    showToast(`Página ${updated.length} creada`, 'success');
  };

  // Direct export quick handlers
  const handleQuickWordExport = async () => {
    try {
      const docx = await exportToWord(pages, 'Documento_DocuCraft');
      saveAs(docx, 'Documento_DocuCraft.docx');
      showToast('Documento Word (.docx) descargado', 'success');
    } catch {
      showToast('Error al exportar Word', 'error');
    }
  };

  const handleQuickPDFExport = async () => {
    try {
      const pdf = await exportEditorToPDF(pages, 'Documento_DocuCraft');
      saveAs(pdf, 'Documento_DocuCraft.pdf');
      showToast('Documento PDF descargado', 'success');
    } catch {
      showToast('Error al generar PDF', 'error');
    }
  };

  const activePage = pages[activePageIndex] || pages[0];
  const selectedElement = activePage?.elements.find(el => el.id === selectedElementId);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface text-on-surface">
      {/* Top Main Navigation Header */}
      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenApiKeysModal={() => setIsApiKeysModalOpen(true)}
      />

      {/* Hidden File Input for Image upload button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              handleAddImageElement(ev.target.result);
              showToast('Imagen cargada con éxito', 'success');
            };
            reader.readAsDataURL(e.target.files[0]);
          }
        }}
      />

      {/* View 1: Word-Style Document Editor */}
      {currentView === 'editor' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Word Ribbon Toolbar */}
          <WordRibbon
            activeTab={activeRibbonTab}
            setActiveTab={setActiveRibbonTab}
            onAddText={handleAddText}
            onOpenTableModal={() => setIsTableModalOpen(true)}
            onOpenShapesModal={() => setIsShapesModalOpen(true)}
            onTriggerImageUpload={() => fileInputRef.current?.click()}
            onDeleteSelected={() => selectedElementId && handleDeleteElement(selectedElementId)}
            selectedElement={selectedElement}
            onUpdateElement={handleUpdateElement}
            onExportWord={handleQuickWordExport}
            onExportPDF={handleQuickPDFExport}
            zoom={zoom}
            setZoom={setZoom}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />

          {/* Canvas Workspace & Sidebar thumbnails */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Left Page Thumbnails Bar */}
            <aside className="w-44 bg-surface-container-low/70 dark:bg-slate-900 border-r border-outline-variant/30 dark:border-slate-800 p-3 hidden md:flex flex-col gap-3 overflow-y-auto select-none shrink-0">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-on-surface-variant dark:text-slate-400 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  Páginas ({pages.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddNewPage}
                  title="Nueva página en blanco"
                  className="p-1 rounded-lg bg-primary text-on-primary hover:bg-surface-tint shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {pages.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setActivePageIndex(idx);
                    setSelectedElementId(null);
                  }}
                  className={`w-full aspect-[1/1.3] rounded-xl border p-2 flex flex-col justify-between text-left transition-all relative ${
                    activePageIndex === idx
                      ? 'border-primary dark:border-primary ring-2 ring-primary dark:ring-primary ring-offset-2 ring-offset-surface-container-low dark:ring-offset-slate-900 bg-surface-container-lowest dark:bg-slate-800'
                      : 'border-outline-variant/30 dark:border-slate-800 bg-surface-container-lowest/60 dark:bg-slate-800/40 hover:border-outline-variant dark:hover:border-slate-700'
                  }`}
                >
                  <span className="text-[10px] font-bold text-primary dark:text-primary">Pág. {idx + 1}</span>
                  <div className="w-full flex-1 my-1 rounded bg-surface-container-low/50 dark:bg-slate-900/60 flex items-center justify-center text-[10px] text-outline dark:text-slate-400">
                    {p.elements.length} elementos
                  </div>
                </button>
              ))}
            </aside>

            {/* Document Board Canvas with Full Scrollbar Support & Centering */}
            <main className="flex-1 overflow-auto bg-surface-container/60 dark:bg-slate-950 p-6 md:p-8">
              <div className="w-fit min-w-full flex justify-center py-4">
                <EditorPage
                  pageIndex={activePageIndex}
                  elements={activePage.elements}
                  selectedElementId={selectedElementId}
                  onSelectElement={setSelectedElementId}
                  onUpdateElement={handleUpdateElement}
                  onDeleteElement={handleDeleteElement}
                  onAddElement={() => {}}
                  zoom={zoom}
                />
              </div>
            </main>
          </div>
        </div>
      )}

      {/* View 2: PDF Tools (Compress, Merge, Split, Convert) */}
      {currentView === 'tools' && (
        <PdfToolsView />
      )}

      {/* View 3: Certificate Generator Canvas, Bulk Excel & QR Validator */}
      {currentView === 'certificates' && (
        <CertificatesView />
      )}

      {/* View 4: CNEB Learning Session Generator with Dynamic Gemini */}
      {currentView === 'sessions' && (
        <LearningSessionsView onOpenApiKeysModal={() => setIsApiKeysModalOpen(true)} />
      )}

      {/* View 5: Rubrics & Interactive Student Exam Solver */}
      {currentView === 'rubrics' && (
        <RubricsView onOpenApiKeysModal={() => setIsApiKeysModalOpen(true)} />
      )}

      {/* Modals */}
      <ShapesModal
        isOpen={isShapesModalOpen}
        onClose={() => setIsShapesModalOpen(false)}
        onAddShape={handleAddShape}
      />

      <TableModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        onAddTable={handleAddTable}
      />

      <ExportConvertModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        pagesData={pages}
      />

      <ApiKeysModal
        isOpen={isApiKeysModalOpen}
        onClose={() => setIsApiKeysModalOpen(false)}
      />
    </div>
  );
};
