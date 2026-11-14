import { 
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
  WidthType, HeadingLevel, AlignmentType, BorderStyle, ShadingType 
} from 'docx';
import { jsPDF } from 'jspdf';

/**
 * Export Learning Session to Microsoft Word (.docx) following MINEDU standard format
 */
export async function exportSessionToWord(session) {
  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: '737686' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: '737686' },
    left: { style: BorderStyle.SINGLE, size: 4, color: '737686' },
    right: { style: BorderStyle.SINGLE, size: 4, color: '737686' },
  };

  const createCell = (text, isHeader = false, widthPercent = 25, bold = false) => {
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
              bold: isHeader || bold,
              size: 20,
              font: 'Plus Jakarta Sans',
              color: isHeader ? '004AC6' : '131B2E',
            }),
          ],
        }),
      ],
    });
  };

  const sections = [
    {
      properties: {},
      children: [
        // Title
        new Paragraph({
          text: 'SESIÓN DE APRENDIZAJE N° ' + (session.numeroSesion || '01'),
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 150 },
        }),
        new Paragraph({
          text: `"${session.titulo || 'Título de la sesión'}"`,
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),

        // Section I: Datos Informativos
        new Paragraph({
          text: 'I. DATOS INFORMATIVOS',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 150 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createCell('Institución Educativa:', true, 25),
                createCell(session.institucion || 'I.E. Emblemática', false, 25),
                createCell('Docente:', true, 25),
                createCell(session.docente || 'Docente Responsable', false, 25),
              ],
            }),
            new TableRow({
              children: [
                createCell('Área Curricular:', true, 25),
                createCell(session.area || 'Comunicación', false, 25),
                createCell('Grado y Sección:', true, 25),
                createCell(`${session.grado || '3°'} "${session.seccion || 'A'}"`, false, 25),
              ],
            }),
            new TableRow({
              children: [
                createCell('Duración:', true, 25),
                createCell(`${session.duracion || 90} minutos`, false, 25),
                createCell('Fecha:', true, 25),
                createCell(session.fecha || new Date().toLocaleDateString('es-ES'), false, 25),
              ],
            }),
          ],
        }),

        // Section II: Propósitos de Aprendizaje
        new Paragraph({
          text: 'II. PROPÓSITOS DE APRENDIZAJE Y EVIDENCIAS',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 300, after: 150 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createCell('Competencias y Capacidades', true, 35),
                createCell('Desempeños Precisados', true, 35),
                createCell('Criterios de Evaluación y Evidencias', true, 30),
              ],
            }),
            new TableRow({
              children: [
                createCell(
                  `Competencia: ${session.competencia || ''}\n\nCapacidades:\n• ${(session.capacidades || []).join('\n• ')}`,
                  false,
                  35
                ),
                createCell(session.desempenos || 'Desempeño según el CNEB', false, 35),
                createCell(
                  `Evidencia:\n${session.evidencia || ''}\n\nInstrumento:\n${session.instrumentoEvaluacion || 'Rúbrica de evaluación'}`,
                  false,
                  30
                ),
              ],
            }),
            new TableRow({
              children: [
                createCell('Competencias Transversales', true, 35),
                createCell(session.competenciaTransversal || 'Gestiona su aprendizaje de manera autónoma', false, 65),
              ],
            }),
            new TableRow({
              children: [
                createCell('Enfoque Transversal', true, 35),
                createCell(`${session.enfoqueTransversal || 'Enfoque de Derechos'}: ${session.actitudesEnfoque || 'Disposición a conversar con los demás.'}`, false, 65),
              ],
            }),
          ],
        }),

        // Section III: Secuencia Didáctica
        new Paragraph({
          text: 'III. SECUENCIA DIDÁCTICA / MOMENTOS PEDAGÓGICOS',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 300, after: 150 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createCell('Momento', true, 15),
                createCell('Procesos Pedagógicos y Actividades de Aprendizaje', true, 70),
                createCell('Tiempo', true, 15),
              ],
            }),
            new TableRow({
              children: [
                createCell('INICIO\n(Motivación, Saberes previos, Conflicto cognitivo, Propósito)', true, 15),
                createCell(session.secuenciaInicio || 'Actividades de inicio y motivación...', false, 70),
                createCell(`${session.tiempoInicio || 15} min`, false, 15),
              ],
            }),
            new TableRow({
              children: [
                createCell('DESARROLLO\n(Gestión y Acompañamiento, Construcción del aprendizaje)', true, 15),
                createCell(session.secuenciaDesarrollo || 'Actividades centrales y trabajo en equipo...', false, 70),
                createCell(`${session.tiempoDesarrollo || 60} min`, false, 15),
              ],
            }),
            new TableRow({
              children: [
                createCell('CIERRE\n(Metacognición, Evaluación y Transferencia)', true, 15),
                createCell(session.secuenciaCierre || 'Preguntas de metacognición y retroalimentación...', false, 70),
                createCell(`${session.tiempoCierre || 15} min`, false, 15),
              ],
            }),
          ],
        }),

        // Section IV: Recursos y Materiales
        new Paragraph({
          text: 'IV. RECURSOS Y MATERIALES EDUCATIVOS',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 300, after: 150 },
        }),
        new Paragraph({
          text: session.recursosMateriales || '• Guías de trabajo impresas\n• Pizarra interactiva / plumones\n• Fichas de autoevaluación',
          spacing: { after: 200 },
        }),
      ],
    },
  ];

  const doc = new Document({ sections });
  return await Packer.toBlob(doc);
}

/**
 * Export Learning Session to PDF
 */
export function exportSessionToPdf(session) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const margin = 40;
  let y = 50;

  // Title header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 74, 198); // Sapphire primary
  doc.text(`SESIÓN DE APRENDIZAJE: ${session.titulo || 'Sin Título'}`, margin, y);
  y += 24;

  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(19, 27, 46);
  doc.text(`Área: ${session.area || 'General'}  |  Grado y Sección: ${session.grado || ''} "${session.seccion || ''}"  |  Docente: ${session.docente || ''}`, margin, y);
  y += 18;
  doc.text(`Fecha: ${session.fecha || new Date().toLocaleDateString('es-ES')}  |  Duración: ${session.duracion || 90} min  |  I.E.: ${session.institucion || ''}`, margin, y);
  y += 25;

  doc.setDrawColor(195, 198, 215);
  doc.line(margin, y, 595 - margin, y);
  y += 20;

  // Function to print sections
  const printSection = (title, content) => {
    if (y > 760) {
      doc.addPage();
      y = 50;
    }
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 74, 198);
    doc.text(title, margin, y);
    y += 16;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(19, 27, 46);
    const lines = doc.splitTextToSize(content || '', 595 - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 16;
  };

  printSection('I. PROPÓSITOS Y EVIDENCIAS DE APRENDIZAJE', 
    `Competencia: ${session.competencia || ''}\nCapacidades: ${(session.capacidades || []).join(', ')}\nDesempeños: ${session.desempenos || ''}\nEvidencia de Aprendizaje: ${session.evidencia || ''}\nInstrumento: ${session.instrumentoEvaluacion || 'Rúbrica'}`
  );

  printSection('II. COMPETENCIAS Y ENFOQUES TRANSVERSALES',
    `Competencia Transversal: ${session.competenciaTransversal || 'Autonomía en el aprendizaje'}\nEnfoque Transversal: ${session.enfoqueTransversal || 'Enfoque de Derechos'} (${session.actitudesEnfoque || ''})`
  );

  printSection('III. SECUENCIA DIDÁCTICA (INICIO - DESARROLLO - CIERRE)',
    `[INICIO - ${session.tiempoInicio || 15} min]:\n${session.secuenciaInicio || ''}\n\n[DESARROLLO - ${session.tiempoDesarrollo || 60} min]:\n${session.secuenciaDesarrollo || ''}\n\n[CIERRE - ${session.tiempoCierre || 15} min]:\n${session.secuenciaCierre || ''}`
  );

  printSection('IV. MATERIALES Y RECURSOS', session.recursosMateriales || 'Guías de aprendizaje, recursos multimedia.');

  return doc.output('blob');
}
