#pragma once
#include "json.hpp"
#include <string>
#include <vector>
namespace atlas {
struct PromptPart {
  std::string text;
  bool input;
};
std::vector<PromptPart> renderTemplate(const std::string &source,
                                       const nlohmann::json &messages,
                                       const std::string &bos,
                                       const std::string &eos, bool thinking);
} // namespace atlas
