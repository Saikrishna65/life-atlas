package com.lifeatlas.app.r2;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.xml.parsers.DocumentBuilderFactory;
import org.json.*;
import org.w3c.dom.*;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.signer.Aws4Signer;
import software.amazon.awssdk.auth.signer.params.Aws4SignerParams;
import software.amazon.awssdk.http.*;
import software.amazon.awssdk.regions.Region;

/**
 * R2 REST transport with the official AWS SigV4 implementation. No presigned secrets enter the
 * WebView.
 */
public final class R2Client {
  public interface Progress {
    void bytes(long sent) throws Exception;
  }

  public interface Body {
    long length();

    InputStream open() throws Exception;
  }

  public static Body bytes(byte[] value) {
    return new Body() {
      public long length() {
        return value.length;
      }

      public InputStream open() {
        return new ByteArrayInputStream(value);
      }
    };
  }

  public static Body file(File file, long offset, long length) {
    return new Body() {
      public long length() {
        return length;
      }

      public InputStream open() throws Exception {
        FileInputStream in = new FileInputStream(file);
        in.getChannel().position(offset);
        return new FilterInputStream(in) {
          long left = length;

          public int read(byte[] b, int o, int n) throws IOException {
            if (left == 0) return -1;
            int count = super.read(b, o, (int) Math.min(n, left));
            if (count > 0) left -= count;
            return count;
          }

          public int read() throws IOException {
            if (left == 0) return -1;
            int value = super.read();
            if (value >= 0) left--;
            return value;
          }
        };
      }
    };
  }

  public static final class Response implements AutoCloseable {
    public final int status;
    public final Map<String, List<String>> headers;
    public final InputStream input;
    private final HttpURLConnection connection;

    Response(HttpURLConnection connection) throws IOException {
      this.connection = connection;
      status = connection.getResponseCode();
      headers = connection.getHeaderFields();
      InputStream body = status < 400 ? connection.getInputStream() : connection.getErrorStream();
      input = body == null ? new ByteArrayInputStream(new byte[0]) : body;
    }

    public String header(String key) {
      for (Map.Entry<String, List<String>> entry : headers.entrySet())
        if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(key))
          return String.join(",", entry.getValue());
      return "";
    }

    public byte[] read(int limit) throws IOException {
      return R2Io.read(input, limit);
    }

    public void close() {
      try {
        input.close();
      } catch (Exception ignored) {
      }
      connection.disconnect();
    }
  }

  private final R2Credentials credentials;

  public R2Client(R2Credentials credentials) {
    this.credentials = credentials;
  }

  public static SdkHttpFullRequest sign(
      String endpoint,
      String bucket,
      String key,
      String method,
      Map<String, String> query,
      Map<String, String> headers,
      Body body,
      String access,
      String secret)
      throws Exception {
    SdkHttpFullRequest.Builder builder =
        SdkHttpFullRequest.builder()
            .uri(URI.create(endpoint))
            .method(SdkHttpMethod.fromValue(method))
            .encodedPath("/" + bucket + (key.isEmpty() ? "" : "/" + R2Policy.path(key)));
    query.forEach(builder::putRawQueryParameter);
    headers.forEach(builder::putHeader);
    if (body != null)
      builder.contentStreamProvider(
          () -> {
            try {
              return body.open();
            } catch (Exception e) {
              throw new IllegalStateException("SOURCE_UNAVAILABLE");
            }
          });
    return Aws4Signer.create()
        .sign(
            builder.build(),
            Aws4SignerParams.builder()
                .awsCredentials(AwsBasicCredentials.create(access, secret))
                .signingName("s3")
                .signingRegion(Region.of("auto"))
                .doubleUrlEncode(false)
                .normalizePath(false)
                .build());
  }

  public Response request(
      String method,
      String key,
      Map<String, String> query,
      Map<String, String> headers,
      Body body,
      Progress progress)
      throws Exception {
    HttpURLConnection connection = null;
    try {
      SdkHttpFullRequest signed =
          sign(
              credentials.endpoint,
              credentials.bucket,
              key,
              method,
              query,
              headers,
              body,
              credentials.access,
              credentials.secret);
      connection = (HttpURLConnection) signed.getUri().toURL().openConnection();
      connection.setInstanceFollowRedirects(false);
      connection.setRequestMethod(method);
      connection.setConnectTimeout(20000);
      connection.setReadTimeout(60000);
      for (Map.Entry<String, List<String>> entry : signed.headers().entrySet())
        connection.setRequestProperty(entry.getKey(), String.join(",", entry.getValue()));
      if (body != null) {
        connection.setDoOutput(true);
        connection.setFixedLengthStreamingMode(body.length());
        try (InputStream input = body.open();
            OutputStream output = connection.getOutputStream()) {
          byte[] buffer = new byte[65536];
          int n;
          long sent = 0;
          while ((n = input.read(buffer)) != -1) {
            if (Thread.currentThread().isInterrupted())
              throw new R2Exception("TRANSFER_INTERRUPTED");
            output.write(buffer, 0, n);
            sent += n;
            if (progress != null) progress.bytes(sent);
          }
          if (sent != body.length()) throw new R2Exception("SOURCE_CHANGED");
        }
      }
      Response response = new Response(connection);
      if (response.status >= 200 && response.status < 300) return response;
      String remoteCode = "";
      try {
        remoteCode = text(xml(response.read(65536)), "Code");
      } catch (Exception ignored) {
      }
      String code =
          response.status == 401
                  || remoteCode.equals("SignatureDoesNotMatch")
                  || remoteCode.equals("InvalidAccessKeyId")
              ? "AUTHENTICATION_FAILED"
              : response.status == 403
                  ? "PERMISSION_DENIED"
                  : response.status == 404
                      ? (key.isEmpty() ? "BUCKET_NOT_FOUND" : "OBJECT_NOT_FOUND")
                      : response.status == 412
                          ? "CATALOG_CONFLICT"
                          : response.status == 429 || response.status >= 500
                              ? "REMOTE_TEMPORARY_FAILURE"
                              : "R2_REQUEST_REJECTED";
      response.close();
      throw new R2Exception(code);
    } catch (R2Exception error) {
      throw error;
    } catch (java.net.UnknownHostException
        | java.net.ConnectException
        | java.net.SocketTimeoutException error) {
      if (connection != null) connection.disconnect();
      throw new R2Exception("NETWORK_UNAVAILABLE");
    } catch (Exception error) {
      if (connection != null) connection.disconnect();
      throw new R2Exception("R2_REQUEST_FAILED");
    }
  }

  public static Document xml(byte[] value) throws Exception {
    // R2 replies are UTF-8 XML. Reject DTDs before parsing, including UTF-16
    // encodings that could bypass an ASCII check. Android DOM factories do
    // not consistently implement Xerces feature flags.
    for (byte b : value) if (b == 0) throw new R2Exception("INVALID_XML_RESPONSE");
    if (new String(value, StandardCharsets.UTF_8).contains("<!DOCTYPE"))
      throw new R2Exception("INVALID_XML_RESPONSE");
    DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
    factory.setNamespaceAware(false);
    factory.setExpandEntityReferences(false);
    javax.xml.parsers.DocumentBuilder parser = factory.newDocumentBuilder();
    parser.setEntityResolver(
        (publicId, systemId) -> new org.xml.sax.InputSource(new java.io.StringReader("")));
    return parser.parse(new ByteArrayInputStream(value));
  }

  static String text(Node node, String name) {
    NodeList list =
        node instanceof Document
            ? ((Document) node).getElementsByTagName(name)
            : ((Element) node).getElementsByTagName(name);
    return list.getLength() == 0 ? "" : list.item(0).getTextContent();
  }

  static String escape(String value) {
    return value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&apos;");
  }

  public JSONObject list(String prefix, String cursor) throws Exception {
    if (!prefix.isEmpty())
      R2Policy.key(prefix.endsWith("/") ? prefix.substring(0, prefix.length() - 1) : prefix);
    Map<String, String> query = new LinkedHashMap<>();
    query.put("list-type", "2");
    query.put("max-keys", "100");
    if (!prefix.isEmpty()) query.put("prefix", prefix);
    if (!cursor.isEmpty()) query.put("continuation-token", cursor);
    try (Response response = request("GET", "", query, Collections.emptyMap(), null, null)) {
      Document doc = xml(response.read(4 * 1024 * 1024));
      NodeList contents = doc.getElementsByTagName("Contents");
      JSONArray entries = new JSONArray();
      for (int i = 0; i < contents.getLength(); i++) {
        Node node = contents.item(i);
        entries.put(
            new JSONObject()
                .put("key", text(node, "Key"))
                .put("size", Long.parseLong(text(node, "Size")))
                .put("modifiedAt", text(node, "LastModified"))
                .put("etag", text(node, "ETag")));
      }
      return new JSONObject()
          .put("objects", entries)
          .put("cursor", text(doc, "NextContinuationToken"))
          .put("complete", !text(doc, "IsTruncated").equals("true"));
    }
  }

  public JSONObject head(String key) throws Exception {
    try (Response response =
        request("HEAD", key, Collections.emptyMap(), Collections.emptyMap(), null, null)) {
      JSONObject result =
          new JSONObject()
              .put("key", key)
              .put("size", Long.parseLong(response.header("Content-Length")))
              .put("mimeType", response.header("Content-Type"))
              .put("etag", response.header("ETag"));
      for (String field :
          new String[] {
            "sha256", "original-sha256", "name", "mime", "key-id", "encryption", "original-size"
          }) result.put(field, response.header("x-amz-meta-" + field));
      return result;
    }
  }

  public void delete(String key) throws Exception {
    try (Response ignored =
        request("DELETE", key, Collections.emptyMap(), Collections.emptyMap(), null, null)) {}
  }

  public String startMultipart(String key, Map<String, String> metadata) throws Exception {
    try (Response response =
        request(
            "POST",
            key,
            Collections.singletonMap("uploads", ""),
            metadata,
            bytes(new byte[0]),
            null)) {
      String id = text(xml(response.read(65536)), "UploadId");
      if (id.isEmpty()) throw new R2Exception("INVALID_MULTIPART_RESPONSE");
      return id;
    }
  }

  public String part(String key, String uploadId, int number, Body body, Progress progress)
      throws Exception {
    Map<String, String> query = new LinkedHashMap<>();
    query.put("uploadId", uploadId);
    query.put("partNumber", Integer.toString(number));
    try (Response response = request("PUT", key, query, Collections.emptyMap(), body, progress)) {
      String etag = response.header("ETag");
      if (etag.isEmpty()) throw new R2Exception("MISSING_PART_ETAG");
      return etag;
    }
  }

  public void complete(String key, String uploadId, JSONArray parts) throws Exception {
    StringBuilder body = new StringBuilder("<CompleteMultipartUpload>");
    for (int i = 0; i < parts.length(); i++) {
      JSONObject part = parts.getJSONObject(i);
      body.append("<Part><PartNumber>")
          .append(part.getInt("number"))
          .append("</PartNumber><ETag>")
          .append(escape(part.getString("etag")))
          .append("</ETag></Part>");
    }
    body.append("</CompleteMultipartUpload>");
    try (Response response =
        request(
            "POST",
            key,
            Collections.singletonMap("uploadId", uploadId),
            Collections.singletonMap("Content-Type", "application/xml"),
            bytes(body.toString().getBytes(StandardCharsets.UTF_8)),
            null)) {
      Document doc = xml(response.read(65536));
      if (!text(doc, "Code").isEmpty()) throw new R2Exception("MULTIPART_COMPLETION_FAILED");
    }
  }

  public void abort(String key, String uploadId) throws Exception {
    try (Response ignored =
        request(
            "DELETE",
            key,
            Collections.singletonMap("uploadId", uploadId),
            Collections.emptyMap(),
            null,
            null)) {}
  }
}
