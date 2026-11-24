#pragma once
#include "json.hpp"
#include "llama.h"
#include <atomic>
#include <functional>
#include <mutex>
#include <string>
namespace atlas {
using json = nlohmann::json;
struct Config {
  int threads = 4, context = 2048, maxTokens = 128, batch = 128, topK = 40;
  float temperature = .7f, topP = .9f, repetition = 1.1f;
  bool thinking = false;
  uint32_t seed = LLAMA_DEFAULT_SEED;
  std::string chatTemplate = "model";
  static Config parse(const json &j);
};
class Engine {
  llama_model *model_ = nullptr;
  llama_context *context_ = nullptr;
  std::atomic<bool> canceled_{false};
  std::mutex mutex_;
  Config config_;
  std::string path_, architecture_, chatTemplate_;
  double loadMs_ = 0;
  void release();

public:
  Engine();
  ~Engine();
  json load(const std::string &path, const Config &config);
  json
  generate(const json &messages, const Config &config,
           const std::function<void(const std::string &)> &emit,
           bool structured = false,
           const std::function<void(const std::string &, double)> &stage = {});
  void begin() { canceled_.store(false); }
  void cancel() { canceled_.store(true); }
  void unload();
  void reset();
};
} // namespace atlas
