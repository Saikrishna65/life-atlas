package com.lifeatlas.app;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;

/** JNI contract. No model or prompt is sent over the network. */
final class AtlasLlamaNative {
    private static final boolean AVAILABLE;
    static {
        boolean loaded = false;
        try { System.loadLibrary("atlas_llama"); loaded = true; }
        catch (LinkageError | SecurityException ignored) { /* optional native build */ }
        AVAILABLE = loaded;
    }
    private AtlasLlamaNative() {}
    static boolean available() { return AVAILABLE; }
    interface BytesSink { boolean onBytes(byte[] bytes); }
    static native long create();
    static native void cancel(long handle);
    static native void release(long handle);
    static native void generate(long handle, byte[] path, byte[] prompt, int maxTokens, BytesSink sink);

    /** GGUF token pieces can split a UTF-8 character across multiple callbacks. */
    static final class Utf8Stream {
        private final CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPLACE).onUnmappableCharacter(CodingErrorAction.REPLACE);
        private byte[] tail = new byte[0];
        private boolean finished;
        private final Consumer<String> emit;
        Utf8Stream(Consumer<String> emit) { this.emit = emit; }
        void accept(byte[] bytes) { decode(bytes, false); }
        void finish() { decode(new byte[0], true); }
        private void decode(byte[] bytes, boolean end) {
            if (finished) throw new IllegalStateException("Stream finished");
            ByteBuffer input = ByteBuffer.allocate(tail.length + bytes.length);
            input.put(tail).put(bytes).flip();
            CharBuffer out = CharBuffer.allocate(Math.max(8, input.remaining() + 4));
            if (decoder.decode(input, out, end).isError()) throw new IllegalStateException("UTF-8 decode failed");
            if (end) { decoder.flush(out); finished = true; }
            tail = new byte[input.remaining()]; input.get(tail);
            out.flip(); if (out.hasRemaining()) emit.accept(out.toString());
        }
    }
}
