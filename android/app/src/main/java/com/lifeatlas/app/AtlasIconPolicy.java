package com.lifeatlas.app;

/** Allowlist shared by shortcut creation and launch routing. */
public final class AtlasIconPolicy {
    private AtlasIconPolicy() {}
    public static final String[] MODULES = {"atlas", "gallery", "music", "finance", "trips", "video"};
    public static boolean valid(String module) {
        for (String name : MODULES) if (name.equals(module)) return true;
        return false;
    }
    public static String route(String module) {
        if (module == null) return null;
        switch (module) {
            case "atlas": return "/secret";
            case "gallery": return "/secret/gallery";
            case "music": return "/secret/music";
            case "finance": return "/secret/finance";
            case "trips": return "/secret/vault";
            default: return null;
        }
    }
    public static String label(String module) {
        if (!valid(module)) throw new IllegalArgumentException("Choose an Atlas app");
        return "atlas".equals(module) ? "Atlas" : "Atlas " + Character.toUpperCase(module.charAt(0)) + module.substring(1);
    }
    public static void validateDesign(String style, String shape, String color, String source) {
        if (!("solid".equals(style) || "light".equals(style) || "outline".equals(style))
            || !("rounded".equals(shape) || "circle".equals(shape) || "square".equals(shape))
            || color == null || !color.matches("#[0-9a-fA-F]{6}")
            || !("photo".equals(source) || "preset".equals(source)))
            throw new IllegalArgumentException("Choose a valid icon design");
    }
    public static void validatePng(byte[] bytes) {
        byte[] signature = {(byte)137, 80, 78, 71, 13, 10, 26, 10};
        if (bytes == null || bytes.length < 24 || bytes.length > 1_500_000)
            throw new IllegalArgumentException("Choose a valid PNG icon");
        for (int i = 0; i < signature.length; i++) if (bytes[i] != signature[i])
            throw new IllegalArgumentException("Choose a valid PNG icon");
        if (bytes[12] != 73 || bytes[13] != 72 || bytes[14] != 68 || bytes[15] != 82)
            throw new IllegalArgumentException("Choose a valid PNG icon");
        java.nio.ByteBuffer header = java.nio.ByteBuffer.wrap(bytes);
        if (header.getInt(16) != 512 || header.getInt(20) != 512)
            throw new IllegalArgumentException("Icon must be 512 by 512 pixels");
    }
    public static String safeLabel(String value, String module) {
        String label = value == null ? label(module) : value.trim();
        if (label.isEmpty() || label.codePointCount(0, label.length()) > 32)
            throw new IllegalArgumentException("Use a name between 1 and 32 characters");
        for (int i = 0; i < label.length(); i++) {
            if (Character.isISOControl(label.charAt(i)) || Character.getType(label.charAt(i)) == Character.FORMAT)
                throw new IllegalArgumentException("Use a plain text icon name");
        }
        return label;
    }
}
