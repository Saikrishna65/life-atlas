import test from "node:test";
import assert from "node:assert/strict";
import { processVoiceTurn } from "../src/lib/atlas-ai/voice-assistant";

const noopPlayer = () => ({
  playTrack: async () => {},
  pause: () => {},
  resume: () => {},
  nextTrack: () => {},
  currentTrack: null,
  isPlaying: false,
  queue: [],
  queueIndex: -1,
});

test("processVoiceTurn blocks private vault queries when phone is locked", async () => {
  const reply = await processVoiceTurn({
    sessionId: "s-locked-1",
    transcript: "What is my finance balance?",
    isLocked: true,
    player: noopPlayer,
    navigate: () => {},
  });
  assert.equal(reply.endSession, true);
  assert.equal(reply.actionExecuted, "privacy.locked_guard");
  assert.match(reply.replyText, /locked/i);
});

test("processVoiceTurn handles explicit stop commands", async () => {
  const reply = await processVoiceTurn({
    sessionId: "s-stop-1",
    transcript: "Go to sleep",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
  });
  assert.equal(reply.endSession, true);
  assert.equal(reply.actionExecuted, "session.end");
});

test("processVoiceTurn requires confirmation for sensitive mutations", async () => {
  const reply = await processVoiceTurn({
    sessionId: "s-sensitive-1",
    transcript: "Delete my trip itinerary",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
  });
  assert.equal(reply.actionExecuted, "action.confirmation_required");
  assert.match(reply.replyText, /confirm/i);
});

test("processVoiceTurn returns honest offline fallback when no LLM is loaded", async () => {
  const reply = await processVoiceTurn({
    sessionId: "s-offline-1",
    transcript: "Explain quantum entanglement",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
  });
  assert.equal(reply.actionExecuted, "fallback.offline");
  assert.match(reply.replyText, /offline/i);
});

test("processVoiceTurn navigates safely and ends session when asked to open a vault", async () => {
  let target = "";
  const reply = await processVoiceTurn({
    sessionId: "s-nav-1",
    transcript: "Open Music Vault",
    isLocked: false,
    player: noopPlayer,
    navigate: (href) => {
      target = href;
    },
  });
  assert.equal(target, "/secret/music");
  assert.equal(reply.actionExecuted, "navigate:music");
  assert.equal(reply.endSession, true);
});

test("processVoiceTurn computes simple arithmetic offline", async () => {
  const reply = await processVoiceTurn({
    sessionId: "s-math-1",
    transcript: "what is 25 plus 17?",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
  });
  assert.equal(reply.actionExecuted, "utility.math");
  assert.equal(reply.replyText, "That's 42.");
});
