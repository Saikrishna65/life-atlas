package com.lifeatlas.app;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.atomic.AtomicBoolean;

/** Resolve only the selected, app-private, content-addressed, reviewed model. */
final class AtlasVerifiedModel {
    final File file;
    final String digest;
    final long size;
    private AtlasVerifiedModel(File file, String digest, long size) {
        this.file = file; this.digest = digest; this.size = size;
    }

    static AtlasVerifiedModel selected(Context context) throws Exception {
        String id = context.getSharedPreferences("atlas-model-selection", 0).getString("id", "");
        if (id == null || !id.matches("[a-z0-9-]{1,80}"))
            throw new IOException("Select an installed, reviewed model first.");
        JSONArray catalogue;
        try (InputStream in = context.getAssets().open("atlas-model-catalogue.json")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int count;
            while ((count = in.read(buffer)) != -1) {
                if (out.size() + count > 65536) throw new IOException("Invalid model catalogue");
                out.write(buffer, 0, count);
            }
            catalogue = new JSONArray(new String(out.toByteArray(), StandardCharsets.UTF_8));
        }
        for (int i = 0; i < catalogue.length(); i++) {
            JSONObject entry = catalogue.getJSONObject(i);
            if (!id.equals(entry.getString("id"))) continue;
            String hash = entry.getString("sha256");
            long size = entry.getLong("bytes");
            if (!hash.matches("[a-f0-9]{64}") || hash.matches("0+")
                    || !entry.getString("revision").matches("[a-f0-9]{40}")
                    || !entry.getString("filename").matches("[\\w.-]+\\.gguf")
                    || !entry.getString("repository").matches("[\\w.-]+/[\\w.-]+")
                    || entry.getString("license").isEmpty()
                    || !entry.getString("licenseUrl").startsWith("https://")
                    || !AtlasModelStoragePolicy.isSupportedSize(size))
                throw new IOException("Invalid reviewed model catalogue");
            File root = new File(context.getNoBackupFilesDir(), "atlas-models").getCanonicalFile();
            File file = new File(root, hash + ".gguf");
            if (!file.getCanonicalFile().equals(file) || !file.isFile() || file.length() != size)
                throw new IOException("Selected model is not installed or has an unexpected size.");
            return new AtlasVerifiedModel(file, hash, size);
        }
        throw new IOException("Selected model is not in the reviewed catalogue.");
    }

    void verify(AtomicBoolean canceled) throws Exception {
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        long received = 0;
        try (InputStream in = new FileInputStream(file)) {
            byte[] buffer = new byte[65536];
            int count;
            while ((count = in.read(buffer)) != -1) {
                if (canceled.get()) throw new IOException("Generation canceled");
                received += count;
                if (received > size) throw new IOException("Model integrity verification failed");
                sha.update(buffer, 0, count);
            }
        }
        StringBuilder hex = new StringBuilder(64);
        for (byte b : sha.digest()) hex.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
        if (received != size || !digest.equals(hex.toString()))
            throw new IOException("Model integrity verification failed");
        if (canceled.get()) throw new IOException("Generation canceled");
    }
}
