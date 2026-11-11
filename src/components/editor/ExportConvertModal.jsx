import React, { useState } from 'react';
import { 
  FileText, Download, Sparkles, Check, FileCheck, RefreshCw, 
  Settings2, FileCode, CheckCircle2
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { exportToWord, exportEditorToPDF } from '../../utils/pdfEngine';
import { useToast } from '../../context/ToastContext';
import { saveAs } from 'file-saver';

export const ExportConvertModal = ({ isOpen, onClose, pagesData }) => {
  const { showToast } = useToast();
  const [format, setFormat] = useState('docx'); // 'docx' or 'pdf'
  const [fileName, setFileName] = useState('Documento_DocuCraft');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);

      if (format === 'docx') {
        const docxBlob = await exportToWord(pagesData, fileName);
        saveAs(docxBlob, `${fileName}.docx`);
        showToast('¡Documento Word (.docx) exportado exitosamente!', 'success');
      } else {
        const pdfBlob = await exportEditorToPDF(pagesData, fileName);
        saveAs(pdfBlob, `${fileName}.pdf`);
        showToast('¡Documento PDF exportado exitosamente!', 'success');
      }

      onClose();
    } catch (err) {
      console.error(err);
      showToast('Ocurrió un error durante la exportación', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Exportar y Convertir Documento"
      subtitle="Guarda tu creación en formatos estándar de oficina o publicación"
      maxWidth="max-w-lg"
    >
      <div className="space-y-6">
        {/* Format Selector Cards */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFormat('docx')}
            className={`p-4 rounded-xl border text-left transition-all ${
              format === 'docx'
                ? 'border-primary dark:border-sky-500 bg-primary-container/10 dark:bg-sky-950/40 ring-1 ring-primary dark:ring-sky-500'
                : 'border-outline-variant/30 dark:border-slate-800 bg-surface-container-low dark:bg-slate-950/50 hover:border-outline-variant dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-6 h-6 text-primary dark:text-sky-400" />
              {format === 'docx' && <CheckCircle2 className="w-4 h-4 text-primary dark:text-sky-400" />}
            </div>
            <h4 className="text-sm font-bold text-on-surface">Microsoft Word</h4>
            <p className="text-[11px] text-on-surface-variant dark:text-slate-400 mt-0.5">Formato editable .docx con tablas y párrafos</p>
          </button>

          <button
            type="button"
            onClick={() => setFormat('pdf')}
            className={`p-4 rounded-xl border text-left transition-all ${
              format === 'pdf'
                ? 'border-primary dark:border-sky-500 bg-primary-container/10 dark:bg-sky-950/40 ring-1 ring-primary dark:ring-sky-500'
                : 'border-outline-variant/30 dark:border-slate-800 bg-surface-container-low dark:bg-slate-950/50 hover:border-outline-variant dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <FileCode className="w-6 h-6 text-secondary dark:text-amber-400" />
              {format === 'pdf' && <CheckCircle2 className="w-4 h-4 text-primary dark:text-sky-400" />}
            </div>
            <h4 className="text-sm font-bold text-on-surface">Documento PDF</h4>
            <p className="text-[11px] text-on-surface-variant dark:text-slate-400 mt-0.5">Documento vectorial listo para imprimir o enviar</p>
          </button>
        </div>

        {/* File Name Options */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
            <Settings2 className="w-4 h-4 text-primary dark:text-sky-400" />
            Nombre del archivo:
          </label>
          <div className="flex items-center gap-2">
            {['Documento_Oficial', 'Contrato_Servicios', 'Informe_Tecnico'].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setFileName(name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  fileName === name
                    ? 'bg-primary dark:bg-sky-500 text-on-primary dark:text-slate-950 border-primary dark:border-sky-500 font-semibold'
                    : 'bg-surface-container-low dark:bg-slate-950/60 border-outline-variant/30 dark:border-slate-800 text-on-surface dark:text-slate-300 hover:border-slate-700'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Summary box */}
        <div className="p-3.5 rounded-xl bg-surface-container-low dark:bg-slate-950/60 border border-outline-variant/30 dark:border-slate-800 text-xs text-on-surface-variant dark:text-slate-300">
          <span className="font-semibold text-on-surface block mb-1">Resumen del documento:</span>
          <span>• Páginas a procesar: <strong className="text-on-surface">{pagesData.length}</strong></span><br />
          <span>• Elementos vectoriales y contenido: <strong className="text-on-surface">{pagesData.reduce((acc, p) => acc + p.elements.length, 0)} elementos</strong></span>
        </div>

        {/* Footer actions */}
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
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:bg-surface-tint shadow-md shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Exportando...' : `Descargar ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </Modal>
  );
};
