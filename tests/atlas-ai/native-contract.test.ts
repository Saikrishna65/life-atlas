import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
test('native voice contract has no generic recognizer, online voice fallback or automatic model download',()=>{
 const source=readFileSync('android/app/src/main/java/com/lifeatlas/app/AtlasLocalAIPlugin.java','utf8');
 assert.ok(source.includes('createOnDeviceSpeechRecognizer'));
 assert.ok(!source.includes('SpeechRecognizer.createSpeechRecognizer('));
 assert.ok(source.includes('!voice.isNetworkConnectionRequired()'));
 assert.ok(source.includes('pendingPermissionEpoch'));
 assert.ok(source.includes('AUDIO_BECOMING_NOISY'));
 assert.ok(source.includes('handleOnPause()'));
 assert.ok(source.includes('"available", false'));
 assert.ok(!source.includes('HttpURLConnection'));
 const bridge=readFileSync('src/lib/atlas-ai/native.ts','utf8');
 assert.ok(bridge.includes("isPluginAvailable('BiometricAuthNative')"));
 assert.ok(!bridge.includes('authenticateWithDevice'));
});
