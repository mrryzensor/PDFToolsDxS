import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generate official PDF documents for:
 * 1. Constancia de Matrícula / Registro (Students/Clients)
 * 2. Comprobante / Ficha de Caso y Estado
 * 3. Reporte General de Seguimiento (Auditoría / Listado Filtrado)
 */

export function generateConstanciaPDF(record, orgInfo = {}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Decorative border
  doc.setDrawColor(0, 74, 198);
  doc.setLineWidth(1.2);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);
  doc.setDrawColor(195, 198, 215);
  doc.setLineWidth(0.4);
  doc.rect(14, 14, pageWidth - 28, pageHeight - 28);

  // Top header banner
  doc.setFillColor(0, 74, 198);
  doc.rect(14, 14, pageWidth - 28, 22, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text((orgInfo.name || 'DOCUCRAFT GESTIÓN & REGISTROS').toUpperCase(), pageWidth / 2, 23, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('SISTEMA INTEGRADO DE REGISTRO, AVANCE Y SEGUIMIENTO DE CASOS', pageWidth / 2, 29, { align: 'center' });

  // Main Document Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 74, 198);
  doc.text('CONSTANCIA DE REGISTRO Y EXPEDIENTE', pageWidth / 2, 50, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(115, 118, 134);
  doc.text(`Expediente N°: ${record.code || record.id} • Emisión: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`, pageWidth / 2, 57, { align: 'center' });

  // Body content paragraph
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(19, 27, 46);

  const introText = `Por medio de la presente se CERTIFICA que la persona cuyos datos se detallan a continuación se encuentra debidamente inscrita y registrada en el sistema de seguimiento de casos con expediente activo:`;
  const splitIntro = doc.splitTextToSize(introText, pageWidth - 44);
  doc.text(splitIntro, 22, 69);

  // Data table with autoTable
  autoTable(doc, {
    startY: 82,
    margin: { left: 22, right: 22 },
    theme: 'grid',
    headStyles: {
      fillColor: [234, 237, 255],
      textColor: [0, 74, 198],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      textColor: [19, 27, 46],
      fontSize: 10,
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, fillColor: [248, 249, 255] },
      1: { cellWidth: 'auto' },
    },
    body: [
      ['Tipo de Registro', (record.type || 'Persona').toUpperCase()],
      ['Nombre Completo', record.fullName || '—'],
      ['Documento de Identidad', `${record.docType || 'DNI'}: ${record.docNumber || '—'}`],
      ['Correo Electrónico', record.email || '—'],
      ['Teléfono / WhatsApp', record.phone || '—'],
      ['Categoría / Área / Curso', record.category || 'General'],
      ['Estado Actual del Caso', (record.status || 'Nuevo').toUpperCase()],
      ['Porcentaje de Avance', `${record.progress || 0}%`],
      ['Fecha de Registro', record.createdAt ? new Date(record.createdAt).toLocaleDateString('es-ES') : '—'],
      ['Fecha Límite / Próx. Hito', record.dueDate || 'Sin fecha asignada'],
    ],
  });

  let currentY = doc.lastAutoTable.finalY + 8;

  // Notes & Observaciones section
  if (record.description || (record.notes && record.notes.length > 0)) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 74, 198);
    doc.text('RESUMEN DE AVANCES Y OBSERVACIONES TÉCNICAS', 22, currentY);
    currentY += 5;

    const descText = record.description || 'Sin observaciones iniciales.';
    const splitDesc = doc.splitTextToSize(descText, pageWidth - 44);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(70, 75, 90);
    doc.text(splitDesc, 22, currentY);
    currentY += splitDesc.length * 5 + 4;

    if (record.notes && record.notes.length > 0) {
      const recentNotes = record.notes.slice(0, 3).map((n) => [
        n.date ? new Date(n.date).toLocaleDateString('es-ES') : '—',
        n.author || 'Asesor',
        n.text || '',
      ]);

      autoTable(doc, {
        startY: currentY,
        margin: { left: 22, right: 22 },
        theme: 'striped',
        head: [['Fecha', 'Registrado por', 'Bitácora / Anotación de Avance']],
        headStyles: { fillColor: [0, 74, 198], textColor: 255, fontSize: 8.5 },
        bodyStyles: { fontSize: 8.5, cellPadding: 2.5 },
        columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 32 } },
        body: recentNotes,
      });

      currentY = doc.lastAutoTable.finalY + 12;
    }
  } else {
    currentY += 15;
  }

  // Verification & Signatures section
  const signY = pageHeight - 38;
  doc.setDrawColor(180, 185, 200);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 40, signY, pageWidth / 2 + 40, signY);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(19, 27, 46);
  doc.text(orgInfo.responsible || 'Coordinación de Casos y Expedientes', pageWidth / 2, signY + 5, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(115, 118, 134);
  doc.text('Firma y Sello de Autorización Oficial', pageWidth / 2, signY + 9, { align: 'center' });
  doc.text('Documento válido para trámites académicos, comerciales o administrativos.', pageWidth / 2, signY + 14, { align: 'center' });

  // Download trigger
  const fileName = `Constancia_${(record.fullName || 'Persona').replace(/\s+/g, '_')}_${record.code || 'DOC'}.pdf`;
  doc.save(fileName);
  return true;
}

export function generateReporteSeguimientoPDF(records = [], filterTitle = 'General') {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header banner
  doc.setFillColor(0, 74, 198);
  doc.rect(10, 10, pageWidth - 20, 18, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('REPORTE Y PANEL DE SEGUIMIENTO DE REGISTROS Y CASOS', pageWidth / 2, 19, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Filtro: ${filterTitle} • Total Registros: ${records.length} • Fecha: ${new Date().toLocaleString('es-ES')}`, pageWidth / 2, 24, { align: 'center' });

  // Table rows
  const tableData = records.map((r, i) => [
    i + 1,
    r.code || '—',
    r.fullName || '—',
    (r.type || 'Persona').toUpperCase(),
    r.category || 'General',
    `${r.progress || 0}%`,
    (r.status || 'Nuevo').toUpperCase(),
    r.dueDate || '—',
    r.phone || '—',
  ]);

  autoTable(doc, {
    startY: 33,
    margin: { left: 10, right: 10 },
    theme: 'grid',
    head: [['#', 'Código', 'Nombre Completo', 'Tipo', 'Categoría', 'Avance', 'Estado', 'Vence / Hito', 'Contacto']],
    headStyles: {
      fillColor: [0, 74, 198],
      textColor: 255,
      fontSize: 8.5,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 24, fontStyle: 'bold' },
      2: { cellWidth: 60 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 40 },
      5: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 28 },
      7: { halign: 'center', cellWidth: 26 },
      8: { cellWidth: 35 },
    },
    body: tableData,
  });

  const fileName = `Reporte_Seguimiento_${filterTitle.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(fileName);
  return true;
}
