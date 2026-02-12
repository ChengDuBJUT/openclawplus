/**
 * OpenClawPlus Task Evaluator
 *
 * 任务评估器 - 分析任务特征，决定使用小脑还是大脑
 */

import type {
  TaskInfo,
  TaskAssessment,
  TaskType,
  CerebellumConfig,
  TaskThresholds,
} from "./types.js";

/**
 * 任务评估器类
 */
export class TaskEvaluator {
  private config: CerebellumConfig;
  private thresholds: TaskThresholds;

  constructor(config: CerebellumConfig) {
    this.config = config;
    this.thresholds = config.thresholds;
  }

  /**
   * 评估任务，返回应该使用哪个内核
   */
  evaluate(task: TaskInfo): TaskAssessment {
    // 1. 检查强制规则
    const forcedDecision = this.checkForcedRules(task);
    if (forcedDecision) {
      return forcedDecision;
    }

    // 2. 分析任务特征
    const analysis = this.analyzeTask(task);

    // 3. 计算复杂度分数
    const complexity = this.calculateComplexity(task, analysis);

    // 4. 评估精度要求
    const precisionRequirement = this.assessPrecisionRequirement(task, analysis);

    // 5. 预估执行时间
    const estimatedTime = this.estimateExecutionTime(task, complexity);

    // 6. 计算置信度
    const confidence = this.calculateConfidence(task, analysis, complexity);

    // 7. 决策逻辑
    const useCerebellum = this.shouldUseCerebellum(
      task,
      complexity,
      precisionRequirement,
      estimatedTime,
      confidence,
    );

    // 8. 生成原因说明
    const reason = this.generateReason(
      useCerebellum,
      task,
      complexity,
      precisionRequirement,
      estimatedTime,
      confidence,
    );

    return {
      useCerebellum,
      confidence,
      reason,
      taskType: analysis.detectedType,
      estimatedTokens: task.estimatedTokens,
      estimatedTime,
      complexity,
      precisionRequirement,
    };
  }

  /**
   * 检查强制规则
   */
  private checkForcedRules(task: TaskInfo): TaskAssessment | null {
    const prompt = task.prompt;
    const promptLower = prompt.trim().toLowerCase();

    // 1. 检查全小脑模式标签 <cb>...</cb>
    const cbStartMatch = prompt.match(/<cb>/i);
    const cbEndMatch = prompt.match(/<\/cb>/i);

    if (cbStartMatch && cbEndMatch) {
      // 找到了完整的 <cb>...</cb> 标签对
      const startIndex = cbStartMatch.index! + cbStartMatch[0].length;
      const endIndex = cbEndMatch.index!;

      if (startIndex < endIndex) {
        return {
          useCerebellum: true,
          confidence: 1.0,
          reason: "Full Cerebellum Mode: processing content within <cb>...</cb> tags",
          taskType: "keyword_triggered",
          estimatedTokens: task.estimatedTokens,
          estimatedTime: 30,
          complexity: 2,
          precisionRequirement: "low",
        };
      }
    } else if (cbStartMatch && !cbEndMatch) {
      // 只有开始标签 <cb>，没有结束标签，默认全部使用小脑
      return {
        useCerebellum: true,
        confidence: 1.0,
        reason: "Full Cerebellum Mode: <cb> tag detected, all content processed by cerebellum",
        taskType: "keyword_triggered",
        estimatedTokens: task.estimatedTokens,
        estimatedTime: 30,
        complexity: 2,
        precisionRequirement: "low",
      };
    }

    // 2. 检查关键词触发：以"小脑"、"Cerebellum"或"cb"开头时强制使用小脑
    if (
      promptLower.startsWith("小脑") ||
      promptLower.startsWith("cerebellum") ||
      promptLower.startsWith("cb ") ||
      promptLower.startsWith("cb，") ||
      promptLower.startsWith("cb,")
    ) {
      return {
        useCerebellum: true,
        confidence: 1.0,
        reason: "Triggered by keyword: 小脑/Cerebellum/cb prefix",
        taskType: "keyword_triggered",
        estimatedTokens: task.estimatedTokens,
        estimatedTime: 30,
        complexity: 2,
        precisionRequirement: "low",
      };
    }

    // 强制使用小脑
    if (this.config.forceCerebellumFor.includes(task.type)) {
      return {
        useCerebellum: true,
        confidence: 1.0,
        reason: `Task type "${task.type}" is in forceCerebellumFor list`,
        taskType: task.type,
        estimatedTokens: task.estimatedTokens,
        estimatedTime: 30,
        complexity: 2,
        precisionRequirement: "low",
      };
    }

    // 强制使用大脑
    if (this.config.forceCerebrumFor.includes(task.type)) {
      return {
        useCerebellum: false,
        confidence: 1.0,
        reason: `Task type "${task.type}" is in forceCerebrumFor list`,
        taskType: task.type,
        estimatedTokens: task.estimatedTokens,
        estimatedTime: 300,
        complexity: 8,
        precisionRequirement: "high",
      };
    }

    return null;
  }

  /**
   * 任务分析结果
   */
  private analyzeTask(task: TaskInfo): TaskAnalysis {
    const prompt = task.prompt.toLowerCase();
    const promptLength = task.prompt.length;

    // 代码相关关键词
    const codeKeywords = [
      "code",
      "program",
      "function",
      "class",
      "debug",
      "error",
      "bug",
      "implement",
      "algorithm",
      "data structure",
      "api",
      "database",
      "refactor",
      "optimize",
      "performance",
    ];

    // 数学相关关键词
    const mathKeywords = [
      "calculate",
      "compute",
      "math",
      "equation",
      "formula",
      "solve",
      "statistics",
      "probability",
      "algebra",
      "calculus",
      "geometry",
    ];

    // 创意写作关键词
    const creativeKeywords = [
      "write",
      "story",
      "creative",
      "poem",
      "essay",
      "article",
      "blog",
      "content",
      "marketing",
      "copy",
      "fiction",
    ];

    // 分析关键词
    const analysisKeywords = [
      "analyze",
      "analysis",
      "research",
      "investigate",
      "study",
      "review",
      "evaluate",
      "assess",
      "compare",
      "contrast",
      "synthesize",
      "critique",
    ];

    // 规划关键词
    const planningKeywords = [
      "plan",
      "strategy",
      "roadmap",
      "schedule",
      "timeline",
      "project",
      "steps",
      "phases",
      "milestone",
      "goal",
    ];

    // 问候语关键词
    const greetingKeywords = [
      "hello",
      "hi",
      "hey",
      "good morning",
      "good afternoon",
      "good evening",
      "how are you",
      "what's up",
      "greetings",
    ];

    // 状态查询关键词
    const statusKeywords = [
      "status",
      "check",
      "health",
      "state",
      "condition",
      "progress",
      "update",
      "report",
      "summary",
    ];

    // 计算匹配度
    const hasCode = codeKeywords.some((kw) => prompt.includes(kw)) || task.hasCode;
    const hasMath = mathKeywords.some((kw) => prompt.includes(kw)) || task.hasMath;
    const hasCreative = creativeKeywords.some((kw) => prompt.includes(kw));
    const hasAnalysis = analysisKeywords.some((kw) => prompt.includes(kw));
    const hasPlanning = planningKeywords.some((kw) => prompt.includes(kw));
    const isGreeting = greetingKeywords.some((kw) => prompt.includes(kw));
    const isStatusQuery = statusKeywords.some((kw) => prompt.includes(kw));

    // 检测任务类型
    let detectedType: TaskType = "unknown";

    if (isGreeting && promptLength < 50) {
      detectedType = "greeting";
    } else if (isStatusQuery && promptLength < 100) {
      detectedType = "status_check";
    } else if (hasCode) {
      detectedType = "code_generation";
    } else if (hasMath) {
      detectedType = task.isScheduledTask ? "scheduled_task" : "complex_analysis";
    } else if (hasPlanning && promptLength > 200) {
      detectedType = "multi_step_planning";
    } else if (hasCreative && promptLength > 150) {
      detectedType = "creative_writing";
    } else if (hasAnalysis && promptLength > 300) {
      detectedType = "complex_analysis";
    } else if (promptLength < 150 && !hasCode && !hasMath) {
      detectedType = "simple_qa";
    } else if (task.isScheduledTask) {
      detectedType = "scheduled_task";
    }

    return {
      hasCode,
      hasMath,
      hasCreative,
      hasAnalysis,
      hasPlanning,
      isGreeting,
      isStatusQuery,
      detectedType,
      promptLength,
    };
  }

  /**
   * 计算复杂度分数 (1-10)
   */
  private calculateComplexity(task: TaskInfo, analysis: TaskAnalysis): number {
    let complexity = 1;

    // 基于任务类型的基础复杂度
    const typeComplexity: Record<TaskType, number> = {
      greeting: 1,
      status_check: 2,
      simple_qa: 2,
      scheduled_task: 3,
      text_summary: 3,
      format_conversion: 2,
      code_generation: 8,
      complex_analysis: 7,
      multi_step_planning: 8,
      creative_writing: 6,
      debugging: 7,
      research: 8,
      unknown: 5,
    };

    complexity = typeComplexity[analysis.detectedType] ?? 5;

    if (analysis.promptLength > 2000) {
      complexity += 1;
    }
    if (analysis.promptLength > 5000) {
      complexity += 1;
    }
    if (analysis.hasCode) {
      complexity += 1;
    }
    if (analysis.hasMath) {
      complexity += 1;
    }
    if (task.historyLength > 10) {
      complexity += 1;
    }
    if (task.historyLength > 30) {
      complexity += 1;
    }
    if (task.estimatedTokens > 2000) {
      complexity += 1;
    }
    if (task.estimatedTokens > 4000) {
      complexity += 1;
    }

    return Math.min(10, Math.max(1, complexity));
  }

  /**
   * 评估精度要求
   */
  private assessPrecisionRequirement(
    task: TaskInfo,
    analysis: TaskAnalysis,
  ): "high" | "medium" | "low" {
    if (analysis.hasCode || analysis.hasMath) {
      return "high";
    }

    if (analysis.hasAnalysis || analysis.hasCreative) {
      return "medium";
    }

    if (task.type === "simple_qa" || task.type === "greeting") {
      return "low";
    }

    return "medium";
  }

  /**
   * 预估执行时间 (秒)
   */
  private estimateExecutionTime(task: TaskInfo, complexity: number): number {
    // 基础时间
    let time = complexity * 30; // 30秒 per 复杂度点

    // 根据token调整
    if (task.estimatedTokens > 1000) {
      time += (task.estimatedTokens / 1000) * 60; // 每1000token增加60秒
    }

    // 本地模型比云端快
    if (this.config.enabled) {
      time = time * 0.6; // 本地模型快40%
    }

    return Math.round(time);
  }

  /**
   * 计算置信度 (0-1)
   */
  private calculateConfidence(task: TaskInfo, analysis: TaskAnalysis, complexity: number): number {
    let confidence = 0.5;

    // 明确的任务类型增加置信度
    if (analysis.detectedType !== "unknown") {
      confidence += 0.2;
    }

    // 低复杂度任务置信度更高
    if (complexity <= 3) {
      confidence += 0.2;
    } else if (complexity >= 8) {
      confidence -= 0.1;
    }

    // 短提示词更确定
    if (analysis.promptLength < 100) {
      confidence += 0.1;
    }

    // 高频任务更确定
    if (task.isHighFrequency) {
      confidence += 0.1;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * 决定是否使用小脑
   */
  private shouldUseCerebellum(
    task: TaskInfo,
    complexity: number,
    precisionRequirement: "high" | "medium" | "low",
    estimatedTime: number,
    confidence: number,
  ): boolean {
    // 阈值检查
    if (complexity > this.thresholds.maxComplexity) {
      return false;
    }

    if (estimatedTime > this.thresholds.maxEstimatedTime) {
      return false;
    }

    if (confidence < this.thresholds.minConfidence) {
      return false;
    }

    // 高精度要求使用大脑
    if (precisionRequirement === "high") {
      return false;
    }

    // 计划任务且时间短，使用小脑
    if (task.isScheduledTask && estimatedTime < 600) {
      return true;
    }

    // 高频简单任务使用小脑
    if (task.isHighFrequency && complexity <= 3) {
      return true;
    }

    // 默认：中低复杂度使用小脑
    return complexity <= 5;
  }

  /**
   * 生成决策原因说明
   */
  private generateReason(
    useCerebellum: boolean,
    task: TaskInfo,
    complexity: number,
    precisionRequirement: "high" | "medium" | "low",
    estimatedTime: number,
    confidence: number,
  ): string {
    if (useCerebellum) {
      const reasons: string[] = [];

      if (complexity <= 3) {
        reasons.push("low complexity");
      }
      if (task.isScheduledTask && estimatedTime < 600) {
        reasons.push("scheduled task under 10min");
      }
      if (task.isHighFrequency) {
        reasons.push("high frequency pattern");
      }
      if (precisionRequirement === "low") {
        reasons.push("low precision requirement");
      }

      return `Using cerebellum: ${reasons.join(", ") || "suitable for local model"}`;
    } else {
      const reasons: string[] = [];

      if (complexity > this.thresholds.maxComplexity) {
        reasons.push(`high complexity (${complexity}/${this.thresholds.maxComplexity})`);
      }
      if (estimatedTime > this.thresholds.maxEstimatedTime) {
        reasons.push(`long execution time (${Math.round(estimatedTime / 60)}min)`);
      }
      if (precisionRequirement === "high") {
        reasons.push("high precision requirement");
      }
      if (confidence < this.thresholds.minConfidence) {
        reasons.push(`low confidence (${confidence.toFixed(2)})`);
      }

      return `Using cerebrum: ${reasons.join(", ") || "task requires cloud model"}`;
    }
  }
}

/**
 * 任务分析结果接口
 */
interface TaskAnalysis {
  hasCode: boolean;
  hasMath: boolean;
  hasCreative: boolean;
  hasAnalysis: boolean;
  hasPlanning: boolean;
  isGreeting: boolean;
  isStatusQuery: boolean;
  detectedType: TaskType;
  promptLength: number;
}

/**
 * 创建任务评估器
 */
export function createTaskEvaluator(config: CerebellumConfig): TaskEvaluator {
  return new TaskEvaluator(config);
}
