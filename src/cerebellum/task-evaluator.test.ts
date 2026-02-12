import { describe, it, expect } from "vitest";
import type { TaskInfo } from "../cerebellum/types.js";
import { createTaskEvaluator, DEFAULT_CEREBELLUM_CONFIG } from "../cerebellum/index.js";

describe("TaskEvaluator", () => {
  const evaluator = createTaskEvaluator(DEFAULT_CEREBELLUM_CONFIG);

  describe("greeting tasks", () => {
    it("should route greeting to cerebellum", () => {
      const task: TaskInfo = {
        type: "greeting",
        prompt: "Hello there!",
        hasCode: false,
        hasMath: false,
        estimatedTokens: 50,
        isHighFrequency: true,
        historyLength: 0,
        isScheduledTask: false,
      };

      const assessment = evaluator.evaluate(task);

      expect(assessment.useCerebellum).toBe(true);
      expect(assessment.taskType).toBe("greeting");
      expect(assessment.confidence).toBeGreaterThan(0.5);
    });
  });

  describe("code generation tasks", () => {
    it("should route code generation to cerebrum", () => {
      const task: TaskInfo = {
        type: "code_generation",
        prompt: "Write a Python function to reverse a string",
        hasCode: true,
        hasMath: false,
        estimatedTokens: 500,
        isHighFrequency: false,
        historyLength: 0,
        isScheduledTask: false,
      };

      const assessment = evaluator.evaluate(task);

      expect(assessment.useCerebellum).toBe(false);
      expect(assessment.precisionRequirement).toBe("high");
    });
  });

  describe("simple QA tasks", () => {
    it("should route simple questions to cerebellum", () => {
      const task: TaskInfo = {
        type: "simple_qa",
        prompt: "What is the capital of France?",
        hasCode: false,
        hasMath: false,
        estimatedTokens: 100,
        isHighFrequency: true,
        historyLength: 0,
        isScheduledTask: false,
      };

      const assessment = evaluator.evaluate(task);

      expect(assessment.useCerebellum).toBe(true);
      expect(assessment.complexity).toBeLessThanOrEqual(5);
    });
  });

  describe("complex analysis tasks", () => {
    it("should route complex analysis to cerebrum", () => {
      const task: TaskInfo = {
        type: "complex_analysis",
        prompt:
          "Analyze the economic impact of artificial intelligence on global markets over the next decade",
        hasCode: false,
        hasMath: true,
        estimatedTokens: 2000,
        isHighFrequency: false,
        historyLength: 0,
        isScheduledTask: false,
      };

      const assessment = evaluator.evaluate(task);

      expect(assessment.useCerebellum).toBe(false);
      expect(assessment.complexity).toBeGreaterThan(5);
    });
  });

  describe("scheduled tasks", () => {
    it("should route short scheduled tasks to cerebellum", () => {
      const task: TaskInfo = {
        type: "scheduled_task",
        prompt: "Check disk space",
        hasCode: false,
        hasMath: false,
        estimatedTokens: 100,
        isHighFrequency: true,
        historyLength: 0,
        isScheduledTask: true,
      };

      const assessment = evaluator.evaluate(task);

      expect(assessment.useCerebellum).toBe(true);
      expect(assessment.taskType).toBe("scheduled_task");
    });
  });

  describe("complexity calculation", () => {
    it("should calculate higher complexity for code tasks", () => {
      const codeTask: TaskInfo = {
        type: "unknown",
        prompt: "Implement a binary search tree with insertion and deletion",
        hasCode: true,
        hasMath: false,
        estimatedTokens: 1000,
        isHighFrequency: false,
        historyLength: 0,
        isScheduledTask: false,
      };

      const simpleTask: TaskInfo = {
        type: "unknown",
        prompt: "What time is it?",
        hasCode: false,
        hasMath: false,
        estimatedTokens: 50,
        isHighFrequency: true,
        historyLength: 0,
        isScheduledTask: false,
      };

      const codeAssessment = evaluator.evaluate(codeTask);
      const simpleAssessment = evaluator.evaluate(simpleTask);

      expect(codeAssessment.complexity).toBeGreaterThan(simpleAssessment.complexity);
    });

    it("should increase complexity with prompt length", () => {
      const shortTask: TaskInfo = {
        type: "unknown",
        prompt: "Short prompt",
        hasCode: false,
        hasMath: false,
        estimatedTokens: 100,
        isHighFrequency: false,
        historyLength: 0,
        isScheduledTask: false,
      };

      const longTask: TaskInfo = {
        type: "unknown",
        prompt: "A".repeat(3000),
        hasCode: false,
        hasMath: false,
        estimatedTokens: 800,
        isHighFrequency: false,
        historyLength: 0,
        isScheduledTask: false,
      };

      const shortAssessment = evaluator.evaluate(shortTask);
      const longAssessment = evaluator.evaluate(longTask);

      expect(longAssessment.complexity).toBeGreaterThanOrEqual(shortAssessment.complexity);
    });
  });

  describe("confidence calculation", () => {
    it("should have higher confidence for clear task types", () => {
      const greetingTask: TaskInfo = {
        type: "greeting",
        prompt: "Hello",
        hasCode: false,
        hasMath: false,
        estimatedTokens: 10,
        isHighFrequency: true,
        historyLength: 0,
        isScheduledTask: false,
      };

      const vagueTask: TaskInfo = {
        type: "unknown",
        prompt: "Do something",
        hasCode: false,
        hasMath: false,
        estimatedTokens: 100,
        isHighFrequency: false,
        historyLength: 0,
        isScheduledTask: false,
      };

      const greetingAssessment = evaluator.evaluate(greetingTask);
      const vagueAssessment = evaluator.evaluate(vagueTask);

      expect(greetingAssessment.confidence).toBeGreaterThan(vagueAssessment.confidence);
    });
  });

  describe("precision requirement", () => {
    it("should require high precision for math tasks", () => {
      const mathTask: TaskInfo = {
        type: "unknown",
        prompt: "Calculate the compound interest on $1000 at 5% for 10 years",
        hasCode: false,
        hasMath: true,
        estimatedTokens: 200,
        isHighFrequency: false,
        historyLength: 0,
        isScheduledTask: false,
      };

      const assessment = evaluator.evaluate(mathTask);

      expect(assessment.precisionRequirement).toBe("high");
    });

    it("should require low precision for simple QA", () => {
      const qaTask: TaskInfo = {
        type: "simple_qa",
        prompt: "What is the weather like?",
        hasCode: false,
        hasMath: false,
        estimatedTokens: 100,
        isHighFrequency: true,
        historyLength: 0,
        isScheduledTask: false,
      };

      const assessment = evaluator.evaluate(qaTask);

      expect(assessment.precisionRequirement).toBe("low");
    });
  });
});
