/**
 * OpenClawPlus Cerebellum Kernel
 *
 * 小脑内核实现 - 使用 Ollama 本地模型
 */

import type { CerebellumConfig, CerebellumResponse } from "./types.js";

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
    top_k?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaTagsResponse {
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
    digest: string;
    details?: {
      parent_model?: string;
      format?: string;
      family?: string;
      families?: string[];
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

export class CerebellumKernel {
  private config: CerebellumConfig;
  private baseUrl: string;

  constructor(config: CerebellumConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
  }

  /**
   * 检查 Ollama 服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 检查模型是否已下载
   */
  async isModelAvailable(modelName?: string): Promise<boolean> {
    const targetModel = modelName ?? this.config.model;
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as OllamaTagsResponse;
      return data.models.some(
        (m) => m.name === targetModel || m.name.startsWith(targetModel + ":"),
      );
    } catch {
      return false;
    }
  }

  /**
   * 拉取模型
   */
  async pullModel(modelName?: string): Promise<{ success: boolean; error?: string }> {
    const targetModel = modelName ?? this.config.model;
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: targetModel, stream: false }),
        signal: AbortSignal.timeout(300000), // 5分钟超时
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Failed to pull model: ${errorText}` };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Error pulling model: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 生成响应
   */
  async generate(
    prompt: string,
    systemPrompt?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<CerebellumResponse> {
    const startTime = Date.now();

    // 检查可用性
    if (!(await this.isAvailable())) {
      return {
        text: "",
        success: false,
        error: "Ollama service is not available. Please ensure Ollama is running.",
        model: this.config.model,
        durationMs: Date.now() - startTime,
      };
    }

    // 检查模型
    if (!(await this.isModelAvailable())) {
      return {
        text: "",
        success: false,
        error: `Model ${this.config.model} is not available. Run 'ollama pull ${this.config.model}' first.`,
        model: this.config.model,
        durationMs: Date.now() - startTime,
      };
    }

    const request: OllamaGenerateRequest = {
      model: this.config.model,
      prompt,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 2048,
        top_p: 0.9,
        top_k: 40,
      },
    };

    if (systemPrompt) {
      request.system = systemPrompt;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(120000), // 2分钟超时
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          text: "",
          success: false,
          error: `Ollama API error: ${errorText}`,
          model: this.config.model,
          durationMs: Date.now() - startTime,
        };
      }

      const data = (await response.json()) as OllamaGenerateResponse;
      const durationMs = Date.now() - startTime;

      return {
        text: data.response ?? "",
        success: true,
        model: data.model ?? this.config.model,
        durationMs,
        usage: {
          input: data.prompt_eval_count ?? 0,
          output: data.eval_count ?? 0,
          total: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return {
        text: "",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        model: this.config.model,
        durationMs,
      };
    }
  }

  /**
   * 快速回答 - 针对简单问题优化
   */
  async quickAnswer(question: string): Promise<CerebellumResponse> {
    const systemPrompt = `You are a helpful assistant. Provide concise, accurate answers. 
Keep responses brief and to the point. If you're unsure, say so.`;

    return this.generate(question, systemPrompt, {
      temperature: 0.5,
      maxTokens: 512,
    });
  }

  /**
   * 总结文本
   */
  async summarize(text: string, maxLength?: number): Promise<CerebellumResponse> {
    const maxSentences = maxLength ?? 3;
    const prompt = `Please summarize the following text in ${maxSentences} sentences or less:

${text}

Summary:`;

    return this.generate(prompt, undefined, {
      temperature: 0.3,
      maxTokens: 256,
    });
  }

  /**
   * 格式转换
   */
  async convertFormat(
    content: string,
    targetFormat: "json" | "yaml" | "markdown" | "csv",
  ): Promise<CerebellumResponse> {
    const prompt = `Convert the following content to ${targetFormat.toUpperCase()} format:

${content}

Converted ${targetFormat.toUpperCase()}:`;

    return this.generate(prompt, undefined, {
      temperature: 0.2,
      maxTokens: 1024,
    });
  }

  /**
   * 获取状态信息
   */
  async getStatus(): Promise<{
    available: boolean;
    modelAvailable: boolean;
    model: string;
    version?: string;
  }> {
    const available = await this.isAvailable();
    const modelAvailable = available ? await this.isModelAvailable() : false;

    return {
      available,
      modelAvailable,
      model: this.config.model,
    };
  }
}

/**
 * 创建小脑内核实例
 */
export function createCerebellumKernel(config: CerebellumConfig): CerebellumKernel {
  return new CerebellumKernel(config);
}
