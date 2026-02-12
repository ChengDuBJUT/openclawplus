/**
 * Cerebellum Auto-Setup Module
 *
 * Automatically configures the environment when users try to use cerebellum
 */

import { execSync, spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

export interface SetupStatus {
  ollamaInstalled: boolean;
  ollamaRunning: boolean;
  modelDownloaded: boolean;
  modelName: string;
}

export interface SetupResult {
  success: boolean;
  message: string;
  steps: string[];
}

/**
 * Check if Ollama is installed
 */
export function isOllamaInstalled(): boolean {
  const platform = process.platform;

  try {
    if (platform === "win32") {
      // Check if ollama.exe is in PATH or common locations
      try {
        execSync("where ollama", { stdio: "ignore" });
        return true;
      } catch {
        // Also check common install locations
        const possiblePaths = [
          "C:\\Program Files\\Ollama\\ollama.exe",
          "C:\\Program Files (x86)\\Ollama\\ollama.exe",
        ];
        for (const p of possiblePaths) {
          try {
            execSync(`dir "${p}" >nul 2>&1`, { stdio: "ignore", shell: "cmd.exe" });
            return true;
          } catch {
            continue;
          }
        }
        return false;
      }
    } else {
      // Linux/macOS
      execSync("which ollama", { stdio: "ignore" });
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * Check if Ollama service is running
 */
export async function isOllamaRunning(
  baseUrl: string = "http://127.0.0.1:11434",
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if model is available
 */
export async function isModelAvailable(
  modelName: string,
  baseUrl: string = "http://127.0.0.1:11434",
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { models: Array<{ name: string }> };
    return data.models.some((m) => m.name === modelName || m.name.startsWith(modelName + ":"));
  } catch {
    return false;
  }
}

/**
 * Get current setup status
 */
export async function getSetupStatus(modelName: string): Promise<SetupStatus> {
  const ollamaInstalled = isOllamaInstalled();
  const ollamaRunning = ollamaInstalled ? await isOllamaRunning() : false;
  const modelDownloaded = ollamaRunning ? await isModelAvailable(modelName) : false;

  return {
    ollamaInstalled,
    ollamaRunning,
    modelDownloaded,
    modelName,
  };
}

/**
 * Install Ollama automatically
 */
export async function installOllama(): Promise<SetupResult> {
  const steps: string[] = [];

  try {
    // Detect OS
    const platform = process.platform;

    if (platform === "linux") {
      steps.push("Detected Linux platform");

      // Try to install using the official installer
      try {
        steps.push("Installing Ollama using official installer...");
        execSync("curl -fsSL https://ollama.com/install.sh | sh", {
          stdio: "inherit",
          timeout: 300000, // 5 minutes
        });
        steps.push("Ollama installation completed");
      } catch (error) {
        return {
          success: false,
          message: `Failed to install Ollama: ${error}`,
          steps,
        };
      }
    } else if (platform === "darwin") {
      steps.push("Detected macOS platform");

      // Check if Homebrew is available
      try {
        execSync("which brew", { stdio: "ignore" });
        steps.push("Installing Ollama via Homebrew...");
        execSync("brew install ollama", {
          stdio: "inherit",
          timeout: 300000,
        });
        steps.push("Ollama installation completed via Homebrew");
      } catch {
        // Fall back to official installer
        steps.push("Installing Ollama using official installer...");
        execSync("curl -fsSL https://ollama.com/install.sh | sh", {
          stdio: "inherit",
          timeout: 300000,
        });
        steps.push("Ollama installation completed");
      }
    } else if (platform === "win32") {
      steps.push("Detected Windows platform");

      // Try winget first (Windows Package Manager)
      try {
        steps.push("Trying to install Ollama via winget...");
        execSync(
          "winget install Ollama.Ollama --accept-source-agreements --accept-package-agreements",
          {
            stdio: "inherit",
            timeout: 300000,
          },
        );
        steps.push("Ollama installation completed via winget");
      } catch {
        // Fall back to downloading the installer
        try {
          steps.push("Winget failed, downloading Ollama installer...");

          // Download the Windows installer
          const installerPath = "C:\\Users\\Public\\Downloads\\ollama-setup.exe";
          execSync(
            `curl -fsSL -o "${installerPath}" https://ollama.com/download/ollama-windows-amd64.exe`,
            {
              stdio: "inherit",
              timeout: 120000,
            },
          );

          // Run installer silently
          steps.push("Running Ollama installer...");
          execSync(`"${installerPath}" /S`, {
            stdio: "inherit",
            timeout: 120000,
          });

          // Clean up installer
          execSync(`del "${installerPath}"`, { stdio: "ignore" });
          steps.push("Ollama installation completed");
        } catch (downloadError) {
          return {
            success: false,
            message: `Failed to install Ollama on Windows: ${downloadError}. Please install manually from https://ollama.com/download`,
            steps,
          };
        }
      }
    } else {
      return {
        success: false,
        message: `Unsupported platform: ${platform}. Please install Ollama manually from https://ollama.com/download`,
        steps,
      };
    }

    return {
      success: true,
      message: "Ollama installed successfully",
      steps,
    };
  } catch (error) {
    return {
      success: false,
      message: `Installation failed: ${error}`,
      steps,
    };
  }
}

/**
 * Start Ollama service
 */
export async function startOllamaService(): Promise<SetupResult> {
  const steps: string[] = [];
  const platform = process.platform;

  try {
    steps.push("Starting Ollama service...");

    if (platform === "win32") {
      // On Windows, Ollama should be running as a background process after installation
      // Try to start it via PowerShell or check if it's already running
      try {
        // Check if already running
        execSync('tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find "ollama.exe"', {
          stdio: "ignore",
          shell: "cmd.exe",
        });
        steps.push("Ollama is already running on Windows");
        return {
          success: true,
          message: "Ollama is already running on Windows",
          steps,
        };
      } catch {
        // Try to start Ollama
        try {
          steps.push("Starting Ollama via PowerShell...");
          execSync('Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden', {
            stdio: "ignore",
            shell: "powershell.exe",
          });
        } catch {
          steps.push("Ollama may need to be started manually on Windows");
        }
      }
    } else {
      // Linux/macOS: Start Ollama in background
      const child = spawn("ollama", ["serve"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }

    // Wait for service to be ready
    steps.push("Waiting for Ollama service to start...");
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await setTimeout(1000);
      if (await isOllamaRunning()) {
        steps.push("Ollama service is now running");
        return {
          success: true,
          message: "Ollama service started successfully",
          steps,
        };
      }
      attempts++;
    }

    return {
      success: false,
      message: "Ollama service failed to start within 30 seconds",
      steps,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to start Ollama: ${error}`,
      steps,
    };
  }
}

/**
 * Pull model with progress tracking
 */
export async function pullModel(
  modelName: string,
  onProgress?: (progress: string) => void,
): Promise<SetupResult> {
  const steps: string[] = [];

  try {
    steps.push(`Pulling model: ${modelName}...`);

    // Use spawn to get real-time output
    const child = spawn("ollama", ["pull", modelName], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";

    child.stdout?.on("data", (data) => {
      const chunk = data.toString();
      output += chunk;
      onProgress?.(chunk);
    });

    child.stderr?.on("data", (data) => {
      const chunk = data.toString();
      output += chunk;
      onProgress?.(chunk);
    });

    await new Promise((resolve, reject) => {
      child.on("close", (code) => {
        if (code === 0) {
          resolve(undefined);
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
      child.on("error", reject);
    });

    steps.push(`Model ${modelName} pulled successfully`);

    return {
      success: true,
      message: `Model ${modelName} downloaded successfully`,
      steps,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to pull model: ${error}`,
      steps,
    };
  }
}

/**
 * Full auto-setup: install Ollama, start service, pull model
 */
export async function autoSetup(
  modelName: string,
  options: {
    installOllama?: boolean;
    startService?: boolean;
    pullModel?: boolean;
    onProgress?: (message: string) => void;
  } = {},
): Promise<SetupResult> {
  const allSteps: string[] = [];

  try {
    // Step 1: Check current status
    options.onProgress?.("Checking current setup status...");
    const status = await getSetupStatus(modelName);

    // Step 2: Install Ollama if needed
    if (!status.ollamaInstalled && options.installOllama !== false) {
      options.onProgress?.("Ollama not found. Installing...");
      const installResult = await installOllama();
      allSteps.push(...installResult.steps);

      if (!installResult.success) {
        return {
          success: false,
          message: installResult.message,
          steps: allSteps,
        };
      }
    }

    // Step 3: Start service if needed
    if (!status.ollamaRunning && options.startService !== false) {
      options.onProgress?.("Starting Ollama service...");
      const startResult = await startOllamaService();
      allSteps.push(...startResult.steps);

      if (!startResult.success) {
        return {
          success: false,
          message: startResult.message,
          steps: allSteps,
        };
      }
    }

    // Step 4: Pull model if needed
    if (!status.modelDownloaded && options.pullModel !== false) {
      options.onProgress?.(`Downloading model ${modelName}...`);
      const pullResult = await pullModel(modelName, (progress) => {
        options.onProgress?.(progress);
      });
      allSteps.push(...pullResult.steps);

      if (!pullResult.success) {
        return {
          success: false,
          message: pullResult.message,
          steps: allSteps,
        };
      }
    }

    return {
      success: true,
      message: "Cerebellum environment configured successfully!",
      steps: allSteps,
    };
  } catch (error) {
    return {
      success: false,
      message: `Setup failed: ${error}`,
      steps: allSteps,
    };
  }
}
