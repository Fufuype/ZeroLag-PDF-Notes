/**
 * Helper to render an uploaded PDF file onto an HTMLImageElement using pdfjs-dist.
 */
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker source to avoid worker fetch issues in Vite
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('PDF.js worker initialization fallback:', e);
  }
}

export async function renderPdfFileToImage(file: File, pageNumber: number = 1): Promise<{ image: HTMLImageElement; totalPages: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNumber);

  const viewport = page.getViewport({ scale: 2.0 }); // 2.0x for retina sharpness
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  // Draw white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
    canvas: canvas,
  };

  await page.render(renderContext).promise;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ image: img, totalPages: pdfDoc.numPages });
    img.onerror = reject;
    img.src = canvas.toDataURL('image/png');
  });
}
