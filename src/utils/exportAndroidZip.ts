import JSZip from 'jszip';
import { ANDROID_STUDIO_SOURCE_FILES } from '../data/androidStudioProject';
import { MappingRule } from '../data/inputCatalog';

const SETTINGS_GRADLE_KTS = `pluginManagement {
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
rootProject.name = "KeyBridge"
include(":app")
`;

const ROOT_BUILD_GRADLE_KTS = `plugins {
    id("com.android.application") version "8.5.0" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
`;

const GRADLE_PROPERTIES = `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
`;

export const GITHUB_ACTIONS_BUILD_APK_YML = `name: Build KeyBridge Android APK

on:
  push:
    branches: [ "**" ]
  workflow_dispatch:

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Setup Gradle 8.7
        uses: gradle/actions/setup-gradle@v3
        with:
          gradle-version: '8.7'

      - name: Build Debug APK (Kotlin + C++ uinput NDK)
        run: |
          if [ -f "settings.gradle.kts" ]; then
            gradle assembleDebug --stacktrace
          else
            PROJECT_DIR=\$(find . -maxdepth 2 -name "settings.gradle.kts" -printf "%h\\n" | head -n 1)
            cd "\$PROJECT_DIR"
            gradle assembleDebug --stacktrace
          fi

      - name: Upload Compiled KeyBridge APK
        uses: actions/upload-artifact@v4
        with:
          name: KeyBridge-Android-APK
          path: "**/app/build/outputs/apk/debug/app-debug.apk"
`;

export async function downloadAndroidStudioZip(mappings: MappingRule[]): Promise<void> {
  const zip = new JSZip();

  // 1. Add root Gradle configuration files
  zip.file('settings.gradle.kts', SETTINGS_GRADLE_KTS);
  zip.file('build.gradle.kts', ROOT_BUILD_GRADLE_KTS);
  zip.file('gradle.properties', GRADLE_PROPERTIES);

  // 2. Add 1-Click Cloud APK Builder (GitHub Actions workflow)
  zip.file('.github/workflows/build-apk.yml', GITHUB_ACTIONS_BUILD_APK_YML);

  // 3. Serialize the user's configured mappings so the built APK starts with their exact rules
  const escapedSeedJson = JSON.stringify(
    mappings.map((m) => ({
      id: m.id,
      sourceMouseId: m.sourceMouseId,
      destinationType: m.destinationType,
      destinationId: m.destinationId,
      modifiers: m.modifiers,
      enabled: m.enabled,
      updatedAt: m.updatedAt
    }))
  ).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  // 4. Add all Android Studio source files
  for (const file of ANDROID_STUDIO_SOURCE_FILES) {
    let content = file.content;
    if (file.filename === 'MappingRepository.kt' && mappings.length > 0) {
      content = content.replace(
        'val rawJson = prefs[KEY_SAVED_MAPPINGS_JSON] ?: "[]"',
        `val rawJson = prefs[KEY_SAVED_MAPPINGS_JSON] ?: "${escapedSeedJson}"`
      );
    }
    zip.file(file.path, content);
  }

  // 5. Generate and trigger download of the .zip archive
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'KeyBridge-Android-APK-Project.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
