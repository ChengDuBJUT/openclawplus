/**
 * OpenClawPlus Router
 *
 * 路由层 - 协调大脑和小脑之间的任务分发
 */

import type {
  CerebellumConfig,
  TaskInfo,
  TaskAssessment,
  RoutingDecision,
  CerebellumResponse,
  CerebellumStats,
} from "./types.js";
import { CerebellumKernel, createCerebellumKernel } from "./cerebellum-kernel.js";
import { StatsCollector, createStatsCollector } from "./stats-collector.js";
import { TaskEvaluator, createTaskEvaluator } from "./task-evaluator.js";

/**
 * 路由事件回调
 */
export interface RouterCallbacks {
  onRoutingDecision?: (decision: RoutingDecision) => void;
  onCerebellumSuccess?: (response: CerebellumResponse, task: TaskInfo) => void;
  onCerebellumFailure?: (error: string, task: TaskInfo) => void;
  onFallbackToCerebrum?: (reason: string, task: TaskInfo) => void;
}

/**
 * 路由器选项
 */
export interface RouterOptions {
  config: CerebellumConfig;
  callbacks?: RouterCallbacks;
  enableFallback?: boolean; // 小脑失败时是否回退到大脑
}

/**
 * 双内核路由器
 */
export class DualKernelRouter {
  private config: CerebellumConfig;
  private cerebellum: CerebellumKernel;
  private evaluator: TaskEvaluator;
  private stats: StatsCollector;
  private callbacks: RouterCallbacks;
  private enableFallback: boolean;
  private cerebellumAvailable: boolean = false;

  constructor(options: RouterOptions) {
    this.config = options.config;
    this.callbacks = options.callbacks ?? {};
    this.enableFallback = options.enableFallback ?? true;

    this.cerebellum = createCerebellumKernel(this.config);
    this.evaluator = createTaskEvaluator(this.config);
    this.stats = createStatsCollector(this.config.stats);

    // 异步检查可用性
    void this.checkAvailability();
  }

  /**
   * 检查小脑可用性
   */
  private async checkAvailability(): Promise<void> {
    this.cerebellumAvailable = await this.cerebellum.isAvailable();
  }

  /**
   * 路由任务 - 决定使用哪个内核并执行
   */
  async route(task: TaskInfo): Promise<{
    target: "cerebellum" | "cerebrum";
    assessment: TaskAssessment;
    cerebellumResponse?: CerebellumResponse;
    fallbackReason?: string;
  }> {
    // 1. 评估任务
    const assessment = this.evaluator.evaluate(task);

    // 2. 决策是否使用小脑
    const useCerebellum =
      assessment.useCerebellum && this.config.enabled && this.cerebellumAvailable;

    // 3. 记录决策
    const decision: RoutingDecision = {
      target: useCerebellum ? "cerebellum" : "cerebrum",
      assessment,
      isManualOverride: false,
      timestamp: Date.now(),
    };

    this.callbacks.onRoutingDecision?.(decision);
    await this.stats.recordDecision(decision);

    // 4. 如果使用小脑
    if (useCerebellum) {
      const response = await this.executeWithCerebellum(task, assessment);

      if (response.success) {
        await this.stats.recordSuccess(task, response);
        this.callbacks.onCerebellumSuccess?.(response, task);

        return {
          target: "cerebellum",
          assessment,
          cerebellumResponse: response,
        };
      }

      // 失败处理
      await this.stats.recordFailure(task, response.error);
      this.callbacks.onCerebellumFailure?.(response.error ?? "Unknown error", task);

      // 如果启用回退，使用大脑
      if (this.enableFallback) {
        this.callbacks.onFallbackToCerebrum?.(`Cerebellum failed: ${response.error}`, task);

        return {
          target: "cerebrum",
          assessment,
          fallbackReason: response.error,
        };
      }

      // 不回退，返回错误
      return {
        target: "cerebellum",
        assessment,
        cerebellumResponse: response,
      };
    }

    // 5. 使用大脑
    return {
      target: "cerebrum",
      assessment,
    };
  }

  /**
   * 使用小脑执行任务
   */
  private async executeWithCerebellum(
    task: TaskInfo,
    assessment: TaskAssessment,
  ): Promise<CerebellumResponse> {
    // 根据任务类型选择不同的处理方式
    switch (assessment.taskType) {
      case "greeting":
      case "simple_qa":
      case "status_check":
        return this.cerebellum.quickAnswer(task.prompt);

      case "text_summary":
        return this.cerebellum.summarize(task.prompt, 3);

      case "format_conversion":
        // 检测目标格式
        const format = this.detectTargetFormat(task.prompt);
        return this.cerebellum.convertFormat(task.prompt, format);

      default:
        // 通用生成
        return this.cerebellum.generate(task.prompt);
    }
  }

  /**
   * 检测目标格式
   */
  private detectTargetFormat(prompt: string): "json" | "yaml" | "markdown" | "csv" {
    const lower = prompt.toLowerCase();
    if (lower.includes("json")) {
      return "json";
    }
    if (lower.includes("yaml") || lower.includes("yml")) {
      return "yaml";
    }
    if (lower.includes("csv")) {
      return "csv";
    }
    return "markdown";
  }

  /**
   * 强制使用小脑（忽略评估）
   */
  async forceCerebellum(task: TaskInfo): Promise<CerebellumResponse> {
    const assessment: TaskAssessment = {
      useCerebellum: true,
      confidence: 1,
      reason: "Manual override to cerebellum",
      taskType: task.type,
      estimatedTokens: task.estimatedTokens,
      estimatedTime: 60,
      complexity: 3,
      precisionRequirement: "low",
    };

    const decision: RoutingDecision = {
      target: "cerebellum",
      assessment,
      isManualOverride: true,
      timestamp: Date.now(),
    };

    this.callbacks.onRoutingDecision?.(decision);
    await this.stats.recordDecision(decision);

    const response = await this.executeWithCerebellum(task, assessment);

    if (response.success) {
      await this.stats.recordSuccess(task, response);
    } else {
      await this.stats.recordFailure(task, response.error);
    }

    return response;
  }

  /**
   * 强制使用大脑（忽略评估）
   */
  async forceCerebrum(task: TaskInfo): Promise<{
    target: "cerebrum";
    assessment: TaskAssessment;
  }> {
    const assessment: TaskAssessment = {
      useCerebellum: false,
      confidence: 1,
      reason: "Manual override to cerebrum",
      taskType: task.type,
      estimatedTokens: task.estimatedTokens,
      estimatedTime: 300,
      complexity: 7,
      precisionRequirement: "high",
    };

    const decision: RoutingDecision = {
      target: "cerebrum",
      assessment,
      isManualOverride: true,
      timestamp: Date.now(),
    };

    this.callbacks.onRoutingDecision?.(decision);
    await this.stats.recordDecision(decision);

    return { target: "cerebrum", assessment };
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<CerebellumStats> {
    return this.stats.getStats();
  }

  /**
   * 获取状态信息
   */
  async getStatus(): Promise<{
    enabled: boolean;
    available: boolean;
    model: string;
    stats: CerebellumStats;
  }> {
    const stats = await this.getStats();
    return {
      enabled: this.config.enabled,
      available: this.cerebellumAvailable,
      model: this.config.model,
      stats,
    };
  }

  /**
   * 重置统计
   */
  async resetStats(): Promise<void> {
    await this.stats.reset();
  }
}

/**
 * 创建双内核路由器
 */
export function createDualKernelRouter(options: RouterOptions): DualKernelRouter {
  return new DualKernelRouter(options);
}
