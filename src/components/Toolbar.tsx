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
} from 'lucide-react';

interface ToolbarProps {
  currentMode: ToolMode;
  onModeChange: (mode: ToolMode) => void;
  strokeColor: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onWidthChange: (width: number) => void;
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
}

// En az 10 farklı belirgin renk seçeneği (12 adet canlı ve ayırt edilebilir renk)
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

export const HIGHLIGHTER_COLORS = [
  { hex: '#FBBF24', name: 'Fosforlu Sarı' },
  { hex: '#4ADE80', name: 'Açık Yeşil' },
  { hex: '#F472B6', name: 'Pastel Pembe' },
  { hex: '#60A5FA', name: 'Bebek Mavisi' },
  { hex: '#C084FC', name: 'Lavanta Moru' },
  { hex: '#FDBA74', name: 'Açık Şeftali' },
];

const STROKE_SIZES = [
  { size: 2, label: 'İnce (2px)' },
  { size: 4, label: 'Normal (4px)' },
  { size: 8, label: 'Kalın (8px)' },
  { size: 14, label: 'Geniş (14px)' },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentMode,
  onModeChange,
  strokeColor,
  onColorChange,
  strokeWidth,
  onWidthChange,
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

  const activePalette = currentMode === 'highlighter' ? HIGHLIGHTER_COLORS : PALETTE_COLORS;

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
        <div className="absolute top-3 inset-x-3 z-30 flex items-center justify-between gap-3 pointer-events-none">
          {/* 1. SOL KÜME: BELGE VE ŞABLON SEÇİCİ & SAYFA GEZİNTİSİ */}
          <div className="flex items-center gap-2 pointer-events-auto shrink-0">
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
              {/* Kalem */}
              <button
                onClick={() => onModeChange('pen')}
                className={`p-2 rounded-xl transition flex items-center gap-1.5 ${
                  currentMode === 'pen'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Kalem (Aktif Kalem Basınç Duyarlılığı)"
                aria-label="Kalem"
              >
                <Pen className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">Kalem</span>
              </button>

              {/* Vurgulayıcı */}
              <button
                onClick={() => {
                  onModeChange('highlighter');
                  if (!HIGHLIGHTER_COLORS.some((c) => c.hex === strokeColor)) {
                    onColorChange('#FBBF24');
                  }
                }}
                className={`p-2 rounded-xl transition flex items-center gap-1.5 ${
                  currentMode === 'highlighter'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/25'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Vurgulayıcı (Metni Kapatmayan Çarpma Karışım Modu)"
                aria-label="Vurgulayıcı"
              >
                <Highlighter className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">Vurgulayıcı</span>
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

              {/* Renk Paleti Tetikleyici Butonu */}
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className={`p-1.5 px-2.5 rounded-xl border transition flex items-center gap-2 ${
                  showColorPicker
                    ? 'bg-slate-800 border-blue-500 text-white ring-2 ring-blue-500/30'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title="Renk Paleti (12 Renk) ve Çizgi Kalınlığı"
                aria-label="Renk Paleti"
              >
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-900"
                  style={{ backgroundColor: strokeColor }}
                />
                <span className="text-[11px] font-mono font-semibold hidden md:inline">{strokeWidth}px</span>
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

            {/* AÇILIR RENK PALETİ (EN AZ 10 FARKLI BELİRGİN RENK VE KALINLIK) */}
            {showColorPicker && (
              <div className="mt-2.5 px-5 py-3.5 rounded-2xl bg-slate-900/98 border border-slate-700 shadow-2xl backdrop-blur-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    <span>Renk Paleti ({activePalette.length} Canlı Renk)</span>
                    <span className="text-[10px] text-blue-400 font-mono font-bold">
                      {activePalette.find((c) => c.hex.toLowerCase() === strokeColor.toLowerCase())?.name || strokeColor}
                    </span>
                  </div>

                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                    {activePalette.map((colorItem) => {
                      const isSelected = strokeColor.toLowerCase() === colorItem.hex.toLowerCase();
                      return (
                        <button
                          key={colorItem.hex}
                          onClick={() => {
                            onColorChange(colorItem.hex);
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
                                ['#fbbf24', '#4ade80', '#60a5fa', '#f59e0b'].includes(colorItem.hex.toLowerCase())
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

                {/* Çizgi Kalınlığı */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kalınlık</span>
                  <div className="flex items-center gap-1.5">
                    {STROKE_SIZES.map((sz) => (
                      <button
                        key={sz.size}
                        onClick={() => onWidthChange(sz.size)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                          strokeWidth === sz.size
                            ? 'bg-blue-600 text-white shadow-md'
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
