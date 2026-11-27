#include <jni.h>
#include "llama.h"
#include <algorithm>
#include <atomic>
#include <cstdint>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
struct Request { std::atomic<bool> canceled{false}; };
std::once_flag backend;
constexpr int context_limit = 2048;
constexpr int batch_limit = 128;

Request *request(jlong handle) {
    if (!handle) throw std::runtime_error("Invalid native request");
    return reinterpret_cast<Request *>(static_cast<intptr_t>(handle));
}
bool aborted(void *p) { return static_cast<Request *>(p)->canceled.load(); }
bool progress(float, void *p) { return !aborted(p); }
void quiet_log(enum ggml_log_level, const char *, void *) {}
void fail(JNIEnv *env, const char *message) {
    if (!env->ExceptionCheck()) {
        jclass cls = env->FindClass("java/lang/IllegalStateException");
        if (cls) env->ThrowNew(cls, message);
    }
}
std::string bytes(JNIEnv *env, jbyteArray input, int limit) {
    if (!input) throw std::runtime_error("Missing input");
    const auto size = env->GetArrayLength(input);
    if (size <= 0 || size > limit) throw std::runtime_error("Invalid input length");
    std::string value(size, '\0');
    env->GetByteArrayRegion(input, 0, size, reinterpret_cast<jbyte *>(&value[0]));
    if (env->ExceptionCheck() || value.find('\0') != std::string::npos)
        throw std::runtime_error("Invalid input bytes");
    return value;
}
void check(Request *r) {
    if (r->canceled.load()) throw std::runtime_error("Generation canceled");
}
}

extern "C" JNIEXPORT jlong JNICALL
Java_com_lifeatlas_app_AtlasLlamaNative_create(JNIEnv *env, jclass) {
    try { return static_cast<jlong>(reinterpret_cast<intptr_t>(new Request)); }
    catch (...) { fail(env, "Could not allocate native request"); return 0; }
}

extern "C" JNIEXPORT void JNICALL
Java_com_lifeatlas_app_AtlasLlamaNative_cancel(JNIEnv *, jclass, jlong handle) {
    if (handle) reinterpret_cast<Request *>(static_cast<intptr_t>(handle))->canceled.store(true);
}

// Java must release only after generation has returned and no cancel call can race.
extern "C" JNIEXPORT void JNICALL
Java_com_lifeatlas_app_AtlasLlamaNative_release(JNIEnv *, jclass, jlong handle) {
    delete reinterpret_cast<Request *>(static_cast<intptr_t>(handle));
}

extern "C" JNIEXPORT void JNICALL
Java_com_lifeatlas_app_AtlasLlamaNative_generate(JNIEnv *env, jclass, jlong handle,
        jbyteArray path, jbyteArray prompt, jint max_tokens, jobject sink) {
    try {
        auto *r = request(handle);
        check(r);
        auto file = bytes(env, path, 4096);
        auto text = bytes(env, prompt, 96000);
        if (!sink || max_tokens < 1 || max_tokens > 512)
            throw std::runtime_error("Invalid generation arguments");
        jclass cls = env->GetObjectClass(sink);
        jmethodID emit = env->GetMethodID(cls, "onBytes", "([B)Z");
        env->DeleteLocalRef(cls);
        if (!emit || env->ExceptionCheck()) return;

        std::call_once(backend, [] { llama_log_set(quiet_log, nullptr); llama_backend_init(); });
        auto mp = llama_model_default_params();
        mp.n_gpu_layers = 0;
        mp.use_mmap = true;
        mp.use_mlock = false;
        mp.progress_callback = progress;
        mp.progress_callback_user_data = r;
        std::unique_ptr<llama_model, decltype(&llama_model_free)> model(
            llama_model_load_from_file(file.c_str(), mp), llama_model_free);
        check(r);
        if (!model || llama_model_has_encoder(model.get()))
            throw std::runtime_error("Unsupported or unreadable GGUF model");

        const char *tmpl = llama_model_chat_template(model.get(), nullptr);
        if (!tmpl) throw std::runtime_error("Model has no chat template");
        const llama_chat_message message{"user", text.c_str()};
        int n = llama_chat_apply_template(tmpl, &message, 1, true, nullptr, 0);
        if (n <= 0 || n > 128000) throw std::runtime_error("Unsupported model chat template");
        std::vector<char> formatted(n + 1);
        n = llama_chat_apply_template(tmpl, &message, 1, true, formatted.data(), formatted.size());
        if (n <= 0 || n >= static_cast<int>(formatted.size()))
            throw std::runtime_error("Chat formatting failed");

        const auto *vocab = llama_model_get_vocab(model.get());
        std::vector<llama_token> tokens(context_limit);
        n = llama_tokenize(vocab, formatted.data(), n, tokens.data(), tokens.size(), true, true);
        if (n <= 0 || n + max_tokens > context_limit)
            throw std::runtime_error("Prompt exceeds local token budget");
        tokens.resize(n);
        auto cp = llama_context_default_params();
        cp.n_ctx = context_limit;
        cp.n_batch = batch_limit;
        cp.n_ubatch = batch_limit;
        cp.n_threads = 4;
        cp.n_threads_batch = 4;
        cp.abort_callback = aborted;
        cp.abort_callback_data = r;
        std::unique_ptr<llama_context, decltype(&llama_free)> ctx(
            llama_init_from_model(model.get(), cp), llama_free);
        if (!ctx) throw std::runtime_error("Not enough resources for local context");
        for (int offset = 0; offset < n; offset += batch_limit) {
            check(r);
            if (llama_decode(ctx.get(), llama_batch_get_one(tokens.data() + offset,
                    std::min(batch_limit, n - offset))) != 0) {
                check(r);
                throw std::runtime_error("Local prompt evaluation failed");
            }
        }
        std::unique_ptr<llama_sampler, decltype(&llama_sampler_free)> sampler(
            llama_sampler_init_greedy(), llama_sampler_free);
        if (!sampler) throw std::runtime_error("Could not create sampler");
        for (int i = 0; i < max_tokens; ++i) {
            check(r);
            auto token = llama_sampler_sample(sampler.get(), ctx.get(), -1);
            if (llama_vocab_is_eog(vocab, token)) break;
            std::vector<char> piece(256);
            int size = llama_token_to_piece(vocab, token, piece.data(), piece.size(), 0, false);
            if (size < 0 && size >= -16384) {
                piece.resize(-size);
                size = llama_token_to_piece(vocab, token, piece.data(), piece.size(), 0, false);
            }
            if (size < 0 || size > static_cast<int>(piece.size()))
                throw std::runtime_error("Token decoding failed");
            if (size > 0) {
                jbyteArray payload = env->NewByteArray(size);
                if (!payload) return;
                env->SetByteArrayRegion(payload, 0, size, reinterpret_cast<const jbyte *>(piece.data()));
                if (env->ExceptionCheck()) { env->DeleteLocalRef(payload); return; }
                jboolean keep = env->CallBooleanMethod(sink, emit, payload);
                env->DeleteLocalRef(payload);
                if (env->ExceptionCheck()) return;
                if (!keep) { r->canceled.store(true); check(r); }
            }
            if (i + 1 == max_tokens) break;
            if (llama_decode(ctx.get(), llama_batch_get_one(&token, 1)) != 0) {
                check(r);
                throw std::runtime_error("Local decoding failed");
            }
        }
        check(r);
    } catch (const std::exception &e) {
        fail(env, e.what());
    } catch (...) {
        fail(env, "Unexpected native inference failure");
    }
}
