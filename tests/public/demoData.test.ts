import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  destinations,
  expeditions,
  timelineEvents,
  milestones,
} from "../../src/data/demo/expeditions";
import { memories, gallery } from "../../src/data/demo/memories";
import { artists, albums, tracks, playlists } from "../../src/data/demo/music";
import { conversations, workflows } from "../../src/data/demo/conversations";
import {
  transactions,
  financeSummary,
  openingBalancePaise,
} from "../../src/data/demo/finance";
import { reminders } from "../../src/data/demo/reminders";
import { activities } from "../../src/data/demo/activity";
import {
  searchRecords,
  formatDuration,
  groupBy,
} from "../../src/data/demo/selectors";
const datasets = {
  destinations,
  expeditions,
  timelineEvents,
  memories,
  gallery,
  playlists,
  tracks,
  albums,
  artists,
  conversations,
  workflows,
  activities,
  reminders,
  transactions,
  milestones,
};
const minimums = {
  destinations: 35,
  expeditions: 24,
  timelineEvents: 120,
  memories: 100,
  gallery: 150,
  playlists: 20,
  tracks: 200,
  albums: 35,
  artists: 45,
  conversations: 50,
  workflows: 25,
  activities: 100,
  reminders: 60,
  transactions: 120,
  milestones: 40,
};
const ids = (rows: { id: string }[]) => new Set(rows.map((row) => row.id));
const destinationIds = ids(destinations),
  expeditionIds = ids(expeditions),
  photoIds = ids(gallery),
  memoryIds = ids(memories),
  trackIds = ids(tracks),
  artistIds = ids(artists),
  albumIds = ids(albums),
  conversationIds = ids(conversations),
  eventIds = ids(timelineEvents);
for (const [name, rows] of Object.entries(datasets))
  test(`${name}: required volume, stable IDs and no duplicate records`, () => {
    assert.ok(
      rows.length >= minimums[name as keyof typeof minimums],
      `${name}: ${rows.length}`,
    );
    assert.equal(ids(rows).size, rows.length);
    assert.ok(
      rows.every((row) =>
        row.id.startsWith(
          name === "timelineEvents"
            ? "event-"
            : name === "destinations"
              ? "dest-"
              : name === "expeditions"
                ? "exp-"
                : name === "transactions"
                  ? "txn-"
                  : name === "gallery"
                    ? "photo-"
                    : name === "activities"
                      ? "activity-"
                      : name === "memories"
                        ? "memory-"
                        : `${name.replace(/s$/, "")}-`,
        ),
      ),
    );
  });
test("destinations have valid approximate coordinates, assets and reciprocal journey links", () => {
  for (const d of destinations) {
    assert.ok(d.latitude >= -90 && d.latitude <= 90);
    assert.ok(d.longitude >= -180 && d.longitude <= 180);
    assert.ok(d.expeditionIds.length > 0, d.name);
    assert.ok(existsSync(`public${d.image}`));
    assert.ok(d.coordinateNote.includes("Approximate"));
    for (const id of d.expeditionIds) {
      assert.ok(expeditionIds.has(id));
      assert.ok(
        expeditions.find((e) => e.id === id)!.destinationIds.includes(d.id),
      );
    }
    for (const id of d.timelineIds) assert.ok(eventIds.has(id));
    for (const id of d.galleryIds) assert.ok(photoIds.has(id));
  }
});
test("expeditions are complete and costs, days, routes and references agree", () => {
  for (const e of expeditions) {
    assert.equal(e.duration, e.itinerary.length);
    assert.equal(
      e.cost.total,
      e.cost.accommodation + e.cost.transport + e.cost.food + e.cost.activities,
    );
    assert.equal(e.cost.example, true);
    assert.deepEqual(
      e.route,
      e.destinationIds.map((id) => destinations.find((d) => d.id === id)!.name),
    );
    assert.deepEqual(
      e.itinerary.map((d) => d.day),
      Array.from({ length: e.duration }, (_, i) => i + 1),
    );
    for (const id of e.destinationIds) assert.ok(destinationIds.has(id));
    for (const id of e.galleryIds) assert.ok(photoIds.has(id));
    for (const id of e.memoryIds) assert.ok(memoryIds.has(id));
    for (const d of e.itinerary)
      assert.ok(e.destinationIds.includes(d.destinationId));
    assert.ok(e.packing.length >= 5);
    assert.ok(e.weather && e.transport && e.moments.length);
  }
});
test("timeline, milestones, archive and local gallery have no broken relationships", () => {
  for (const e of timelineEvents) {
    assert.ok(expeditionIds.has(e.expeditionId));
    assert.ok(destinationIds.has(e.destinationId));
    assert.ok(
      expeditions
        .find((x) => x.id === e.expeditionId)!
        .destinationIds.includes(e.destinationId),
    );
    assert.ok(Number.isFinite(Date.parse(e.date)));
  }
  for (const m of milestones) assert.ok(destinationIds.has(m.destinationId));
  for (const m of memories) {
    assert.ok(destinationIds.has(m.destinationId));
    m.photoIds.forEach((id) => assert.ok(photoIds.has(id)));
    m.expeditionIds.forEach((id) => assert.ok(expeditionIds.has(id)));
  }
  for (const p of gallery) {
    assert.ok(destinationIds.has(p.destinationId));
    assert.ok(p.illustrative);
    assert.ok(existsSync(`public${p.src}`));
    assert.ok(existsSync(`public${p.thumbnail}`));
  }
  assert.deepEqual(
    new Set(gallery.map((p) => p.orientation)),
    new Set(["portrait", "landscape"]),
  );
});
test("music catalog and playlist durations derive from real fixture relationships", () => {
  for (const a of albums) assert.ok(artistIds.has(a.artistId));
  for (const t of tracks) {
    assert.ok(albumIds.has(t.albumId));
    assert.ok(artistIds.has(t.artistId));
    assert.equal(albums.find((a) => a.id === t.albumId)!.artistId, t.artistId);
    assert.ok(t.duration > 0);
  }
  for (const p of playlists) {
    assert.equal(new Set(p.trackIds).size, p.trackIds.length);
    p.trackIds.forEach((id) => assert.ok(trackIds.has(id)));
    assert.equal(
      p.duration,
      p.trackIds.reduce(
        (n, id) => n + tracks.find((t) => t.id === id)!.duration,
        0,
      ),
    );
  }
});
test("conversations have authored responses and workflows reference the same topic", () => {
  assert.equal(
    new Set(conversations.map((c) => c.title)).size,
    conversations.length,
  );
  for (const c of conversations) {
    assert.equal(c.messages[0].role, "user");
    assert.equal(c.messages[1].role, "atlas");
    assert.ok(c.messages[1].text.length > 60);
  }
  for (const w of workflows) {
    assert.ok(conversationIds.has(w.conversationId));
    assert.equal(
      w.topic,
      conversations.find((c) => c.id === w.conversationId)!.topic,
    );
    assert.ok(w.steps.length >= 3);
  }
});
test("finance uses integer paise and every monthly running balance reconciles", () => {
  const annual = financeSummary();
  let balance = openingBalancePaise;
  for (let month = 1; month <= 12; month++) {
    const rows = transactions.filter(
      (t) => Number(t.date.slice(5, 7)) === month,
    );
    assert.equal(rows.length, 10);
    for (const t of rows) {
      assert.ok(Number.isSafeInteger(t.amountPaise) && t.amountPaise > 0);
      balance += t.direction === "in" ? t.amountPaise : -t.amountPaise;
    }
  }
  assert.equal(balance, annual.closingBalancePaise);
  assert.equal(annual.income, 12 * 8500000);
  assert.equal(
    annual.closingBalancePaise,
    openingBalancePaise + annual.income - annual.expenses,
  );
});
test("planning and activity point only to public demonstration records", () => {
  for (const r of reminders) {
    if (r.expeditionId) assert.ok(expeditionIds.has(r.expeditionId));
    assert.ok(Number.isFinite(Date.parse(r.date)));
  }
  const publicIds = new Set([
    ...ids(memories),
    ...ids(reminders),
    ...ids(transactions),
  ]);
  for (const a of activities) assert.ok(publicIds.has(a.recordId));
});
test("search matches all terms, grouping is lossless and duration formatting is exact", () => {
  assert.deepEqual(
    searchRecords(
      destinations,
      "japan city",
      (d) => `${d.country} ${d.category}`,
    ).map((d) => d.name),
    ["Tokyo", "Osaka"],
  );
  assert.deepEqual(
    searchRecords(destinations, "no-such-place", (d) => d.name),
    [],
  );
  assert.equal(
    Object.values(groupBy(memories, (m) => m.category)).flat().length,
    memories.length,
  );
  assert.equal(formatDuration(185), "3:05");
});

test("authored memories and timeline chapters offer varied content", () => {
  assert.equal(
    new Set(memories.map((m) => m.description)).size,
    memories.length,
  );
  assert.ok(new Set(timelineEvents.map((e) => e.title)).size >= 110);
});
