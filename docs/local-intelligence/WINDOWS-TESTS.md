# Reproducible Windows validation (not executed here)

Use PowerShell in this repository. Install Android Studio, JDK 17, SDK platform/build tools 34, NDK 27.2.12479018, CMake 3.22+, and Android Emulator through SDK Manager. Enable virtualization in BIOS/UEFI and the Windows Hypervisor Platform. No phone, cloud key or private vault data is needed.

## Build and start an emulator

```powershell
$Sdk = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_HOME = $Sdk
# Use your actual JDK 17 installation if Android Studio's bundled JBR is a newer Java.
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
$env:PATH = "$env:JAVA_HOME\bin;$Sdk\platform-tools;$Sdk\emulator;$env:PATH"
& "$Sdk\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools" "emulator" "platforms;android-34" "build-tools;34.0.0" "ndk;27.2.12479018" "cmake;3.22.1" "system-images;android-36;google_apis;x86_64"
& "$Sdk\cmdline-tools\latest\bin\avdmanager.bat" create avd -n Atlas_API36 -k "system-images;android-36;google_apis;x86_64"
emulator -accel-check
Start-Process "$Sdk\emulator\emulator.exe" -ArgumentList '-avd','Atlas_API36','-no-snapshot','-memory','4096'
adb wait-for-device
adb shell getprop sys.boot_completed
npm ci
npm run build:mobile
npx cap copy android
Push-Location android
.\gradlew.bat testDebugUnitTest assembleDebug assembleDebugAndroidTest
Pop-Location
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
adb install -r android\app\build\outputs\apk\androidTest\debug\app-debug-androidTest.apk
adb shell am instrument -w -e class com.lifeatlas.app.ai.AtlasJniTest com.lifeatlas.app.test/androidx.test.runner.AndroidJUnitRunner
adb shell am start -n com.lifeatlas.app/.MainActivity
```

Wait for boot completion `1` before installation. Accept SDK licenses in the standard SDK Manager flow. Use the signing key matching your existing app for an update. No uninstall is required or suggested. The first command runs the actual JNI missing-model/cancel/reset/unload negative test; compilation alone does not count as execution.

Navigate to **Control Room → Intelligence Lab**. Confirm offline/unconfigured controls remain usable. Import a verified model through the document picker. Check streamed text, cancel/retry, switch model, and run Quick 10 before Full 100. Export JSON/CSV and inspect the actual runtime, model digest, device and configuration. WebView UI and voice/microphone behavior require this separate interactive check.

## Actual model JNI test

Obtain and verify an authorized GGUF using `MODELS.md`. The commands below copy the test file, not private app data. The test path is isolated from the model library, and no model is automatically selected for the assistant.

```powershell
$Model = "C:\Models\Huihui-Qwen3.5-0.8B-abliterated.Q4_K_M.gguf"
python scripts/local-ai/verify-model.py --id huihui-qwen35-08b-q4 --file $Model
adb push $Model /data/local/tmp/atlas-test.gguf
adb shell chmod 644 /data/local/tmp/atlas-test.gguf
adb shell run-as com.lifeatlas.app mkdir -p no_backup/atlas-jni-tests
adb shell run-as com.lifeatlas.app cp /data/local/tmp/atlas-test.gguf no_backup/atlas-jni-tests/model.gguf
adb shell am instrument -w -e class com.lifeatlas.app.ai.AtlasRealModelTest -e modelPath /data/user/0/com.lifeatlas.app/no_backup/atlas-jni-tests/model.gguf com.lifeatlas.app.test/androidx.test.runner.AndroidJUnitRunner
```

This test exercises actual load, generation, token/stage streaming, a multi-turn request, reset, structured JSON, token-triggered cancellation, unload and reloading. Pass `-e modelPath2 <second-app-readable-GGUF>` for a distinct second model. Without `modelPath` the real-model test explicitly skips; it must never be reported as passing real inference. Assertion failures are evidence of incompatibility and must be investigated, not replaced with synthetic output. Content quality needs human review; a nonempty reply is not a quality score.

After testing, remove only these test copies:

```powershell
adb shell rm /data/local/tmp/atlas-test.gguf
adb shell run-as com.lifeatlas.app rm no_backup/atlas-jni-tests/model.gguf
```

## Host CPU checks

Install Visual Studio Build Tools with C++ and CMake. From a Developer PowerShell:

```powershell
cmake -S android/app/src/main/cpp/local-ai -B work/atlas-host -A x64
cmake --build work/atlas-host --config Release --target atlas-cli atlas-core-test
ctest --test-dir work/atlas-host -C Release --output-on-failure
python scripts/local-ai/smoke-native.py --cli work/atlas-host/Release/atlas-cli.exe --model $Model --output work/atlas-host/smoke.json
npx tsx scripts/local-ai/export-cases.ts work/atlas-host/cases.json
python scripts/local-ai/bench-desktop.py --cli work/atlas-host/Release/atlas-cli.exe --model $Model --cases work/atlas-host/cases.json --output work/atlas-host/quick.json --quick
```

Host smoke uses real output, hashes the file and records failures. Windows console cancellation is explicitly not certified by the Python host runner; use the JNI test for cancellation. Native build dependencies and weights need normal authorized internet access. These commands have not been executed on Windows here.

## Current environment blocker

This task runs on Linux, with no attached Windows environment, no installed emulator/AVD/platform-tools and no `/dev/kvm`. Official SDK metadata was fetched successfully. API 36 AOSP ATD x86_64 image ZIP is 745,532,480 bytes; Linux emulator ZIP is 353,128,373 bytes, combined **1,098,660,853 compressed bytes**, before extraction and AVD writable storage. At audit time the workspace had 171,806,720 bytes and `/tmp` 664,350,720 bytes free. The image alone does not fit either available destination; software emulation (`-accel off`) still needs those installed files and cannot fix disk capacity. No emulator install, boot, APK installation or JNI execution is claimed. Generated obsolete build files were cleaned to permit the APK rebuild, not to erase application data. A larger environment with virtualization is needed for meaningful emulator inference tests.
