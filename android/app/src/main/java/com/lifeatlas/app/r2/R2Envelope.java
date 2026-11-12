package com.lifeatlas.app.r2;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.json.JSONObject;

/** Versioned metadata inside Tink authenticated ciphertext. The container is not a new cipher. */
public final class R2Envelope {
  private static final int MAGIC = 0x41545232;

  private R2Envelope() {}

  public static void encrypt(
      InputStream source,
      OutputStream destination,
      byte[] keyset,
      String objectKey,
      JSONObject metadata)
      throws Exception {
    byte[] header = metadata.toString().getBytes(StandardCharsets.UTF_8);
    if (header.length > 8192) throw new R2Exception("INVALID_MEDIA_METADATA");
    try (DataOutputStream output =
        new DataOutputStream(R2Crypto.encrypt(destination, keyset, objectKey))) {
      output.writeInt(MAGIC);
      output.writeInt(1);
      output.writeInt(header.length);
      output.write(header);
      MessageDigest hash = MessageDigest.getInstance("SHA-256");
      byte[] buffer = new byte[65536];
      long count = 0;
      int n;
      while ((n = source.read(buffer)) != -1) {
        if (Thread.currentThread().isInterrupted()) throw new R2Exception("TRANSFER_INTERRUPTED");
        output.write(buffer, 0, n);
        hash.update(buffer, 0, n);
        count += n;
      }
      if (count != metadata.getLong("size")
          || !R2Policy.hex(hash.digest()).equals(metadata.getString("sha256")))
        throw new R2Exception("SOURCE_CHANGED");
    }
  }

  public static JSONObject decrypt(
      InputStream source, OutputStream destination, byte[] keyset, String objectKey)
      throws Exception {
    try (DataInputStream input = new DataInputStream(R2Crypto.decrypt(source, keyset, objectKey))) {
      if (input.readInt() != MAGIC || input.readInt() != 1)
        throw new R2Exception("INVALID_ENCRYPTED_FILE");
      int length = input.readInt();
      if (length < 2 || length > 8192) throw new R2Exception("INVALID_ENCRYPTED_FILE");
      byte[] header = new byte[length];
      input.readFully(header);
      JSONObject metadata = new JSONObject(new String(header, StandardCharsets.UTF_8));
      long remaining = metadata.getLong("size");
      if (remaining < 0) throw new R2Exception("INVALID_ENCRYPTED_FILE");
      MessageDigest hash = MessageDigest.getInstance("SHA-256");
      byte[] buffer = new byte[65536];
      while (remaining > 0) {
        int n = input.read(buffer, 0, (int) Math.min(buffer.length, remaining));
        if (n < 0) throw new R2Exception("INTEGRITY_FAILED");
        destination.write(buffer, 0, n);
        hash.update(buffer, 0, n);
        remaining -= n;
      }
      if (input.read() != -1 || !R2Policy.hex(hash.digest()).equals(metadata.getString("sha256")))
        throw new R2Exception("INTEGRITY_FAILED");
      destination.flush();
      return metadata;
    } catch (R2Exception e) {
      throw e;
    } catch (Exception e) {
      throw new R2Exception("DECRYPTION_FAILED");
    }
  }
}
