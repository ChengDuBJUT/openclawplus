/**
 * OpenClawPlus Cerebellum CLI Commands
 *
 * 小脑模块 CLI 命令
 */

import type { Command } from "commander";
import chalk from "chalk";
import {
  createCerebellumKernel,
  createDualKernelRouter,
  createTaskEvaluator,
  extractCerebellumConfig,
  getSetupStatus,
  autoSetup,
} from "../cerebellum/index.js";
import { loadConfig } from "../config/config.js";

export function registerCerebellumCommands(program: Command): void {
  const cerebellumCmd = program
    .command("cerebellum")
    .alias("cb")
    .description("Cerebellum (local AI) management commands");

  // Status command
  cerebellumCmd
    .command("status")
    .description("Check cerebellum status")
    .action(async () => {
      const config = loadConfig();
      const cerebellumConfig = extractCerebellumConfig(config);

      console.log(chalk.bold("\n🧠 Cerebellum (Local AI) Status\n"));

      if (!cerebellumConfig.enabled) {
        console.log(chalk.yellow("Status: DISABLED"));
        console.log(chalk.gray("Enable it in your config: cerebellum.enabled = true\n"));
        return;
      }

      console.log(chalk.green("Status: ENABLED"));
      console.log(chalk.gray(`Model: ${cerebellumConfig.model}`));
      console.log(chalk.gray(`Provider: ${cerebellumConfig.provider}`));
      console.log(chalk.gray(`Base URL: ${cerebellumConfig.baseUrl}`));

      // Check availability
      const kernel = createCerebellumKernel(cerebellumConfig);
      const status = await kernel.getStatus();

      console.log(
        chalk.gray(
          `\nOllama Available: ${status.available ? chalk.green("Yes") : chalk.red("No")}`,
        ),
      );
      console.log(
        chalk.gray(
          `Model Available: ${status.modelAvailable ? chalk.green("Yes") : chalk.red("No")}`,
        ),
      );

      if (!status.available) {
        console.log(
          chalk.yellow(
            "\n⚠️  Ollama is not running. Run `openclaw cb auto-setup` to configure automatically.",
          ),
        );
      } else if (!status.modelAvailable) {
        console.log(
          chalk.yellow(
            `\n⚠️  Model ${cerebellumConfig.model} not found. Run \`openclaw cb pull\` to download.`,
          ),
        );
      }

      // Show stats
      const router = createDualKernelRouter({ config: cerebellumConfig });
      const stats = await router.getStats();

      if (stats.totalRequests > 0) {
        console.log(chalk.bold("\n📊 Statistics:"));
        console.log(chalk.gray(`  Total Requests: ${stats.totalRequests}`));
        console.log(chalk.gray(`  Successful: ${stats.successfulRequests}`));
        console.log(chalk.gray(`  Failed: ${stats.failedRequests}`));
        console.log(
          chalk.gray(
            `  Success Rate: ${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%`,
          ),
        );
        console.log(chalk.gray(`  Avg Response Time: ${stats.averageResponseTime.toFixed(0)}ms`));
        console.log(chalk.gray(`  Tokens Saved: ${stats.tokensSaved.toLocaleString()}`));
        console.log(chalk.gray(`  Cost Saved: $${stats.costSaved.toFixed(2)}`));
      }

      console.log();
    });

  // Auto-setup command
  cerebellumCmd
    .command("auto-setup")
    .description(
      "Automatically setup cerebellum environment (install Ollama, start service, pull model)",
    )
    .option("-y, --yes", "Skip confirmation and proceed with setup", false)
    .action(async () => {
      const config = loadConfig();
      const cerebellumConfig = extractCerebellumConfig(config);

      console.log(chalk.bold("\n🔧 Cerebellum Auto-Setup\n"));

      // Check current status
      console.log(chalk.gray("Checking current setup status..."));
      const status = await getSetupStatus(cerebellumConfig.model);

      console.log(
        chalk.gray(
          `Ollama Installed: ${status.ollamaInstalled ? chalk.green("Yes") : chalk.red("No")}`,
        ),
      );
      console.log(
        chalk.gray(
          `Ollama Running: ${status.ollamaRunning ? chalk.green("Yes") : chalk.red("No")}`,
        ),
      );
      console.log(
        chalk.gray(
          `Model Available: ${status.modelDownloaded ? chalk.green("Yes") : chalk.red("No")}`,
        ),
      );

      // If everything is ready
      if (status.ollamaInstalled && status.ollamaRunning && status.modelDownloaded) {
        console.log(chalk.green("\n✓ Cerebellum environment is already configured and ready!"));
        return;
      }

      // Show what will be done
      console.log(chalk.bold("\nSetup Plan:"));
      if (!status.ollamaInstalled) {
        console.log(chalk.gray("  • Install Ollama"));
      }
      if (!status.ollamaRunning) {
        console.log(chalk.gray("  • Start Ollama service"));
      }
      if (!status.modelDownloaded) {
        console.log(chalk.gray(`  • Download model: ${cerebellumConfig.model}`));
      }

      // TODO: Add interactive confirmation here if not --yes

      console.log(chalk.gray("\nStarting setup...\n"));

      // Run auto-setup
      const result = await autoSetup(cerebellumConfig.model, {
        onProgress: (message) => {
          console.log(chalk.gray(message));
        },
      });

      if (result.success) {
        console.log(chalk.green("\n✓ Setup completed successfully!"));
        console.log(chalk.gray("You can now use cerebellum with: openclaw cb test"));
      } else {
        console.log(chalk.red("\n✗ Setup failed"));
        console.log(chalk.red(result.message));
        console.log(chalk.gray("\nYou can try manual setup:"));
        console.log(chalk.gray("  1. Install Ollama: https://ollama.ai"));
        console.log(chalk.gray(`  2. Pull model: ollama pull ${cerebellumConfig.model}`));
        console.log(chalk.gray("  3. Start Ollama: ollama serve"));
      }

      console.log();
    });

  // Test command
  cerebellumCmd
    .command("test")
    .description("Test cerebellum with a simple question")
    .option("-p, --prompt <prompt>", "Custom prompt to test", "What is 2+2?")
    .action(async (options) => {
      const config = loadConfig();
      const cerebellumConfig = extractCerebellumConfig(config);

      if (!cerebellumConfig.enabled) {
        console.log(chalk.red("Cerebellum is disabled. Enable it in your config."));
        return;
      }

      const kernel = createCerebellumKernel(cerebellumConfig);

      console.log(chalk.bold("\n🧪 Testing Cerebellum\n"));
      console.log(chalk.gray(`Prompt: ${options.prompt}`));
      console.log(chalk.gray("Thinking...\n"));

      const response = await kernel.quickAnswer(options.prompt);

      if (response.success) {
        console.log(chalk.green("✓ Response:"));
        console.log(response.text);
        console.log(chalk.gray(`\nDuration: ${response.durationMs}ms`));
        if (response.usage) {
          console.log(
            chalk.gray(
              `Tokens: ${response.usage.total} (${response.usage.input} in, ${response.usage.output} out)`,
            ),
          );
        }
      } else {
        console.log(chalk.red("✗ Error:"));
        console.log(response.error);

        // Check if it's an environment issue and offer setup
        const status = await getSetupStatus(cerebellumConfig.model);
        if (!status.ollamaInstalled || !status.ollamaRunning || !status.modelDownloaded) {
          console.log(
            chalk.yellow("\n⚠️  Environment issue detected. Run `openclaw cb auto-setup` to fix."),
          );
        }
      }

      console.log();
    });

  // Pull model command
  cerebellumCmd
    .command("pull")
    .description("Pull the default cerebellum model")
    .option("-m, --model <model>", "Model to pull")
    .action(async (options) => {
      const config = loadConfig();
      const cerebellumConfig = extractCerebellumConfig(config);
      const model = options.model ?? cerebellumConfig.model;

      console.log(chalk.bold(`\n📥 Pulling model: ${model}\n`));
      console.log(chalk.gray("This may take a few minutes...\n"));

      const kernel = createCerebellumKernel(cerebellumConfig);
      const result = await kernel.pullModel(model);

      if (result.success) {
        console.log(chalk.green(`✓ Model ${model} pulled successfully`));
      } else {
        console.log(chalk.red(`✗ Failed to pull model: ${result.error}`));
      }

      console.log();
    });

  // Evaluate command - test task evaluator
  cerebellumCmd
    .command("evaluate")
    .description("Evaluate a task and show routing decision")
    .argument("<prompt>", "Task prompt to evaluate")
    .action(async (prompt: string) => {
      const config = loadConfig();
      const cerebellumConfig = extractCerebellumConfig(config);

      console.log(chalk.bold("\n📋 Task Evaluation\n"));
      console.log(chalk.gray(`Prompt: ${prompt}\n`));

      const evaluator = createTaskEvaluator(cerebellumConfig);

      const taskInfo = {
        type: "unknown" as const,
        prompt,
        hasCode: /(code|function|class|debug)/i.test(prompt),
        hasMath: /(calculate|compute|math|equation)/i.test(prompt),
        estimatedTokens: prompt.length / 4,
        isHighFrequency: false,
        historyLength: 0,
        isScheduledTask: false,
      };

      const assessment = evaluator.evaluate(taskInfo);

      console.log(chalk.bold("Assessment Result:"));
      console.log(
        chalk.gray(
          `  Use Cerebellum: ${assessment.useCerebellum ? chalk.green("Yes") : chalk.red("No")}`,
        ),
      );
      console.log(chalk.gray(`  Confidence: ${(assessment.confidence * 100).toFixed(0)}%`));
      console.log(chalk.gray(`  Task Type: ${assessment.taskType}`));
      console.log(chalk.gray(`  Complexity: ${assessment.complexity}/10`));
      console.log(chalk.gray(`  Estimated Time: ${assessment.estimatedTime}s`));
      console.log(chalk.gray(`  Precision: ${assessment.precisionRequirement}`));
      console.log(chalk.gray(`  Reason: ${assessment.reason}`));
      console.log();
    });

  // Stats command
  cerebellumCmd
    .command("stats")
    .description("Show detailed cerebellum statistics")
    .option("-r, --reset", "Reset statistics")
    .action(async (options) => {
      const config = loadConfig();
      const cerebellumConfig = extractCerebellumConfig(config);
      const router = createDualKernelRouter({ config: cerebellumConfig });

      if (options.reset) {
        await router.resetStats();
        console.log(chalk.green("✓ Statistics reset"));
        return;
      }

      const stats = await router.getStats();

      console.log(chalk.bold("\n📊 Cerebellum Statistics\n"));

      if (stats.totalRequests === 0) {
        console.log(chalk.gray("No data available yet."));
        console.log();
        return;
      }

      console.log(chalk.bold("Overall:"));
      console.log(chalk.gray(`  Total Requests: ${stats.totalRequests}`));
      console.log(chalk.gray(`  Successful: ${stats.successfulRequests}`));
      console.log(chalk.gray(`  Failed: ${stats.failedRequests}`));
      console.log(
        chalk.gray(
          `  Success Rate: ${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%`,
        ),
      );
      console.log(chalk.gray(`  Avg Response Time: ${stats.averageResponseTime.toFixed(0)}ms`));
      console.log(chalk.gray(`  Tokens Saved: ${stats.tokensSaved.toLocaleString()}`));
      console.log(chalk.gray(`  Cost Saved: $${stats.costSaved.toFixed(2)}`));

      if (Object.keys(stats.taskTypeStats).length > 0) {
        console.log(chalk.bold("\nBy Task Type:"));
        for (const [type, typeStats] of Object.entries(stats.taskTypeStats)) {
          console.log(chalk.gray(`  ${type}:`));
          console.log(chalk.gray(`    Count: ${typeStats.count}`));
          console.log(chalk.gray(`    Success Rate: ${(typeStats.successRate * 100).toFixed(1)}%`));
          console.log(chalk.gray(`    Avg Time: ${typeStats.averageTime.toFixed(0)}ms`));
        }
      }

      console.log(chalk.gray(`\nLast Updated: ${stats.lastUpdated}`));
      console.log();
    });

  // Setup command
  cerebellumCmd
    .command("setup")
    .description("Setup cerebellum with default configuration")
    .action(async () => {
      console.log(chalk.bold("\n🔧 Cerebellum Setup\n"));

      console.log(chalk.gray("Add the following to your ~/.openclaw/openclaw.json:\n"));

      const exampleConfig = {
        cerebellum: {
          enabled: true,
          provider: "ollama",
          model: "qwen2.5:0.5b",
          baseUrl: "http://127.0.0.1:11434",
          thresholds: {
            maxEstimatedTime: 1200,
            maxComplexity: 4,
            minConfidence: 0.7,
          },
          forceCerebellumFor: ["greeting", "status_check", "simple_qa", "scheduled_task"],
          forceCerebrumFor: ["code_generation", "complex_analysis", "multi_step_planning"],
          stats: {
            enabled: true,
            logPath: "~/.openclaw/cerebellum-stats.json",
          },
        },
      };

      console.log(JSON.stringify(exampleConfig, null, 2));

      console.log(chalk.gray("\nFor automatic setup, run: openclaw cb auto-setup"));
      console.log(chalk.gray("\nManual setup:"));
      console.log(chalk.gray("  1. Install Ollama: https://ollama.ai"));
      console.log(chalk.gray("  2. Pull the model: ollama pull qwen2.5:0.5b"));
      console.log(chalk.gray("  3. Start Ollama: ollama serve\n"));
    });
}
