package com.lifeatlas.app.ai;

import static org.junit.Assert.*;

import android.content.Context;
import android.net.Uri;
import androidx.test.core.app.ApplicationProvider;
import java.io.*;
import java.util.concurrent.TimeUnit;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34, manifest = Config.NONE)
public class AtlasModelStoreTest {
  @Test
  public void importsStreamUnchangedBytesDedupeAndDetectTampering() throws Exception {
    Context context = ApplicationProvider.getApplicationContext();
    AtlasModelStore store = AtlasModelStore.get(context);
    File original =
        File.createTempFile("synthetic-gguf-storage-test-", ".gguf", context.getCacheDir());
    byte[] bytes = new byte[] {'G', 'G', 'U', 'F', 3, 0, 0, 0, 1, 2, 3, 4};
    try (FileOutputStream out = new FileOutputStream(original)) {
      out.write(bytes);
    }
    // Header fixture tests storage only; it is intentionally not an executable model.
    JSONObject imported =
        store
            .importFile(Uri.fromFile(original), "Synthetic storage fixture", true)
            .get(10, TimeUnit.SECONDS);
    String id = imported.getString("id");
    assertEquals(bytes.length, imported.getLong("bytes"));
    assertEquals(AtlasModelStore.hash(original), imported.getString("sha256"));
    JSONObject duplicate =
        store.importFile(Uri.fromFile(original), "Same bytes", true).get(10, TimeUnit.SECONDS);
    assertEquals(id, duplicate.getString("id"));
    File installed = store.verifiedFile(id);
    assertNotEquals(original.getAbsolutePath(), installed.getAbsolutePath());
    long stamp = installed.lastModified();
    try (RandomAccessFile file = new RandomAccessFile(installed, "rw")) {
      file.seek(11);
      file.writeByte(99);
    }
    installed.setLastModified(stamp + 2000);
    try {
      store.verifiedFile(id);
      fail("Tampered model must fail verification");
    } catch (IOException expected) {
    }
    try (FileInputStream in = new FileInputStream(original)) {
      assertEquals('G', in.read());
    }
    assertEquals(bytes.length, original.length());
    store.remove(id);
    assertTrue(original.isFile());
    original.delete();
  }

  @Test
  public void historyIsBoundedAndRejectsCustomPrompts() throws Exception {
    Context context = ApplicationProvider.getApplicationContext();
    AtlasLabHistory history = new AtlasLabHistory(context);
    history.clear();
    for (int i = 0; i < 6; i++)
      history.save(
          new JSONObject()
              .put("version", 1)
              .put("id", java.util.UUID.randomUUID().toString())
              .put("rows", new JSONArray()));
    assertEquals(5, history.list().length());
    try {
      history.save(
          new JSONObject()
              .put("version", 1)
              .put("id", java.util.UUID.randomUUID().toString())
              .put("rows", new JSONArray().put(new JSONObject().put("category", "custom"))));
      fail("Custom prompts must not persist automatically");
    } catch (IOException expected) {
    }
    history.clear();
    assertEquals(0, history.list().length());
  }
}
