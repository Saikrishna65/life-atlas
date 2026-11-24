#include "atlas_engine.h"
#include <csignal>
#include <iostream>
static atlas::Engine engine;
int main() {
  std::signal(SIGINT, [](int) { engine.cancel(); });
  std::string line;
  while (std::getline(std::cin, line)) {
    try {
      const auto request = atlas::json::parse(line);
      const auto kind = request.value("op", std::string("generate"));
      const auto config =
          atlas::Config::parse(request.value("options", atlas::json::object()));
      if (kind == "load") {
        engine.begin();
        std::cout << atlas::json{{"event", "loaded"},
                                 {"result",
                                  engine.load(request.at("path"), config)}}
                         .dump()
                  << std::endl;
      } else if (kind == "unload") {
        engine.unload();
        std::cout << "{\"event\":\"unloaded\"}" << std::endl;
      } else if (kind == "reset") {
        engine.reset();
        std::cout << "{\"event\":\"reset\"}" << std::endl;
      } else if (kind == "generate") {
        engine.begin();
        const auto result = engine.generate(
            request.at("messages"), config,
            [](const std::string &token) {
              std::cout
                  << atlas::json{{"event", "token"}, {"token", token}}.dump()
                  << std::endl;
            },
            request.value("structured", false));
        std::cout << atlas::json{{"event", "done"}, {"result", result}}.dump()
                  << std::endl;
      } else
        throw std::runtime_error("Unknown operation");
    } catch (const std::exception &error) {
      std::cout
          << atlas::json{{"event", "error"}, {"error", error.what()}}.dump()
          << std::endl;
    }
  }
}
