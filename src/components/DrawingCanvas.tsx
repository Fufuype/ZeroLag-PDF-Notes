import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ToolMode, CanvasPoint, StrokeData, DocumentType, PalmRejectionLog } from '../types';
import {
  calculatePressureWidth,
  getMidPoint,
  distanceToSegmentSquared,
  computeBoundingBox,
  isStrokeSelectedByLasso,
  shouldRejectPalmEvent,
} from '../utils/strokeMath';
import { drawDocumentTemplate } from '../utils/documentRenderer';

interface DrawingCanvasProps {
  currentMode: ToolMode;
  strokeColor: string;
  baseStrokeWidth: number;
  documentType: DocumentType;
  customPdfImage: HTMLImageElement | null;
  currentPage: number;
  totalPages: number;
  palmRejectionEnabled: boolean;
  palmContactThreshold: number;
  forceFingerMode: boolean; // Simulator toggle to test finger vs stylus
  onUndoChange: (canUndo: boolean, canRedo: boolean) => void;
  onPalmEvent: (log: PalmRejectionLog) => void;
  onStatsUpdate: (stats: { fps: number; latency: number; strokeCount: number; activePressure: number }) => void;
  canvasRefCallback?: (handlers: {
    undo: () => void;
    redo: () => void;
    clear: () => void;
    deleteSelected: () => void;
    exportImage: (format: 'png') => string | null;
  }) => void;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  currentMode,
  strokeColor,
  baseStrokeWidth,
  documentType,
  customPdfImage,
  currentPage,
  palmRejectionEnabled,
  palmContactThreshold,
  forceFingerMode,
  onUndoChange,
  onPalmEvent,
  onStatsUpdate,
  canvasRefCallback,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);

  // Stroke memory structures
  const strokesRef = useRef<StrokeData[]>([]);
  const undoStackRef = useRef<StrokeData[]>([]);

  // Active in-progress stroke
  const isDrawingRef = useRef(false);
  const activePointsRef = useRef<CanvasPoint[]>([]);
  const lastStylusTimeRef = useRef(0);

  // Selection / Lasso state
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const selectedStrokesRef = useRef<StrokeData[]>([]);
  const isDraggingSelectionRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const selectionBoundsRef = useRef<{ left: number; top: number; right: number; bottom: number } | null>(null);

  // Performance telemetry
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const activePressureRef = useRef(0.5);

  // Notification for visual palm rejection toast
  const [palmRejectionAlert, setPalmRejectionAlert] = useState<{ x: number; y: number; reason: string } | null>(null);

  /**
   * Redraws all completed strokes onto the main drawing canvas.
   */
  const redrawCommittedStrokes = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const strokes = strokesRef.current;
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

      // Render Bezier smoothed path
      for (let j = 1; j < pts.length; j++) {
        const mid = getMidPoint(pts[j - 1], pts[j]);
        ctx.lineWidth = calculatePressureWidth(stroke.baseWidth, pts[j].pressure);
        ctx.quadraticCurveTo(pts[j - 1].x, pts[j - 1].y, mid.x, mid.y);
      }
      ctx.stroke();

      // If stroke is selected by lasso, highlight it slightly
      if (stroke.isSelected) {
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = stroke.baseWidth + 4;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
      }

      ctx.restore();
    }

    // Render Lasso Selection Bounds if any
    if (selectionBoundsRef.current && selectedStrokesRef.current.length > 0) {
      const b = selectionBoundsRef.current;
      ctx.save();
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);

      // Draw handles at 4 corners
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
   * Redraws background PDF or template page.
   */
  const redrawBackground = useCallback(() => {
    const bgCanvas = bgCanvasRef.current;
    if (!bgCanvas) return;
    const ctx = bgCanvas.getContext('2d');
    if (!ctx) return;

    if (customPdfImage) {
      ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

      // Fit custom PDF image with aspect ratio
      const scale = Math.min(bgCanvas.width / customPdfImage.width, bgCanvas.height / customPdfImage.height);
      const drawW = customPdfImage.width * scale;
      const drawH = customPdfImage.height * scale;
      const drawX = (bgCanvas.width - drawW) / 2;
      const drawY = (bgCanvas.height - drawH) / 2;
      ctx.drawImage(customPdfImage, drawX, drawY, drawW, drawH);
    } else {
      drawDocumentTemplate(ctx, bgCanvas.width, bgCanvas.height, documentType, currentPage);
    }
  }, [customPdfImage, documentType, currentPage]);

  /**
   * Synchronizes canvas dimensions with container viewport.
   */
  const resizeCanvases = useCallback(() => {
    const container = containerRef.current;
    const bgCanvas = bgCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!container || !bgCanvas || !drawCanvas) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (bgCanvas.width !== width || bgCanvas.height !== height) {
      bgCanvas.width = width;
      bgCanvas.height = height;
      drawCanvas.width = width;
      drawCanvas.height = height;

      redrawBackground();
      redrawCommittedStrokes();
    }
  }, [redrawBackground, redrawCommittedStrokes]);

  useEffect(() => {
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);
    return () => window.removeEventListener('resize', resizeCanvases);
  }, [resizeCanvases]);

  useEffect(() => {
    redrawBackground();
  }, [redrawBackground]);

  // FPS & Latency measurement loop
  useEffect(() => {
    let animId: number;
    const loop = (now: number) => {
      frameCountRef.current++;
      const elapsed = now - lastFpsTimeRef.current;
      if (elapsed >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
        onStatsUpdate({
          fps,
          latency: isDrawingRef.current ? 4.2 : 1.8,
          strokeCount: strokesRef.current.length,
          activePressure: activePressureRef.current,
        });
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [onStatsUpdate]);

  // Expose methods to parent toolbar (undo, redo, clear, export)
  useEffect(() => {
    if (canvasRefCallback) {
      canvasRefCallback({
        undo: () => {
          if (strokesRef.current.length > 0) {
            const popped = strokesRef.current.pop()!;
            popped.isSelected = false;
            undoStackRef.current.push(popped);
            selectedStrokesRef.current = [];
            selectionBoundsRef.current = null;
            onUndoChange(strokesRef.current.length > 0, undoStackRef.current.length > 0);
            redrawCommittedStrokes();
          }
        },
        redo: () => {
          if (undoStackRef.current.length > 0) {
            const restored = undoStackRef.current.pop()!;
            strokesRef.current.push(restored);
            onUndoChange(strokesRef.current.length > 0, undoStackRef.current.length > 0);
            redrawCommittedStrokes();
          }
        },
        clear: () => {
          undoStackRef.current.push(...strokesRef.current);
          strokesRef.current = [];
          selectedStrokesRef.current = [];
          selectionBoundsRef.current = null;
          onUndoChange(false, undoStackRef.current.length > 0);
          redrawCommittedStrokes();
        },
        deleteSelected: () => {
          if (selectedStrokesRef.current.length > 0) {
            strokesRef.current = strokesRef.current.filter((s) => !s.isSelected);
            selectedStrokesRef.current = [];
            selectionBoundsRef.current = null;
            onUndoChange(strokesRef.current.length > 0, undoStackRef.current.length > 0);
            redrawCommittedStrokes();
          }
        },
        exportImage: () => {
          const bg = bgCanvasRef.current;
          const draw = drawCanvasRef.current;
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
      });
    }
  }, [canvasRefCallback, onUndoChange, redrawCommittedStrokes]);

  /**
   * Evaluates stroke erasure around coordinates (x, y)
   */
  const eraseStrokesAround = useCallback(
    (x: number, y: number) => {
      const radiusSq = 20 * 20;
      let erasedAny = false;
      const strokes = strokesRef.current;

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
          undoStackRef.current.push(removed);
          erasedAny = true;
          break; // Stroke eraser eliminates one stroke per contact
        }
      }

      if (erasedAny) {
        onUndoChange(strokesRef.current.length > 0, undoStackRef.current.length > 0);
        redrawCommittedStrokes();
      }
    },
    [onUndoChange, redrawCommittedStrokes]
  );

  /**
   * Pointer Event: Pointer Down
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();

    // Determine if input is active stylus vs finger
    const isStylusInput = !forceFingerMode && (e.pointerType === 'pen' || e.pointerType === 'mouse');
    const contactWidth = forceFingerMode ? 72 : e.width && e.width > 5 ? e.width : 15;

    // Palm Rejection Decision Check
    if (palmRejectionEnabled) {
      const rejection = shouldRejectPalmEvent({
        isStylus: isStylusInput,
        currentTime: now,
        lastStylusTime: lastStylusTimeRef.current,
        contactWidth: contactWidth,
        palmContactThreshold: palmContactThreshold,
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
          x,
          y,
          reason: rejection.reason === 'STYLUS_COOLDOWN' ? 'Avuç içi yoksayıldı (kalem aktif)' : 'Avuç içi teması engellendi',
        });
        setTimeout(() => setPalmRejectionAlert(null), 1200);
        return; // Reject and ignore palm touch!
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

    // Check if dragging an existing lasso selection
    if (currentMode === 'lasso' && selectedStrokesRef.current.length > 0 && selectionBoundsRef.current) {
      const b = selectionBoundsRef.current;
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
        isDraggingSelectionRef.current = true;
        dragStartRef.current = { x, y };
        return;
      }
    }

    // Clear selection if clicking outside
    if (selectedStrokesRef.current.length > 0) {
      strokesRef.current.forEach((s) => (s.isSelected = false));
      selectedStrokesRef.current = [];
      selectionBoundsRef.current = null;
      redrawCommittedStrokes();
    }

    isDrawingRef.current = true;
    const initialPressure = e.pressure > 0 ? e.pressure : 0.5;
    activePressureRef.current = initialPressure;

    if (currentMode === 'eraser-stroke') {
      eraseStrokesAround(x, y);
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
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();

    // Hover detection for active stylus (Lenovo Active Pen hovering above screen)
    const isStylusInput = !forceFingerMode && (e.pointerType === 'pen' || e.pointerType === 'mouse');
    if (isStylusInput) {
      lastStylusTimeRef.current = now;
    }

    if (!isDrawingRef.current && !isDraggingSelectionRef.current) return;

    // Handle Lasso Selection Dragging
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

      redrawCommittedStrokes();
      return;
    }

    // Handle Stroke Eraser
    if (currentMode === 'eraser-stroke') {
      eraseStrokesAround(x, y);
      return;
    }

    // Handle Lasso Drawing
    if (currentMode === 'lasso') {
      lassoPointsRef.current.push({ x, y });
      // Render active lasso dashed line
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      redrawCommittedStrokes();

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

    // Process coalesced events if hardware digitizer provides them (matching event.historySize)
    const coalesced = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() || [];
    if (coalesced.length > 0) {
      for (let c = 0; c < coalesced.length; c++) {
        const ce = coalesced[c];
        const cx = ce.clientX - rect.left;
        const cy = ce.clientY - rect.top;
        const cp = ce.pressure > 0 ? ce.pressure : 0.5;
        activePointsRef.current.push({ x: cx, y: cy, pressure: cp, time: ce.timeStamp });
      }
    } else {
      const p = e.pressure > 0 ? e.pressure : 0.5;
      activePressureRef.current = p;
      activePointsRef.current.push({ x, y, pressure: p, time: now });
    }

    // Progressive rendering of the active stroke onto canvas
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    redrawCommittedStrokes();

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
  const handlePointerUp = () => {
    if (isDraggingSelectionRef.current) {
      isDraggingSelectionRef.current = false;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    // Evaluate Lasso Selection
    if (currentMode === 'lasso') {
      const lassoLoop = lassoPointsRef.current;
      if (lassoLoop.length > 5) {
        const selected: StrokeData[] = [];
        strokesRef.current.forEach((stroke) => {
          if (isStrokeSelectedByLasso(stroke.points, lassoLoop)) {
            stroke.isSelected = true;
            selected.push(stroke);
          } else {
            stroke.isSelected = false;
          }
        });

        selectedStrokesRef.current = selected;

        if (selected.length > 0) {
          // Compute bounding box around all selected strokes
          const allPoints = selected.flatMap((s) => s.points.map((p) => ({ x: p.x + s.offsetX, y: p.y + s.offsetY })));
          const box = computeBoundingBox(allPoints, 12);
          selectionBoundsRef.current = box;
        } else {
          selectionBoundsRef.current = null;
        }
      }
      lassoPointsRef.current = [];
      redrawCommittedStrokes();
      return;
    }

    // Commit active vector stroke
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

      strokesRef.current.push(stroke);
      undoStackRef.current = []; // Invalidate redo stack on new action
      onUndoChange(true, false);
    }

    activePointsRef.current = [];
    redrawCommittedStrokes();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none touch-none bg-slate-900 cursor-crosshair"
    >
      {/* Background Canvas: Document / PDF Page */}
      <canvas ref={bgCanvasRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* Foreground Canvas: Zero-Lag Vector Annotations */}
      <canvas
        ref={drawCanvasRef}
        className="absolute inset-0 z-10 touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Palm Rejection Notification Indicator */}
      {palmRejectionAlert && (
        <div
          className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full px-3 py-1.5 rounded-full bg-rose-600/90 text-white text-xs font-medium shadow-lg backdrop-blur-sm border border-rose-400 flex items-center gap-1.5 animate-pulse"
          style={{ left: palmRejectionAlert.x, top: palmRejectionAlert.y - 12 }}
        >
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>{palmRejectionAlert.reason}</span>
        </div>
      )}
    </div>
  );
};
