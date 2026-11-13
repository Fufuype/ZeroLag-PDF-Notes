import React, { useState } from 'react';
import { ToolMode, DocumentType } from '../types';
import {
  Pen,
  Highlighter,
  Eraser,
  Lasso,
  Undo2,
  Redo2,
  Download,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Code2,
  Cpu,
  Trash2,
  Eye,
  EyeOff,
  Palette,
  FileText,
  Check,
  PanelLeft,
} from 'lucide-react';

interface ToolbarProps {
  currentMode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  // Kalem bağımsız renk ve kalınlığı
  penColor: string;
  onPenColorChange: (color: string) => void;
  penWidth: number;
  onPenWidthChange: (width: number) => void;
  // Vurgulayıcı bağımsız renk ve kalınlığı (asla kalemi etkilemez)
  highlighterColor: string;
  onHighlighterColorChange: (color: string) => void;
  highlighterWidth: number;
  onHighlighterWidthChange: (width: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDeleteSelected: () => void;
  onExport: () => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  documentType: DocumentType;
  onDocumentTypeChange: (type: DocumentType) => void;
  onFileUpload: (file: File) => void;
  onToggleCodeHub: () => void;
  onToggleSimulator: () => void;
  isSimulatorOpen: boolean;
  isCodeHubOpen: boolean;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

// Kalem için 12 adet canlı ve ayırt edilebilir renk
export const PALETTE_COLORS = [
  { hex: '#000000', name: 'Siyah' },
  { hex: '#1E3A8A', name: 'Gece Mavisi' },
  { hex: '#2563EB', name: 'Kobalt Mavisi' },
  { hex: '#0284C7', name: 'Gök Mavisi' },
  { hex: '#059669', name: 'Zümrüt Yeşili' },
  { hex: '#16A34A', name: 'Canlı Yeşil' },
  { hex: '#DC2626', name: 'Koyu Kırmızı' },
  { hex: '#EA580C', name: 'Turuncu' },
  { hex: '#F59E0B', name: 'Kehribar Sarısı' },
  { hex: '#7C3AED', name: 'Asil Mor' },
  { hex: '#DB2777', name: 'Fuşya Pembe' },
  { hex: '#78350F', name: 'Sıcak Kahverengi' },
];

// Vurgulayıcı için 12 adet yarı şeffaf fosforlu ve pastel renk
export const HIGHLIGHTER_COLORS = [
  { hex: '#FBBF24', name: 'Fosforlu Sarı' },
  { hex: '#FACC15', name: 'Parlak Limon' },
  { hex: '#22C55E', name: 'Fosforlu Yeşil' },
  { hex: '#4ADE80', name: 'Pastel Nane' },
  { hex: '#06B6D4', name: 'Canlı Turkuaz' },
  { hex: '#38BDF8', name: 'Bebek Mavisi' },
  { hex: '#60A5FA', name: 'Gök Mavisi' },
  { hex: '#A855F7', name: 'Canlı Lila' },
  { hex: '#C084FC', name: 'Lavanta Moru' },
  { hex: '#F472B6', name: 'Pastel Pembe' },
  { hex: '#FB7185', name: 'Gül Pembesi' },
  { hex: '#FB923C', name: 'Açık Şeftali' },
];

export const PEN_STROKE_SIZES = [
  { size: 2, label: 'İnce (2px)' },
  { size: 4, label: 'Normal (4px)' },
  { size: 6, label: 'Orta (6px)' },
  { size: 10, label: 'Kalın (10px)' },
];

export const HIGHLIGHTER_STROKE_SIZES = [
  { size: 8, label: 'İnce (8px)' },
  { size: 14, label: 'Normal (14px)' },
  { size: 22, label: 'Geniş (22px)' },
  { size: 32, label: 'Ekstra (32px)' },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentMode,
  onModeChange,
  penColor,
  onPenColorChange,
  penWidth,
  onPenWidthChange,
  highlighterColor,
  onHighlighterColorChange,
  highlighterWidth,
  onHighlighterWidthChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onDeleteSelected,
  onExport,
  currentPage,
  totalPages,
  onPageChange,
  documentType,
  onDocumentTypeChange,
  onFileUpload,
  onToggleCodeHub,
  onToggleSimulator,
  isSimulatorOpen,
  isCodeHubOpen,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
      setShowDocPicker(false);
    }
  };

  const isHighlighter = currentMode === 'highlighter';
  const activeStrokeColor = isHighlighter ? highlighterColor : penColor;
  const activeStrokeWidth = isHighlighter ? highlighterWidth : penWidth;
  const activePalette = isHighlighter ? HIGHLIGHTER_COLORS : PALETTE_COLORS;
  const activeSizes = isHighlighter ? HIGHLIGHTER_STROKE_SIZES : PEN_STROKE_SIZES;

  return (
    <>
      {/* Gizli Dosya Girişi (PDF veya Görsel Yüklemek İçin) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Yalnızca Araç Çubuğu Gizlendiğinde Gösterilen Yeniden Açma Butonu */}
      {isCollapsed && (
        <div className="absolute top-3 right-3 z-40">
          <button
            onClick={() => setIsCollapsed(false)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/95 text-slate-200 border border-slate-700/80 hover:bg-slate-800 transition shadow-xl text-xs font-semibold"
            title="Araç Çubuğunu Göster"
          >
            <Eye className="w-4 h-4 text-blue-400" />
            <span>Araçları Göster</span>
          </button>
        </div>
      )}

      {/* ÜST BÖLÜM: BİRLEŞİK, ÇAKIŞMAYAN ÜST TABLET ÇUBUĞU */}
      {!isCollapsed && (
        <div
          className={`absolute top-3 right-3 z-30 flex items-center justify-between gap-3 pointer-events-none transition-all duration-200 ${
            isSidebarOpen ? 'left-68 md:left-76' : 'left-3'
          }`}
        >
          {/* 1. SOL KÜME: SAYFA GEZİNTİ ÇUBUĞU & BELGE SEÇİCİ & SAYFALAR */}
          <div className="flex items-center gap-2 pointer-events-auto shrink-0">
            {/* Google PDF Tarzı Sayfa Gezinti Sekmesi Aç/Kapa Butonu */}
            <button
              onClick={onToggleSidebar}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border shadow-xl backdrop-blur-xl transition text-xs font-semibold ${
                isSidebarOpen
                  ? 'bg-blue-600/30 border-blue-500/80 text-blue-300 ring-2 ring-blue-500/20'
                  : 'bg-slate-900/95 hover:bg-slate-800 border-slate-700/90 text-slate-200'
              }`}
              title={isSidebarOpen ? 'Sol Sayfa Gezinti Sekmesini Kapat' : 'Sol Sayfa Gezinti Sekmesini Aç'}
              aria-label="Sayfalar Gezinti Sekmesi"
            >
              <PanelLeft className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">Sayfalar</span>
            </button>

            {/* Şablon Seçici Buton */}
            <div className="relative">
              <button
                onClick={() => setShowDocPicker(!showDocPicker)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-slate-200 border border-slate-700/90 shadow-xl transition text-xs font-semibold backdrop-blur-xl"
                title="Şablon veya Belge Seç"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden xl:inline">
                  {documentType === 'template-spec'
                    ? 'Lenovo Şartnamesi'
                    : documentType === 'template-cornell'
                    ? 'Cornell Notları'
                    : documentType === 'template-grid'
                    ? 'Milimetrik Izgara'
                    : documentType === 'template-lined'
                    ? 'Çizgili Defter'
                    : 'Özel Belge'}
                </span>
                <span className="text-[10px] bg-blue-600/30 text-blue-300 font-bold px-1.5 py-0.5 rounded">PDF</span>
              </button>

              {/* Açılır Belge Listesi */}
              {showDocPicker && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 backdrop-blur-2xl animate-in fade-in slide-in-from-top-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5">
                    Not Şablonları & Belgeler
                  </div>
                  <button
                    onClick={() => {
                      onDocumentTypeChange('template-spec');
                      setShowDocPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                      documentType === 'template-spec' ? 'bg-blue-600/30 text-blue-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>Lenovo Mimari ve Kalem Şartnamesi</span>
                    <span className="text-[10px] text-slate-400">2 Sayfa</span>
                  </button>
                  <button
                    onClick={() => {
                      onDocumentTypeChange('template-cornell');
                      setShowDocPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                      documentType === 'template-cornell' ? 'bg-blue-600/30 text-blue-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>Cornell Not Tutma Sistemi</span>
                    <span className="text-[10px] text-slate-400">Çizgili</span>
                  </button>
                  <button
                    onClick={() => {
                      onDocumentTypeChange('template-grid');
                      setShowDocPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                      documentType === 'template-grid' ? 'bg-blue-600/30 text-blue-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>İzometrik / 5mm Milimetrik Izgara</span>
                    <span className="text-[10px] text-slate-400">Mühendislik</span>
                  </button>
                  <button
                    onClick={() => {
                      onDocumentTypeChange('template-lined');
                      setShowDocPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                      documentType === 'template-lined' ? 'bg-blue-600/30 text-blue-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>Çizgili Not Defteri Sayfası</span>
                    <span className="text-[10px] text-slate-400">Yazı</span>
                  </button>

                  <div className="h-px bg-slate-800 my-1" />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs text-blue-400 hover:bg-slate-800 flex items-center gap-2 font-semibold"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Cihazdan Yerel PDF / Görsel Yükle...</span>
                  </button>
                </div>
              )}
            </div>

            {/* Sayfa Gezinme */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900/95 text-slate-200 border border-slate-700/90 text-xs font-semibold shadow-xl backdrop-blur-xl">
                <button
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage <= 0}
                  className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Önceki Sayfa"
                  aria-label="Önceki Sayfa"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-1 text-[11px] font-mono text-slate-300">
                  {currentPage + 1}/{totalPages}
                </span>
                <button
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1}
                  className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Sonraki Sayfa"
                  aria-label="Sonraki Sayfa"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 2. ORTA KÜME: ÜSTTE KONUMLANDIRILMIŞ KALEM VE ÇİZİM ARAÇLARI */}
          <div className="relative pointer-events-auto flex flex-col items-center shrink-0">
            {/* Ana Araç Çubuğu */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900/98 border border-slate-700/90 shadow-2xl backdrop-blur-xl">
              {/* Kalem (Bağımsız Renk ve Kalınlık) */}
              <button
                onClick={() => onModeChange('pen')}
                className={`p-2 rounded-xl transition flex items-center gap-1.5 ${
                  currentMode === 'pen'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title={`Kalem (${PALETTE_COLORS.find((c) => c.hex.toLowerCase() === penColor.toLowerCase())?.name || penColor})`}
                aria-label="Kalem"
              >
                <Pen className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">Kalem</span>
                <span
                  className="w-2.5 h-2.5 rounded-full border border-white/60 shadow-sm shrink-0"
                  style={{ backgroundColor: penColor }}
                />
              </button>

              {/* Vurgulayıcı (Bağımsız Renk ve Kalınlık - Kalemi Asla Etkilemez) */}
              <button
                onClick={() => onModeChange('highlighter')}
                className={`p-2 rounded-xl transition flex items-center gap-1.5 ${
                  currentMode === 'highlighter'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/25'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title={`Vurgulayıcı (${HIGHLIGHTER_COLORS.find((c) => c.hex.toLowerCase() === highlighterColor.toLowerCase())?.name || highlighterColor})`}
                aria-label="Vurgulayıcı"
              >
                <Highlighter className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">Vurgulayıcı</span>
                <span
                  className="w-2.5 h-2.5 rounded-full border border-slate-900/40 shadow-sm shrink-0"
                  style={{ backgroundColor: highlighterColor }}
                />
              </button>

              {/* Silgi */}
              <button
                onClick={() => onModeChange('eraser-stroke')}
                className={`p-2 rounded-xl transition flex items-center gap-1.5 ${
                  currentMode === 'eraser-stroke'
                    ? 'bg-rose-600 text-white font-bold shadow-lg shadow-rose-500/25'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Çizgi Silgisi"
                aria-label="Silgi"
              >
                <Eraser className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">Silgi</span>
              </button>

              {/* Kement */}
              <button
                onClick={() => onModeChange('lasso')}
                className={`p-2 rounded-xl transition flex items-center gap-1.5 ${
                  currentMode === 'lasso'
                    ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/25'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Kement Aracı (Çizimleri Seç ve Taşı)"
                aria-label="Kement Aracı"
              >
                <Lasso className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">Kement</span>
              </button>

              <div className="w-px h-5 bg-slate-800 mx-0.5" />

              {/* Renk Paleti Tetikleyici Butonu (Aktif Aracın Rengi ve Kalınlığı) */}
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className={`p-1.5 px-2.5 rounded-xl border transition flex items-center gap-2 ${
                  showColorPicker
                    ? 'bg-slate-800 border-blue-500 text-white ring-2 ring-blue-500/30'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title={isHighlighter ? 'Vurgulayıcı Rengi (12 Renk) ve Genişliği' : 'Kalem Rengi (12 Renk) ve Kalınlığı'}
                aria-label="Renk Paleti"
              >
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-900"
                  style={{ backgroundColor: activeStrokeColor }}
                />
                <span className="text-[11px] font-mono font-semibold hidden md:inline">{activeStrokeWidth}px</span>
                <Palette className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Kement Seçimini Sil */}
              {currentMode === 'lasso' && (
                <button
                  onClick={onDeleteSelected}
                  className="p-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 transition"
                  title="Seçili Çizimleri Sil"
                  aria-label="Seçili Çizimleri Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <div className="w-px h-5 bg-slate-800 mx-0.5" />

              {/* Geri Al */}
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                title="Geri Al"
                aria-label="Geri Al"
              >
                <Undo2 className="w-4 h-4" />
              </button>

              {/* Yinele */}
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                title="Yinele"
                aria-label="Yinele"
              >
                <Redo2 className="w-4 h-4" />
              </button>

              {/* Tümünü Temizle */}
              <button
                onClick={onClear}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                title="Sayfadaki Tüm Çizimleri Temizle"
                aria-label="Tümünü Temizle"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="w-px h-5 bg-slate-800 mx-0.5" />

              {/* Dışa Aktar */}
              <button
                onClick={onExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition"
                title="Notları Dışa Aktar"
                aria-label="Dışa Aktar"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Dışa Aktar</span>
              </button>
            </div>

            {/* AÇILIR RENK PALETİ (KALEM VE VURGULAYICI İÇİN TAMAMEN AYRI VE BAĞIMSIZ) */}
            {showColorPicker && (
              <div className="mt-2.5 px-5 py-3.5 rounded-2xl bg-slate-900/98 border border-slate-700 shadow-2xl backdrop-blur-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                {/* Araç Seçim Sekmesi (Kalem vs Vurgulayıcı Ayırımı) */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/80 border border-slate-700/80">
                  <button
                    onClick={() => onModeChange('pen')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
                      !isHighlighter
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <Pen className="w-3.5 h-3.5" />
                    <span>Kalem Rengi</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/60 shadow-sm shrink-0"
                      style={{ backgroundColor: penColor }}
                    />
                  </button>

                  <button
                    onClick={() => onModeChange('highlighter')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
                      isHighlighter
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <Highlighter className="w-3.5 h-3.5" />
                    <span>Vurgulayıcı Rengi</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-slate-900/40 shadow-sm shrink-0"
                      style={{ backgroundColor: highlighterColor }}
                    />
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <span>
                      {isHighlighter ? 'Vurgulayıcı Rengi (12 Fosforlu Renk)' : 'Kalem Rengi (12 Canlı Renk)'}
                    </span>
                    <span className="text-[10px] text-blue-400 font-mono font-bold">
                      {activePalette.find((c) => c.hex.toLowerCase() === activeStrokeColor.toLowerCase())?.name || activeStrokeColor}
                    </span>
                  </div>

                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                    {activePalette.map((colorItem) => {
                      const isSelected = activeStrokeColor.toLowerCase() === colorItem.hex.toLowerCase();
                      return (
                        <button
                          key={colorItem.hex}
                          onClick={() => {
                            if (isHighlighter) {
                              onHighlighterColorChange(colorItem.hex);
                            } else {
                              onPenColorChange(colorItem.hex);
                            }
                            setShowColorPicker(false);
                          }}
                          className={`group relative w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                            isSelected
                              ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-950 shadow-lg'
                              : 'hover:scale-115 hover:ring-1 hover:ring-white/60'
                          }`}
                          style={{ backgroundColor: colorItem.hex }}
                          title={colorItem.name}
                          aria-label={colorItem.name}
                        >
                          {isSelected && (
                            <Check
                              className={`w-3.5 h-3.5 ${
                                ['#fbbf24', '#facc15', '#4ade80', '#60a5fa', '#f59e0b'].includes(colorItem.hex.toLowerCase())
                                  ? 'text-slate-950'
                                  : 'text-white'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Çizgi Kalınlığı (Aktif Araca Özel) */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {isHighlighter ? 'Vurgulayıcı Kalınlığı' : 'Kalem Kalınlığı'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {activeSizes.map((sz) => (
                      <button
                        key={sz.size}
                        onClick={() => {
                          if (isHighlighter) {
                            onHighlighterWidthChange(sz.size);
                          } else {
                            onPenWidthChange(sz.size);
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                          activeStrokeWidth === sz.size
                            ? isHighlighter
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                              : 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {sz.size}px
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. SAĞ KÜME: TABLET SİMÜLATÖRÜ, ANDROİD KODU VE GİZLE BUTONU */}
          <div className="flex items-center gap-2 pointer-events-auto shrink-0">
            <button
              onClick={onToggleSimulator}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border shadow-xl backdrop-blur-xl text-xs font-semibold transition ${
                isSimulatorOpen
                  ? 'bg-amber-500/25 border-amber-500/60 text-amber-300 shadow-amber-500/20'
                  : 'bg-slate-900/95 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title="Lenovo Precision Pen ve Avuç İçi Reddetme Tanılama Paneli"
            >
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">Tablet Simülatörü</span>
            </button>

            <button
              onClick={onToggleCodeHub}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border shadow-xl backdrop-blur-xl text-xs font-bold transition ${
                isCodeHubOpen
                  ? 'bg-blue-600 border-blue-400 text-white shadow-blue-500/30'
                  : 'bg-blue-600/90 border-blue-500/60 text-white hover:bg-blue-600'
              }`}
              title="Yerel Android (Kotlin) Kaynak Kodunu İncele ve İndir"
            >
              <Code2 className="w-4 h-4" />
              <span>Android Kodu</span>
            </button>

            <button
              onClick={() => setIsCollapsed(true)}
              className="p-2 rounded-xl bg-slate-900/95 text-slate-400 border border-slate-700/80 hover:text-slate-200 transition shadow-xl"
              title="Araç Çubuğunu Gizle"
              aria-label="Araç Çubuğunu Gizle"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
