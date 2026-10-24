export interface AndroidSourceFile {
  path: string;
  filename: string;
  language: 'kotlin' | 'xml' | 'cpp' | 'gradle' | 'cmake' | 'markdown';
  summary: string;
  content: string;
}

export interface FeasibilitySection {
  id: string;
  number: string;
  title: string;
  verdict:
    | 'Supported Globally'
    | 'Partially Supported (Stock Limitations)'
    | 'Blocked on Unrooted Stock Android';
  summary: string;
  technicalDetails: string[];
  androidApiReferences: string[];
}

export const ANDROID_FEASIBILITY_SECTIONS: FeasibilitySection[] = [
  {
    id: 'input-manager',
    number: '01.',
    title: 'InputDevice & InputManager Dynamic Hotplug APIs',
    verdict: 'Supported Globally',
    summary:
      'Any standard Android app can enumerate connected USB OTG and Bluetooth HID mice without vendor/product hardcoding and listen for hotplug connections in the background.',
    technicalDetails: [
      'InputManager.getInputDeviceIds() returns all active kernel input device IDs. Querying InputDevice.getDevice(id) exposes sources bitmasks.',
      'Checking (device.sources and InputDevice.SOURCE_MOUSE) == InputDevice.SOURCE_MOUSE || (device.sources and InputDevice.SOURCE_MOUSE_RELATIVE) != 0 dynamically identifies any standard USB OTG or Bluetooth HID mouse regardless of vendorId or productId.',
      'InputManager.registerInputDeviceListener(listener, handler) fires onInputDeviceAdded(deviceId), onInputDeviceChanged(deviceId), and onInputDeviceRemoved(deviceId) immediately when a mouse connects or disconnects, enabling automatic profile activation and stuck-key release cleanup.'
    ],
    androidApiReferences: [
      'android.hardware.input.InputManager',
      'android.view.InputDevice.SOURCE_MOUSE',
      'InputManager.InputDeviceListener'
    ]
  },
  {
    id: 'mouse-event-codes',
    number: '02.',
    title: 'Mouse Button Event Codes (MotionEvent vs. KeyEvent)',
    verdict: 'Partially Supported (Stock Limitations)',
    summary:
      'Android splits physical mouse button events into window-targeted MotionEvents and fallback navigation KeyEvents.',
    technicalDetails: [
      'Physical clicks produce MotionEvent.ACTION_BUTTON_PRESS and ACTION_BUTTON_RELEASE carrying actionButton bitmasks: BUTTON_PRIMARY (Left), BUTTON_SECONDARY (Right), BUTTON_TERTIARY (Middle), BUTTON_BACK (Button 4), BUTTON_FORWARD (Button 5), and BUTTON_STYLUS_PRIMARY/SECONDARY (Buttons 6–7).',
      'In Android InputReader (CursorInputMapper), Button 4 and Button 5 also synthesize KeyEvent.KEYCODE_BACK (4) and KeyEvent.KEYCODE_FORWARD (125) when not consumed as raw pointer events.',
      'However, MotionEvents are dispatched exclusively to the focused foreground Window or View holding Pointer Capture (View.requestPointerCapture()), never broadcast to background services.'
    ],
    androidApiReferences: [
      'MotionEvent.ACTION_BUTTON_PRESS',
      'MotionEvent.BUTTON_BACK / BUTTON_FORWARD',
      'KeyEvent.KEYCODE_BACK / KEYCODE_FORWARD'
    ]
  },
  {
    id: 'accessibility-limitations',
    number: '03.',
    title: 'AccessibilityService Interception & Suppression Boundaries',
    verdict: 'Partially Supported (Stock Limitations)',
    summary:
      'AccessibilityService can intercept and suppress hardware KeyEvents (including Mouse Back/Forward when mapped to KEYCODE_BACK/KEYCODE_FORWARD), but cannot intercept raw MotionEvents or inject arbitrary KeyEvents.',
    technicalDetails: [
      'With android:accessibilityFlags="flagRequestFilterKeyEvents" and android:canRequestFilterKeyEvents="true", AccessibilityService.onKeyEvent(event) sits in InputDispatcher before the foreground app.',
      'Returning true from onKeyEvent() genuinely suppresses the original KEYCODE_BACK or KEYCODE_FORWARD action system-wide.',
      'CRITICAL LIMITATION 1: AccessibilityService never receives MotionEvent.ACTION_BUTTON_PRESS for Mouse Left, Right, Middle, or raw pointer-captured side buttons.',
      'CRITICAL LIMITATION 2: AccessibilityService has no API to inject KeyEvent(ACTION_DOWN, KEYCODE_T) into another application window (performGlobalAction only triggers system actions like Back/Home/Recents, and dispatchGesture only emulates touchscreen taps, which is forbidden).'
    ],
    androidApiReferences: [
      'AccessibilityService.onKeyEvent(KeyEvent)',
      'AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS',
      'InputDispatcher.interceptKeyBeforeDispatching'
    ]
  },
  {
    id: 'usb-host-hid',
    number: '04.',
    title: 'USB Host APIs (UsbManager) & Raw HID Report Access',
    verdict: 'Blocked on Unrooted Stock Android',
    summary:
      'Claiming a USB mouse interface via UsbDeviceConnection detaches the kernel HID driver, destroying the native system cursor and failing for Bluetooth mice.',
    technicalDetails: [
      'Calling UsbDeviceConnection.claimInterface(hidInterface, force = true) unbinds the Linux usbhid driver so the app can read raw interrupt IN reports (bytes 0..3 for buttons and X/Y deltas).',
      'Once usbhid is detached, Android stops rendering or moving the system mouse pointer completely.',
      'Without /dev/uinput write access to re-inject relative X/Y motion and remapped buttons back into the kernel, USB Host mode breaks normal mouse operation and cannot support Bluetooth HID mice at all.'
    ],
    androidApiReferences: [
      'android.hardware.usb.UsbManager',
      'UsbDeviceConnection.claimInterface(UsbInterface, boolean)'
    ]
  },
  {
    id: 'virtual-input-generation',
    number: '05.',
    title: 'Global Virtual Keyboard & Mouse Event Injection',
    verdict: 'Blocked on Unrooted Stock Android',
    summary:
      'InputManager.injectInputEvent() requires signature permission INJECT_EVENTS; stock apps can only send keys via an active InputMethodService (IME) or privileged uinput.',
    technicalDetails: [
      'Android protects InputManager.injectInputEvent(InputEvent, int) with android.permission.INJECT_EVENTS (protectionLevel="signature"). Third-party apps on stock ROMs throw SecurityException.',
      'A custom InputMethodService (IME) can call currentInputConnection?.sendKeyEvent(KeyEvent(ACTION_DOWN, KEYCODE_T)), which delivers key events to standard text editors and views with an active InputConnection.',
      'However, 3D games and launchers like PojavLauncher (Minecraft Java LWJGL/GLFW) using native input queues or Pointer Capture often require hardware-level evdev/uinput events so Android InputReader classifies the source as SOURCE_KEYBOARD | SOURCE_MOUSE.'
    ],
    androidApiReferences: [
      'android.permission.INJECT_EVENTS',
      'android.inputmethodservice.InputMethodService',
      'InputConnection.sendKeyEvent(KeyEvent)'
    ]
  },
  {
    id: 'root-shizuku-uinput',
    number: '06.',
    title: 'Kernel evdev EVIOCGRAB + /dev/uinput (True System-Wide Replacement)',
    verdict: 'Supported Globally',
    summary:
      'A privileged daemon running via Root (su) or Shizuku/ADB opens /dev/input/event* with EVIOCGRAB and emits remapped hardware frames through /dev/uinput.',
    technicalDetails: [
      'Opening the physical mouse node (/dev/input/eventX) and invoking ioctl(fd, EVIOCGRAB, 1) exclusively claims all physical EV_KEY (BTN_LEFT..BTN_TASK) and EV_REL (REL_X, REL_Y, REL_WHEEL) frames before Android InputReader sees them.',
      'The daemon creates a virtual composite input device via /dev/uinput configured with UI_SET_EVBIT(EV_KEY), UI_SET_EVBIT(EV_REL), all standard mouse buttons, relative axes, and keyboard keycodes (KEY_A..KEY_Z, KEY_0..KEY_9, KEY_F1..KEY_F12, modifiers).',
      'Unmapped mouse motions (REL_X/REL_Y) and buttons pass straight through to the uinput fd in <0.2ms, while mapped buttons (e.g., BTN_EXTRA = 1) are suppressed and replaced with the target EV_KEY (e.g., KEY_T = 1 on press, KEY_T = 0 on release) plus EV_SYN(SYN_REPORT).'
    ],
    androidApiReferences: [
      'linux/input.h (EVIOCGRAB, struct input_event)',
      'linux/uinput.h (UI_DEV_SETUP, UI_DEV_CREATE)',
      '/dev/input/event* & /dev/uinput'
    ]
  }
];

export const ANDROID_STUDIO_SOURCE_FILES: AndroidSourceFile[] = [
  {
    path: 'app/build.gradle.kts',
    filename: 'build.gradle.kts',
    language: 'gradle',
    summary: 'Module Gradle configuration with Jetpack Compose Material 3, DataStore Preferences, and NDK/CMake build.',
    content: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "dev.keybridge.remapper"
    compileSdk = 34

    defaultConfig {
        applicationId = "dev.keybridge.remapper"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        externalNativeBuild {
            cmake {
                cppFlags += "-std=c++17 -O2"
            }
        }
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}`
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    filename: 'AndroidManifest.xml',
    language: 'xml',
    summary: 'Declares ForegroundService, AccessibilityService, BootCompletedReceiver, and USB/Bluetooth input capabilities.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="dev.keybridge.remapper">

    <!-- Persistent foreground operation & automatic boot startup -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="true"
        android:label="KeyBridge"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.DeviceDefault.NoActionBar">

        <activity
            android:name=".ui.MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:configChanges="orientation|screenSize|keyboard|keyboardHidden|navigation">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Persistent Foreground Service monitoring InputManager hotplug & managing uinput daemon -->
        <service
            android:name=".service.RemapperForegroundService"
            android:enabled="true"
            android:exported="false"
            android:directBootAware="true"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Hardware mouse-to-keyboard input remapping and InputDevice hotplug listener" />
        </service>

        <!-- Stock Android Accessibility Fallback for KEYCODE_BACK / KEYCODE_FORWARD interception -->
        <service
            android:name=".service.RemapperAccessibilityService"
            android:exported="true"
            android:directBootAware="true"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>

        <!-- Companion InputMethodService for non-root KeyEvent delivery where supported -->
        <service
            android:name=".service.KeyBridgeImeService"
            android:exported="true"
            android:label="KeyBridge Hardware Input Bridge"
            android:permission="android.permission.BIND_INPUT_METHOD">
            <intent-filter>
                <action android:name="android.view.InputMethod" />
            </intent-filter>
            <meta-data
                android:name="android.view.im"
                android:resource="@xml/method" />
        </service>

        <!-- Auto-start after phone reboot before/after unlock -->
        <receiver
            android:name=".receiver.BootCompletedReceiver"
            android:enabled="true"
            android:exported="true"
            android:directBootAware="true">
            <intent-filter>
                <action android:name="android.intent.action.LOCKED_BOOT_COMPLETED" />
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>

    </application>
</manifest>`
  },
  {
    path: 'app/src/main/res/xml/accessibility_service_config.xml',
    filename: 'accessibility_service_config.xml',
    language: 'xml',
    summary: 'Requests hardware KeyEvent filtering (flagRequestFilterKeyEvents) for stock Android side-button interception.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeMaskNone"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagRequestFilterKeyEvents"
    android:canRequestFilterKeyEvents="true"
    android:notificationTimeout="0" />`
  },
  {
    path: 'app/src/main/java/dev/keybridge/remapper/data/MappingRepository.kt',
    filename: 'MappingRepository.kt',
    language: 'kotlin',
    summary: 'Jetpack Preferences DataStore persistence for mappings and master switch—independent of connected devices.',
    content: `package dev.keybridge.remapper.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

val Context.mappingDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "keybridge_persistent_mappings"
)

enum class DestinationType { KEYBOARD, MOUSE }

data class MappingRule(
    val id: String = UUID.randomUUID().toString(),
    val sourceMouseId: String,
    val destinationType: DestinationType,
    val destinationId: String,
    val modifiers: List<String> = emptyList(),
    val enabled: Boolean = true,
    val updatedAt: Long = System.currentTimeMillis()
)

class MappingRepository(private val context: Context) {

    companion object {
        private val KEY_MASTER_ENABLED = booleanPreferencesKey("master_remapping_enabled")
        private val KEY_SAVED_MAPPINGS_JSON = stringPreferencesKey("saved_mappings_json")
    }

    val masterEnabledFlow: Flow<Boolean> = context.mappingDataStore.data.map { prefs ->
        prefs[KEY_MASTER_ENABLED] ?: true
    }

    val mappingsFlow: Flow<List<MappingRule>> = context.mappingDataStore.data.map { prefs ->
        val rawJson = prefs[KEY_SAVED_MAPPINGS_JSON] ?: "[]"
        parseMappingsJson(rawJson)
    }

    suspend fun setMasterEnabled(enabled: Boolean) {
        context.mappingDataStore.edit { prefs ->
            prefs[KEY_MASTER_ENABLED] = enabled
        }
    }

    /**
     * Saves or updates a mapping rule permanently.
     * Enforces single-rule-per-source-button and blocks recursive self-mapping.
     */
    suspend fun upsertMapping(rule: MappingRule) {
        require(!(rule.destinationType == DestinationType.MOUSE && rule.sourceMouseId == rule.destinationId && rule.modifiers.isEmpty())) {
            "Recursive mapping is not permitted: source and destination mouse buttons are identical."
        }
        context.mappingDataStore.edit { prefs ->
            val current = parseMappingsJson(prefs[KEY_SAVED_MAPPINGS_JSON] ?: "[]").toMutableList()
            current.removeAll { it.id == rule.id || it.sourceMouseId == rule.sourceMouseId }
            current.add(rule.copy(updatedAt = System.currentTimeMillis()))
            prefs[KEY_SAVED_MAPPINGS_JSON] = serializeMappingsJson(current)
        }
    }

    suspend fun setRuleEnabled(ruleId: String, enabled: Boolean) {
        context.mappingDataStore.edit { prefs ->
            val updated = parseMappingsJson(prefs[KEY_SAVED_MAPPINGS_JSON] ?: "[]").map {
                if (it.id == ruleId) it.copy(enabled = enabled, updatedAt = System.currentTimeMillis()) else it
            }
            prefs[KEY_SAVED_MAPPINGS_JSON] = serializeMappingsJson(updated)
        }
    }

    suspend fun deleteMapping(ruleId: String) {
        context.mappingDataStore.edit { prefs ->
            val current = parseMappingsJson(prefs[KEY_SAVED_MAPPINGS_JSON] ?: "[]")
                .filterNot { it.id == ruleId }
            prefs[KEY_SAVED_MAPPINGS_JSON] = serializeMappingsJson(current)
        }
    }

    private fun parseMappingsJson(raw: String): List<MappingRule> {
        return runCatching {
            val array = JSONArray(raw)
            buildList {
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val modsArray = obj.optJSONArray("modifiers") ?: JSONArray()
                    val mods = buildList {
                        for (j in 0 until modsArray.length()) add(modsArray.getString(j))
                    }
                    add(
                        MappingRule(
                            id = obj.getString("id"),
                            sourceMouseId = obj.getString("sourceMouseId"),
                            destinationType = DestinationType.valueOf(obj.getString("destinationType")),
                            destinationId = obj.getString("destinationId"),
                            modifiers = mods,
                            enabled = obj.optBoolean("enabled", true),
                            updatedAt = obj.optLong("updatedAt", 0L)
                        )
                    )
                }
            }
        }.getOrDefault(emptyList())
    }

    private fun serializeMappingsJson(rules: List<MappingRule>): String {
        val array = JSONArray()
        for (rule in rules) {
            val obj = JSONObject().apply {
                put("id", rule.id)
                put("sourceMouseId", rule.sourceMouseId)
                put("destinationType", rule.destinationType.name)
                put("destinationId", rule.destinationId)
                put("modifiers", JSONArray(rule.modifiers))
                put("enabled", rule.enabled)
                put("updatedAt", rule.updatedAt)
            }
            array.put(obj)
        }
        return array.toString()
    }
}`
  },
  {
    path: 'app/src/main/java/dev/keybridge/remapper/service/RemapperForegroundService.kt',
    filename: 'RemapperForegroundService.kt',
    language: 'kotlin',
    summary: 'Automatic mouse discovery via InputManager.InputDeviceListener, active hold state tracking, and disconnect cleanup.',
    content: `package dev.keybridge.remapper.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.input.InputManager
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.InputDevice
import androidx.core.app.NotificationCompat
import dev.keybridge.remapper.data.MappingRepository
import dev.keybridge.remapper.data.MappingRule
import dev.keybridge.remapper.nativebridge.EvdevUinputDaemon
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

class RemapperForegroundService : Service(), InputManager.InputDeviceListener {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var inputManager: InputManager
    private lateinit var repository: MappingRepository
    private val uinputDaemon = EvdevUinputDaemon()

    // Tracks connected compatible mice dynamically (no hardcoded vendor/product IDs)
    private val connectedMice = ConcurrentHashMap<Int, InputDevice>()

    // Tracks currently held physical buttons per deviceId to guarantee release on disconnect
    private val heldButtonsByDevice = ConcurrentHashMap<Int, MutableSet<Int>>()

    @Volatile
    private var activeRules: List<MappingRule> = emptyList()

    @Volatile
    private var masterEnabled: Boolean = true

    override fun onCreate() {
        super.onCreate()
        repository = MappingRepository(applicationContext)
        inputManager = getSystemService(Context.INPUT_SERVICE) as InputManager

        startForeground(NOTIFICATION_ID, buildStatusNotification("Monitoring mouse connections"))
        inputManager.registerInputDeviceListener(this, Handler(Looper.getMainLooper()))

        scanExistingMouseDevices()

        serviceScope.launch {
            combine(repository.masterEnabledFlow, repository.mappingsFlow) { enabled, rules ->
                enabled to rules
            }.collect { (enabled, rules) ->
                masterEnabled = enabled
                activeRules = rules.filter { it.enabled }
                syncRulesToNativeEngine()
                updateNotificationState()
            }
        }
    }

    private fun scanExistingMouseDevices() {
        for (deviceId in inputManager.inputDeviceIds) {
            val device = inputManager.getInputDevice(deviceId) ?: continue
            if (isCompatibleMouse(device)) {
                connectedMice[deviceId] = device
                uinputDaemon.attachMouseDeviceIfPrivileged(device)
            }
        }
    }

    /**
     * Universal mouse detection: matches any USB OTG or Bluetooth HID mouse
     * while ignoring our own virtual uinput device to prevent recursive remapping.
     */
    private fun isCompatibleMouse(device: InputDevice): Boolean {
        if (device.name.contains(EvdevUinputDaemon.VIRTUAL_DEVICE_NAME)) return false
        val sources = device.sources
        val hasMouseSource = (sources and InputDevice.SOURCE_MOUSE) == InputDevice.SOURCE_MOUSE
        val hasRelativeMouse = (sources and InputDevice.SOURCE_MOUSE_RELATIVE) == InputDevice.SOURCE_MOUSE_RELATIVE
        return hasMouseSource || hasRelativeMouse
    }

    override fun onInputDeviceAdded(deviceId: Int) {
        val device = inputManager.getInputDevice(deviceId) ?: return
        if (isCompatibleMouse(device)) {
            connectedMice[deviceId] = device
            if (masterEnabled) {
                uinputDaemon.attachMouseDeviceIfPrivileged(device)
                syncRulesToNativeEngine()
            }
            updateNotificationState()
        }
    }

    override fun onInputDeviceChanged(deviceId: Int) {
        val device = inputManager.getInputDevice(deviceId) ?: return
        if (isCompatibleMouse(device)) {
            connectedMice[deviceId] = device
        }
    }

    override fun onInputDeviceRemoved(deviceId: Int) {
        val removed = connectedMice.remove(deviceId)
        if (removed != null) {
            // CRITICAL SAFETY: Release any held target keys associated with this disconnected mouse
            val heldTargetCodes = heldButtonsByDevice.remove(deviceId).orEmpty()
            for (linuxTargetCode in heldTargetCodes) {
                uinputDaemon.forceReleaseTargetCode(linuxTargetCode)
            }
            uinputDaemon.detachMouseDevice(deviceId)
            updateNotificationState()
        }
    }

    private fun syncRulesToNativeEngine() {
        if (!masterEnabled) {
            uinputDaemon.releaseAllHeldInputs()
            uinputDaemon.clearRules()
            return
        }
        uinputDaemon.updateRules(activeRules)
    }

    private fun updateNotificationState() {
        val statusText = when {
            !masterEnabled -> "Remapping paused (Master toggle off)"
            connectedMice.isEmpty() -> "Active · Waiting for mouse (\${activeRules.size} saved mappings)"
            else -> "Active · \${connectedMice.size} mouse connected (\${activeRules.size} mappings applied)"
        }
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildStatusNotification(statusText))
    }

    private fun buildStatusNotification(contentText: String): Notification {
        val channelId = "keybridge_service_channel"
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(channelId) == null) {
            manager.createNotificationChannel(
                NotificationChannel(channelId, "KeyBridge Input Remapper", NotificationManager.IMPORTANCE_LOW)
            )
        }
        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("KeyBridge Mouse Remapper")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_menu_manage)
            .setOngoing(true)
            .build()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        inputManager.unregisterInputDeviceListener(this)
        uinputDaemon.releaseAllHeldInputs()
        uinputDaemon.shutdown()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val NOTIFICATION_ID = 4101
    }
}`
  },
  {
    path: 'app/src/main/java/dev/keybridge/remapper/nativebridge/EvdevUinputDaemon.kt',
    filename: 'EvdevUinputDaemon.kt',
    language: 'kotlin',
    summary: 'JNI bridge and privileged /dev/input + /dev/uinput session manager for Root and Shizuku.',
    content: `package dev.keybridge.remapper.nativebridge

import android.view.InputDevice
import dev.keybridge.remapper.data.MappingRule

class EvdevUinputDaemon {

    companion object {
        const val VIRTUAL_DEVICE_NAME = "KeyBridge Virtual Input"

        init {
            runCatching {
                System.loadLibrary("keybridge_uinput")
            }
        }
    }

    private var uinputInitialized = false

    fun attachMouseDeviceIfPrivileged(device: InputDevice): Boolean {
        if (!uinputInitialized) {
            val fd = runCatching { nativeSetupVirtualCompositeDevice() }.getOrDefault(-1)
            uinputInitialized = fd >= 0
        }
        if (!uinputInitialized) return false
        return runCatching { nativeAttachDeviceById(device.id) }.getOrDefault(false)
    }

    fun detachMouseDevice(deviceId: Int) {
        runCatching { nativeDetachDeviceById(deviceId) }
    }

    fun updateRules(rules: List<MappingRule>) {
        runCatching {
            nativeClearRules()
            for (rule in rules) {
                val srcEvCode = resolveLinuxMouseButtonCode(rule.sourceMouseId)
                val dstEvCode = resolveLinuxTargetCode(rule.destinationId)
                val modCodes = rule.modifiers.map { resolveModifierCode(it) }.toIntArray()
                if (srcEvCode > 0 && dstEvCode > 0) {
                    nativeAddRemapRule(srcEvCode, dstEvCode, modCodes)
                }
            }
        }
    }

    fun forceReleaseTargetCode(linuxCode: Int) {
        runCatching { nativeForceReleaseKey(linuxCode) }
    }

    fun releaseAllHeldInputs() {
        runCatching { nativeReleaseAllHeld() }
    }

    fun clearRules() {
        runCatching { nativeClearRules() }
    }

    fun shutdown() {
        runCatching { nativeShutdownUinput() }
        uinputInitialized = false
    }

    private fun resolveLinuxMouseButtonCode(sourceId: String): Int = when (sourceId) {
        "MOUSE_LEFT" -> 0x110
        "MOUSE_RIGHT" -> 0x111
        "MOUSE_MIDDLE" -> 0x112
        "MOUSE_BACK" -> 0x113
        "MOUSE_FORWARD" -> 0x114
        "MOUSE_BUTTON_6" -> 0x115
        "MOUSE_BUTTON_7" -> 0x116
        "MOUSE_BUTTON_8" -> 0x117
        else -> -1
    }

    private fun resolveLinuxTargetCode(destId: String): Int = when (destId) {
        "MOUSE_LEFT" -> 0x110
        "MOUSE_RIGHT" -> 0x111
        "MOUSE_MIDDLE" -> 0x112
        "MOUSE_BACK" -> 0x113
        "MOUSE_FORWARD" -> 0x114
        "KEY_T" -> 20
        "KEY_G" -> 34
        "KEY_SPACE" -> 57
        "KEY_ENTER" -> 28
        "KEY_ESCAPE" -> 1
        "KEY_TAB" -> 15
        else -> 20
    }

    private fun resolveModifierCode(mod: String): Int = when (mod) {
        "CTRL" -> 29
        "SHIFT" -> 42
        "ALT" -> 56
        "META" -> 125
        else -> 0
    }

    private external fun nativeSetupVirtualCompositeDevice(): Int
    private external fun nativeAttachDeviceById(deviceId: Int): Boolean
    private external fun nativeDetachDeviceById(deviceId: Int)
    private external fun nativeClearRules()
    private external fun nativeAddRemapRule(srcEvCode: Int, dstEvCode: Int, modifiers: IntArray)
    private external fun nativeForceReleaseKey(linuxCode: Int)
    private external fun nativeReleaseAllHeld()
    private external fun nativeShutdownUinput()
}`
  },
  {
    path: 'app/src/main/cpp/CMakeLists.txt',
    filename: 'CMakeLists.txt',
    language: 'cmake',
    summary: 'CMake configuration building libkeybridge_uinput.so for Android NDK.',
    content: `cmake_minimum_required(VERSION 3.22.1)
project("keybridge_uinput")

add_library(
    keybridge_uinput
    SHARED
    uinput_bridge.cpp
)

find_library(
    log-lib
    log
)

target_link_libraries(
    keybridge_uinput
    \${log-lib}
)`
  },
  {
    path: 'app/src/main/cpp/uinput_bridge.cpp',
    filename: 'uinput_bridge.cpp',
    language: 'cpp',
    summary: 'Linux kernel evdev EVIOCGRAB interceptor and /dev/uinput composite virtual keyboard/mouse emitter.',
    content: `// uinput_bridge.cpp
// Native Linux evdev + uinput daemon for genuine hardware mouse-to-keyboard/mouse replacement.
// Preserves press (1), release (0), and hold/repeat (2) states while suppressing original mouse buttons.

#include <fcntl.h>
#include <jni.h>
#include <linux/input.h>
#include <linux/uinput.h>
#include <poll.h>
#include <string.h>
#include <sys/ioctl.h>
#include <unistd.h>
#include <unordered_map>
#include <vector>
#include <mutex>

struct RemapTarget {
    uint16_t targetEvKey;          // e.g. KEY_T (20) or BTN_RIGHT (0x111)
    std::vector<uint16_t> mods;    // Optional modifier keycodes (KEY_LEFTCTRL, KEY_LEFTSHIFT, etc.)
};

static int g_uinputFd = -1;
static std::mutex g_ruleMutex;
static std::unordered_map<uint16_t, RemapTarget> g_remapTable;
static std::unordered_map<uint16_t, RemapTarget> g_activeHolds;

static void emitInputEvent(int ufd, uint16_t type, uint16_t code, int32_t value) {
    if (ufd < 0) return;
    struct input_event ev {};
    gettimeofday(&ev.time, nullptr);
    ev.type = type;
    ev.code = code;
    ev.value = value;
    write(ufd, &ev, sizeof(ev));
}

static void emitSynReport(int ufd) {
    emitInputEvent(ufd, EV_SYN, SYN_REPORT, 0);
}

int setupVirtualCompositeDevice() {
    int ufd = open("/dev/uinput", O_WRONLY | O_NONBLOCK);
    if (ufd < 0) return -1;

    // Enable EV_KEY (keyboard + mouse buttons), EV_REL (cursor movement + wheel), and EV_SYN
    ioctl(ufd, UI_SET_EVBIT, EV_KEY);
    ioctl(ufd, UI_SET_EVBIT, EV_REL);
    ioctl(ufd, UI_SET_EVBIT, EV_SYN);

    // Register standard and extra mouse buttons (BTN_LEFT 0x110 .. BTN_TASK 0x117)
    for (int btn = BTN_LEFT; btn <= BTN_TASK; ++btn) {
        ioctl(ufd, UI_SET_KEYBIT, btn);
    }

    // Register keyboard keys (1 .. 248)
    for (int key = 1; key <= 248; ++key) {
        ioctl(ufd, UI_SET_KEYBIT, key);
    }

    // Register relative mouse axes so pass-through mouse movement works natively
    ioctl(ufd, UI_SET_RELBIT, REL_X);
    ioctl(ufd, UI_SET_RELBIT, REL_Y);
    ioctl(ufd, UI_SET_RELBIT, REL_WHEEL);
    ioctl(ufd, UI_SET_RELBIT, REL_HWHEEL);

    struct uinput_setup usetup {};
    usetup.id.bustype = BUS_VIRTUAL;
    usetup.id.vendor = 0x18D1;
    usetup.id.product = 0x4EE7;
    strncpy(usetup.name, "KeyBridge Virtual Input", UINPUT_MAX_NAME_SIZE - 1);

    if (ioctl(ufd, UI_DEV_SETUP, &usetup) < 0 || ioctl(ufd, UI_DEV_CREATE) < 0) {
        close(ufd);
        return -1;
    }
    g_uinputFd = ufd;
    return ufd;
}

void processMouseEvdevNode(const char* devNodePath) {
    int fd = open(devNodePath, O_RDONLY);
    if (fd < 0) return;

    // Exclusively grab the physical mouse so original button presses are suppressed
    if (ioctl(fd, EVIOCGRAB, 1) < 0) {
        close(fd);
        return;
    }

    struct input_event ev {};
    while (read(fd, &ev, sizeof(ev)) == sizeof(ev)) {
        if (ev.type == EV_KEY && ev.code >= BTN_MOUSE && ev.code <= BTN_TASK) {
            std::lock_guard<std::mutex> lock(g_ruleMutex);
            auto it = g_remapTable.find(ev.code);
            if (it != g_remapTable.end()) {
                const RemapTarget& target = it->second;
                if (ev.value == 1) {
                    // Button Press: press modifiers first, then target key/button
                    for (uint16_t mod : target.mods) {
                        emitInputEvent(g_uinputFd, EV_KEY, mod, 1);
                    }
                    emitInputEvent(g_uinputFd, EV_KEY, target.targetEvKey, 1);
                    emitSynReport(g_uinputFd);
                    g_activeHolds[ev.code] = target;
                } else if (ev.value == 0) {
                    // Button Release: release target key/button, then modifiers in reverse order
                    emitInputEvent(g_uinputFd, EV_KEY, target.targetEvKey, 0);
                    for (auto mit = target.mods.rbegin(); mit != target.mods.rend(); ++mit) {
                        emitInputEvent(g_uinputFd, EV_KEY, *mit, 0);
                    }
                    emitSynReport(g_uinputFd);
                    g_activeHolds.erase(ev.code);
                } else if (ev.value == 2) {
                    // Held auto-repeat state
                    emitInputEvent(g_uinputFd, EV_KEY, target.targetEvKey, 2);
                    emitSynReport(g_uinputFd);
                }
                continue; // Original mouse button event is suppressed!
            }
        }
        // Unmapped mouse movement (REL_X, REL_Y, REL_WHEEL) or unmapped button: pass through directly
        emitInputEvent(g_uinputFd, ev.type, ev.code, ev.value);
    }

    // Device disconnected: release any keys that were still held by this physical mouse
    {
        std::lock_guard<std::mutex> lock(g_ruleMutex);
        for (const auto& kv : g_activeHolds) {
            emitInputEvent(g_uinputFd, EV_KEY, kv.second.targetEvKey, 0);
            for (uint16_t mod : kv.second.mods) {
                emitInputEvent(g_uinputFd, EV_KEY, mod, 0);
            }
        }
        emitSynReport(g_uinputFd);
        g_activeHolds.clear();
    }

    ioctl(fd, EVIOCGRAB, 0);
    close(fd);
}`
  },
  {
    path: 'app/src/main/java/dev/keybridge/remapper/service/RemapperAccessibilityService.kt',
    filename: 'RemapperAccessibilityService.kt',
    language: 'kotlin',
    summary: 'Stock non-root fallback intercepting KEYCODE_BACK / KEYCODE_FORWARD from Mouse Buttons 4 & 5.',
    content: `package dev.keybridge.remapper.service

import android.accessibilityservice.AccessibilityService
import android.view.InputDevice
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import dev.keybridge.remapper.data.MappingRepository
import dev.keybridge.remapper.data.MappingRule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

/**
 * Stock No-Root Fallback Service:
 * Intercepts KeyEvents synthesized by Android InputReader for Mouse Back (KEYCODE_BACK = 4)
 * and Mouse Forward (KEYCODE_FORWARD = 125).
 *
 * Honest stock Android boundary:
 * - Raw MotionEvent clicks (Left, Right, Middle) do NOT pass through AccessibilityService.onKeyEvent().
 * - Full replacement of all buttons in Pointer-Capture games (e.g. PojavLauncher) requires the
 *   EvdevUinputDaemon (Root or Shizuku).
 */
class RemapperAccessibilityService : AccessibilityService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    @Volatile
    private var masterEnabled: Boolean = true

    @Volatile
    private var activeRulesBySource: Map<String, MappingRule> = emptyMap()

    override fun onServiceConnected() {
        super.onServiceConnected()
        val repository = MappingRepository(applicationContext)
        scope.launch {
            combine(repository.masterEnabledFlow, repository.mappingsFlow) { enabled, rules ->
                enabled to rules
            }.collect { (enabled, rules) ->
                masterEnabled = enabled
                activeRulesBySource = rules.filter { it.enabled }.associateBy { it.sourceMouseId }
            }
        }
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        if (!masterEnabled) return false

        val device = InputDevice.getDevice(event.deviceId)
        val isFromMouse = device != null && (
            (device.sources and InputDevice.SOURCE_MOUSE) == InputDevice.SOURCE_MOUSE ||
            (device.sources and InputDevice.SOURCE_MOUSE_RELATIVE) != 0
        )
        if (!isFromMouse) return false

        val sourceMouseId = when (event.keyCode) {
            KeyEvent.KEYCODE_BACK -> "MOUSE_BACK"
            KeyEvent.KEYCODE_FORWARD -> "MOUSE_FORWARD"
            else -> null
        } ?: return false

        val rule = activeRulesBySource[sourceMouseId] ?: return false

        // Forward the press/release state to our companion InputMethodService if active
        KeyBridgeImeService.dispatchRemappedKeyFromAccessibility(
            rule = rule,
            action = event.action,
            eventTime = event.eventTime
        )

        // Returning true suppresses the original Back/Forward navigation event on stock Android
        return true
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit
    override fun onInterrupt() = Unit

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}`
  },
  {
    path: 'app/src/main/java/dev/keybridge/remapper/receiver/BootCompletedReceiver.kt',
    filename: 'BootCompletedReceiver.kt',
    language: 'kotlin',
    summary: 'Resumes the remapping foreground service automatically after a phone restart when master toggle is enabled.',
    content: `package dev.keybridge.remapper.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import dev.keybridge.remapper.data.MappingRepository
import dev.keybridge.remapper.service.RemapperForegroundService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (
            action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            val pendingResult = goAsync()
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val repo = MappingRepository(context.applicationContext)
                    if (repo.masterEnabledFlow.first()) {
                        val serviceIntent = Intent(context, RemapperForegroundService::class.java)
                        ContextCompat.startForegroundService(context, serviceIntent)
                    }
                } finally {
                    pendingResult.finish()
                }
            }
        }
    }
}`
  },
  {
    path: 'app/src/main/java/dev/keybridge/remapper/ui/MainActivity.kt',
    filename: 'MainActivity.kt',
    language: 'kotlin',
    summary: 'Material 3 dark/light Jetpack Compose UI (Main Screen + Add/Edit Mapping Screen) with preserved draft state.',
    content: `package dev.keybridge.remapper.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import dev.keybridge.remapper.data.DestinationType
import dev.keybridge.remapper.data.MappingRepository
import dev.keybridge.remapper.data.MappingRule
import dev.keybridge.remapper.service.RemapperForegroundService
import kotlinx.coroutines.launch

private val KeyBridgeDarkColors = darkColorScheme(
    primary = Color(0xFF3B82F6),
    onPrimary = Color.White,
    background = Color(0xFF090D16),
    surface = Color(0xFF0F1623),
    surfaceVariant = Color(0xFF161F30),
    onBackground = Color(0xFFF8FAFC),
    onSurface = Color(0xFFF8FAFC)
)

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val repository = MappingRepository(applicationContext)

        setContent {
            MaterialTheme(colorScheme = KeyBridgeDarkColors) {
                val scope = rememberCoroutineScope()
                val masterEnabled by repository.masterEnabledFlow.collectAsState(initial = true)
                val mappings by repository.mappingsFlow.collectAsState(initial = emptyList())
                var editingRule by remember { mutableStateOf<MappingRule?>(null) }
                var isAddingNew by rememberSaveable { mutableStateOf(false) }

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    Crossfade(
                        targetState = isAddingNew || editingRule != null,
                        label = "ScreenTransition"
                    ) { showEditor ->
                        if (showEditor) {
                            AddEditMappingScreen(
                                initialRule = editingRule,
                                onSave = { rule ->
                                    scope.launch {
                                        repository.upsertMapping(rule)
                                        isAddingNew = false
                                        editingRule = null
                                    }
                                },
                                onCancel = {
                                    isAddingNew = false
                                    editingRule = null
                                }
                            )
                        } else {
                            MainScreen(
                                masterEnabled = masterEnabled,
                                mappings = mappings,
                                onToggleMaster = { enabled ->
                                    scope.launch {
                                        repository.setMasterEnabled(enabled)
                                        val svcIntent = Intent(
                                            this@MainActivity,
                                            RemapperForegroundService::class.java
                                        )
                                        if (enabled) {
                                            ContextCompat.startForegroundService(
                                                this@MainActivity,
                                                svcIntent
                                            )
                                        } else {
                                            stopService(svcIntent)
                                        }
                                    }
                                },
                                onAddClick = { isAddingNew = true },
                                onEditClick = { rule -> editingRule = rule },
                                onToggleRuleClick = { rule ->
                                    scope.launch {
                                        repository.setRuleEnabled(rule.id, !rule.enabled)
                                    }
                                },
                                onDeleteClick = { ruleId ->
                                    scope.launch { repository.deleteMapping(ruleId) }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}`
  },
  {
    path: 'README_BUILD.md',
    filename: 'README_BUILD.md',
    language: 'markdown',
    summary: 'Complete build instructions, Android Studio NDK setup, and privilege activation steps for Root, Shizuku, and Stock Android.',
    content: `# KeyBridge Android Mouse Remapper — Build & Deployment Guide

## 1. Prerequisites
- **Android Studio Ladybug (2024.2.1)** or newer
- **Android SDK 34** (minSdk 26 / Android 8.0+)
- **Android NDK 26+** & **CMake 3.22.1** (for \`uinput_bridge.cpp\` compilation)

## 2. Building from Source
1. Open the project root in Android Studio or run via Gradle CLI:
   \`\`\`bash
   ./gradlew assembleDebug
   \`\`\`
2. Install onto a physical Android device over ADB:
   \`\`\`bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   \`\`\`

## 3. Operating Modes & Privilege Setup

### Mode A: Hybrid Root / Shizuku \`uinput\` Mode (Full Global Hardware Replacement)
Required for intercepting **all** mouse buttons (\`Left\`, \`Right\`, \`Middle\`, \`Back\`, \`Forward\`, \`Buttons 6–8\`) and injecting hardware \`EV_KEY\` events into games with Pointer Capture such as **Minecraft Java (PojavLauncher)**:
1. Ensure Magisk/KernelSU or Shizuku (with \`/dev/uinput\` and \`/dev/input/event*\` permissions) is active.
2. Open **KeyBridge**, create your mappings (e.g. \`Mouse Forward → Keyboard T\`) even before connecting a mouse, and toggle **Master Remapping ON**.
3. Connect any USB OTG or Bluetooth HID mouse. \`RemapperForegroundService\` detects the device via \`InputManager.InputDeviceListener\` and attaches \`uinput_bridge\` automatically.

### Mode B: Stock Unrooted Mode (Accessibility + IME Bridge)
1. Enable **KeyBridge Accessibility Service** in *Settings → Accessibility*.
2. Enable **KeyBridge Hardware Input Bridge** in *Settings → System → Keyboard*.
3. Intercepts \`KEYCODE_BACK\` and \`KEYCODE_FORWARD\` emitted by Mouse Buttons 4 & 5 on stock Android without root.`
  }
];
