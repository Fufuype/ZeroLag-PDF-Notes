/**
 * Helper to render all pages of an uploaded PDF file onto HTMLImageElements and thumbnails using pdfjs-dist.
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

// Configure local worker source bundled by Vite (legacy build for broad browser compatibility)
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  } catch (e) {
    console.warn('PDF.js worker initialization fallback:', e);
  }
}

export interface RenderedPdfPage {
  pageNumber: number;
  image: HTMLImageElement;
  width: number;
  height: number;
  thumbnailUrl: string;
}

export async function renderPdfFileToImage(
  file: File,
  pageNumber: number = 1
): Promise<{ image: HTMLImageElement; totalPages: number }> {
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

/**
 * Renders all pages of a PDF file sequentially into high-resolution images and thumbnails
 */
export async function renderAllPdfPages(
  file: File,
  maxPages: number = 15
): Promise<RenderedPdfPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const total = Math.min(pdfDoc.numPages, maxPages);
  const results: RenderedPdfPage[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1.8 }); // 1.8x for high DPI
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    // Generate small thumbnail for sidebar
    const thumbCanvas = document.createElement('canvas');
    const thumbWidth = 140;
    const thumbHeight = Math.round((thumbWidth / viewport.width) * viewport.height);
    thumbCanvas.width = thumbWidth;
    thumbCanvas.height = thumbHeight;
    const thumbCtx = thumbCanvas.getContext('2d')!;
    thumbCtx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);

    const img = new Image();
    img.src = canvas.toDataURL('image/png');

    await new Promise((res) => {
      img.onload = res;
    });

    results.push({
      pageNumber: i,
      image: img,
      width: viewport.width,
      height: viewport.height,
      thumbnailUrl: thumbCanvas.toDataURL('image/png'),
    });
  }

  return results;
}
