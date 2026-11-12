package com.lifeatlas.app.r2;

import static org.junit.Assert.*;

import java.util.*;
import org.junit.Test;

public class R2PolicyTest {
  @Test
  public void endpointAndTokenBoundaries() {
    String id = "0123456789abcdef0123456789abcdef";
    assertEquals("https://" + id + ".r2.cloudflarestorage.com", R2Policy.endpoint(id, ""));
    for (String url :
        List.of(
            "http://" + id + ".r2.cloudflarestorage.com",
            "https://evil.example",
            "https://" + id + ".r2.cloudflarestorage.com@evil.example")) {
      try {
        R2Policy.endpoint(id, url);
        fail();
      } catch (IllegalArgumentException expected) {
      }
    }
  }

  @Test
  public void keyTraversalControlsAndMultipartBounds() {
    for (String key : List.of("a/../b", "a\\b", "a//b", "a/\n\n")) {
      try {
        R2Policy.key(key);
        fail();
      } catch (IllegalArgumentException expected) {
      }
    }
    assertTrue(R2Policy.partSize(500L * 1024 * 1024 * 1024) * 10000 >= 500L * 1024 * 1024 * 1024);
    assertEquals("NETWORK_UNAVAILABLE", R2Policy.safeError(new R2Exception("NETWORK_UNAVAILABLE")));
    assertEquals(
        "STORAGE_OPERATION_FAILED", R2Policy.safeError(new Exception("never echo a secret")));
  }

  @Test
  public void officialAwsSignerUsesR2ScopeAndPayload() throws Exception {
    String endpoint = "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com";
    var first =
        R2Client.sign(
            endpoint,
            "life-atlas-public",
            "galleries/originals/one.bin",
            "PUT",
            Map.of(),
            Map.of(),
            R2Client.bytes("original".getBytes()),
            "synthetic-access",
            "synthetic-secret-not-a-real-token");
    var second =
        R2Client.sign(
            endpoint,
            "life-atlas-private",
            "encrypted/files/one.atlasenc",
            "PUT",
            Map.of(),
            Map.of(),
            R2Client.bytes("different bytes".getBytes()),
            "separate-test-access",
            "separate-test-secret-not-real");
    assertTrue(
        first.firstMatchingHeader("Authorization").orElseThrow().contains("/auto/s3/aws4_request"));
    assertNotEquals(
        first.firstMatchingHeader("Authorization"), second.firstMatchingHeader("Authorization"));
    assertEquals("/life-atlas-public/galleries/originals/one.bin", first.encodedPath());
  }
}
