import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  RotateCcw,
  Usb,
  Bluetooth,
  Radio,
  Check,
  X,
  AlertTriangle,
  EyeOff,
  Eye,
  Settings,
  Mouse,
  Keyboard,
  ArrowRight,
  ChevronLeft,
  SlidersHorizontal,
  ShieldAlert,
  CheckCircle2,
  Clock,
  PauseCircle,
  Search
} from 'lucide-react';
import {
  AndroidBackendMode,
  ConnectedMouseDevice,
  DestinationType,
  KEYBOARD_INPUT_CATALOG,
  KeyboardCategory,
  MOUSE_INPUT_CATALOG,
  MouseButtonGroup,
  MappingRule,
  ModifierKey,
  getDestinationDetails,
  getKeyboardInputByDomCode,
  getMouseInputByDomButton,
  getMouseInputById
} from '../data/inputCatalog';

interface MinimalAndroidAppProps {
  isDark: boolean;
  onToggleTheme: () => void;
  reduceMotion: boolean;
  onToggleReduceMotion: () => void;
  showTechnicalCodes: boolean;
  onToggleTechnicalCodes: () => void;
  masterEnabled: boolean;
  onToggleMaster: (enabled: boolean) => void;
  backendMode: AndroidBackendMode;
  onChangeBackendMode: (mode: AndroidBackendMode) => void;
  mappings: MappingRule[];
  onSaveMapping: (
    rule: Omit<MappingRule, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => void;
  onToggleRuleEnabled: (id: string) => void;
  onDeleteMapping: (id: string) => void;
  connectedMice: ConnectedMouseDevice[];
  onConnectMouse: (transport: 'USB OTG' | 'Bluetooth HID') => void;
  onDisconnectMouse: (deviceId: number) => void;
  onSimulatePhoneReboot: () => void;
  appUiClosed: boolean;
  onToggleAppUiClosed: (closed: boolean) => void;
  lastLifecycleMessage: string | null;
  onWizardStateChange?: (isConfiguring: boolean) => void;
}

const MOUSE_GROUPS: MouseButtonGroup[] = [
  'Primary Buttons',
  'Side Navigation',
  'Additional Buttons'
];

const KEYBOARD_CATEGORIES: KeyboardCategory[] = [
  'Letters A–Z',
  'Numbers 0–9',
  'Function Keys',
  'Navigation & Arrows',
  'Modifier Keys'
];

const ALL_MODIFIERS: ModifierKey[] = ['CTRL', 'SHIFT', 'ALT', 'META'];

export const MinimalAndroidApp: React.FC<MinimalAndroidAppProps> = ({
  isDark,
  onToggleTheme,
  reduceMotion,
  onToggleReduceMotion,
  showTechnicalCodes,
  onToggleTechnicalCodes,
  masterEnabled,
  onToggleMaster,
  backendMode,
  onChangeBackendMode,
  mappings,
  onSaveMapping,
  onToggleRuleEnabled,
  onDeleteMapping,
  connectedMice,
  onConnectMouse,
  onDisconnectMouse,
  onSimulatePhoneReboot,
  appUiClosed,
  onToggleAppUiClosed,
  lastLifecycleMessage,
  onWizardStateChange
}) => {
  const [screen, setScreen] = useState<'MAIN' | 'ADD_EDIT'>('MAIN');
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [hardwareBarExpanded, setHardwareBarExpanded] = useState<boolean>(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Selection state inside the 2-step flow
  const [sourceMouseId, setSourceMouseId] = useState<string | null>(null);
  const [destinationType, setDestinationType] = useState<DestinationType>('KEYBOARD');
  const [selectedKeyCategory, setSelectedKeyCategory] =
    useState<KeyboardCategory>('Letters A–Z');
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [modifiers, setModifiers] = useState<ModifierKey[]>([]);
  const [keySearchQuery, setKeySearchQuery] = useState<string>('');
  const [lastCapturedFlash, setLastCapturedFlash] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationToast, setConfirmationToast] = useState<string | null>(null);

  useEffect(() => {
    onWizardStateChange?.(screen === 'ADD_EDIT');
  }, [screen, onWizardStateChange]);

  const triggerToast = (msg: string) => {
    setConfirmationToast(msg);
  };

  useEffect(() => {
    if (!confirmationToast) return;
    const timer = setTimeout(() => setConfirmationToast(null), 2600);
    return () => clearTimeout(timer);
  }, [confirmationToast]);

  useEffect(() => {
    if (!lastCapturedFlash) return;
    const timer = setTimeout(() => setLastCapturedFlash(null), 1200);
    return () => clearTimeout(timer);
  }, [lastCapturedFlash]);

  // Open + Add Mapping: starts at Step 1 (Listening for physical mouse click or manual selection)
  const handleOpenAdd = () => {
    setEditingRuleId(null);
    setSourceMouseId(null);
    setDestinationType('KEYBOARD');
    setSelectedKeyCategory('Letters A–Z');
    setDestinationId(null);
    setModifiers([]);
    setKeySearchQuery('');
    setFormError(null);
    setWizardStep(1);
    setScreen('ADD_EDIT');
  };

  // Open Edit Mapping populated with rule values
  const handleOpenEdit = (rule: MappingRule) => {
    setEditingRuleId(rule.id);
    setSourceMouseId(rule.sourceMouseId);
    setDestinationType(rule.destinationType);
    if (rule.destinationType === 'KEYBOARD') {
      const foundKey = KEYBOARD_INPUT_CATALOG.find((k) => k.id === rule.destinationId);
      if (foundKey) {
        setSelectedKeyCategory(foundKey.category);
      }
    }
    setDestinationId(rule.destinationId);
    setModifiers(rule.modifiers);
    setKeySearchQuery('');
    setFormError(null);
    setWizardStep(1);
    setScreen('ADD_EDIT');
  };

  // STEP 1 AUTOMATIC MOUSE BUTTON CAPTURE:
  // When in Step 1, clicking any non-primary mouse button (Right, Middle, Back/Btn 4, Forward/Btn 5) anywhere
  // or clicking inside the capture zone immediately selects that mouse button!
  // Clicking UI control buttons (like "Next", "Cancel", or manual cards) with Left Click works normally by hand.
  useEffect(() => {
    if (screen !== 'ADD_EDIT' || wizardStep !== 1) return;

    const handleGlobalStep1MouseDown = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement | null;
      const isUiButton = targetEl?.closest('[data-ui-control="true"]');

      // If the user clicked a UI control button with Left Click (button 0), let the button click run normally
      if (isUiButton && e.button === 0) {
        return;
      }

      // Otherwise, capture the physical mouse button!
      const matchedMouse = getMouseInputByDomButton(e.button);
      if (matchedMouse) {
        e.preventDefault();
        e.stopPropagation();
        setSourceMouseId(matchedMouse.id);
        setFormError(null);
        setLastCapturedFlash(`Captured: ${matchedMouse.shortLabel}`);
      }
    };

    const SuppressContextMenu = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (!targetEl?.closest('[data-ui-control="true"]')) {
        e.preventDefault();
      }
    };

    window.addEventListener('mousedown', handleGlobalStep1MouseDown, { capture: true });
    window.addEventListener('contextmenu', SuppressContextMenu, { capture: true });
    return () => {
      window.removeEventListener('mousedown', handleGlobalStep1MouseDown, { capture: true });
      window.removeEventListener('contextmenu', SuppressContextMenu, { capture: true });
    };
  }, [screen, wizardStep]);

  // STEP 2 AUTOMATIC KEYBOARD KEY CAPTURE:
  // When in Step 2 and Destination Type is KEYBOARD, pressing ANY key on the physical keyboard
  // (like 'T') immediately selects that key!
  useEffect(() => {
    if (screen !== 'ADD_EDIT' || wizardStep !== 2 || destinationType !== 'KEYBOARD') return;

    const handleGlobalStep2KeyDown = (e: KeyboardEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (targetEl && (targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA')) {
        return; // Allow typing in the optional search filter box
      }

      const matchedKey = getKeyboardInputByDomCode(e.code);
      if (matchedKey) {
        e.preventDefault();
        e.stopPropagation();
        setSelectedKeyCategory(matchedKey.category);
        setDestinationId(matchedKey.id);
        setFormError(null);
        setLastCapturedFlash(`Captured Key: ${matchedKey.shortLabel}`);
      }
    };

    window.addEventListener('keydown', handleGlobalStep2KeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleGlobalStep2KeyDown, { capture: true });
    };
  }, [screen, wizardStep, destinationType]);

  // Capture pad click handler for Step 1 or Step 2 (Mouse mode)
  const handleCaptureZonePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const matchedMouse = getMouseInputByDomButton(e.button);
    if (!matchedMouse) return;

    if (wizardStep === 1) {
      setSourceMouseId(matchedMouse.id);
      setFormError(null);
      setLastCapturedFlash(`Captured: ${matchedMouse.shortLabel}`);
    } else if (wizardStep === 2 && destinationType === 'MOUSE') {
      setDestinationId(matchedMouse.id);
      setFormError(null);
      setLastCapturedFlash(`Captured Target: ${matchedMouse.shortLabel}`);
    }
  };

  const handleChangeDestinationType = (nextType: DestinationType) => {
    setDestinationType(nextType);
    setDestinationId(null);
    setFormError(null);
  };

  const toggleModifier = (mod: ModifierKey) => {
    setModifiers((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const handleProceedToStep2 = () => {
    if (!sourceMouseId) {
      setFormError('Click any button on your mouse or select a button below first.');
      return;
    }
    setFormError(null);
    setWizardStep(2);
  };

  const handleSaveForm = () => {
    if (!sourceMouseId) {
      setFormError('Please select a source mouse button.');
      setWizardStep(1);
      return;
    }
    if (!destinationId) {
      setFormError(
        destinationType === 'KEYBOARD'
          ? 'Press any key on your keyboard (e.g. T) or tap a key below first.'
          : 'Click or tap a replacement mouse button first.'
      );
      return;
    }
    if (
      destinationType === 'MOUSE' &&
      sourceMouseId === destinationId &&
      modifiers.length === 0
    ) {
      setFormError(
        'Invalid mapping: Source and destination cannot be the same mouse button without a modifier.'
      );
      return;
    }

    const srcShort = getMouseInputById(sourceMouseId)?.shortLabel ?? sourceMouseId;
    const dstShort = getDestinationDetails(destinationType, destinationId).shortLabel;
    const modPrefix = modifiers.length > 0 ? `${modifiers.join(' + ')} + ` : '';

    onSaveMapping(
      {
        sourceMouseId,
        destinationType,
        destinationId,
        modifiers,
        enabled: true
      },
      editingRuleId ?? undefined
    );

    triggerToast(`Saved & Active: ${srcShort} → ${modPrefix}${dstShort}`);
    setScreen('MAIN');
  };

  const displayedKeyboardKeys = useMemo(() => {
    const query = keySearchQuery.trim().toLowerCase();
    if (query.length > 0) {
      return KEYBOARD_INPUT_CATALOG.filter(
        (k) =>
          k.label.toLowerCase().includes(query) ||
          k.keyCap.toLowerCase().includes(query) ||
          k.androidKeyCodeName.toLowerCase().includes(query)
      );
    }
    return KEYBOARD_INPUT_CATALOG.filter((k) => k.category === selectedKeyCategory);
  }, [keySearchQuery, selectedKeyCategory]);

  // Honest status indicator
  const statusIndicator = useMemo(() => {
    const enabledMappingsCount = mappings.filter((m) => m.enabled).length;
    const stockRestrictedCount = mappings.filter((m) => {
      if (!m.enabled) return false;
      const def = getMouseInputById(m.sourceMouseId);
      return def ? !def.stockInterceptableViaKeyEvent : false;
    }).length;

    if (!masterEnabled) {
      return {
        tone: 'INACTIVE' as const,
        headline: 'Remapping Paused',
        subtext: `${mappings.length} mapping${
          mappings.length === 1 ? '' : 's'
        } saved. Turn on Master Remapping to intercept mouse inputs.`,
        actionLabel: null
      };
    }

    if (backendMode === 'RESTRICTED_UNAVAILABLE') {
      return {
        tone: 'ERROR' as const,
        headline: 'Unavailable · Permission Required',
        subtext:
          'Android blocks unprivileged background apps from intercepting mouse input. Grant Root/Shizuku (uinput) or AccessibilityService permission.',
        actionLabel: 'Configure Permissions'
      };
    }

    if (mappings.length === 0) {
      return {
        tone: 'WAITING' as const,
        headline: 'Ready · No Mappings Configured',
        subtext:
          'Click + Add Mapping below, click any mouse button, press Next, and press a keyboard key to start.',
        actionLabel: null
      };
    }

    if (backendMode === 'STOCK_ACCESSIBILITY' && stockRestrictedCount > 0) {
      return {
        tone: 'WARNING' as const,
        headline: 'Partial Stock Mode',
        subtext: `AccessibilityService intercepts Back/Forward buttons, but ${stockRestrictedCount} rule${
          stockRestrictedCount === 1 ? '' : 's'
        } (Left/Right/Middle) require Hybrid Root/Shizuku uinput mode.`,
        actionLabel: 'Enable Hybrid uinput'
      };
    }

    return {
      tone: 'ACTIVE' as const,
      headline: `Active · Global Window & Service Interception On`,
      subtext: `${enabledMappingsCount} active mapping${
        enabledMappingsCount === 1 ? '' : 's'
      } redirecting input live anywhere in the window.`,
      actionLabel: null
    };
  }, [backendMode, mappings, masterEnabled]);

  const duplicateSourceRule = sourceMouseId
    ? mappings.find((m) => m.sourceMouseId === sourceMouseId && m.id !== editingRuleId)
    : undefined;

  const shellBg = isDark
    ? 'bg-[#0F1623] border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const cardBg = isDark
    ? 'bg-[#151E2E] border-slate-800/90'
    : 'bg-slate-50/80 border-slate-200';
  const elevatedBg = isDark
    ? 'bg-[#1C273B] border-slate-700/80'
    : 'bg-white border-slate-200';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';
  const subtleText = isDark ? 'text-slate-300' : 'text-slate-600';

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`rounded-2xl border overflow-hidden shadow-xl transition-colors duration-150 ${shellBg}`}
      >
        {/* Top Android Status Strip */}
        <div
          className={`px-4 py-2 text-[11px] font-mono flex items-center justify-between border-b ${
            isDark
              ? 'bg-[#0A0F18] border-slate-800/80 text-slate-400'
              : 'bg-slate-100 border-slate-200 text-slate-600'
          }`}
        >
          <span>KeyBridge · Input Remapper</span>
          <span>
            {masterEnabled && mappings.some((m) => m.enabled)
              ? 'Global Redirect: ACTIVE'
              : 'Standby'}
          </span>
        </div>

        {/* App Header Bar */}
        <div
          className={`px-5 py-3.5 flex items-center justify-between gap-3 border-b ${
            isDark ? 'border-slate-800/80' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {screen === 'ADD_EDIT' ? (
              <button
                type="button"
                data-ui-control="true"
                onClick={() => {
                  if (wizardStep === 2) {
                    setWizardStep(1);
                  } else {
                    setScreen('MAIN');
                  }
                }}
                aria-label="Back"
                className={`min-h-[40px] min-w-[40px] -ml-1.5 rounded-xl flex items-center justify-center transition-colors active:scale-95 ${
                  isDark
                    ? 'hover:bg-slate-800 text-slate-200'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Mouse className="w-4 h-4 text-blue-500" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight truncate">
                {screen === 'MAIN'
                  ? 'KeyBridge'
                  : wizardStep === 1
                  ? 'Step 1 of 2 · Select Mouse Input'
                  : 'Step 2 of 2 · Select Replacement Key'}
              </h2>
              <p className={`text-xs truncate ${mutedText}`}>
                {screen === 'MAIN'
                  ? 'Hardware Mouse-to-Key & Mouse Remapper'
                  : wizardStep === 1
                  ? 'Click any button on your mouse or select below, then click Next'
                  : 'Press any key on your keyboard (e.g. T) or select below, then click Save'}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-ui-control="true"
            onClick={() => setSettingsOpen(!settingsOpen)}
            aria-label="Open settings and permissions"
            aria-expanded={settingsOpen}
            className={`min-h-[42px] min-w-[42px] rounded-xl border flex items-center justify-center transition-all active:scale-95 ${
              settingsOpen
                ? 'bg-blue-600 text-white border-blue-500'
                : isDark
                ? 'bg-[#151E2E] border-slate-800 text-slate-300 hover:bg-slate-800'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Collapsible Settings & Permissions Sheet */}
        {settingsOpen && (
          <div
            data-ui-control="true"
            className={`p-4 border-b space-y-4 transition-all ${
              isDark
                ? 'bg-[#111827] border-slate-800 text-slate-200'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">
                Remapping Backend & App Preferences
              </span>
              <button
                type="button"
                data-ui-control="true"
                onClick={() => setSettingsOpen(false)}
                className={`text-xs font-medium px-2 py-1 rounded-md ${
                  isDark
                    ? 'hover:bg-slate-800 text-slate-400'
                    : 'hover:bg-slate-200 text-slate-600'
                }`}
              >
                Done
              </button>
            </div>

            <div className="space-y-1.5">
              <label className={`block text-xs ${mutedText}`}>
                Android Interception Backend
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  {
                    id: 'HYBRID_UINPUT' as const,
                    title: 'Hybrid Root / Shizuku (evdev + /dev/uinput)',
                    desc: 'Full hardware interception & replacement for all buttons and games (PojavLauncher).'
                  },
                  {
                    id: 'STOCK_ACCESSIBILITY' as const,
                    title: 'Stock Android (AccessibilityService + IME)',
                    desc: 'Unrooted fallback. Intercepts Mouse Back/Forward KeyEvents only.'
                  },
                  {
                    id: 'RESTRICTED_UNAVAILABLE' as const,
                    title: 'No Permissions Granted (Unavailable)',
                    desc: 'Simulates fresh install before granting Accessibility or Shizuku/Root permissions.'
                  }
                ].map((opt) => {
                  const selected = backendMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-ui-control="true"
                      onClick={() => onChangeBackendMode(opt.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                        selected
                          ? isDark
                            ? 'bg-blue-600/15 border-blue-500/60 text-white'
                            : 'bg-blue-50 border-blue-500 text-slate-900'
                          : isDark
                          ? 'bg-[#161F30] border-slate-800 text-slate-300 hover:border-slate-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold">{opt.title}</div>
                        <div className={`text-[11px] leading-snug ${mutedText}`}>
                          {opt.desc}
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          selected
                            ? 'border-blue-500 bg-blue-600 text-white'
                            : 'border-slate-500'
                        }`}
                      >
                        {selected && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                data-ui-control="true"
                onClick={onToggleTheme}
                className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-between ${elevatedBg}`}
              >
                <span>Theme</span>
                <span className="font-semibold text-blue-500">
                  {isDark ? 'Dark' : 'Light'}
                </span>
              </button>
              <button
                type="button"
                data-ui-control="true"
                onClick={onToggleTechnicalCodes}
                className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-between ${elevatedBg}`}
              >
                <span>Keycode Labels</span>
                <span className="font-semibold text-blue-500">
                  {showTechnicalCodes ? 'Shown' : 'Hidden'}
                </span>
              </button>
              <button
                type="button"
                data-ui-control="true"
                onClick={onToggleReduceMotion}
                className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-between ${elevatedBg}`}
              >
                <span>Reduce Motion</span>
                <span className="font-semibold text-blue-500">
                  {reduceMotion ? 'On' : 'Off'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Toast Banner */}
        {confirmationToast && (
          <div className="px-4 py-2.5 bg-blue-600 text-white text-xs font-medium flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {confirmationToast}
            </span>
            <button
              type="button"
              data-ui-control="true"
              onClick={() => setConfirmationToast(null)}
              className="text-blue-100 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {appUiClosed ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center mx-auto">
              <EyeOff className="w-5 h-5 text-blue-400" />
            </div>
            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="text-base font-bold">App UI Closed · Service Running</h3>
              <p className={`text-xs leading-relaxed ${mutedText}`}>
                {masterEnabled
                  ? 'KeyBridge UI is closed, and your saved mappings continue redirecting mouse inputs in the background across the window.'
                  : 'Master remapping is paused. Your saved mappings remain stored safely in Jetpack DataStore.'}
              </p>
            </div>
            <button
              type="button"
              data-ui-control="true"
              onClick={() => onToggleAppUiClosed(false)}
              className="min-h-[44px] px-5 py-2.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all active:scale-95"
            >
              Reopen KeyBridge App
            </button>
          </div>
        ) : screen === 'MAIN' ? (
          /* ================= SCREEN 1: MAIN SCREEN ================= */
          <div className="p-5 space-y-5">
            {/* Master Remapping Toggle Card */}
            <div
              data-ui-control="true"
              onClick={() => onToggleMaster(!masterEnabled)}
              role="switch"
              aria-checked={masterEnabled}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleMaster(!masterEnabled);
                }
              }}
              className={`p-4 rounded-xl border cursor-pointer select-none transition-all flex items-center justify-between gap-4 active:scale-[0.99] ${
                masterEnabled
                  ? isDark
                    ? 'bg-blue-600/10 border-blue-500/40'
                    : 'bg-blue-50/70 border-blue-200'
                  : cardBg
              }`}
            >
              <div className="space-y-0.5">
                <div className="text-sm font-bold">Master Remapping</div>
                <div className={`text-xs ${mutedText}`}>
                  {masterEnabled
                    ? 'Redirecting configured mouse inputs globally across the window & service'
                    : 'Remapping is paused · Saved mappings remain stored'}
                </div>
              </div>

              <div
                className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 flex items-center shrink-0 ${
                  masterEnabled
                    ? 'bg-blue-600'
                    : isDark
                    ? 'bg-slate-700'
                    : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                    masterEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>

            {/* Concise Status Indicator */}
            <div
              className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                statusIndicator.tone === 'ACTIVE'
                  ? isDark
                    ? 'bg-emerald-950/35 border-emerald-800/60 text-emerald-200'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : statusIndicator.tone === 'WAITING'
                  ? isDark
                    ? 'bg-slate-800/60 border-slate-700 text-slate-200'
                    : 'bg-slate-100 border-slate-200 text-slate-800'
                  : statusIndicator.tone === 'WARNING'
                  ? isDark
                    ? 'bg-amber-950/35 border-amber-800/60 text-amber-200'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                  : statusIndicator.tone === 'ERROR'
                  ? isDark
                    ? 'bg-red-950/35 border-red-800/60 text-red-200'
                    : 'bg-red-50 border-red-200 text-red-900'
                  : cardBg
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {statusIndicator.tone === 'ACTIVE' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : statusIndicator.tone === 'WAITING' ? (
                  <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                ) : statusIndicator.tone === 'WARNING' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                ) : statusIndicator.tone === 'ERROR' ? (
                  <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <PauseCircle className={`w-4 h-4 shrink-0 mt-0.5 ${mutedText}`} />
                )}

                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-bold">{statusIndicator.headline}</div>
                  <p className="text-xs leading-relaxed opacity-90">
                    {statusIndicator.subtext}
                  </p>
                </div>
              </div>

              {statusIndicator.actionLabel && (
                <button
                  type="button"
                  data-ui-control="true"
                  onClick={() => {
                    if (statusIndicator.actionLabel === 'Enable Hybrid uinput') {
                      onChangeBackendMode('HYBRID_UINPUT');
                      triggerToast('Switched to Hybrid Root/Shizuku uinput mode');
                    } else {
                      setSettingsOpen(true);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
                >
                  {statusIndicator.actionLabel}
                </button>
              )}
            </div>

            {/* Saved Mappings Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">
                    Saved Mappings ({mappings.length})
                  </h3>
                  <p className={`text-xs ${mutedText}`}>
                    Configured by you · Stored permanently on device
                  </p>
                </div>

                <button
                  type="button"
                  data-ui-control="true"
                  onClick={handleOpenAdd}
                  className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all active:scale-95 whitespace-nowrap shrink-0 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Add Mapping
                </button>
              </div>

              {mappings.length === 0 ? (
                <div
                  className={`rounded-xl border border-dashed p-7 text-center space-y-3 ${
                    isDark ? 'border-slate-800 bg-[#121A28]' : 'border-slate-300 bg-slate-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mx-auto">
                    <Mouse className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="space-y-1 max-w-xs mx-auto">
                    <div className="text-sm font-bold">No Mappings Configured</div>
                    <p className={`text-xs leading-relaxed ${mutedText}`}>
                      Click <strong>+ Add Mapping</strong>, click the mouse button you want to remap, press <strong>Next</strong>, and press the replacement keyboard key (such as T).
                    </p>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      data-ui-control="true"
                      onClick={handleOpenAdd}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all active:scale-95 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add Mapping
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {mappings.map((rule) => {
                    const sourceDef = getMouseInputById(rule.sourceMouseId);
                    const destDetails = getDestinationDetails(
                      rule.destinationType,
                      rule.destinationId
                    );
                    const modPrefix =
                      rule.modifiers.length > 0 ? `${rule.modifiers.join(' + ')} + ` : '';

                    const isStockRestricted =
                      backendMode === 'STOCK_ACCESSIBILITY' &&
                      sourceDef &&
                      !sourceDef.stockInterceptableViaKeyEvent;

                    const ruleStateText = !rule.enabled
                      ? 'Rule paused'
                      : !masterEnabled
                      ? 'Saved (Master off)'
                      : backendMode === 'RESTRICTED_UNAVAILABLE'
                      ? 'Saved (Permission needed)'
                      : isStockRestricted
                      ? 'Restricted on Stock Android (Needs uinput)'
                      : 'Active · Redirecting Input Globally';

                    const isRuleActivelyApplied =
                      rule.enabled &&
                      masterEnabled &&
                      backendMode !== 'RESTRICTED_UNAVAILABLE' &&
                      !isStockRestricted;

                    return (
                      <div
                        key={rule.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          !rule.enabled ? 'opacity-60 ' : ''
                        }${elevatedBg}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <button
                              type="button"
                              data-ui-control="true"
                              onClick={() => onToggleRuleEnabled(rule.id)}
                              title={rule.enabled ? 'Pause this mapping' : 'Enable this mapping'}
                              aria-label={`Toggle ${sourceDef?.shortLabel} mapping`}
                              className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                                rule.enabled
                                  ? 'bg-blue-600'
                                  : isDark
                                  ? 'bg-slate-700'
                                  : 'bg-slate-300'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                                  rule.enabled ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2 text-sm font-bold tracking-tight">
                                <span className="inline-flex items-center gap-1.5">
                                  <Mouse className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                  <span>{sourceDef?.shortLabel ?? rule.sourceMouseId}</span>
                                </span>

                                <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />

                                <span className="inline-flex items-center gap-1.5 text-blue-400">
                                  {rule.destinationType === 'KEYBOARD' ? (
                                    <Keyboard className="w-3.5 h-3.5 shrink-0" />
                                  ) : (
                                    <Mouse className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span>
                                    {modPrefix}
                                    {destDetails.shortLabel}
                                  </span>
                                </span>
                              </div>

                              <div
                                className={`text-xs flex flex-wrap items-center gap-1.5 ${mutedText}`}
                              >
                                <span
                                  className={
                                    isRuleActivelyApplied
                                      ? 'text-emerald-400 font-medium'
                                      : isStockRestricted
                                      ? 'text-amber-400 font-medium'
                                      : ''
                                  }
                                >
                                  {ruleStateText}
                                </span>
                                {showTechnicalCodes && (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono text-[11px] truncate">
                                      {sourceDef?.linuxEvdevName} → {destDetails.linuxCode}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              data-ui-control="true"
                              onClick={() => handleOpenEdit(rule)}
                              aria-label={`Edit ${sourceDef?.shortLabel} mapping`}
                              className={`min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition-colors active:scale-95 ${
                                isDark
                                  ? 'hover:bg-slate-800 text-slate-300'
                                  : 'hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              data-ui-control="true"
                              onClick={() => {
                                onDeleteMapping(rule.id);
                                triggerToast(`Deleted ${sourceDef?.shortLabel} mapping`);
                              }}
                              aria-label={`Delete ${sourceDef?.shortLabel} mapping`}
                              className={`min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition-colors active:scale-95 ${
                                isDark
                                  ? 'hover:bg-red-950/60 text-red-400'
                                  : 'hover:bg-red-50 text-red-600'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ================= SCREEN 2: 2-STEP GUIDED CAPTURE & SELECTION WIZARD ================= */
          <div className="p-5 space-y-5">
            {/* Step Progress Pill Strip */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-ui-control="true"
                onClick={() => {
                  setFormError(null);
                  setWizardStep(1);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  wizardStep === 1
                    ? 'bg-blue-600/15 border-blue-500 text-blue-400'
                    : sourceMouseId
                    ? isDark
                      ? 'bg-emerald-950/25 border-emerald-800/60 text-emerald-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : cardBg
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider">
                  Step 1 · Mouse Input
                </div>
                <div className="text-xs font-bold truncate mt-0.5 text-current">
                  {sourceMouseId
                    ? getMouseInputById(sourceMouseId)?.shortLabel
                    : 'Waiting for mouse click...'}
                </div>
              </button>

              <button
                type="button"
                data-ui-control="true"
                onClick={() => {
                  if (sourceMouseId) {
                    setFormError(null);
                    setWizardStep(2);
                  }
                }}
                disabled={!sourceMouseId}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  wizardStep === 2
                    ? 'bg-blue-600/15 border-blue-500 text-blue-400'
                    : destinationId
                    ? isDark
                      ? 'bg-emerald-950/25 border-emerald-800/60 text-emerald-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : `${cardBg} opacity-60`
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider">
                  Step 2 · Replacement Output
                </div>
                <div className="text-xs font-bold truncate mt-0.5 text-current">
                  {destinationId
                    ? `${modifiers.length > 0 ? `${modifiers.join('+')}+` : ''}${
                        getDestinationDetails(destinationType, destinationId).shortLabel
                      }`
                    : 'Press Next after Step 1'}
                </div>
              </button>
            </div>

            {wizardStep === 1 ? (
              /* ---------------- STEP 1: SELECT OR CLICK SOURCE MOUSE BUTTON ---------------- */
              <div className="space-y-4">
                {/* Live Physical Mouse Capture Box */}
                <div
                  onPointerDown={handleCaptureZonePointerDown}
                  onContextMenu={(e) => e.preventDefault()}
                  onAuxClick={(e) => e.preventDefault()}
                  className={`p-6 rounded-2xl border-2 border-dashed text-center cursor-crosshair select-none transition-all space-y-2 ${
                    sourceMouseId
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-blue-500 bg-blue-600/10 hover:bg-blue-600/15'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center mx-auto">
                    <Radio className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-sm font-bold">
                    {sourceMouseId
                      ? `Selected: ${getMouseInputById(sourceMouseId)?.label}`
                      : 'Click Any Button on Your Physical Mouse Here'}
                  </div>
                  <p className={`text-xs max-w-sm mx-auto ${mutedText}`}>
                    Click Left, Right, Middle, Back (Button 4), or Forward (Button 5) inside this box—or tap a button below—then click <strong>Next Step</strong> by hand.
                  </p>
                  {lastCapturedFlash && (
                    <div className="text-xs font-mono font-bold text-emerald-400">
                      {lastCapturedFlash}
                    </div>
                  )}
                </div>

                {/* Manual Mouse Button Selector Cards */}
                <div className="space-y-2.5">
                  <div className={`text-xs font-semibold ${subtleText}`}>
                    Or Select Mouse Button Manually:
                  </div>
                  {MOUSE_GROUPS.map((groupName) => {
                    const groupButtons = MOUSE_INPUT_CATALOG.filter(
                      (m) => m.group === groupName
                    );
                    return (
                      <div key={groupName} className="space-y-1.5">
                        <div className={`text-[11px] font-medium ${mutedText}`}>
                          {groupName}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {groupButtons.map((btn) => {
                            const isSelected = sourceMouseId === btn.id;
                            return (
                              <button
                                key={btn.id}
                                type="button"
                                data-ui-control="true"
                                onClick={() => {
                                  setSourceMouseId(btn.id);
                                  setFormError(null);
                                }}
                                className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-all active:scale-[0.98] flex flex-col justify-between ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                                    : `${elevatedBg} hover:border-blue-500/40`
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 w-full">
                                  <span className="text-xs font-bold truncate">
                                    {btn.shortLabel}
                                  </span>
                                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                </div>
                                <span
                                  className={`text-[11px] truncate ${
                                    isSelected ? 'text-blue-100' : mutedText
                                  }`}
                                >
                                  {btn.compactTag}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {duplicateSourceRule && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                      isDark
                        ? 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      {getMouseInputById(sourceMouseId!)?.shortLabel} already has a mapping. Saving will replace it.
                    </span>
                  </div>
                )}

                {formError && (
                  <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-xs text-red-200 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Step 1 Footer Buttons (Clicked by hand) */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    data-ui-control="true"
                    onClick={() => setScreen('MAIN')}
                    className={`min-h-[46px] py-2.5 px-4 text-xs font-bold rounded-xl border transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 ${elevatedBg}`}
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-ui-control="true"
                    onClick={handleProceedToStep2}
                    className="min-h-[46px] py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Next Step</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* ---------------- STEP 2: PRESS OR SELECT REPLACEMENT OUTPUT ---------------- */
              <div className="space-y-4">
                {/* Output Type Switch: Keyboard Key vs Mouse Button */}
                <div
                  className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl border ${
                    isDark ? 'bg-[#0A0F18] border-slate-800' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    data-ui-control="true"
                    onClick={() => handleChangeDestinationType('KEYBOARD')}
                    className={`min-h-[40px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      destinationType === 'KEYBOARD'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : subtleText
                    }`}
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    Replace with Keyboard Key
                  </button>
                  <button
                    type="button"
                    data-ui-control="true"
                    onClick={() => handleChangeDestinationType('MOUSE')}
                    className={`min-h-[40px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      destinationType === 'MOUSE'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : subtleText
                    }`}
                  >
                    <Mouse className="w-3.5 h-3.5" />
                    Replace with Mouse Button
                  </button>
                </div>

                {/* Live Capture Zone for Step 2 */}
                {destinationType === 'KEYBOARD' ? (
                  <div
                    className={`p-5 rounded-2xl border-2 border-dashed text-center select-none transition-all space-y-1.5 ${
                      destinationId
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-blue-500 bg-blue-600/10'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center mx-auto">
                      <Keyboard className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-sm font-bold">
                      {destinationId
                        ? `Selected Output: ${
                            getDestinationDetails('KEYBOARD', destinationId).label
                          }`
                        : 'Press Any Key on Your Physical Keyboard Now (e.g. T)'}
                    </div>
                    <p className={`text-xs max-w-sm mx-auto ${mutedText}`}>
                      Pressing any key on your keyboard automatically selects it, or tap any key from the list below. Then click <strong>Save Mapping</strong> by hand.
                    </p>
                    {lastCapturedFlash && (
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {lastCapturedFlash}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onPointerDown={handleCaptureZonePointerDown}
                    onContextMenu={(e) => e.preventDefault()}
                    onAuxClick={(e) => e.preventDefault()}
                    className={`p-5 rounded-2xl border-2 border-dashed text-center cursor-crosshair select-none transition-all space-y-1.5 ${
                      destinationId
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-blue-500 bg-blue-600/10'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center mx-auto">
                      <Mouse className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-sm font-bold">
                      {destinationId
                        ? `Selected Output: ${
                            getDestinationDetails('MOUSE', destinationId).label
                          }`
                        : 'Click Target Mouse Button Inside This Box'}
                    </div>
                    <p className={`text-xs max-w-sm mx-auto ${mutedText}`}>
                      Click the replacement mouse button inside this box or select it below, then click <strong>Save Mapping</strong> by hand.
                    </p>
                  </div>
                )}

                {destinationType === 'KEYBOARD' ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        {KEYBOARD_CATEGORIES.map((category) => {
                          const active =
                            keySearchQuery.trim() === '' && selectedKeyCategory === category;
                          return (
                            <button
                              key={category}
                              type="button"
                              data-ui-control="true"
                              onClick={() => {
                                setKeySearchQuery('');
                                setSelectedKeyCategory(category);
                              }}
                              className={`min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                                active
                                  ? isDark
                                    ? 'bg-slate-100 text-slate-900'
                                    : 'bg-slate-900 text-white'
                                  : `${cardBg} ${subtleText}`
                              }`}
                            >
                              {category}
                            </button>
                          );
                        })}
                      </div>

                      <div className="relative flex-1 min-w-[140px]">
                        <Search
                          className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${mutedText}`}
                        />
                        <input
                          type="text"
                          data-ui-control="true"
                          value={keySearchQuery}
                          onChange={(e) => setKeySearchQuery(e.target.value)}
                          placeholder="Filter keys..."
                          aria-label="Filter keyboard keys"
                          className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:border-blue-500 ${elevatedBg}`}
                        />
                      </div>
                    </div>

                    <div
                      className={`grid gap-1.5 max-h-48 overflow-y-auto p-2 rounded-xl border ${
                        selectedKeyCategory === 'Letters A–Z' ||
                        selectedKeyCategory === 'Numbers 0–9' ||
                        selectedKeyCategory === 'Function Keys'
                          ? 'grid-cols-5 sm:grid-cols-6'
                          : 'grid-cols-2 sm:grid-cols-3'
                      } ${cardBg}`}
                    >
                      {displayedKeyboardKeys.map((keyDef) => {
                        const isSelected = destinationId === keyDef.id;
                        return (
                          <button
                            key={keyDef.id}
                            type="button"
                            data-ui-control="true"
                            onClick={() => {
                              setDestinationId(keyDef.id);
                              setFormError(null);
                            }}
                            className={`min-h-[42px] px-2 py-2 rounded-lg border text-center font-mono text-xs font-bold transition-all active:scale-95 flex flex-col items-center justify-center ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-400 shadow-xs'
                                : `${elevatedBg} hover:border-blue-500/50`
                            }`}
                          >
                            <span>{keyDef.keyCap}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {MOUSE_INPUT_CATALOG.map((btn) => {
                      const isSelected = destinationId === btn.id;
                      const isSameAsSource =
                        sourceMouseId === btn.id && modifiers.length === 0;
                      return (
                        <button
                          key={btn.id}
                          type="button"
                          data-ui-control="true"
                          onClick={() => {
                            setDestinationId(btn.id);
                            setFormError(null);
                          }}
                          className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-all active:scale-[0.98] flex flex-col justify-between ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-500'
                              : `${elevatedBg} hover:border-blue-500/40`
                          } ${isSameAsSource ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-1 w-full">
                            <span className="text-xs font-bold truncate">
                              {btn.shortLabel}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </div>
                          <span
                            className={`text-[11px] truncate ${
                              isSelected ? 'text-blue-100' : mutedText
                            }`}
                          >
                            {isSameAsSource ? 'Same as source' : btn.compactTag}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Optional Modifier Combination Chips */}
                <div className="pt-1 space-y-1.5">
                  <span className={`block text-xs font-medium ${mutedText}`}>
                    Optional Hold Modifiers (Combined with output)
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {ALL_MODIFIERS.map((mod) => {
                      const active = modifiers.includes(mod);
                      return (
                        <button
                          key={mod}
                          type="button"
                          data-ui-control="true"
                          onClick={() => toggleModifier(mod)}
                          className={`min-h-[38px] py-1.5 px-2 text-xs font-mono font-bold rounded-xl border transition-all active:scale-95 ${
                            active
                              ? 'bg-blue-600 text-white border-blue-500'
                              : elevatedBg
                          }`}
                        >
                          {active ? `✓ ${mod}` : mod}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-xs text-red-200 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Step 2 Footer Buttons: Back & Save Mapping (Clicked by hand) */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    data-ui-control="true"
                    onClick={() => {
                      setFormError(null);
                      setWizardStep(1);
                    }}
                    className={`min-h-[46px] py-2.5 px-4 text-xs font-bold rounded-xl border transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 ${elevatedBg}`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Step 1
                  </button>
                  <button
                    type="button"
                    data-ui-control="true"
                    onClick={handleSaveForm}
                    className="min-h-[46px] py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    Save Mapping
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collapsible Hardware & Lifecycle Simulator */}
      <div className={`rounded-2xl border transition-colors ${shellBg}`}>
        <button
          type="button"
          data-ui-control="true"
          onClick={() => setHardwareBarExpanded(!hardwareBarExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold">
              Android Device Lifecycle & Hotplug Controls
            </span>
          </div>
          <span className={`text-xs font-mono ${mutedText}`}>
            {hardwareBarExpanded ? 'Hide' : 'Expand'}
          </span>
        </button>

        {hardwareBarExpanded && (
          <div
            className={`px-4 pb-4 pt-2 border-t space-y-3 ${
              isDark ? 'border-slate-800/80' : 'border-slate-200'
            }`}
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-ui-control="true"
                onClick={() => onConnectMouse('USB OTG')}
                className={`min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all active:scale-95 ${elevatedBg}`}
              >
                <Usb className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Connect USB Mouse</span>
              </button>

              <button
                type="button"
                data-ui-control="true"
                onClick={() => onConnectMouse('Bluetooth HID')}
                className={`min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all active:scale-95 ${elevatedBg}`}
              >
                <Bluetooth className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Connect BT Mouse</span>
              </button>

              <button
                type="button"
                data-ui-control="true"
                onClick={() => onToggleAppUiClosed(!appUiClosed)}
                className={`min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all active:scale-95 ${elevatedBg}`}
              >
                {appUiClosed ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Reopen App UI</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Close App UI</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-ui-control="true"
                onClick={() => {
                  onSimulatePhoneReboot();
                  triggerToast('Phone restarted · Restored saved DataStore mappings');
                }}
                className={`min-h-[42px] px-3 py-2 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all active:scale-95 ${elevatedBg}`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Restart Phone</span>
              </button>
            </div>

            {connectedMice.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {connectedMice.map((mouse) => (
                  <div
                    key={mouse.deviceId}
                    className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 ${cardBg}`}
                  >
                    <div className="min-w-0 truncate">
                      <span className="font-semibold">{mouse.name}</span>
                      <span className={`mx-1.5 ${mutedText}`}>·</span>
                      <span className={mutedText}>{mouse.transport}</span>
                    </div>
                    <button
                      type="button"
                      data-ui-control="true"
                      onClick={() => onDisconnectMouse(mouse.deviceId)}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 shrink-0"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            )}

            {lastLifecycleMessage && (
              <div
                className={`text-xs px-3 py-2 rounded-xl border ${
                  isDark
                    ? 'bg-slate-900/90 border-slate-800 text-slate-300'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                {lastLifecycleMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
