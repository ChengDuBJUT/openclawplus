/**
 * Cerebellum Configuration Wizard
 *
 * Interactive configuration for local AI (小脑)
 */

import chalk from "chalk";
import type { CerebellumConfig } from "../cerebellum/types.js";
import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import { getSetupStatus, autoSetup, createCerebellumKernel } from "../cerebellum/index.js";
import { extractCerebellumConfig } from "../cerebellum/types.js";
import { confirm, select, text } from "./configure.shared.js";

const CEREBELLUM_MODELS = [
  {
    name: "qwen2.5:0.5b",
    description: "Ultra-lightweight (0.5B) - Very fast, basic tasks",
    size: "~400MB",
  },
  { name: "qwen2.5:1.8b", description: "Lightweight (1.8B) - Fast, good balance", size: "~1.2GB" },
  { name: "qwen2.5:3b", description: "Small (3B) - Better quality, still fast", size: "" },
  { name: "llama3.2:1b", description: "Lightweight (1B) - Fast, multilingual", size: "~1.3GB" },
  { name: "gemma2:2b", description: "Small (2B) - Good quality", size: "~1.6GB" },
  { name: "phi3:mini", description: "Mini (3.8B) - Microsoft's small model", size: "~2.3GB" },
];

export async function promptCerebellumConfig(
  currentConfig: OpenClawConfig,
  _runtime: RuntimeEnv,
): Promise<OpenClawConfig> {
  const existingConfig = extractCerebellumConfig(currentConfig);

  console.log(chalk.bold("\n🧠 Cerebellum (Local AI) Configuration\n"));

  // Step 1: Enable/disable cerebellum
  const enableCerebellum = await confirm({
    message: "Enable Cerebellum (local AI)?",
    initialValue: existingConfig.enabled,
  });

  if (!enableCerebellum) {
    return {
      ...currentConfig,
      cerebellum: {
        enabled: false,
      },
    };
  }

  // Step 2: Select endpoint type
  const endpointType = await select<"local" | "api">({
    message: "Select Cerebellum endpoint",
    options: [
      { value: "local", label: "Local (Ollama)", hint: "Runs on your machine, free, private" },
      { value: "api", label: "API Endpoint", hint: "Custom Ollama/OpenAI-compatible endpoint" },
    ],
    initialValue: existingConfig.provider === "ollama" ? "local" : "api",
  });

  let provider = "ollama";
  let baseUrl = "http://127.0.0.1:11434";
  let apiKey = "";

  if (endpointType === "api") {
    // API endpoint configuration
    baseUrl =
      (await text({
        message: "Enter API base URL",
        initialValue:
          existingConfig.baseUrl !== "http://127.0.0.1:11434"
            ? existingConfig.baseUrl
            : "http://localhost:11434",
        placeholder: "http://localhost:11434",
      })) || "http://localhost:11434";

    provider = "openai-compatible";

    const needsApiKey = await confirm({
      message: "Does this endpoint require an API key?",
      initialValue: false,
    });

    if (needsApiKey) {
      apiKey =
        (await text({
          message: "Enter API key",
          placeholder: "sk-...",
        })) || "";
    }
  }

  // Step 3: Select model
  console.log(chalk.gray("\nAvailable models:"));
  const selectedModel = await select<string>({
    message: "Select a model",
    options: CEREBELLUM_MODELS.map((m) => ({
      value: m.name,
      label: m.name,
      hint: `${m.description} ${m.size}`.trim(),
    })),
    initialValue: existingConfig.model || "qwen2.5:0.5b",
  });

  // Step 4: Check environment and offer auto-setup
  console.log(chalk.gray("\nChecking environment..."));
  const status = await getSetupStatus(selectedModel);

  if (!status.ollamaInstalled || !status.ollamaRunning || !status.modelDownloaded) {
    console.log(chalk.yellow("\n⚠️  Environment not fully configured:"));
    if (!status.ollamaInstalled) {
      console.log(chalk.gray("  • Ollama not installed"));
    }
    if (!status.ollamaRunning) {
      console.log(chalk.gray("  • Ollama not running"));
    }
    if (!status.modelDownloaded) {
      console.log(chalk.gray(`  • Model ${selectedModel} not downloaded`));
    }

    const shouldAutoSetup = await confirm({
      message: "Run automatic setup?",
      initialValue: true,
    });

    if (shouldAutoSetup) {
      console.log(chalk.gray("\nRunning automatic setup..."));
      const setupResult = await autoSetup(selectedModel, {
        onProgress: (msg) => console.log(chalk.gray(msg)),
      });

      if (setupResult.success) {
        console.log(chalk.green("\n✓ Setup completed!"));
      } else {
        console.log(chalk.red("\n✗ Setup failed:"), setupResult.message);
        console.log(chalk.gray("You can retry later with: openclaw cb auto-setup"));
      }
    }
  }

  // Step 5: Test cerebellum
  const shouldTest = await confirm({
    message: "Test Cerebellum with a simple question?",
    initialValue: true,
  });

  if (shouldTest) {
    console.log(chalk.gray("\nTesting Cerebellum..."));

    const testConfig = {
      enabled: true,
      provider,
      model: selectedModel,
      baseUrl,
      apiKey: apiKey || undefined,
    };

    const kernel = createCerebellumKernel(testConfig);
    const response = await kernel.quickAnswer("What is 2+2?");

    if (response.success) {
      console.log(chalk.green("\n✓ Test successful!"));
      console.log(chalk.gray(`Response: ${response.text}`));
      console.log(chalk.gray(`Duration: ${response.durationMs}ms`));
    } else {
      console.log(chalk.red("\n✗ Test failed:"), response.error);
    }
  }

  // Build and return config
  const cerebellumConfig: CerebellumConfig = {
    enabled: true,
    provider,
    model: selectedModel,
    baseUrl,
    thresholds: {
      maxEstimatedTime: existingConfig.thresholds.maxEstimatedTime || 1200,
      maxComplexity: existingConfig.thresholds.maxComplexity || 4,
      minConfidence: existingConfig.thresholds.minConfidence || 0.7,
    },
    forceCerebellumFor: ["greeting", "status_check", "simple_qa", "scheduled_task"],
    forceCerebrumFor: ["code_generation", "complex_analysis", "multi_step_planning"],
    stats: {
      enabled: true,
      logPath: "~/.openclaw/cerebellum-stats.json",
    },
  };

  if (apiKey) {
    cerebellumConfig.apiKey = apiKey;
  }

  return {
    ...currentConfig,
    cerebellum: cerebellumConfig,
  };
}
