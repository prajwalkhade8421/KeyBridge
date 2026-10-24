export type DestinationType = 'KEYBOARD' | 'MOUSE';

export type ModifierKey = 'CTRL' | 'SHIFT' | 'ALT' | 'META';

export type AndroidBackendMode =
  | 'HYBRID_UINPUT'
  | 'STOCK_ACCESSIBILITY'
  | 'RESTRICTED_UNAVAILABLE';

export type MouseButtonGroup =
  | 'Primary Buttons'
  | 'Side Navigation'
  | 'Additional Buttons';

export interface MouseInputDefinition {
  id: string;
  label: string;
  shortLabel: string;
  compactTag: string;
  group: MouseButtonGroup;
  androidMotionConstant: string;
  androidMotionMaskHex: string;
  androidFallbackKeyCode: string | null;
  linuxEvdevName: string;
  linuxEvdevCodeHex: string;
  linuxEvdevCodeDec: number;
  domButtonIndex: number;
  stockInterceptableViaKeyEvent: boolean;
  description: string;
}

export type KeyboardCategory =
  | 'Letters A–Z'
  | 'Numbers 0–9'
  | 'Function Keys'
  | 'Navigation & Arrows'
  | 'Modifier Keys';

export interface KeyboardInputDefinition {
  id: string;
  label: string;
  shortLabel: string;
  keyCap: string;
  category: KeyboardCategory;
  androidKeyCodeName: string;
  androidKeyCodeDec: number;
  linuxKeyName: string;
  linuxKeyCodeDec: number;
  domKeyCode: string;
  printableChar?: string;
}

export interface MappingRule {
  id: string;
  sourceMouseId: string;
  destinationType: DestinationType;
  destinationId: string;
  modifiers: ModifierKey[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ConnectedMouseDevice {
  deviceId: number;
  name: string;
  transport: 'USB OTG' | 'Bluetooth HID';
  sources: string;
  exposedButtons: string[];
  connectedAt: number;
}

export interface HeldButtonState {
  sourceMouseId: string;
  deviceId: number;
  deviceName: string;
  pressedAt: number;
  ruleId: string | null;
  resolvedTargetLabel: string;
  resolvedAndroidCode: string;
  resolvedLinuxCode: string;
  modifiers: ModifierKey[];
  suppressedOriginal: boolean;
}

export interface DiagnosticEventRecord {
  id: string;
  timestamp: number;
  phase: 'PRESS' | 'HOLD' | 'RELEASE' | 'DISCONNECT_CLEANUP';
  deviceName: string;
  rawMouseButtonLabel: string;
  rawAndroidMotionConstant: string;
  rawLinuxEvdevConstant: string;
  matchedRuleId: string | null;
  sourceSuppressed: boolean;
  suppressionReason: string;
  replacementOutputLabel: string;
  replacementAndroidCode: string;
  replacementLinuxCode: string;
  deliveredToTargetApp: boolean;
  deliveryNote: string;
}

export const MOUSE_INPUT_CATALOG: MouseInputDefinition[] = [
  {
    id: 'MOUSE_LEFT',
    label: 'Mouse Left',
    shortLabel: 'Mouse Left',
    compactTag: 'Button 1 · Primary',
    group: 'Primary Buttons',
    androidMotionConstant: 'MotionEvent.BUTTON_PRIMARY',
    androidMotionMaskHex: '0x00000001',
    androidFallbackKeyCode: null,
    linuxEvdevName: 'BTN_LEFT',
    linuxEvdevCodeHex: '0x110',
    linuxEvdevCodeDec: 272,
    domButtonIndex: 0,
    stockInterceptableViaKeyEvent: false,
    description: 'Primary left click button on USB OTG and Bluetooth HID mice.'
  },
  {
    id: 'MOUSE_RIGHT',
    label: 'Mouse Right',
    shortLabel: 'Mouse Right',
    compactTag: 'Button 2 · Secondary',
    group: 'Primary Buttons',
    androidMotionConstant: 'MotionEvent.BUTTON_SECONDARY',
    androidMotionMaskHex: '0x00000002',
    androidFallbackKeyCode: 'KeyEvent.KEYCODE_BACK (OEM dependent)',
    linuxEvdevName: 'BTN_RIGHT',
    linuxEvdevCodeHex: '0x111',
    linuxEvdevCodeDec: 273,
    domButtonIndex: 2,
    stockInterceptableViaKeyEvent: false,
    description: 'Secondary right click button (context menu or secondary action).'
  },
  {
    id: 'MOUSE_MIDDLE',
    label: 'Mouse Middle',
    shortLabel: 'Mouse Middle',
    compactTag: 'Button 3 · Wheel Click',
    group: 'Primary Buttons',
    androidMotionConstant: 'MotionEvent.BUTTON_TERTIARY',
    androidMotionMaskHex: '0x00000004',
    androidFallbackKeyCode: null,
    linuxEvdevName: 'BTN_MIDDLE',
    linuxEvdevCodeHex: '0x112',
    linuxEvdevCodeDec: 274,
    domButtonIndex: 1,
    stockInterceptableViaKeyEvent: false,
    description: 'Scroll wheel press / middle mouse button.'
  },
  {
    id: 'MOUSE_BACK',
    label: 'Mouse Back',
    shortLabel: 'Mouse Back',
    compactTag: 'Button 4 · Side Back',
    group: 'Side Navigation',
    androidMotionConstant: 'MotionEvent.BUTTON_BACK',
    androidMotionMaskHex: '0x00000008',
    androidFallbackKeyCode: 'KeyEvent.KEYCODE_BACK (4)',
    linuxEvdevName: 'BTN_SIDE',
    linuxEvdevCodeHex: '0x113',
    linuxEvdevCodeDec: 275,
    domButtonIndex: 3,
    stockInterceptableViaKeyEvent: true,
    description: 'Side thumb button 4 (mapped to Android Back navigation by default).'
  },
  {
    id: 'MOUSE_FORWARD',
    label: 'Mouse Forward',
    shortLabel: 'Mouse Forward',
    compactTag: 'Button 5 · Side Forward',
    group: 'Side Navigation',
    androidMotionConstant: 'MotionEvent.BUTTON_FORWARD',
    androidMotionMaskHex: '0x00000010',
    androidFallbackKeyCode: 'KeyEvent.KEYCODE_FORWARD (125)',
    linuxEvdevName: 'BTN_EXTRA',
    linuxEvdevCodeHex: '0x114',
    linuxEvdevCodeDec: 276,
    domButtonIndex: 4,
    stockInterceptableViaKeyEvent: true,
    description: 'Side thumb button 5 (mapped to Android Forward navigation by default).'
  },
  {
    id: 'MOUSE_BUTTON_6',
    label: 'Mouse Button 6',
    shortLabel: 'Mouse Button 6',
    compactTag: 'Button 6 · Aux Forward',
    group: 'Additional Buttons',
    androidMotionConstant: 'MotionEvent.BUTTON_STYLUS_PRIMARY',
    androidMotionMaskHex: '0x00000020',
    androidFallbackKeyCode: null,
    linuxEvdevName: 'BTN_FORWARD',
    linuxEvdevCodeHex: '0x115',
    linuxEvdevCodeDec: 277,
    domButtonIndex: 5,
    stockInterceptableViaKeyEvent: false,
    description: 'Numbered auxiliary mouse button 6 exposed via HID Button page.'
  },
  {
    id: 'MOUSE_BUTTON_7',
    label: 'Mouse Button 7',
    shortLabel: 'Mouse Button 7',
    compactTag: 'Button 7 · Aux Back',
    group: 'Additional Buttons',
    androidMotionConstant: 'MotionEvent.BUTTON_STYLUS_SECONDARY',
    androidMotionMaskHex: '0x00000040',
    androidFallbackKeyCode: null,
    linuxEvdevName: 'BTN_BACK',
    linuxEvdevCodeHex: '0x116',
    linuxEvdevCodeDec: 278,
    domButtonIndex: 6,
    stockInterceptableViaKeyEvent: false,
    description: 'Numbered auxiliary mouse button 7 exposed via HID Button page.'
  },
  {
    id: 'MOUSE_BUTTON_8',
    label: 'Mouse Button 8',
    shortLabel: 'Mouse Button 8',
    compactTag: 'Button 8 · Aux Task',
    group: 'Additional Buttons',
    androidMotionConstant: '0x00000080 (HID Button 8)',
    androidMotionMaskHex: '0x00000080',
    androidFallbackKeyCode: null,
    linuxEvdevName: 'BTN_TASK',
    linuxEvdevCodeHex: '0x117',
    linuxEvdevCodeDec: 279,
    domButtonIndex: 7,
    stockInterceptableViaKeyEvent: false,
    description: 'Numbered auxiliary mouse button 8 exposed via Linux evdev BTN_TASK.'
  }
];

const LETTER_LINUX_CODES: Record<string, number> = {
  A: 30, B: 48, C: 46, D: 32, E: 18, F: 33, G: 34, H: 35, I: 23, J: 36,
  K: 37, L: 38, M: 50, N: 49, O: 24, P: 25, Q: 16, R: 19, S: 31, T: 20,
  U: 22, V: 47, W: 17, X: 45, Y: 21, Z: 44
};

const LETTER_KEYS: KeyboardInputDefinition[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((char, idx) => ({
  id: `KEY_${char}`,
  label: `Keyboard ${char}`,
  shortLabel: `Keyboard ${char}`,
  keyCap: char,
  category: 'Letters A–Z',
  androidKeyCodeName: `KeyEvent.KEYCODE_${char}`,
  androidKeyCodeDec: 29 + idx,
  linuxKeyName: `KEY_${char}`,
  linuxKeyCodeDec: LETTER_LINUX_CODES[char] ?? (30 + idx),
  domKeyCode: `Key${char}`,
  printableChar: char.toLowerCase()
}));

const NUMBER_LINUX_CODES: Record<string, number> = {
  '1': 2, '2': 3, '3': 4, '4': 5, '5': 6, '6': 7, '7': 8, '8': 9, '9': 10, '0': 11
};

const NUMBER_KEYS: KeyboardInputDefinition[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => ({
  id: `KEY_${digit}`,
  label: `Keyboard ${digit}`,
  shortLabel: `Keyboard ${digit}`,
  keyCap: digit,
  category: 'Numbers 0–9',
  androidKeyCodeName: `KeyEvent.KEYCODE_${digit}`,
  androidKeyCodeDec: 7 + Number(digit),
  linuxKeyName: `KEY_${digit}`,
  linuxKeyCodeDec: NUMBER_LINUX_CODES[digit] ?? 11,
  domKeyCode: `Digit${digit}`,
  printableChar: digit
}));

const FUNCTION_LINUX_CODES: number[] = [59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 87, 88];

const FUNCTION_KEYS: KeyboardInputDefinition[] = Array.from({ length: 12 }, (_, i) => {
  const num = i + 1;
  return {
    id: `KEY_F${num}`,
    label: `Function F${num}`,
    shortLabel: `F${num}`,
    keyCap: `F${num}`,
    category: 'Function Keys',
    androidKeyCodeName: `KeyEvent.KEYCODE_F${num}`,
    androidKeyCodeDec: 131 + i,
    linuxKeyName: `KEY_F${num}`,
    linuxKeyCodeDec: FUNCTION_LINUX_CODES[i],
    domKeyCode: `F${num}`
  };
});

const NAVIGATION_AND_ARROW_KEYS: KeyboardInputDefinition[] = [
  {
    id: 'KEY_SPACE',
    label: 'Spacebar',
    shortLabel: 'Space',
    keyCap: 'Space',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_SPACE',
    androidKeyCodeDec: 62,
    linuxKeyName: 'KEY_SPACE',
    linuxKeyCodeDec: 57,
    domKeyCode: 'Space',
    printableChar: ' '
  },
  {
    id: 'KEY_ENTER',
    label: 'Enter',
    shortLabel: 'Enter',
    keyCap: 'Enter ↵',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_ENTER',
    androidKeyCodeDec: 66,
    linuxKeyName: 'KEY_ENTER',
    linuxKeyCodeDec: 28,
    domKeyCode: 'Enter',
    printableChar: '\n'
  },
  {
    id: 'KEY_ESCAPE',
    label: 'Escape',
    shortLabel: 'Escape',
    keyCap: 'Esc',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_ESCAPE',
    androidKeyCodeDec: 111,
    linuxKeyName: 'KEY_ESC',
    linuxKeyCodeDec: 1,
    domKeyCode: 'Escape'
  },
  {
    id: 'KEY_TAB',
    label: 'Tab',
    shortLabel: 'Tab',
    keyCap: 'Tab ⇥',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_TAB',
    androidKeyCodeDec: 61,
    linuxKeyName: 'KEY_TAB',
    linuxKeyCodeDec: 15,
    domKeyCode: 'Tab'
  },
  {
    id: 'KEY_BACKSPACE',
    label: 'Backspace',
    shortLabel: 'Backspace',
    keyCap: '⌫ Backspace',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_DEL',
    androidKeyCodeDec: 67,
    linuxKeyName: 'KEY_BACKSPACE',
    linuxKeyCodeDec: 14,
    domKeyCode: 'Backspace'
  },
  {
    id: 'KEY_DPAD_UP',
    label: 'Arrow Up',
    shortLabel: 'Arrow Up',
    keyCap: '↑ Up',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_DPAD_UP',
    androidKeyCodeDec: 19,
    linuxKeyName: 'KEY_UP',
    linuxKeyCodeDec: 103,
    domKeyCode: 'ArrowUp'
  },
  {
    id: 'KEY_DPAD_DOWN',
    label: 'Arrow Down',
    shortLabel: 'Arrow Down',
    keyCap: '↓ Down',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_DPAD_DOWN',
    androidKeyCodeDec: 20,
    linuxKeyName: 'KEY_DOWN',
    linuxKeyCodeDec: 108,
    domKeyCode: 'ArrowDown'
  },
  {
    id: 'KEY_DPAD_LEFT',
    label: 'Arrow Left',
    shortLabel: 'Arrow Left',
    keyCap: '← Left',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_DPAD_LEFT',
    androidKeyCodeDec: 21,
    linuxKeyName: 'KEY_LEFT',
    linuxKeyCodeDec: 105,
    domKeyCode: 'ArrowLeft'
  },
  {
    id: 'KEY_DPAD_RIGHT',
    label: 'Arrow Right',
    shortLabel: 'Arrow Right',
    keyCap: '→ Right',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_DPAD_RIGHT',
    androidKeyCodeDec: 22,
    linuxKeyName: 'KEY_RIGHT',
    linuxKeyCodeDec: 106,
    domKeyCode: 'ArrowRight'
  },
  {
    id: 'KEY_FORWARD_DEL',
    label: 'Delete (Forward)',
    shortLabel: 'Delete',
    keyCap: 'Del',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_FORWARD_DEL',
    androidKeyCodeDec: 112,
    linuxKeyName: 'KEY_DELETE',
    linuxKeyCodeDec: 111,
    domKeyCode: 'Delete'
  },
  {
    id: 'KEY_INSERT',
    label: 'Insert',
    shortLabel: 'Insert',
    keyCap: 'Ins',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_INSERT',
    androidKeyCodeDec: 124,
    linuxKeyName: 'KEY_INSERT',
    linuxKeyCodeDec: 110,
    domKeyCode: 'Insert'
  },
  {
    id: 'KEY_HOME',
    label: 'Home',
    shortLabel: 'Home',
    keyCap: 'Home',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_MOVE_HOME',
    androidKeyCodeDec: 122,
    linuxKeyName: 'KEY_HOME',
    linuxKeyCodeDec: 102,
    domKeyCode: 'Home'
  },
  {
    id: 'KEY_END',
    label: 'End',
    shortLabel: 'End',
    keyCap: 'End',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_MOVE_END',
    androidKeyCodeDec: 123,
    linuxKeyName: 'KEY_END',
    linuxKeyCodeDec: 107,
    domKeyCode: 'End'
  },
  {
    id: 'KEY_PAGE_UP',
    label: 'Page Up',
    shortLabel: 'Page Up',
    keyCap: 'PgUp',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_PAGE_UP',
    androidKeyCodeDec: 92,
    linuxKeyName: 'KEY_PAGEUP',
    linuxKeyCodeDec: 104,
    domKeyCode: 'PageUp'
  },
  {
    id: 'KEY_PAGE_DOWN',
    label: 'Page Down',
    shortLabel: 'Page Down',
    keyCap: 'PgDn',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_PAGE_DOWN',
    androidKeyCodeDec: 93,
    linuxKeyName: 'KEY_PAGEDOWN',
    linuxKeyCodeDec: 109,
    domKeyCode: 'PageDown'
  },
  {
    id: 'KEY_GRAVE',
    label: 'Grave / Tilde (~)',
    shortLabel: 'Grave ~',
    keyCap: '~ `',
    category: 'Navigation & Arrows',
    androidKeyCodeName: 'KeyEvent.KEYCODE_GRAVE',
    androidKeyCodeDec: 68,
    linuxKeyName: 'KEY_GRAVE',
    linuxKeyCodeDec: 41,
    domKeyCode: 'Backquote',
    printableChar: '`'
  }
];

const MODIFIER_KEYS: KeyboardInputDefinition[] = [
  {
    id: 'KEY_CTRL_LEFT',
    label: 'Left Ctrl',
    shortLabel: 'Left Ctrl',
    keyCap: 'Left Ctrl',
    category: 'Modifier Keys',
    androidKeyCodeName: 'KeyEvent.KEYCODE_CTRL_LEFT',
    androidKeyCodeDec: 113,
    linuxKeyName: 'KEY_LEFTCTRL',
    linuxKeyCodeDec: 29,
    domKeyCode: 'ControlLeft'
  },
  {
    id: 'KEY_SHIFT_LEFT',
    label: 'Left Shift',
    shortLabel: 'Left Shift',
    keyCap: 'Left Shift',
    category: 'Modifier Keys',
    androidKeyCodeName: 'KeyEvent.KEYCODE_SHIFT_LEFT',
    androidKeyCodeDec: 59,
    linuxKeyName: 'KEY_LEFTSHIFT',
    linuxKeyCodeDec: 42,
    domKeyCode: 'ShiftLeft'
  },
  {
    id: 'KEY_ALT_LEFT',
    label: 'Left Alt',
    shortLabel: 'Left Alt',
    keyCap: 'Left Alt',
    category: 'Modifier Keys',
    androidKeyCodeName: 'KeyEvent.KEYCODE_ALT_LEFT',
    androidKeyCodeDec: 57,
    linuxKeyName: 'KEY_LEFTALT',
    linuxKeyCodeDec: 56,
    domKeyCode: 'AltLeft'
  },
  {
    id: 'KEY_META_LEFT',
    label: 'Left Meta / Super',
    shortLabel: 'Left Meta',
    keyCap: 'Meta / Super',
    category: 'Modifier Keys',
    androidKeyCodeName: 'KeyEvent.KEYCODE_META_LEFT',
    androidKeyCodeDec: 117,
    linuxKeyName: 'KEY_LEFTMETA',
    linuxKeyCodeDec: 125,
    domKeyCode: 'MetaLeft'
  },
  {
    id: 'KEY_CTRL_RIGHT',
    label: 'Right Ctrl',
    shortLabel: 'Right Ctrl',
    keyCap: 'Right Ctrl',
    category: 'Modifier Keys',
    androidKeyCodeName: 'KeyEvent.KEYCODE_CTRL_RIGHT',
    androidKeyCodeDec: 114,
    linuxKeyName: 'KEY_RIGHTCTRL',
    linuxKeyCodeDec: 97,
    domKeyCode: 'ControlRight'
  },
  {
    id: 'KEY_SHIFT_RIGHT',
    label: 'Right Shift',
    shortLabel: 'Right Shift',
    keyCap: 'Right Shift',
    category: 'Modifier Keys',
    androidKeyCodeName: 'KeyEvent.KEYCODE_SHIFT_RIGHT',
    androidKeyCodeDec: 60,
    linuxKeyName: 'KEY_RIGHTSHIFT',
    linuxKeyCodeDec: 54,
    domKeyCode: 'ShiftRight'
  }
];

export const KEYBOARD_INPUT_CATALOG: KeyboardInputDefinition[] = [
  ...LETTER_KEYS,
  ...NUMBER_KEYS,
  ...FUNCTION_KEYS,
  ...NAVIGATION_AND_ARROW_KEYS,
  ...MODIFIER_KEYS
];

export function getMouseInputById(id: string): MouseInputDefinition | undefined {
  return MOUSE_INPUT_CATALOG.find((item) => item.id === id);
}

export function getMouseInputByDomButton(domButton: number): MouseInputDefinition | undefined {
  return MOUSE_INPUT_CATALOG.find((item) => item.domButtonIndex === domButton);
}

export function getKeyboardInputById(id: string): KeyboardInputDefinition | undefined {
  return KEYBOARD_INPUT_CATALOG.find((item) => item.id === id);
}

export function getKeyboardInputByDomCode(domCode: string): KeyboardInputDefinition | undefined {
  return KEYBOARD_INPUT_CATALOG.find((item) => item.domKeyCode === domCode);
}

export function getDestinationDetails(type: DestinationType, id: string): {
  label: string;
  shortLabel: string;
  androidCode: string;
  linuxCode: string;
  printableChar?: string;
} {
  if (type === 'MOUSE') {
    const mouse = getMouseInputById(id);
    if (!mouse) {
      return {
        label: id,
        shortLabel: id,
        androidCode: 'MotionEvent.BUTTON_UNKNOWN',
        linuxCode: 'BTN_UNKNOWN'
      };
    }
    return {
      label: mouse.label,
      shortLabel: mouse.shortLabel,
      androidCode: `${mouse.androidMotionConstant} (${mouse.androidMotionMaskHex})`,
      linuxCode: `${mouse.linuxEvdevName} (${mouse.linuxEvdevCodeHex})`
    };
  }

  const key = getKeyboardInputById(id);
  if (!key) {
    return {
      label: id,
      shortLabel: id,
      androidCode: 'KeyEvent.KEYCODE_UNKNOWN',
      linuxCode: 'KEY_UNKNOWN'
    };
  }
  return {
    label: key.label,
    shortLabel: key.shortLabel,
    androidCode: `${key.androidKeyCodeName} (${key.androidKeyCodeDec})`,
    linuxCode: `${key.linuxKeyName} (${key.linuxKeyCodeDec})`,
    printableChar: key.printableChar
  };
}

export const DEFAULT_INITIAL_MAPPINGS: MappingRule[] = [];

