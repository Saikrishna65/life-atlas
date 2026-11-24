#include "atlas_engine.h"
#include <jni.h>
static atlas::Engine engine;
// Use standard UTF-8 rather than JNI modified UTF-8 (emoji and supplementary
// planes).
static std::string utf8(JNIEnv *env, jstring s) {
  if (!s)
    throw std::runtime_error("Missing JNI string");
  auto cls = env->FindClass("java/lang/String");
  auto method = env->GetMethodID(cls, "getBytes", "(Ljava/lang/String;)[B");
  auto encoding = env->NewStringUTF("UTF-8");
  auto bytes = (jbyteArray)env->CallObjectMethod(s, method, encoding);
  env->DeleteLocalRef(encoding);
  env->DeleteLocalRef(cls);
  if (env->ExceptionCheck() || !bytes)
    throw std::runtime_error("UTF-8 conversion failed");
  std::string out(env->GetArrayLength(bytes), '\0');
  env->GetByteArrayRegion(bytes, 0, out.size(),
                          reinterpret_cast<jbyte *>(out.data()));
  env->DeleteLocalRef(bytes);
  return out;
}
extern "C" JNIEXPORT void JNICALL
Java_com_lifeatlas_app_ai_AtlasLlamaNative_begin(JNIEnv *, jclass) {
  engine.begin();
}
static jstring jsonString(JNIEnv *env, const atlas::json &j) {
  return env->NewStringUTF(j.dump(-1, ' ', true).c_str());
}
static jstring failure(JNIEnv *env, const std::exception &e) {
  env->ThrowNew(env->FindClass("java/lang/IllegalStateException"), e.what());
  return nullptr;
}
extern "C" JNIEXPORT jstring JNICALL
Java_com_lifeatlas_app_ai_AtlasLlamaNative_load(JNIEnv *env, jclass,
                                                jstring path, jstring options) {
  try {
    return jsonString(env, engine.load(utf8(env, path),
                                       atlas::Config::parse(atlas::json::parse(
                                           utf8(env, options)))));
  } catch (const std::exception &e) {
    return failure(env, e);
  }
}
extern "C" JNIEXPORT jstring JNICALL
Java_com_lifeatlas_app_ai_AtlasLlamaNative_generate(JNIEnv *env, jclass,
                                                    jstring messages,
                                                    jstring options,
                                                    jboolean structured,
                                                    jobject sink) {
  try {
    auto cls = env->GetObjectClass(sink);
    auto method = env->GetMethodID(cls, "onToken", "(Ljava/lang/String;)V");
    if (!method)
      throw std::runtime_error("Token listener missing");
    auto result = engine.generate(
        atlas::json::parse(utf8(env, messages)),
        atlas::Config::parse(atlas::json::parse(utf8(env, options))),
        [&](const std::string &token) {
          auto json = jsonString(env, atlas::json{{"token", token}});
          env->CallVoidMethod(sink, method, json);
          env->DeleteLocalRef(json);
          if (env->ExceptionCheck()) {
            engine.cancel();
            env->ExceptionClear();
            throw std::runtime_error("Token listener failed");
          }
        },
        structured);
    env->DeleteLocalRef(cls);
    return jsonString(env, result);
  } catch (const std::exception &e) {
    return failure(env, e);
  }
}
extern "C" JNIEXPORT void JNICALL
Java_com_lifeatlas_app_ai_AtlasLlamaNative_cancel(JNIEnv *, jclass) {
  engine.cancel();
}
extern "C" JNIEXPORT void JNICALL
Java_com_lifeatlas_app_ai_AtlasLlamaNative_unload(JNIEnv *, jclass) {
  engine.unload();
}
extern "C" JNIEXPORT void JNICALL
Java_com_lifeatlas_app_ai_AtlasLlamaNative_reset(JNIEnv *, jclass) {
  engine.reset();
}
