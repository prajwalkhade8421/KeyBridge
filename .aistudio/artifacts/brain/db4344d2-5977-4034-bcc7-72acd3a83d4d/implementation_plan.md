# KeyBridge — Android Hardware Mouse-to-Input Remapper & Engineering Workbench

KeyBridge is a focused, persistent Android input-to-input remapper that converts physical mouse button events into keyboard keys or alternate mouse buttons without requiring a connected mouse during setup. Because this workspace runs in a web browser, the application delivers both an interactive Android Remapper & Live Hardware Input Diagnostic Workbench and a complete, ready-to-build native Android Studio (Kotlin) project exporter implementing a hybrid privilege architecture.

### User Review & Critical Decisions

> [!IMPORTANT]
> The decisions below incorporate your confirmed answers from Phase 1 and establish the exact technical boundaries for stock Android vs. elevated-privilege input replacement.

- **Confirmed Decision 1 — Hybrid Android Privilege Architecture**: Implements a dual-tier engine supporting **(A) Root / Shizuku `uinput` daemon mode** (`EVIOCGRAB` on `/dev/input/event*` + virtual `/dev/uinput` device creation for genuine global mouse button suppression and hardware-level key/mouse injection in apps like PojavLauncher) and **(B) Stock No-Root mode** (`AccessibilityService.onKeyEvent` + companion `InputMethodService` & `InputManager.InputDeviceListener` for intercepting `KEYCODE_BACK` / `KEYCODE_FORWARD` mapped mouse buttons and dispatching text/key actions where stock Android permits).
- **Confirmed Decision 2 — Interactive Web Workbench + Full Android Studio Exporter**: Provides a multi-column 1440px engineering workspace combining the exact minimal Android app UI (Main Screen and Add/Edit Mapping Screen), a live browser hardware mouse/keyboard event verifier & target app sandbox (including a PojavLauncher LWJGL/GLFW input listener simulation), and a complete Android Studio project code inspector & single-click bundle exporter.
- **Confirmed Decision 3 — Manual Selector Default + Optional Hardware Capture Mode**: The Add/Edit Mapping screen defaults to offline-ready dropdown selectors for all mouse buttons and standard Android keycodes, supplemented by an optional physical button capture toggle that listens for live mouse or keyboard input when a device is attached.

---

### 1. Overview & Core Concept

- **What It Does**: Allows users to configure persistent physical mouse-to-keyboard or mouse-to-mouse button mappings at any time (even with zero mice connected), saves rules locally via Android Jetpack DataStore (`Preferences`), automatically detects USB OTG and Bluetooth HID mouse connections via `InputManager.InputDeviceListener`, and performs stateful press/hold/release input replacement.
- **Target Audience / Persona**: Android power users, mobile desktop (DeX) users, and Minecraft Java (PojavLauncher) players who need reliable hardware mouse button remapping (e.g., `Mouse Forward → Keyboard T`, `Mouse Back → Mouse Left`) without bloatware, touch-screen overlays, macros, or RGB/DPI clutter.
- **Key Value**: Honest, zero-simulation hardware input remapping backed by a transparent Android feasibility investigation, rigorous key-down/key-up state tracking, anti-stuck-key cleanup on disconnect, and full offline configuration persistence.

#### Mandatory Android Technical Feasibility & Limitations Investigation

> [!WARNING]
> **Stock Android Input Policy Reality Check**: On unrooted stock Android, receiving an input event does **not** mean an app can suppress it globally or inject arbitrary `KeyEvent` / `MotionEvent` structs into another app's window (such as PojavLauncher). Below is the exact breakdown enforced by the Android OS (`InputDispatcher` and SELinux):

1. **`InputDevice` & `InputManager` APIs**:
   - `InputManager.getInputDeviceIds()` and `InputDevice.getDevice(id)` allow any normal app to dynamically discover USB OTG and Bluetooth HID mice (`SOURCE_MOUSE` or `SOURCE_MOUSE_RELATIVE`) and subscribe to hotplug events via `InputManager.InputDeviceListener`.
   - However, `InputManager` only reports device metadata and connection state to background services; it does **not** stream raw `MotionEvent` button presses to background apps.
2. **Mouse Button Event Codes (`MotionEvent` vs. `KeyEvent`)**:
   - Physical mouse clicks generate `MotionEvent` actions (`ACTION_BUTTON_PRESS`, `ACTION_BUTTON_RELEASE`) carrying button bitmasks: `BUTTON_PRIMARY` (Left), `BUTTON_SECONDARY` (Right), `BUTTON_TERTIARY` (Middle), `BUTTON_BACK` (Button 4), `BUTTON_FORWARD` (Button 5), and `BUTTON_STYLUS_PRIMARY` / numbered buttons up to Button 16.
   - Android's `InputReader` also synthesizes fallback `KeyEvent` codes (`KEYCODE_BACK` and `KEYCODE_FORWARD`) for Mouse Button 4 and Button 5 if the foreground view does not consume the `MotionEvent`.
3. **`AccessibilityService` Limitations**:
   - An `AccessibilityService` with `flagRequestFilterKeyEvents` can intercept `KeyEvent` instances (`onKeyEvent`) globally and suppress them by returning `true`. This works for Mouse Back/Forward *only* when the mouse or Android key layout maps them to `KEYCODE_BACK` / `KEYCODE_FORWARD`.
   - **Crucial Limitation**: `AccessibilityService` **cannot** receive or suppress raw `MotionEvent` mouse clicks (`BUTTON_PRIMARY`, `BUTTON_SECONDARY`, `BUTTON_TERTIARY`, or raw `BUTTON_BACK`/`BUTTON_FORWARD` consumed directly by a game view via `OnCapturedPointerListener` / Pointer Capture API).
   - Furthermore, `AccessibilityService` cannot inject arbitrary `KEYCODE_*` events (like `KEYCODE_T`) into games; it only supports global system actions (`GLOBAL_ACTION_BACK`, etc.) or `GestureDescription` touch strokes (which violate our strict no-touch-simulation rule).
4. **USB Host APIs (`UsbManager`) & HID Report Access**:
   - Claiming a USB mouse interface with `UsbDeviceConnection.claimInterface(intf, true)` detaches the kernel `usbhid` driver. While the app can read raw 3–8 byte HID reports on a bulk/interrupt endpoint, detaching the kernel driver **kills the native Android mouse cursor**, does not work for Bluetooth HID mice, and still leaves a non-root app unable to inject replacement hardware events globally without `uinput`.
5. **Virtual Keyboard (`InputMethodService`) & `Instrumentation` Injection**:
   - Calling `InputManager.injectInputEvent()` requires `android.permission.INJECT_EVENTS`, a `signature`-level system permission denied to third-party apps.
   - An active `InputMethodService` (IME) can call `currentInputConnection.sendKeyEvent(KeyEvent(ACTION_DOWN, KEYCODE_T))`, which works inside text fields, but 3D games using Android's `View.requestPointerCapture()` (like PojavLauncher) often bypass `InputConnection` unless their input bridge listens to IME key events.
6. **Root / Shizuku & Linux Kernel `evdev` + `uinput` (True Global Replacement)**:
   - To achieve **100% genuine system-wide mouse button suppression and hardware-level replacement** across all buttons (`Left`, `Right`, `Middle`, `Back`, `Forward`, `Button 6–8`) and all target apps (including PojavLauncher with Pointer Capture active), a privileged helper daemon launched via **Root (`su`)** or **Shizuku / ADB (`shell` UID 2000 where `/dev/input` & `/dev/uinput` group permissions allow `input` group access)**:
     1. Opens `/dev/input/eventX` for discovered mouse devices and issues `ioctl(fd, EVIOCGRAB, 1)` to exclusively intercept physical `EV_KEY` (`BTN_LEFT`, `BTN_RIGHT`, `BTN_MIDDLE`, `BTN_SIDE`, `BTN_EXTRA`) and `EV_REL` (`REL_X`, `REL_Y`, `REL_WHEEL`) events.
     2. Creates a composite virtual device via `/dev/uinput` registering both `EV_REL` mouse axes/buttons and `EV_KEY` keyboard keycodes.
     3. Passes unmapped mouse movements/buttons through untouched with zero latency, while translating mapped mouse button `EV_KEY` down/up frames (`value = 1`, `value = 0`, `value = 2` hold) into replacement `EV_KEY` keyboard or mouse button events.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Offline Mapping Configuration (No Mouse Connected)**: The user opens the app (or the interactive Android simulator on the left of the workspace), taps **Add Mapping**, selects `Source: Mouse Forward (Button 5)` and `Destination Type: Keyboard` → `Destination: Keyboard T (KEYCODE_T)` from clean manual lists, and taps **Save**. The rule is immediately persisted and listed on the Main Screen even while `Connected Mice: 0`.
  2. **Optional Hardware Capture**: While on the Add/Edit Mapping screen, the user can click **Capture Physical Button** and press any button on their real mouse (Button 0–4) or keyboard to auto-populate the source or destination selector.
  3. **Automatic Hotplug & Background Operation**: When the user toggles **Master Remapping** ON, the persistent foreground service starts. Connecting a USB OTG or Bluetooth mouse (either via a real mouse click in the browser diagnostic verifier or the hotplug connection simulator) automatically transitions the status from `Standby (Waiting for Mouse)` to `Active (Remapping Applied)` without requiring a manual Start button.
  4. **Live Input Diagnostic & Target Sandbox Verification**: In the right-hand Diagnostic & Verification Workbench, the user presses physical mouse buttons (Left, Right, Middle, Back/Button 4, Forward/Button 5) inside the **Pointer Capture & PojavLauncher Input Test Area**. The workbench intercepts the real DOM `PointerEvent` / `MouseEvent`, suppresses browser default actions (`contextmenu`, `mouseup` history navigation), runs the active mapping table, tracks held keys and modifier states (`Ctrl`, `Shift`, `Alt`, `Meta`), and shows both the raw physical event and the emitted replacement `KeyEvent` / `MouseEvent` reaching the target application.
  5. **Disconnect Cleanup & Reboot Persistence**: Disconnecting the mouse mid-hold automatically dispatches synthetic `ACTION_UP` / `EV_KEY 0` release events for any currently held mapped keys so no key ever gets stuck, while preserving all saved mappings across disconnects and simulated phone reboots.
  6. **Complete Android Studio Project Export**: Switching to the **Android Studio Project & Build Guide** tab lets the user inspect every production Kotlin/JNI file and download the complete project structure with step-by-step build and ADB/Root/Shizuku setup instructions.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Utilitarian Hardware Precision — inspired by native Android system utilities and clean hardware diagnostic instruments. Zero decorative bloat, zero gaming clichés, and strict adherence to the minimal two-screen specification for the Android app.
  - *Color Palette & Mood*:
    - **60% Dominant Neutral Canvas**: Crisp cool slate-white `#F8FAFC` (`bg-slate-50`) workspace background with `#FFFFFF` primary structural panels.
    - **30% Structural Surfaces**: Hairline borders `#E2E8F0` (`border-slate-200`), deep slate ink `#0F172A` (`text-slate-900`) for primary labels, and muted slate `#475569` (`text-slate-600`) for technical metadata.
    - **10% Accent Budget**: High-intent cobalt `#2563EB` (`bg-blue-600`) for primary actions and active toggles; semantic emerald `#16A34A` for active service status; amber `#D97706` for stock Android restriction warnings; crimson `#DC2626` for suppressed source events and destructive actions.
  - *Typography & Hierarchy*:
    - **Display / Headings**: `Plus Jakarta Sans` (SemiBold 600 / Bold 700, tight tracking, `text-wrap: balance`).
    - **Body & UI Controls**: `DM Sans` (Regular 400 / Medium 500) for clear legibility across selectors and explanations.
    - **Keycodes, Event Codes & Source Code**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` for Android `KEYCODE_*` constants, Linux `BTN_*` / `EV_KEY` hex codes, hold duration timers, and Kotlin source files.
  - *Component Styling & Layout*:
    - Full `1440px` desktop container (`max-w-7xl mx-auto`) obeying the strict 3-zone Top Bar Contract (`KeyBridge` brand wordmark — 4 single-line workspace nav links — 1 `Export Android Project` primary CTA button).
    - Single-elevation card depth (`border border-slate-200 bg-white rounded-xl`) with zero nested card sandwiches, zero decorative pulsing dots on static headings, and clean unboxed metadata separated by `·`.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Hybrid Backend Engine (Root/Shizuku `uinput` + Stock Accessibility Fallback)**
  - *Chosen Approach*: Architect the native Android app with a unified `InputRemapEngine` interface backed by two concrete drivers: `EvdevUinputDriver` (privileged Linux `/dev/input` grab + `/dev/uinput` injection via Root or Shizuku) and `AccessibilityFallbackDriver` (unrooted `AccessibilityService` key filtering).
  - *Why*: Honestly addresses the prompt's mandatory feasibility requirement. Users with Root or Shizuku get 100% genuine system-wide mouse button suppression and key replacement in games like PojavLauncher, while unrooted stock Android users see exact, honest status disclosures explaining which buttons (`KEYCODE_BACK` / `KEYCODE_FORWARD`) can be intercepted and why raw `BUTTON_PRIMARY`/`SECONDARY` replacement requires `uinput` privileges.
  - *Alternatives Considered*: Pretending a standard Android `Service` or `AccessibilityService` can intercept all mouse clicks and inject `KEYCODE_T` into games (rejected—violates Android security boundaries and the prompt's strict honesty rule).

- **Decision 2 — Local Persistence via Jetpack DataStore (`Preferences`) & Browser `localStorage` Parity**
  - *Chosen Approach*: Use Jetpack `Preferences DataStore` (`mappings_datastore.preferences_pb`) with structured serialization in the Android Studio Kotlin project, mirrored by a deterministic `localStorage` repository in the interactive web prototype.
  - *Why*: Guarantees atomic, asynchronous, corruption-free persistence across app closes, mouse disconnections, and device reboots (`BOOT_COMPLETED` / `LOCKED_BOOT_COMPLETED`) without heavy SQLite boilerplate.
  - *Alternatives Considered*: SharedPreferences (deprecated for complex async flows) or Room SQLite (unnecessary overhead for a flat list of input-to-input mapping rules).

- **Decision 3 — Stateful Press/Hold/Release Engine with Disconnect Watchdog**
  - *Chosen Approach*: Maintain an active `HeldInputState` table keyed by `(deviceId, sourceCode)`. When a physical mouse button is pressed, emit `ACTION_DOWN` (`value = 1`) for the target key/button and record the active hold. When released, emit `ACTION_UP` (`value = 0`). If `onInputDeviceRemoved(deviceId)` fires while any button from that mouse is held, immediately synthesize `ACTION_UP` for all active target outputs from that device.
  - *Why*: Prevents stuck keys in games or text editors when a USB OTG cable is unplugged or a Bluetooth mouse sleeps mid-click, and prevents recursive mappings by tagging virtual `uinput` devices (`VENDOR_ID = 0x18D1`, `PRODUCT_ID = 0x4EE7`, `"KeyBridge Virtual Input"`) so the engine never re-intercepts its own emitted events.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

#### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        KEYBRIDGE WORKBENCH & NATIVE ARCHITECTURE                    │
├──────────────────────────────────────────┬──────────────────────────────────────────┤
│  1. MINIMAL ANDROID APP (2 SCREENS ONLY) │  2. LIVE HARDWARE DIAGNOSTIC PROTOTYPE   │
│                                          │                                          │
│  ┌────────────────────────────────────┐  │  ┌────────────────────────────────────┐  │
│  │ Main Screen                        │  │  │ Physical Mouse & Key Capture Pad   │  │
│  │  • Master Remapping Toggle         │  │  │  • DOM PointerDown / PointerUp     │  │
│  │  • Service & Privilege Status      │  │  │  • Buttons 0..4 (Left/Right/Mid/   │  │
│  │  • Connected Mouse Hotplug State   │  │  │    Back/Forward) + Wheel           │  │
│  │  • Saved Mappings List (Edit/Del)  │  │  │  • Source Suppression Verifier     │  │
│  │  • Add Mapping Button              │  │  └─────────────────┬──────────────────┘  │
│  └─────────────────┬──────────────────┘  │                    │                     │
│                    │                     │                    ▼                     │
│                    ▼                     │  ┌────────────────────────────────────┐  │
│  ┌────────────────────────────────────┐  │  │ Stateful Remapping Engine          │  │
│  │ Add / Edit Mapping Screen          │  │  │  • O(1) Source -> Target Lookup    │  │
│  │  • Source Input Selector (Manual)  │  │  │  • Down / Hold / Up State Tracker  │  │
│  │  • Optional Physical Capture Mode  │  │  │  • Modifier Combo Synthesizer      │  │
│  │  • Destination Type: Key or Mouse  │  │  │  • Recursion & Duplicate Guard     │  │
│  │  • Destination Input Selector      │  │  │  • Disconnect Stuck-Key Cleanup    │  │
│  │  • Save / Cancel Actions           │  │  └─────────────────┬──────────────────┘  │
│  └─────────────────┬──────────────────┘  │                    │                     │
│                    │                     │                    ▼                     │
│                    ▼                     │  ┌────────────────────────────────────┐  │
│  ┌────────────────────────────────────┐  │  │ Target Application Sandbox         │  │
│  │ Persistent Mapping Store           │  │  │  • PojavLauncher / Game Key Tester │  │
│  │  • Android: Jetpack DataStore      │  │  │  • Standard Text & Input Verifier  │  │
│  │  • Web: localStorage + Reboot Sim  │  │  │  • Live Event Pipeline Inspector   │  │
│  └────────────────────────────────────┘  │  └────────────────────────────────────┘  │
├──────────────────────────────────────────┴──────────────────────────────────────────┤
│  3. COMPLETE ANDROID STUDIO PROJECT DELIVERABLE (KOTLIN + NDK/JNI + GRADLE)         │
│  • InputManager.InputDeviceListener (Dynamic USB OTG & Bluetooth HID Discovery)     │
│  • Foreground Service + BootCompletedReceiver (Auto-Resume on Reboot & Reconnect)   │
│  • Native C/JNI uinput & evdev Driver (EVIOCGRAB suppression + global injection)    │
│  • Stock AccessibilityService Fallback + Honest Android Restriction Diagnostics     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

#### Data Model & State

- **`InputSource` & `InputDestination` Catalog**:
  - **Mouse Inputs**: `MOUSE_LEFT` (`BUTTON_PRIMARY` / `BTN_LEFT`), `MOUSE_RIGHT` (`BUTTON_SECONDARY` / `BTN_RIGHT`), `MOUSE_MIDDLE` (`BUTTON_TERTIARY` / `BTN_MIDDLE`), `MOUSE_BACK` (`BUTTON_BACK` / `BTN_SIDE` / Button 4), `MOUSE_FORWARD` (`BUTTON_FORWARD` / `BTN_EXTRA` / Button 5), `MOUSE_BUTTON_6` (`BTN_TASK`), `MOUSE_BUTTON_7`, `MOUSE_BUTTON_8`.
  - **Keyboard Inputs**: Letters `A–Z` (`KEYCODE_A`..`KEYCODE_Z`), Numbers `0–9` (`KEYCODE_0`..`KEYCODE_9`), Function keys `F1–F12` (`KEYCODE_F1`..`KEYCODE_F12`), Arrow keys (`DPAD_UP`, `DPAD_DOWN`, `DPAD_LEFT`, `DPAD_RIGHT`), Modifiers (`CTRL_LEFT`, `SHIFT_LEFT`, `ALT_LEFT`, `META_LEFT`), and Standard Android keys (`SPACE`, `ENTER`, `TAB`, `ESCAPE`, `DEL`, `INSERT`, `PAGE_UP`, `PAGE_DOWN`, `HOME`, `MOVE_END`).
- **`MappingRule` Entity**:
  - `id`: Unique identifier (`UUID`).
  - `sourceInput`: Code and metadata for the physical mouse button (`e.g., MOUSE_FORWARD`).
  - `destinationType`: `'KEYBOARD' | 'MOUSE'`.
  - `destinationInput`: Target keycode or mouse button code (`e.g., KEY_T` or `MOUSE_LEFT`).
  - `modifiers`: Optional array of modifier keys (`CTRL`, `SHIFT`, `ALT`, `META`) held alongside the replacement output.
  - `enabled`: Individual rule toggle (`boolean`).
  - `createdAt` / `updatedAt`: Epoch timestamps.
- **`ServiceRuntimeState`**:
  - `masterEnabled`: Persistent master toggle (`boolean`).
  - `backendMode`: `'HYBRID_UINPUT' | 'STOCK_ACCESSIBILITY' | 'UNAVAILABLE'`.
  - `connectedMice`: Dynamically discovered `MouseDevice` records (`deviceId`, `name`, `connectionType: 'USB_OTG' | 'BLUETOOTH_HID'`, `supportedButtons`)—decoupled from any hardcoded vendor/product ID.
  - `activeHolds`: Map of currently depressed physical buttons to their synthesized target outputs for instant release on disconnect.

#### Interactive Component & State Mapping

1. **Minimal Android App Container (`MainScreen` ↔ `AddEditMappingScreen`)**:
   - Strictly implements only the two required screens inside the Android device viewport.
   - Toggling the **Master Remapping Switch** persists `masterEnabled` and immediately starts/stops the remapping service lifecycle.
   - Clicking **Add Mapping** or clicking **Edit** on any saved mapping transitions to the `AddEditMappingScreen` with pre-populated selectors (`Mouse Forward → Keyboard T` available in 2 clicks).
   - **Recursion & Conflict Validation**: Saving a mapping validates against duplicate source mappings (updates or warns when overriding an existing source button) and circular self-mappings (`Mouse Left → Mouse Left`).
2. **Hardware Hotplug & Lifecycle Controls**:
   - Users can connect/disconnect simulated USB OTG or Bluetooth HID mice, close the Android app UI (proving background service continuation), or trigger a **Simulate Phone Restart** (verifying `BOOT_COMPLETED` restoration and persistent storage integrity).
3. **Diagnostic Prototype & PojavLauncher Input Sandbox**:
   - Captures real physical mouse clicks (`onPointerDown`, `onPointerUp`, `onContextMenu`, `onAuxClick`) from the user's connected mouse right in the browser.
   - Displays a 4-stage live verification pipeline matching the development plan:
     1. **Physical Mouse Event Verified** (Raw button code, down/up state, timestamp).
     2. **Source Suppression Status** (Whether the original browser/Android action was suppressed).
     3. **Mapping Rule Evaluation** (Matched rule and active hold state).
     4. **Target App Delivery** (Interactive PojavLauncher / Minecraft Java keybind listener + text input sandbox responding in real time to the remapped keydown/keyup events).
4. **Android Studio Project Browser & Exporter**:
   - Provides full, copy-ready and downloadable source files for the complete Android Studio project including Kotlin services, Jetpack DataStore repository, native C/JNI `uinput` daemon, Gradle build scripts, and build/deployment instructions.
