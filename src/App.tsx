import React, { useState, useEffect, useCallback } from 'react';
import {
  AndroidBackendMode,
  ConnectedMouseDevice,
  DiagnosticEventRecord,
  HeldButtonState,
  MappingRule,
  getDestinationDetails,
  getKeyboardInputById,
  getMouseInputByDomButton,
  getMouseInputById
} from './data/inputCatalog';
import { ANDROID_STUDIO_SOURCE_FILES } from './data/androidStudioProject';
import { MinimalAndroidApp } from './components/MinimalAndroidApp';
import { DiagnosticVerifier } from './components/DiagnosticVerifier';
import { FeasibilityReportView } from './components/FeasibilityReportView';
import { AndroidProjectExporter } from './components/AndroidProjectExporter';
import { downloadAndroidStudioZip } from './utils/exportAndroidZip';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  Sun,
  Moon,
  Smartphone,
  Activity,
  ShieldCheck,
  Code2,
  Columns2,
  Trash2,
  Zap,
  Download,
  Package
} from 'lucide-react';

// Clean v2 storage key so no pre-given examples are ever loaded
const STORAGE_KEY_MAPPINGS = 'keybridge_datastore_mappings_v2';
const STORAGE_KEY_MASTER = 'keybridge_datastore_master_v2';
const STORAGE_KEY_BACKEND = 'keybridge_datastore_backend_v2';
const STORAGE_KEY_THEME = 'keybridge_datastore_theme_v2';
const STORAGE_KEY_REDUCE_MOTION = 'keybridge_datastore_reduce_motion_v2';
const STORAGE_KEY_TECH_CODES = 'keybridge_datastore_tech_codes_v2';

type WorkspaceTab = 'WORKBENCH' | 'APP_ONLY' | 'VERIFIER_ONLY' | 'FEASIBILITY' | 'SOURCE';

export default function App() {
  // 1. Theme & Accessibility Preferences (Dark Theme default)
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [reduceMotion, setReduceMotion] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REDUCE_MOTION);
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [showTechnicalCodes, setShowTechnicalCodes] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TECH_CODES);
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('WORKBENCH');
  const [isWizardConfiguring, setIsWizardConfiguring] = useState<boolean>(false);
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();

  // 2. Persistent DataStore State (Starts completely empty — no pre-given examples)
  const [masterEnabled, setMasterEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MASTER);
      return raw !== null ? JSON.parse(raw) : true;
    } catch {
      return true;
    }
  });

  const [mappings, setMappings] = useState<MappingRule[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MAPPINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [backendMode, setBackendMode] = useState<AndroidBackendMode>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_BACKEND) as AndroidBackendMode | null;
      if (
        raw === 'HYBRID_UINPUT' ||
        raw === 'STOCK_ACCESSIBILITY' ||
        raw === 'RESTRICTED_UNAVAILABLE'
      ) {
        return raw;
      }
    } catch {
      // ignore
    }
    return 'HYBRID_UINPUT';
  });

  // Sync preferences and DataStore to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, JSON.stringify(isDark));
    } catch {
      // ignore
    }
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_REDUCE_MOTION, JSON.stringify(reduceMotion));
    } catch {
      // ignore
    }
  }, [reduceMotion]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TECH_CODES, JSON.stringify(showTechnicalCodes));
    } catch {
      // ignore
    }
  }, [showTechnicalCodes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(masterEnabled));
    } catch {
      // ignore
    }
  }, [masterEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MAPPINGS, JSON.stringify(mappings));
    } catch {
      // ignore
    }
  }, [mappings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BACKEND, backendMode);
    } catch {
      // ignore
    }
  }, [backendMode]);

  // 3. Dynamic Connected Mouse State
  const [connectedMice, setConnectedMice] = useState<ConnectedMouseDevice[]>([]);
  const [appUiClosed, setAppUiClosed] = useState<boolean>(false);
  const [lastLifecycleMessage, setLastLifecycleMessage] = useState<string | null>(null);

  // 4. Stateful Remapping Engine & Live Redirect State
  const [activeHolds, setActiveHolds] = useState<HeldButtonState[]>([]);
  const [diagnosticLog, setDiagnosticLog] = useState<DiagnosticEventRecord[]>([]);
  const [targetSandboxBuffer, setTargetSandboxBuffer] = useState<string>('');
  const [pojavLastAction, setPojavLastAction] = useState<string>(
    'Waiting for mapped mouse input...'
  );
  const [pojavHeldKeys, setPojavHeldKeys] = useState<string[]>([]);
  const [liveHudBanner, setLiveHudBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!liveHudBanner) return;
    const timer = setTimeout(() => setLiveHudBanner(null), 1800);
    return () => clearTimeout(timer);
  }, [liveHudBanner]);

  // Upsert mapping rule
  const handleSaveMapping = useCallback(
    (
      newRuleData: Omit<MappingRule, 'id' | 'createdAt' | 'updatedAt'>,
      existingId?: string
    ) => {
      const now = Date.now();
      setMappings((prev) => {
        const filtered = prev.filter(
          (r) => r.id !== existingId && r.sourceMouseId !== newRuleData.sourceMouseId
        );
        const created: MappingRule = {
          id: existingId ?? `rule-${now}-${Math.random().toString(36).slice(2, 7)}`,
          ...newRuleData,
          createdAt: now,
          updatedAt: now
        };
        return [...filtered, created];
      });
      const srcLabel =
        getMouseInputById(newRuleData.sourceMouseId)?.shortLabel ?? newRuleData.sourceMouseId;
      const dstLabel = getDestinationDetails(
        newRuleData.destinationType,
        newRuleData.destinationId
      ).shortLabel;
      setLastLifecycleMessage(
        `Saved (${srcLabel} → ${dstLabel}) to DataStore. Active globally across the window.`
      );
    },
    []
  );

  const handleToggleRuleEnabled = useCallback((id: string) => {
    setMappings((prev) =>
      prev.map((rule) =>
        rule.id === id ? { ...rule, enabled: !rule.enabled, updatedAt: Date.now() } : rule
      )
    );
  }, []);

  const handleDeleteMapping = useCallback((id: string) => {
    setMappings((prev) => prev.filter((r) => r.id !== id));
    setLastLifecycleMessage('Deleted mapping permanently from DataStore.');
  }, []);

  const handleClearAllMappings = () => {
    setMappings([]);
    setActiveHolds([]);
    setPojavHeldKeys([]);
    setLastLifecycleMessage('Cleared all saved mappings.');
  };

  // Connect a universal USB OTG or Bluetooth HID mouse dynamically
  const handleConnectMouse = useCallback(
    (transport: 'USB OTG' | 'Bluetooth HID') => {
      const newDeviceId = 100 + Math.floor(Math.random() * 899);
      const newDevice: ConnectedMouseDevice = {
        deviceId: newDeviceId,
        name:
          transport === 'USB OTG'
            ? 'USB Optical HID Mouse'
            : 'Bluetooth 5.1 Wireless HID Mouse',
        transport,
        sources: 'InputDevice.SOURCE_MOUSE | SOURCE_MOUSE_RELATIVE',
        exposedButtons: [
          'BUTTON_PRIMARY',
          'BUTTON_SECONDARY',
          'BUTTON_TERTIARY',
          'BUTTON_BACK',
          'BUTTON_FORWARD',
          'BTN_FORWARD',
          'BTN_BACK',
          'BTN_TASK'
        ],
        connectedAt: Date.now()
      };
      setConnectedMice((prev) => [...prev, newDevice]);
      setLastLifecycleMessage(
        `InputManager.onInputDeviceAdded(id=${newDeviceId}): ${newDevice.name} connected.`
      );
    },
    []
  );

  // Disconnect mouse & perform mandatory stuck-key release cleanup
  const handleDisconnectMouse = useCallback(
    (deviceId: number) => {
      const targetDevice = connectedMice.find((m) => m.deviceId === deviceId);
      setConnectedMice((prev) => prev.filter((m) => m.deviceId !== deviceId));

      setActiveHolds((prevHolds) => {
        if (prevHolds.length === 0) return prevHolds;

        const now = Date.now();
        const cleanupRecords: DiagnosticEventRecord[] = prevHolds.map((hold) => {
          const srcDef = getMouseInputById(hold.sourceMouseId);
          return {
            id: `ev-cleanup-${now}-${hold.sourceMouseId}`,
            timestamp: now,
            phase: 'DISCONNECT_CLEANUP',
            deviceName: targetDevice?.name ?? hold.deviceName,
            rawMouseButtonLabel: srcDef?.shortLabel ?? hold.sourceMouseId,
            rawAndroidMotionConstant: srcDef?.androidMotionConstant ?? 'MotionEvent',
            rawLinuxEvdevConstant: srcDef?.linuxEvdevName ?? 'BTN_MOUSE',
            matchedRuleId: hold.ruleId,
            sourceSuppressed: hold.suppressedOriginal,
            suppressionReason: 'Mouse disconnected mid-hold: forced synthetic EV_KEY 0 / ACTION_UP',
            replacementOutputLabel: `${hold.resolvedTargetLabel} (AUTO-RELEASED)`,
            replacementAndroidCode: hold.resolvedAndroidCode,
            replacementLinuxCode: hold.resolvedLinuxCode,
            deliveredToTargetApp: true,
            deliveryNote: 'Prevented stuck key on physical disconnect'
          };
        });

        setDiagnosticLog((prevLog) => [...cleanupRecords, ...prevLog].slice(0, 50));
        setPojavHeldKeys([]);
        setPojavLastAction('Disconnect Watchdog: Released all held keys (0 stuck keys)');
        return [];
      });

      setLastLifecycleMessage(
        `InputManager.onInputDeviceRemoved(id=${deviceId}): Mouse disconnected. Mappings remain saved.`
      );
    },
    [connectedMice]
  );

  // Simulate Phone Restart (BOOT_COMPLETED)
  const handleSimulatePhoneReboot = useCallback(() => {
    setActiveHolds([]);
    setPojavHeldKeys([]);
    const persistedMappingsRaw = localStorage.getItem(STORAGE_KEY_MAPPINGS);
    const persistedMasterRaw = localStorage.getItem(STORAGE_KEY_MASTER);
    const reloadedMappings: MappingRule[] = persistedMappingsRaw
      ? JSON.parse(persistedMappingsRaw)
      : mappings;
    const reloadedMaster: boolean = persistedMasterRaw
      ? JSON.parse(persistedMasterRaw)
      : masterEnabled;

    setMappings(reloadedMappings);
    setMasterEnabled(reloadedMaster);
    setLastLifecycleMessage(
      `ACTION_BOOT_COMPLETED: Phone restarted. Restored ${reloadedMappings.length} saved mapping(s) from DataStore.`
    );
  }, [mappings, masterEnabled]);

  // Core Physical Mouse Interception & Replacement Handler (PRESS)
  const handlePhysicalMouseDown = useCallback(
    (sourceMouseId: string, originLabel?: string) => {
      const now = Date.now();
      const sourceDef = getMouseInputById(sourceMouseId);
      if (!sourceDef) return;

      let activeDevice = connectedMice[0];
      if (!activeDevice) {
        activeDevice = {
          deviceId: 204,
          name: originLabel ?? 'USB/BT HID Mouse (Auto-Detected)',
          transport: 'USB OTG',
          sources: 'InputDevice.SOURCE_MOUSE',
          exposedButtons: [
            'BUTTON_PRIMARY',
            'BUTTON_SECONDARY',
            'BUTTON_TERTIARY',
            'BUTTON_BACK',
            'BUTTON_FORWARD'
          ],
          connectedAt: now
        };
        setConnectedMice([activeDevice]);
      }

      if (activeHolds.some((h) => h.sourceMouseId === sourceMouseId)) {
        return;
      }

      const matchedRule = mappings.find(
        (m) => m.sourceMouseId === sourceMouseId && m.enabled
      );

      if (!masterEnabled || !matchedRule || backendMode === 'RESTRICTED_UNAVAILABLE') {
        return;
      }

      if (backendMode === 'STOCK_ACCESSIBILITY' && !sourceDef.stockInterceptableViaKeyEvent) {
        const record: DiagnosticEventRecord = {
          id: `ev-${now}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: now,
          phase: 'PRESS',
          deviceName: activeDevice.name,
          rawMouseButtonLabel: sourceDef.shortLabel,
          rawAndroidMotionConstant: sourceDef.androidMotionConstant,
          rawLinuxEvdevConstant: sourceDef.linuxEvdevName,
          matchedRuleId: matchedRule.id,
          sourceSuppressed: false,
          suppressionReason:
            'Stock AccessibilityService.onKeyEvent() does not receive raw MotionEvent mouse clicks',
          replacementOutputLabel: 'Requires Hybrid Root/Shizuku uinput',
          replacementAndroidCode: sourceDef.androidMotionConstant,
          replacementLinuxCode: sourceDef.linuxEvdevName,
          deliveredToTargetApp: false,
          deliveryNote: 'Switch to Hybrid uinput mode for Left/Right/Middle replacement'
        };
        setDiagnosticLog((prev) => [record, ...prev].slice(0, 50));
        return;
      }

      const destDetails = getDestinationDetails(
        matchedRule.destinationType,
        matchedRule.destinationId
      );
      const modPrefix =
        matchedRule.modifiers.length > 0 ? `${matchedRule.modifiers.join('+')}+` : '';
      const fullTargetLabel = `${modPrefix}${destDetails.shortLabel}`;

      const holdEntry: HeldButtonState = {
        sourceMouseId,
        deviceId: activeDevice.deviceId,
        deviceName: activeDevice.name,
        pressedAt: now,
        ruleId: matchedRule.id,
        resolvedTargetLabel: fullTargetLabel,
        resolvedAndroidCode: destDetails.androidCode,
        resolvedLinuxCode: destDetails.linuxCode,
        modifiers: matchedRule.modifiers,
        suppressedOriginal: true
      };
      setActiveHolds((prev) => [...prev, holdEntry]);

      const record: DiagnosticEventRecord = {
        id: `ev-${now}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        phase: 'PRESS',
        deviceName: activeDevice.name,
        rawMouseButtonLabel: sourceDef.shortLabel,
        rawAndroidMotionConstant: sourceDef.androidMotionConstant,
        rawLinuxEvdevConstant: sourceDef.linuxEvdevName,
        matchedRuleId: matchedRule.id,
        sourceSuppressed: true,
        suppressionReason: `Suppressed ${sourceDef.linuxEvdevName}`,
        replacementOutputLabel: `${fullTargetLabel} DOWN`,
        replacementAndroidCode: destDetails.androidCode,
        replacementLinuxCode: destDetails.linuxCode,
        deliveredToTargetApp: true,
        deliveryNote: `Redirected ${sourceDef.shortLabel} → ${fullTargetLabel}`
      };

      setDiagnosticLog((prev) => [record, ...prev].slice(0, 50));
      setLiveHudBanner(`Redirected: ${sourceDef.shortLabel} → ${fullTargetLabel}`);

      setPojavHeldKeys((prev) =>
        prev.includes(fullTargetLabel) ? prev : [...prev, fullTargetLabel]
      );
      setPojavLastAction(
        `Received: ${fullTargetLabel} [from ${sourceDef.shortLabel}]`
      );

      // Dispatch a real synthesized KeyboardEvent to the active window/element
      if (matchedRule.destinationType === 'KEYBOARD') {
        const keyDef = getKeyboardInputById(matchedRule.destinationId);
        if (keyDef) {
          const synthEvent = new KeyboardEvent('keydown', {
            key: keyDef.printableChar ?? keyDef.keyCap,
            code: keyDef.domKeyCode,
            ctrlKey: matchedRule.modifiers.includes('CTRL'),
            shiftKey: matchedRule.modifiers.includes('SHIFT'),
            altKey: matchedRule.modifiers.includes('ALT'),
            metaKey: matchedRule.modifiers.includes('META'),
            bubbles: true
          });
          (document.activeElement ?? window).dispatchEvent(synthEvent);
        }
      }

      if (destDetails.printableChar) {
        const charOut = matchedRule.modifiers.includes('SHIFT')
          ? destDetails.printableChar.toUpperCase()
          : destDetails.printableChar;
        setTargetSandboxBuffer((prev) => prev + charOut);
      } else {
        setTargetSandboxBuffer((prev) => `${prev}[${fullTargetLabel}] `);
      }
    },
    [activeHolds, backendMode, connectedMice, mappings, masterEnabled]
  );

  // Core Physical Mouse Interception & Replacement Handler (RELEASE)
  const handlePhysicalMouseUp = useCallback(
    (sourceMouseId: string, originLabel?: string) => {
      const now = Date.now();
      const sourceDef = getMouseInputById(sourceMouseId);
      if (!sourceDef) return;

      const existingHold = activeHolds.find((h) => h.sourceMouseId === sourceMouseId);
      if (!existingHold) return;

      setActiveHolds((prev) => prev.filter((h) => h.sourceMouseId !== sourceMouseId));

      const holdDurationMs = Math.max(1, now - existingHold.pressedAt);

      const record: DiagnosticEventRecord = {
        id: `ev-up-${now}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        phase: 'RELEASE',
        deviceName: originLabel ?? existingHold.deviceName,
        rawMouseButtonLabel: sourceDef.shortLabel,
        rawAndroidMotionConstant: sourceDef.androidMotionConstant,
        rawLinuxEvdevConstant: sourceDef.linuxEvdevName,
        matchedRuleId: existingHold.ruleId,
        sourceSuppressed: existingHold.suppressedOriginal,
        suppressionReason: `Original ${sourceDef.linuxEvdevName} release suppressed`,
        replacementOutputLabel: `${existingHold.resolvedTargetLabel} UP (${holdDurationMs}ms)`,
        replacementAndroidCode: existingHold.resolvedAndroidCode,
        replacementLinuxCode: existingHold.resolvedLinuxCode,
        deliveredToTargetApp: true,
        deliveryNote: `Emitted ACTION_UP / EV_KEY=0 after ${holdDurationMs}ms hold`
      };

      setDiagnosticLog((prev) => [record, ...prev].slice(0, 50));
      setPojavHeldKeys((prev) =>
        prev.filter((k) => k !== existingHold.resolvedTargetLabel)
      );
      setPojavLastAction(
        `Released: ${existingHold.resolvedTargetLabel} (Held ${holdDurationMs}ms)`
      );
    },
    [activeHolds]
  );

  // GLOBAL WINDOW-WIDE MOUSE REDIRECT LISTENER:
  // Once a mapping is saved, clicking that mouse button ANYWHERE in the window redirects it into the target key!
  // Clicking UI buttons (Add, Edit, Delete, Save, Next, Tabs) by hand with Left Click is preserved so you can always control the app.
  useEffect(() => {
    if (!masterEnabled || isWizardConfiguring) return;

    const handleGlobalWindowMouseDown = (e: MouseEvent) => {
      const mouseDef = getMouseInputByDomButton(e.button);
      if (!mouseDef) return;

      const matchedRule = mappings.find(
        (m) => m.sourceMouseId === mouseDef.id && m.enabled
      );
      if (!matchedRule) return;

      // Always allow clicking UI control buttons by hand with Left Click (button 0)
      const targetEl = e.target as HTMLElement | null;
      if (
        e.button === 0 &&
        targetEl?.closest('button, a, select, [data-ui-control="true"], [role="switch"]')
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      handlePhysicalMouseDown(mouseDef.id, 'Global Window Mouse Listener');
    };

    const handleGlobalWindowMouseUp = (e: MouseEvent) => {
      const mouseDef = getMouseInputByDomButton(e.button);
      if (!mouseDef) return;

      const isCurrentlyHeld = activeHolds.some((h) => h.sourceMouseId === mouseDef.id);
      if (!isCurrentlyHeld) return;

      e.preventDefault();
      e.stopPropagation();
      handlePhysicalMouseUp(mouseDef.id, 'Global Window Mouse Listener');
    };

    const handleGlobalContextMenu = (e: MouseEvent) => {
      const rightRule = mappings.find(
        (m) => m.sourceMouseId === 'MOUSE_RIGHT' && m.enabled
      );
      if (rightRule) {
        e.preventDefault();
      }
    };

    const handleGlobalAuxClick = (e: MouseEvent) => {
      const mouseDef = getMouseInputByDomButton(e.button);
      if (!mouseDef) return;
      const matchedRule = mappings.find(
        (m) => m.sourceMouseId === mouseDef.id && m.enabled
      );
      if (matchedRule) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('mousedown', handleGlobalWindowMouseDown, { capture: true });
    window.addEventListener('mouseup', handleGlobalWindowMouseUp, { capture: true });
    window.addEventListener('contextmenu', handleGlobalContextMenu, { capture: true });
    window.addEventListener('auxclick', handleGlobalAuxClick, { capture: true });

    return () => {
      window.removeEventListener('mousedown', handleGlobalWindowMouseDown, {
        capture: true
      });
      window.removeEventListener('mouseup', handleGlobalWindowMouseUp, {
        capture: true
      });
      window.removeEventListener('contextmenu', handleGlobalContextMenu, {
        capture: true
      });
      window.removeEventListener('auxclick', handleGlobalAuxClick, { capture: true });
    };
  }, [
    activeHolds,
    handlePhysicalMouseDown,
    handlePhysicalMouseUp,
    isWizardConfiguring,
    mappings,
    masterEnabled
  ]);

  // Export Complete Android Studio Project + Active Mappings JSON Bundle
  const handleExportAndroidBundle = () => {
    const bundlePayload = {
      project: 'KeyBridge Android Mouse Remapper',
      packageName: 'dev.keybridge.remapper',
      architecture: 'Hybrid (Kernel evdev/uinput + Stock AccessibilityService/IME)',
      exportedAt: new Date().toISOString(),
      configuredMappingsSeed: mappings,
      sourceFiles: ANDROID_STUDIO_SOURCE_FILES
    };
    const blob = new Blob([JSON.stringify(bundlePayload, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'KeyBridge-AndroidStudio-Project-Bundle.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const rootThemeClass = isDark
    ? 'bg-[#090D16] text-slate-100'
    : 'bg-slate-50 text-slate-900';

  const headerThemeClass = isDark
    ? 'bg-[#090D16]/90 border-slate-800/80 text-slate-100'
    : 'bg-white/95 border-slate-200 text-slate-900';

  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-150 ${rootThemeClass} ${
        reduceMotion ? 'reduce-motion' : ''
      }`}
    >
      {/* Floating Live Redirect HUD Pill when a mapped mouse button is clicked anywhere */}
      {liveHudBanner && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-mono font-bold shadow-lg flex items-center gap-2 pointer-events-none">
          <Zap className="w-4 h-4 text-amber-300" />
          <span>{liveHudBanner}</span>
        </div>
      )}

      {/* Strict 3-Zone Top Navigation Bar */}
      <header
        className={`sticky top-0 z-30 backdrop-blur-md border-b px-4 sm:px-6 py-3.5 ${headerThemeClass}`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#workbench-top"
            data-ui-control="true"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('WORKBENCH');
            }}
            className="text-lg font-bold tracking-tight font-display whitespace-nowrap shrink-0"
          >
            KeyBridge
          </a>

          {/* Zone 2: 4 concise single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a
              href="#workbench"
              data-ui-control="true"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('WORKBENCH');
              }}
              className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'WORKBENCH' || activeTab === 'APP_ONLY'
                  ? 'text-blue-400 font-semibold'
                  : mutedText
              }`}
            >
              Remapper App
            </a>
            <a
              href="#verifier"
              data-ui-control="true"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('VERIFIER_ONLY');
              }}
              className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'VERIFIER_ONLY'
                  ? 'text-blue-400 font-semibold'
                  : mutedText
              }`}
            >
              Input Verifier
            </a>
            <a
              href="#feasibility"
              data-ui-control="true"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('FEASIBILITY');
              }}
              className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'FEASIBILITY'
                  ? 'text-blue-400 font-semibold'
                  : mutedText
              }`}
            >
              Android Limits
            </a>
            <a
              href="#source"
              data-ui-control="true"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('SOURCE');
              }}
              className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'SOURCE'
                  ? 'text-blue-400 font-semibold'
                  : mutedText
              }`}
            >
              Export APK & Code
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              data-ui-control="true"
              onClick={() => {
                setActiveTab('SOURCE');
                void downloadAndroidStudioZip(mappings);
              }}
              className="min-h-[38px] px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all active:scale-95 whitespace-nowrap shrink-0"
            >
              Export APK Project (.zip)
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Workspace Container */}
      <main
        id="workbench-top"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8"
      >
        {/* Compact Workspace Toolbar & Mobile-Friendly View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className={`flex flex-wrap items-center gap-1 p-1 rounded-xl border ${
              isDark
                ? 'bg-[#0F1623] border-slate-800'
                : 'bg-slate-200/70 border-slate-300'
            }`}
          >
            <button
              type="button"
              data-ui-control="true"
              onClick={() => setActiveTab('WORKBENCH')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'WORKBENCH'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : mutedText
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Split Workbench</span>
            </button>

            <button
              type="button"
              data-ui-control="true"
              onClick={() => setActiveTab('APP_ONLY')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'APP_ONLY'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : mutedText
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android App</span>
            </button>

            <button
              type="button"
              data-ui-control="true"
              onClick={() => setActiveTab('VERIFIER_ONLY')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'VERIFIER_ONLY'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : mutedText
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Input Verifier</span>
            </button>

            <button
              type="button"
              data-ui-control="true"
              onClick={() => setActiveTab('FEASIBILITY')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'FEASIBILITY'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : mutedText
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Android Limits</span>
            </button>

            <button
              type="button"
              data-ui-control="true"
              onClick={() => setActiveTab('SOURCE')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'SOURCE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : mutedText
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Export APK & Code</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isInstallable && !isInstalled && (
              <button
                type="button"
                data-ui-control="true"
                onClick={promptInstall}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install WebAPK App</span>
              </button>
            )}

            <button
              type="button"
              data-ui-control="true"
              onClick={() => setIsDark(!isDark)}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-95 ${
                isDark
                  ? 'bg-[#0F1623] border-slate-800 text-slate-200 hover:bg-slate-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Theme</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-600" />
                  <span>Dark Theme</span>
                </>
              )}
            </button>

            {mappings.length > 0 && (
              <button
                type="button"
                data-ui-control="true"
                onClick={handleClearAllMappings}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-95 ${
                  isDark
                    ? 'bg-[#0F1623] border-slate-800 text-red-400 hover:bg-red-950/40'
                    : 'bg-white border-slate-300 text-red-600 hover:bg-red-50'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Active View Content */}
        {activeTab === 'WORKBENCH' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5">
              <MinimalAndroidApp
                isDark={isDark}
                onToggleTheme={() => setIsDark(!isDark)}
                reduceMotion={reduceMotion}
                onToggleReduceMotion={() => setReduceMotion(!reduceMotion)}
                showTechnicalCodes={showTechnicalCodes}
                onToggleTechnicalCodes={() => setShowTechnicalCodes(!showTechnicalCodes)}
                masterEnabled={masterEnabled}
                onToggleMaster={setMasterEnabled}
                backendMode={backendMode}
                onChangeBackendMode={setBackendMode}
                mappings={mappings}
                onSaveMapping={handleSaveMapping}
                onToggleRuleEnabled={handleToggleRuleEnabled}
                onDeleteMapping={handleDeleteMapping}
                connectedMice={connectedMice}
                onConnectMouse={handleConnectMouse}
                onDisconnectMouse={handleDisconnectMouse}
                onSimulatePhoneReboot={handleSimulatePhoneReboot}
                appUiClosed={appUiClosed}
                onToggleAppUiClosed={setAppUiClosed}
                lastLifecycleMessage={lastLifecycleMessage}
                onWizardStateChange={setIsWizardConfiguring}
              />
            </div>

            <div className="lg:col-span-7">
              <DiagnosticVerifier
                isDark={isDark}
                masterEnabled={masterEnabled}
                backendMode={backendMode}
                mappings={mappings}
                connectedMice={connectedMice}
                activeHolds={activeHolds}
                diagnosticLog={diagnosticLog}
                onPhysicalMouseDown={handlePhysicalMouseDown}
                onPhysicalMouseUp={handlePhysicalMouseUp}
                onClearDiagnosticLog={() => setDiagnosticLog([])}
                targetSandboxBuffer={targetSandboxBuffer}
                onChangeSandboxBuffer={setTargetSandboxBuffer}
                onClearSandboxBuffer={() => setTargetSandboxBuffer('')}
                pojavLastAction={pojavLastAction}
                pojavHeldKeys={pojavHeldKeys}
              />
            </div>
          </div>
        )}

        {activeTab === 'APP_ONLY' && (
          <div className="max-w-lg mx-auto">
            <MinimalAndroidApp
              isDark={isDark}
              onToggleTheme={() => setIsDark(!isDark)}
              reduceMotion={reduceMotion}
              onToggleReduceMotion={() => setReduceMotion(!reduceMotion)}
              showTechnicalCodes={showTechnicalCodes}
              onToggleTechnicalCodes={() => setShowTechnicalCodes(!showTechnicalCodes)}
              masterEnabled={masterEnabled}
              onToggleMaster={setMasterEnabled}
              backendMode={backendMode}
              onChangeBackendMode={setBackendMode}
              mappings={mappings}
              onSaveMapping={handleSaveMapping}
              onToggleRuleEnabled={handleToggleRuleEnabled}
              onDeleteMapping={handleDeleteMapping}
              connectedMice={connectedMice}
              onConnectMouse={handleConnectMouse}
              onDisconnectMouse={handleDisconnectMouse}
              onSimulatePhoneReboot={handleSimulatePhoneReboot}
              appUiClosed={appUiClosed}
              onToggleAppUiClosed={setAppUiClosed}
              lastLifecycleMessage={lastLifecycleMessage}
              onWizardStateChange={setIsWizardConfiguring}
            />
          </div>
        )}

        {activeTab === 'VERIFIER_ONLY' && (
          <DiagnosticVerifier
            isDark={isDark}
            masterEnabled={masterEnabled}
            backendMode={backendMode}
            mappings={mappings}
            connectedMice={connectedMice}
            activeHolds={activeHolds}
            diagnosticLog={diagnosticLog}
            onPhysicalMouseDown={handlePhysicalMouseDown}
            onPhysicalMouseUp={handlePhysicalMouseUp}
            onClearDiagnosticLog={() => setDiagnosticLog([])}
            targetSandboxBuffer={targetSandboxBuffer}
            onChangeSandboxBuffer={setTargetSandboxBuffer}
            onClearSandboxBuffer={() => setTargetSandboxBuffer('')}
            pojavLastAction={pojavLastAction}
            pojavHeldKeys={pojavHeldKeys}
          />
        )}

        {activeTab === 'FEASIBILITY' && <FeasibilityReportView isDark={isDark} />}

        {activeTab === 'SOURCE' && (
          <AndroidProjectExporter
            isDark={isDark}
            currentMappings={mappings}
            onExportZip={() => downloadAndroidStudioZip(mappings)}
            onExportJsonBundle={handleExportAndroidBundle}
          />
        )}
      </main>

      {/* Clean Minimal Footer */}
      <footer
        className={`border-t py-4 px-6 text-xs ${
          isDark
            ? 'border-slate-800/80 bg-[#090D16] text-slate-500'
            : 'border-slate-200 bg-white text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <span>KeyBridge · Native Android Hardware Mouse Input Remapper</span>
          <span>
            Jetpack DataStore · InputManager.InputDeviceListener · Kernel uinput & AccessibilityService
          </span>
        </div>
      </footer>
    </div>
  );
}
