import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generate a high quality DataURL for a QR Code
 */
export async function generateQrDataUrl(text, options = {}) {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      width: options.width || 300,
      margin: options.margin !== undefined ? options.margin : 1,
      color: {
        dark: options.darkColor || '#131b2e',
        light: options.lightColor || '#ffffff',
      },
      errorCorrectionLevel: 'H', // High recovery level
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code:', err);
    return null;
  }
}

/**
 * Render a certificate template with specific student data to a High-Res Canvas/Image
 */
export async function renderCertificateToCanvas(template, studentRecord, verificationUrl) {
  // Create an offscreen DOM element or render directly on canvas
  const width = template.width || 1120; // 1120x792 (~A4 Landscape ratio)
  const height = template.height || 792;

  const canvas = document.createElement('canvas');
  canvas.width = width * 2; // 2x for retina quality
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  // 1. Draw Background Image or Fallback Background
  if (template.backgroundImage) {
    const img = await loadImage(template.backgroundImage);
    ctx.drawImage(img, 0, 0, width, height);
  } else {
    // Elegant default certificate border and parchment background
    ctx.fillStyle = '#faf8ff';
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#004ac6';
    ctx.strokeRect(20, 20, width - 40, height - 40);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#855300';
    ctx.strokeRect(32, 32, width - 64, height - 64);
  }

  // Generate QR Code if needed
  let qrImage = null;
  const qrElement = template.elements.find((el) => el.type === 'qr');
  if (qrElement && verificationUrl) {
    const qrDataUrl = await generateQrDataUrl(verificationUrl, {
      darkColor: qrElement.color || '#131b2e',
      lightColor: '#ffffff',
    });
    if (qrDataUrl) {
      qrImage = await loadImage(qrDataUrl);
    }
  }

  // 2. Render Canvas Elements
  for (const elem of template.elements) {
    ctx.save();

    if (elem.type === 'text') {
      // Substitute placeholders
      let text = elem.content || '';
      text = text.replace(/\{\{\s*nombre\s*\}\}/gi, studentRecord.recipientName || 'NOMBRE DEL ESTUDIANTE');
      text = text.replace(/\{\{\s*curso\s*\}\}/gi, studentRecord.courseTitle || template.courseTitle || 'CURSO O PROGRAMA');
      text = text.replace(/\{\{\s*codigo\s*\}\}/gi, studentRecord.code || 'CERT-0000-00');
      text = text.replace(/\{\{\s*fecha\s*\}\}/gi, studentRecord.date || new Date().toLocaleDateString('es-ES'));
      text = text.replace(/\{\{\s*horas\s*\}\}/gi, `${studentRecord.hours || template.hours || '120'} horas académicas`);
      text = text.replace(/\{\{\s*institucion\s*\}\}/gi, template.institution || 'Dirección de Certificación');

      const fontSize = elem.fontSize || 18;
      const fontWeight = elem.fontWeight === 'bold' ? 'bold' : 'normal';
      const fontStyle = elem.fontStyle === 'italic' ? 'italic' : 'normal';
      const fontFamily = elem.fontFamily || 'Plus Jakarta Sans, Inter, sans-serif';

      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = elem.color || '#131b2e';
      ctx.textAlign = elem.textAlign || 'left';
      ctx.textBaseline = 'top';

      let drawX = elem.x;
      if (elem.textAlign === 'center') {
        drawX = elem.x + (elem.width ? elem.width / 2 : 0);
      } else if (elem.textAlign === 'right') {
        drawX = elem.x + (elem.width || 0);
      }

      ctx.fillText(text, drawX, elem.y);

      // Handle Underline & Strike-through
      if (elem.textDecoration === 'underline' || elem.textDecoration === 'line-through') {
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        let lineX = drawX;
        if (elem.textAlign === 'center') lineX = drawX - textWidth / 2;
        if (elem.textAlign === 'right') lineX = drawX - textWidth;

        ctx.strokeStyle = elem.color || '#131b2e';
        ctx.lineWidth = Math.max(1, fontSize / 14);
        ctx.beginPath();
        const lineY = elem.textDecoration === 'underline' ? elem.y + fontSize + 2 : elem.y + fontSize / 2;
        ctx.moveTo(lineX, lineY);
        ctx.lineTo(lineX + textWidth, lineY);
        ctx.stroke();
      }
    } else if (elem.type === 'qr') {
      const qrW = elem.width || 110;
      const qrH = elem.height || 110;
      const bgColor = elem.bgColor || '#ffffff';
      const frameStyle = elem.frameStyle || 'card';

      // Draw background if not clean
      if (frameStyle !== 'clean') {
        ctx.fillStyle = bgColor;
        ctx.fillRect(elem.x, elem.y, qrW, qrH);

        if (frameStyle === 'border') {
          ctx.strokeStyle = elem.color || '#004ac6';
          ctx.lineWidth = 2;
          ctx.strokeRect(elem.x, elem.y, qrW, qrH);
        } else {
          // Card style border
          ctx.strokeStyle = '#c3c6d7';
          ctx.lineWidth = 1;
          ctx.strokeRect(elem.x, elem.y, qrW, qrH);
        }
      }

      const qrInnerSize = frameStyle !== 'clean' ? Math.max(30, qrW - 20) : qrW;
      const qrOffsetX = elem.x + (qrW - qrInnerSize) / 2;
      const qrOffsetY = elem.y + 6;

      if (qrImage) {
        ctx.drawImage(qrImage, qrOffsetX, qrOffsetY, qrInnerSize, qrInnerSize);
      } else {
        // Placeholder
        ctx.fillStyle = elem.color || '#004ac6';
        ctx.fillRect(qrOffsetX, qrOffsetY, qrInnerSize, qrInnerSize);
      }

      // Render bottom label if card style
      if (frameStyle === 'card') {
        ctx.font = 'bold 8px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = elem.color || '#004ac6';
        ctx.textAlign = 'center';
        ctx.fillText('CÓDIGO QR', elem.x + qrW / 2, elem.y + qrH - 8);
      }
    } else if (elem.type === 'image' && elem.src) {
      try {
        const customImg = await loadImage(elem.src);
        ctx.drawImage(customImg, elem.x, elem.y, elem.width || 120, elem.height || 60);
      } catch (e) {
        console.warn('Error rendering image element:', e);
      }
    }

    ctx.restore();
  }

  return canvas;
}

/**
 * Export certificate as High-Definition Printable PDF (A4 Landscape)
 */
export async function exportCertificateToPdf(template, studentRecord, verificationUrl) {
  const canvas = await renderCertificateToCanvas(template, studentRecord, verificationUrl);
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4', // 841.89 x 595.28 pt
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
  return pdf.output('blob');
}

/**
 * Export certificate as High-Resolution PNG
 */
export async function exportCertificateToPng(template, studentRecord, verificationUrl) {
  const canvas = await renderCertificateToCanvas(template, studentRecord, verificationUrl);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
