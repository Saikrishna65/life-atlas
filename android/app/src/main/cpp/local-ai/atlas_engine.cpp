#include "atlas_engine.h"
#include "atlas_template.h"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <fstream>
#include <memory>
#include <stdexcept>
#include <vector>
namespace atlas {
using Clock = std::chrono::steady_clock;
static double ms(Clock::time_point a, Clock::time_point b = Clock::now()) {
  return std::chrono::duration<double, std::milli>(b - a).count();
}
Engine::Engine() {
  static std::once_flag once;
  std::call_once(once, [] { llama_backend_init(); });
}
Engine::~Engine() { release(); }
void Engine::release() {
  if (context_) {
    llama_free(context_);
    context_ = nullptr;
  }
  if (model_) {
    llama_model_free(model_);
    model_ = nullptr;
  }
  path_.clear();
}
static bool aborted(void *p) {
  return static_cast<std::atomic<bool> *>(p)->load();
}
static void check(bool condition, const char *message) {
  if (!condition)
    throw std::runtime_error(message);
}
Config Config::parse(const json &j) {
  Config c;
  for (const auto *key : {"threads", "context", "maxTokens", "batch", "topK",
                          "seed", "gpuLayers"}) {
    if (j.contains(key))
      check(j.at(key).is_number_integer(),
            "Integer configuration value required");
  }
  if (j.contains("seed"))
    check(j.at("seed").get<int64_t>() >= 0 &&
              j.at("seed").get<int64_t>() <= 4294967295LL,
          "Seed exceeds uint32 range");
  c.threads = j.value("threads", 4);
  c.context = j.value("context", 2048);
  c.maxTokens = j.value("maxTokens", 128);
  c.batch = j.value("batch", 128);
  c.temperature = j.value("temperature", .7f);
  c.topP = j.value("topP", .9f);
  c.topK = j.value("topK", 40);
  c.repetition = j.value("repetition", 1.1f);
  c.thinking = j.value("thinking", false);
  c.seed = j.value("seed", LLAMA_DEFAULT_SEED);
  c.chatTemplate = j.value("chatTemplate", std::string("model"));
  check(c.threads >= 1 && c.threads <= 8, "Threads must be 1..8");
  check(c.context >= 512 && c.context <= 4096,
        "Context must be 512..4096 tokens");
  check(c.maxTokens >= 1 && c.maxTokens <= 1024 && c.maxTokens < c.context,
        "Invalid response token budget");
  check(c.batch >= 1 && c.batch <= 512 && c.batch <= c.context,
        "Invalid batch size");
  check(std::isfinite(c.temperature) && c.temperature >= 0 &&
            c.temperature <= 2,
        "Invalid temperature");
  check(std::isfinite(c.topP) && c.topP > 0 && c.topP <= 1 && c.topK >= 1 &&
            c.topK <= 200,
        "Invalid top-p/top-k");
  check(std::isfinite(c.repetition) && c.repetition >= 1 && c.repetition <= 2,
        "Invalid repetition penalty");
  check(j.value("gpuLayers", 0) == 0,
        "This build provides CPU only; GPU offload is unavailable");
  check(c.chatTemplate == "model" || c.chatTemplate == "chatml" ||
            c.chatTemplate == "llama3" || c.chatTemplate == "gemma" ||
            c.chatTemplate == "qwen3" || c.chatTemplate == "lfm2" ||
            c.chatTemplate == "lfm3",
        "Unreviewed template override");
  return c;
}
void Engine::unload() {
  cancel();
  std::lock_guard<std::mutex> guard(mutex_);
  release();
}
void Engine::reset() {
  std::lock_guard<std::mutex> guard(mutex_);
  if (context_)
    llama_memory_clear(llama_get_memory(context_), true);
}
json Engine::load(const std::string &path, const Config &c) {
  std::lock_guard<std::mutex> guard(mutex_);
  release();
  check(!canceled_, "Model loading canceled");
  std::ifstream f(path, std::ios::binary);
  char magic[4] = {};
  f.read(magic, 4);
  check(f.gcount() == 4 && std::string(magic, 4) == "GGUF", "Not a GGUF model");
  const auto start = Clock::now();
  auto p = llama_model_default_params();
  p.n_gpu_layers = 0;
  p.load_mode = LLAMA_LOAD_MODE_MMAP;
  p.progress_callback = [](float, void *ptr) {
    return !static_cast<std::atomic<bool> *>(ptr)->load();
  };
  p.progress_callback_user_data = &canceled_;
  model_ = llama_model_load_from_file(path.c_str(), p);
  check(model_,
        canceled_
            ? "Model loading canceled"
            : "Model loading failed: architecture, memory or file integrity");
  try {
    auto cp = llama_context_default_params();
    cp.n_ctx = c.context;
    cp.n_batch = c.batch;
    cp.n_threads = c.threads;
    cp.n_threads_batch = c.threads;
    cp.abort_callback = aborted;
    cp.abort_callback_data = &canceled_;
    cp.no_perf = false;
    context_ = llama_init_from_model(model_, cp);
    check(context_, "Could not allocate inference context");
    char architecture[128] = {};
    llama_model_meta_val_str(model_, "general.architecture", architecture,
                             sizeof(architecture));
    architecture_ = architecture;
    const char *tmpl = llama_model_chat_template(model_, nullptr);
    check((tmpl && *tmpl) || c.chatTemplate != "model",
          "Model has no chat template; select a reviewed override");
    chatTemplate_ = tmpl ? tmpl : "";
    if (c.chatTemplate != "model" && c.chatTemplate != "qwen3" &&
        c.chatTemplate != "lfm2" && c.chatTemplate != "lfm3")
      chatTemplate_ = c.chatTemplate;
    check(!chatTemplate_.empty(),
          "Selected override requires model template metadata");
    check(!c.thinking ||
              chatTemplate_.find("enable_thinking") != std::string::npos,
          "This template has no reviewed thinking-mode control");
    check(
        !renderTemplate(chatTemplate_,
                        json::array({{{"role", "user"}, {"content", "Hello"}}}),
                        "", "", c.thinking)
             .empty(),
        "Chat template produced an empty prompt");
    path_ = path;
    config_ = c;
    loadMs_ = ms(start);
    return {{"state", "ready"},
            {"architecture", architecture_},
            {"context", c.context},
            {"modelBytes", llama_model_size(model_)},
            {"loadMs", loadMs_},
            {"backend", "cpu"},
            {"runtime", "llama.cpp:a6ac41c757c066941766164439f6876f2deaab04"}};
  } catch (...) {
    release();
    throw;
  }
}
static std::string takeUtf8(std::string &pending) {
  size_t complete = 0, i = 0;
  while (i < pending.size()) {
    const auto b = static_cast<unsigned char>(pending[i]);
    size_t n = b < 0x80             ? 1
               : (b & 0xe0) == 0xc0 ? 2
               : (b & 0xf0) == 0xe0 ? 3
               : (b & 0xf8) == 0xf0 ? 4
                                    : 0;
    check(n != 0, "Invalid generated UTF-8");
    if (i + n > pending.size())
      break;
    for (size_t j = 1; j < n; j++)
      check((static_cast<unsigned char>(pending[i + j]) & 0xc0) == 0x80,
            "Invalid generated UTF-8");
    i += n;
    complete = i;
  }
  auto result = pending.substr(0, complete);
  pending.erase(0, complete);
  return result;
}
json Engine::generate(
    const json &messages, const Config &c,
    const std::function<void(const std::string &)> &emit, bool structured,
    const std::function<void(const std::string &, double)> &stage) {
  std::lock_guard<std::mutex> guard(mutex_);
  check(model_ && context_, "No initialized model");
  check(!c.thinking ||
            chatTemplate_.find("enable_thinking") != std::string::npos,
        "This template has no reviewed thinking-mode control");
  check(c.context == config_.context,
        "Reload the model to change context size");
  check(messages.is_array() && messages.size() > 0 && messages.size() <= 32,
        "Expected 1..32 chat messages");
  check(!canceled_, "Generation canceled");
  const auto start = Clock::now();
  std::vector<std::string> roles, texts;
  size_t bytes = 0;
  for (const auto &m : messages) {
    auto role = m.at("role").get<std::string>();
    auto text = m.at("content").get<std::string>();
    check(role == "system" || role == "user" || role == "assistant",
          "Unsupported chat role");
    bytes += text.size();
    check(bytes <= 65536, "Chat exceeds input byte budget");
    roles.push_back(role);
    texts.push_back(text);
  }
  const auto *vocab = llama_model_get_vocab(model_);
  auto special = [&](llama_token token) {
    if (token < 0)
      return std::string();
    std::vector<char> text(256);
    int n =
        llama_token_to_piece(vocab, token, text.data(), text.size(), 0, true);
    return n > 0 ? std::string(text.data(), n) : std::string();
  };
  json bounded = messages;
  std::vector<llama_token> tokens;
  int count = 0, omitted = 0;
  while (true) {
    tokens.clear();
    const auto parts =
        renderTemplate(chatTemplate_, bounded, special(llama_vocab_bos(vocab)),
                       special(llama_vocab_eos(vocab)), c.thinking);
    bool first = true;
    for (const auto &part : parts) {
      if (part.text.empty())
        continue;
      std::vector<llama_token> piece(part.text.size() + 32);
      int n = llama_tokenize(vocab, part.text.data(), part.text.size(),
                             piece.data(), piece.size(), first, !part.input);
      if (n < 0) {
        piece.resize(-n);
        n = llama_tokenize(vocab, part.text.data(), part.text.size(),
                           piece.data(), piece.size(), first, !part.input);
      }
      check(n >= 0, "Prompt tokenization failed");
      tokens.insert(tokens.end(), piece.begin(), piece.begin() + n);
      first = false;
    }
    count = tokens.size();
    check(count > 0, "Empty tokenized prompt");
    if (count + c.maxTokens <= static_cast<int>(llama_n_ctx(context_)))
      break;
    // Drop only older conversation, retaining system instructions and the
    // latest request.
    const size_t oldest = bounded.at(0).at("role") == "system" ? 1 : 0;
    check(bounded.size() > oldest + 1,
          "Prompt and response exceed context; shorten the latest message or "
          "system instructions");
    if (bounded.size() > oldest + 2 &&
        bounded.at(oldest).at("role") == "user" &&
        bounded.at(oldest + 1).at("role") == "assistant") {
      bounded.erase(bounded.begin() + oldest + 1);
      omitted++;
    }
    bounded.erase(bounded.begin() + oldest);
    omitted++;
  }
  llama_memory_clear(llama_get_memory(context_), true);
  llama_set_n_threads(context_, c.threads, c.threads);
  llama_perf_context_reset(context_);
  if (stage)
    stage("promptProcessingStart", ms(start));
  const auto prefillStart = Clock::now();
  for (int i = 0; i < count; i += c.batch) {
    check(!canceled_, "Generation canceled");
    const auto size = std::min(c.batch, count - i);
    check(llama_decode(context_,
                       llama_batch_get_one(tokens.data() + i, size)) == 0,
          canceled_ ? "Generation canceled" : "Prompt evaluation failed");
  }
  const double prefill = ms(prefillStart);
  if (stage)
    stage("promptProcessingEnd", ms(start));
  std::unique_ptr<llama_sampler, decltype(&llama_sampler_free)> sampler(
      llama_sampler_chain_init(llama_sampler_chain_default_params()),
      llama_sampler_free);
  if (structured) {
    static const char *grammar = R"ATLASGBNF(root   ::= object
value  ::= object | array | string | number | ("true" | "false" | "null") ws

object ::=
  "{" ws (
            string ":" ws value
    ("," ws string ":" ws value)*
  )? "}" ws

array  ::=
  "[" ws (
            value
    ("," ws value)*
  )? "]" ws

string ::=
  "\"" (
    [^"\\\x7F\x00-\x1F] |
    "\\" (["\\bfnrt] | "u" [0-9a-fA-F]{4}) # escapes
  )* "\"" ws

number ::= ("-"? ([0-9] | [1-9] [0-9]{0,15})) ("." [0-9]+)? ([eE] [-+]? [0-9] [1-9]{0,15})? ws

# Optional space: by convention, applied in this grammar after literal chars when allowed
ws ::= | " " | "\n" [ \t]{0,20}
)ATLASGBNF";
    // Structured grammar is supplied from a reviewed local resource, never
    // model-generated code.
    auto *g = llama_sampler_init_grammar(vocab, grammar, "root");
    check(g, "Structured grammar unavailable");
    llama_sampler_chain_add(sampler.get(), g);
  }
  llama_sampler_chain_add(
      sampler.get(), llama_sampler_init_penalties(llama_vocab_n_tokens(vocab),
                                                  64, c.repetition, 0, 0));
  if (c.temperature == 0)
    llama_sampler_chain_add(sampler.get(), llama_sampler_init_greedy());
  else {
    llama_sampler_chain_add(sampler.get(), llama_sampler_init_top_k(c.topK));
    llama_sampler_chain_add(sampler.get(), llama_sampler_init_top_p(c.topP, 1));
    llama_sampler_chain_add(sampler.get(),
                            llama_sampler_init_temp(c.temperature));
    llama_sampler_chain_add(sampler.get(), llama_sampler_init_dist(c.seed));
  }
  int generated = 0;
  double first = 0, firstSentence = 0;
  std::string output, pending;
  const auto generationStart = Clock::now();
  for (int i = 0; i < c.maxTokens && !canceled_; i++) {
    auto token = llama_sampler_sample(sampler.get(), context_, -1);
    if (llama_vocab_is_eog(vocab, token))
      break;
    std::vector<char> piece(256);
    int size = llama_token_to_piece(vocab, token, piece.data(), piece.size(), 0,
                                    false);
    if (size < 0) {
      piece.resize(-size);
      size = llama_token_to_piece(vocab, token, piece.data(), piece.size(), 0,
                                  false);
    }
    check(size >= 0, "Token conversion failed");
    generated++;
    if (generated == 1 && stage)
      stage("firstGeneratedToken", ms(start));
    pending.append(piece.data(), size);
    const auto delta = takeUtf8(pending);
    if (!delta.empty()) {
      if (first == 0)
        first = ms(start);
      output += delta;
      if (firstSentence == 0 &&
          output.find_first_of(".!?\n") != std::string::npos)
        firstSentence = ms(start);
      emit(delta);
    }
    if (i + 1 < c.maxTokens && !canceled_) {
      int result = llama_decode(context_, llama_batch_get_one(&token, 1));
      if (canceled_)
        break;
      check(result == 0, "Token evaluation failed");
    }
  }
  const double generation = ms(generationStart);
  if (stage)
    stage(canceled_ ? "inferenceCanceled" : "generationComplete", ms(start));
  json metrics = {
      {"omittedMessages", omitted},
      {"promptTokens", count},
      {"generatedTokens", generated},
      {"promptMs", prefill},
      {"generationMs", generation},
      {"totalMs", ms(start)},
      {"loadMs", loadMs_},
      {"promptTokensPerSecond", prefill > 0 ? count * 1000 / prefill : 0},
      {"tokensPerSecond", generation > 0 ? generated * 1000 / generation : 0},
      {"backend", "cpu"}};
  metrics["firstTokenMs"] = first > 0 ? json(first) : json(nullptr);
  metrics["firstSentenceMs"] =
      firstSentence > 0 ? json(firstSentence) : json(nullptr);
  return {{"text", output},
          {"metrics", metrics},
          {"canceled", canceled_.load()},
          {"finishReason", canceled_                  ? "canceled"
                           : generated >= c.maxTokens ? "length"
                                                      : "stop"}};
}
} // namespace atlas
