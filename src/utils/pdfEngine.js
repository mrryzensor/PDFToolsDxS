import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType } from 'docx';
import JSZip from 'jszip';

/**
 * Merge multiple PDF file buffers into a single PDF
 */
export async function mergePDFs(fileList) {
  const mergedPdf = await PDFDocument.create();

  for (const file of fileList) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedPdfBytes = await mergedPdf.save();
  return new Blob([mergedPdfBytes], { type: 'application/pdf' });
}

/**
 * Split a PDF into individual pages or page ranges as a ZIP
 */
export async function splitPDF(file, pageRangeString = '') {
  const arrayBuffer = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(arrayBuffer);
  const totalPages = srcPdf.getPageCount();

  const zip = new JSZip();

  let pagesToExtract = [];
  if (!pageRangeString.trim()) {
    pagesToExtract = Array.from({ length: totalPages }, (_, i) => [i]);
  } else {
    const parts = pageRangeString.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(n => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          const range = [];
          for (let p = Math.max(1, start); p <= Math.min(totalPages, end); p++) {
            range.push(p - 1);
          }
          if (range.length > 0) pagesToExtract.push(range);
        }
      } else {
        const p = parseInt(trimmed, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages) {
          pagesToExtract.push([p - 1]);
        }
      }
    }
  }

  if (pagesToExtract.length === 0) {
    pagesToExtract = Array.from({ length: totalPages }, (_, i) => [i]);
  }

  for (let idx = 0; idx < pagesToExtract.length; idx++) {
    const indices = pagesToExtract[idx];
    const subDoc = await PDFDocument.create();
    const copied = await subDoc.copyPages(srcPdf, indices);
    copied.forEach(c => subDoc.addPage(c));
    const subBytes = await subDoc.save();
    
    const fileName = indices.length === 1 
      ? `pagina_${indices[0] + 1}.pdf` 
      : `paginas_${indices[0] + 1}-${indices[indices.length - 1] + 1}.pdf`;
      
    zip.file(fileName, subBytes);
  }

  const zipContent = await zip.generateAsync({ type: 'blob' });
  return zipContent;
}

/**
 * Compress PDF: loads and serializes with object deduplication
 */
export async function compressPDF(file, level = 'balanced') {
  const arrayBuffer = await file.arrayBuffer();
  const originalSize = file.size;

  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
  
  const savedBlob = new Blob([compressedBytes], { type: 'application/pdf' });
  const newSize = savedBlob.size;

  return {
    blob: savedBlob,
    originalSize,
    newSize,
    ratio: Math.max(0, Math.round((1 - (newSize / originalSize)) * 100))
  };
}

/**
 * Export document content to docx (.docx) Word format with accurate formatting, tables & paragraphs
 */
export async function exportToWord(pagesData, docTitle = 'Documento DocuCraft') {
  const sections = pagesData.map(page => {
    const children = [];

    // Sort elements from top to bottom (y position)
    const sortedElements = [...page.elements].sort((a, b) => (a.y || 0) - (b.y || 0));

    for (const elem of sortedElements) {
      if (elem.type === 'text') {
        const isHeading = elem.fontSize && elem.fontSize >= 18;
        const isBold = elem.fontWeight === 'bold' || elem.fontWeight === '700';
        const isItalic = elem.fontStyle === 'italic';

        let alignment = AlignmentType.LEFT;
        if (elem.textAlign === 'center') alignment = AlignmentType.CENTER;
        else if (elem.textAlign === 'right') alignment = AlignmentType.RIGHT;
        else if (elem.textAlign === 'justify') alignment = AlignmentType.JUSTIFIED;

        children.push(
          new Paragraph({
            alignment,
            spacing: { before: isHeading ? 200 : 100, after: isHeading ? 160 : 120 },
            children: [
              new TextRun({
                text: elem.content || '',
                bold: isBold,
                italics: isItalic,
                size: (elem.fontSize || 12) * 2,
                color: elem.color ? elem.color.replace('#', '') : '131B2E',
                font: 'Plus Jakarta Sans',
              }),
            ],
          })
        );
      } else if (elem.type === 'table') {
        const rows = (elem.data || []).map((row, rIdx) => 
          new TableRow({
            children: row.map(cellText => 
              new TableCell({
                width: { size: Math.round(100 / (row.length || 1)), type: WidthType.PERCENTAGE },
                shading: rIdx === 0 && elem.hasHeader ? { fill: 'EAEDFF' } : undefined,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: String(cellText || ''),
                        bold: rIdx === 0 && elem.hasHeader,
                        size: 20,
                        color: rIdx === 0 && elem.hasHeader ? '004AC6' : '131B2E',
                      })
                    ]
                  })
                ],
              })
            )
          })
        );

        if (rows.length > 0) {
          children.push(
            new Table({
              rows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            })
          );
          children.push(new Paragraph({ text: '', spacing: { after: 180 } }));
        }
      } else if (elem.type === 'shape') {
        children.push(
          new Paragraph({
            text: `[Figura Vectorial: ${elem.shapeType || 'Polígono'} - Color: ${elem.fill || '#eaedff'}]`,
            spacing: { before: 100, after: 100 }
          })
        );
      }
    }

    return {
      properties: {},
      children: children.length > 0 ? children : [new Paragraph({ text: 'Página Vacía' })]
    };
  });

  const doc = new Document({
    sections
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

/**
 * Convert images / text / files to a standard PDF
 */
export async function convertToPDF(files) {
  const pdfDoc = await PDFDocument.create();

  for (const file of files) {
    if (file.type.startsWith('image/')) {
      const page = pdfDoc.addPage([595.28, 841.89]);
      const imageBytes = await file.arrayBuffer();
      let embeddedImage;

      if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        embeddedImage = await pdfDoc.embedJpg(imageBytes);
      } else {
        try {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        } catch {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        }
      }

      const { width, height } = embeddedImage.scaleToFit(500, 750);
      page.drawImage(embeddedImage, {
        x: (595.28 - width) / 2,
        y: (841.89 - height) / 2,
        width,
        height,
      });
    } else if (file.type === 'text/plain') {
      const text = await file.text();
      const page = pdfDoc.addPage([595.28, 841.89]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      const lines = text.split('\n').slice(0, 45);
      let yOffset = 800;
      for (const line of lines) {
        page.drawText(line.substring(0, 80), {
          x: 50,
          y: yOffset,
          size: 11,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
        yOffset -= 16;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Helper to split text into wrapped lines for PDF text streaming
 */
function wrapText(text, font, fontSize, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Hex color string (#RRGGBB) to pdf-lib rgb(r, g, b)
 */
function hexToPdfRgb(hex, defaultColor = rgb(0.1, 0.1, 0.18)) {
  if (!hex || typeof hex !== 'string') return defaultColor;
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  return defaultColor;
}

/**
 * Pure Vector Native PDF Export:
 * Real selectable, searchable text, structured native tables, and mathematical SVG vector paths.
 * No canvas or raster screenshot image.
 */
export async function exportEditorToPDF(pagesData, docTitle = 'Documento') {
  const pdfDoc = await PDFDocument.create();

  // Standard Fonts for Selectable Text
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontHelveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  for (const page of pagesData) {
    // A4 Standard Page: 595.28 x 841.89 points
    const pdfPage = pdfDoc.addPage([595.28, 841.89]);
    const { width: pageWidth, height: pageHeight } = pdfPage.getSize();

    // Editor base width is 595, exactly 1:1 scale to A4 points!
    const scale = pageWidth / 595;

    for (const elem of page.elements) {
      const x = (elem.x || 35) * scale;
      const elemW = (elem.width || 525) * scale;
      const elemH = (elem.height || 40) * scale;
      // In PDF, y = 0 is at bottom
      const y = pageHeight - ((elem.y || 40) * scale) - elemH;

      if (elem.type === 'text') {
        const isBold = elem.fontWeight === 'bold' || elem.fontWeight === '700';
        const isItalic = elem.fontStyle === 'italic';
        const font = isBold ? fontHelveticaBold : (isItalic ? fontHelveticaOblique : fontHelvetica);
        const fontSize = Math.max(9, (elem.fontSize || 13) * scale);
        const lineHeight = fontSize * 1.35;
        const textColor = hexToPdfRgb(elem.color, rgb(0.08, 0.1, 0.18));

        const cleanText = (elem.content || '')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .trim();

        if (cleanText) {
          const lines = wrapText(cleanText, font, fontSize, elemW);
          let currentY = pageHeight - ((elem.y || 40) * scale) - fontSize;

          for (const line of lines) {
            let startX = x;
            const lineWidth = font.widthOfTextAtSize(line, fontSize);

            if (elem.textAlign === 'center') {
              startX = x + (elemW - lineWidth) / 2;
            } else if (elem.textAlign === 'right') {
              startX = x + elemW - lineWidth;
            }

            pdfPage.drawText(line, {
              x: Math.max(25, startX),
              y: currentY,
              size: fontSize,
              font,
              color: textColor,
            });

            currentY -= lineHeight;
          }
        }
      } else if (elem.type === 'table') {
        const rows = elem.data || [];
        const numRows = rows.length;
        const numCols = (rows[0] || []).length || 1;
        const colWidth = elemW / numCols;
        const rowHeight = 24 * scale;

        let tableTop = pageHeight - ((elem.y || 220) * scale);

        for (let r = 0; r < numRows; r++) {
          const cellY = tableTop - ((r + 1) * rowHeight);

          for (let c = 0; c < numCols; c++) {
            const cellX = x + (c * colWidth);
            const isHeader = r === 0 && elem.hasHeader;
            const cellText = String(rows[r][c] || '');

            // Cell background
            if (isHeader) {
              pdfPage.drawRectangle({
                x: cellX,
                y: cellY,
                width: colWidth,
                height: rowHeight,
                color: rgb(0.92, 0.94, 1.0),
                borderColor: rgb(0.76, 0.82, 0.95),
                borderWidth: 0.75,
              });
            } else {
              pdfPage.drawRectangle({
                x: cellX,
                y: cellY,
                width: colWidth,
                height: rowHeight,
                borderColor: rgb(0.85, 0.88, 0.94),
                borderWidth: 0.5,
              });
            }

            // Cell text (Searchable & Selectable)
            if (cellText) {
              const font = isHeader ? fontHelveticaBold : fontHelvetica;
              const fSize = Math.max(8, 10 * scale);
              const textW = font.widthOfTextAtSize(cellText, fSize);
              const tX = cellX + Math.max(6, (colWidth - textW) / 2);
              const tY = cellY + (rowHeight - fSize) / 2;

              pdfPage.drawText(cellText, {
                x: tX,
                y: tY,
                size: fSize,
                font,
                color: isHeader ? rgb(0, 0.29, 0.78) : rgb(0.1, 0.12, 0.18),
              });
            }
          }
        }
      } else if (elem.type === 'shape') {
        const fillColor = hexToPdfRgb(elem.fill, rgb(0.9, 0.93, 1));
        const strokeColor = hexToPdfRgb(elem.stroke, rgb(0, 0.29, 0.78));
        
        // drawSvgPath in pdf-lib expects:
        // x, y = top-left of the bounding box where (0,0) in SVG path will be placed.
        const originX = (elem.x || 35) * scale;
        const originY = pageHeight - ((elem.y || 40) * scale); // Top-left anchor in PDF coordinates

        const w = elemW;
        const h = elemH;
        const cx = w / 2;
        const cy = h / 2;

        if (elem.shapeType === 'circle' || elem.shapeType === 'ellipse') {
          pdfPage.drawEllipse({
            x: originX + cx,
            y: originY - cy,
            xScale: w / 2,
            yScale: h / 2,
            color: fillColor,
            borderColor: strokeColor,
            borderWidth: elem.strokeWidth || 1.5,
          });
        } else if (elem.shapeType === 'diamond') { // Rombo vectorial
          // Local SVG coordinates from (0,0) down to (w, h)
          const path = `M ${cx} 0 L ${w} ${cy} L ${cx} ${h} L 0 ${cy} Z`;
          pdfPage.drawSvgPath(path, {
            x: originX,
            y: originY,
            color: fillColor,
            borderColor: strokeColor,
            borderWidth: elem.strokeWidth || 1.5,
          });
        } else if (elem.shapeType === 'arrow-right') { // Flecha horizontal vectorial
          const shaftH = h * 0.45;
          const headW = w * 0.4;
          const shaftY = cy - shaftH / 2;
          const path = `M 0 ${shaftY + shaftH} L ${w - headW} ${shaftY + shaftH} L ${w - headW} ${h} L ${w} ${cy} L ${w - headW} 0 L ${w - headW} ${shaftY} L 0 ${shaftY} Z`;
          pdfPage.drawSvgPath(path, {
            x: originX,
            y: originY,
            color: fillColor,
            borderColor: strokeColor,
            borderWidth: elem.strokeWidth || 1.5,
          });
        } else if (elem.shapeType === 'polygon' || elem.shapeType === 'hexagon') {
          const sides = elem.shapeType === 'hexagon' ? 6 : (elem.sides || 5);
          const r = Math.min(w, h) / 2;
          let pathD = '';
          for (let i = 0; i < sides; i++) {
            const angle = (-Math.PI / 2) + (i * 2 * Math.PI / sides);
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            pathD += (i === 0 ? `M ${px} ${py} ` : `L ${px} ${py} `);
          }
          pathD += 'Z';
          pdfPage.drawSvgPath(pathD, {
            x: originX,
            y: originY,
            color: fillColor,
            borderColor: strokeColor,
            borderWidth: elem.strokeWidth || 1.5,
          });
        } else {
          pdfPage.drawRectangle({
            x: originX,
            y: originY - h,
            width: w,
            height: h,
            color: fillColor,
            borderColor: strokeColor,
            borderWidth: elem.strokeWidth || 1.5,
          });
        }
      } else if (elem.type === 'image' && elem.src) {
        try {
          if (elem.src.startsWith('data:image/jpeg') || elem.src.startsWith('data:image/jpg')) {
            const img = await pdfDoc.embedJpg(elem.src);
            pdfPage.drawImage(img, { x, y, width: elemW, height: elemH });
          } else if (elem.src.startsWith('data:image/png')) {
            const img = await pdfDoc.embedPng(elem.src);
            pdfPage.drawImage(img, { x, y, width: elemW, height: elemH });
          }
        } catch (e) {
          console.warn('Image embed error:', e);
        }
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
