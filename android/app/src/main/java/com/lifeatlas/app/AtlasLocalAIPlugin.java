package com.lifeatlas.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Set;

/** Foreground, explicitly requested voice only. No network recognizer fallback or model download. */
@CapacitorPlugin(name = "AtlasLocalAI", permissions = {
    @Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO})
})
public class AtlasLocalAIPlugin extends Plugin {
    private SpeechRecognizer recognizer;
    private TextToSpeech tts;
    private boolean ttsReady;
    private AudioManager audio;
    private AudioFocusRequest focus;
    private boolean hasFocus;
    private volatile String activeUtterance;
    private String voiceRequestId = "";
    private int voiceEpoch;
    private int pendingPermissionEpoch = -1;
    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        if (change < 0) getActivity().runOnUiThread(() -> stopInternal());
    };
    private final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { stopInternal(); }
    };

    @Override public void load() {
        audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        ContextCompat.registerReceiver(getContext(), noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), ContextCompat.RECEIVER_NOT_EXPORTED);
        getActivity().runOnUiThread(() -> {
            tts = new TextToSpeech(getContext(), status -> {
                ttsReady = status == TextToSpeech.SUCCESS;
                emit("idle", null, null);
            });
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { if (id.equals(activeUtterance)) emit("speaking", null, null); }
                @Override public void onDone(String id) { getActivity().runOnUiThread(() -> { if (id.equals(activeUtterance)) { activeUtterance = null; releaseFocus(); emit("idle", null, null); } }); }
                @Override public void onError(String id) { getActivity().runOnUiThread(() -> { if (id.equals(activeUtterance)) { activeUtterance = null; releaseFocus(); emit("error", null, "Offline speech playback failed."); } }); }
            });
        });
    }
    private boolean recognitionAvailable() {
        return Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext());
    }
    private Voice offlineVoice() {
        if (!ttsReady || tts == null) return null;
        Set<Voice> voices = tts.getVoices();
        if (voices == null) return null;
        String language = Locale.getDefault().getLanguage();
        for (Voice voice : voices) if (!voice.isNetworkConnectionRequired() && !voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) && voice.getLocale().getLanguage().equals(language)) return voice;
        return null;
    }
    private void emit(String state, String text, String error) {
        JSObject result = new JSObject().put("requestId", voiceRequestId).put("state", state);
        if (text != null) result.put("text", text);
        if (error != null) result.put("error", error);
        notifyListeners("voice", result);
    }
    private boolean acquireFocus() {
        if (audio == null) return false;
        int result;
        if (Build.VERSION.SDK_INT >= 26) {
            focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setOnAudioFocusChangeListener(focusListener).build();
            result = audio.requestAudioFocus(focus);
        } else result = audio.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
        hasFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        return hasFocus;
    }
    private void releaseFocus() {
        if (!hasFocus || audio == null) return;
        hasFocus = false;
        if (Build.VERSION.SDK_INT >= 26 && focus != null) audio.abandonAudioFocusRequest(focus);
        else audio.abandonAudioFocus(focusListener);
        focus = null;
    }
    private void stopInternal() {
        voiceEpoch++;
        activeUtterance = null;
        if (recognizer != null) { recognizer.cancel(); recognizer.destroy(); recognizer = null; }
        if (tts != null) tts.stop();
        releaseFocus();
        emit("idle", null, null);
    }
    @PluginMethod public void runtimeStatus(PluginCall call) {
        call.resolve(new JSObject().put("available", false).put("engine", "none").put("reason", "This build has no offline AI engine or verified model. Model downloads are unavailable. No prompts have left this device."));
    }
    @PluginMethod public void generate(PluginCall call) { call.reject("Local inference runtime unavailable. No synthetic or cloud response is substituted."); }
    @PluginMethod public void cancel(PluginCall call) { call.resolve(); }
    @PluginMethod public void unload(PluginCall call) { call.resolve(); }
    @PluginMethod public void voiceStatus(PluginCall call) {
        getActivity().runOnUiThread(() -> call.resolve(new JSObject().put("recognition", recognitionAvailable()).put("speech", offlineVoice() != null)
            .put("reason", "Offline recognition requires Android 12+ and an installed on-device recognizer. Speech requires a downloaded offline voice for the device language.")));
    }
    @PluginMethod public void listen(PluginCall call) {
        voiceRequestId = call.getString("requestId", "");
        if (!recognitionAvailable()) { call.reject("On-device speech recognition is unavailable. Online recognition will not be used."); return; }
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            if (pendingPermissionEpoch >= 0) { call.reject("A microphone permission request is already pending."); return; }
            pendingPermissionEpoch = voiceEpoch;
            requestPermissionForAlias("microphone", call, "microphoneResult"); return;
        }
        startListening(call);
    }
    @PermissionCallback private void microphoneResult(PluginCall call) {
        int expected = pendingPermissionEpoch; pendingPermissionEpoch = -1;
        if (expected < 0 || expected != voiceEpoch) { call.reject("Voice request canceled while the app was inactive. Retry from unlocked Atlas."); return; }
        if (getPermissionState("microphone") != PermissionState.GRANTED) { call.reject("Microphone permission denied. Type a message instead."); return; }
        startListening(call);
    }
    private void startListening(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!getActivity().hasWindowFocus()) { call.reject("Return to unlocked Atlas before starting the microphone."); return; }
            stopInternal();
            if (!recognitionAvailable() || Build.VERSION.SDK_INT < 31) { call.reject("Offline recognition unavailable."); return; }
            if (!acquireFocus()) { call.reject("Audio focus unavailable. Stop other playback and retry."); return; }
            try {
                final int epoch = voiceEpoch;
                recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle b) { if (epoch != voiceEpoch) return; emit("listening", null, null); }
                    @Override public void onBeginningOfSpeech() { if (epoch != voiceEpoch) return; emit("listening", null, null); }
                    @Override public void onRmsChanged(float rms) {}
                    @Override public void onBufferReceived(byte[] b) {}
                    @Override public void onEndOfSpeech() { if (epoch != voiceEpoch) return; emit("thinking", null, null); }
                    @Override public void onError(int code) { if (epoch != voiceEpoch) return; stopInternal(); emit("error", null, "Offline recognition failed (" + code + "). No online fallback was used."); }
                    @Override public void onResults(Bundle b) {
                        if (epoch != voiceEpoch) return;
                        ArrayList<String> results = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String text = results == null || results.isEmpty() ? "" : results.get(0);
                        stopInternal(); emit("idle", text, null);
                    }
                    @Override public void onPartialResults(Bundle b) {}
                    @Override public void onEvent(int event, Bundle b) {}
                });
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                recognizer.startListening(intent);
                emit("listening", null, null);
                call.resolve();
            } catch (Exception error) { stopInternal(); call.reject("Could not start on-device recognition.", error); }
        });
    }
    @PluginMethod public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text.trim().isEmpty() || text.length() > 4000) { call.reject("Speech text must contain 1–4000 characters."); return; }
        getActivity().runOnUiThread(() -> {
            if (!getActivity().hasWindowFocus()) { call.reject("Return to Atlas before starting speech."); return; }
            stopInternal(); Voice voice = offlineVoice();
            if (voice == null) { call.reject("No offline voice is installed for the device language. Online speech is disabled."); return; }
            if (!acquireFocus()) { call.reject("Audio focus unavailable."); return; }
            if (tts.setVoice(voice) == TextToSpeech.ERROR) { releaseFocus(); call.reject("Offline voice unavailable."); return; }
            activeUtterance = java.util.UUID.randomUUID().toString();
            if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, activeUtterance) == TextToSpeech.ERROR) { stopInternal(); call.reject("Offline speech failed."); }
            else call.resolve();
        });
    }
    @PluginMethod public void stopVoice(PluginCall call) { getActivity().runOnUiThread(() -> { stopInternal(); call.resolve(); }); }
    @Override protected void handleOnPause() { getActivity().runOnUiThread(this::stopInternal); }
    @Override protected void handleOnDestroy() {
        getContext().unregisterReceiver(noisy);
        getActivity().runOnUiThread(() -> { stopInternal(); if (tts != null) { tts.shutdown(); tts = null; } });
    }
}
