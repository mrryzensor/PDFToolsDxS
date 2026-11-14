import { 
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
  WidthType, HeadingLevel, AlignmentType, BorderStyle, ShadingType 
} from 'docx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Primary typography used in the DocuCraft Pro UI: Plus Jakarta Sans / Inter
const PRIMARY_FONT = 'Plus Jakarta Sans';
const BODY_FONT = 'Inter';

/**
 * Export Learning Session to Microsoft Word (.docx) following the exact CNEB Matrix visual layout
 */
export async function exportSessionToWord(session) {
  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 6, color: 'C3C6D7' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C3C6D7' },
    left: { style: BorderStyle.SINGLE, size: 6, color: 'C3C6D7' },
    right: { style: BorderStyle.SINGLE, size: 6, color: 'C3C6D7' },
  };

  const createCell = (text, isHeader = false, widthPercent = 25, bold = false, customFill = null) => {
    const lines = String(text || '').split('\n');
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      shading: { fill: customFill || (isHeader ? 'EAEDFF' : 'FFFFFF') },
      borders: tableBorder,
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      children: lines.map((line) => {
        const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
        return new Paragraph({
          alignment: isHeader ? AlignmentType.LEFT : AlignmentType.LEFT,
          spacing: { after: 60, before: 30 },
          children: [
            new TextRun({
              text: line,
              bold: isHeader || bold || (line.includes(':') && line.length < 40),
              size: isHeader ? 19 : 18,
              font: isHeader ? PRIMARY_FONT : BODY_FONT,
              color: isHeader ? '004AC6' : '131B2E',
            }),
          ],
        });
      }),
    });
  };

  const sections = [
    {
      properties: {
        page: {
          margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 },
        },
      },
      children: [
        // Title Header
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: 'SESIÓN DE APRENDIZAJE N° ' + (session.numeroSesion || '01'),
              bold: true,
              size: 26,
              font: PRIMARY_FONT,
              color: '004AC6',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 280 },
          children: [
            new TextRun({
              text: `"${session.titulo || 'Título de la sesión'}"`,
              bold: true,
              italics: true,
              size: 22,
              font: PRIMARY_FONT,
              color: '131B2E',
            }),
          ],
        }),

        // Section I: Datos Informativos
        new Paragraph({
          spacing: { before: 200, after: 120 },
          children: [
            new TextRun({
              text: 'I. DATOS INFORMATIVOS',
              bold: true,
              size: 22,
              font: PRIMARY_FONT,
              color: '004AC6',
            }),
          ],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createCell('Institución Educativa:\n' + (session.institucion || 'I.E. 2084 San Martín de Porres'), false, 25, true, 'F4F6FF'),
                createCell('Docente:\n' + (session.docente || 'Prof. Carlos Mendoza Alvarado'), false, 25, true, 'F4F6FF'),
                createCell('Grado y Sección:\n' + `${session.grado || '3° Grado de Secundaria'} "${session.seccion || 'A'}"`, false, 25, true, 'F4F6FF'),
                createCell('Duración:\n' + `${session.duracion || 90} minutos`, false, 25, true, 'F4F6FF'),
              ],
            }),
          ],
        }),

        // Section II: Propósitos de Aprendizaje
        new Paragraph({
          spacing: { before: 280, after: 120 },
          children: [
            new TextRun({
              text: 'II. PROPÓSITOS DE APRENDIZAJE',
              bold: true,
              size: 22,
              font: PRIMARY_FONT,
              color: '004AC6',
            }),
          ],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createCell('Competencias y Capacidades', true, 34, true, 'EAEDFF'),
                createCell('Desempeños Precisados', true, 33, true, 'EAEDFF'),
                createCell('Criterios de Evaluación y Evidencias', true, 33, true, 'EAEDFF'),
              ],
            }),
            new TableRow({
              children: [
                createCell(
                  `${session.competencia || ''}\n\nCapacidades:\n• ${(session.capacidades || []).join('\n• ')}`,
                  false,
                  34
                ),
                createCell(session.desempenos || '', false, 33),
                createCell(
                  `Evidencia: ${session.evidencia || ''}\n\nInstrumento: ${session.instrumentoEvaluacion || 'Rúbrica analítica de evaluación'}`,
                  false,
                  33
                ),
              ],
            }),
            new TableRow({
              children: [
                createCell('Competencias Transversales', true, 34, true, 'F0F3FF'),
                createCell(session.competenciaTransversal || 'Gestiona su aprendizaje de manera autónoma', false, 66),
              ],
            }),
            new TableRow({
              children: [
                createCell('Enfoque Transversal', true, 34, true, 'F0F3FF'),
                createCell(`${session.enfoqueTransversal || 'Enfoque de Derechos'}: ${session.actitudesEnfoque || 'Disposición a conversar con los demás respetando las diferencias.'}`, false, 66),
              ],
            }),
          ],
        }),

        // Section III: Secuencia Didáctica (Momento Pedagógicos)
        new Paragraph({
          spacing: { before: 280, after: 120 },
          children: [
            new TextRun({
              text: 'III. SECUENCIA DIDÁCTICA (MOMENTOS PEDAGÓGICOS)',
              bold: true,
              size: 22,
              font: PRIMARY_FONT,
              color: '004AC6',
            }),
          ],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createCell('Momento Pedagógico', true, 25, true, 'EAEDFF'),
                createCell('Procesos Didácticos y Actividades de Aprendizaje', true, 65, true, 'EAEDFF'),
                createCell('Tiempo', true, 10, true, 'EAEDFF'),
              ],
            }),
            new TableRow({
              children: [
                createCell('1. INICIO\n(Motivación, Saberes Previos, Conflicto Cognitivo, Propósito)', false, 25, true, 'F4F6FF'),
                createCell(session.secuenciaInicio || '', false, 65),
                createCell(`${session.tiempoInicio || 15} min`, false, 10, true),
              ],
            }),
            new TableRow({
              children: [
                createCell('2. DESARROLLO\n(Gestión y Acompañamiento, Construcción del Aprendizaje)', false, 25, true, 'F4F6FF'),
                createCell(session.secuenciaDesarrollo || '', false, 65),
                createCell(`${session.tiempoDesarrollo || 60} min`, false, 10, true),
              ],
            }),
            new TableRow({
              children: [
                createCell('3. CIERRE\n(Metacognición, Evaluación Formativa y Transferencia)', false, 25, true, 'F4F6FF'),
                createCell(session.secuenciaCierre || '', false, 65),
                createCell(`${session.tiempoCierre || 15} min`, false, 10, true),
              ],
            }),
          ],
        }),

        // Section IV: Recursos y Materiales
        new Paragraph({
          spacing: { before: 280, after: 120 },
          children: [
            new TextRun({
              text: 'IV. RECURSOS Y MATERIALES',
              bold: true,
              size: 22,
              font: PRIMARY_FONT,
              color: '004AC6',
            }),
          ],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createCell(session.recursosMateriales || '• Guías de aprendizaje\n• Fichas de lectura estructuradas\n• Cuaderno de trabajo MINEDU', false, 100),
              ],
            }),
          ],
        }),
      ],
    },
  ];

  const doc = new Document({ sections });
  return await Packer.toBlob(doc);
}

/**
 * Export Learning Session to PDF rendering exact tables and visual structure matching the UI matrix
 */
export function exportSessionToPdf(session) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  let currentY = 40;

  // Header Title with Sapphire Primary Color
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 74, 198); // #004ac6
  doc.text(`SESIÓN PEDAGÓGICA CNEB: ${session.titulo || 'Sin Título'}`, margin, currentY);
  currentY += 16;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(115, 118, 134);
  doc.text(`Plantilla Oficial de Matriz Curricular • ${session.area || 'Comunicación'} (${session.grado || ''})`, margin, currentY);
  currentY += 18;

  // ----------------------------------------------------
  // I. DATOS INFORMATIVOS (Rendered as structured card table)
  // ----------------------------------------------------
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 74, 198);
  doc.text('I. DATOS INFORMATIVOS', margin, currentY);
  currentY += 6;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      font: 'Helvetica',
      fontSize: 8.5,
      textColor: [19, 27, 46],
      lineColor: [195, 198, 215],
      lineWidth: 0.5,
      cellPadding: 6,
    },
    body: [
      [
        { content: `Institución Educativa:\n${session.institucion || 'I.E. 2084 San Martín de Porres'}`, styles: { fontStyle: 'bold', fillColor: [244, 246, 255] } },
        { content: `Docente:\n${session.docente || 'Prof. Carlos Mendoza Alvarado'}`, styles: { fontStyle: 'bold', fillColor: [244, 246, 255] } },
        { content: `Grado y Sección:\n${session.grado || '3° Grado de Secundaria'} "${session.seccion || 'A'}"`, styles: { fontStyle: 'bold', fillColor: [244, 246, 255] } },
        { content: `Duración:\n${session.duracion || 90} min`, styles: { fontStyle: 'bold', fillColor: [244, 246, 255] } },
      ],
    ],
  });

  currentY = doc.lastAutoTable.finalY + 16;

  // ----------------------------------------------------
  // II. PROPÓSITOS DE APRENDIZAJE (Table matching UI matrix)
  // ----------------------------------------------------
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 74, 198);
  doc.text('II. PROPÓSITOS DE APRENDIZAJE', margin, currentY);
  currentY += 6;

  const capsList = (session.capacidades || []).map((c) => `• ${c}`).join('\n');
  const compContent = `${session.competencia || ''}\n\n${capsList}`;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [
        { content: 'Competencias y Capacidades', styles: { halign: 'left', fillColor: [234, 237, 255], textColor: [0, 74, 198], fontStyle: 'bold' } },
        { content: 'Desempeños Precisados', styles: { halign: 'left', fillColor: [234, 237, 255], textColor: [0, 74, 198], fontStyle: 'bold' } },
        { content: 'Criterios de Evaluación y Evidencias', styles: { halign: 'left', fillColor: [234, 237, 255], textColor: [0, 74, 198], fontStyle: 'bold' } },
      ],
    ],
    body: [
      [
        { content: compContent, styles: { cellWidth: 175 } },
        { content: session.desempenos || '', styles: { cellWidth: 180 } },
        {
          content: `Evidencia: ${session.evidencia || ''}\n\nInstrumento: ${session.instrumentoEvaluacion || 'Rúbrica analítica de evaluación'}`,
          styles: { cellWidth: 168 },
        },
      ],
      [
        { content: 'Competencias Transversales', styles: { fontStyle: 'bold', fillColor: [244, 246, 255] } },
        { content: session.competenciaTransversal || 'Gestiona su aprendizaje de manera autónoma', colSpan: 2 },
      ],
      [
        { content: 'Enfoques Transversales', styles: { fontStyle: 'bold', fillColor: [244, 246, 255] } },
        { content: `${session.enfoqueTransversal || 'Enfoque de Derechos'}: ${session.actitudesEnfoque || 'Disposición a conversar con los demás respetando las diferencias.'}`, colSpan: 2 },
      ],
    ],
    styles: {
      font: 'Helvetica',
      fontSize: 8,
      textColor: [19, 27, 46],
      lineColor: [195, 198, 215],
      lineWidth: 0.5,
      cellPadding: 6,
      overflow: 'linebreak',
    },
  });

  currentY = doc.lastAutoTable.finalY + 16;

  // Check page overflow
  if (currentY > 680) {
    doc.addPage();
    currentY = 40;
  }

  // ----------------------------------------------------
  // III. SECUENCIA DIDÁCTICA (MOMENTOS PEDAGÓGICOS)
  // ----------------------------------------------------
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 74, 198);
  doc.text('III. SECUENCIA DIDÁCTICA (MOMENTOS PEDAGÓGICOS)', margin, currentY);
  currentY += 6;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [
        { content: 'Momento Pedagógico', styles: { halign: 'left', fillColor: [234, 237, 255], textColor: [0, 74, 198], fontStyle: 'bold', cellWidth: 140 } },
        { content: 'Procesos Didácticos y Actividades de Aprendizaje', styles: { halign: 'left', fillColor: [234, 237, 255], textColor: [0, 74, 198], fontStyle: 'bold' } },
        { content: 'Tiempo', styles: { halign: 'center', fillColor: [234, 237, 255], textColor: [0, 74, 198], fontStyle: 'bold', cellWidth: 50 } },
      ],
    ],
    body: [
      [
        { content: '1. INICIO\n(Motivación, Saberes Previos, Conflicto Cognitivo, Propósito)', styles: { fontStyle: 'bold', fillColor: [244, 246, 255] } },
        { content: session.secuenciaInicio || '' },
        { content: `${session.tiempoInicio || 15} min`, styles: { halign: 'center', fontStyle: 'bold' } },
      ],
      [
        { content: '2. DESARROLLO\n(Gestión y Acompañamiento, Construcción del Aprendizaje)', styles: { fontStyle: 'bold', fillColor: [244, 246, 255] } },
        { content: session.secuenciaDesarrollo || '' },
        { content: `${session.tiempoDesarrollo || 60} min`, styles: { halign: 'center', fontStyle: 'bold' } },
      ],
      [
        { content: '3. CIERRE\n(Metacognición, Evaluación Formativa y Transferencia)', styles: { fontStyle: 'bold', fillColor: [244, 246, 255] } },
        { content: session.secuenciaCierre || '' },
        { content: `${session.tiempoCierre || 15} min`, styles: { halign: 'center', fontStyle: 'bold' } },
      ],
    ],
    styles: {
      font: 'Helvetica',
      fontSize: 8,
      textColor: [19, 27, 46],
      lineColor: [195, 198, 215],
      lineWidth: 0.5,
      cellPadding: 6,
      overflow: 'linebreak',
    },
  });

  currentY = doc.lastAutoTable.finalY + 16;

  if (currentY > 740) {
    doc.addPage();
    currentY = 40;
  }

  // ----------------------------------------------------
  // IV. RECURSOS Y MATERIALES
  // ----------------------------------------------------
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 74, 198);
  doc.text('IV. RECURSOS Y MATERIALES', margin, currentY);
  currentY += 6;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    body: [
      [
        { content: session.recursosMateriales || '• Guías de trabajo y lecturas\n• Pizarra, plumones\n• Fichas de autoevaluación', styles: { cellPadding: 8 } }
      ]
    ],
    styles: {
      font: 'Helvetica',
      fontSize: 8.5,
      textColor: [19, 27, 46],
      lineColor: [195, 198, 215],
      lineWidth: 0.5,
    },
  });

  return doc.output('blob');
}
