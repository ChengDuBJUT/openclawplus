/**
 * OpenClawPlus Cerebellum Module
 *
 * 小脑模块 - 双内核架构的本地AI处理能力
 */

// 类型导出
export type {
  CerebellumConfig,
  TaskThresholds,
  StatsConfig,
  TaskType,
  TaskInfo,
  TaskAssessment,
  CerebellumResponse,
  RoutingDecision,
  CerebellumStats,
} from "./types.js";

// 默认配置
export {
  DEFAULT_CEREBELLUM_CONFIG,
  extractCerebellumConfig,
  isCerebellumEnabled,
} from "./types.js";

// 小脑内核
export { CerebellumKernel, createCerebellumKernel } from "./cerebellum-kernel.js";

// 任务评估器
export { TaskEvaluator, createTaskEvaluator } from "./task-evaluator.js";

// 路由器
export { DualKernelRouter, createDualKernelRouter } from "./router.js";
export type { RouterCallbacks, RouterOptions } from "./router.js";

// 统计收集器
export { StatsCollector, createStatsCollector } from "./stats-collector.js";

// 自动配置
export {
  autoSetup,
  installOllama,
  startOllamaService,
  pullModel,
  getSetupStatus,
  isOllamaInstalled,
  isOllamaRunning,
  isModelAvailable,
} from "./auto-setup.js";
export type { SetupStatus, SetupResult } from "./auto-setup.js";
