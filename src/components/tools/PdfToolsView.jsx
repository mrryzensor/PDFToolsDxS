import React, { useState } from 'react';
import { 
  FileCheck2, UploadCloud, Layers, Scissors, Minimize2, 
  ArrowRightLeft, Sparkles, Download, CheckCircle, RefreshCw
} from 'lucide-react';
import { mergePDFs, splitPDF, compressPDF, convertToPDF } from '../../utils/pdfEngine';
import { useToast } from '../../context/ToastContext';
import { saveAs } from 'file-saver';

export const PdfToolsView = () => {
  const { showToast } = useToast();
  const [activeTool, setActiveTool] = useState('merge'); // 'merge', 'split', 'compress', 'convert'
  const [isProcessing, setIsProcessing] = useState(false);

  // States for Merge
  const [mergeFiles, setMergeFiles] = useState([]);

  // States for Split
  const [splitFile, setSplitFile] = useState(null);
  const [splitRange, setSplitRange] = useState('');

  // States for Compress
  const [compressFile, setCompressFile] = useState(null);
  const [compressionResult, setCompressionResult] = useState(null);

  // States for Convert
  const [convertFiles, setConvertFiles] = useState([]);

  // Handle Merge Execution
  const handleMerge = async () => {
    if (mergeFiles.length < 2) {
      showToast('Selecciona al menos 2 archivos PDF para unificar', 'warning');
      return;
    }
    try {
      setIsProcessing(true);
      const blob = await mergePDFs(mergeFiles);
      saveAs(blob, 'Documentos_Unificados.pdf');
      showToast('¡Archivos PDF unidos exitosamente!', 'success');
      setMergeFiles([]);
    } catch (err) {
      console.error(err);
      showToast('Error al unificar los archivos PDF', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Split Execution
  const handleSplit = async () => {
    if (!splitFile) {
      showToast('Carga un archivo PDF para dividir', 'warning');
      return;
    }
    try {
      setIsProcessing(true);
      const zipBlob = await splitPDF(splitFile, splitRange);
      saveAs(zipBlob, `PDF_Dividido_${splitFile.name.replace('.pdf', '')}.zip`);
      showToast('¡Páginas extraídas y empaquetadas en ZIP con éxito!', 'success');
      setSplitFile(null);
      setSplitRange('');
    } catch (err) {
      console.error(err);
      showToast('Error al dividir el PDF', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Compress Execution
  const handleCompress = async () => {
    if (!compressFile) {
      showToast('Selecciona un archivo PDF para comprimir', 'warning');
      return;
    }
    try {
      setIsProcessing(true);
      const res = await compressPDF(compressFile);
      setCompressionResult(res);
      showToast(`¡PDF optimizado! Reducción del ${res.ratio}%`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error durante la compresión del PDF', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Convert to PDF Execution
  const handleConvert = async () => {
    if (convertFiles.length === 0) {
      showToast('Selecciona imágenes (PNG, JPG) o texto para convertir a PDF', 'warning');
      return;
    }
    try {
      setIsProcessing(true);
      const pdfBlob = await convertToPDF(convertFiles);
      saveAs(pdfBlob, 'Archivo_Convertido.pdf');
      showToast('¡Conversión a PDF completada!', 'success');
      setConvertFiles([]);
    } catch (err) {
      console.error(err);
      showToast('Error al convertir archivos a PDF', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-5xl mx-auto w-full">
      {/* Header Banner */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-headline font-bold text-on-surface">
          Suite de Herramientas PDF
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Comprime, une, divide o convierte archivos con procesamiento local de alta fidelidad.
        </p>
      </div>

      {/* Tool Navigation Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { id: 'merge', title: 'Unificar PDF', icon: Layers, desc: 'Combina múltiples PDFs en 1' },
          { id: 'split', title: 'Dividir PDF', icon: Scissors, desc: 'Separa páginas o rangos' },
          { id: 'compress', title: 'Comprimir / Optimizar', icon: Minimize2, desc: 'Reduce el peso del archivo' },
          { id: 'convert', title: 'Convertir a PDF', icon: ArrowRightLeft, desc: 'De imágenes y texto a PDF' },
        ].map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveTool(tool.id)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                isActive
                  ? 'border-primary dark:border-sky-500 bg-primary-container/10 dark:bg-sky-950/40 ring-2 ring-primary dark:ring-sky-500 ring-offset-2 ring-offset-surface dark:ring-offset-slate-950'
                  : 'border-outline-variant/30 dark:border-slate-800 bg-surface-container-low dark:bg-slate-900/60 hover:border-outline-variant dark:hover:border-slate-700'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                isActive ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-primary'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-headline font-bold text-on-surface">{tool.title}</h3>
              <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{tool.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Main Tool Active Workspace */}
      <div className="bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-xl">
        {/* Tool 1: Merge PDFs */}
        {activeTool === 'merge' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Unificador de Archivos PDF
              </h2>
              <p className="text-xs text-on-surface-variant mt-1">
                Selecciona dos o más documentos PDF para encadenarlos en un único archivo correlativo.
              </p>
            </div>

            <div className="border-2 border-dashed border-outline-variant/50 dark:border-slate-700/80 rounded-2xl p-8 text-center bg-surface-container-low/40 dark:bg-slate-950/40 hover:bg-surface-container-low/70 dark:hover:bg-slate-950/60 transition-colors">
              <UploadCloud className="w-10 h-10 text-primary mx-auto mb-3" />
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-primary text-on-primary rounded-xl font-semibold text-xs inline-block hover:bg-surface-tint shadow-md">
                  Examinar archivos PDF
                </span>
                <input
                  type="file"
                  multiple
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      setMergeFiles(Array.from(e.target.files));
                    }
                  }}
                />
              </label>
              <p className="text-[11px] text-outline mt-2">Puedes seleccionar varios archivos a la vez</p>
            </div>

            {mergeFiles.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-on-surface">Archivos seleccionados ({mergeFiles.length}):</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {mergeFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-xs">
                      <span className="font-medium text-on-surface truncate">{idx + 1}. {file.name}</span>
                      <span className="text-outline shrink-0 ml-2">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleMerge}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-surface-tint disabled:opacity-50 transition-all shadow-lg shadow-primary/20 mt-4"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                  {isProcessing ? 'Unificando documentos...' : 'Unir y Descargar PDF'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tool 2: Split PDF */}
        {activeTool === 'split' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
                <Scissors className="w-5 h-5 text-primary" />
                Divisor de Páginas PDF
              </h2>
              <p className="text-xs text-on-surface-variant mt-1">
                Extrae páginas individuales o rangos específicos (por ejemplo: 1-3, 5, 8).
              </p>
            </div>

            <div className="border-2 border-dashed border-outline-variant/50 dark:border-slate-700/80 rounded-2xl p-8 text-center bg-surface-container-low/40 dark:bg-slate-950/40 hover:bg-surface-container-low/70 dark:hover:bg-slate-950/60 transition-colors">
              <Scissors className="w-10 h-10 text-primary mx-auto mb-3" />
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-primary text-on-primary rounded-xl font-semibold text-xs inline-block hover:bg-surface-tint shadow-md">
                  {splitFile ? splitFile.name : 'Seleccionar archivo PDF'}
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setSplitFile(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>

            {splitFile && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-on-surface block mb-1">
                    Rango de páginas a extraer (opcional, deja en blanco para separar todas):
                  </label>
                  <div className="flex gap-2">
                    {['1-2', '1-5', 'todas'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSplitRange(r === 'todas' ? '' : r)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          (r === 'todas' && !splitRange) || splitRange === r
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface-container-low border-outline-variant/30 text-on-surface'
                        }`}
                      >
                        {r === 'todas' ? 'Todas las páginas' : `Páginas ${r}`}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSplit}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-surface-tint disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
                  {isProcessing ? 'Dividiendo páginas...' : 'Dividir y Descargar ZIP'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tool 3: Compress PDF */}
        {activeTool === 'compress' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
                <Minimize2 className="w-5 h-5 text-primary" />
                Compresor & Optimizador PDF
              </h2>
              <p className="text-xs text-on-surface-variant mt-1">
                Optimiza la estructura interna, fuentes y metadatos reduciendo el tamaño para compartir.
              </p>
            </div>

            <div className="border-2 border-dashed border-outline-variant/50 dark:border-slate-700/80 rounded-2xl p-8 text-center bg-surface-container-low/40 dark:bg-slate-950/40 hover:bg-surface-container-low/70 dark:hover:bg-slate-950/60 transition-colors">
              <Minimize2 className="w-10 h-10 text-primary mx-auto mb-3" />
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-primary text-on-primary rounded-xl font-semibold text-xs inline-block hover:bg-surface-tint shadow-md">
                  {compressFile ? compressFile.name : 'Cargar PDF para Optimizar'}
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setCompressFile(e.target.files[0]);
                      setCompressionResult(null);
                    }
                  }}
                />
              </label>
            </div>

            {compressFile && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs">
                  <span className="font-semibold text-on-surface truncate">{compressFile.name}</span>
                  <span className="text-outline">{(compressFile.size / 1024).toFixed(1)} KB</span>
                </div>

                {compressionResult && (
                  <div className="p-4 rounded-xl bg-primary-container/10 border border-primary/30 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-primary block">Optimización completada</span>
                      <span className="text-xs text-on-surface-variant">
                        {(compressionResult.originalSize / 1024).toFixed(1)} KB → {(compressionResult.newSize / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveAs(compressionResult.blob, `Optimizado_${compressFile.name}`)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-surface-tint shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      Descargar
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCompress}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-surface-tint disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isProcessing ? 'Comprimiendo PDF...' : 'Comprimir PDF'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tool 4: Convert to PDF */}
        {activeTool === 'convert' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                Convertir Imágenes y Archivos a PDF
              </h2>
              <p className="text-xs text-on-surface-variant mt-1">
                Transforma imágenes (PNG, JPG, WebP) o notas de texto en un documento PDF listo para imprimir.
              </p>
            </div>

            <div className="border-2 border-dashed border-outline-variant/50 dark:border-slate-700/80 rounded-2xl p-8 text-center bg-surface-container-low/40 dark:bg-slate-950/40 hover:bg-surface-container-low/70 dark:hover:bg-slate-950/60 transition-colors">
              <UploadCloud className="w-10 h-10 text-primary mx-auto mb-3" />
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-primary text-on-primary rounded-xl font-semibold text-xs inline-block hover:bg-surface-tint shadow-md">
                  Cargar Imágenes o Texto (.txt)
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      setConvertFiles(Array.from(e.target.files));
                    }
                  }}
                />
              </label>
              <p className="text-[11px] text-outline mt-2">Compatible con PNG, JPG y TXT</p>
            </div>

            {convertFiles.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-semibold text-on-surface">Archivos a convertir ({convertFiles.length}):</span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {convertFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-xs">
                      <span className="font-medium text-on-surface truncate">{idx + 1}. {file.name}</span>
                      <span className="text-outline shrink-0 ml-2">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-surface-tint disabled:opacity-50 transition-all shadow-lg shadow-primary/20 mt-4"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
                  {isProcessing ? 'Generando PDF...' : 'Convertir a PDF y Descargar'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
