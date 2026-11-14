import { 
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
  WidthType, HeadingLevel, AlignmentType, BorderStyle 
} from 'docx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PRIMARY_FONT = 'Plus Jakarta Sans';
const BODY_FONT = 'Inter';

/**
 * Export Rubric & Evaluation to Microsoft Word (.docx) with official readable typography
 */
export async function exportRubricToWord(rubric) {
  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 6, color: 'C3C6D7' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C3C6D7' },
    left: { style: BorderStyle.SINGLE, size: 6, color: 'C3C6D7' },
    right: { style: BorderStyle.SINGLE, size: 6, color: 'C3C6D7' },
  };

  const createCell = (text, isHeader = false, widthPercent = 20) => {
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      shading: isHeader ? { fill: 'EAEDFF' } : undefined,
      borders: tableBorder,
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      children: [
        new Paragraph({
          alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { after: 60, before: 30 },
          children: [
            new TextRun({
              text: String(text || ''),
              bold: isHeader,
              size: isHeader ? 21 : 20, // 10.5pt / 10pt
              font: isHeader ? PRIMARY_FONT : BODY_FONT,
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
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: `${idx + 1}. ${q.enunciado || 'Pregunta de evaluación'}`,
            bold: true,
            size: 21,
            font: PRIMARY_FONT,
            color: '131B2E',
          }),
        ],
      })
    );
    (q.opciones || []).forEach((opt, oIdx) => {
      const letter = String.fromCharCode(65 + oIdx);
      examParagraphs.push(
        new Paragraph({
          spacing: { after: 50 },
          children: [
            new TextRun({
              text: `   (${letter}) ${opt}`,
              size: 20,
              font: BODY_FONT,
              color: '434655',
            }),
          ],
        })
      );
    });
  });

  const sections = [
    {
      properties: {
        page: {
          margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: `INSTRUMENTO DE EVALUACIÓN: ${rubric.titulo || 'Rúbrica Analítica'}`,
              bold: true,
              size: 26,
              font: PRIMARY_FONT,
              color: '004AC6',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 260 },
          children: [
            new TextRun({
              text: `Área: ${rubric.area || ''}  |  Grado: ${rubric.grado || ''}  |  Competencia: ${rubric.competencia || ''}`,
              size: 20,
              font: PRIMARY_FONT,
              color: '737686',
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 200, after: 140 },
          children: [
            new TextRun({
              text: 'I. MATRIZ DE RÚBRICA ANALÍTICA DE EVALUACIÓN',
              bold: true,
              size: 22,
              font: PRIMARY_FONT,
              color: '004AC6',
            }),
          ],
        }),
        rubricTable,
        new Paragraph({
          spacing: { before: 320, after: 140 },
          children: [
            new TextRun({
              text: 'II. PRUEBA DE EVALUACIÓN COGNITIVA Y FORMATIVA',
              bold: true,
              size: 22,
              font: PRIMARY_FONT,
              color: '004AC6',
            }),
          ],
        }),
        ...examParagraphs,
      ],
    },
  ];

  const doc = new Document({ sections });
  return await Packer.toBlob(doc);
}

/**
 * Export Rubric & Evaluation to PDF using official 10pt / 11pt readable typography and autoTable
 */
export function exportRubricToPdf(rubric) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 36;

  // Title Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 74, 198);
  const titleText = `RÚBRICA Y EVALUACIÓN CNEB: ${rubric.titulo || 'Sin Título'}`;
  const wrappedTitle = doc.splitTextToSize(titleText, contentWidth);
  doc.text(wrappedTitle, margin, currentY);
  currentY += wrappedTitle.length * 17 + 4;

  // Subtitle
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(115, 118, 134);
  const subtitleText = `Área: ${rubric.area || ''}  |  Grado: ${rubric.grado || ''}  |  Competencia: ${rubric.competencia || ''}`;
  const wrappedSubtitle = doc.splitTextToSize(subtitleText, contentWidth);
  doc.text(wrappedSubtitle, margin, currentY);
  currentY += wrappedSubtitle.length * 13 + 16;

  // ----------------------------------------------------
  // I. MATRIZ DE RÚBRICA ANALÍTICA (autoTable structured)
  // ----------------------------------------------------
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 74, 198);
  doc.text('I. CRITERIOS Y NIVELES DE LOGRO CNEB', margin, currentY);
  currentY += 8;

  const tableBody = (rubric.criterios || []).map((c) => [
    c.criterio,
    c.inicio || 'En inicio',
    c.proceso || 'En proceso',
    c.logrado || 'Logrado',
    c.destacado || 'Destacado',
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [
        { content: 'Criterios de Evaluación', styles: { halign: 'left', fillColor: [234, 237, 255], textColor: [0, 74, 198], fontStyle: 'bold', fontSize: 10 } },
        { content: 'Inicio (C)', styles: { halign: 'center', fillColor: [234, 237, 255], textColor: [0, 74, 198], fontStyle: 'bold', fontSize: 9.5 } },
        { content: 'Proceso (B)', styles: { halign: 'center', fillColor: [234, 237, 255], textColor: [0, 74, 198], fontStyle: 'bold', fontSize: 9.5 } },
        { content: 'Logrado (A)', styles: { halign: 'center', fillColor: [234, 237, 255], textColor: [0, 74, 198], fontStyle: 'bold', fontSize: 9.5 } },
        { content: 'Destacado (AD)', styles: { halign: 'center', fillColor: [234, 237, 255], textColor: [0, 74, 198], fontStyle: 'bold', fontSize: 9.5 } },
      ],
    ],
    body: tableBody,
    styles: {
      font: 'Helvetica',
      fontSize: 9.5, // 9.5pt readable official size
      textColor: [19, 27, 46],
      lineColor: [225, 228, 242],
      lineWidth: 0.6,
      cellPadding: 7,
      overflow: 'linebreak',
    },
  });

  currentY = doc.lastAutoTable.finalY + 22;

  // ----------------------------------------------------
  // II. PRUEBA DE EVALUACIÓN PARA ESTUDIANTES
  // ----------------------------------------------------
  if (currentY > 640) {
    doc.addPage();
    currentY = 36;
  }

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(0, 74, 198);
  doc.text('II. PRUEBA DE EVALUACIÓN PARA ESTUDIANTES', margin, currentY);
  currentY += 14;

  (rubric.preguntasEvaluacion || []).forEach((q, idx) => {
    if (currentY > 740) {
      doc.addPage();
      currentY = 36;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5); // Official 10.5pt question text
    doc.setTextColor(19, 27, 46);
    const qLines = doc.splitTextToSize(`${idx + 1}. ${q.enunciado || ''}`, contentWidth);
    doc.text(qLines, margin, currentY);
    currentY += qLines.length * 14 + 6;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10); // Official 10pt options text
    (q.opciones || []).forEach((opt, oIdx) => {
      const letter = String.fromCharCode(65 + oIdx);
      const optLines = doc.splitTextToSize(`   ${letter}) ${opt}`, contentWidth - 16);
      doc.text(optLines, margin + 12, currentY);
      currentY += optLines.length * 13 + 4;
    });
    currentY += 8;
  });

  return doc.output('blob');
}
