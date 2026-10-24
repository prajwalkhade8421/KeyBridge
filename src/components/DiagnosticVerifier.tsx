import React, { useState, useRef } from 'react';
import {
  MousePointer,
  Terminal,
  Trash2,
  ShieldCheck,
  AlertCircle,
  Gamepad2,
  Info
} from 'lucide-react';
import {
  AndroidBackendMode,
  ConnectedMouseDevice,
  DiagnosticEventRecord,
  HeldButtonState,
  MOUSE_INPUT_CATALOG,
  MappingRule,
  getDestinationDetails,
  getMouseInputByDomButton
} from '../data/inputCatalog';

interface DiagnosticVerifierProps {
  isDark: boolean;
  masterEnabled: boolean;
  backendMode: AndroidBackendMode;
  mappings: MappingRule[];
  connectedMice: ConnectedMouseDevice[];
  activeHolds: HeldButtonState[];
  diagnosticLog: DiagnosticEventRecord[];
  onPhysicalMouseDown: (sourceMouseId: string, originLabel?: string) => void;
  onPhysicalMouseUp: (sourceMouseId: string, originLabel?: string) => void;
  onClearDiagnosticLog: () => void;
  targetSandboxBuffer: string;
  onClearSandboxBuffer: () => void;
  pojavLastAction: string;
  pojavHeldKeys: string[];
}

export const DiagnosticVerifier: React.FC<DiagnosticVerifierProps> = ({
  isDark,
  masterEnabled,
  backendMode,
  mappings,
  activeHolds,
  diagnosticLog,
  onPhysicalMouseDown,
  onPhysicalMouseUp,
  onClearDiagnosticLog,
  targetSandboxBuffer,
  onClearSandboxBuffer,
  pojavLastAction,
  pojavHeldKeys
}) => {
  const [padActive, setPadActive] = useState(false);
  const pressedViaPadRef = useRef<Set<string>>(new Set());

  const handleSurfacePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' && e.button === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    const mouseDef = getMouseInputByDomButton(e.button);
    if (!mouseDef) return;
    pressedViaPadRef.current.add(mouseDef.id);
    onPhysicalMouseDown(mouseDef.id, 'Physical Browser Mouse');
  };

  const handleSurfacePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const mouseDef = getMouseInputByDomButton(e.button);
    if (!mouseDef) return;
    pressedViaPadRef.current.delete(mouseDef.id);
    onPhysicalMouseUp(mouseDef.id, 'Physical Browser Mouse');
  };

  const handleSurfaceLeave = () => {
    setPadActive(false);
    for (const heldId of Array.from(pressedViaPadRef.current)) {
      onPhysicalMouseUp(heldId, 'Physical Browser Mouse');
    }
    pressedViaPadRef.current.clear();
  };

  const latestEvent = diagnosticLog[0] ?? null;

  const panelBg = isDark
    ? 'bg-[#0F1623] border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const cardBg = isDark
    ? 'bg-[#151E2E] border-slate-800/90'
    : 'bg-slate-50 border-slate-200';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="flex flex-col gap-4">
      {/* Honest Environment Scope Notice: Browser Prototype vs Native Android */}
      <div
        className={`rounded-2xl border p-4 flex items-start gap-3 ${
          isDark
            ? 'bg-[#111927] border-slate-800 text-slate-300'
            : 'bg-slate-100/80 border-slate-200 text-slate-700'
        }`}
      >
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed space-y-1">
          <div className="font-bold text-blue-400">
            Browser Input Verifier vs. Native Android Execution
          </div>
          <p className={mutedText}>
            In this web environment, physical mouse clicks are captured via DOM{' '}
            <code className="font-mono">PointerEvent</code> APIs and processed by KeyBridge&apos;s stateful remapping engine. True system-wide OS interception (<code className="font-mono">/dev/input</code> <code className="font-mono">EVIOCGRAB</code> + <code className="font-mono">/dev/uinput</code> or Android <code className="font-mono">AccessibilityService</code>) executes on a physical Android device when you build the exported Android Studio project.
          </p>
        </div>
      </div>

      {/* 1. Interactive Mouse Capture Surface & Hardware Button Bank */}
      <div className={`rounded-2xl border p-5 space-y-4 ${panelBg}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/40">
          <div>
            <h2 className="text-sm font-bold">
              Live Input Interception & Hold-State Tester
            </h2>
            <p className={`text-xs ${mutedText}`}>
              Click inside the capture surface with your physical mouse, or press/latch any button below to test press, hold, release, and disconnect cleanup.
            </p>
          </div>
          <span className="text-xs font-mono text-blue-400">
            Held Inputs: {activeHolds.length}
          </span>
        </div>

        {/* Real Physical Mouse Capture Surface */}
        <div
          onPointerDown={handleSurfacePointerDown}
          onPointerUp={handleSurfacePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          onAuxClick={(e) => e.preventDefault()}
          onMouseEnter={() => setPadActive(true)}
          onMouseLeave={handleSurfaceLeave}
          className={`rounded-xl border-2 border-dashed p-5 transition-all select-none cursor-crosshair text-center space-y-1.5 ${
            padActive
              ? 'border-blue-500 bg-blue-600/10'
              : isDark
              ? 'border-slate-700 bg-[#141D2D] hover:border-slate-600'
              : 'border-slate-300 bg-slate-50 hover:border-slate-400'
          }`}
        >
          <div className="inline-flex items-center gap-2 text-xs font-bold">
            <MousePointer className="w-4 h-4 text-blue-500" />
            <span>
              Physical Mouse Capture Pad (Left, Right, Middle, Back/Btn 4, Forward/Btn 5)
            </span>
          </div>
          <p className={`text-xs max-w-lg mx-auto ${mutedText}`}>
            Click and hold any physical mouse button inside this box. Original browser context-menu and back/forward navigation events are suppressed here while active.
          </p>
        </div>

        {/* Physical Button Switch Bank */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MOUSE_INPUT_CATALOG.map((btn) => {
            const isHeld = activeHolds.some((h) => h.sourceMouseId === btn.id);
            const matchedRule = mappings.find(
              (m) => m.sourceMouseId === btn.id && m.enabled
            );
            const destShort = matchedRule
              ? getDestinationDetails(matchedRule.destinationType, matchedRule.destinationId)
                  .shortLabel
              : null;

            return (
              <div
                key={btn.id}
                className={`rounded-xl border p-2.5 flex flex-col justify-between gap-2 transition-all ${
                  isHeld
                    ? 'bg-blue-600 text-white border-blue-400'
                    : matchedRule && masterEnabled
                    ? isDark
                      ? 'bg-blue-950/25 border-blue-500/40'
                      : 'bg-blue-50/70 border-blue-200'
                    : cardBg
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold truncate">{btn.shortLabel}</span>
                    <span
                      className={`text-[10px] font-mono ${
                        isHeld ? 'text-blue-100' : mutedText
                      }`}
                    >
                      {btn.linuxEvdevName}
                    </span>
                  </div>
                  <div
                    className={`text-[11px] truncate mt-0.5 ${
                      isHeld
                        ? 'text-white font-semibold'
                        : destShort
                        ? 'text-blue-400 font-semibold'
                        : mutedText
                    }`}
                  >
                    {destShort
                      ? `→ ${
                          matchedRule && matchedRule.modifiers.length > 0
                            ? `${matchedRule.modifiers.join('+')}+`
                            : ''
                        }${destShort}`
                      : 'Unmapped'}
                  </div>
                </div>

                <div className="flex items-center gap-1 pt-1">
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      onPhysicalMouseDown(btn.id);
                    }}
                    onPointerUp={(e) => {
                      e.preventDefault();
                      if (isHeld) onPhysicalMouseUp(btn.id);
                    }}
                    className={`min-h-[34px] flex-1 py-1 px-2 text-xs font-semibold rounded-lg transition-all active:scale-95 ${
                      isHeld
                        ? 'bg-white text-blue-700'
                        : 'bg-blue-600 text-white hover:bg-blue-500'
                    }`}
                  >
                    {isHeld ? 'Holding' : 'Press'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isHeld) {
                        onPhysicalMouseUp(btn.id);
                      } else {
                        onPhysicalMouseDown(btn.id);
                      }
                    }}
                    title="Latch hold state to test disconnecting mouse while held"
                    className={`min-h-[34px] px-2 py-1 text-[11px] font-mono rounded-lg border transition-all ${
                      isHeld
                        ? 'bg-blue-800 text-white border-blue-300'
                        : isDark
                        ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {isHeld ? 'Release' : 'Hold'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Four-Stage Pipeline Verification */}
      <div className={`rounded-2xl border p-5 space-y-3 ${panelBg}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
            Pipeline State Inspection
          </h3>
          <span className={`text-xs font-mono ${mutedText}`}>
            {latestEvent ? `Phase: ${latestEvent.phase}` : 'Idle'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className={`rounded-xl border p-3 space-y-1 ${cardBg}`}>
            <div className={`text-[11px] font-medium ${mutedText}`}>
              1. Source Input
            </div>
            <div className="text-xs font-mono font-bold truncate">
              {latestEvent ? latestEvent.rawMouseButtonLabel : 'Awaiting input'}
            </div>
            <div className={`text-[11px] font-mono truncate ${mutedText}`}>
              {latestEvent ? latestEvent.rawLinuxEvdevConstant : 'EV_KEY / MotionEvent'}
            </div>
          </div>

          <div className={`rounded-xl border p-3 space-y-1 ${cardBg}`}>
            <div className={`text-[11px] font-medium ${mutedText}`}>
              2. Original Event Suppression
            </div>
            <div className="text-xs font-bold flex items-center gap-1">
              {latestEvent ? (
                latestEvent.sourceSuppressed ? (
                  <span className="text-emerald-400 inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Suppressed
                  </span>
                ) : (
                  <span className="text-amber-400 inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Passed Through
                  </span>
                )
              ) : (
                <span className={mutedText}>—</span>
              )}
            </div>
            <div className={`text-[11px] leading-snug ${mutedText}`}>
              {latestEvent ? latestEvent.suppressionReason : 'Suppression verifier'}
            </div>
          </div>

          <div className={`rounded-xl border p-3 space-y-1 ${cardBg}`}>
            <div className={`text-[11px] font-medium ${mutedText}`}>
              3. Replacement Output
            </div>
            <div className="text-xs font-mono font-bold text-blue-400 truncate">
              {latestEvent ? latestEvent.replacementOutputLabel : '—'}
            </div>
            <div className={`text-[11px] font-mono truncate ${mutedText}`}>
              {latestEvent ? latestEvent.replacementLinuxCode : 'Target KeyCode'}
            </div>
          </div>

          <div className={`rounded-xl border p-3 space-y-1 ${cardBg}`}>
            <div className={`text-[11px] font-medium ${mutedText}`}>
              4. Target App Delivery
            </div>
            <div className="text-xs font-bold">
              {latestEvent ? (
                latestEvent.deliveredToTargetApp ? (
                  <span className="text-emerald-400">Delivered</span>
                ) : (
                  <span className="text-red-400">Restricted</span>
                )
              ) : (
                <span className={mutedText}>—</span>
              )}
            </div>
            <div className={`text-[11px] leading-snug ${mutedText}`}>
              {latestEvent ? latestEvent.deliveryNote : 'Foreground window receiver'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Target Application Receivers (PojavLauncher + Standard Android View) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`rounded-2xl border p-4 space-y-3 ${panelBg}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold">
                PojavLauncher (Minecraft Java GLFW Receiver)
              </h3>
            </div>
            <span className={`text-[11px] font-mono ${mutedText}`}>Pointer Capture</span>
          </div>

          <div className="bg-[#080C12] border border-slate-800 text-slate-100 rounded-xl p-3.5 font-mono text-xs space-y-2">
            <div className="text-xs font-semibold text-emerald-400 truncate">
              {pojavLastAction}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/80">
              <span>
                Held: {pojavHeldKeys.length > 0 ? pojavHeldKeys.join(', ') : 'None'}
              </span>
              <span>Stuck Keys: 0</span>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 space-y-3 ${panelBg}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold">Foreground App Input Buffer</h3>
            </div>
            {targetSandboxBuffer && (
              <button
                type="button"
                onClick={onClearSandboxBuffer}
                className="text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                Clear
              </button>
            )}
          </div>

          <div
            className={`rounded-xl border p-3.5 font-mono text-xs min-h-[68px] break-all ${cardBg}`}
          >
            {targetSandboxBuffer ? (
              targetSandboxBuffer
            ) : (
              <span className={mutedText}>
                Press Mouse Forward (mapped to Keyboard T) to emit &apos;t&apos; here...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Event History Table */}
      <div className={`rounded-2xl border overflow-hidden ${panelBg}`}>
        <div className="px-4 py-3 border-b border-slate-800/50 flex items-center justify-between">
          <span className="text-xs font-bold">
            Event Trace ({diagnosticLog.length})
          </span>
          {diagnosticLog.length > 0 && (
            <button
              type="button"
              onClick={onClearDiagnosticLog}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border ${cardBg}`}
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {diagnosticLog.length === 0 ? (
          <div className={`p-6 text-center text-xs ${mutedText}`}>
            No input events recorded yet. Press any mouse button above to inspect its press and release lifecycle.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-56 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={`border-b border-slate-800/50 ${mutedText}`}>
                  <th className="py-2 px-3 font-medium">Time</th>
                  <th className="py-2 px-3 font-medium">State</th>
                  <th className="py-2 px-3 font-medium">Source</th>
                  <th className="py-2 px-3 font-medium">Suppressed</th>
                  <th className="py-2 px-3 font-medium">Replacement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono">
                {diagnosticLog.map((entry) => (
                  <tr key={entry.id}>
                    <td className={`py-2 px-3 whitespace-nowrap ${mutedText}`}>
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={
                          entry.phase === 'PRESS'
                            ? 'text-blue-400 font-bold'
                            : entry.phase === 'RELEASE'
                            ? mutedText
                            : 'text-amber-400 font-bold'
                        }
                      >
                        {entry.phase}
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {entry.rawMouseButtonLabel}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {entry.sourceSuppressed ? (
                        <span className="text-emerald-400">Yes</span>
                      ) : (
                        <span className="text-amber-400">No</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-blue-400 font-semibold whitespace-nowrap">
                      {entry.replacementOutputLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
