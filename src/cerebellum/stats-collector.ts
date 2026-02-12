/**
 * OpenClawPlus Stats Collector
 *
 * 统计收集器 - 记录和统计小脑使用情况
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  StatsConfig,
  TaskInfo,
  RoutingDecision,
  CerebellumResponse,
  CerebellumStats,
  TaskType,
} from "./types.js";

interface StatsEntry {
  timestamp: string;
  target: "cerebellum" | "cerebrum";
  taskType: TaskType;
  success?: boolean;
  error?: string;
  durationMs?: number;
  tokensInput?: number;
  tokensOutput?: number;
}

interface StatsData {
  entries: StatsEntry[];
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDurationMs: number;
  tokensSaved: number;
  lastUpdated: string;
}

const DEFAULT_COST_PER_1K_TOKENS = 0.03; // $0.03 per 1K tokens (Claude 3.5 Sonnet avg)

export class StatsCollector {
  private config: StatsConfig;
  private logPath: string;
  private cache: StatsData | null = null;

  constructor(config: StatsConfig) {
    this.config = config;
    this.logPath = this.resolveLogPath(config.logPath);
  }

  private resolveLogPath(logPath: string): string {
    if (logPath.startsWith("~/")) {
      return path.join(os.homedir(), logPath.slice(2));
    }
    return logPath;
  }

  private async ensureDir(): Promise<void> {
    const dir = path.dirname(this.logPath);
    try {
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    } catch {
      // ignore
    }
  }

  private async loadData(): Promise<StatsData> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const content = await fs.readFile(this.logPath, "utf8");
      const data = JSON.parse(content) as StatsData;
      this.cache = data;
      return data;
    } catch {
      // 返回默认数据
      const defaultData: StatsData = {
        entries: [],
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalDurationMs: 0,
        tokensSaved: 0,
        lastUpdated: new Date().toISOString(),
      };
      this.cache = defaultData;
      return defaultData;
    }
  }

  private async saveData(data: StatsData): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    await this.ensureDir();
    data.lastUpdated = new Date().toISOString();
    this.cache = data;

    try {
      await fs.writeFile(this.logPath, JSON.stringify(data, null, 2), { mode: 0o600 });
    } catch {
      // ignore write errors
    }
  }

  async recordDecision(decision: RoutingDecision): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const data = await this.loadData();

    data.entries.push({
      timestamp: new Date().toISOString(),
      target: decision.target,
      taskType: decision.assessment.taskType,
    });

    data.totalRequests++;

    // 限制条目数量
    if (data.entries.length > 10000) {
      data.entries = data.entries.slice(-5000);
    }

    await this.saveData(data);
  }

  async recordSuccess(task: TaskInfo, response: CerebellumResponse): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const data = await this.loadData();

    data.successfulRequests++;
    data.totalDurationMs += response.durationMs;

    // 估算节省的token（使用小脑替代云端大模型）
    if (response.usage) {
      const tokensUsed = response.usage.total;
      // 假设云端模型也需要类似token，节省的就是这部分费用
      data.tokensSaved += tokensUsed;
    }

    // 更新最后一条记录
    const lastEntry = data.entries[data.entries.length - 1];
    if (lastEntry && lastEntry.target === "cerebellum") {
      lastEntry.success = true;
      lastEntry.durationMs = response.durationMs;
      lastEntry.tokensInput = response.usage?.input;
      lastEntry.tokensOutput = response.usage?.output;
    }

    await this.saveData(data);
  }

  async recordFailure(task: TaskInfo, error?: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const data = await this.loadData();

    data.failedRequests++;

    // 更新最后一条记录
    const lastEntry = data.entries[data.entries.length - 1];
    if (lastEntry && lastEntry.target === "cerebellum") {
      lastEntry.success = false;
      lastEntry.error = error;
    }

    await this.saveData(data);
  }

  async getStats(): Promise<CerebellumStats> {
    const data = await this.loadData();

    // 计算任务类型统计
    const taskTypeStats: Record<
      TaskType,
      { count: number; successCount: number; totalTime: number }
    > = {} as Record<TaskType, { count: number; successCount: number; totalTime: number }>;

    for (const entry of data.entries) {
      if (!taskTypeStats[entry.taskType]) {
        taskTypeStats[entry.taskType] = { count: 0, successCount: 0, totalTime: 0 };
      }

      taskTypeStats[entry.taskType].count++;
      if (entry.success) {
        taskTypeStats[entry.taskType].successCount++;
        taskTypeStats[entry.taskType].totalTime += entry.durationMs ?? 0;
      }
    }

    // 格式化任务类型统计
    const formattedTaskTypeStats: CerebellumStats["taskTypeStats"] =
      {} as CerebellumStats["taskTypeStats"];

    for (const [type, stats] of Object.entries(taskTypeStats)) {
      formattedTaskTypeStats[type as TaskType] = {
        count: stats.count,
        successRate: stats.count > 0 ? stats.successCount / stats.count : 0,
        averageTime: stats.successCount > 0 ? stats.totalTime / stats.successCount : 0,
      };
    }

    // 计算平均响应时间
    const averageResponseTime =
      data.successfulRequests > 0 ? data.totalDurationMs / data.successfulRequests : 0;

    // 计算节省的费用
    const costSaved = (data.tokensSaved / 1000) * DEFAULT_COST_PER_1K_TOKENS;

    return {
      totalRequests: data.totalRequests,
      successfulRequests: data.successfulRequests,
      failedRequests: data.failedRequests,
      averageResponseTime,
      tokensSaved: data.tokensSaved,
      costSaved,
      taskTypeStats: formattedTaskTypeStats,
      lastUpdated: data.lastUpdated,
    };
  }

  async reset(): Promise<void> {
    const emptyData: StatsData = {
      entries: [],
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalDurationMs: 0,
      tokensSaved: 0,
      lastUpdated: new Date().toISOString(),
    };

    await this.saveData(emptyData);
  }
}

export function createStatsCollector(config: StatsConfig): StatsCollector {
  return new StatsCollector(config);
}
