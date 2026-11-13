import React, { useState, useRef, useCallback } from 'react';
import { ToolMode, DocumentType, PalmRejectionLog, PageInfo } from './types';
import { DrawingCanvas } from './components/DrawingCanvas';
import { Toolbar } from './components/Toolbar';
import { AndroidCodeHub } from './components/AndroidCodeHub';
import { TabletSimulatorPanel } from './components/TabletSimulatorPanel';
import { PageThumbnailSidebar } from './components/PageThumbnailSidebar';
import { renderAllPdfPages, RenderedPdfPage } from './utils/pdfHelper';

export default function App() {
  const [currentMode, setCurrentMode] = useState<ToolMode>('pen');

  // Kalem ve Vurgulayıcı için tamamen bağımsız renk ve kalınlık durumları
  const [penColor, setPenColor] = useState<string>('#000000');
  const [penWidth, setPenWidth] = useState<number>(4);
  const [highlighterColor, setHighlighterColor] = useState<string>('#FBBF24');
  const [highlighterWidth, setHighlighterWidth] = useState<number>(14);

  // Aktif araca göre tuvale iletilen renk ve kalınlık
  const activeStrokeColor = currentMode === 'highlighter' ? highlighterColor : penColor;
  const activeStrokeWidth = currentMode === 'highlighter' ? highlighterWidth : penWidth;

  // Document & Multi-Page state (alt alta dikey dizilim)
  const [documentType, setDocumentType] = useState<DocumentType>('template-spec');
  const [customPdfPages, setCustomPdfPages] = useState<RenderedPdfPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(2);

  // Sol sekme (Google PDF tarzı küçük resim gezintisi)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [pageThumbnails, setPageThumbnails] = useState<{ [pageIndex: number]: string }>({});

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
    exportImage: (format: 'png', pageIndex?: number) => string | null;
    scrollToPage: (pageIndex: number) => void;
  } | null>(null);

  const handleCanvasRefCallback = useCallback(
    (handlers: {
      undo: () => void;
      redo: () => void;
      clear: () => void;
      deleteSelected: () => void;
      exportImage: (format: 'png', pageIndex?: number) => string | null;
      scrollToPage: (pageIndex: number) => void;
    }) => {
      canvasActionsRef.current = handlers;
    },
    []
  );

  const handlePalmEvent = useCallback((log: PalmRejectionLog) => {
    setEventLogs((prev) => [log, ...prev.slice(0, 40)]);
  }, []);

  const handleThumbnailsUpdate = useCallback((newThumbs: { [pageIndex: number]: string }) => {
    setPageThumbnails((prev) => ({ ...prev, ...newThumbs }));
  }, []);

  const handleFileUpload = async (file: File) => {
    try {
      if (file.type === 'application/pdf') {
        const pages = await renderAllPdfPages(file);
        setCustomPdfPages(pages);
        setDocumentType('custom-pdf');
        setActivePageIndex(0);
        setTotalPages(pages.length);

        const initialThumbs: { [key: number]: string } = {};
        pages.forEach((p, idx) => {
          initialThumbs[idx] = p.thumbnailUrl;
        });
        setPageThumbnails(initialThumbs);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const singlePage: RenderedPdfPage = {
              pageNumber: 1,
              image: img,
              width: img.width,
              height: img.height,
              thumbnailUrl: e.target?.result as string,
            };
            setCustomPdfPages([singlePage]);
            setDocumentType('custom-pdf');
            setActivePageIndex(0);
            setTotalPages(1);
            setPageThumbnails({ 0: e.target?.result as string });
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
    const dataUrl = canvasActionsRef.current.exportImage('png', activePageIndex);
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `ZeroLag_Not_Sayfa_${activePageIndex + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDocumentTypeChange = (type: DocumentType) => {
    setDocumentType(type);
    setCustomPdfPages([]);
    setActivePageIndex(0);
    // Her şablonda dikey akış ve sayfa listesini göstermek için varsayılan 2-3 sayfa
    const count = type === 'template-spec' ? 2 : type === 'template-cornell' ? 3 : 2;
    setTotalPages(count);
    setPageThumbnails({});
    canvasActionsRef.current?.clear();
  };

  // Google PDF tarzı sol sekme için sayfa listesi
  const pages: PageInfo[] = Array.from({ length: totalPages }, (_, i) => ({
    pageIndex: i,
    title:
      documentType === 'custom-pdf'
        ? `PDF Sayfa ${i + 1}`
        : documentType === 'template-spec'
        ? i === 0
          ? 'Lenovo Şartnamesi (1)'
          : 'Donanım & Çizim (2)'
        : documentType === 'template-cornell'
        ? `Cornell Notları (${i + 1})`
        : documentType === 'template-grid'
        ? `Milimetrik Izgara (${i + 1})`
        : `Çizgili Notlar (${i + 1})`,
    width: 920,
    height: 1300,
  }));

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Sol Açılır Kapanır Google PDF Tarzı Sayfa Gezinti Sekmesi */}
      <PageThumbnailSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        pages={pages}
        activePageIndex={activePageIndex}
        onSelectPage={(index) => {
          setActivePageIndex(index);
          canvasActionsRef.current?.scrollToPage(index);
        }}
        pageThumbnails={pageThumbnails}
      />

      {/* Dikey Alt Alta Yüklenen Sayfalar ve Çizim Tuvali */}
      <DrawingCanvas
        currentMode={currentMode}
        strokeColor={activeStrokeColor}
        baseStrokeWidth={activeStrokeWidth}
        documentType={documentType}
        customPdfPages={customPdfPages}
        pageCount={totalPages}
        activePageIndex={activePageIndex}
        onActivePageChange={setActivePageIndex}
        palmRejectionEnabled={palmRejectionEnabled}
        palmContactThreshold={palmContactThreshold}
        forceFingerMode={forceFingerMode}
        onUndoChange={(undoable, redoable) => {
          setCanUndo(undoable);
          setCanRedo(redoable);
        }}
        onPalmEvent={handlePalmEvent}
        onStatsUpdate={setStats}
        onThumbnailsUpdate={handleThumbnailsUpdate}
        canvasRefCallback={handleCanvasRefCallback}
      />

      {/* Üstte Konumlandırılmış Araç Çubuğu */}
      <Toolbar
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        penColor={penColor}
        onPenColorChange={setPenColor}
        penWidth={penWidth}
        onPenWidthChange={setPenWidth}
        highlighterColor={highlighterColor}
        onHighlighterColorChange={setHighlighterColor}
        highlighterWidth={highlighterWidth}
        onHighlighterWidthChange={setHighlighterWidth}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => canvasActionsRef.current?.undo()}
        onRedo={() => canvasActionsRef.current?.redo()}
        onClear={() => canvasActionsRef.current?.clear()}
        onDeleteSelected={() => canvasActionsRef.current?.deleteSelected()}
        onExport={handleExport}
        currentPage={activePageIndex}
        totalPages={totalPages}
        onPageChange={(p) => {
          setActivePageIndex(p);
          canvasActionsRef.current?.scrollToPage(p);
        }}
        documentType={documentType}
        onDocumentTypeChange={handleDocumentTypeChange}
        onFileUpload={handleFileUpload}
        onToggleCodeHub={() => setIsCodeHubOpen(!isCodeHubOpen)}
        onToggleSimulator={() => setIsSimulatorOpen(!isSimulatorOpen)}
        isSimulatorOpen={isSimulatorOpen}
        isCodeHubOpen={isCodeHubOpen}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Tablet Simülatör Tanılama Paneli */}
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

      {/* Yerel Android (Kotlin) Kaynak Kodu Merkezi */}
      <AndroidCodeHub isOpen={isCodeHubOpen} onClose={() => setIsCodeHubOpen(false)} />
    </div>
  );
}
