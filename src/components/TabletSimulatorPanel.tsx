import React from 'react';
import { PalmRejectionLog } from '../types';
import {
  Activity,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  X,
  Gauge,
  Radio,
} from 'lucide-react';

interface TabletSimulatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  palmRejectionEnabled: boolean;
  onTogglePalmRejection: (enabled: boolean) => void;
  palmContactThreshold: number;
  onThresholdChange: (val: number) => void;
  forceFingerMode: boolean;
  onToggleForceFingerMode: (val: boolean) => void;
  stats: {
    fps: number;
    latency: number;
    strokeCount: number;
    activePressure: number;
  };
  eventLogs: PalmRejectionLog[];
  onClearLogs: () => void;
}

export const TabletSimulatorPanel: React.FC<TabletSimulatorPanelProps> = ({
  isOpen,
  onClose,
  palmRejectionEnabled,
  onTogglePalmRejection,
  palmContactThreshold,
  onThresholdChange,
  forceFingerMode,
  onToggleForceFingerMode,
  stats,
  eventLogs,
  onClearLogs,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed top-20 right-4 z-40 w-96 max-h-[82vh] flex flex-col rounded-2xl bg-slate-900/98 border border-slate-700/80 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right-4 duration-200 overflow-hidden text-xs text-slate-200">
      {/* Başlık */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-sm tracking-tight text-white">Lenovo Tablet & Kalem Tanılama</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Gerçek Zamanlı Donanım Telemetrisi */}
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>Düşük Seviye Performans Telemetrisi</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400">Ekran Yenileme</div>
              <div className="text-base font-bold text-emerald-400 flex items-baseline gap-1">
                <span>{stats.fps}</span>
                <span className="text-[10px] text-slate-400">FPS</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400">Donanım Gecikmesi</div>
              <div className="text-base font-bold text-blue-400 flex items-baseline gap-1">
                <span>{stats.latency.toFixed(1)}</span>
                <span className="text-[10px] text-slate-400">ms</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400">Aktif Basınç</div>
              <div className="text-base font-bold text-amber-400 flex items-baseline gap-1">
                <span>{(stats.activePressure * 100).toFixed(0)}%</span>
                <span className="text-[10px] text-slate-400">4.096 seviye</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-400">GC Bellek Tahsisi</div>
              <div className="text-base font-bold text-emerald-400 flex items-baseline gap-1">
                <span>0</span>
                <span className="text-[10px] text-slate-400">Bayt (0 takılma)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Giriş Modu Simülatörü */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-amber-400" />
            <span>Giriş Cihazı Modunu Simüle Et</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onToggleForceFingerMode(false)}
              className={`p-2 rounded-xl text-left border transition ${
                !forceFingerMode
                  ? 'bg-blue-600/25 border-blue-500 text-blue-200 shadow-sm font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-semibold text-xs">Aktif Kalem</div>
              <div className="text-[10px] text-slate-400">Precision Pen 2</div>
            </button>

            <button
              onClick={() => onToggleForceFingerMode(true)}
              className={`p-2 rounded-xl text-left border transition ${
                forceFingerMode
                  ? 'bg-amber-600/25 border-amber-500 text-amber-200 shadow-sm font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-semibold text-xs">Parmak / Avuç İçi</div>
              <div className="text-[10px] text-slate-400">Kapasitif temas alanı</div>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-300">Avuç İçi Filtresi</span>
            <button
              onClick={() => onTogglePalmRejection(!palmRejectionEnabled)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                palmRejectionEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {palmRejectionEnabled ? 'AÇIK (400ms)' : 'KAPALI'}
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] mb-1 text-slate-400">
              <span>Avuç İçi Temas Eşiği</span>
              <span className="font-mono text-slate-200">{palmContactThreshold}px</span>
            </div>
            <input
              type="range"
              min="20"
              max="70"
              value={palmContactThreshold}
              onChange={(e) => onThresholdChange(Number(e.target.value))}
              className="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg"
            />
            <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
              <span>Parmak (15px)</span>
              <span>Avuç İçi (60px+)</span>
            </div>
          </div>
        </div>

        {/* Canlı Olay Akışı */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-purple-400" />
              <span>Dokunma Olay Akışı ({eventLogs.length})</span>
            </div>
            {eventLogs.length > 0 && (
              <button onClick={onClearLogs} className="text-[10px] text-slate-500 hover:text-slate-300 underline">
                Temizle
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-[10px]">
            {eventLogs.length === 0 ? (
              <div className="p-3 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/60">
                Canlı dijitalleştirici olaylarını incelemek için tuvale dokunun veya çizin.
              </div>
            ) : (
              eventLogs.slice(0, 15).map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded-lg border flex items-start justify-between ${
                    log.action === 'ACCEPTED'
                      ? 'bg-slate-950/70 border-slate-800 text-slate-300'
                      : 'bg-rose-950/40 border-rose-900/60 text-rose-300'
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    {log.action === 'ACCEPTED' ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold">{log.action === 'ACCEPTED' ? 'Dokunma Kabul Edildi' : 'Dokunma Reddedildi'}</div>
                      <div className="text-[9px] text-slate-400">
                        {log.pointerType} • {log.reason || `basınç: ${(log.pressure * 100).toFixed(0)}%`}
                      </div>
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-500">{log.contactWidth.toFixed(0)}px</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
