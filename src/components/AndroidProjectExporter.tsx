import React, { useState } from 'react';
import { Copy, Check, Download, FileCode2 } from 'lucide-react';
import { ANDROID_STUDIO_SOURCE_FILES, AndroidSourceFile } from '../data/androidStudioProject';
import { MappingRule } from '../data/inputCatalog';

interface AndroidProjectExporterProps {
  isDark: boolean;
  currentMappings: MappingRule[];
  onExportBundle: () => void;
}

export const AndroidProjectExporter: React.FC<AndroidProjectExporterProps> = ({
  isDark,
  currentMappings,
  onExportBundle
}) => {
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

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

  const panelBg = isDark
    ? 'bg-[#0F1623] border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const cardBg = isDark
    ? 'bg-[#151E2E] border-slate-800/90 text-slate-200 hover:border-slate-700'
    : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <section id="android-project-section" className="space-y-5">
      <div className={`rounded-2xl border p-5 sm:p-6 space-y-5 ${panelBg}`}>
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800/50">
          <div className="space-y-1 max-w-2xl">
            <h2 className="text-lg sm:text-xl font-bold">
              Android Studio Project & Native Source Code
            </h2>
            <p className={`text-xs sm:text-sm ${mutedText}`}>
              Inspect or download the complete native Android Studio implementation (Kotlin Jetpack Compose Material 3, Jetpack DataStore, <code className="font-mono text-xs">InputManager.InputDeviceListener</code>, JNI <code className="font-mono text-xs">uinput_bridge.cpp</code>, and <code className="font-mono text-xs">AccessibilityService</code>). Your {currentMappings.length} saved mapping rule(s) are included in the exported bundle.
            </p>
          </div>

          <button
            type="button"
            onClick={onExportBundle}
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all active:scale-95 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            Download Full Project Bundle (.json)
          </button>
        </div>

        {/* File Selector + Source Viewer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: File List */}
          <div className="lg:col-span-4 space-y-1.5">
            <div className={`text-xs font-bold pb-1 ${mutedText}`}>
              Project Files ({ANDROID_STUDIO_SOURCE_FILES.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
              {ANDROID_STUDIO_SOURCE_FILES.map((file, idx) => {
                const isSelected = idx === selectedFileIndex;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setSelectedFileIndex(idx)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-500'
                        : cardBg
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

          {/* Right Column: Active Code Viewer */}
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
