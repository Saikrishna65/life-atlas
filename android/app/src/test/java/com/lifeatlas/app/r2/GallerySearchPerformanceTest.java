package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
@GraphicsMode(GraphicsMode.Mode.LEGACY)
@SQLiteMode(SQLiteMode.Mode.LEGACY)
public class GallerySearchPerformanceTest {
  @Before
  public void reset() {
    GallerySearchHotCache.clear();
    GallerySearchHotCache.resume();
  }

  @After
  public void finish() {
    GallerySearchHotCache.clear();
  }

  private JSONObject row() throws Exception {
    JSONArray vector = new JSONArray();
    for (int i = 0; i < 512; i++) vector.put(i == 0 ? 1 : 0);
    return new JSONObject()
        .put("media", new JSONObject().put("id", "image:external:1"))
        .put("stamp", "version")
        .put("text", "mountain temple")
        .put("embedding", vector);
  }

  @Test
  public void unchangedRowsDoNotRepeatDecryptionOrJsonVectorConversion() throws Exception {
    AtomicInteger reads = new AtomicInteger();
    GallerySearchHotCache.Loader loader =
        () -> {
          reads.incrementAndGet();
          return row();
        };
    var first = GallerySearchHotCache.get("one", "photo", new byte[] {1}, false, loader);
    assertSame(first, GallerySearchHotCache.get("one", "photo", new byte[] {1}, false, loader));
    assertEquals(1, reads.get());
    assertEquals(512, first.vector.length);
    assertFalse(first.row.has("embedding"));
    GallerySearchHotCache.get("one", "photo", new byte[] {2}, false, loader);
    assertEquals(2, reads.get());
    GallerySearchHotCache.get("other", "photo", new byte[] {2}, false, loader);
    assertEquals(3, reads.get());
  }

  @Test
  public void idleAndBackgroundReleaseIndexMemory() throws Exception {
    GallerySearchHotCache.touch();
    GallerySearchHotCache.get("one", "photo", new byte[] {1}, false, this::row);
    assertTrue(GallerySearchHotCache.bytes() > 0);
    Shadows.shadowOf(android.os.Looper.getMainLooper()).idleFor(Duration.ofSeconds(31));
    assertEquals(0, GallerySearchHotCache.bytes());
    GallerySearchHotCache.suspend();
    GallerySearchHotCache.get("one", "photo", new byte[] {1}, false, this::row);
    assertEquals(0, GallerySearchHotCache.bytes());
  }

  @Test
  public void searchMemoryBudgetAdaptsWithoutGrowingBeyondTheExistingCap() {
    assertEquals(4L * 1024 * 1024, GallerySearchHotCache.budgetForHeap(64L * 1024 * 1024));
    assertEquals(8L * 1024 * 1024, GallerySearchHotCache.budgetForHeap(256L * 1024 * 1024));
    assertEquals(16L * 1024 * 1024, GallerySearchHotCache.budgetForHeap(512L * 1024 * 1024));
    assertEquals(GallerySearchHotCache.LIMIT, GallerySearchHotCache.budgetForHeap(Long.MAX_VALUE));
    assertEquals(4L * 1024 * 1024, GallerySearchHotCache.budgetForHeap(-1));
  }

  @Test
  public void cacheEvictsToItsMemoryBudget() throws Exception {
    String text = "x".repeat(100000);
    for (int i = 0; i < 100; i++)
      GallerySearchHotCache.get(
          "one", "photo" + i, new byte[] {1}, false, () -> row().put("text", text));
    assertTrue(GallerySearchHotCache.bytes() <= GallerySearchHotCache.budget());
  }
}
