# 🧠 OpenClawPlus - 双内核 AI 架构

OpenClawPlus 是 OpenClaw 的增强版本，引入了**小脑 (Cerebellum)** 概念，实现了双内核 AI 架构：

- **大脑 (Cerebrum)**: 云端大模型（Anthropic Claude、OpenAI GPT 等）- 处理复杂任务
- **小脑 (Cerebellum)**: 本地轻量模型（Ollama + Qwen 0.5B）- 处理简单高频任务

## 核心优势

### 💰 成本节约

- 简单任务使用本地模型，减少 **60-80%** API 调用费用
- 高频重复任务零成本运行
- 预估节省 $50-200/月（视使用量）

### ⚡ 性能提升

- 简单任务响应时间 < 1秒（本地运行）
- 减少云端 API 等待时间
- 离线可用性

### 🎯 智能路由

- 自动评估任务复杂度
- 智能选择最佳内核
- 支持手动覆盖

## 架构图

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
    └─────────────────┘   └──────────────────┘   └──────────────┘

    评估维度：               Ollama + Qwen:           Anthropic/
    - 任务类型              - 零 API 费用            OpenAI/
    - 执行时间              - 响应 < 1秒             Claude/GPT
    - 复杂度                - 适合简单任务           - 处理复杂任务
    - 精度要求
```

## 快速开始

### 1. 一键安装脚本

```bash
# 下载并运行安装脚本
curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw/main/scripts/setup-openclawplus.sh | bash

# 或者克隆仓库后运行
./scripts/setup-openclawplus.sh
```

### 2. 手动安装

#### 安装 Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

#### 拉取模型

```bash
ollama pull qwen2.5:0.5b
```

#### 配置 OpenClawPlus

在 `~/.openclaw/openclaw.json` 中添加：

```json
{
  "cerebellum": {
    "enabled": true,
    "provider": "ollama",
    "model": "qwen2.5:0.5b",
    "baseUrl": "http://127.0.0.1:11434",
    "thresholds": {
      "maxEstimatedTime": 1200,
      "maxComplexity": 4,
      "minConfidence": 0.7
    },
    "forceCerebellumFor": [
      "greeting",
      "status_check",
      "simple_qa",
      "scheduled_task",
      "text_summary",
      "format_conversion"
    ],
    "forceCerebrumFor": [
      "code_generation",
      "complex_analysis",
      "multi_step_planning",
      "creative_writing",
      "debugging",
      "research"
    ],
    "stats": {
      "enabled": true,
      "logPath": "~/.openclaw/cerebellum-stats.json"
    }
  }
}
```

### 3. 验证安装

```bash
# 检查小脑状态
openclaw cerebellum status

# 测试小脑
openclaw cerebellum test --prompt "Hello!"

# 查看统计
openclaw cerebellum stats
```

## CLI 命令

### 基础命令

```bash
# 查看小脑状态
openclaw cerebellum status

# 测试小脑响应
openclaw cerebellum test
openclaw cerebellum test --prompt "What is the weather?"

# 拉取模型
openclaw cerebellum pull
openclaw cerebellum pull --model llama3.2:1b
```

### 评估和统计

```bash
# 评估任务路由决策
openclaw cerebellum evaluate "Hello, how are you?"
openclaw cerebellum evaluate "Write a Python function to sort a list"

# 查看统计信息
openclaw cerebellum stats

# 重置统计
openclaw cerebellum stats --reset
```

### 配置帮助

```bash
# 显示配置示例
openclaw cerebellum setup
```

## 任务评估规则

小脑会自动评估每个任务，决定是否使用本地模型：

### 使用小脑的条件

- ✓ 问候语、简单问答
- ✓ 状态查询
- ✓ 文本摘要
- ✓ 格式转换
- ✓ 预估执行时间 < 20分钟
- ✓ 复杂度 <= 4/10
- ✓ 非代码/数学任务

### 使用大脑的条件

- ✗ 代码生成、调试
- ✗ 复杂分析
- ✗ 多步规划
- ✗ 创意写作
- ✗ 数学/逻辑运算
- ✗ 高精度要求任务

## 配置详解

### 完整配置示例

```json
{
  "cerebellum": {
    "enabled": true,
    "provider": "ollama",
    "model": "qwen2.5:0.5b",
    "baseUrl": "http://127.0.0.1:11434",

    "thresholds": {
      "maxEstimatedTime": 1200,
      "maxComplexity": 4,
      "minConfidence": 0.7
    },

    "forceCerebellumFor": [
      "greeting",
      "status_check",
      "simple_qa",
      "scheduled_task",
      "text_summary",
      "format_conversion"
    ],

    "forceCerebrumFor": [
      "code_generation",
      "complex_analysis",
      "multi_step_planning",
      "creative_writing",
      "debugging",
      "research"
    ],

    "stats": {
      "enabled": true,
      "logPath": "~/.openclaw/cerebellum-stats.json"
    }
  }
}
```

### 配置项说明

| 配置项                        | 类型     | 默认值                              | 说明                   |
| ----------------------------- | -------- | ----------------------------------- | ---------------------- |
| `enabled`                     | boolean  | true                                | 是否启用小脑           |
| `provider`                    | string   | "ollama"                            | 本地模型提供商         |
| `model`                       | string   | "qwen2.5:0.5b"                      | 模型名称               |
| `baseUrl`                     | string   | "http://127.0.0.1:11434"            | Ollama 服务地址        |
| `thresholds.maxEstimatedTime` | number   | 1200                                | 最大预估执行时间（秒） |
| `thresholds.maxComplexity`    | number   | 4                                   | 最大复杂度（1-10）     |
| `thresholds.minConfidence`    | number   | 0.7                                 | 最小置信度（0-1）      |
| `forceCerebellumFor`          | string[] | [...]                               | 强制使用小脑的任务类型 |
| `forceCerebrumFor`            | string[] | [...]                               | 强制使用大脑的任务类型 |
| `stats.enabled`               | boolean  | true                                | 是否启用统计           |
| `stats.logPath`               | string   | "~/.openclaw/cerebellum-stats.json" | 统计日志路径           |

## 支持的模型

### 推荐模型

| 模型         | 大小 | 特点         | 适用场景       |
| ------------ | ---- | ------------ | -------------- |
| qwen2.5:0.5b | 0.5B | 超轻量、快速 | 简单问答、摘要 |
| qwen2.5:1.5b | 1.5B | 轻量、平衡   | 一般任务       |
| llama3.2:1b  | 1B   | 英文优化     | 英文场景       |
| phi3:mini    | 3.8B | 微软出品     | 代码辅助       |

### 切换模型

```bash
# 拉取新模型
ollama pull qwen2.5:1.5b

# 修改配置
openclaw config set cerebellum.model qwen2.5:1.5b
```

## 性能对比

### 响应时间

| 任务类型 | 小脑 (本地) | 大脑 (云端) | 提升      |
| -------- | ----------- | ----------- | --------- |
| 简单问答 | 200-500ms   | 1-3s        | **5-10x** |
| 文本摘要 | 500ms-1s    | 2-5s        | **3-5x**  |
| 代码生成 | N/A         | 3-10s       | -         |

### 成本节约

| 月使用量         | 仅大脑 | 双内核 | 节约    |
| ---------------- | ------ | ------ | ------- |
| 轻量 (1K 请求)   | $30    | $10    | **67%** |
| 中等 (10K 请求)  | $150   | $50    | **67%** |
| 重度 (100K 请求) | $1200  | $400   | **67%** |

_基于 Claude 3.5 Sonnet 平均费用估算_

## 故障排除

### 常见问题

#### 1. Ollama 无法启动

```bash
# 检查端口占用
lsof -i :11434

# 手动启动 Ollama
ollama serve
```

#### 2. 模型下载失败

```bash
# 手动拉取模型
ollama pull qwen2.5:0.5b

# 检查网络连接
curl -I https://ollama.ai
```

#### 3. 小脑响应慢

```bash
# 检查系统资源
top  # macOS/Linux

# 使用更小模型
openclaw config set cerebellum.model qwen2.5:0.5b
```

#### 4. 任务路由错误

```bash
# 测试任务评估
openclaw cerebellum evaluate "你的任务描述"

# 调整阈值
openclaw config set cerebellum.thresholds.maxComplexity 5
```

## 开发文档

### 项目结构

```
src/cerebellum/
├── index.ts              # 模块入口
├── types.ts              # 类型定义
├── cerebellum-kernel.ts  # 小脑内核
├── task-evaluator.ts     # 任务评估器
├── router.ts             # 路由层
└── stats-collector.ts    # 统计收集
```

### 核心 API

```typescript
import { createDualKernelRouter, createTaskEvaluator, createCerebellumKernel } from "./cerebellum";

// 创建路由器
const router = createDualKernelRouter({ config, enableFallback: true });

// 路由任务
const result = await router.route({
  type: "simple_qa",
  prompt: "Hello!",
  hasCode: false,
  hasMath: false,
  estimatedTokens: 100,
  isHighFrequency: true,
  historyLength: 0,
  isScheduledTask: false,
});

// 结果
// result.target: "cerebellum" | "cerebrum"
// result.assessment: TaskAssessment
// result.cerebellumResponse?: CerebellumResponse
```

## 贡献指南

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

MIT License - 详见 [LICENSE](../LICENSE)

## 致谢

- [OpenClaw](https://github.com/openclaw/openclaw) - 基础项目
- [Ollama](https://ollama.ai) - 本地模型运行环境
- [Qwen](https://github.com/QwenLM/Qwen) - 通义千问模型

---

<p align="center">
  <strong>🦞 OpenClawPlus - 更聪明、更快速、更省钱</strong>
</p>
