# Android previews from GitHub Actions

Workflow: `.github/workflows/android-preview.yml` — **Android preview APK (manual)**.

The existing Gradle preview variant is `com.lifeatlas.app.next`, labeled **Atlas Next**. Production is `com.lifeatlas.app`. This workflow runs only `:app:assemblePreview`, checks the resulting APK package identity, and uploads it only after signature verification. It does not retrieve signing secrets, run live cloud tests, publish releases, or build production APKs. Existing workflows are unchanged; do not use their production/signing paths for this preview process.

## Run entirely from GitHub

1. Review and commit the intended source and workflow changes through your normal process. No commit or push has been performed by Codex. All required Atlas source files, including currently untracked files, must exist in the selected Git revision. The workflow must be present on the repository's default branch to appear for manual dispatch.
2. Open the repository on GitHub → **Actions** → **Android preview APK (manual)** → **Run workflow**.
3. Select the branch containing the desired app code. Leave `native_integration` unchecked; it is hard-disabled regardless of its input until a reviewed source change enables it.
4. Wait for the `preview` job. Open the run summary and download `atlas-preview-apk-<run-id>-<attempt>` and, when needed, `atlas-preview-diagnostics-<run-id>-<attempt>`.
5. Extract the artifact ZIP on the phone or transfer its `atlas-next-preview.apk` to the phone. Allow installation from your chosen browser/file manager, and install **Atlas Next**. Verify the package is `com.lifeatlas.app.next`. Production remains a separate installed app with separate storage.

The runner uses ephemeral debug signing. A later preview run may have a different certificate and may not update an existing preview installation. Do not uninstall a preview containing valuable data to resolve this: export its encrypted data first, or establish an explicitly managed preview-only signing key in a separate change. Production keys are never used or exported.

## Toolchain and reproducibility

Ubuntu 24.04 runner; Node 22.14.0; Temurin Java 17.0.14+7; existing Gradle wrapper 8.7 and AGP 8.2.1; Android command-line tools build 11076708, SDK platform 34, build tools 34.0.0. `npm ci` uses the committed lockfile. npm and Gradle dependencies are cached; APKs and signing keys are not cached. Logs/reports have 14-day retention. No database credentials are required; Prisma generation does not run migrations or queries.

These pins improve repeatability but do not promise byte-identical APKs: runner images, action version tags, transitive Maven resolution, signing and timestamps can vary. SDK/Gradle compilation is performed by GitHub, not assumed to exist in Codex Cloud. Actions must be enabled and the repository must have available hosted-runner quota; no paid service is activated here. The first GitHub run is still required to verify Android compilation.

## Optional native stage

The separate `native-integration` job is guarded by a literal `false`. `android/llama-source.json` records an intentionally empty revision and `reviewed: false`; there is no fabricated pin. Enabling requires a reviewed immutable 40-character upstream commit, review evidence and a source change removing that guard. The job validates the pin, fetches only that commit, and prepares ARM64 compilation with NDK 26.3.11579264, CMake 3.22.1 and Android native API 28. Compatibility and CMake options must be reviewed against the actual pinned upstream source before activation.

This optional stage builds an upstream library only. It neither adds JNI to the APK nor downloads models nor proves inference. Default preview builds install no NDK, CMake or model artifacts.

## Codex Cloud validation

YAML parsing and manual-only/read-permission/native-disable invariants passed. Every embedded shell block passed `bash -n`. TypeScript, the mobile bundle (121 assets), and `git diff --check` passed. `actionlint` and ShellCheck are not installed; the available `go` executable is not a usable Go compiler (`Go: Unknown option: run`), so actionlint could not be bootstrapped. No Actions run or Android compilation was performed.

Before publishing your changes, inspect the existing workflows' push/PR triggers. This new workflow is manual-only, but it does not disable older workflows. Avoid existing automatic build/verification branch patterns when preparing the preview branch.

## Phase 5 JVM test gate

The preview job now runs `:app:testPreviewUnitTest` after Capacitor sync and before APK assembly. It requires the `AtlasModelTransferTest` XML report to contain at least two tests, with no failures, errors or skips. Failure prevents APK upload. Gradle test logs, HTML reports and JUnit XML are included in the always-uploaded diagnostics artifact. Job timeout is 50 minutes; the test step is capped at 12 minutes. This remains manual-only and requires no emulator or production credentials.
