import React, { useState, useRef } from 'react';
import { 
  Award, QrCode, Upload, FileSpreadsheet, Plus, Trash2, 
  Download, Eye, CheckCircle2, AlertCircle, Edit3, UserCheck, 
  Search, Move, Layers, Settings2, Sparkles, RefreshCw, Smartphone, 
  ExternalLink, Copy, Check
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { 
  getCertTemplates, saveCertTemplate, deleteCertTemplate, 
  getCertEmissions, saveCertEmission, deleteCertEmission, 
  findEmissionByEmailOrPhone, findEmissionByCode, generateCertCode 
} from '../../utils/storage';
import { exportCertificateToPdf, exportCertificateToPng } from '../../utils/certificateEngine';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export const CertificatesView = () => {
  const { showToast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState('templates'); // 'templates', 'emissions', 'form', 'verify'

  // Templates state
  const [templates, setTemplates] = useState(() => {
    const list = getCertTemplates();
    if (list.length === 0) {
      // Create initial starter template
      const defaultT = {
        id: 'template_default',
        title: 'Certificado de Aprobación Oficial',
        courseTitle: 'Diplomado en Inteligencia Artificial y Pedagogía',
        institution: 'Centro de Altos Estudios Educativos',
        hours: 120,
        backgroundImage: null,
        width: 1000,
        height: 700,
        elements: [
          { id: 'el_1', type: 'text', content: 'CERTIFICADO DE RECONOCIMIENTO', x: 200, y: 110, fontSize: 26, fontWeight: 'bold', color: '#004ac6', textAlign: 'center', width: 600 },
          { id: 'el_2', type: 'text', content: 'Otorgado con distinción académica a:', x: 200, y: 190, fontSize: 14, fontWeight: 'normal', color: '#434655', textAlign: 'center', width: 600 },
          { id: 'el_3', type: 'text', content: '{{nombre}}', x: 150, y: 240, fontSize: 32, fontWeight: 'bold', color: '#131b2e', textAlign: 'center', width: 700, textDecoration: 'underline' },
          { id: 'el_4', type: 'text', content: 'Por haber completado y aprobado satisfactoriamente los módulos del programa:', x: 150, y: 320, fontSize: 14, fontWeight: 'normal', color: '#434655', textAlign: 'center', width: 700 },
          { id: 'el_5', type: 'text', content: '"{{curso}}"', x: 150, y: 360, fontSize: 22, fontWeight: 'bold', color: '#004ac6', textAlign: 'center', width: 700 },
          { id: 'el_6', type: 'text', content: 'Con una duración de {{horas}}, desarrollado del 15 de marzo al 20 de mayo de 2026.', x: 150, y: 430, fontSize: 13, fontWeight: 'normal', color: '#737686', textAlign: 'center', width: 700 },
          { id: 'el_7', type: 'text', content: 'Código de Verificación Digital: {{codigo}}', x: 100, y: 620, fontSize: 11, fontWeight: 'bold', color: '#737686', textAlign: 'left', width: 450 },
          { id: 'el_8', type: 'text', content: 'Fecha de Emisión: {{fecha}}', x: 100, y: 640, fontSize: 10, fontWeight: 'normal', color: '#737686', textAlign: 'left', width: 450 },
          { id: 'el_qr', type: 'qr', x: 800, y: 550, width: 110, height: 110, color: '#004ac6' },
        ],
      };
      saveCertTemplate(defaultT);
      return [defaultT];
    }
    return list;
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState(() => templates[0]?.id || 'template_default');
  const activeTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  // Selected element inside designer canvas
  const [selectedElementId, setSelectedElementId] = useState(null);

  // Bulk Import modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkDataText, setBulkDataText] = useState('');

  // Public Student Registration Form state
  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    phone: '',
    courseId: selectedTemplateId,
  });
  const [existingRecordNotice, setExistingRecordNotice] = useState(null);

  // Verification Search state
  const [verifyCode, setVerifyCode] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);

  // Emissions list
  const [emissions, setEmissions] = useState(() => getCertEmissions());

  const refreshEmissions = () => {
    setEmissions(getCertEmissions());
  };

  // Canvas Dragging handler
  const [dragInfo, setDragInfo] = useState(null);
  const canvasRef = useRef(null);

  const handleMouseDownElem = (e, elemId) => {
    e.stopPropagation();
    setSelectedElementId(elemId);
    const elem = activeTemplate.elements.find((el) => el.id === elemId);
    if (!elem) return;

    setDragInfo({
      elemId,
      startX: e.clientX,
      startY: e.clientY,
      initX: elem.x,
      initY: elem.y,
    });
  };

  const handleMouseMoveCanvas = (e) => {
    if (!dragInfo) return;
    const dx = e.clientX - dragInfo.startX;
    const dy = e.clientY - dragInfo.startY;

    const newX = Math.max(0, Math.min(activeTemplate.width - 60, dragInfo.initX + dx));
    const newY = Math.max(0, Math.min(activeTemplate.height - 30, dragInfo.initY + dy));

    const updatedElements = activeTemplate.elements.map((el) =>
      el.id === dragInfo.elemId ? { ...el, x: Math.round(newX), y: Math.round(newY) } : el
    );

    const updatedTemplate = { ...activeTemplate, elements: updatedElements };
    saveCertTemplate(updatedTemplate);
    setTemplates(getCertTemplates());
  };

  const handleMouseUpCanvas = () => {
    setDragInfo(null);
  };

  // Update element property
  const updateElementProp = (elemId, props) => {
    const updatedElements = activeTemplate.elements.map((el) =>
      el.id === elemId ? { ...el, ...props } : el
    );
    const updatedTemplate = { ...activeTemplate, elements: updatedElements };
    saveCertTemplate(updatedTemplate);
    setTemplates(getCertTemplates());
  };

  // Add new element
  const handleAddTextElement = () => {
    const newEl = {
      id: `el_${Date.now()}`,
      type: 'text',
      content: 'Nuevo texto personalizable',
      x: 100,
      y: 200,
      fontSize: 16,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left',
      color: '#131b2e',
      width: 400,
    };
    const updated = { ...activeTemplate, elements: [...activeTemplate.elements, newEl] };
    saveCertTemplate(updated);
    setTemplates(getCertTemplates());
    setSelectedElementId(newEl.id);
    showToast('Elemento de texto agregado', 'info');
  };

  // Background Image Upload
  const handleBackgroundUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const updated = { ...activeTemplate, backgroundImage: event.target.result };
      saveCertTemplate(updated);
      setTemplates(getCertTemplates());
      showToast('Fondo del certificado actualizado', 'success');
    };
    reader.readAsDataURL(file);
  };

  // Bulk Excel Upload
  const handleFileUploadExcel = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Parse rows: [Nombre, Email, WhatsApp]
        const rows = data.slice(1).filter((r) => r && r[0]);
        let count = 0;

        for (const row of rows) {
          const name = String(row[0] || '').trim();
          const email = String(row[1] || '').trim();
          const phone = String(row[2] || '').trim();

          if (name) {
            saveCertEmission({
              courseId: activeTemplate.id,
              courseTitle: activeTemplate.courseTitle,
              recipientName: name,
              recipientEmail: email,
              recipientPhone: phone,
              date: new Date().toLocaleDateString('es-ES'),
              hours: activeTemplate.hours,
            });
            count++;
          }
        }

        refreshEmissions();
        setIsBulkModalOpen(false);
        showToast(`¡${count} certificados emitidos por volumen desde Excel!`, 'success');
      } catch (err) {
        showToast('Error al procesar archivo Excel: ' + err.message, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Process Pasted Data
  const handleProcessPastedData = () => {
    if (!bulkDataText.trim()) {
      showToast('Pega al menos una fila de datos', 'warning');
      return;
    }

    const lines = bulkDataText.split('\n');
    let count = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      // split by tab or comma
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      const name = (parts[0] || '').trim();
      const email = (parts[1] || '').trim();
      const phone = (parts[2] || '').trim();

      if (name) {
        saveCertEmission({
          courseId: activeTemplate.id,
          courseTitle: activeTemplate.courseTitle,
          recipientName: name,
          recipientEmail: email,
          recipientPhone: phone,
          date: new Date().toLocaleDateString('es-ES'),
          hours: activeTemplate.hours,
        });
        count++;
      }
    }

    refreshEmissions();
    setBulkDataText('');
    setIsBulkModalOpen(false);
    showToast(`¡${count} certificados generados a partir de los datos pegados!`, 'success');
  };

  // Student Self-Service Form Submit (Validates duplication or allows editing)
  const handleStudentFormSubmit = (e) => {
    e.preventDefault();
    if (!studentForm.name.trim() || (!studentForm.email.trim() && !studentForm.phone.trim())) {
      showToast('Por favor ingresa tu nombre completo y correo o WhatsApp', 'warning');
      return;
    }

    // Check duplication in this course
    const existing = findEmissionByEmailOrPhone(
      studentForm.courseId,
      studentForm.email,
      studentForm.phone
    );

    if (existing && !existingRecordNotice) {
      // Found existing record! Alert user and let them edit
      setExistingRecordNotice(existing);
      setStudentForm({
        ...studentForm,
        name: existing.recipientName,
        email: existing.recipientEmail || studentForm.email,
        phone: existing.recipientPhone || studentForm.phone,
      });
      showToast('Ya posees un certificado para este curso. Puedes modificar tus datos para actualizarlo.', 'info', 5000);
      return;
    }

    // Save or Update record
    const recordPayload = existingRecordNotice
      ? { ...existingRecordNotice, recipientName: studentForm.name, recipientEmail: studentForm.email, recipientPhone: studentForm.phone }
      : {
          courseId: studentForm.courseId,
          courseTitle: activeTemplate.courseTitle,
          recipientName: studentForm.name,
          recipientEmail: studentForm.email,
          recipientPhone: studentForm.phone,
          date: new Date().toLocaleDateString('es-ES'),
          hours: activeTemplate.hours,
        };

    const result = saveCertEmission(recordPayload);
    refreshEmissions();
    setExistingRecordNotice(null);
    setStudentForm({ name: '', email: '', phone: '', courseId: selectedTemplateId });

    if (result.isUpdate) {
      showToast(`¡Certificado ${result.record.code} actualizado con tus nuevos datos!`, 'success');
    } else {
      showToast(`¡Certificado generado exitosamente con Código: ${result.record.code}!`, 'success');
    }

    // Set verification to auto show it
    setVerifyCode(result.record.code);
    setVerificationResult(result.record);
    setActiveSubTab('verify');
  };

  // Verification Lookup
  const handleVerifySearch = () => {
    if (!verifyCode.trim()) {
      showToast('Ingresa un código de certificado', 'warning');
      return;
    }
    const found = findEmissionByCode(verifyCode);
    if (found) {
      setVerificationResult(found);
      showToast('¡Certificado auténtico y verificado!', 'success');
    } else {
      setVerificationResult(false);
      showToast('No se encontró ningún certificado con ese código.', 'error');
    }
  };

  // Download certificate directly
  const handleDownloadSinglePdf = async (record) => {
    try {
      showToast('Generando PDF de alta resolución...', 'info');
      const verifyUrl = `${window.location.origin}?verify=${record.code}`;
      const blob = await exportCertificateToPdf(activeTemplate, record, verifyUrl);
      saveAs(blob, `Certificado_${record.code}_${record.recipientName.replace(/\s+/g, '_')}.pdf`);
      showToast('¡Certificado descargado con éxito!', 'success');
    } catch (err) {
      showToast('Error al exportar certificado: ' + err.message, 'error');
    }
  };

  const selectedElement = activeTemplate.elements.find((el) => el.id === selectedElementId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface text-on-surface">
      {/* Sub navigation bar */}
      <div className="h-12 border-b border-outline-variant/30 dark:border-slate-800 bg-surface-container-low dark:bg-slate-900 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {[
            { id: 'templates', label: 'Diseñador Canvas', icon: Award },
            { id: 'emissions', label: `Emisiones (${emissions.length})`, icon: UserCheck },
            { id: 'form', label: 'Formulario de Solicitud', icon: Edit3 },
            { id: 'verify', label: 'Página de Verificación QR', icon: QrCode },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant dark:text-slate-400 hover:text-on-surface hover:bg-surface-container-high dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeSubTab === 'templates' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 dark:bg-sky-950/40 border border-primary/30 dark:border-sky-800 text-primary dark:text-sky-300 text-xs font-semibold hover:bg-primary/20 transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Importar por Volumen (Excel)</span>
            </button>
          </div>
        )}
      </div>

      {/* 1. CANVAS DESIGNER SUB-VIEW */}
      {activeSubTab === 'templates' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Canvas Toolbar for Selected Element */}
          <aside className="w-72 bg-surface-container-low dark:bg-slate-900 border-r border-outline-variant/30 dark:border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto shrink-0 select-none">
            <div>
              <span className="text-xs font-bold text-on-surface block mb-2">Plantilla del Certificado</span>
              <input
                type="text"
                value={activeTemplate.title}
                onChange={(e) => {
                  const updated = { ...activeTemplate, title: e.target.value };
                  saveCertTemplate(updated);
                  setTemplates(getCertTemplates());
                }}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none"
              />
            </div>

            {/* Background Image Upload */}
            <div className="p-3 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-on-surface-variant flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-primary" />
                Imagen de Fondo del Certificado
              </span>
              <label className="flex items-center justify-center gap-2 w-full py-2 px-3 border border-dashed border-outline-variant/40 rounded-xl cursor-pointer hover:bg-surface-container-high/40 text-xs font-medium text-primary">
                <span>{activeTemplate.backgroundImage ? 'Cambiar imagen' : 'Subir imagen de fondo'}</span>
                <input type="file" accept="image/*" onChange={handleBackgroundUpload} className="hidden" />
              </label>
              {activeTemplate.backgroundImage && (
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...activeTemplate, backgroundImage: null };
                    saveCertTemplate(updated);
                    setTemplates(getCertTemplates());
                    showToast('Fondo restaurado al diseño clásico', 'info');
                  }}
                  className="text-[10px] text-rose-500 hover:underline block text-center w-full"
                >
                  Quitar imagen de fondo
                </button>
              )}
            </div>

            {/* Insert Elements */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-on-surface block">Agregar Elementos</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleAddTextElement}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-outline-variant/30 dark:border-slate-800 bg-surface-container-lowest dark:bg-slate-950 text-xs font-semibold hover:border-primary transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  <span>Texto</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeTemplate.elements.some((el) => el.type === 'qr')) {
                      showToast('El código QR ya está presente en el canvas', 'warning');
                      return;
                    }
                    const qrEl = { id: `el_qr_${Date.now()}`, type: 'qr', x: 750, y: 500, width: 110, height: 110, color: '#004ac6' };
                    const updated = { ...activeTemplate, elements: [...activeTemplate.elements, qrEl] };
                    saveCertTemplate(updated);
                    setTemplates(getCertTemplates());
                    showToast('Código QR único agregado', 'success');
                  }}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-outline-variant/30 dark:border-slate-800 bg-surface-container-lowest dark:bg-slate-950 text-xs font-semibold hover:border-primary transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5 text-secondary" />
                  <span>Código QR</span>
                </button>
              </div>
            </div>

            {/* Selected Element Toolbar */}
            {selectedElement && selectedElement.type === 'text' && (
              <div className="p-3.5 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/40 dark:border-slate-800 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary">Estilo del Texto</span>
                  <button
                    type="button"
                    onClick={() => {
                      const filtered = activeTemplate.elements.filter((el) => el.id !== selectedElement.id);
                      const updated = { ...activeTemplate, elements: filtered };
                      saveCertTemplate(updated);
                      setTemplates(getCertTemplates());
                      setSelectedElementId(null);
                      showToast('Elemento eliminado', 'info');
                    }}
                    className="p-1 text-rose-500 hover:bg-rose-500/10 rounded"
                    title="Eliminar elemento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={selectedElement.content}
                  onChange={(e) => updateElementProp(selectedElement.id, { content: e.target.value })}
                  className="w-full p-2 text-xs rounded-lg bg-surface-container-low dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none"
                  placeholder="Texto o {{nombre}}, {{curso}}..."
                />

                {/* Formats: Bold, Italic, Underline, Strikethrough */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateElementProp(selectedElement.id, { fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold' })}
                    className={`p-1.5 rounded text-xs font-bold ${selectedElement.fontWeight === 'bold' ? 'bg-primary text-on-primary' : 'bg-surface-container-low dark:bg-slate-900'}`}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElementProp(selectedElement.id, { fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic' })}
                    className={`p-1.5 rounded text-xs italic ${selectedElement.fontStyle === 'italic' ? 'bg-primary text-on-primary' : 'bg-surface-container-low dark:bg-slate-900'}`}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElementProp(selectedElement.id, { textDecoration: selectedElement.textDecoration === 'underline' ? 'none' : 'underline' })}
                    className={`p-1.5 rounded text-xs underline ${selectedElement.textDecoration === 'underline' ? 'bg-primary text-on-primary' : 'bg-surface-container-low dark:bg-slate-900'}`}
                  >
                    U
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElementProp(selectedElement.id, { textDecoration: selectedElement.textDecoration === 'line-through' ? 'none' : 'line-through' })}
                    className={`p-1.5 rounded text-xs line-through ${selectedElement.textDecoration === 'line-through' ? 'bg-primary text-on-primary' : 'bg-surface-container-low dark:bg-slate-900'}`}
                  >
                    S
                  </button>

                  <div className="h-4 w-px bg-outline-variant/30 mx-1" />

                  {/* Alignment */}
                  <button
                    type="button"
                    onClick={() => updateElementProp(selectedElement.id, { textAlign: 'left' })}
                    className={`p-1.5 rounded text-[11px] ${selectedElement.textAlign === 'left' ? 'bg-primary text-on-primary' : 'bg-surface-container-low dark:bg-slate-900'}`}
                  >
                    Izq
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElementProp(selectedElement.id, { textAlign: 'center' })}
                    className={`p-1.5 rounded text-[11px] ${selectedElement.textAlign === 'center' ? 'bg-primary text-on-primary' : 'bg-surface-container-low dark:bg-slate-900'}`}
                  >
                    Cen
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElementProp(selectedElement.id, { textAlign: 'right' })}
                    className={`p-1.5 rounded text-[11px] ${selectedElement.textAlign === 'right' ? 'bg-primary text-on-primary' : 'bg-surface-container-low dark:bg-slate-900'}`}
                  >
                    Der
                  </button>
                </div>

                {/* Font Size & Color */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-on-surface-variant block mb-1">Tamaño (px)</label>
                    <input
                      type="number"
                      min={10}
                      max={72}
                      value={selectedElement.fontSize || 18}
                      onChange={(e) => updateElementProp(selectedElement.id, { fontSize: parseInt(e.target.value, 10) })}
                      className="w-full px-2 py-1 rounded bg-surface-container-low dark:bg-slate-900 border border-outline-variant/30 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-on-surface-variant block mb-1">Color</label>
                    <input
                      type="color"
                      value={selectedElement.color || '#131b2e'}
                      onChange={(e) => updateElementProp(selectedElement.id, { color: e.target.value })}
                      className="w-full h-7 rounded cursor-pointer bg-transparent border-0"
                    />
                  </div>
                </div>

                {/* Placeholders chips */}
                <div className="space-y-1">
                  <span className="text-[10px] text-outline block">Variables automáticas:</span>
                  <div className="flex flex-wrap gap-1">
                    {['{{nombre}}', '{{curso}}', '{{codigo}}', '{{fecha}}', '{{horas}}'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => updateElementProp(selectedElement.id, { content: `${selectedElement.content} ${tag}` })}
                        className="px-1.5 py-0.5 rounded bg-surface-container-high dark:bg-slate-800 text-[10px] font-mono hover:text-primary"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </aside>

          {/* Interactive Certificate Canvas Stage */}
          <main
            ref={canvasRef}
            onMouseMove={handleMouseMoveCanvas}
            onMouseUp={handleMouseUpCanvas}
            className="flex-1 overflow-auto bg-surface-container/60 dark:bg-slate-950 p-6 md:p-8 flex justify-center items-start select-none"
          >
            <div
              onClick={() => setSelectedElementId(null)}
              style={{
                width: `${activeTemplate.width}px`,
                height: `${activeTemplate.height}px`,
                backgroundImage: activeTemplate.backgroundImage ? `url(${activeTemplate.backgroundImage})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              className="relative rounded-2xl shadow-2xl border-2 border-outline-variant/50 dark:border-slate-800 bg-surface-container-lowest overflow-hidden transition-all shrink-0"
            >
              {/* Default ornate border if no custom image */}
              {!activeTemplate.backgroundImage && (
                <div className="absolute inset-4 border-2 border-primary/20 pointer-events-none rounded-xl">
                  <div className="absolute inset-2 border border-secondary/20 rounded-lg" />
                </div>
              )}

              {/* Render Canvas Elements */}
              {activeTemplate.elements.map((elem) => {
                const isSelected = selectedElementId === elem.id;

                let displayText = elem.content || '';
                if (elem.type === 'text') {
                  displayText = displayText
                    .replace(/\{\{\s*nombre\s*\}\}/gi, 'JUAN CARLOS PÉREZ MENDOZA')
                    .replace(/\{\{\s*curso\s*\}\}/gi, activeTemplate.courseTitle)
                    .replace(/\{\{\s*codigo\s*\}\}/gi, 'DIPL-2026-A89F')
                    .replace(/\{\{\s*fecha\s*\}\}/gi, new Date().toLocaleDateString('es-ES'))
                    .replace(/\{\{\s*horas\s*\}\}/gi, `${activeTemplate.hours} horas académicas`);
                }

                return (
                  <div
                    key={elem.id}
                    onMouseDown={(e) => handleMouseDownElem(e, elem.id)}
                    style={{
                      position: 'absolute',
                      left: `${elem.x}px`,
                      top: `${elem.y}px`,
                      width: elem.width ? `${elem.width}px` : 'auto',
                      color: elem.color || '#131b2e',
                      fontSize: `${elem.fontSize || 16}px`,
                      fontWeight: elem.fontWeight || 'normal',
                      fontStyle: elem.fontStyle || 'normal',
                      textDecoration: elem.textDecoration || 'none',
                      textAlign: elem.textAlign || 'left',
                    }}
                    className={`cursor-move p-1 transition-all rounded ${
                      isSelected
                        ? 'ring-2 ring-primary ring-offset-1 ring-offset-white dark:ring-offset-slate-900 bg-primary/5'
                        : 'hover:ring-1 hover:ring-outline-variant/60'
                    }`}
                  >
                    {elem.type === 'text' && <span>{displayText}</span>}

                    {elem.type === 'qr' && (
                      <div className="p-2 bg-white rounded-lg border border-outline-variant/30 flex flex-col items-center justify-center text-center shadow-sm">
                        <QrCode className="w-16 h-16 text-primary" />
                        <span className="text-[9px] font-mono text-slate-700 font-bold mt-1">CÓDIGO QR ÚNICO</span>
                        <span className="text-[8px] text-slate-500">Escaneo de Autenticidad</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      )}

      {/* 2. EMISSIONS RECORDS SUB-VIEW */}
      {activeSubTab === 'emissions' && (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-headline font-bold text-on-surface">Certificados Emitidos ({emissions.length})</h2>
              <p className="text-xs text-on-surface-variant">Registro histórico de estudiantes con código QR y validación individual</p>
            </div>
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-surface-tint shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Emisión Masiva</span>
            </button>
          </div>

          <div className="border border-outline-variant/30 dark:border-slate-800 rounded-2xl overflow-hidden bg-surface-container-lowest dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low dark:bg-slate-950 border-b border-outline-variant/20 dark:border-slate-800 text-on-surface-variant font-semibold">
                <tr>
                  <th className="py-3 px-4">Código Único</th>
                  <th className="py-3 px-4">Estudiante</th>
                  <th className="py-3 px-4">Contacto (Email / WhatsApp)</th>
                  <th className="py-3 px-4">Curso / Programa</th>
                  <th className="py-3 px-4">Fecha Emisión</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 dark:divide-slate-800">
                {emissions.map((rec) => (
                  <tr key={rec.id} className="hover:bg-surface-container-high/30 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary">{rec.code}</td>
                    <td className="py-3 px-4 font-semibold text-on-surface">{rec.recipientName}</td>
                    <td className="py-3 px-4 text-on-surface-variant">
                      <div>{rec.recipientEmail || '—'}</div>
                      <div className="text-[10px] text-outline">{rec.recipientPhone || ''}</div>
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant">{rec.courseTitle}</td>
                    <td className="py-3 px-4 text-outline">{rec.date}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadSinglePdf(rec)}
                        title="Descargar PDF con QR"
                        className="p-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVerifyCode(rec.code);
                          setVerificationResult(rec);
                          setActiveSubTab('verify');
                        }}
                        title="Ver en Validador"
                        className="p-1.5 rounded-lg border border-secondary/30 text-secondary hover:bg-secondary/10 transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteCertEmission(rec.id);
                          refreshEmissions();
                          showToast('Registro eliminado', 'info');
                        }}
                        title="Eliminar registro"
                        className="p-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. STUDENT REGISTRATION FORM (Anti-duplicidad y Edición) */}
      {activeSubTab === 'form' && (
        <div className="flex-1 overflow-y-auto p-6 md:p-12 max-w-xl mx-auto w-full space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-headline font-bold text-on-surface">Formulario de Emisión de Certificado</h2>
            <p className="text-xs text-on-surface-variant">
              Completa tus datos para emitir tu certificado con código QR único. Si ya lo solicitaste antes, podrás actualizar tu información.
            </p>
          </div>

          <form onSubmit={handleStudentFormSubmit} className="p-6 rounded-2xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800 shadow-xl space-y-4">
            {existingRecordNotice && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">Certificado existente detectado ({existingRecordNotice.code})</span>
                  <p>Modifica el nombre o datos a continuación y presiona guardar para actualizar tu certificado con los datos editados.</p>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-on-surface block mb-1">Curso o Programa a Certificar:</label>
              <select
                value={studentForm.courseId}
                onChange={(e) => setStudentForm({ ...studentForm, courseId: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-surface-container-low dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface font-medium outline-none"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.courseTitle} ({t.hours} hrs)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-on-surface block mb-1">Nombres y Apellidos Completos:</label>
              <input
                type="text"
                required
                placeholder="Ej: Lic. María Elena Quispe Flores"
                value={studentForm.name}
                onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-surface-container-low dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-on-surface block mb-1">Correo Electrónico:</label>
              <input
                type="email"
                required
                placeholder="maria.quispe@ejemplo.com"
                value={studentForm.email}
                onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-surface-container-low dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-on-surface block mb-1">Número de WhatsApp / Celular:</label>
              <input
                type="tel"
                placeholder="+51 987 654 321"
                value={studentForm.phone}
                onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-surface-container-low dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-surface-tint shadow-md shadow-primary/20 transition-all active:scale-[0.98] mt-2"
            >
              {existingRecordNotice ? 'Actualizar y Re-emitir Certificado' : 'Generar y Emitir Mi Certificado'}
            </button>
          </form>
        </div>
      )}

      {/* 4. VERIFICATION PAGE SUB-VIEW */}
      {activeSubTab === 'verify' && (
        <div className="flex-1 overflow-y-auto p-6 md:p-12 max-w-2xl mx-auto w-full space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-headline font-bold text-on-surface">Portal de Verificación y Re-descarga de Certificados</h2>
            <p className="text-xs text-on-surface-variant">
              Valida la autenticidad del código QR o busca por ID para verificar vigencia y descargar el PDF oficial.
            </p>
          </div>

          <div className="flex gap-2 p-2 rounded-2xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800 shadow-md">
            <input
              type="text"
              placeholder="Ingresa el código (ej: DIPL-2026-X789 o escanéalo con tu cámara)"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
              className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-transparent text-on-surface font-mono font-bold outline-none uppercase"
            />
            <button
              type="button"
              onClick={handleVerifySearch}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-surface-tint shadow-sm transition-all"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Verificar</span>
            </button>
          </div>

          {/* Verification Result Card */}
          {verificationResult && (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-on-surface space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Certificado Oficial Válido y Auténtico</span>
                </div>
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                  {verificationResult.code}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-surface-container-lowest/80 dark:bg-slate-900/80 p-4 rounded-xl border border-outline-variant/20 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-outline block">Estudiante:</span>
                  <span className="font-bold text-on-surface text-sm">{verificationResult.recipientName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-outline block">Programa / Curso:</span>
                  <span className="font-semibold text-on-surface">{verificationResult.courseTitle}</span>
                </div>
                <div>
                  <span className="text-[10px] text-outline block">Horas Acreditadas:</span>
                  <span>{verificationResult.hours || 120} horas</span>
                </div>
                <div>
                  <span className="text-[10px] text-outline block">Fecha de Emisión:</span>
                  <span>{verificationResult.date}</span>
                </div>
                {verificationResult.editCount > 0 && (
                  <div className="col-span-2 text-[10px] text-primary">
                    • Este certificado fue actualizado {verificationResult.editCount} vez/veces por el titular.
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleDownloadSinglePdf(verificationResult)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-surface-tint shadow-md transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Volver a Descargar Certificado (PDF)</span>
                </button>
              </div>
            </div>
          )}

          {verificationResult === false && (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs text-center space-y-1">
              <span className="font-bold text-sm block">Código no encontrado</span>
              <p>El código ingresado no corresponde a ningún certificado registrado en la base de datos oficial.</p>
            </div>
          )}
        </div>
      )}

      {/* BULK IMPORT MODAL */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Generador Masivo de Certificados (Excel o Pegado Directo)"
        subtitle="Emite certificados con código QR individualizado para decenas o cientos de estudiantes en segundos"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5">
          {/* Option A: Upload Excel (.xlsx, .xls) */}
          <div className="p-4 rounded-xl bg-surface-container-low dark:bg-slate-950/60 border border-outline-variant/30 dark:border-slate-800 space-y-2">
            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              Opción 1: Cargar Archivo Excel (.xlsx / .csv)
            </span>
            <p className="text-[11px] text-outline">
              El archivo debe incluir las columnas: <strong>Nombre Completo</strong>, <strong>Email</strong> (opcional), <strong>WhatsApp</strong> (opcional).
            </p>
            <label className="flex items-center justify-center gap-2 w-full py-3 px-4 border-2 border-dashed border-emerald-500/40 rounded-xl cursor-pointer hover:bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400 transition-colors">
              <Upload className="w-4 h-4" />
              <span>Examinar archivo Excel</span>
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUploadExcel} className="hidden" />
            </label>
          </div>

          {/* Option B: Direct Copy-Paste from Excel */}
          <div className="p-4 rounded-xl bg-surface-container-low dark:bg-slate-950/60 border border-outline-variant/30 dark:border-slate-800 space-y-2">
            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <Copy className="w-4 h-4 text-primary" />
              Opción 2: Copiar y Pegar Celdas de Excel
            </span>
            <textarea
              rows={4}
              value={bulkDataText}
              onChange={(e) => setBulkDataText(e.target.value)}
              placeholder="Pega aquí directamente las celdas copiadas de Excel (Nombre [Tab] Email [Tab] WhatsApp)"
              className="w-full p-2.5 text-xs rounded-xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800 text-on-surface font-mono outline-none"
            />
            <button
              type="button"
              onClick={handleProcessPastedData}
              className="w-full py-2 px-4 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-surface-tint shadow-sm transition-all"
            >
              Procesar y Emitir Certificados Pegados
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-outline-variant/30 dark:border-slate-800 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
