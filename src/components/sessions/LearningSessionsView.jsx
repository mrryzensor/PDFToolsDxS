import React, { useState } from 'react';
import { 
  GraduationCap, Sparkles, BookOpen, Layers, Download, 
  Trash2, Edit3, Eye, FileText, CheckCircle2, RefreshCw, 
  Plus, Copy, Database, HelpCircle, User
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { 
  CNEB_AREAS, COMPETENCIAS_TRANSVERSALES, ENFOQUES_TRANSVERSALES, 
  GRADOS_EDUCACION 
} from '../../utils/curriculumNacional';
import { 
  getLearningSessions, saveLearningSession, deleteLearningSession, 
  getStoredGeminiKeys, saveRubric 
} from '../../utils/storage';
import { generateContentWithFailover } from '../../utils/geminiService';
import { exportSessionToWord, exportSessionToPdf } from '../../utils/sessionDocxExporter';
import { saveAs } from 'file-saver';

export const LearningSessionsView = ({ onOpenApiKeysModal }) => {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState(() => getLearningSessions());
  const [activeSession, setActiveSession] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Form State for Generator
  const [form, setForm] = useState({
    titulo: '',
    temaOContenido: '',
    area: 'Comunicación',
    grado: '3° Grado de Secundaria',
    seccion: 'A',
    docente: 'Prof. Carlos Mendoza Alvarado',
    institucion: 'I.E. 2084 San Martín de Porres',
    duracion: 90,
    competenciaId: 'com_c2',
    competenciaTransversalId: 'trans_2',
    enfoqueId: 'derechos',
  });

  const refreshSessions = () => {
    setSessions(getLearningSessions());
  };

  const selectedAreaObj = CNEB_AREAS.find((a) => a.name === form.area) || CNEB_AREAS[1];

  // AI Generation with Gemini Failover Service
  const handleGenerateAI = async () => {
    const keys = getStoredGeminiKeys();
    if (!keys || keys.length === 0) {
      showToast('Por favor registra primero tu clave de Gemini API en la barra superior.', 'warning', 5000);
      onOpenApiKeysModal();
      return;
    }

    if (!form.temaOContenido.trim()) {
      showToast('Ingresa un tema o contenido base para la sesión', 'warning');
      return;
    }

    try {
      setIsGenerating(true);
      showToast('Generando sesión pedagógica según el CNEB oficial...', 'info', 4000);

      const compObj = selectedAreaObj.competencias.find((c) => c.id === form.competenciaId) || selectedAreaObj.competencias[0];
      const transObj = COMPETENCIAS_TRANSVERSALES.find((t) => t.id === form.competenciaTransversalId) || COMPETENCIAS_TRANSVERSALES[1];
      const enfObj = ENFOQUES_TRANSVERSALES.find((e) => e.id === form.enfoqueId) || ENFOQUES_TRANSVERSALES[0];

      const prompt = `
Actúa como especialista pedagógico del Ministerio de Educación (MINEDU) de Perú experto en el Currículo Nacional de la Educación Básica (CNEB).
Elabora una Sesión de Aprendizaje oficial de alta calidad técnica estructurada en formato de matriz pedagógica.

DATOS DE LA SESIÓN:
- Tema o Contenido propuesto: "${form.temaOContenido}"
- Título tentativo: "${form.titulo || form.temaOContenido}"
- Área Curricular: ${form.area}
- Grado y Sección: ${form.grado} "${form.seccion}"
- Docente: ${form.docente}
- Institución Educativa: ${form.institucion}
- Duración: ${form.duracion} minutos
- Competencia CNEB: ${compObj.name}
- Capacidades a movilizar: ${compObj.capacidades.join('; ')}
- Competencia Transversal: ${transObj.name}
- Enfoque Transversal: ${enfObj.name}

Debes responder ÚNICAMENTE en formato JSON válido con la siguiente estructura exacta que incluye la Sesión, su Rúbrica Analítica de 4 niveles y su Evaluación de 5 preguntas:
{
  "titulo": "Título motivador y significativo de la sesión",
  "numeroSesion": "01",
  "competencia": "${compObj.name}",
  "capacidades": ${JSON.stringify(compObj.capacidades)},
  "desempenos": "Texto detallado y precisado del desempeño para el grado indicado según CNEB",
  "evidencia": "Evidencia tangible o intangible que producirá el estudiante para demostrar su aprendizaje",
  "criteriosEvaluacion": "Criterios claros observables articulados a las capacidades",
  "instrumentoEvaluacion": "Rúbrica analítica de evaluación",
  "competenciaTransversal": "${transObj.name}",
  "enfoqueTransversal": "${enfObj.name}",
  "actitudesEnfoque": "Actitudes o acciones observables del docente y estudiantes",
  "secuenciaInicio": "Estrategias de motivación, recuperación de saberes previos, conflicto cognitivo y socialización del propósito",
  "tiempoInicio": 15,
  "secuenciaDesarrollo": "Gestión y acompañamiento del desarrollo de las competencias, procesos didácticos específicos del área, actividades individuales y colaborativas",
  "tiempoDesarrollo": 60,
  "secuenciaCierre": "Evaluación formativa, retroalimentación reflexiva, preguntas de metacognición (¿Qué aprendimos hoy? ¿Para qué nos sirve?)",
  "tiempoCierre": 15,
  "recursosMateriales": "Lista detallada de recursos educativos físicos y digitales",
  "rubrica": {
    "titulo": "Rúbrica de Evaluación CNEB: ${form.titulo || form.temaOContenido}",
    "criterios": [
      {
        "criterio": "Criterio 1 alineado a la primera capacidad",
        "inicio": "Desempeño en nivel Inicio (C)",
        "proceso": "Desempeño en nivel Proceso (B)",
        "logrado": "Desempeño en nivel Logro Esperado (A)",
        "destacado": "Desempeño en nivel Logro Destacado (AD)"
      },
      {
        "criterio": "Criterio 2 alineado a la segunda capacidad",
        "inicio": "Desempeño en nivel Inicio (C)",
        "proceso": "Desempeño en nivel Proceso (B)",
        "logrado": "Desempeño en nivel Logro Esperado (A)",
        "destacado": "Desempeño en nivel Logro Destacado (AD)"
      },
      {
        "criterio": "Criterio 3 articulado a la evidencia",
        "inicio": "Desempeño en nivel Inicio (C)",
        "proceso": "Desempeño en nivel Proceso (B)",
        "logrado": "Desempeño en nivel Logro Esperado (A)",
        "destacado": "Desempeño en nivel Logro Destacado (AD)"
      }
    ]
  },
  "evaluacion": [
    {
      "id": "q1",
      "enunciado": "Pregunta 1 contextualizada sobre el aprendizaje de la sesión",
      "opciones": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
      "respuestaCorrecta": 0,
      "explicacion": "Justificación pedagógica de la respuesta"
    },
    {
      "id": "q2",
      "enunciado": "Pregunta 2 de aplicación práctica o análisis",
      "opciones": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
      "respuestaCorrecta": 1,
      "explicacion": "Justificación pedagógica de la respuesta"
    },
    {
      "id": "q3",
      "enunciado": "Pregunta 3 de juicio crítico o resolución",
      "opciones": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
      "respuestaCorrecta": 2,
      "explicacion": "Justificación pedagógica de la respuesta"
    },
    {
      "id": "q4",
      "enunciado": "Pregunta 4 orientada a la evidencia planteada",
      "opciones": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
      "respuestaCorrecta": 0,
      "explicacion": "Justificación pedagógica de la respuesta"
    },
    {
      "id": "q5",
      "enunciado": "Pregunta 5 de síntesis o transferencia",
      "opciones": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
      "respuestaCorrecta": 3,
      "explicacion": "Justificación pedagógica de la respuesta"
    }
  ]
}
`;

      const res = await generateContentWithFailover({
        prompt,
        systemInstruction: 'Eres un asesor pedagógico de alta jerarquía del MINEDU Perú. Genera respuestas estrictamente en JSON válido.',
        responseSchema: true,
      });

      const parsedData = res.parsed || JSON.parse(res.text.replace(/```json/gi, '').replace(/```/g, '').trim());

      const fullSession = {
        ...parsedData,
        id: `ses_${Date.now()}`,
        area: form.area,
        grado: form.grado,
        seccion: form.seccion,
        docente: form.docente,
        institucion: form.institucion,
        duracion: form.duracion,
        fecha: new Date().toLocaleDateString('es-ES'),
        modelUsed: res.modelUsed,
      };

      saveLearningSession(fullSession);

      // Auto-save generated Rubric & Exam to the Rubrics & Exams database
      if (parsedData.rubrica && parsedData.evaluacion) {
        saveRubric({
          id: `rub_${Date.now()}`,
          titulo: parsedData.rubrica.titulo || `Rúbrica y Evaluación: ${fullSession.titulo}`,
          area: form.area,
          grado: form.grado,
          competencia: compObj.name,
          criterios: parsedData.rubrica.criterios || [],
          preguntasEvaluacion: parsedData.evaluacion || [],
          fecha: new Date().toLocaleDateString('es-ES'),
          modelUsed: res.modelUsed,
          linkedSessionId: fullSession.id,
        });
      }

      refreshSessions();
      setActiveSession(fullSession);
      setIsViewModalOpen(true);
      showToast(`¡Sesión, Rúbrica y Examen generados con éxito con ${res.modelUsed}!`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Error de generación: ${err.message}`, 'error', 6000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportDocx = async (session) => {
    try {
      showToast('Generando documento Word...', 'info');
      const blob = await exportSessionToWord(session);
      saveAs(blob, `Sesion_${(session.titulo || 'CNEB').replace(/\s+/g, '_')}.docx`);
      showToast('¡Sesión exportada en formato Word (.docx)!', 'success');
    } catch (err) {
      showToast('Error al exportar Word: ' + err.message, 'error');
    }
  };

  const handleExportPdf = (session) => {
    try {
      showToast('Generando documento PDF...', 'info');
      const blob = exportSessionToPdf(session);
      saveAs(blob, `Sesion_${(session.titulo || 'CNEB').replace(/\s+/g, '_')}.pdf`);
      showToast('¡Sesión exportada en PDF!', 'success');
    } catch (err) {
      showToast('Error al exportar PDF: ' + err.message, 'error');
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-surface text-on-surface">
      {/* Left Column: Form Generator */}
      <aside className="w-full md:w-[460px] bg-surface-container-low dark:bg-slate-900 border-r border-outline-variant/30 dark:border-slate-800 p-6 flex flex-col gap-4 overflow-y-auto shrink-0 select-none">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Generador CNEB con IA
            </h2>
          </div>
          <p className="text-xs text-on-surface-variant">
            Elabora sesiones de aprendizaje estructuradas según el formato oficial del Ministerio de Educación de Perú.
          </p>
        </div>

        {/* Input Fields */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-on-surface block mb-1">Área Curricular:</label>
            <select
              value={form.area}
              onChange={(e) => {
                const newArea = e.target.value;
                const areaObj = CNEB_AREAS.find((a) => a.name === newArea) || CNEB_AREAS[0];
                setForm({
                  ...form,
                  area: newArea,
                  competenciaId: areaObj.competencias[0]?.id || '',
                });
              }}
              className="w-full px-3 py-2 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none"
            >
              {CNEB_AREAS.map((a) => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Competencia CNEB:</label>
            <select
              value={form.competenciaId}
              onChange={(e) => setForm({ ...form, competenciaId: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none"
            >
              {selectedAreaObj.competencias.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Tema / Contenido o Texto Base:</label>
            <textarea
              rows={3}
              required
              placeholder="Escribe el tema (ej: 'El ensayo argumentativo sobre el cambio climático') o pega aquí el contenido a desarrollar..."
              value={form.temaOContenido}
              onChange={(e) => setForm({ ...form, temaOContenido: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-on-surface block mb-1">Grado:</label>
              <select
                value={form.grado}
                onChange={(e) => setForm({ ...form, grado: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none"
              >
                {GRADOS_EDUCACION.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-on-surface block mb-1">Sección:</label>
              <input
                type="text"
                value={form.seccion}
                onChange={(e) => setForm({ ...form, seccion: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-on-surface block mb-1">Docente:</label>
              <input
                type="text"
                value={form.docente}
                onChange={(e) => setForm({ ...form, docente: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none"
              />
            </div>
            <div>
              <label className="font-semibold text-on-surface block mb-1">Duración (min):</label>
              <input
                type="number"
                value={form.duracion}
                onChange={(e) => setForm({ ...form, duracion: parseInt(e.target.value, 10) })}
                className="w-full px-2.5 py-1.5 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Competencia Transversal:</label>
            <select
              value={form.competenciaTransversalId}
              onChange={(e) => setForm({ ...form, competenciaTransversalId: e.target.value })}
              className="w-full px-3 py-1.5 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none"
            >
              {COMPETENCIAS_TRANSVERSALES.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Enfoque Transversal:</label>
            <select
              value={form.enfoqueId}
              onChange={(e) => setForm({ ...form, enfoqueId: e.target.value })}
              className="w-full px-3 py-1.5 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none"
            >
              {ENFOQUES_TRANSVERSALES.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerateAI}
          disabled={isGenerating}
          className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-surface-tint shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] mt-2"
        >
          {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>{isGenerating ? 'Generando Sesión con Gemini...' : 'Elaborar Sesión con IA (CNEB)'}</span>
        </button>
      </aside>

      {/* Right Column: Database of Saved Sessions & Active Preview */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-headline font-bold text-on-surface flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Banco de Sesiones Almacenadas ({sessions.length})
            </h3>
            <p className="text-xs text-on-surface-variant">
              Visualiza, edita o exporta en Word (.docx) y PDF cualquier sesión guardada en tu base de datos local.
            </p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border-2 border-dashed border-outline-variant/40 dark:border-slate-800 text-outline space-y-2">
            <BookOpen className="w-10 h-10 mx-auto text-outline" />
            <p className="font-semibold text-sm text-on-surface">No hay sesiones creadas aún</p>
            <p className="text-xs max-w-md mx-auto">
              Utiliza el formulario de la izquierda con IA para diseñar tu primera sesión alineada al Currículo Nacional.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((ses) => (
              <div
                key={ses.id}
                className="p-5 rounded-2xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                      {ses.area} • {ses.grado}
                    </span>
                    <h4 className="font-bold text-sm text-on-surface line-clamp-1">{ses.titulo}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      deleteLearningSession(ses.id);
                      refreshSessions();
                      showToast('Sesión eliminada de la base de datos', 'info');
                    }}
                    className="p-1 text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                    title="Eliminar sesión"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-on-surface-variant line-clamp-2">
                  <strong>Competencia:</strong> {ses.competencia}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 dark:border-slate-800 text-xs">
                  <span className="text-[11px] text-outline">{ses.docente}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSession(ses);
                        setIsViewModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container-high text-primary"
                      title="Ver plantilla completa"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportDocx(ses)}
                      className="p-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10"
                      title="Descargar en Word (.docx)"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportPdf(ses)}
                      className="p-1.5 rounded-lg border border-secondary/30 text-secondary hover:bg-secondary/10"
                      title="Descargar en PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* FULL SESSION PREVIEW MODAL (Template Matrix format) */}
      {activeSession && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          title={`SESIÓN PEDAGÓGICA CNEB: ${activeSession.titulo}`}
          subtitle={`Plantilla Oficial de Matriz Curricular • ${activeSession.area} (${activeSession.grado})`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6 text-xs text-on-surface">
            {/* Header actions */}
            <div className="flex justify-end gap-2 pb-2 border-b border-outline-variant/20">
              <button
                type="button"
                onClick={() => handleExportDocx(activeSession)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary font-semibold text-xs hover:bg-surface-tint"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Exportar Word (.docx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportPdf(activeSession)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/30 hover:bg-surface-container-high text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PDF</span>
              </button>
            </div>

            {/* Matrix Section 1: Datos Informativos */}
            <div>
              <h4 className="font-bold text-primary uppercase tracking-wider mb-2">I. DATOS INFORMATIVOS</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3 rounded-xl bg-surface-container-low dark:bg-slate-950 border border-outline-variant/30">
                <div>
                  <span className="text-[10px] text-outline block">Institución Educativa:</span>
                  <span className="font-semibold">{activeSession.institucion}</span>
                </div>
                <div>
                  <span className="text-[10px] text-outline block">Docente:</span>
                  <span className="font-semibold">{activeSession.docente}</span>
                </div>
                <div>
                  <span className="text-[10px] text-outline block">Grado y Sección:</span>
                  <span className="font-semibold">{activeSession.grado} "{activeSession.seccion}"</span>
                </div>
                <div>
                  <span className="text-[10px] text-outline block">Duración:</span>
                  <span className="font-semibold">{activeSession.duracion} min</span>
                </div>
              </div>
            </div>

            {/* Matrix Section 2: Propósitos y Evidencias */}
            <div>
              <h4 className="font-bold text-primary uppercase tracking-wider mb-2">II. PROPÓSITOS DE APRENDIZAJE</h4>
              <div className="border border-outline-variant/30 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low dark:bg-slate-950 font-bold border-b border-outline-variant/30">
                    <tr>
                      <th className="p-3 w-1/3">Competencias y Capacidades</th>
                      <th className="p-3 w-1/3">Desempeños Precisados</th>
                      <th className="p-3 w-1/3">Criterios de Evaluación y Evidencias</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    <tr>
                      <td className="p-3 align-top space-y-1">
                        <strong className="text-primary block">{activeSession.competencia}</strong>
                        <ul className="list-disc pl-4 space-y-0.5 text-on-surface-variant">
                          {(activeSession.capacidades || []).map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="p-3 align-top leading-relaxed text-on-surface-variant">
                        {activeSession.desempenos}
                      </td>
                      <td className="p-3 align-top space-y-1.5 leading-relaxed">
                        <div>
                          <strong>Evidencia:</strong> {activeSession.evidencia}
                        </div>
                        <div>
                          <strong>Instrumento:</strong> {activeSession.instrumentoEvaluacion}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Matrix Section 3: Secuencia Didáctica */}
            <div>
              <h4 className="font-bold text-primary uppercase tracking-wider mb-2">III. SECUENCIA DIDÁCTICA (MOMENTOS PEDAGÓGICOS)</h4>
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-surface-container-low dark:bg-slate-950 border border-outline-variant/30">
                  <div className="flex justify-between items-center font-bold text-primary mb-1">
                    <span>1. INICIO (Motivación, Saberes Previos, Conflicto Cognitivo, Propósito)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10">{activeSession.tiempoInicio || 15} min</span>
                  </div>
                  <p className="leading-relaxed text-on-surface-variant whitespace-pre-line">{activeSession.secuenciaInicio}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container-low dark:bg-slate-950 border border-outline-variant/30">
                  <div className="flex justify-between items-center font-bold text-primary mb-1">
                    <span>2. DESARROLLO (Gestión, Acompañamiento, Construcción del Aprendizaje)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10">{activeSession.tiempoDesarrollo || 60} min</span>
                  </div>
                  <p className="leading-relaxed text-on-surface-variant whitespace-pre-line">{activeSession.secuenciaDesarrollo}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container-low dark:bg-slate-950 border border-outline-variant/30">
                  <div className="flex justify-between items-center font-bold text-primary mb-1">
                    <span>3. CIERRE (Metacognición, Evaluación Formativa y Transferencia)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10">{activeSession.tiempoCierre || 15} min</span>
                  </div>
                  <p className="leading-relaxed text-on-surface-variant whitespace-pre-line">{activeSession.secuenciaCierre}</p>
                </div>
              </div>
            </div>

            {/* Matrix Section 4: Recursos */}
            <div>
              <h4 className="font-bold text-primary uppercase tracking-wider mb-1">IV. RECURSOS Y MATERIALES</h4>
              <p className="text-on-surface-variant leading-relaxed p-3 rounded-xl bg-surface-container-low dark:bg-slate-950 border border-outline-variant/30">
                {activeSession.recursosMateriales}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
