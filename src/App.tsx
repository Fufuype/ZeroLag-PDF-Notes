import React, { useState, useRef, useCallback } from 'react';
import { ToolMode, DocumentType, PalmRejectionLog } from './types';
import { DrawingCanvas } from './components/DrawingCanvas';
import { Toolbar } from './components/Toolbar';
import { AndroidCodeHub } from './components/AndroidCodeHub';
import { TabletSimulatorPanel } from './components/TabletSimulatorPanel';
import { renderPdfFileToImage } from './utils/pdfHelper';

export default function App() {
  const [currentMode, setCurrentMode] = useState<ToolMode>('pen');
  const [strokeColor, setStrokeColor] = useState<string>('#0F172A');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);

  // Document & Page state
  const [documentType, setDocumentType] = useState<DocumentType>('template-spec');
  const [customPdfImage, setCustomPdfImage] = useState<HTMLImageElement | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(2);

  // Undo / Redo states
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  // Tablet & Stylus Simulator settings
  const [palmRejectionEnabled, setPalmRejectionEnabled] = useState<boolean>(true);
  const [palmContactThreshold, setPalmContactThreshold] = useState<number>(40);
  const [forceFingerMode, setForceFingerMode] = useState<boolean>(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [isCodeHubOpen, setIsCodeHubOpen] = useState<boolean>(false);

  // Live Telemetry & Logs
  const [stats, setStats] = useState({
    fps: 60,
    latency: 2.1,
    strokeCount: 0,
    activePressure: 0.5,
  });
  const [eventLogs, setEventLogs] = useState<PalmRejectionLog[]>([]);

  // Canvas Action Handlers Reference
  const canvasActionsRef = useRef<{
    undo: () => void;
    redo: () => void;
    clear: () => void;
    deleteSelected: () => void;
    exportImage: (format: 'png') => string | null;
  } | null>(null);

  const handleCanvasRefCallback = useCallback((handlers: {
    undo: () => void;
    redo: () => void;
    clear: () => void;
    deleteSelected: () => void;
    exportImage: (format: 'png') => string | null;
  }) => {
    canvasActionsRef.current = handlers;
  }, []);

  const handlePalmEvent = useCallback((log: PalmRejectionLog) => {
    setEventLogs((prev) => [log, ...prev.slice(0, 40)]);
  }, []);

  const handleFileUpload = async (file: File) => {
    try {
      if (file.type === 'application/pdf') {
        const { image, totalPages: pages } = await renderPdfFileToImage(file, 1);
        setCustomPdfImage(image);
        setDocumentType('custom-pdf');
        setCurrentPage(0);
        setTotalPages(pages);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            setCustomPdfImage(img);
            setDocumentType('custom-pdf');
            setCurrentPage(0);
            setTotalPages(1);
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error('Failed to load document:', err);
    }
  };

  const handleExport = () => {
    if (!canvasActionsRef.current) return;
    const dataUrl = canvasActionsRef.current.exportImage('png');
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `ZeroLag_Not_Sayfa_${currentPage + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDocumentTypeChange = (type: DocumentType) => {
    setDocumentType(type);
    setCustomPdfImage(null);
    setCurrentPage(0);
    setTotalPages(type === 'template-spec' ? 2 : 1);
    canvasActionsRef.current?.clear();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Interactive Zero-Lag Tablet Canvas */}
      <DrawingCanvas
        currentMode={currentMode}
        strokeColor={strokeColor}
        baseStrokeWidth={strokeWidth}
        documentType={documentType}
        customPdfImage={customPdfImage}
        currentPage={currentPage}
        totalPages={totalPages}
        palmRejectionEnabled={palmRejectionEnabled}
        palmContactThreshold={palmContactThreshold}
        forceFingerMode={forceFingerMode}
        onUndoChange={(undoable, redoable) => {
          setCanUndo(undoable);
          setCanRedo(redoable);
        }}
        onPalmEvent={handlePalmEvent}
        onStatsUpdate={setStats}
        canvasRefCallback={handleCanvasRefCallback}
      />

      {/* Floating Toolbar */}
      <Toolbar
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        strokeColor={strokeColor}
        onColorChange={setStrokeColor}
        strokeWidth={strokeWidth}
        onWidthChange={setStrokeWidth}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => canvasActionsRef.current?.undo()}
        onRedo={() => canvasActionsRef.current?.redo()}
        onClear={() => canvasActionsRef.current?.clear()}
        onDeleteSelected={() => canvasActionsRef.current?.deleteSelected()}
        onExport={handleExport}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(p) => {
          setCurrentPage(p);
          canvasActionsRef.current?.clear();
        }}
        documentType={documentType}
        onDocumentTypeChange={handleDocumentTypeChange}
        onFileUpload={handleFileUpload}
        onToggleCodeHub={() => setIsCodeHubOpen(!isCodeHubOpen)}
        onToggleSimulator={() => setIsSimulatorOpen(!isSimulatorOpen)}
        isSimulatorOpen={isSimulatorOpen}
        isCodeHubOpen={isCodeHubOpen}
      />

      {/* Tablet Simulator Diagnostics Panel */}
      <TabletSimulatorPanel
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        palmRejectionEnabled={palmRejectionEnabled}
        onTogglePalmRejection={setPalmRejectionEnabled}
        palmContactThreshold={palmContactThreshold}
        onThresholdChange={setPalmContactThreshold}
        forceFingerMode={forceFingerMode}
        onToggleForceFingerMode={setForceFingerMode}
        stats={stats}
        eventLogs={eventLogs}
        onClearLogs={() => setEventLogs([])}
      />

      {/* Native Android Source Code Hub Modal */}
      <AndroidCodeHub isOpen={isCodeHubOpen} onClose={() => setIsCodeHubOpen(false)} />
    </div>
  );
}
