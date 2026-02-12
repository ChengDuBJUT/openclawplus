# OpenClawPlus 双内核架构设计文档

## 1. 架构概述

OpenClawPlus 引入"小脑"(Cerebellum)概念，构建双内核 AI 系统：

- **大脑 (Cerebrum)**：现有主 API（Anthropic/OpenAI 等云端大模型）
- **小脑 (Cerebellum)**：本地运行的轻量级模型（Ollama + Qwen 0.5B）

```
                    ┌─────────────────────────────────────┐
                    │           OpenClawPlus              │
                    │           (Gateway)                 │
                    └───────────────┬─────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
    ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐
    │  任务评估器      │   │   小脑 (本地)     │   │  大脑 (云端)  │
    │ TaskEvaluator   │   │  Cerebellum      │   │  Cerebrum    │
    └────────┬────────┘   └────────┬─────────┘   └──────┬───────┘
             │                     │                    │
             └────────────┬────────┴────────────────────┘
                          │
                    路由决策 (Router)
```

## 2. 核心组件

### 2.1 任务评估器 (TaskEvaluator)

评估维度：

- **任务类型**：代码/分析/创意/简单问答/计划任务
- **预期执行时间**：<20分钟（小脑），>20分钟（大脑）
- **复杂度评分**：1-10分
- **精度要求**：高（数学/逻辑）、中（分析）、低（闲聊）
- **频率**：高频重复任务优先小脑

评估规则：

```typescript
interface TaskAssessment {
  useCerebellum: boolean; // 是否使用小脑
  confidence: number; // 置信度 0-1
  reason: string; // 决策原因
  estimatedTokens: number; // 预估token消耗
  estimatedTime: number; // 预估执行时间(秒)
}

// 小脑适用条件：
// 1. 高频计划任务 (<20分钟)
// 2. 非精确逻辑运算
// 3. 简单问答/闲聊
// 4. 重复性模板任务
// 5. 本地数据处理
```

### 2.2 小脑内核 (Cerebellum)

**默认配置**：

- Provider: Ollama
- Model: qwen2.5:0.5b
- 本地部署，零 API 费用
- 响应快速，适合简单任务

**能力范围**：

- 简单问答
- 文本摘要
- 格式转换
- 基础数据分析
- 计划任务执行
- 会话状态管理

**限制**：

- 不支持复杂逻辑推理
- 不支持代码生成
- 不支持多步规划
- 上下文窗口较小

### 2.3 路由层 (Router)

职责：

1. 接收所有 AI 请求
2. 调用 TaskEvaluator 评估
3. 根据评估结果选择内核
4. 记录决策日志
5. 支持手动覆盖

## 3. 集成点

### 3.1 修改文件清单

```
src/
├── cerebellum/                    # 新增：小脑模块
│   ├── index.ts                   # 模块导出
│   ├── cerebellum-kernel.ts       # 小脑内核实现
│   ├── task-evaluator.ts          # 任务评估器
│   ├── router.ts                  # 路由层
│   ├── types.ts                   # 类型定义
│   └── config.ts                  # 小脑配置
├── agents/
│   └── pi-embedded-runner/
│       └── run.ts                 # 修改：集成路由调用
├── config/
│   ├── types.ts                   # 修改：添加小脑配置类型
│   └── zod-schema.ts              # 修改：添加配置验证
└── cli/
    └── models-cli.ts              # 修改：添加小脑状态查看
```

### 3.2 配置扩展

```json5
// openclaw.json 配置示例
{
  cerebellum: {
    enabled: true, // 是否启用小脑
    provider: "ollama", // 提供商
    model: "qwen2.5:0.5b", // 模型名称
    baseUrl: "http://127.0.0.1:11434", // Ollama 地址

    // 任务评估阈值
    thresholds: {
      maxEstimatedTime: 1200, // 20分钟 = 1200秒
      maxComplexity: 4, // 复杂度阈值
      minConfidence: 0.7, // 最小置信度
    },

    // 强制使用小脑的场景
    forceCerebellumFor: [
      "greeting", // 问候语
      "status_check", // 状态查询
      "simple_qa", // 简单问答
      "scheduled_task", // 计划任务
    ],

    // 强制使用大脑的场景
    forceCerebrumFor: [
      "code_generation", // 代码生成
      "complex_analysis", // 复杂分析
      "multi_step_planning", // 多步规划
      "creative_writing", // 创意写作
    ],

    // 统计和监控
    stats: {
      enabled: true,
      logPath: "~/.openclaw/cerebellum-stats.json",
    },
  },
}
```

## 4. 实施步骤

### Phase 1: 基础架构 (已完成)

- [x] 探索现有代码结构
- [x] 理解 AI 调用流程
- [x] 确认 Ollama 已有支持

### Phase 2: 小脑模块实现

1. 创建 `src/cerebellum/` 目录结构
2. 实现 `CerebellumKernel` 类
3. 实现 `TaskEvaluator` 评估器
4. 实现 `Router` 路由层

### Phase 3: 集成现有系统

1. 修改 `pi-embedded-runner/run.ts`
2. 在调用 AI 前插入路由决策
3. 保持向后兼容

### Phase 4: 配置系统

1. 扩展配置类型
2. 添加配置验证
3. 实现配置热更新

### Phase 5: CLI 和监控

1. 添加 `openclaw cerebellum status` 命令
2. 添加统计和报告功能
3. 添加手动切换命令

### Phase 6: 测试和文档

1. 单元测试
2. 集成测试
3. 编写用户文档

## 5. 预期收益

### 成本节约

- 简单任务使用本地模型，减少 60-80% API 调用
- 高频重复任务零成本运行
- 预估节省 $50-200/月（视使用量）

### 性能提升

- 简单任务响应时间 < 1秒（本地）
- 减少云端 API 等待时间
- 离线可用性

### 用户体验

- 更快的简单问答响应
- 透明的内核切换（用户无感知）
- 可手动选择内核

## 6. 风险评估

### 技术风险

- **模型能力限制**：小脑模型可能处理不了某些"看似简单"的任务
  - 缓解：完善的评估器 + 失败回退机制
- **本地资源消耗**：Ollama 需要本地 CPU/GPU
  - 缓解：可选功能，自动检测资源可用性
- **延迟增加**：评估器增加了一次 LLM 调用
  - 缓解：使用轻量级启发式规则进行初步筛选

### 业务风险

- **用户体验不一致**：小脑和大脑回复质量差异
  - 缓解：清晰的能力边界 + 自动回退
- **配置复杂性**：增加配置选项
  - 缓解：合理的默认值 + 自动配置

## 7. 成功指标

1. **成本指标**：API 调用费用减少 >50%
2. **性能指标**：简单任务响应时间 < 2秒
3. **质量指标**：用户满意度不下降（通过反馈收集）
4. **采用率**：小脑使用率 >40% 的简单任务

## 8. 未来扩展

1. **多小脑支持**：不同的本地模型用于不同场景
2. **智能学习**：根据历史数据优化评估器
3. **模型微调**：针对特定任务微调小脑模型
4. **分布式小脑**：局域网内共享小脑服务
