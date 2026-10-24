import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  FileCode2,
  Smartphone,
  Cloud,
  Terminal,
  PackageCheck
} from 'lucide-react';
import { ANDROID_STUDIO_SOURCE_FILES, AndroidSourceFile } from '../data/androidStudioProject';
import { MappingRule } from '../data/inputCatalog';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidProjectExporterProps {
  isDark: boolean;
  currentMappings: MappingRule[];
  onExportZip: () => Promise<void>;
  onExportJsonBundle: () => void;
}

export const AndroidProjectExporter: React.FC<AndroidProjectExporterProps> = ({
  isDark,
  currentMappings,
  onExportZip,
  onExportJsonBundle
}) => {
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [isGeneratingZip, setIsGeneratingZip] = useState<boolean>(false);
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const activeFile: AndroidSourceFile =
    ANDROID_STUDIO_SOURCE_FILES[selectedFileIndex] ?? ANDROID_STUDIO_SOURCE_FILES[0];

  const handleCopyCode = async (file: AndroidSourceFile) => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopiedPath(file.path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      setCopiedPath(file.path);
      setTimeout(() => setCopiedPath(null), 2000);
    }
  };

  const handleDownloadSingleFile = (file: AndroidSourceFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTriggerZipDownload = async () => {
    setIsGeneratingZip(true);
    try {
      await onExportZip();
    } finally {
      setIsGeneratingZip(false);
    }
  };

  const panelBg = isDark
    ? 'bg-[#0F1623] border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const cardBg = isDark
    ? 'bg-[#151E2E] border-slate-800/90 text-slate-200'
    : 'bg-slate-50 border-slate-200 text-slate-800';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <section id="android-project-section" className="space-y-5">
      {/* APK Export & Installation Center */}
      <div className={`rounded-2xl border p-5 sm:p-6 space-y-5 ${panelBg}`}>
        <div className="space-y-1.5 max-w-3xl">
          <h2 className="text-lg sm:text-xl font-bold">
            Export APK & Install KeyBridge on Android
          </h2>
          <p className={`text-xs sm:text-sm leading-relaxed ${mutedText}`}>
            Because a web browser tab cannot run the 4 GB Android SDK & C++ NDK binary compiler directly inside the browser sandbox, KeyBridge provides <strong>three ways</strong> to get the app onto your Android phone—with your <strong>{currentMappings.length} saved mapping(s)</strong> pre-baked into the code:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Method 1: Download ZIP + Cloud GitHub Actions APK Compiler */}
          <div className={`rounded-xl border p-4 flex flex-col justify-between gap-4 ${cardBg}`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <Cloud className="w-4 h-4 shrink-0" />
                <span>1. Native APK (.zip + Cloud Builder)</span>
              </div>
              <h3 className="text-sm font-bold">
                Download Complete Android Studio ZIP
              </h3>
              <p className={`text-xs leading-relaxed ${mutedText}`}>
                Contains the full Kotlin + C++ <code className="font-mono">uinput</code> project with your {currentMappings.length} saved mapping(s) pre-configured, plus a <code className="font-mono">.github/workflows/build-apk.yml</code> script that compiles <code className="font-mono">app-debug.apk</code> automatically on GitHub Actions (no PC needed).
              </p>
            </div>

            <button
              type="button"
              data-ui-control="true"
              onClick={handleTriggerZipDownload}
              disabled={isGeneratingZip}
              className="min-h-[42px] w-full px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>
                {isGeneratingZip
                  ? 'Packaging ZIP...'
                  : 'Download Android Project (.zip)'}
              </span>
            </button>
          </div>

          {/* Method 2: Install Direct Android WebAPK / Standalone PWA */}
          <div className={`rounded-xl border p-4 flex flex-col justify-between gap-4 ${cardBg}`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>2. Instant Standalone WebAPK</span>
              </div>
              <h3 className="text-sm font-bold">
                Install Directly to Phone Home Screen
              </h3>
              <p className={`text-xs leading-relaxed ${mutedText}`}>
                KeyBridge includes a full Web App Manifest and offline Service Worker. On Android Chrome, installing creates a standalone <strong>WebAPK</strong> in your app drawer that works offline without a browser bar.
              </p>
            </div>

            {isInstalled ? (
              <div className="min-h-[42px] w-full px-4 py-2.5 text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center justify-center gap-2">
                <PackageCheck className="w-4 h-4" />
                <span>Installed in Standalone Mode</span>
              </div>
            ) : isInstallable ? (
              <button
                type="button"
                data-ui-control="true"
                onClick={install}
                className="min-h-[42px] w-full px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                <span>Install App Now (WebAPK)</span>
              </button>
            ) : isIOS ? (
              <button
                type="button"
                data-ui-control="true"
                onClick={() => setShowIOSGuide(true)}
                className="min-h-[42px] w-full px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                <span>Install on iOS / Safari</span>
              </button>
            ) : (
              <div
                className={`p-2.5 rounded-xl border text-[11px] leading-snug ${
                  isDark
                    ? 'bg-[#090D16] border-slate-800 text-slate-300'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                Open the app URL in <strong>Chrome on Android</strong> (outside the preview frame) and tap <strong>Install App</strong> or <strong>Add to Home screen</strong> to generate the WebAPK.
              </div>
            )}
          </div>

          {/* Method 3: Local Gradle / ADB Build */}
          <div className={`rounded-xl border p-4 flex flex-col justify-between gap-4 ${cardBg}`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Terminal className="w-4 h-4 shrink-0" />
                <span>3. Local Gradle CLI Build</span>
              </div>
              <h3 className="text-sm font-bold">
                Build Signed APK via Gradle / ADB
              </h3>
              <p className={`text-xs leading-relaxed ${mutedText}`}>
                Unzip <code className="font-mono">KeyBridge-Android-APK-Project.zip</code> in Android Studio or run Gradle from your terminal to output <code className="font-mono">app-debug.apk</code>:
              </p>
              <pre className="p-2.5 rounded-lg bg-[#080C12] border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
                <code>{`./gradlew assembleDebug\nadb install -r app/build/outputs/apk/debug/app-debug.apk`}</code>
              </pre>
            </div>

            <button
              type="button"
              data-ui-control="true"
              onClick={onExportJsonBundle}
              className={`min-h-[42px] w-full px-4 py-2 text-xs font-semibold rounded-xl border transition-all active:scale-95 flex items-center justify-center gap-2 ${
                isDark
                  ? 'bg-[#090D16] border-slate-700 text-slate-200 hover:bg-slate-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Raw JSON Source Bundle</span>
            </button>
          </div>
        </div>

        {showIOSGuide && (
          <div className="p-4 rounded-xl border border-blue-500/40 bg-blue-950/20 text-xs space-y-2">
            <div className="font-bold text-blue-400">Install on iOS Safari:</div>
            <p className={mutedText}>
              1. Tap the <strong>Share</strong> button in the Safari toolbar. 2. Scroll down and tap <strong>Add to Home Screen</strong>.
            </p>
            <button
              type="button"
              data-ui-control="true"
              onClick={() => setShowIOSGuide(false)}
              className="px-3 py-1 rounded-lg bg-blue-600 text-white font-semibold"
            >
              Got it
            </button>
          </div>
        )}
      </div>

      {/* Native Source Code Explorer */}
      <div className={`rounded-2xl border p-5 sm:p-6 space-y-5 ${panelBg}`}>
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800/50">
          <div className="space-y-1 max-w-2xl">
            <h2 className="text-base sm:text-lg font-bold">
              Inspect Native Android Studio Source Files ({ANDROID_STUDIO_SOURCE_FILES.length})
            </h2>
            <p className={`text-xs ${mutedText}`}>
              All files below are packaged inside <code className="font-mono">KeyBridge-Android-APK-Project.zip</code>.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 space-y-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
              {ANDROID_STUDIO_SOURCE_FILES.map((file, idx) => {
                const isSelected = idx === selectedFileIndex;
                return (
                  <button
                    key={file.path}
                    type="button"
                    data-ui-control="true"
                    onClick={() => setSelectedFileIndex(idx)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-500'
                        : `${cardBg} hover:border-slate-700`
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold truncate flex items-center gap-1.5">
                        <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                        {file.filename}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase ${
                          isSelected ? 'text-blue-100' : mutedText
                        }`}
                      >
                        {file.language}
                      </span>
                    </div>
                    <div
                      className={`text-[11px] truncate font-mono ${
                        isSelected ? 'text-blue-100' : mutedText
                      }`}
                    >
                      {file.path}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-col border border-slate-800 rounded-2xl overflow-hidden bg-[#080C12] text-slate-100">
            <div className="px-4 py-3 bg-[#0D131F] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-mono font-bold text-white truncate">
                  {activeFile.path}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {activeFile.summary}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  data-ui-control="true"
                  onClick={() => handleCopyCode(activeFile)}
                  className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  {copiedPath === activeFile.path ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  type="button"
                  data-ui-control="true"
                  onClick={() => handleDownloadSingleFile(activeFile)}
                  className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>

            <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto overflow-y-auto max-h-[540px] text-slate-200">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
};
