package com.lifeatlas.app.r2;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.Test;
import software.amazon.awssdk.http.SdkHttpFullRequest;

public class R2SigningTest {
  private SdkHttpFullRequest signed(String method, String key, R2Client.Body body) throws Exception {
    return R2Client.sign("https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
        "life-atlas-public", key, method, Collections.emptyMap(), Collections.emptyMap(), body,
        "synthetic-access-only", "synthetic-secret-only-not-a-real-token");
  }

  @Test public void bucketProbeHasS3PayloadHashAndAutoRegion() throws Exception {
    SdkHttpFullRequest request = signed("HEAD", "", null);
    assertEquals(R2Policy.digest(new byte[0]), request.firstMatchingHeader("x-amz-content-sha256").orElse(""));
    assertTrue(request.firstMatchingHeader("Authorization").orElse("").contains("/auto/s3/aws4_request"));
    assertEquals("/life-atlas-public", request.encodedPath());
  }

  @Test public void uploadsSignExactOriginalBytesWithoutAwsChunkedEncoding() throws Exception {
    byte[] original = "Original photo bytes — unchanged".getBytes(StandardCharsets.UTF_8);
    SdkHttpFullRequest request = signed("PUT", "galleries/one photo.jpg", R2Client.bytes(original));
    assertEquals(R2Policy.digest(original), request.firstMatchingHeader("x-amz-content-sha256").orElse(""));
    assertFalse(request.firstMatchingHeader("Content-Encoding").orElse("").contains("aws-chunked"));
    try(java.io.InputStream input=request.contentStreamProvider().get().newStream()) {
      assertArrayEquals(original, R2Io.read(input, 1024));
    }
  }

  @Test public void responseDiagnosticsContainFixedCodesOnly() {
    assertEquals("CLOCK_SKEW", R2Client.responseCode(403, "RequestTimeTooSkewed", false));
    assertEquals("AUTHENTICATION_FAILED", R2Client.responseCode(403, "SignatureDoesNotMatch", false));
    assertEquals("BUCKET_NOT_FOUND", R2Client.responseCode(404, "", true));
    assertEquals("OBJECT_NOT_FOUND", R2Client.responseCode(404, "", false));
    assertEquals("INVALID_ENDPOINT", R2Client.responseCode(301, "", true));
    assertEquals("PERMISSION_DENIED", R2Client.responseCode(403, "untrusted secret response", true));
    assertEquals("R2_REQUEST_REJECTED", R2Client.responseCode(400, "untrusted secret response", false));
  }
}
