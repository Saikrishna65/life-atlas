import com.lifeatlas.app.AtlasIconPolicy;
import java.util.Objects;
public class AtlasIconPolicyCheck {
    static void equal(Object value, Object expected) { if (!Objects.equals(value, expected)) throw new AssertionError(value + " != " + expected); }
    public static void main(String[] args) {
        equal(AtlasIconPolicy.route("atlas"), "/secret");
        equal(AtlasIconPolicy.route("gallery"), "/secret/gallery");
        equal(AtlasIconPolicy.route("music"), "/secret/music");
        equal(AtlasIconPolicy.route("finance"), "/secret/finance");
        equal(AtlasIconPolicy.route("trips"), "/secret/vault");
        equal(AtlasIconPolicy.route("video"), null); // Separate trusted package, never a WebView route.
        for (String invalid : new String[]{"../gallery", "https://evil.test", "com.other.app", "", null}) {
            equal(AtlasIconPolicy.valid(invalid), false); equal(AtlasIconPolicy.route(invalid), null);
        }
        equal(AtlasIconPolicy.safeLabel("  My photos  ", "gallery"), "My photos");
        equal(AtlasIconPolicy.safeLabel(null, "finance"), "Atlas Finance");
        equal(AtlasIconPolicy.safeLabel("🎵".repeat(32), "music"), "🎵".repeat(32));
        for (String invalid : new String[]{" ", "x".repeat(33), "Atlas\nGallery", "Atlas\u202eGallery"}) {
            boolean rejected = false;
            try { AtlasIconPolicy.safeLabel(invalid, "gallery"); } catch (IllegalArgumentException expected) { rejected = true; }
            equal(rejected, true);
        }
        AtlasIconPolicy.validateDesign("solid", "circle", "#285449", "photo");
        boolean badDesign = false;
        try { AtlasIconPolicy.validateDesign("remote", "square", "url(https://evil.test)", "photo"); }
        catch (IllegalArgumentException expected) { badDesign = true; }
        equal(badDesign, true);
        byte[] png = new byte[24];
        System.arraycopy(new byte[]{(byte)137,80,78,71,13,10,26,10}, 0, png, 0, 8);
        System.arraycopy(new byte[]{73,72,68,82}, 0, png, 12, 4);
        java.nio.ByteBuffer.wrap(png).putInt(16,512).putInt(20,512);
        AtlasIconPolicy.validatePng(png);
        for (byte[] invalid : new byte[][]{new byte[0], new byte[1_500_001], new byte[24]}) {
            boolean rejected = false;
            try { AtlasIconPolicy.validatePng(invalid); } catch (IllegalArgumentException expected) { rejected = true; }
            equal(rejected, true);
        }
        java.nio.ByteBuffer.wrap(png).putInt(16,32768);
        boolean dimensionsRejected = false;
        try { AtlasIconPolicy.validatePng(png); } catch (IllegalArgumentException expected) { dimensionsRejected = true; }
        equal(dimensionsRejected,true);
        System.out.println("PASS: native icon allowlist, routes, labels and unsafe input rejection");
    }
}
