package com.lifeatlas.app;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicInteger;

/** Linux host smoke test of the same JNI entry points used by Android. */
public final class AtlasNativeSmoke {
    private static byte[] bytes(String text) { return text.getBytes(StandardCharsets.UTF_8); }
    private static String generate(String model, String prompt) {
        long handle = AtlasLlamaNative.create();
        if (handle == 0) throw new AssertionError("No native handle");
        StringBuilder result = new StringBuilder();
        AtlasLlamaNative.Utf8Stream stream = new AtlasLlamaNative.Utf8Stream(result::append);
        try {
            AtlasLlamaNative.generate(handle, bytes(model), bytes(prompt), 64, piece -> {
                stream.accept(piece);
                return true;
            });
            stream.finish();
            if (result.toString().trim().isEmpty()) throw new AssertionError("Empty model output");
            return result.toString();
        } finally { AtlasLlamaNative.release(handle); }
    }
    public static void main(String[] args) {
        if (args.length != 1 || !AtlasLlamaNative.available())
            throw new AssertionError("Native library and model required");
        String model = Path.of(args[0]).toAbsolutePath().toString();
        // Synthetic prompts only; no personal data or actual conversations.
        String[] prompts = {
            "What is 2 + 2? Give a short answer.",
            "You are Atlas, a friendly companion. Say hello in one short sentence.",
            "The user wants you to stop teasing them. Respond respectfully and briefly."
        };
        for (int i = 0; i < prompts.length; ++i)
            System.out.println("Case " + (i + 1) + ": " + generate(model, prompts[i]));
        long handle = AtlasLlamaNative.create();
        AtomicInteger callbacks = new AtomicInteger();
        try {
            boolean canceled = false;
            try {
                AtlasLlamaNative.generate(handle, bytes(model), bytes("Count slowly from one to twenty."), 64,
                    piece -> { callbacks.incrementAndGet(); return false; });
            } catch (IllegalStateException expected) {
                canceled = expected.getMessage().contains("canceled");
            }
            if (!canceled || callbacks.get() != 1) throw new AssertionError("Streaming cancellation failed");
        } finally { AtlasLlamaNative.release(handle); }
        long preCanceled = AtlasLlamaNative.create();
        try {
            AtlasLlamaNative.cancel(preCanceled);
            try {
                AtlasLlamaNative.generate(preCanceled, bytes(model), bytes("Hello"), 16,
                    piece -> { throw new AssertionError("Canceled request emitted tokens"); });
                throw new AssertionError("Pre-canceled request succeeded");
            } catch (IllegalStateException expected) {
                if (!expected.getMessage().contains("canceled")) throw expected;
            }
        } finally { AtlasLlamaNative.release(preCanceled); }
        System.out.println("PASS: real native output, repeated requests, streaming and pre-start cancellation.");
        System.out.println("Model response quality needs manual review; Android performance is not measured.");
    }
}
