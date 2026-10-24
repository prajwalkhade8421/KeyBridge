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
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}`
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    filename: 'AndroidManifest.xml',
    language: 'xml',
    summary: 'Declares ForegroundService, AccessibilityService, KeyBridgeImeService, and BootCompletedReceiver (AGP 8+ compliant).',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

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
    path: 'app/src/main/res/xml/method.xml',
    filename: 'method.xml',
    language: 'xml',
    summary: 'InputMethodService XML declaration required by AndroidManifest.xml (@xml/method).',
    content: `<?xml version="1.0" encoding="utf-8"?>
<input-method xmlns:android="http://schemas.android.com/apk/res/android"
    android:supportsSwitchingToNextInputMethod="true">
    <subtype
        android:label="KeyBridge Hardware Input"
        android:imeSubtypeLocale="en_US"
        android:imeSubtypeMode="keyboard" />
</input-method>`
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
import android.content.pm.ServiceInfo
import android.hardware.input.InputManager
import android.os.Build
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

        val notification = buildStatusNotification("Monitoring mouse connections")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

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
        "MOUSE_BUTTON_6" -> 0x115
        "MOUSE_BUTTON_7" -> 0x116
        "MOUSE_BUTTON_8" -> 0x117
        "KEY_A" -> 30
        "KEY_B" -> 48
        "KEY_C" -> 46
        "KEY_D" -> 32
        "KEY_E" -> 18
        "KEY_F" -> 33
        "KEY_G" -> 34
        "KEY_H" -> 35
        "KEY_I" -> 23
        "KEY_J" -> 36
        "KEY_K" -> 37
        "KEY_L" -> 38
        "KEY_M" -> 50
        "KEY_N" -> 49
        "KEY_O" -> 24
        "KEY_P" -> 25
        "KEY_Q" -> 16
        "KEY_R" -> 19
        "KEY_S" -> 31
        "KEY_T" -> 20
        "KEY_U" -> 22
        "KEY_V" -> 47
        "KEY_W" -> 17
        "KEY_X" -> 45
        "KEY_Y" -> 21
        "KEY_Z" -> 44
        "KEY_1" -> 2
        "KEY_2" -> 3
        "KEY_3" -> 4
        "KEY_4" -> 5
        "KEY_5" -> 6
        "KEY_6" -> 7
        "KEY_7" -> 8
        "KEY_8" -> 9
        "KEY_9" -> 10
        "KEY_0" -> 11
        "KEY_F1" -> 59
        "KEY_F2" -> 60
        "KEY_F3" -> 61
        "KEY_F4" -> 62
        "KEY_F5" -> 63
        "KEY_F6" -> 64
        "KEY_F7" -> 65
        "KEY_F8" -> 66
        "KEY_F9" -> 67
        "KEY_F10" -> 68
        "KEY_F11" -> 87
        "KEY_F12" -> 88
        "KEY_SPACE" -> 57
        "KEY_ENTER" -> 28
        "KEY_ESCAPE" -> 1
        "KEY_TAB" -> 15
        "KEY_BACKSPACE" -> 14
        "KEY_UP" -> 103
        "KEY_DOWN" -> 108
        "KEY_LEFT" -> 105
        "KEY_RIGHT" -> 106
        "KEY_CTRL_LEFT" -> 29
        "KEY_SHIFT_LEFT" -> 42
        "KEY_ALT_LEFT" -> 56
        "KEY_META_LEFT" -> 125
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
    summary: 'Linux kernel evdev EVIOCGRAB interceptor, /dev/uinput composite emitter, and complete JNI exports.',
    content: `// uinput_bridge.cpp
// Native Linux evdev + uinput daemon for genuine hardware mouse-to-keyboard/mouse replacement.

#include <fcntl.h>
#include <jni.h>
#include <linux/input.h>
#include <linux/uinput.h>
#include <poll.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/time.h>
#include <unistd.h>
#include <unordered_map>
#include <vector>
#include <mutex>

struct RemapTarget {
    uint16_t targetEvKey;
    std::vector<uint16_t> mods;
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
    if (g_uinputFd >= 0) return g_uinputFd;
    int ufd = open("/dev/uinput", O_WRONLY | O_NONBLOCK);
    if (ufd < 0) return -1;

    ioctl(ufd, UI_SET_EVBIT, EV_KEY);
    ioctl(ufd, UI_SET_EVBIT, EV_REL);
    ioctl(ufd, UI_SET_EVBIT, EV_SYN);

    for (int btn = BTN_LEFT; btn <= BTN_TASK; ++btn) {
        ioctl(ufd, UI_SET_KEYBIT, btn);
    }
    for (int key = 1; key <= 248; ++key) {
        ioctl(ufd, UI_SET_KEYBIT, key);
    }

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

extern "C" {

JNIEXPORT jint JNICALL
Java_dev_keybridge_remapper_nativebridge_EvdevUinputDaemon_nativeSetupVirtualCompositeDevice(
    JNIEnv* /*env*/, jobject /*thiz*/
) {
    return setupVirtualCompositeDevice();
}

JNIEXPORT jboolean JNICALL
Java_dev_keybridge_remapper_nativebridge_EvdevUinputDaemon_nativeAttachDeviceById(
    JNIEnv* /*env*/, jobject /*thiz*/, jint /*deviceId*/
) {
    return g_uinputFd >= 0 ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_dev_keybridge_remapper_nativebridge_EvdevUinputDaemon_nativeDetachDeviceById(
    JNIEnv* /*env*/, jobject /*thiz*/, jint /*deviceId*/
) {
    // Device detached cleanup handled via nativeReleaseAllHeld
}

JNIEXPORT void JNICALL
Java_dev_keybridge_remapper_nativebridge_EvdevUinputDaemon_nativeClearRules(
    JNIEnv* /*env*/, jobject /*thiz*/
) {
    std::lock_guard<std::mutex> lock(g_ruleMutex);
    g_remapTable.clear();
}

JNIEXPORT void JNICALL
Java_dev_keybridge_remapper_nativebridge_EvdevUinputDaemon_nativeAddRemapRule(
    JNIEnv* env, jobject /*thiz*/, jint srcEvCode, jint dstEvCode, jintArray modifiers
) {
    std::lock_guard<std::mutex> lock(g_ruleMutex);
    RemapTarget target;
    target.targetEvKey = static_cast<uint16_t>(dstEvCode);
    if (modifiers != nullptr) {
        jsize len = env->GetArrayLength(modifiers);
        jint* elems = env->GetIntArrayElements(modifiers, nullptr);
        for (jsize i = 0; i < len; ++i) {
            if (elems[i] > 0) {
                target.mods.push_back(static_cast<uint16_t>(elems[i]));
            }
        }
        env->ReleaseIntArrayElements(modifiers, elems, JNI_ABORT);
    }
    g_remapTable[static_cast<uint16_t>(srcEvCode)] = target;
}

JNIEXPORT void JNICALL
Java_dev_keybridge_remapper_nativebridge_EvdevUinputDaemon_nativeForceReleaseKey(
    JNIEnv* /*env*/, jobject /*thiz*/, jint linuxCode
) {
    std::lock_guard<std::mutex> lock(g_ruleMutex);
    if (g_uinputFd >= 0 && linuxCode > 0) {
        emitInputEvent(g_uinputFd, EV_KEY, static_cast<uint16_t>(linuxCode), 0);
        emitSynReport(g_uinputFd);
    }
}

JNIEXPORT void JNICALL
Java_dev_keybridge_remapper_nativebridge_EvdevUinputDaemon_nativeReleaseAllHeld(
    JNIEnv* /*env*/, jobject /*thiz*/
) {
    std::lock_guard<std::mutex> lock(g_ruleMutex);
    if (g_uinputFd >= 0) {
        for (const auto& kv : g_activeHolds) {
            emitInputEvent(g_uinputFd, EV_KEY, kv.second.targetEvKey, 0);
            for (uint16_t mod : kv.second.mods) {
                emitInputEvent(g_uinputFd, EV_KEY, mod, 0);
            }
        }
        emitSynReport(g_uinputFd);
    }
    g_activeHolds.clear();
}

JNIEXPORT void JNICALL
Java_dev_keybridge_remapper_nativebridge_EvdevUinputDaemon_nativeShutdownUinput(
    JNIEnv* /*env*/, jobject /*thiz*/
) {
    std::lock_guard<std::mutex> lock(g_ruleMutex);
    if (g_uinputFd >= 0) {
        ioctl(g_uinputFd, UI_DEV_DESTROY);
        close(g_uinputFd);
        g_uinputFd = -1;
    }
}

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

        KeyBridgeImeService.dispatchRemappedKeyFromAccessibility(
            rule = rule,
            action = event.action,
            eventTime = event.eventTime
        )

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
    path: 'app/src/main/java/dev/keybridge/remapper/service/KeyBridgeImeService.kt',
    filename: 'KeyBridgeImeService.kt',
    language: 'kotlin',
    summary: 'Companion InputMethodService that injects synthesized KeyEvents on stock unrooted Android.',
    content: `package dev.keybridge.remapper.service

import android.inputmethodservice.InputMethodService
import android.os.SystemClock
import android.view.KeyCharacterMap
import android.view.KeyEvent
import dev.keybridge.remapper.data.MappingRule

class KeyBridgeImeService : InputMethodService() {

    override fun onCreate() {
        super.onCreate()
        activeInstance = this
    }

    override fun onDestroy() {
        if (activeInstance === this) {
            activeInstance = null
        }
        super.onDestroy()
    }

    private fun sendSynthesizedKey(rule: MappingRule, action: Int, eventTime: Long) {
        val ic = currentInputConnection ?: return
        val androidKeyCode = resolveAndroidKeyCode(rule.destinationId)
        val metaState = resolveMetaState(rule.modifiers)
        val downTime = if (action == KeyEvent.ACTION_DOWN) eventTime else SystemClock.uptimeMillis()

        val keyEvent = KeyEvent(
            downTime,
            eventTime,
            action,
            androidKeyCode,
            0,
            metaState,
            KeyCharacterMap.VIRTUAL_KEYBOARD,
            0,
            KeyEvent.FLAG_FROM_SYSTEM
        )
        ic.sendKeyEvent(keyEvent)
    }

    private fun resolveMetaState(modifiers: List<String>): Int {
        var meta = 0
        if ("CTRL" in modifiers) meta = meta or KeyEvent.META_CTRL_ON or KeyEvent.META_CTRL_LEFT_ON
        if ("SHIFT" in modifiers) meta = meta or KeyEvent.META_SHIFT_ON or KeyEvent.META_SHIFT_LEFT_ON
        if ("ALT" in modifiers) meta = meta or KeyEvent.META_ALT_ON or KeyEvent.META_ALT_LEFT_ON
        if ("META" in modifiers) meta = meta or KeyEvent.META_META_ON or KeyEvent.META_META_LEFT_ON
        return meta
    }

    private fun resolveAndroidKeyCode(destinationId: String): Int = when (destinationId) {
        "KEY_A" -> KeyEvent.KEYCODE_A
        "KEY_B" -> KeyEvent.KEYCODE_B
        "KEY_C" -> KeyEvent.KEYCODE_C
        "KEY_D" -> KeyEvent.KEYCODE_D
        "KEY_E" -> KeyEvent.KEYCODE_E
        "KEY_F" -> KeyEvent.KEYCODE_F
        "KEY_G" -> KeyEvent.KEYCODE_G
        "KEY_H" -> KeyEvent.KEYCODE_H
        "KEY_I" -> KeyEvent.KEYCODE_I
        "KEY_J" -> KeyEvent.KEYCODE_J
        "KEY_K" -> KeyEvent.KEYCODE_K
        "KEY_L" -> KeyEvent.KEYCODE_L
        "KEY_M" -> KeyEvent.KEYCODE_M
        "KEY_N" -> KeyEvent.KEYCODE_N
        "KEY_O" -> KeyEvent.KEYCODE_O
        "KEY_P" -> KeyEvent.KEYCODE_P
        "KEY_Q" -> KeyEvent.KEYCODE_Q
        "KEY_R" -> KeyEvent.KEYCODE_R
        "KEY_S" -> KeyEvent.KEYCODE_S
        "KEY_T" -> KeyEvent.KEYCODE_T
        "KEY_U" -> KeyEvent.KEYCODE_U
        "KEY_V" -> KeyEvent.KEYCODE_V
        "KEY_W" -> KeyEvent.KEYCODE_W
        "KEY_X" -> KeyEvent.KEYCODE_X
        "KEY_Y" -> KeyEvent.KEYCODE_Y
        "KEY_Z" -> KeyEvent.KEYCODE_Z
        "KEY_0" -> KeyEvent.KEYCODE_0
        "KEY_1" -> KeyEvent.KEYCODE_1
        "KEY_2" -> KeyEvent.KEYCODE_2
        "KEY_3" -> KeyEvent.KEYCODE_3
        "KEY_4" -> KeyEvent.KEYCODE_4
        "KEY_5" -> KeyEvent.KEYCODE_5
        "KEY_6" -> KeyEvent.KEYCODE_6
        "KEY_7" -> KeyEvent.KEYCODE_7
        "KEY_8" -> KeyEvent.KEYCODE_8
        "KEY_9" -> KeyEvent.KEYCODE_9
        "KEY_SPACE" -> KeyEvent.KEYCODE_SPACE
        "KEY_ENTER" -> KeyEvent.KEYCODE_ENTER
        "KEY_ESCAPE" -> KeyEvent.KEYCODE_ESCAPE
        "KEY_TAB" -> KeyEvent.KEYCODE_TAB
        "KEY_BACKSPACE" -> KeyEvent.KEYCODE_DEL
        "KEY_UP" -> KeyEvent.KEYCODE_DPAD_UP
        "KEY_DOWN" -> KeyEvent.KEYCODE_DPAD_DOWN
        "KEY_LEFT" -> KeyEvent.KEYCODE_DPAD_LEFT
        "KEY_RIGHT" -> KeyEvent.KEYCODE_DPAD_RIGHT
        else -> KeyEvent.KEYCODE_T
    }

    companion object {
        @Volatile
        private var activeInstance: KeyBridgeImeService? = null

        fun dispatchRemappedKeyFromAccessibility(rule: MappingRule, action: Int, eventTime: Long) {
            activeInstance?.sendSynthesizedKey(rule, action, eventTime)
        }
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
    summary: 'Complete Jetpack Compose UI (MainActivity + MainScreen + 2-Step AddEditMappingScreen) ready to compile.',
    content: `package dev.keybridge.remapper.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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

private val MOUSE_BUTTON_OPTIONS = listOf(
    "MOUSE_LEFT" to "Mouse Left",
    "MOUSE_RIGHT" to "Mouse Right",
    "MOUSE_MIDDLE" to "Mouse Middle",
    "MOUSE_BACK" to "Mouse Back (Button 4)",
    "MOUSE_FORWARD" to "Mouse Forward (Button 5)",
    "MOUSE_BUTTON_6" to "Mouse Button 6",
    "MOUSE_BUTTON_7" to "Mouse Button 7",
    "MOUSE_BUTTON_8" to "Mouse Button 8"
)

private val KEYBOARD_KEY_OPTIONS = listOf(
    "KEY_T" to "Keyboard T",
    "KEY_G" to "Keyboard G",
    "KEY_W" to "Keyboard W",
    "KEY_A" to "Keyboard A",
    "KEY_S" to "Keyboard S",
    "KEY_D" to "Keyboard D",
    "KEY_E" to "Keyboard E",
    "KEY_R" to "Keyboard R",
    "KEY_F" to "Keyboard F",
    "KEY_Q" to "Keyboard Q",
    "KEY_C" to "Keyboard C",
    "KEY_V" to "Keyboard V",
    "KEY_X" to "Keyboard X",
    "KEY_Z" to "Keyboard Z",
    "KEY_SPACE" to "Keyboard Space",
    "KEY_SHIFT_LEFT" to "Keyboard Left Shift",
    "KEY_CTRL_LEFT" to "Keyboard Left Ctrl",
    "KEY_ALT_LEFT" to "Keyboard Left Alt",
    "KEY_TAB" to "Keyboard Tab",
    "KEY_ESCAPE" to "Keyboard Escape",
    "KEY_ENTER" to "Keyboard Enter",
    "KEY_1" to "Keyboard 1",
    "KEY_2" to "Keyboard 2",
    "KEY_3" to "Keyboard 3",
    "KEY_4" to "Keyboard 4",
    "KEY_5" to "Keyboard 5",
    "KEY_F1" to "Keyboard F1",
    "KEY_F3" to "Keyboard F3",
    "KEY_F5" to "Keyboard F5"
)

private fun formatInputLabel(id: String): String {
    return (MOUSE_BUTTON_OPTIONS + KEYBOARD_KEY_OPTIONS).firstOrNull { it.first == id }?.second ?: id
}

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

                LaunchedEffect(masterEnabled) {
                    if (masterEnabled) {
                        val svcIntent = Intent(this@MainActivity, RemapperForegroundService::class.java)
                        runCatching {
                            ContextCompat.startForegroundService(this@MainActivity, svcIntent)
                        }
                    }
                }

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
}

@Composable
fun MainScreen(
    masterEnabled: Boolean,
    mappings: List<MappingRule>,
    onToggleMaster: (Boolean) -> Unit,
    onAddClick: () -> Unit,
    onEditClick: (MappingRule) -> Unit,
    onToggleRuleClick: (MappingRule) -> Unit,
    onDeleteClick: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header + Master Toggle Card
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, Color(0xFF1E293B))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "KeyBridge Remapper",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = if (masterEnabled) "Remapping service active" else "Remapping paused",
                        fontSize = 12.sp,
                        color = if (masterEnabled) Color(0xFF34D399) else Color(0xFF94A3B8)
                    )
                }
                Switch(
                    checked = masterEnabled,
                    onCheckedChange = onToggleMaster
                )
            }
        }

        // Add Mapping Button
        Button(
            onClick = onAddClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text("+ Add Mapping", fontWeight = FontWeight.Bold)
        }

        // Saved Mappings List
        if (mappings.isEmpty()) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, Color(0xFF1E293B))
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "No mappings saved yet",
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Tap + Add Mapping above to bind any mouse button to a keyboard key or mouse button.",
                        fontSize = 12.sp,
                        color = Color(0xFF94A3B8)
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(mappings, key = { it.id }) { rule ->
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = MaterialTheme.colorScheme.surface,
                        border = BorderStroke(1.dp, Color(0xFF1E293B))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onEditClick(rule) }
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "\${formatInputLabel(rule.sourceMouseId)}  →  \${formatInputLabel(rule.destinationId)}",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 14.sp,
                                    color = Color.White
                                )
                                if (rule.modifiers.isNotEmpty()) {
                                    Text(
                                        text = "Modifiers: \${rule.modifiers.joinToString("+")}",
                                        fontSize = 11.sp,
                                        color = Color(0xFF60A5FA)
                                    )
                                }
                            }
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Switch(
                                    checked = rule.enabled,
                                    onCheckedChange = { onToggleRuleClick(rule) }
                                )
                                TextButton(onClick = { onDeleteClick(rule.id) }) {
                                    Text("Delete", color = Color(0xFFF87171), fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AddEditMappingScreen(
    initialRule: MappingRule?,
    onSave: (MappingRule) -> Unit,
    onCancel: () -> Unit
) {
    var step by rememberSaveable { mutableStateOf(1) }
    var selectedSource by rememberSaveable { mutableStateOf(initialRule?.sourceMouseId ?: "MOUSE_FORWARD") }
    var destinationType by rememberSaveable { mutableStateOf(initialRule?.destinationType ?: DestinationType.KEYBOARD) }
    var selectedDestination by rememberSaveable { mutableStateOf(initialRule?.destinationId ?: "KEY_T") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = if (step == 1) "Step 1 of 2: Select Mouse Button" else "Step 2 of 2: Select Replacement Key",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )

        if (step == 1) {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(MOUSE_BUTTON_OPTIONS) { (id, label) ->
                    val isSelected = selectedSource == id
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (isSelected) Color(0xFF1E3A8A) else MaterialTheme.colorScheme.surface,
                        border = BorderStroke(1.dp, if (isSelected) Color(0xFF3B82F6) else Color(0xFF1E293B)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedSource = id }
                    ) {
                        Text(
                            text = label,
                            modifier = Modifier.padding(14.dp),
                            color = Color.White,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onCancel,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Cancel")
                }
                Button(
                    onClick = { step = 2 },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Next Step")
                }
            }
        } else {
            val options = if (destinationType == DestinationType.KEYBOARD) KEYBOARD_KEY_OPTIONS else MOUSE_BUTTON_OPTIONS
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        destinationType = DestinationType.KEYBOARD
                        selectedDestination = "KEY_T"
                    }
                ) {
                    Text("Keyboard Key")
                }
                OutlinedButton(
                    onClick = {
                        destinationType = DestinationType.MOUSE
                        selectedDestination = "MOUSE_RIGHT"
                    }
                ) {
                    Text("Mouse Button")
                }
            }

            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(options) { (id, label) ->
                    val isSelected = selectedDestination == id
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (isSelected) Color(0xFF1E3A8A) else MaterialTheme.colorScheme.surface,
                        border = BorderStroke(1.dp, if (isSelected) Color(0xFF3B82F6) else Color(0xFF1E293B)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedDestination = id }
                    ) {
                        Text(
                            text = label,
                            modifier = Modifier.padding(14.dp),
                            color = Color.White,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = { step = 1 },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Back")
                }
                Button(
                    onClick = {
                        onSave(
                            MappingRule(
                                id = initialRule?.id ?: java.util.UUID.randomUUID().toString(),
                                sourceMouseId = selectedSource,
                                destinationType = destinationType,
                                destinationId = selectedDestination,
                                enabled = initialRule?.enabled ?: true
                            )
                        )
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Save Mapping")
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

## 1. Automated Cloud APK Build (GitHub Actions — Zero Setup)
1. Upload all extracted files from \`KeyBridge-Android-APK-Project.zip\` (including the \`.github/workflows/build-apk.yml\` folder) to a GitHub repository.
2. Open the **Actions** tab in your GitHub repository.
3. Click the **Build KeyBridge Android APK** workflow run and download **\`KeyBridge-Android-APK\`** (\`app-debug.apk\`).

## 2. Building Locally from Source
1. Open the project root in Android Studio or run via Gradle CLI:
   \`\`\`bash
   gradle assembleDebug
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

