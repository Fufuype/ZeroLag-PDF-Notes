import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ToolMode, CanvasPoint, StrokeData, DocumentType, PalmRejectionLog } from '../types';
import { RenderedPdfPage } from '../utils/pdfHelper';
import {
  calculatePressureWidth,
  getMidPoint,
  distanceToSegmentSquared,
  computeBoundingBox,
  isStrokeSelectedByLasso,
  shouldRejectPalmEvent,
  determinePointerAction,
} from '../utils/strokeMath';
import { drawDocumentTemplate } from '../utils/documentRenderer';
import { Pen, Hand } from 'lucide-react';

interface DrawingCanvasProps {
  currentMode: ToolMode;
  strokeColor: string;
  baseStrokeWidth: number;
  documentType: DocumentType;
  customPdfPages: RenderedPdfPage[];
  pageCount: number;
  activePageIndex: number;
  onActivePageChange: (index: number) => void;
  palmRejectionEnabled: boolean;
  palmContactThreshold: number;
  forceFingerMode: boolean; // Simulator toggle to test finger vs stylus
  onUndoChange: (canUndo: boolean, canRedo: boolean) => void;
  onPalmEvent: (log: PalmRejectionLog) => void;
  onStatsUpdate: (stats: { fps: number; latency: number; strokeCount: number; activePressure: number }) => void;
  onThumbnailsUpdate: (thumbnails: { [pageIndex: number]: string }) => void;
  canvasRefCallback?: (handlers: {
    undo: () => void;
    redo: () => void;
    clear: () => void;
    deleteSelected: () => void;
    exportImage: (format: 'png', pageIndex?: number) => string | null;
    scrollToPage: (pageIndex: number) => void;
  }) => void;
}

// Standard A4 aspect ratio dimensions for crisp tablet display
const PAGE_WIDTH = 920;
const PAGE_HEIGHT = 1300;

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  currentMode,
  strokeColor,
  baseStrokeWidth,
  documentType,
  customPdfPages,
  pageCount,
  activePageIndex,
  onActivePageChange,
  palmRejectionEnabled,
  palmContactThreshold,
  forceFingerMode,
  onUndoChange,
  onPalmEvent,
  onStatsUpdate,
  onThumbnailsUpdate,
  canvasRefCallback,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Per-page canvas element references
  const bgCanvasesRef = useRef<{ [pageIndex: number]: HTMLCanvasElement | null }>({});
  const drawCanvasesRef = useRef<{ [pageIndex: number]: HTMLCanvasElement | null }>({});

  // Strokes organized by page index
  const strokesByPageRef = useRef<{ [pageIndex: number]: StrokeData[] }>({});
  const undoStackByPageRef = useRef<{ [pageIndex: number]: StrokeData[] }>({});

  // Active in-progress drawing stroke
  const isDrawingRef = useRef(false);
  const activeDrawingPageRef = useRef<number | null>(null);
  const activePointsRef = useRef<CanvasPoint[]>([]);
  const lastStylusTimeRef = useRef(0);

  // Finger Pan / Scroll state (Kalem yokken parmakla yazma engeli)
  const isFingerScrollingRef = useRef(false);
  const fingerScrollStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [fingerScrollIndicator, setFingerScrollIndicator] = useState(false);

  // Selection / Lasso state
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const selectedStrokesRef = useRef<StrokeData[]>([]);
  const isDraggingSelectionRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const selectionBoundsRef = useRef<{ left: number; top: number; right: number; bottom: number } | null>(null);

  // Telemetry metrics
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const activePressureRef = useRef(0.5);

  // Palm rejection visual alerts
  const [palmRejectionAlert, setPalmRejectionAlert] = useState<{ x: number; y: number; reason: string } | null>(null);

  // Total pages list
  const totalPagesList = Array.from({ length: pageCount }, (_, i) => i);

  /**
   * Generates a miniature thumbnail data URL for a specific page.
   */
  const generatePageThumbnail = useCallback((pageIndex: number) => {
    const bgCanvas = bgCanvasesRef.current[pageIndex];
    const drawCanvas = drawCanvasesRef.current[pageIndex];
    if (!bgCanvas) return;

    const thumbW = 160;
    const thumbH = Math.round((thumbW / bgCanvas.width) * bgCanvas.height);
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(bgCanvas, 0, 0, thumbW, thumbH);
    if (drawCanvas) {
      ctx.drawImage(drawCanvas, 0, 0, thumbW, thumbH);
    }

    const dataUrl = thumbCanvas.toDataURL('image/png');
    onThumbnailsUpdate({ [pageIndex]: dataUrl });
  }, [onThumbnailsUpdate]);

  /**
   * Redraws all completed strokes onto the drawing canvas of a specific page.
   */
  const redrawCommittedStrokesForPage = useCallback((pageIndex: number) => {
    const canvas = drawCanvasesRef.current[pageIndex];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const strokes = strokesByPageRef.current[pageIndex] || [];
    for (let i = 0; i < strokes.length; i++) {
      const stroke = strokes[i];
      if (stroke.points.length < 2) continue;

      ctx.save();
      if (stroke.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.45;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
      }

      ctx.strokeStyle = stroke.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.translate(stroke.offsetX, stroke.offsetY);

      const pts = stroke.points;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);

      for (let j = 1; j < pts.length; j++) {
        const mid = getMidPoint(pts[j - 1], pts[j]);
        ctx.lineWidth = calculatePressureWidth(stroke.baseWidth, pts[j].pressure);
        ctx.quadraticCurveTo(pts[j - 1].x, pts[j - 1].y, mid.x, mid.y);
      }
      ctx.stroke();

      if (stroke.isSelected) {
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = stroke.baseWidth + 4;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
      }

      ctx.restore();
    }

    // Render Lasso Selection Bounds if any on this page
    if (activeDrawingPageRef.current === pageIndex && selectionBoundsRef.current && selectedStrokesRef.current.length > 0) {
      const b = selectionBoundsRef.current;
      ctx.save();
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);

      const r = 5;
      ctx.fillStyle = '#FFFFFF';
      ctx.setLineDash([]);
      [
        { x: b.left, y: b.top },
        { x: b.right, y: b.top },
        { x: b.left, y: b.bottom },
        { x: b.right, y: b.bottom },
      ].forEach((corner) => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      ctx.restore();
    }
  }, []);

  /**
   * Redraws background PDF page or template for a specific page index.
   */
  const redrawBackgroundForPage = useCallback((pageIndex: number) => {
    const bgCanvas = bgCanvasesRef.current[pageIndex];
    if (!bgCanvas) return;
    const ctx = bgCanvas.getContext('2d');
    if (!ctx) return;

    if (documentType === 'custom-pdf' && customPdfPages[pageIndex]) {
      const pdfPage = customPdfPages[pageIndex];
      ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

      const scale = Math.min(bgCanvas.width / pdfPage.image.width, bgCanvas.height / pdfPage.image.height);
      const drawW = pdfPage.image.width * scale;
      const drawH = pdfPage.image.height * scale;
      const drawX = (bgCanvas.width - drawW) / 2;
      const drawY = (bgCanvas.height - drawH) / 2;
      ctx.drawImage(pdfPage.image, drawX, drawY, drawW, drawH);
    } else {
      drawDocumentTemplate(ctx, bgCanvas.width, bgCanvas.height, documentType, pageIndex);
    }

    // Generate initial thumbnail
    generatePageThumbnail(pageIndex);
  }, [documentType, customPdfPages, generatePageThumbnail]);

  /**
   * Initializes all pages background and dimensions.
   */
  useEffect(() => {
    totalPagesList.forEach((idx) => {
      const bg = bgCanvasesRef.current[idx];
      const draw = drawCanvasesRef.current[idx];
      if (bg && draw) {
        bg.width = PAGE_WIDTH;
        bg.height = PAGE_HEIGHT;
        draw.width = PAGE_WIDTH;
        draw.height = PAGE_HEIGHT;

        redrawBackgroundForPage(idx);
        redrawCommittedStrokesForPage(idx);
      }
    });
  }, [pageCount, documentType, customPdfPages, redrawBackgroundForPage, redrawCommittedStrokesForPage]);

  // Telemetry loop for FPS and latency
  useEffect(() => {
    let animId: number;
    const loop = (now: number) => {
      frameCountRef.current++;
      const elapsed = now - lastFpsTimeRef.current;
      if (elapsed >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;

        const totalStrokes = Object.values(strokesByPageRef.current).reduce((acc, list) => acc + list.length, 0);

        onStatsUpdate({
          fps,
          latency: isDrawingRef.current ? 3.8 : 1.6,
          strokeCount: totalStrokes,
          activePressure: activePressureRef.current,
        });
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [onStatsUpdate]);

  /**
   * Scroll Listener: Detects which page is in view and updates active page index.
   */
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const centerY = scrollTop + containerHeight / 3;

    let closestPage = 0;
    let minDistance = Infinity;

    totalPagesList.forEach((idx) => {
      const pageEl = document.getElementById(`pdf-page-card-${idx}`);
      if (pageEl) {
        const pageTop = pageEl.offsetTop;
        const dist = Math.abs(pageTop - centerY);
        if (dist < minDistance) {
          minDistance = dist;
          closestPage = idx;
        }
      }
    });

    if (closestPage !== activePageIndex) {
      onActivePageChange(closestPage);
    }
  }, [activePageIndex, onActivePageChange, totalPagesList]);

  // Expose methods to parent toolbar
  useEffect(() => {
    if (canvasRefCallback) {
      canvasRefCallback({
        undo: () => {
          const currentPageStrokes = strokesByPageRef.current[activePageIndex] || [];
          if (currentPageStrokes.length > 0) {
            const popped = currentPageStrokes.pop()!;
            popped.isSelected = false;
            if (!undoStackByPageRef.current[activePageIndex]) {
              undoStackByPageRef.current[activePageIndex] = [];
            }
            undoStackByPageRef.current[activePageIndex].push(popped);
            selectedStrokesRef.current = [];
            selectionBoundsRef.current = null;

            onUndoChange(
              (strokesByPageRef.current[activePageIndex] || []).length > 0,
              (undoStackByPageRef.current[activePageIndex] || []).length > 0
            );

            redrawCommittedStrokesForPage(activePageIndex);
            generatePageThumbnail(activePageIndex);
          }
        },
        redo: () => {
          const undoStack = undoStackByPageRef.current[activePageIndex] || [];
          if (undoStack.length > 0) {
            const restored = undoStack.pop()!;
            if (!strokesByPageRef.current[activePageIndex]) {
              strokesByPageRef.current[activePageIndex] = [];
            }
            strokesByPageRef.current[activePageIndex].push(restored);

            onUndoChange(
              (strokesByPageRef.current[activePageIndex] || []).length > 0,
              (undoStackByPageRef.current[activePageIndex] || []).length > 0
            );

            redrawCommittedStrokesForPage(activePageIndex);
            generatePageThumbnail(activePageIndex);
          }
        },
        clear: () => {
          const currentStrokes = strokesByPageRef.current[activePageIndex] || [];
          if (!undoStackByPageRef.current[activePageIndex]) {
            undoStackByPageRef.current[activePageIndex] = [];
          }
          undoStackByPageRef.current[activePageIndex].push(...currentStrokes);
          strokesByPageRef.current[activePageIndex] = [];
          selectedStrokesRef.current = [];
          selectionBoundsRef.current = null;

          onUndoChange(false, (undoStackByPageRef.current[activePageIndex] || []).length > 0);
          redrawCommittedStrokesForPage(activePageIndex);
          generatePageThumbnail(activePageIndex);
        },
        deleteSelected: () => {
          if (selectedStrokesRef.current.length > 0) {
            strokesByPageRef.current[activePageIndex] = (strokesByPageRef.current[activePageIndex] || []).filter(
              (s) => !s.isSelected
            );
            selectedStrokesRef.current = [];
            selectionBoundsRef.current = null;

            onUndoChange((strokesByPageRef.current[activePageIndex] || []).length > 0, true);
            redrawCommittedStrokesForPage(activePageIndex);
            generatePageThumbnail(activePageIndex);
          }
        },
        exportImage: (_format, targetPage) => {
          const pIndex = targetPage !== undefined ? targetPage : activePageIndex;
          const bg = bgCanvasesRef.current[pIndex];
          const draw = drawCanvasesRef.current[pIndex];
          if (!bg || !draw) return null;

          const exportCanvas = document.createElement('canvas');
          exportCanvas.width = bg.width;
          exportCanvas.height = bg.height;
          const ctx = exportCanvas.getContext('2d');
          if (!ctx) return null;

          ctx.drawImage(bg, 0, 0);
          ctx.drawImage(draw, 0, 0);
          return exportCanvas.toDataURL('image/png');
        },
        scrollToPage: (targetPage) => {
          const el = document.getElementById(`pdf-page-card-${targetPage}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        },
      });
    }
  }, [canvasRefCallback, activePageIndex, onUndoChange, redrawCommittedStrokesForPage, generatePageThumbnail]);

  /**
   * Stroke Eraser: Erases strokes intersecting (x, y) on a specific page.
   */
  const eraseStrokesAround = useCallback(
    (pageIndex: number, x: number, y: number) => {
      const radiusSq = 22 * 22;
      let erasedAny = false;
      const strokes = strokesByPageRef.current[pageIndex] || [];

      for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        const pts = s.points;
        let hit = false;

        for (let j = 1; j < pts.length; j++) {
          const d2 = distanceToSegmentSquared(
            x,
            y,
            pts[j - 1].x + s.offsetX,
            pts[j - 1].y + s.offsetY,
            pts[j].x + s.offsetX,
            pts[j].y + s.offsetY
          );
          if (d2 <= radiusSq) {
            hit = true;
            break;
          }
        }

        if (hit) {
          const removed = strokes.splice(i, 1)[0];
          if (!undoStackByPageRef.current[pageIndex]) {
            undoStackByPageRef.current[pageIndex] = [];
          }
          undoStackByPageRef.current[pageIndex].push(removed);
          erasedAny = true;
          break;
        }
      }

      if (erasedAny) {
        onUndoChange(
          (strokesByPageRef.current[pageIndex] || []).length > 0,
          (undoStackByPageRef.current[pageIndex] || []).length > 0
        );
        redrawCommittedStrokesForPage(pageIndex);
        generatePageThumbnail(pageIndex);
      }
    },
    [onUndoChange, redrawCommittedStrokesForPage, generatePageThumbnail]
  );

  /**
   * Pointer Event: Pointer Down on a specific page
   */
  const handlePointerDown = (pageIndex: number, e: React.PointerEvent<HTMLCanvasElement>) => {
    const action = determinePointerAction(e.pointerType, !forceFingerMode);

    // ------------------------------------------------------------------
    // PARMAK İLE DOKUNMA: ASLA ÇİZİM YAPMAZ, YALNIZCA SAYFAYI SÜRÜKLER/KAYDIRIR
    // ------------------------------------------------------------------
    if (action === 'SCROLL') {
      isFingerScrollingRef.current = true;
      fingerScrollStartRef.current = { x: e.clientX, y: e.clientY };
      setFingerScrollIndicator(true);

      onPalmEvent({
        id: Math.random().toString(36).substring(7),
        timestamp: performance.now(),
        pointerType: 'parmak (sadece sürükleme)',
        action: 'ACCEPTED',
        reason: 'Parmakla Sayfa Kaydırma Aktif',
        pressure: 0,
        contactWidth: forceFingerMode ? 72 : e.width || 25,
      });
      return;
    }

    // ------------------------------------------------------------------
    // AKTİF KALEM İLE DOKUNMA: ÇİZİM / ANNOTASYON MODU
    // ------------------------------------------------------------------
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = PAGE_WIDTH / rect.width;
    const scaleY = PAGE_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const now = performance.now();

    const isStylusInput = !forceFingerMode && (e.pointerType === 'pen' || e.pointerType === 'mouse');
    const contactWidth = forceFingerMode ? 72 : e.width && e.width > 5 ? e.width : 15;

    // Palm Rejection Check
    if (palmRejectionEnabled) {
      const rejection = shouldRejectPalmEvent({
        isStylus: isStylusInput,
        currentTime: now,
        lastStylusTime: lastStylusTimeRef.current,
        contactWidth,
        palmContactThreshold,
      });

      if (rejection.reject) {
        onPalmEvent({
          id: Math.random().toString(36).substring(7),
          timestamp: now,
          pointerType: e.pointerType === 'pen' ? 'aktif kalem' : 'parmak / avuç içi',
          action: 'REJECTED',
          reason: rejection.reason === 'STYLUS_COOLDOWN' ? '400ms Kalem Bekleme Süresi Aktif' : 'Avuç İçi Temas Çapı > 60px',
          pressure: e.pressure,
          contactWidth,
        });

        setPalmRejectionAlert({
          x: e.clientX,
          y: e.clientY,
          reason: rejection.reason === 'STYLUS_COOLDOWN' ? 'Avuç içi yoksayıldı (kalem aktif)' : 'Avuç içi teması engellendi',
        });
        setTimeout(() => setPalmRejectionAlert(null), 1200);
        return;
      }
    }

    if (isStylusInput) {
      lastStylusTimeRef.current = now;
    }

    onPalmEvent({
      id: Math.random().toString(36).substring(7),
      timestamp: now,
      pointerType: isStylusInput ? 'Aktif Kalem (Lenovo Precision Pen)' : 'Parmak Dokunuşu',
      action: 'ACCEPTED',
      pressure: e.pressure || 0.5,
      contactWidth,
    });

    // Check Lasso Dragging
    if (
      currentMode === 'lasso' &&
      activeDrawingPageRef.current === pageIndex &&
      selectedStrokesRef.current.length > 0 &&
      selectionBoundsRef.current
    ) {
      const b = selectionBoundsRef.current;
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
        isDraggingSelectionRef.current = true;
        dragStartRef.current = { x, y };
        return;
      }
    }

    // Clear Selection
    if (selectedStrokesRef.current.length > 0) {
      Object.values(strokesByPageRef.current).forEach((list) => list.forEach((s) => (s.isSelected = false)));
      selectedStrokesRef.current = [];
      selectionBoundsRef.current = null;
      redrawCommittedStrokesForPage(pageIndex);
    }

    isDrawingRef.current = true;
    activeDrawingPageRef.current = pageIndex;
    const initialPressure = e.pressure > 0 ? e.pressure : 0.5;
    activePressureRef.current = initialPressure;

    if (currentMode === 'eraser-stroke') {
      eraseStrokesAround(pageIndex, x, y);
      return;
    }

    if (currentMode === 'lasso') {
      lassoPointsRef.current = [{ x, y }];
      return;
    }

    activePointsRef.current = [{ x, y, pressure: initialPressure, time: now }];
  };

  /**
   * Pointer Event: Pointer Move
   */
  const handlePointerMove = (pageIndex: number, e: React.PointerEvent<HTMLCanvasElement>) => {
    // ------------------------------------------------------------------
    // PARMAKLA SÜRÜKLEME İŞLEMİ: Tüm belgeyi dikey/yatay kaydırır
    // ------------------------------------------------------------------
    if (isFingerScrollingRef.current && scrollContainerRef.current) {
      const dx = e.clientX - fingerScrollStartRef.current.x;
      const dy = e.clientY - fingerScrollStartRef.current.y;
      fingerScrollStartRef.current = { x: e.clientX, y: e.clientY };

      scrollContainerRef.current.scrollTop -= dy;
      scrollContainerRef.current.scrollLeft -= dx;
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = PAGE_WIDTH / rect.width;
    const scaleY = PAGE_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const now = performance.now();

    const isStylusInput = !forceFingerMode && (e.pointerType === 'pen' || e.pointerType === 'mouse');
    if (isStylusInput) {
      lastStylusTimeRef.current = now;
    }

    if (!isDrawingRef.current && !isDraggingSelectionRef.current) return;
    if (activeDrawingPageRef.current !== pageIndex) return;

    // Drag Lasso Selection
    if (isDraggingSelectionRef.current) {
      const dx = x - dragStartRef.current.x;
      const dy = y - dragStartRef.current.y;
      dragStartRef.current = { x, y };

      selectedStrokesRef.current.forEach((s) => {
        s.offsetX += dx;
        s.offsetY += dy;
      });

      if (selectionBoundsRef.current) {
        selectionBoundsRef.current.left += dx;
        selectionBoundsRef.current.right += dx;
        selectionBoundsRef.current.top += dy;
        selectionBoundsRef.current.bottom += dy;
      }

      redrawCommittedStrokesForPage(pageIndex);
      return;
    }

    // Eraser Mode
    if (currentMode === 'eraser-stroke') {
      eraseStrokesAround(pageIndex, x, y);
      return;
    }

    // Lasso Mode
    if (currentMode === 'lasso') {
      lassoPointsRef.current.push({ x, y });
      const canvas = drawCanvasesRef.current[pageIndex];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      redrawCommittedStrokesForPage(pageIndex);

      ctx.save();
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      const pts = lassoPointsRef.current;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Subframe Digitizer Samples
    const coalesced = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() || [];
    if (coalesced.length > 0) {
      for (let c = 0; c < coalesced.length; c++) {
        const ce = coalesced[c];
        const cx = (ce.clientX - rect.left) * scaleX;
        const cy = (ce.clientY - rect.top) * scaleY;
        const cp = ce.pressure > 0 ? ce.pressure : 0.5;
        activePointsRef.current.push({ x: cx, y: cy, pressure: cp, time: ce.timeStamp });
      }
    } else {
      const p = e.pressure > 0 ? e.pressure : 0.5;
      activePressureRef.current = p;
      activePointsRef.current.push({ x, y, pressure: p, time: now });
    }

    // Progressive Draw
    const canvas = drawCanvasesRef.current[pageIndex];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    redrawCommittedStrokesForPage(pageIndex);

    const pts = activePointsRef.current;
    if (pts.length < 2) return;

    ctx.save();
    if (currentMode === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = strokeColor;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = strokeColor;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let j = 1; j < pts.length; j++) {
      const mid = getMidPoint(pts[j - 1], pts[j]);
      ctx.lineWidth = calculatePressureWidth(baseStrokeWidth, pts[j].pressure);
      ctx.quadraticCurveTo(pts[j - 1].x, pts[j - 1].y, mid.x, mid.y);
    }
    ctx.stroke();
    ctx.restore();
  };

  /**
   * Pointer Event: Pointer Up / Cancel
   */
  const handlePointerUp = (pageIndex: number) => {
    // End Finger Pan
    if (isFingerScrollingRef.current) {
      isFingerScrollingRef.current = false;
      setTimeout(() => setFingerScrollIndicator(false), 500);
      return;
    }

    if (isDraggingSelectionRef.current) {
      isDraggingSelectionRef.current = false;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    // Finalize Lasso
    if (currentMode === 'lasso') {
      const loop = lassoPointsRef.current;
      if (loop.length > 5) {
        const selected: StrokeData[] = [];
        const strokes = strokesByPageRef.current[pageIndex] || [];
        strokes.forEach((stroke) => {
          if (isStrokeSelectedByLasso(stroke.points, loop)) {
            stroke.isSelected = true;
            selected.push(stroke);
          } else {
            stroke.isSelected = false;
          }
        });

        selectedStrokesRef.current = selected;

        if (selected.length > 0) {
          const allPoints = selected.flatMap((s) => s.points.map((p) => ({ x: p.x + s.offsetX, y: p.y + s.offsetY })));
          selectionBoundsRef.current = computeBoundingBox(allPoints, 12);
        } else {
          selectionBoundsRef.current = null;
        }
      }
      lassoPointsRef.current = [];
      redrawCommittedStrokesForPage(pageIndex);
      return;
    }

    // Commit Stroke to this specific page
    if (activePointsRef.current.length > 1 && currentMode !== 'eraser-stroke') {
      const stroke: StrokeData = {
        id: Math.random().toString(36).substring(7),
        tool: currentMode === 'highlighter' ? 'highlighter' : 'pen',
        color: strokeColor,
        baseWidth: baseStrokeWidth,
        alpha: currentMode === 'highlighter' ? 0.45 : 1.0,
        points: [...activePointsRef.current],
        offsetX: 0,
        offsetY: 0,
      };

      if (!strokesByPageRef.current[pageIndex]) {
        strokesByPageRef.current[pageIndex] = [];
      }
      strokesByPageRef.current[pageIndex].push(stroke);
      undoStackByPageRef.current[pageIndex] = [];

      onUndoChange(true, false);
      generatePageThumbnail(pageIndex);
    }

    activePointsRef.current = [];
    activeDrawingPageRef.current = null;
    redrawCommittedStrokesForPage(pageIndex);
  };

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="relative w-full h-full overflow-y-auto overflow-x-auto bg-slate-950 select-none touch-none scroll-smooth"
    >
      {/* Sürükleme / Kaydırma Göstergesi (Parmakla dokunulduğunda gösterilir) */}
      {fingerScrollIndicator && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none px-4 py-2 rounded-2xl bg-slate-900/90 text-blue-300 border border-blue-500/50 shadow-2xl backdrop-blur-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <Hand className="w-4 h-4 text-amber-400" />
          <span>Parmakla Kaydırma Aktif (Yazmak için Aktif Kalem kullanın)</span>
        </div>
      )}

      {/* DİKEY OLARAK ALT ALTA YÜKLENEN PDF / ŞABLON SAYFALARI */}
      <div className="flex flex-col items-center gap-10 py-24 px-4 min-w-[960px]">
        {totalPagesList.map((pageIdx) => {
          const isActive = pageIdx === activePageIndex;

          return (
            <div
              key={pageIdx}
              id={`pdf-page-card-${pageIdx}`}
              className={`relative rounded-2xl bg-white shadow-2xl transition-all ${
                isActive ? 'ring-2 ring-blue-500/80 shadow-blue-500/10' : 'ring-1 ring-slate-800'
              }`}
              style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
            >
              {/* Sayfa Başlığı ve Numarası Rozeti */}
              <div className="absolute -top-7 left-2 flex items-center gap-2 text-xs text-slate-400 font-medium">
                <span className="font-mono bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-800 text-slate-300">
                  Sayfa {pageIdx + 1} / {pageCount}
                </span>
                {isActive && (
                  <span className="text-[10px] text-blue-400 font-semibold bg-blue-600/20 px-2 py-0.5 rounded-md border border-blue-500/30">
                    Görüntülenen Sayfa
                  </span>
                )}
              </div>

              {/* Alt Katman: Belge / PDF Sayfası */}
              <canvas
                ref={(el) => {
                  bgCanvasesRef.current[pageIdx] = el;
                }}
                className="absolute inset-0 rounded-2xl pointer-events-none"
              />

              {/* Üst Katman: Sıfır-Gecikmeli Vektör Çizim Tuvali */}
              <canvas
                ref={(el) => {
                  drawCanvasesRef.current[pageIdx] = el;
                }}
                className={`absolute inset-0 rounded-2xl touch-none ${
                  forceFingerMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
                }`}
                onPointerDown={(e) => handlePointerDown(pageIdx, e)}
                onPointerMove={(e) => handlePointerMove(pageIdx, e)}
                onPointerUp={() => handlePointerUp(pageIdx)}
                onPointerCancel={() => handlePointerUp(pageIdx)}
                onPointerLeave={() => handlePointerUp(pageIdx)}
              />
            </div>
          );
        })}
      </div>

      {/* Avuç İçi Reddedildi Uyarısı */}
      {palmRejectionAlert && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full px-3 py-1.5 rounded-full bg-rose-600/90 text-white text-xs font-semibold shadow-2xl backdrop-blur-md border border-rose-400 flex items-center gap-1.5 animate-pulse"
          style={{ left: palmRejectionAlert.x, top: palmRejectionAlert.y - 14 }}
        >
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>{palmRejectionAlert.reason}</span>
        </div>
      )}
    </div>
  );
};
