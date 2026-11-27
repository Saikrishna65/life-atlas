import { test } from "node:test";
import assert from "node:assert/strict";
import { readTopic, VIDEO_TOPICS } from "../../src/lib/video/topics";
test("Discover accepts only explicit known topic IDs, never arbitrary stored queries or endpoints", () => {
  assert.equal(new Set(VIDEO_TOPICS.map((topic) => topic.id)).size, VIDEO_TOPICS.length);
  for (const topic of VIDEO_TOPICS) {
    assert.equal(readTopic(topic.id), topic);
    assert.ok(topic.query.length > 0 && topic.query.length <= 120);
  }
  for (const invalid of [undefined, null, {}, "", "TRAVEL", "my search history", "https://example.com", "__proto__"]) assert.equal(readTopic(invalid), null);
});
