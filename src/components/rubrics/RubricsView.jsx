import React, { useState } from 'react';
import { 
  FileCheck2, Sparkles, Download, FileText, CheckCircle2, 
  Trash2, Eye, UserCheck, RefreshCw, PenTool, Award, Clock
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { CNEB_AREAS, GRADOS_EDUCACION } from '../../utils/curriculumNacional';
import { 
  getRubrics, saveRubric, deleteRubric, getExamSubmissions, 
  saveExamSubmission, getStoredGeminiKeys 
} from '../../utils/storage';
import { generateContentWithFailover } from '../../utils/geminiService';
import { exportRubricToWord, exportRubricToPdf } from '../../utils/rubricDocxExporter';
import { saveAs } from 'file-saver';

export const RubricsView = ({ onOpenApiKeysModal }) => {
  const { showToast } = useToast();
  const [rubrics, setRubrics] = useState(() => getRubrics());
  const [activeRubric, setActiveRubric] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Modal states
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);

  // Student taking exam state
  const [studentName, setStudentName] = useState('');
  const [studentAnswers, setStudentAnswers] = useState({});
  const [examSubmittedResult, setExamSubmittedResult] = useState(null);

  // Form State for Generator
  const [form, setForm] = useState({
    titulo: '',
    temaOEvidencia: '',
    area: 'Comunicación',
    grado: '3° Grado de Secundaria',
    competenciaId: 'com_c2',
    cantidadPreguntas: 5,
  });

  const refreshRubrics = () => {
    setRubrics(getRubrics());
  };

  const selectedAreaObj = CNEB_AREAS.find((a) => a.name === form.area) || CNEB_AREAS[1];

  // AI Generator for Rubric + Student Exam
  const handleGenerateAI = async () => {
    const keys = getStoredGeminiKeys();
    if (!keys || keys.length === 0) {
      showToast('Por favor registra primero tu clave de Gemini API en la barra superior.', 'warning', 5000);
      onOpenApiKeysModal();
      return;
    }

    if (!form.temaOEvidencia.trim()) {
      showToast('Ingresa el tema o evidencia para generar la rúbrica', 'warning');
      return;
    }

    try {
      setIsGenerating(true);
      showToast('Diseñando Rúbrica y Evaluación según CNEB con Gemini...', 'info', 4000);

      const compObj = selectedAreaObj.competencias.find((c) => c.id === form.competenciaId) || selectedAreaObj.competencias[0];

      const prompt = `
Actúa como especialista en evaluación formativa del MINEDU Perú bajo el enfoque por competencias del CNEB.
Elabora un Instrumento de Evaluación Integral que contenga:
1. Una RÚBRICA ANALÍTICA detallada con 4 criterios evaluativos y 4 niveles de logro:
   - Inicio (C)
   - En Proceso (B)
   - Logro Esperado (A)
   - Logro Destacado (AD)
2. Una EVALUACIÓN / CUESTIONARIO de ${form.cantidadPreguntas} preguntas de opción múltiple alineadas a la competencia para que los alumnos la resuelvan en línea o en papel.

PARÁMETROS:
- Tema o Evidencia: "${form.temaOEvidencia}"
- Título: "${form.titulo || form.temaOEvidencia}"
- Área Curricular: ${form.area}
- Grado: ${form.grado}
- Competencia CNEB: ${compObj.name}

Devuelve ÚNICAMENTE un JSON válido con la siguiente estructura:
{
  "titulo": "Rúbrica y Prueba: ${form.temaOEvidencia}",
  "criterios": [
    {
      "criterio": "Nombre del criterio (ej: Adecuación y coherencia textual)",
      "inicio": "Descripción del desempeño en nivel Inicio (C)",
      "proceso": "Descripción del desempeño en nivel Proceso (B)",
      "logrado": "Descripción del desempeño en nivel Logro Esperado (A)",
      "destacado": "Descripción del desempeño en nivel Logro Destacado (AD)"
    }
  ],
  "preguntasEvaluacion": [
    {
      "id": "q1",
      "enunciado": "Texto de la pregunta contextualizada en una situación significativa",
      "opciones": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
      "respuestaCorrecta": 0,
      "explicacion": "Breve justificación pedagógica de la respuesta correcta"
    }
  ]
}
`;

      const res = await generateContentWithFailover({
        prompt,
        systemInstruction: 'Eres un evaluador pedagógico experto del MINEDU Perú. Responde únicamente en JSON estructurado.',
        responseSchema: true,
      });

      const parsed = res.parsed || JSON.parse(res.text.replace(/```json/gi, '').replace(/```/g, '').trim());

      const fullRubric = {
        ...parsed,
        id: `rub_${Date.now()}`,
        area: form.area,
        grado: form.grado,
        competencia: compObj.name,
        fecha: new Date().toLocaleDateString('es-ES'),
        modelUsed: res.modelUsed,
      };

      saveRubric(fullRubric);
      refreshRubrics();
      setActiveRubric(fullRubric);
      setIsMatrixModalOpen(true);
      showToast(`¡Rúbrica y evaluación generadas exitosamente con ${res.modelUsed}!`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Error al generar: ${err.message}`, 'error', 6000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportWord = async (r) => {
    try {
      showToast('Generando Word de la Rúbrica...', 'info');
      const blob = await exportRubricToWord(r);
      saveAs(blob, `Rubrica_${(r.titulo || 'CNEB').replace(/\s+/g, '_')}.docx`);
      showToast('¡Rúbrica exportada en Word (.docx)!', 'success');
    } catch (err) {
      showToast('Error al exportar Word: ' + err.message, 'error');
    }
  };

  const handleExportPdf = (r) => {
    try {
      showToast('Generando PDF de la Rúbrica...', 'info');
      const blob = exportRubricToPdf(r);
      saveAs(blob, `Rubrica_${(r.titulo || 'CNEB').replace(/\s+/g, '_')}.pdf`);
      showToast('¡Rúbrica exportada en PDF!', 'success');
    } catch (err) {
      showToast('Error al exportar PDF: ' + err.message, 'error');
    }
  };

  // Student Submits Quiz
  const handleStudentSubmitExam = (e) => {
    e.preventDefault();
    if (!studentName.trim()) {
      showToast('Por favor escribe tu nombre para registrar la evaluación', 'warning');
      return;
    }

    const questions = activeRubric.preguntasEvaluacion || [];
    let correctCount = 0;

    questions.forEach((q, idx) => {
      if (studentAnswers[idx] === q.respuestaCorrecta) {
        correctCount++;
      }
    });

    const score20 = Math.round((correctCount / (questions.length || 1)) * 20);

    const submission = {
      rubricId: activeRubric.id,
      rubricTitle: activeRubric.titulo,
      studentName: studentName.trim(),
      answers: studentAnswers,
      correctCount,
      totalQuestions: questions.length,
      score20,
    };

    saveExamSubmission(submission);
    setExamSubmittedResult(submission);
    showToast(`¡Evaluación completada! Nota obtenida: ${score20} / 20`, 'success', 5000);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-surface text-on-surface">
      {/* Left Column: Generator Form */}
      <aside className="w-full md:w-[440px] bg-surface-container-low dark:bg-slate-900 border-r border-outline-variant/30 dark:border-slate-800 p-6 flex flex-col gap-4 overflow-y-auto shrink-0 select-none">
        <div>
          <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-primary" />
            Rúbricas & Evaluaciones
          </h2>
          <p className="text-xs text-on-surface-variant">
            Diseña rúbricas analíticas con escala MINEDU (C, B, A, AD) y pruebas interactivas para que los alumnos las resuelvan.
          </p>
        </div>

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
            <label className="font-semibold text-on-surface block mb-1">Tema / Evidencia a Evaluar:</label>
            <textarea
              rows={3}
              required
              placeholder="Ej: 'Redacción de un ensayo sobre biodiversidad' o 'Resolución de problemas con ecuaciones cuadráticas'..."
              value={form.temaOEvidencia}
              onChange={(e) => setForm({ ...form, temaOEvidencia: e.target.value })}
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
              <label className="font-semibold text-on-surface block mb-1">Preguntas de la prueba:</label>
              <input
                type="number"
                min={3}
                max={15}
                value={form.cantidadPreguntas}
                onChange={(e) => setForm({ ...form, cantidadPreguntas: parseInt(e.target.value, 10) })}
                className="w-full px-2.5 py-1.5 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 dark:border-slate-800 text-on-surface outline-none"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerateAI}
          disabled={isGenerating}
          className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-surface-tint shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] mt-2"
        >
          {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>{isGenerating ? 'Generando Rúbrica con Gemini...' : 'Elaborar Rúbrica y Prueba con IA'}</span>
        </button>
      </aside>

      {/* Right Column: Database of Saved Rubrics & Interactive Student Exam */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        <div>
          <h3 className="text-xl font-headline font-bold text-on-surface">Rúbricas e Instrumentos Creados ({rubrics.length})</h3>
          <p className="text-xs text-on-surface-variant">
            Descarga en Word/PDF o invita a tus estudiantes a resolver la evaluación interactiva.
          </p>
        </div>

        {rubrics.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border-2 border-dashed border-outline-variant/40 dark:border-slate-800 text-outline space-y-2">
            <FileCheck2 className="w-10 h-10 mx-auto text-outline" />
            <p className="font-semibold text-sm text-on-surface">No hay rúbricas generadas aún</p>
            <p className="text-xs max-w-md mx-auto">
              Diseña tu primera rúbrica analítica y prueba con el asistente de IA para evaluarla de inmediato.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rubrics.map((r) => (
              <div
                key={r.id}
                className="p-5 rounded-2xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                      {r.area} • {r.grado}
                    </span>
                    <h4 className="font-bold text-sm text-on-surface line-clamp-1">{r.titulo}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      deleteRubric(r.id);
                      refreshRubrics();
                      showToast('Rúbrica eliminada', 'info');
                    }}
                    className="p-1 text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-on-surface-variant space-y-1">
                  <p><strong>Criterios analíticos:</strong> {(r.criterios || []).length} dimensiones CNEB</p>
                  <p><strong>Preguntas de evaluación:</strong> {(r.preguntasEvaluacion || []).length} ítems interactivos</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20 dark:border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRubric(r);
                      setStudentAnswers({});
                      setExamSubmittedResult(null);
                      setStudentName('');
                      setIsExamModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-500/20 transition-colors"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Resolver Prueba</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRubric(r);
                        setIsMatrixModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container-high text-primary"
                      title="Ver Matriz de Rúbrica"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportWord(r)}
                      className="p-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10"
                      title="Descargar Word (.docx)"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportPdf(r)}
                      className="p-1.5 rounded-lg border border-secondary/30 text-secondary hover:bg-secondary/10"
                      title="Descargar PDF"
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

      {/* MATRIX MODAL: Preview CNEB Rubric Matrix */}
      {activeRubric && (
        <Modal
          isOpen={isMatrixModalOpen}
          onClose={() => setIsMatrixModalOpen(false)}
          title={`RÚBRICA ANALÍTICA: ${activeRubric.titulo}`}
          subtitle={`${activeRubric.area} (${activeRubric.grado}) • Escala de Desempeño CNEB`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4 text-xs text-on-surface">
            <div className="flex justify-end gap-2 pb-2 border-b border-outline-variant/20">
              <button
                type="button"
                onClick={() => handleExportWord(activeRubric)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary font-semibold text-xs hover:bg-surface-tint"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Exportar Word (.docx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportPdf(activeRubric)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/30 hover:bg-surface-container-high text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PDF</span>
              </button>
            </div>

            <div className="border border-outline-variant/30 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low dark:bg-slate-950 font-bold border-b border-outline-variant/30 text-primary">
                  <tr>
                    <th className="p-3 w-1/4">Criterio de Evaluación</th>
                    <th className="p-3 w-1/5">En Inicio (C)</th>
                    <th className="p-3 w-1/5">En Proceso (B)</th>
                    <th className="p-3 w-1/5">Logro Esperado (A)</th>
                    <th className="p-3 w-1/5">Logro Destacado (AD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-on-surface-variant">
                  {(activeRubric.criterios || []).map((c, i) => (
                    <tr key={i} className="hover:bg-surface-container-high/20">
                      <td className="p-3 font-bold text-on-surface align-top">{c.criterio}</td>
                      <td className="p-3 align-top leading-relaxed">{c.inicio}</td>
                      <td className="p-3 align-top leading-relaxed">{c.proceso}</td>
                      <td className="p-3 align-top leading-relaxed bg-primary/5 font-medium text-on-surface">{c.logrado}</td>
                      <td className="p-3 align-top leading-relaxed bg-amber-500/5">{c.destacado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* STUDENT ONLINE EXAM SOLVER MODAL */}
      {activeRubric && (
        <Modal
          isOpen={isExamModalOpen}
          onClose={() => setIsExamModalOpen(false)}
          title={`EVALUACIÓN EN LÍNEA: ${activeRubric.titulo}`}
          subtitle={`Resolución interactiva para estudiantes con calificación automática inmediata`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-6">
            {!examSubmittedResult ? (
              <form onSubmit={handleStudentSubmitExam} className="space-y-5">
                <div className="p-3.5 rounded-xl bg-surface-container-low dark:bg-slate-950 border border-outline-variant/30 space-y-1.5">
                  <label className="text-xs font-bold text-on-surface block">Nombre completo del Estudiante:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Sofía Valentina Romero Gómez"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/30 text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-4">
                  {(activeRubric.preguntasEvaluacion || []).map((q, qIdx) => (
                    <div
                      key={q.id || qIdx}
                      className="p-4 rounded-xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/30 space-y-3"
                    >
                      <p className="text-xs font-bold text-on-surface leading-relaxed">
                        {qIdx + 1}. {q.enunciado}
                      </p>

                      <div className="space-y-2">
                        {(q.opciones || []).map((opt, oIdx) => {
                          const isSelected = studentAnswers[qIdx] === oIdx;
                          return (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => setStudentAnswers({ ...studentAnswers, [qIdx]: oIdx })}
                              className={`w-full p-2.5 rounded-lg border text-left text-xs flex items-center gap-2.5 transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                                  : 'border-outline-variant/20 hover:border-outline-variant/50 text-on-surface-variant'
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                                isSelected ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant/40'
                              }`}>
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-surface-tint shadow-md transition-all active:scale-[0.98]"
                >
                  Entregar Evaluación y Obtener Calificación
                </button>
              </form>
            ) : (
              <div className="p-6 rounded-2xl bg-surface-container-low dark:bg-slate-950 border border-outline-variant/30 text-center space-y-4 animate-in fade-in">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <Award className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-xl font-headline font-bold text-on-surface">¡Evaluación Calificada!</h4>
                  <p className="text-xs text-on-surface-variant">Estudiante: <strong>{examSubmittedResult.studentName}</strong></p>
                </div>

                <div className="p-4 rounded-xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/20 max-w-xs mx-auto">
                  <span className="text-3xl font-black text-primary block">{examSubmittedResult.score20} / 20</span>
                  <span className="text-[11px] text-outline">
                    Aciertos: {examSubmittedResult.correctCount} de {examSubmittedResult.totalQuestions} preguntas
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setExamSubmittedResult(null)}
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-surface-tint"
                >
                  Resolver de nuevo
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
