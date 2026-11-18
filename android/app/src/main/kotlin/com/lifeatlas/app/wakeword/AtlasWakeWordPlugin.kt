package com.lifeatlas.app.wakeword

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.result.ActivityResult
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.lifeatlas.app.wakeword.assistant.AtlasExperimentVoiceInteractionService
import com.lifeatlas.app.wakeword.voice.AtlasAudioOwnershipCoordinator
import com.lifeatlas.app.wakeword.voice.AtlasVoiceCoordinator
import com.lifeatlas.app.wakeword.voice.AtlasVoiceSecureStore
import com.lifeatlas.app.wakeword.voice.AtlasVoiceSpeechManager
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference

/**
 * Minimal Capacitor bridge for the isolated Hey Atlas wake-word experiment.
 *
 * Security & privacy boundary:
 * - Never streams raw microphone PCM or audio buffers to JavaScript.
 * - Exposes only control actions, model metadata, non-audio metrics,
 *   scenario checklists, and wake-detection events.
 */
@CapacitorPlugin(
    name = "AtlasWakeWord",
    permissions = [
        Permission(
            alias = "microphone",
            strings = [Manifest.permission.RECORD_AUDIO]
        ),
        Permission(
            alias = "notifications",
            strings = [Manifest.permission.POST_NOTIFICATIONS]
        )
    ]
)
class AtlasWakeWordPlugin : Plugin() {

    companion object {
        @Volatile
        private var activePluginRef: WeakReference<AtlasWakeWordPlugin>? = null

        @Volatile
        private var appInForeground: Boolean = false

        fun hasActivePlugin(): Boolean = activePluginRef?.get() != null
        fun isAppForeground(): Boolean = hasActivePlugin() && appInForeground

        private fun emitEvent(eventName: String, json: JSONObject) {
            val plugin = activePluginRef?.get() ?: return
            try {
                val payload = JSObject.fromJSONObject(json)
                plugin.bridge?.executeOnMainThread {
                    plugin.notifyListeners(eventName, payload, false)
                }
            } catch (_: Exception) {
            }
        }

        fun emitVoiceSessionState(json: JSONObject) = emitEvent("voiceSessionState", json)
        fun emitVoiceTranscript(json: JSONObject) = emitEvent("voiceTranscript", json)
        fun emitVoiceCommand(json: JSONObject) = emitEvent("voiceCommand", json)
        fun emitVoiceLatencyMetrics(json: JSONObject) = emitEvent("voiceLatencyMetrics", json)

        fun emitWakeWordDetected(eventJson: JSONObject) {
            val plugin = activePluginRef?.get() ?: return
            try {
                val payload = JSObject.fromJSONObject(eventJson)
                plugin.bridge?.executeOnMainThread {
                    plugin.notifyListeners("wakeWordDetected", payload, false)
                }
            } catch (_: Exception) {
                // Ignore serialization errors if plugin is tearing down.
            }
        }

        fun emitStatusChange(context: Context) {
            val plugin = activePluginRef?.get() ?: return
            try {
                val statusJson = buildListeningStatusJson(context)
                val payload = JSObject.fromJSONObject(statusJson)
                plugin.bridge?.executeOnMainThread {
                    plugin.notifyListeners("statusChanged", payload, false)
                }
            } catch (_: Exception) {
                // Ignore if plugin is tearing down.
            }
        }

        fun buildListeningStatusJson(context: Context): JSONObject {
            val diag = WakeWordDiagnostics.snapshot(context)
            val model = WakeWordModelManager.getActiveModel(context)
            val micGranted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED
            val notificationsGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                nm?.areNotificationsEnabled() ?: true
            }
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            val ignoringBatteryOpt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && pm != null) {
                pm.isIgnoringBatteryOptimizations(context.packageName)
            } else {
                false
            }

            return JSONObject()
                .put("running", AtlasWakeWordService.isServiceRunning)
                .put("paused", AtlasWakeWordService.isServicePaused)
                .put("micSilenced", AtlasWakeWordService.isMicSilenced)
                .put("serviceState", diag.optString("serviceState", "stopped"))
                .put("lastStateReason", diag.optString("lastStateReason", "Not started"))
                .put("microphoneGranted", micGranted)
                .put("notificationsGranted", notificationsGranted)
                .put("ignoringBatteryOptimizations", ignoringBatteryOpt)
                .put("loadedModel", model.toJson())
                .put("environment", diag.optJSONObject("environment") ?: JSONObject())
        }
    }

    override fun load() {
        super.load()
        activePluginRef = WeakReference(this)
        appInForeground = true
    }

    override fun handleOnResume() {
        super.handleOnResume()
        appInForeground = true
    }

    override fun handleOnPause() {
        appInForeground = false
        super.handleOnPause()
    }

    override fun handleOnDestroy() {
        appInForeground = false
        val current = activePluginRef?.get()
        if (current === this) {
            activePluginRef = null
        }
        super.handleOnDestroy()
    }

    @PluginMethod
    fun startListening(call: PluginCall) {
        if (!hasMicPermission()) {
            requestPermissionForAlias("microphone", call, "onMicPermissionForStart")
            return
        }
        startServiceInternal(call)
    }

    @PermissionCallback
    private fun onMicPermissionForStart(call: PluginCall) {
        if (getPermissionState("microphone") == PermissionState.GRANTED || hasMicPermission()) {
            startServiceInternal(call)
        } else {
            call.reject("RECORD_AUDIO permission is required for the Hey Atlas wake-word experiment.")
        }
    }

    private fun startServiceInternal(call: PluginCall) {
        val useAssistantSession = call.getBoolean("useAssistantSession", false) ?: false
        val intent = Intent(context, AtlasWakeWordService::class.java).apply {
            action = AtlasWakeWordService.ACTION_START
            putExtra(AtlasWakeWordService.EXTRA_USE_ASSISTANT_SESSION, useAssistantSession)
        }
        try {
            ContextCompat.startForegroundService(context, intent)
            call.resolve(JSObject.fromJSONObject(buildListeningStatusJson(context)))
        } catch (e: Exception) {
            call.reject("Failed to start wake-word foreground service: ${e.message}", e)
        }
    }

    @PluginMethod
    fun stopListening(call: PluginCall) {
        val intent = Intent(context, AtlasWakeWordService::class.java).apply {
            action = AtlasWakeWordService.ACTION_STOP
        }
        context.startService(intent)
        call.resolve(JSObject.fromJSONObject(buildListeningStatusJson(context)))
    }

    @PluginMethod
    fun pauseListening(call: PluginCall) {
        if (!AtlasWakeWordService.isServiceRunning) {
            call.resolve(JSObject.fromJSONObject(buildListeningStatusJson(context)))
            return
        }
        val intent = Intent(context, AtlasWakeWordService::class.java).apply {
            action = AtlasWakeWordService.ACTION_PAUSE
        }
        context.startService(intent)
        call.resolve(JSObject.fromJSONObject(buildListeningStatusJson(context)))
    }

    @PluginMethod
    fun resumeListening(call: PluginCall) {
        if (!AtlasWakeWordService.isServiceRunning) {
            call.reject("Wake-word service is not running.")
            return
        }
        val intent = Intent(context, AtlasWakeWordService::class.java).apply {
            action = AtlasWakeWordService.ACTION_RESUME
        }
        context.startService(intent)
        call.resolve(JSObject.fromJSONObject(buildListeningStatusJson(context)))
    }

    @PluginMethod
    fun getListeningStatus(call: PluginCall) {
        call.resolve(JSObject.fromJSONObject(buildListeningStatusJson(context)))
    }

    @PluginMethod
    fun getWakeWordStats(call: PluginCall) {
        val snap = WakeWordDiagnostics.snapshot(context)
        val stats = JSONObject()
            .put("running", AtlasWakeWordService.isServiceRunning)
            .put("paused", AtlasWakeWordService.isServicePaused)
            .put("micSilenced", AtlasWakeWordService.isMicSilenced)
            .put("serviceState", snap.optString("serviceState", "stopped"))
            .put("lastStateReason", snap.optString("lastStateReason", "Not started"))
            .put("detectionCount", snap.optInt("detectionCount", 0))
            .put("falsePositiveCount", snap.optInt("falsePositiveCount", 0))
            .put("missedActivationCount", snap.optInt("missedActivationCount", 0))
            .put("framesProcessed", snap.optLong("framesProcessed", 0L))
            .put("lastDetectionLatencyMs", snap.optDouble("lastDetectionLatencyMs", 0.0))
            .put("avgDetectionLatencyMs", snap.optDouble("avgDetectionLatencyMs", 0.0))
            .put("lastScore", snap.optDouble("lastScore", 0.0))
            .put("peakScore", snap.optDouble("peakScore", 0.0))
            .put("micCompetitionCount", snap.optInt("micCompetitionCount", 0))
            .put("cpuPercentEstimate", snap.optDouble("cpuPercentEstimate", 0.0))
            .put("memoryMbEstimate", snap.optDouble("memoryMbEstimate", 0.0))
            .put("loadedModel", snap.optJSONObject("loadedModel") ?: WakeWordModelManager.getActiveModel(context).toJson())
            .put("detections", snap.optJSONArray("detections"))
        call.resolve(JSObject.fromJSONObject(stats))
    }

    @PluginMethod
    fun getDiagnosticReport(call: PluginCall) {
        val snap = WakeWordDiagnostics.snapshot(context)
        snap.put("listeningStatus", buildListeningStatusJson(context))
        snap.put("assistantRole", buildAssistantRoleStatusJson())
        call.resolve(JSObject.fromJSONObject(snap))
    }

    @PluginMethod
    fun importCustomModel(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
        }
        startActivityForResult(call, intent, "onCustomModelPicked")
    }

    @ActivityCallback
    private fun onCustomModelPicked(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("Model selection cancelled.")
            return
        }
        val uri: Uri = result.data?.data ?: run {
            call.reject("No model file URI returned.")
            return
        }
        val threshold = (call.getDouble("threshold", 0.5) ?: 0.5).toFloat()
        val displayName = uri.lastPathSegment?.substringAfterLast('/') ?: "Custom Hey Atlas (.onnx)"
        try {
            val info = WakeWordModelManager.importCustomModelFromUri(
                context = context,
                uri = uri,
                displayName = displayName,
                threshold = threshold
            )
            if (AtlasWakeWordService.isServiceRunning) {
                context.startService(
                    Intent(context, AtlasWakeWordService::class.java).apply {
                        action = AtlasWakeWordService.ACTION_RELOAD_MODEL
                    }
                )
            }
            val res = JSONObject()
                .put("imported", true)
                .put("loadedModel", info.toJson())
            call.resolve(JSObject.fromJSONObject(res))
        } catch (e: Exception) {
            call.reject(e.message ?: "Failed to validate ONNX model.", e)
        }
    }

    @PluginMethod
    fun resetToTestModel(call: PluginCall) {
        val info = WakeWordModelManager.resetToTestModel(context)
        if (AtlasWakeWordService.isServiceRunning) {
            context.startService(
                Intent(context, AtlasWakeWordService::class.java).apply {
                    action = AtlasWakeWordService.ACTION_RELOAD_MODEL
                }
            )
        }
        val res = JSONObject().put("loadedModel", info.toJson())
        call.resolve(JSObject.fromJSONObject(res))
    }

    @PluginMethod
    fun markFalsePositive(call: PluginCall) {
        val count = WakeWordDiagnostics.markFalsePositive(context)
        val res = JSONObject().put("falsePositiveCount", count)
        call.resolve(JSObject.fromJSONObject(res))
    }

    @PluginMethod
    fun markMissedActivation(call: PluginCall) {
        val note = call.getString("note") ?: ""
        val count = WakeWordDiagnostics.markMissedActivation(context, note)
        val res = JSONObject().put("missedActivationCount", count)
        call.resolve(JSObject.fromJSONObject(res))
    }

    @PluginMethod
    fun recordScenarioResult(call: PluginCall) {
        val scenarioId = call.getString("scenarioId")?.trim().orEmpty()
        val status = call.getString("status")?.trim().orEmpty()
        val notes = call.getString("notes") ?: ""
        if (scenarioId.isEmpty() || status.isEmpty()) {
            call.reject("scenarioId and status are required.")
            return
        }
        WakeWordDiagnostics.recordScenarioResult(context, scenarioId, status, notes)
        call.resolve(JSObject.fromJSONObject(WakeWordDiagnostics.snapshot(context)))
    }

    @PluginMethod
    fun clearDiagnostics(call: PluginCall) {
        WakeWordDiagnostics.clear(context)
        call.resolve(JSObject.fromJSONObject(WakeWordDiagnostics.snapshot(context)))
    }

    @PluginMethod
    fun startOvernightTest(call: PluginCall) {
        val isBaseline = call.getBoolean("isBaseline", false) ?: false
        if (!isBaseline && !hasMicPermission()) {
            requestPermissionForAlias("microphone", call, "onMicPermissionForOvernightStart")
            return
        }
        startOvernightTestInternal(call, isBaseline)
    }

    @PermissionCallback
    private fun onMicPermissionForOvernightStart(call: PluginCall) {
        if (getPermissionState("microphone") == PermissionState.GRANTED || hasMicPermission()) {
            val isBaseline = call.getBoolean("isBaseline", false) ?: false
            startOvernightTestInternal(call, isBaseline)
        } else {
            call.reject("RECORD_AUDIO permission is required to start an active Overnight Endurance Test.")
        }
    }

    private fun startOvernightTestInternal(call: PluginCall, isBaseline: Boolean) {
        if (isBaseline) {
            if (AtlasWakeWordService.isServiceRunning) {
                val stopIntent = Intent(context, AtlasWakeWordService::class.java).apply {
                    action = AtlasWakeWordService.ACTION_STOP
                }
                context.startService(stopIntent)
            }
        } else {
            val useAssistantSession = call.getBoolean("useAssistantSession", false) ?: false
            if (!AtlasWakeWordService.isServiceRunning) {
                val startIntent = Intent(context, AtlasWakeWordService::class.java).apply {
                    action = AtlasWakeWordService.ACTION_START
                    putExtra(AtlasWakeWordService.EXTRA_USE_ASSISTANT_SESSION, useAssistantSession)
                }
                try {
                    ContextCompat.startForegroundService(context, startIntent)
                } catch (e: Exception) {
                    call.reject("Failed to start wake-word service for overnight test: ${e.message}", e)
                    return
                }
            }
        }
        OvernightTestManager.startTest(context, isBaseline)
        call.resolve(JSObject.fromJSONObject(OvernightTestManager.getReport(context)))
    }

    @PluginMethod
    fun stopOvernightTest(call: PluginCall) {
        val wasBaseline = OvernightTestManager.isTestBaseline(context)
        OvernightTestManager.stopTest(context)
        if (!wasBaseline && AtlasWakeWordService.isServiceRunning) {
            val stopIntent = Intent(context, AtlasWakeWordService::class.java).apply {
                action = AtlasWakeWordService.ACTION_STOP
            }
            context.startService(stopIntent)
        }
        call.resolve(JSObject.fromJSONObject(OvernightTestManager.getReport(context)))
    }

    @PluginMethod
    fun getOvernightReport(call: PluginCall) {
        call.resolve(JSObject.fromJSONObject(OvernightTestManager.getReport(context)))
    }

    @PluginMethod
    fun exportOvernightCsv(call: PluginCall) {
        val csv = OvernightTestManager.generateCsv(context)
        call.resolve(JSObject().put("csv", csv))
    }

    @PluginMethod
    fun clearOvernightData(call: PluginCall) {
        OvernightTestManager.clear(context)
        call.resolve(JSObject.fromJSONObject(OvernightTestManager.getReport(context)))
    }

    @PluginMethod
    fun submitVoiceReply(call: PluginCall) {
        val sessionId = call.getString("sessionId")?.trim().orEmpty()
        val turnId = call.getString("turnId")?.trim().orEmpty()
        val replyText = call.getString("replyText") ?: ""
        val endSession = call.getBoolean("endSession", false) ?: false
        if (sessionId.isEmpty() || turnId.isEmpty()) {
            call.reject("sessionId and turnId are required.")
            return
        }
        AtlasWakeWordService.activeVoiceCoordinator?.submitJsReply(sessionId, turnId, replyText, endSession)
        call.resolve(JSObject().put("accepted", true))
    }

    @PluginMethod
    fun stopVoiceSession(call: PluginCall) {
        AtlasWakeWordService.activeVoiceCoordinator?.stopSession("Stopped from Atlas UI")
        call.resolve(JSObject.fromJSONObject(buildVoiceSessionStatusJson()))
    }

    @PluginMethod
    fun startManualVoiceSession(call: PluginCall) {
        val coord = AtlasWakeWordService.activeVoiceCoordinator
        if (coord == null || !AtlasWakeWordService.isServiceRunning) {
            call.reject("Wake-word service must be running to start a voice session.")
            return
        }
        coord.startManualSession()
        call.resolve(JSObject.fromJSONObject(buildVoiceSessionStatusJson()))
    }

    @PluginMethod
    fun getVoiceSessionStatus(call: PluginCall) {
        call.resolve(JSObject.fromJSONObject(buildVoiceSessionStatusJson()))
    }

    @PluginMethod
    fun setVoiceAssistantConfig(call: PluginCall) {
        call.getBoolean("voiceAssistantEnabled")?.let { enabled ->
            AtlasWakeWordService.voiceAssistantEnabled = enabled
        }
        call.getBoolean("allowOnlineSpeechFallback")?.let { allow ->
            AtlasWakeWordService.activeVoiceCoordinator?.setAllowOnlineSpeechFallback(allow)
        }
        call.getBoolean("greetOnWake")?.let { greet ->
            AtlasWakeWordService.activeVoiceCoordinator?.greetOnWake = greet
        }
        val hasConsent = call.data.has("cloudConsent")
        val hasProvider = call.data.has("cloudProvider")
        val hasKey = call.data.has("cloudApiKey")
        if (hasConsent || hasProvider || hasKey) {
            val secureStore = AtlasVoiceSecureStore(context)
            val current = secureStore.getPublicStatus()
            val consent = if (hasConsent) call.getBoolean("cloudConsent", false) == true else current.optBoolean("cloudConsent", false)
            val provider = call.getString("cloudProvider") ?: current.optString("cloudProvider", "gemini")
            val apiKey = if (hasKey) call.getString("cloudApiKey") else null
            secureStore.saveCloudConfig(consent, provider, apiKey)
            context.getSharedPreferences("atlas_voice_prefs", Context.MODE_PRIVATE)
                .edit()
                .remove("cloudApiKey")
                .remove("cloudConsent")
                .remove("cloudProvider")
                .apply()
        }
        call.resolve(JSObject.fromJSONObject(buildVoiceSessionStatusJson()))
    }

    @PluginMethod
    fun interruptVoiceSpeaking(call: PluginCall) {
        AtlasWakeWordService.activeVoiceCoordinator?.interruptSpeaking()
        call.resolve(JSObject.fromJSONObject(buildVoiceSessionStatusJson()))
    }

    @PluginMethod
    fun saveVoiceCloudConfig(call: PluginCall) {
        val secureStore = AtlasVoiceSecureStore(context)
        val current = secureStore.getPublicStatus()
        val consent = if (call.data.has("cloudConsent")) {
            call.getBoolean("cloudConsent", false) == true
        } else {
            current.optBoolean("cloudConsent", false)
        }
        val provider = call.getString("cloudProvider") ?: current.optString("cloudProvider", "gemini")
        val apiKey = if (call.data.has("cloudApiKey")) call.getString("cloudApiKey") else null
        secureStore.saveCloudConfig(consent, provider, apiKey)
        context.getSharedPreferences("atlas_voice_prefs", Context.MODE_PRIVATE)
            .edit()
            .remove("cloudApiKey")
            .remove("cloudConsent")
            .remove("cloudProvider")
            .apply()
        call.resolve(JSObject.fromJSONObject(secureStore.getPublicStatus()))
    }

    @PluginMethod
    fun getVoiceCloudStatus(call: PluginCall) {
        val status = AtlasVoiceSecureStore(context).getPublicStatus()
        call.resolve(JSObject.fromJSONObject(status))
    }

    @PluginMethod
    fun clearVoiceCloudKey(call: PluginCall) {
        val secureStore = AtlasVoiceSecureStore(context)
        secureStore.clearCloudApiKey()
        call.resolve(JSObject.fromJSONObject(secureStore.getPublicStatus()))
    }

    @PluginMethod
    fun getEncryptedMemories(call: PluginCall) {
        val memories = AtlasVoiceSecureStore(context).getEncryptedMemories()
        call.resolve(JSObject.fromJSONObject(JSONObject().put("memories", memories)))
    }

    @PluginMethod
    fun saveEncryptedMemories(call: PluginCall) {
        val arr = call.getArray("memories") ?: org.json.JSONArray()
        val jsonArr = JSONArray(arr.toString())
        AtlasVoiceSecureStore(context).saveEncryptedMemories(jsonArr)
        call.resolve(JSObject().put("saved", true))
    }

    @PluginMethod
    fun getVoicePersonality(call: PluginCall) {
        val personality = AtlasVoiceSecureStore(context).getPersonality() ?: JSONObject()
        call.resolve(JSObject.fromJSONObject(JSONObject().put("personality", personality)))
    }

    @PluginMethod
    fun saveVoicePersonality(call: PluginCall) {
        val obj = call.getObject("personality")
        if (obj == null) {
            call.reject("personality object is required.")
            return
        }
        AtlasVoiceSecureStore(context).savePersonality(JSONObject(obj.toString()))
        call.resolve(JSObject().put("saved", true))
    }

    @PluginMethod
    fun callSecureCloudAi(call: PluginCall) {
        val userText = call.getString("userText")?.trim().orEmpty()
        if (userText.isEmpty()) {
            call.reject("userText is required.")
            return
        }
        val providerOverride = call.getString("provider")
        val systemPromptOverride = call.getString("systemPrompt")
        val historyArr = call.getArray("history")
        val turns = mutableListOf<Pair<String, String>>()
        if (historyArr != null) {
            for (i in 0 until historyArr.length()) {
                val item = historyArr.optJSONObject(i) ?: continue
                val role = item.optString("role", "user")
                val text = item.optString("text", "").trim()
                if (text.isNotEmpty()) turns.add(role to text)
            }
        }
        turns.add("user" to userText)

        Thread({
            val (usedProvider, reply) = AtlasVoiceCoordinator.callSecureCloudAiSync(
                context = context,
                providerOverride = providerOverride,
                systemPromptOverride = systemPromptOverride,
                turns = turns
            )
            val result = JSObject()
                .put("ok", !reply.isNullOrBlank())
                .put("provider", usedProvider)
                .put("replyText", reply ?: "")
            call.resolve(result)
        }, "AtlasSecureCloudPlugin").start()
    }

    @PluginMethod
    fun getVoiceLatencyMetrics(call: PluginCall) {
        val json = AtlasWakeWordService.activeVoiceCoordinator?.getLatencyMetricsJson()
            ?: JSONObject()
                .put("wakeToGreetingMs", -1L)
                .put("greetingToListenMs", -1L)
                .put("speechEndToTranscriptMs", -1L)
                .put("transcriptToAiResponseMs", -1L)
                .put("aiResponseToFirstAudioMs", -1L)
                .put("sessionEndToWakeMs", -1L)
                .put("updatedAt", 0L)
        call.resolve(JSObject.fromJSONObject(json))
    }

    @PluginMethod
    fun consumePendingNativeReminders(call: PluginCall) {
        val prefs = context.getSharedPreferences("atlas_voice_prefs", Context.MODE_PRIVATE)
        val raw = prefs.getString("pendingRemindersJson", "[]") ?: "[]"
        prefs.edit().remove("pendingRemindersJson").apply()
        val arr = try {
            org.json.JSONArray(raw)
        } catch (_: Exception) {
            org.json.JSONArray()
        }
        call.resolve(JSObject.fromJSONObject(JSONObject().put("reminders", arr)))
    }

    @PluginMethod
    fun openOverlayPermissionSettings(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.fromParts("package", context.packageName, null)
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
                call.resolve(JSObject().put("opened", true))
                return
            }
        }
        openBatteryOptimizationSettings(call)
    }

    private fun buildVoiceSessionStatusJson(): JSONObject {
        val coord = AtlasWakeWordService.activeVoiceCoordinator
        val caps = coord?.getSpeechCapabilities() ?: AtlasVoiceSpeechManager(context).checkCapabilities()
        val overlayGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
        return JSONObject()
            .put("state", (coord?.state ?: AtlasVoiceCoordinator.State.IDLE).name)
            .put("sessionId", coord?.currentSessionId ?: JSONObject.NULL)
            .put("audioOwner", AtlasAudioOwnershipCoordinator.currentOwner.name)
            .put("voiceAssistantEnabled", AtlasWakeWordService.voiceAssistantEnabled)
            .put("greetOnWake", coord?.greetOnWake ?: true)
            .put("overlayPermissionGranted", overlayGranted)
            .put("onDeviceSpeechAvailable", caps.onDeviceAvailable)
            .put("systemSpeechAvailable", caps.systemRecognizerAvailable)
            .put("speechReason", caps.reason)
    }

    @PluginMethod
    fun requestNotificationPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            call.resolve(JSObject.fromJSONObject(buildListeningStatusJson(context)))
            return
        }
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED
        ) {
            call.resolve(JSObject.fromJSONObject(buildListeningStatusJson(context)))
            return
        }
        requestPermissionForAlias("notifications", call, "onNotificationPermissionResult")
    }

    @PermissionCallback
    private fun onNotificationPermissionResult(call: PluginCall) {
        call.resolve(JSObject.fromJSONObject(buildListeningStatusJson(context)))
    }

    @PluginMethod
    fun getAssistantRoleStatus(call: PluginCall) {
        call.resolve(JSObject.fromJSONObject(buildAssistantRoleStatusJson()))
    }

    @PluginMethod
    fun requestAssistantRole(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("RoleManager requires Android 10 (API 29) or higher.")
            return
        }
        val rm = context.getSystemService(Context.ROLE_SERVICE) as? RoleManager
        if (rm == null || !rm.isRoleAvailable(RoleManager.ROLE_ASSISTANT)) {
            call.reject("ROLE_ASSISTANT is not available on this device.")
            return
        }
        if (rm.isRoleHeld(RoleManager.ROLE_ASSISTANT)) {
            call.resolve(JSObject.fromJSONObject(buildAssistantRoleStatusJson()))
            return
        }
        val intent = rm.createRequestRoleIntent(RoleManager.ROLE_ASSISTANT)
        startActivityForResult(call, intent, "onAssistantRoleResult")
    }

    @ActivityCallback
    private fun onAssistantRoleResult(call: PluginCall?, @Suppress("UNUSED_PARAMETER") result: ActivityResult) {
        if (call == null) return
        call.resolve(JSObject.fromJSONObject(buildAssistantRoleStatusJson()))
    }

    @PluginMethod
    fun openAssistantSettings(call: PluginCall) {
        val candidates = listOf(
            Intent(Settings.ACTION_VOICE_INPUT_SETTINGS),
            Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS),
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", context.packageName, null)
            }
        )
        for (intent in candidates) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
                call.resolve(JSObject().put("opened", true))
                return
            }
        }
        call.reject("Could not open Android assistant settings.")
    }

    @PluginMethod
    fun openBatteryOptimizationSettings(call: PluginCall) {
        val candidates = mutableListOf<Intent>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            candidates.add(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }
        candidates.add(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", context.packageName, null)
            }
        )
        for (intent in candidates) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
                call.resolve(JSObject().put("opened", true))
                return
            }
        }
        call.reject("Could not open battery settings.")
    }

    private fun hasMicPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun buildAssistantRoleStatusJson(): JSONObject {
        var roleAvailable = false
        var roleHeld = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val rm = context.getSystemService(Context.ROLE_SERVICE) as? RoleManager
            if (rm != null) {
                roleAvailable = rm.isRoleAvailable(RoleManager.ROLE_ASSISTANT)
                roleHeld = rm.isRoleHeld(RoleManager.ROLE_ASSISTANT)
            }
        }
        return JSONObject()
            .put("roleAvailable", roleAvailable)
            .put("roleHeld", roleHeld)
            .put("voiceInteractionServiceBound", AtlasExperimentVoiceInteractionService.instance != null)
    }
}
