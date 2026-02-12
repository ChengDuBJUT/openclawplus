/**
 * OpenClawPlus Cerebellum Module - Types
 *
 * 小脑模块类型定义
 */

import type { OpenClawConfig } from "../config/config.js";

/**
 * 小脑配置
 */
export interface CerebellumConfig {
  /** 是否启用小脑 */
  enabled: boolean;
  /** 提供商 (默认: ollama) */
  provider: string;
  /** 模型名称 (默认: qwen2.5:0.5b) */
  model: string;
  /** Ollama 基础 URL */
  baseUrl: string;
  /** 任务评估阈值 */
  thresholds: TaskThresholds;
  /** 强制使用小脑的场景 */
  forceCerebellumFor: TaskType[];
  /** 强制使用大脑的场景 */
  forceCerebrumFor: TaskType[];
  /** 统计配置 */
  stats: StatsConfig;
}

/**
 * 任务评估阈值
 */
export interface TaskThresholds {
  /** 最大预估执行时间 (秒)，默认 1200 (20分钟) */
  maxEstimatedTime: number;
  /** 最大复杂度 (1-10)，默认 4 */
  maxComplexity: number;
  /** 最小置信度 (0-1)，默认 0.7 */
  minConfidence: number;
}

/**
 * 统计配置
 */
export interface StatsConfig {
  /** 是否启用统计 */
  enabled: boolean;
  /** 统计日志路径 */
  logPath: string;
}

/**
 * 任务类型
 */
export type TaskType =
  | "greeting" // 问候语
  | "status_check" // 状态查询
  | "simple_qa" // 简单问答
  | "scheduled_task" // 计划任务
  | "text_summary" // 文本摘要
  | "format_conversion" // 格式转换
  | "code_generation" // 代码生成
  | "complex_analysis" // 复杂分析
  | "multi_step_planning" // 多步规划
  | "creative_writing" // 创意写作
  | "debugging" // 调试
  | "research" // 研究
  | "keyword_triggered" // 关键词触发
  | "unknown"; // 未知

/**
 * 任务信息
 */
export interface TaskInfo {
  /** 任务类型 */
  type: TaskType;
  /** 任务描述/提示词 */
  prompt: string;
  /** 是否包含代码 */
  hasCode: boolean;
  /** 是否包含数学运算 */
  hasMath: boolean;
  /** 预估token数 */
  estimatedTokens: number;
  /** 是否高频任务 */
  isHighFrequency: boolean;
  /** 会话历史长度 */
  historyLength: number;
  /** 是否是计划任务 */
  isScheduledTask: boolean;
}

/**
 * 任务评估结果
 */
export interface TaskAssessment {
  /** 是否使用小脑 */
  useCerebellum: boolean;
  /** 置信度 (0-1) */
  confidence: number;
  /** 决策原因 */
  reason: string;
  /** 识别的任务类型 */
  taskType: TaskType;
  /** 预估token消耗 */
  estimatedTokens: number;
  /** 预估执行时间 (秒) */
  estimatedTime: number;
  /** 复杂度评分 (1-10) */
  complexity: number;
  /** 精度要求 (high/medium/low) */
  precisionRequirement: "high" | "medium" | "low";
}

/**
 * 小脑响应
 */
export interface CerebellumResponse {
  /** 响应文本 */
  text: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 使用的模型 */
  model: string;
  /** 执行时间 (毫秒) */
  durationMs: number;
  /** Token 使用统计 */
  usage?: {
    input: number;
    output: number;
    total: number;
  };
}

/**
 * 路由决策
 */
export interface RoutingDecision {
  /** 选择的内核: 'cerebellum' | 'cerebrum' */
  target: "cerebellum" | "cerebrum";
  /** 决策评估结果 */
  assessment: TaskAssessment;
  /** 是否手动覆盖 */
  isManualOverride: boolean;
  /** 决策时间戳 */
  timestamp: number;
}

/**
 * 小脑统计
 */
export interface CerebellumStats {
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 平均响应时间 (毫秒) */
  averageResponseTime: number;
  /** 节省的token数 (预估) */
  tokensSaved: number;
  /** 节省的费用 (预估美元) */
  costSaved: number;
  /** 各任务类型统计 */
  taskTypeStats: Record<
    TaskType,
    {
      count: number;
      successRate: number;
      averageTime: number;
    }
  >;
  /** 最后更新时间 */
  lastUpdated: string;
}

/**
 * 默认小脑配置
 */
export const DEFAULT_CEREBELLUM_CONFIG = {
  enabled: true,
  provider: "ollama",
  model: "qwen2.5:0.5b",
  baseUrl: "http://127.0.0.1:11434",
  thresholds: {
    maxEstimatedTime: 1200,
    maxComplexity: 4,
    minConfidence: 0.7,
  },
  forceCerebellumFor: [
    "greeting",
    "status_check",
    "simple_qa",
    "scheduled_task",
    "text_summary",
    "format_conversion",
  ] as TaskType[],
  forceCerebrumFor: [
    "code_generation",
    "complex_analysis",
    "multi_step_planning",
    "creative_writing",
    "debugging",
    "research",
  ] as TaskType[],
  stats: {
    enabled: true,
    logPath: "~/.openclaw/cerebellum-stats.json",
  },
} satisfies CerebellumConfig;

/**
 * 从主配置提取小脑配置
 */
export function extractCerebellumConfig(config?: OpenClawConfig): CerebellumConfig {
  if (!config?.cerebellum) {
    return DEFAULT_CEREBELLUM_CONFIG;
  }

  const merged = {
    ...DEFAULT_CEREBELLUM_CONFIG,
    ...config.cerebellum,
    thresholds: {
      ...DEFAULT_CEREBELLUM_CONFIG.thresholds,
      ...config.cerebellum.thresholds,
    },
    stats: {
      ...DEFAULT_CEREBELLUM_CONFIG.stats,
      ...config.cerebellum.stats,
    },
  };

  return merged as CerebellumConfig;
}

/**
 * 检查小脑是否启用且可用
 */
export function isCerebellumEnabled(config?: OpenClawConfig): boolean {
  const cerebellumConfig = extractCerebellumConfig(config);
  return cerebellumConfig.enabled;
}
