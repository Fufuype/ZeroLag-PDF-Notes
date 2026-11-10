import React, { useState } from 'react';
import { ANDROID_FILES } from '../constants/androidCodeFiles';
import JSZip from 'jszip';
import {
  FileCode,
  Download,
  Copy,
  Check,
  X,
  FileCheck2,
  ShieldCheck,
  Zap,
  HardDrive,
  Cpu,
  Layers,
} from 'lucide-react';

interface AndroidCodeHubProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidCodeHub: React.FC<AndroidCodeHubProps> = ({ isOpen, onClose }) => {
  const [activeFileIndex, setActiveFileIndex] = useState(3); // DrawingCanvasView.kt
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  if (!isOpen) return null;

  const currentFile = ANDROID_FILES[activeFileIndex];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      // Root project files
      zip.file(
        'ZeroLagNotes/settings.gradle.kts',
        `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "ZeroLagNotes"
include(":app")
`
      );

      zip.file(
        'ZeroLagNotes/build.gradle.kts',
        `plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}
`
      );

      zip.file(
        'ZeroLagNotes/gradle.properties',
        `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
`
      );

      // App folder
      const app = zip.folder('ZeroLagNotes/app');
      if (app) {
        ANDROID_FILES.forEach((f) => {
          if (f.name === 'build.gradle.kts') {
            app.file('build.gradle.kts', f.code);
          } else if (f.name === 'AndroidManifest.xml') {
            app.file('src/main/AndroidManifest.xml', f.code);
          } else if (f.name.endsWith('.kt')) {
            app.file(`src/main/java/com/zerolag/pdfnotes/${f.name}`, f.code);
          } else if (f.name.endsWith('.md')) {
            zip.file(`ZeroLagNotes/${f.path}`, f.code);
          }
        });

        app.file(
          'proguard-rules.pro',
          `# ProGuard Kuralları - ZeroLag Notes
-dontwarn java.lang.invoke.**
-keep class com.zerolag.pdfnotes.** { *; }
-keep class androidx.compose.** { *; }
`
        );
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ZeroLagNotes_Android_Projesi.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ZIP oluşturulurken hata:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        {/* Başlık Çubuğu */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">ZeroLag Notes Yerel Android Kaynak Kod Merkezi</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Android Studio Derlemesine Hazır
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Jetpack Compose + Özel Canvas
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Lenovo tabletler ve Aktif Kalem / Precision Pen için optimize edilmiş ultra hafif, sıfır gecikmeli Kotlin mimarisi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isZipping ? 'ZIP Hazırlanıyor...' : 'Projeyi İndir (.zip)'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Teknik Mimari Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 px-6 py-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-[11px]">
              <div className="font-semibold text-slate-200">0% İnternet / Çevrimdışı</div>
              <div className="text-slate-400 text-[10px]">INTERNET izni kesinlikle yok</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="text-[11px]">
              <div className="font-semibold text-slate-200">Sıfır-GC Çizim Döngüsü</div>
              <div className="text-slate-400 text-[10px]">Önceden ayrılmış Path/Paint havuzları</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <Layers className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="text-[11px]">
              <div className="font-semibold text-slate-200">400ms Avuç İçi Reddi</div>
              <div className="text-slate-400 text-[10px]">Hover ve dokunma zaman filtresi</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <HardDrive className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="text-[11px]">
              <div className="font-semibold text-slate-200">Yerel PdfRenderer</div>
              <div className="text-slate-400 text-[10px]">Harici ağır PDF kütüphaneleri yok</div>
            </div>
          </div>
        </div>

        {/* Ana Gövde: Dosya Gezgini + Kod Görüntüleyici */}
        <div className="flex-1 flex overflow-hidden">
          {/* Dosya Gezgini Kenar Çubuğu */}
          <div className="w-64 border-r border-slate-800 bg-slate-900/60 flex flex-col shrink-0">
            <div className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/60 flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Teslim Edilen Dosyalar</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {ANDROID_FILES.map((file, idx) => (
                <button
                  key={file.name}
                  onClick={() => setActiveFileIndex(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition flex flex-col gap-0.5 ${
                    activeFileIndex === idx
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileCode className={`w-3.5 h-3.5 ${activeFileIndex === idx ? 'text-blue-400' : 'text-slate-500'}`} />
                    <span className="font-mono font-medium truncate">{file.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 truncate pl-5">{file.path}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Kod Görüntüleyici Paneli */}
          <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800 bg-slate-900/40 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-200">{currentFile.name}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 text-[11px]">{currentFile.description}</span>
              </div>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copied ? 'Kopyalandı!' : 'Kodu Kopyala'}</span>
              </button>
            </div>

            {/* Kod Metni */}
            <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-300 select-text">
              <pre className="whitespace-pre">
                <code>{currentFile.code}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
