#include "atlas_template.h"
#include "jinja/lexer.h"
#include "jinja/parser.h"
#include "jinja/runtime.h"
#include "json.h"
namespace atlas {
std::vector<PromptPart> renderTemplate(const std::string &source,
                                       const nlohmann::json &messages,
                                       const std::string &bos,
                                       const std::string &eos, bool thinking) {
  if (source.size() > 65536)
    throw std::runtime_error("Chat template exceeds budget");
  std::string actual = source;
  if (source == "chatml")
    actual = "{% for message in messages %}{{ '<|im_start|>' + message.role + "
             "'\\n' }}{{ message.content }}{{ '<|im_end|>\\n' }}{% endfor %}{{ "
             "'<|im_start|>assistant\\n' }}";
  else if (source == "llama3")
    actual = "{{ bos_token }}{% for message in messages %}{{ "
             "'<|start_header_id|>' + message.role + '<|end_header_id|>\\n\\n' "
             "}}{{ message.content }}{{ '<|eot_id|>' }}{% endfor %}{{ "
             "'<|start_header_id|>assistant<|end_header_id|>\\n\\n' }}";
  else if (source == "gemma")
    actual = "{{ bos_token }}{% for message in messages %}{{ '<start_of_turn>' "
             "}}{% if message.role == 'assistant' %}{{ 'model' }}{% else %}{{ "
             "'user' }}{% endif %}{{ '\\n' }}{{ message.content }}{{ "
             "'<end_of_turn>\\n' }}{% endfor %}{{ '<start_of_turn>model\\n' }}";
  jinja::lexer lexer;
  auto ast = jinja::parse_from_tokens(lexer.tokenize(actual));
  jinja::context ctx(actual);
  // Input marking prevents user content from being parsed as control/special
  // tokens.
  jinja::global_from_json(
      ctx, common_json::parse(nlohmann::json{{"messages", messages}}.dump()),
      true);
  jinja::global_from_json(ctx,
                          common_json::parse(nlohmann::json{
                              {"bos_token", bos},
                              {"eos_token", eos},
                              {"add_generation_prompt", true},
                              {"enable_thinking", thinking},
                              {"tools", nullptr}}.dump()),
                          false);
  jinja::runtime runtime(ctx);
  auto parts = runtime.gather_string_parts(runtime.execute(ast));
  std::vector<PromptPart> result;
  size_t total = 0;
  for (const auto &part : parts->val_str.parts) {
    total += part.val.size();
    if (total > 262144)
      throw std::runtime_error("Formatted prompt exceeds budget");
    result.push_back({part.val, part.is_input});
  }
  return result;
}
} // namespace atlas
