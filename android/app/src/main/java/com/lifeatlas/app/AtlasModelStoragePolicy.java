package com.lifeatlas.app;

/** Download disk limits only; these do not certify inference RAM compatibility. */
final class AtlasModelStoragePolicy {
    // Permit reviewed multi-GB GGUF artifacts; never allow arbitrary URLs or digests.
    static final long MAX_MODEL_BYTES = 4_000_000_000L;
    static final long RESERVE_BYTES = 268_435_456L;

    private AtlasModelStoragePolicy() {}

    static boolean isSupportedSize(long bytes) {
        return bytes > 0 && bytes <= MAX_MODEL_BYTES;
    }

    /** Keep room for the current verified file and a staged replacement. */
    static long requiredFreeBytes(long bytes) {
        if (!isSupportedSize(bytes)) throw new IllegalArgumentException("Unsupported model size");
        return 2L * bytes + RESERVE_BYTES;
    }
}
