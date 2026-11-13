import React from 'react';
import { PageInfo, StrokeData } from '../types';
import {
  X,
  FileText,
  ChevronRight,
  Layers,
  PanelLeftClose,
} from 'lucide-react';

interface PageThumbnailSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  pages: PageInfo[];
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  pageThumbnails: { [key: number]: string };
}

export const PageThumbnailSidebar: React.FC<PageThumbnailSidebarProps> = ({
  isOpen,
  onClose,
  pages,
  activePageIndex,
  onSelectPage,
  pageThumbnails,
}) => {
  if (!isOpen) return null;

  return (
    <aside
      aria-label="Sayfa Gezinti Sekmesi"
      className="fixed left-0 top-0 bottom-0 z-40 w-64 md:w-72 bg-slate-900/98 border-r border-slate-700/80 shadow-2xl backdrop-blur-2xl flex flex-col animate-in slide-in-from-left duration-200 select-none"
    >
      {/* Sidebar Başlığı (Google PDF Tarayıcısı Tarzında) */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-sm text-white tracking-tight">Sayfalar</span>
            <span className="text-[11px] font-mono text-slate-400">({pages.length})</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Kenar Çubuğunu Kapat"
          aria-label="Kenar Çubuğunu Kapat"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Sayfa Küçük Resimleri Listesi */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {pages.map((page, idx) => {
          const isActive = idx === activePageIndex;
          const thumbUrl = pageThumbnails[idx];

          return (
            <button
              key={page.pageIndex}
              onClick={() => onSelectPage(idx)}
              className={`group w-full flex flex-col items-center gap-1.5 p-2 rounded-2xl transition text-left ${
                isActive
                  ? 'bg-blue-600/15 ring-2 ring-blue-500 shadow-lg shadow-blue-500/10'
                  : 'hover:bg-slate-800/60'
              }`}
            >
              {/* Küçük Resim Kartı */}
              <div
                className={`relative w-full aspect-[1/1.3] rounded-xl overflow-hidden border shadow-md transition-all ${
                  isActive
                    ? 'border-blue-400 bg-white ring-2 ring-blue-400/40'
                    : 'border-slate-700 bg-white/95 group-hover:border-slate-500'
                }`}
              >
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={`Sayfa ${idx + 1}`}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-slate-100 text-slate-400">
                    <FileText className="w-6 h-6 mb-1 text-slate-300" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Sayfa {idx + 1}
                    </span>
                  </div>
                )}

                {/* Sayfa Numarası Rozeti (Küçük Resmin İçinde) */}
                <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-slate-950/80 text-white font-mono text-[10px] font-bold backdrop-blur-sm border border-slate-700">
                  {idx + 1}
                </div>
              </div>

              {/* Alt Metin */}
              <div className="w-full flex items-center justify-between px-1">
                <span
                  className={`text-xs font-semibold truncate ${
                    isActive ? 'text-blue-400' : 'text-slate-300 group-hover:text-white'
                  }`}
                >
                  {page.title || `Sayfa ${idx + 1}`}
                </span>
                {isActive && <span className="w-2 h-2 rounded-full bg-blue-500" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Alt Bilgi */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Google PDF Tarayıcısı Düzeni</span>
        <span className="text-emerald-400 font-semibold">Aktif</span>
      </div>
    </aside>
  );
};
