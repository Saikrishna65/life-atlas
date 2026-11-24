package com.lifeatlas.app.ai;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.ContextWrapper;
import android.net.Uri;
import androidx.test.core.app.ApplicationProvider;
import java.io.*;
import java.net.*;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;

/** Synthetic byte fixtures verify storage/HTTP recovery, never claim model inference. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34, manifest = Config.NONE)
public class AtlasModelTransferTest {
  private AtlasModelStore store;
  private File root;
  private final byte[] bytes = new byte[] {'G', 'G', 'U', 'F', 3, 0, 0, 0, 1, 2, 3, 4};
  private final AtomicInteger opens = new AtomicInteger();
  private final AtomicLong free = new AtomicLong(1L << 32);
  private final Queue<HttpURLConnection> replies = new ConcurrentLinkedQueue<>();
  private String sha;

  @Before
  public void setup() throws Exception {
    Context base = ApplicationProvider.getApplicationContext();
    root = Files.createTempDirectory(base.getCacheDir().toPath(), "transfer-test-").toFile();
    Context isolated =
        new ContextWrapper(base) {
          @Override
          public File getNoBackupFilesDir() {
            return root;
          }
        };
    StringBuilder hash = new StringBuilder();
    for (byte value : MessageDigest.getInstance("SHA-256").digest(bytes))
      hash.append(String.format("%02x", value));
    sha = hash.toString();
    JSONObject entry =
        new JSONObject()
            .put("id", "fixture")
            .put("name", "Storage fixture")
            .put("repository", "fixture/storage")
            .put("revision", "a".repeat(40))
            .put("filename", "fixture.gguf")
            .put("bytes", bytes.length)
            .put("sha256", sha);
    store =
        new AtlasModelStore(
            isolated,
            new JSONArray().put(entry),
            new AtlasModelStore.DownloadEnvironment() {
              public boolean connected(boolean wifiOnly) {
                return true;
              }

              public long usableSpace(File dir) {
                return free.get();
              }

              public HttpURLConnection open(URL url) throws IOException {
                opens.incrementAndGet();
                HttpURLConnection reply = replies.poll();
                if (reply == null) throw new IOException("Unexpected request");
                return reply;
              }
            });
  }

  @After
  public void close() {
    if (store != null) store.closeForTests();
  }

  private HttpURLConnection reply(int status, byte[] body, String range) throws Exception {
    return new HttpURLConnection(new URL("https://huggingface.co/fixture")) {
      public void connect() {}

      public void disconnect() {}

      public boolean usingProxy() {
        return false;
      }

      public int getResponseCode() {
        return status;
      }

      public String getHeaderField(String key) {
        return "Content-Range".equals(key) ? range : null;
      }

      public InputStream getInputStream() {
        return new ByteArrayInputStream(body);
      }
    };
  }

  private File part() {
    return new File(root, "atlas-models/fixture.part");
  }

  private void failure(CompletableFuture<?> job) throws Exception {
    try {
      job.get(8, TimeUnit.SECONDS);
      fail("Expected failure");
    } catch (ExecutionException | CancellationException expected) {
    }
  }

  @Test
  public void interruptedBodyRetriesWithRangeAndVerifiesBytes() throws Exception {
    replies.add(reply(200, Arrays.copyOf(bytes, 5), null));
    HttpURLConnection resumed =
        reply(206, Arrays.copyOfRange(bytes, 5, bytes.length), "bytes 5-11/12");
    replies.add(resumed);
    store.download("fixture", true, true).get(8, TimeUnit.SECONDS);
    assertEquals("bytes=5-", resumed.getRequestProperty("Range"));
    assertEquals(2, opens.get());
    assertArrayEquals(bytes, Files.readAllBytes(store.verifiedFile("fixture").toPath()));
    assertFalse(part().exists());
  }

  @Test
  public void serverIgnoringRangeRestartsRatherThanAppending() throws Exception {
    Files.write(part().toPath(), Arrays.copyOf(bytes, 5));
    replies.add(reply(200, bytes, null));
    store.download("fixture", true, false).get(8, TimeUnit.SECONDS);
    assertEquals(sha, AtlasModelStore.hash(store.verifiedFile("fixture")));
  }

  @Test
  public void temporaryServerFailureRecoversAutomatically() throws Exception {
    replies.add(reply(503, new byte[0], null));
    replies.add(reply(200, bytes, null));
    store.download("fixture", true, false).get(8, TimeUnit.SECONDS);
    assertEquals(2, opens.get());
  }

  @Test
  public void checksumMismatchCannotInstallAndClearsBadPartial() throws Exception {
    byte[] corrupt = bytes.clone();
    corrupt[11] = 99;
    replies.add(reply(200, corrupt, null));
    failure(store.download("fixture", true, false));
    assertFalse(part().exists());
    assertFalse(store.file("fixture").exists());
    assertEquals("failed", store.transfer("fixture").getString("state"));
  }

  @Test
  public void lowStorageRetainsPartialThenRetrySucceeds() throws Exception {
    Files.write(part().toPath(), Arrays.copyOf(bytes, 5));
    free.set(1);
    failure(store.download("fixture", true, false));
    assertEquals(5, part().length());
    assertEquals(0, opens.get());
    free.set(1L << 32);
    replies.add(reply(206, Arrays.copyOfRange(bytes, 5, 12), "bytes 5-11/12"));
    store.download("fixture", true, false).get(8, TimeUnit.SECONDS);
    assertTrue(store.verifiedFile("fixture").isFile());
  }

  @Test
  public void cancelDuringScheduledRetryStopsRecoveryAndDiscardsOnlyPartial() throws Exception {
    replies.add(reply(503, new byte[0], null));
    CompletableFuture<?> job = store.download("fixture", true, false);
    long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
    while (!"retrying".equals(store.transfer("fixture").optString("state"))
        && System.nanoTime() < until) Thread.yield();
    assertEquals("retrying", store.transfer("fixture").optString("state"));
    store.cancel("fixture");
    failure(job);
    assertFalse(store.active());
    assertFalse(part().exists());
    assertEquals(1, opens.get());
    assertEquals("canceled", store.transfer("fixture").getString("state"));
  }

  @Test
  public void importProgressAndCancelCloseStreamWithoutDeletingSource() throws Exception {
    CountDownLatch reading = new CountDownLatch(1), release = new CountDownLatch(1);
    AtomicBoolean closed = new AtomicBoolean();
    Uri uri = Uri.parse("content://atlas-storage-fixture/source");
    InputStream source =
        new InputStream() {
          public int read() throws IOException {
            throw new IOException("Use buffered reads");
          }

          public int read(byte[] b, int offset, int length) throws IOException {
            reading.countDown();
            try {
              if (!release.await(5, TimeUnit.SECONDS)) throw new IOException("Test timed out");
            } catch (InterruptedException e) {
              throw new IOException(e);
            }
            throw new IOException("Closed by cancellation");
          }

          public void close() {
            closed.set(true);
            release.countDown();
          }
        };
    Shadows.shadowOf(ApplicationProvider.<Context>getApplicationContext().getContentResolver())
        .registerInputStream(uri, source);
    String id = store.startImport(uri, "Keep original", true);
    assertTrue(reading.await(3, TimeUnit.SECONDS));
    assertEquals("importing", store.transfer(id).getString("state"));
    store.cancel(id);
    long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
    while (store.active() && System.nanoTime() < until) Thread.yield();
    assertTrue(closed.get());
    assertFalse(store.active());
    assertEquals("canceled", store.transfer(id).getString("state"));
    assertFalse(new File(root, "atlas-models/" + id + ".part").exists());
  }
}
