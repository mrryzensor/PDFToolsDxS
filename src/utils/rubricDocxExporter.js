import { 
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
  WidthType, HeadingLevel, AlignmentType, BorderStyle 
} from 'docx';
import { jsPDF } from 'jspdf';

/**
 * Export Rubric & Evaluation to Microsoft Word (.docx)
 */
export async function exportRubricToWord(rubric) {
  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: '737686' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: '737686' },
    left: { style: BorderStyle.SINGLE, size: 4, color: '737686' },
    right: { style: BorderStyle.SINGLE, size: 4, color: '737686' },
  };

  const createCell = (text, isHeader = false, widthPercent = 20) => {
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      shading: isHeader ? { fill: 'EAEDFF' } : undefined,
      borders: tableBorder,
      children: [
        new Paragraph({
          alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [
            new TextRun({
              text: String(text || ''),
              bold: isHeader,
              size: 19,
              font: 'Plus Jakarta Sans',
              color: isHeader ? '004AC6' : '131B2E',
            }),
          ],
        }),
      ],
    });
  };

  // Build Rubric Matrix Rows
  const criteriaRows = (rubric.criterios || []).map((c) => {
    return new TableRow({
      children: [
        createCell(c.criterio, false, 28),
        createCell(c.inicio || 'En inicio', false, 18),
        createCell(c.proceso || 'En proceso', false, 18),
        createCell(c.logrado || 'Logrado', false, 18),
        createCell(c.destacado || 'Destacado', false, 18),
      ],
    });
  });

  const rubricTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createCell('Criterios de Evaluación', true, 28),
          createCell('En Inicio (C)', true, 18),
          createCell('En Proceso (B)', true, 18),
          createCell('Logro Esperado (A)', true, 18),
          createCell('Logro Destacado (AD)', true, 18),
        ],
      }),
      ...criteriaRows,
    ],
  });

  // Build Questions for Exam
  const examParagraphs = [];
  (rubric.preguntasEvaluacion || []).forEach((q, idx) => {
    examParagraphs.push(
      new Paragraph({
        text: `${idx + 1}. ${q.enunciado || 'Pregunta de evaluación'}`,
        heading: HeadingLevel.HEADING_4,
        spacing: { before: 180, after: 80 },
      })
    );
    (q.opciones || []).forEach((opt, oIdx) => {
      const letter = String.fromCharCode(65 + oIdx);
      examParagraphs.push(
        new Paragraph({
          text: `   (${letter}) ${opt}`,
          spacing: { after: 40 },
        })
      );
    });
  });

  const sections = [
    {
      properties: {},
      children: [
        new Paragraph({
          text: `INSTRUMENTO DE EVALUACIÓN: ${rubric.titulo || 'Rúbrica Analítica'}`,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 150 },
        }),
        new Paragraph({
          text: `Área: ${rubric.area || ''}  |  Competencia: ${rubric.competencia || ''}  |  Grado: ${rubric.grado || ''}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
        new Paragraph({
          text: 'I. MATRIZ DE RÚBRICA ANALÍTICA DE DESEMPEÑO',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 150, after: 120 },
        }),
        rubricTable,
        new Paragraph({
          text: 'II. PRUEBA / CUESTIONARIO DE EVALUACIÓN DE LOS APRENDIZAJES',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 350, after: 150 },
        }),
        ...examParagraphs,
      ],
    },
  ];

  const doc = new Document({ sections });
  return await Packer.toBlob(doc);
}

/**
 * Export Rubric & Evaluation to PDF
 */
export function exportRubricToPdf(rubric) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const margin = 40;
  let y = 50;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 74, 198);
  doc.text(`RÚBRICA Y EVALUACIÓN: ${rubric.titulo || 'Sin Título'}`, margin, y);
  y += 22;

  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(19, 27, 46);
  doc.text(`Área: ${rubric.area || ''}  |  Competencia: ${rubric.competencia || ''}  |  Grado: ${rubric.grado || ''}`, margin, y);
  y += 20;

  doc.setDrawColor(195, 198, 215);
  doc.line(margin, y, 595 - margin, y);
  y += 20;

  // Criteria section
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 74, 198);
  doc.text('I. CRITERIOS Y NIVELES DE LOGRO', margin, y);
  y += 18;

  (rubric.criterios || []).forEach((c, idx) => {
    if (y > 740) {
      doc.addPage();
      y = 50;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 74, 198);
    doc.text(`Criterio ${idx + 1}: ${c.criterio}`, margin, y);
    y += 14;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(19, 27, 46);
    const linesLogrado = doc.splitTextToSize(`• Logro Esperado: ${c.logrado || ''}`, 595 - margin * 2);
    doc.text(linesLogrado, margin + 10, y);
    y += linesLogrado.length * 12 + 4;

    const linesProceso = doc.splitTextToSize(`• En Proceso: ${c.proceso || ''}`, 595 - margin * 2);
    doc.text(linesProceso, margin + 10, y);
    y += linesProceso.length * 12 + 10;
  });

  // Exam section
  if (y > 700) {
    doc.addPage();
    y = 50;
  }

  y += 15;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 74, 198);
  doc.text('II. PRUEBA DE EVALUACIÓN PARA ESTUDIANTES', margin, y);
  y += 20;

  (rubric.preguntasEvaluacion || []).forEach((q, idx) => {
    if (y > 720) {
      doc.addPage();
      y = 50;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(19, 27, 46);
    const qLines = doc.splitTextToSize(`${idx + 1}. ${q.enunciado || ''}`, 595 - margin * 2);
    doc.text(qLines, margin, y);
    y += qLines.length * 13 + 6;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    (q.opciones || []).forEach((opt, oIdx) => {
      const letter = String.fromCharCode(65 + oIdx);
      doc.text(`   ${letter}) ${opt}`, margin + 10, y);
      y += 14;
    });
    y += 10;
  });

  return doc.output('blob');
}
