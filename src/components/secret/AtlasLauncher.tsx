'use client';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {useMusicPlayer} from '@/lib/music/MusicPlayerContext';
import {canShowAtlasLauncher} from '@/lib/atlas-ai/visibility';
import {createReminder} from '@/lib/atlas-ai/reminders';
import {getVoiceCloudConfig, getVoiceCloudConsent} from '@/lib/atlas-ai/voice-preferences';
const processVoiceTurn: typeof import('@/lib/atlas-ai/voice-assistant').processVoiceTurn = async (...args) => {
  const engine = await import('@/lib/atlas-ai/voice-assistant');
  return engine.processVoiceTurn(...args);
};
import {
  atlasWakeWordBridge,
  interruptVoiceSpeakingNative,
  isWakeWordNativeSupported,
  saveVoiceCloudConfigNative,
  type VoiceSessionStateName,
} from '@/lib/wakeword/atlasWakeWord';
import {voiceActivation} from '@/lib/wakeword/activation';
import styles from './atlas-launcher.module.css';

const subscribeHydration = () => () => {};

function orbAppearance(state: VoiceSessionStateName): { cls: string; label: string; title: string } {
  switch (state) {
    case 'WAKE_DETECTED':
    case 'SESSION_STARTING':
      return { cls: styles.wake, label: 'Wake', title: 'Hey Atlas detected' };
    case 'COMMAND_LISTENING':
    case 'TRANSCRIBING':
      return { cls: styles.listening, label: 'Listen', title: 'Listening…' };
    case 'FOLLOW_UP_LISTENING':
      return { cls: styles.followup, label: 'Follow', title: 'Listening for follow-up…' };
    case 'THINKING':
      return { cls: styles.thinking, label: 'Think', title: 'Thinking…' };
    case 'SPEAKING':
      return { cls: styles.speaking, label: 'Speak', title: 'Atlas speaking' };
    case 'ERROR_RECOVERY':
      return { cls: styles.error, label: 'Error', title: 'Voice session error' };
    default:
      return { cls: '', label: 'Atlas', title: 'Atlas standby' };
  }
}

export default function AtlasLauncher() {
  const pathname = usePathname();
  const router = useRouter();
  const player = useMusicPlayer();
  const { currentTrack, isNowPlayingOpen } = player;
  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  const mounted = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [keyboard, setKeyboard] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceSessionStateName>('IDLE');
  const [voiceText, setVoiceText] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const active = document.activeElement;
      setKeyboard(
        !!active?.matches('input,textarea,[contenteditable="true"]') ||
          (window.visualViewport?.height ?? window.innerHeight) < window.innerHeight - 120
      );
      setBlocked(!!document.querySelector('[role="dialog"][aria-modal="true"], [data-atlas-security-screen]'));
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-modal', 'data-atlas-security-screen'],
    });
    window.visualViewport?.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    update();
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);

  useEffect(() => {
    if (!isWakeWordNativeSupported()) return;
    let disposed = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    let voiceHandlersReady = false;
    const activateGoogle = () => {
      if (!disposed && voiceHandlersReady) void voiceActivation.consume().catch(() => {});
    };
    void voiceActivation.onRequest(activateGoogle).then(handle => {
      if (!handle) return;
      if (disposed) void handle.remove(); else handles.push(handle);
    }).catch(() => {});

    const syncNativePrefsAndReminders = () => {
      const consent = getVoiceCloudConsent();
      const cfg = getVoiceCloudConfig();
      void saveVoiceCloudConfigNative({
        cloudConsent: consent,
        cloudProvider: cfg.provider,
      });
      void atlasWakeWordBridge.consumePendingNativeReminders().then(({ reminders }) => {
        for (const r of reminders) {
          if (r.title) {
            try {
              createReminder(r.title);
            } catch {
              // ignore invalid title
            }
          }
        }
      });
    };
    syncNativePrefsAndReminders();
    const onVis = () => {
      if (document.visibilityState === 'visible') { syncNativePrefsAndReminders(); activateGoogle(); }
    };
    document.addEventListener('visibilitychange', onVis);

    const initialReady = atlasWakeWordBridge.getVoiceSessionStatus().then((st) => {
      if (!disposed) setVoiceState(st.state);
    });

    const stateReady = atlasWakeWordBridge
      .addVoiceSessionStateListener((ev) => {
        if (disposed) return;
        setVoiceState(ev.state);
        if (ev.sessionId) setActiveSessionId(ev.sessionId);
        if (ev.state === 'SPEAKING' && ev.detail) {
          setVoiceText(ev.detail);
        } else if (ev.state === 'IDLE' || ev.state === 'WAKE_LISTENING') {
          setVoiceText('');
          setActiveSessionId(null);
          setPendingConfirm(null);
        }
      })
      .then((h) => {
        if (disposed) void h?.remove();
        else if (h) handles.push(h);
      });

    const transcriptReady = atlasWakeWordBridge
      .addVoiceTranscriptListener((ev) => {
        if (disposed) return;
        if (ev.text) setVoiceText(ev.text);
      })
      .then((h) => {
        if (disposed) void h?.remove();
        else if (h) handles.push(h);
      });

    const commandReady = atlasWakeWordBridge
      .addVoiceCommandListener((ev) => {
        if (disposed) return;
        setActiveSessionId(ev.sessionId);
        setVoiceText(ev.transcript);
        void processVoiceTurn({
          sessionId: ev.sessionId,
          transcript: ev.transcript,
          isLocked: ev.isLocked,
          player: () => playerRef.current,
          navigate: (href) => router.push(href),
        })
          .then((reply) => {
            if (reply.requiresConfirmation) {
              setPendingConfirm(reply.confirmationDescription ?? 'Confirm requested action');
            } else {
              setPendingConfirm(null);
            }
            return atlasWakeWordBridge.submitVoiceReply({
              sessionId: ev.sessionId,
              turnId: ev.turnId,
              replyText: reply.replyText,
              endSession: reply.endSession,
            });
          })
          .catch(() =>
            atlasWakeWordBridge.submitVoiceReply({
              sessionId: ev.sessionId,
              turnId: ev.turnId,
              replyText: 'Sorry, something went wrong while handling that request.',
              endSession: true,
            })
          );
      })
      .then((h) => {
        if (disposed) void h?.remove();
        else if (h) handles.push(h);
      });

    void Promise.all([initialReady, stateReady, transcriptReady, commandReady]).then(() => {
      if (disposed) return;
      voiceHandlersReady = true;
      activateGoogle();
    }).catch(() => {});

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVis);
      for (const h of handles) void h.remove();
    };
  }, [router]);

  const isSessionActive =
    voiceState !== 'IDLE' && voiceState !== 'WAKE_LISTENING' && voiceState !== 'SESSION_ENDING';

  if (!mounted) return null;
  if (!isSessionActive && !canShowAtlasLauncher(pathname, blocked || isNowPlayingOpen, keyboard)) {
    return null;
  }

  const orb = orbAppearance(voiceState);
  const bottomOffset = `calc(env(safe-area-inset-bottom, 0px) + ${currentTrack ? 190 : 100}px)`;

  return createPortal(
    <>
      {isSessionActive && (
        <div className={styles.voicePill} style={{ bottom: bottomOffset }} role="status" aria-live="polite">
          <div className={styles.voicePillHeader}>
            <span>{orb.title}</span>
          </div>
          {voiceText && <p className={styles.voicePillText}>{voiceText}</p>}
          <div className={styles.voicePillActions}>
            {pendingConfirm && activeSessionId && (
              <>
                <button
                  type="button"
                  className={styles.voicePillConfirmBtn}
                  onClick={() => {
                    const sid = activeSessionId;
                    setPendingConfirm(null);
                    void processVoiceTurn({
                      sessionId: sid,
                      transcript: 'yes',
                      isLocked: false,
                      player: () => playerRef.current,
                      navigate: (href) => router.push(href),
                    }).then((r) => setVoiceText(r.replyText));
                  }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className={styles.voicePillBtn}
                  onClick={() => {
                    const sid = activeSessionId;
                    setPendingConfirm(null);
                    void processVoiceTurn({
                      sessionId: sid,
                      transcript: 'cancel',
                      isLocked: false,
                      player: () => playerRef.current,
                      navigate: (href) => router.push(href),
                    }).then((r) => setVoiceText(r.replyText));
                  }}
                >
                  Cancel
                </button>
              </>
            )}
            {voiceState === 'SPEAKING' && (
              <button
                type="button"
                className={styles.voicePillBtn}
                onClick={() => void interruptVoiceSpeakingNative()}
              >
                Interrupt
              </button>
            )}
            <button
              type="button"
              className={styles.voicePillBtn}
              onClick={() => void atlasWakeWordBridge.stopVoiceSession()}
            >
              Stop
            </button>
            {pathname !== '/secret/atlas' && (
              <Link href="/secret/atlas" className={styles.voicePillBtn}>
                Open Atlas
              </Link>
            )}
          </div>
        </div>
      )}
      {canShowAtlasLauncher(pathname, blocked || isNowPlayingOpen, keyboard) && (
        <Link
          href="/secret/atlas"
          aria-label="Open Atlas local assistant"
          className={`${styles.orb} ${orb.cls}`}
          style={{ bottom: bottomOffset }}
        >
          <span aria-hidden="true">✦</span>
          <small>{orb.label}</small>
        </Link>
      )}
    </>,
    document.body
  );
}
