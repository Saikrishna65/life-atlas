package com.lifeatlas.app.ai;

import android.content.Context;
import android.util.AtomicFile;
import java.io.*;
import java.util.*;
import org.json.*;

/** Bounded synthetic benchmark history. Custom conversations are deliberately not accepted. */
public final class AtlasLabHistory {
  private final File directory;

  public AtlasLabHistory(Context context) {
    directory = new File(context.getNoBackupFilesDir(), "atlas-benchmarks");
    directory.mkdirs();
  }

  public synchronized void save(JSONObject report) throws Exception {
    String id = report.getString("id");
    if (!id.matches("[a-f0-9-]{36}") || report.optInt("version") != 1)
      throw new IOException("Invalid report identity");
    JSONArray rows = report.getJSONArray("rows");
    if (rows.length() > 3000) throw new IOException("Too many report rows");
    for (int i = 0; i < rows.length(); i++)
      if ("custom".equals(rows.getJSONObject(i).optString("category")))
        throw new IOException("Custom prompts remain session-only; export explicitly instead");
    byte[] data = report.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    if (data.length > 4194304) throw new IOException("Report too large; export it instead");
    AtomicFile target = new AtomicFile(new File(directory, id + ".json"));
    FileOutputStream out = target.startWrite();
    try {
      out.write(data);
      target.finishWrite(out);
    } catch (Exception e) {
      target.failWrite(out);
      throw e;
    }
    File[] all = files();
    for (int i = 5; i < all.length; i++) new AtomicFile(all[i]).delete();
  }

  private File[] files() {
    File[] files = directory.listFiles((d, n) -> n.endsWith(".json"));
    if (files == null) return new File[0];
    Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
    return files;
  }

  public synchronized JSONArray list() throws Exception {
    JSONArray reports = new JSONArray();
    for (File file : files()) {
      if (file.length() > 4194304) continue;
      try (InputStream in = new FileInputStream(file)) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] b = new byte[8192];
        int n;
        while ((n = in.read(b)) != -1) {
          if (out.size() + n > 4194304) throw new IOException("Report too large");
          out.write(b, 0, n);
        }
        reports.put(new JSONObject(out.toString("UTF-8")));
      }
    }
    return reports;
  }

  public synchronized void clear() {
    for (File f : files()) new AtomicFile(f).delete();
  }
}
