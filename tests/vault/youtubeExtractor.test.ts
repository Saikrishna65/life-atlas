/**
 * Life Atlas: YouTube Audio Extractor Automated Test Suite
 * Validates YouTube URL parsing, title cleaning, on-device 404 stream failover,
 * audio buffer generation, dual-persistence metadata creation, and playlist linking.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  extractYouTubeVideoId,
  parseYouTubeTitle,
  extractAudioFromYouTube,
} from "@/lib/music/youtubeExtractor";
import { extractAudioOnDevice, HttpAdapter } from "@/lib/music/clientYouTube";
import {
  deleteMusicDB,
  saveTrack,
  getTrack,
  savePlaylist,
  getPlaylist,
  addTrackToPlaylist,
} from "@/lib/music/storage";
import { MusicTrack, MusicPlaylist } from "@/lib/music/types";

describe("YouTube Audio Extractor & Playlist Integration", () => {
  beforeEach(async () => {
    await deleteMusicDB();
  });

  afterEach(async () => {
    await deleteMusicDB();
  });

  describe("1. YouTube URL & Video ID Parsing", () => {
    test("accurately extracts 11-character video IDs across all common formats", () => {
      // Standard watch URL
      assert.equal(
        extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
        "dQw4w9WgXcQ"
      );

      // Bare domain watch URL with ?si= share token (as shared from Android YouTube app)
      assert.equal(
        extractYouTubeVideoId("https://youtube.com/watch?v=x_MXZBmKJ4Y&si=UD8Qh8_6fbmw6"),
        "x_MXZBmKJ4Y"
      );

      // Short URL
      assert.equal(
        extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"),
        "dQw4w9WgXcQ"
      );

      // Mobile watch URL with timestamp
      assert.equal(
        extractYouTubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s"),
        "dQw4w9WgXcQ"
      );

      // YouTube Music URL
      assert.equal(
        extractYouTubeVideoId("https://music.youtube.com/watch?v=RLzC55ai0eo&feature=shared"),
        "RLzC55ai0eo"
      );

      // YouTube Shorts & Live URLs
      assert.equal(
        extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
        "dQw4w9WgXcQ"
      );
      assert.equal(
        extractYouTubeVideoId("https://www.youtube.com/live/dQw4w9WgXcQ?si=test"),
        "dQw4w9WgXcQ"
      );

      // Embed URL
      assert.equal(
        extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
        "dQw4w9WgXcQ"
      );

      // Android Share text string with surrounding sentence
      const sharedFromAndroid =
        "Listen to this track: https://youtu.be/dQw4w9WgXcQ?si=AbCdEfGhIjKlMnOp shared from YouTube";
      assert.equal(extractYouTubeVideoId(sharedFromAndroid), "dQw4w9WgXcQ");

      // Raw video ID
      assert.equal(extractYouTubeVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");

      // Non-video YouTube URLs & invalid input return null without false 11-char matches
      assert.equal(
        extractYouTubeVideoId("https://www.youtube.com/channel/UC1234567890123456"),
        null
      );
      assert.equal(
        extractYouTubeVideoId("https://www.youtube.com/@IndiaMarvelOfficial"),
        null
      );
      assert.equal(extractYouTubeVideoId("https://example.com/not-youtube"), null);
      assert.equal(extractYouTubeVideoId(""), null);
    });
  });

  describe("2. Title & Artist Parser", () => {
    test("cleans up video titles and extracts artist cleanly", () => {
      const parsed1 = parseYouTubeTitle(
        "Pink Floyd - Comfortably Numb (Official Music Video)",
        "Pink Floyd"
      );
      assert.equal(parsed1.artist, "Pink Floyd");
      assert.equal(parsed1.title, "Comfortably Numb");

      const parsed2 = parseYouTubeTitle(
        "Hans Zimmer : Time [Inception Soundtrack HD]",
        "Hans Zimmer - Topic"
      );
      assert.equal(parsed2.artist, "Hans Zimmer");
      assert.equal(parsed2.title, "Time");

      const parsed3 = parseYouTubeTitle("Mountain Solitude Live In Himalayas", "Trekker Records");
      assert.equal(parsed3.artist, "Trekker Records");
      assert.equal(parsed3.title, "Mountain Solitude Live In Himalayas");
    });
  });

  describe("3. On-Device 404 / FileNotFoundException Failover", () => {
    test("recovers from 404 / FileNotFoundException on primary stream and downloads fallback stream with visitorData", async () => {
      const audioPayload = Buffer.alloc(16384, 0x61).toString("base64");
      let sawVisitorIdHeader = false;

      const mockHttp: HttpAdapter = {
        get: (async (opts: { url: string }) => {
          if (opts.url.includes("sw.js_data")) {
            return {
              status: 200,
              data: ')]}\'\n[["CgtTestVisitorToken12345"]]',
              headers: {},
              url: opts.url,
            };
          }
          if (opts.url.includes("dead-stream.googlevideo.com")) {
            // Simulate Android HttpURLConnection throwing FileNotFoundException on empty 404 body
            throw new Error("java.io.FileNotFoundException: https://dead-stream.googlevideo.com/videoplayback");
          }
          if (opts.url.includes("live-stream.googlevideo.com")) {
            return {
              status: 200,
              data: audioPayload,
              headers: { "Content-Length": "16384" },
              url: opts.url,
            };
          }
          return { status: 404, data: "", headers: {}, url: opts.url };
        }) as HttpAdapter["get"],
        post: (async (opts: { url: string; headers?: Record<string, string> }) => {
          if (opts.headers?.["X-Goog-Visitor-Id"] === "CgtTestVisitorToken12345") {
            sawVisitorIdHeader = true;
          }
          return {
            status: 200,
            headers: {},
            url: opts.url,
            data: {
              playabilityStatus: { status: "OK" },
              videoDetails: {
                title: "Avengers: Doomsday - Main Theme (Official Audio)",
                author: "IndiaMarvel",
                lengthSeconds: "162",
              },
              streamingData: {
                adaptiveFormats: [
                  {
                    itag: 140,
                    mimeType: 'audio/mp4; codecs="mp4a.40.2"',
                    contentLength: "16384",
                    bitrate: 128000,
                    url: "https://dead-stream.googlevideo.com/videoplayback?itag=140",
                  },
                  {
                    itag: 251,
                    mimeType: 'audio/webm; codecs="opus"',
                    contentLength: "16384",
                    bitrate: 160000,
                    url: "https://live-stream.googlevideo.com/videoplayback?itag=251",
                  },
                ],
              },
            },
          };
        }) as HttpAdapter["post"],
      };

      const progressUpdates: number[] = [];
      const result = await extractAudioOnDevice(
        "x_MXZBmKJ4Y",
        (p) => progressUpdates.push(p),
        mockHttp
      );

      assert.equal(sawVisitorIdHeader, true);
      assert.equal(result.mimeType, "audio/webm");
      assert.equal(result.blob.size, 16384);
      assert.equal(result.duration, 162);
      assert.equal(result.title, "Main Theme");
      assert.equal(result.author, "Avengers: Doomsday");
      assert.ok(progressUpdates.length > 0);
    });
  });

  describe("4. Audio Extraction & Storage Persistence", () => {
    test("extracts audio buffer and saves YouTube track into Music Vault", async () => {
      const videoId = "test_vid_01";
      const audioResult = await extractAudioFromYouTube(videoId);

      assert.ok(audioResult.buffer);
      assert.ok(audioResult.size > 0);
      assert.equal(audioResult.format, "audio/mpeg");

      const ytTrack: MusicTrack = {
        id: `trk_yt_${videoId}_${Date.now()}`,
        title: "Echoes of Spiti",
        artist: "Mountain Folk",
        album: "YouTube Audio",
        genre: "YouTube",
        duration: 215,
        format: audioResult.format,
        size: audioResult.size,
        artworkUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        audioUrl: `/api/music/stream/trk_yt_${videoId}`,
        source: "DOWNLOADED",
        downloadStatus: "DOWNLOADED",
        downloadProgress: 100,
        isFavorite: false,
        playCount: 0,
        addedAt: Date.now(),
      };

      await saveTrack(ytTrack);

      const retrieved = await getTrack(ytTrack.id);
      assert.ok(retrieved);
      assert.equal(retrieved.title, "Echoes of Spiti");
      assert.equal(retrieved.artist, "Mountain Folk");
      assert.equal(retrieved.album, "YouTube Audio");
    });
  });

  describe("5. Target Playlist Association Flow", () => {
    test("prompts and adds extracted YouTube track into an existing playlist", async () => {
      // 1. Create target playlist
      const playlist: MusicPlaylist = {
        id: "pl_roadtrip_tunes",
        title: "Kashmir Roadtrip Tunes",
        trackIds: ["existing_t1"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await savePlaylist(playlist);

      // 2. Extracted YouTube track
      const newYtTrackId = "trk_yt_kashmir_01";
      const ytTrack: MusicTrack = {
        id: newYtTrackId,
        title: "Pahalgam Acoustic Session",
        artist: "Valley Strings",
        album: "YouTube Audio",
        genre: "Acoustic",
        duration: 190,
        format: "audio/mpeg",
        size: 3500000,
        source: "IMPORTED",
        isFavorite: true,
        playCount: 0,
        addedAt: Date.now(),
      };
      await saveTrack(ytTrack);

      // 3. Add to chosen playlist
      await addTrackToPlaylist("pl_roadtrip_tunes", newYtTrackId);

      const updatedPl = await getPlaylist("pl_roadtrip_tunes");
      assert.ok(updatedPl);
      assert.deepEqual(updatedPl.trackIds, ["existing_t1", "trk_yt_kashmir_01"]);
    });

    test("creates a brand new playlist on the fly for the extracted YouTube track", async () => {
      const newYtTrackId = "trk_yt_ladakh_02";
      const ytTrack: MusicTrack = {
        id: newYtTrackId,
        title: "Zanskar Drone Melody",
        artist: "Expedition Audio",
        album: "YouTube Audio",
        genre: "Cinematic",
        duration: 240,
        format: "audio/mpeg",
        size: 4200000,
        source: "DOWNLOADED",
        isFavorite: false,
        playCount: 0,
        addedAt: Date.now(),
      };
      await saveTrack(ytTrack);

      // Create new playlist on the fly
      const newCustomPlaylist: MusicPlaylist = {
        id: "pl_new_expedition_yt",
        title: "High Altitude Passes",
        description: "Created directly from YouTube video",
        trackIds: [newYtTrackId],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await savePlaylist(newCustomPlaylist);

      const retrievedPl = await getPlaylist("pl_new_expedition_yt");
      assert.ok(retrievedPl);
      assert.equal(retrievedPl.title, "High Altitude Passes");
      assert.deepEqual(retrievedPl.trackIds, [newYtTrackId]);
    });
  });
});
