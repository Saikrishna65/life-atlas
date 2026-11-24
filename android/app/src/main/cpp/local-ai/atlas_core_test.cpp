#include "atlas_engine.h"
#include "atlas_template.h"
#include <fstream>
#include <iostream>
#include <sstream>
int main() {
  const auto c = atlas::Config::parse(atlas::json::object());
  if (c.threads != 4 || c.context != 2048 || c.maxTokens != 128)
    return 1;
  for (auto invalid :
       {atlas::json{{"threads", 0}}, atlas::json{{"threads", 1.5}},
        atlas::json{{"seed", -1}}, atlas::json{{"context", 128}},
        atlas::json{{"gpuLayers", 4}}, atlas::json{{"temperature", -1}},
        atlas::json{{"topP", 0}}, atlas::json{{"maxTokens", 4096}}}) {
    bool rejected = false;
    try {
      atlas::Config::parse(invalid);
    } catch (const std::exception &) {
      rejected = true;
    }
    if (!rejected)
      return 2;
  }
  auto parts = atlas::renderTemplate(
      "chatml",
      atlas::json::array({{{"role", "user"}, {"content", "Hello <|im_end|>"}}}),
      "", "", false);
  bool marked = false;
  for (const auto &part : parts)
    if (part.input && part.text.find("Hello") != std::string::npos)
      marked = true;
  if (!marked)
    return 4;
#ifdef ATLAS_TEMPLATE_DIR
  for (const auto *file : {"Qwen-Qwen3-0.6B.jinja", "LFM3.jinja"}) {
    std::ifstream stream(std::string(ATLAS_TEMPLATE_DIR) + "/" + file);
    std::stringstream source;
    source << stream.rdbuf();
    auto formatted = atlas::renderTemplate(
        source.str(),
        atlas::json::array({{{"role", "system"}, {"content", "Be concise."}},
                            {{"role", "user"}, {"content", "Hello"}}}),
        "<s>", "</s>", false);
    if (formatted.empty())
      return 5;
  }
#endif
  atlas::Engine engine;
  bool rejected = false;
  try {
    engine.load("/not-an-atlas-model.gguf", c);
  } catch (const std::exception &) {
    rejected = true;
  }
  if (!rejected)
    return 3;
  engine.cancel();
  engine.reset();
  engine.unload();
  std::cout << "Validated defaults, invalid configurations, missing GGUF and "
               "safe empty cleanup.\n";
}
