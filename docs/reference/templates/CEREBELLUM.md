---
title: "CEREBELLUM.md - Cerebellum Usage Guide"
summary: "How to use the local AI (Cerebellum) for fast, lightweight tasks"
read_when:
  - Starting a new session
  - Need to trigger local AI processing
---

# CEREBELLUM.md - Local AI Quick Guide

This guide explains how to use the **Cerebellum** (小脑) - OpenClaw+'s local AI for fast, lightweight tasks.

## What is Cerebellum?

The **Cerebellum** is a lightweight local AI that runs on your machine. It's perfect for:

- Quick questions and answers
- Simple calculations
- Text summaries
- Format conversions
- Status checks
- Greetings and casual conversations

**Benefits:**

- ⚡ **Fast** - No network latency
- 🔒 **Private** - Data stays on your machine
- 💰 **Free** - No API costs
- 🌐 **Offline** - Works without internet

## How to Trigger Cerebellum

You can trigger the Cerebellum in several ways:

### Method 1: Prefix Keywords (Quick Trigger)

Start your message with any of these keywords:

```
小脑 [your question]
Cerebellum [your question]
cb [your question]
```

**Examples:**

```
小脑 告诉我今天的天气如何？
Cerebellum explain quantum computing in simple terms
cb calculate 15% of 230
```

### Method 2: Full Cerebellum Mode (Tags)

Use XML-style tags to process content entirely with Cerebellum:

```
<cb>Your content here</cb>
```

**Example:**

```
<cb>Please summarize this long text for me...</cb>
```

**Note:** If you open a `<cb>` tag without closing it, all subsequent content will be processed by Cerebellum.

## When to Use Cerebellum vs Cerebrum

### Use **Cerebellum** for:

- ✅ Simple Q&A
- ✅ Quick calculations
- ✅ Text summaries
- ✅ Format conversions
- ✅ Status checks
- ✅ Greetings
- ✅ Scheduled tasks

### Use **Cerebrum** (Cloud AI) for:

- 🔧 Complex code generation
- 🔬 Deep analysis
- 📝 Creative writing
- 🐛 Debugging complex issues
- 🔍 Research tasks
- 🧩 Multi-step planning

## Cerebellum Commands

Check Cerebellum status:

```bash
openclaw cerebellum status
```

Test Cerebellum:

```bash
openclaw cerebellum test
```

Evaluate a task (see which AI will be used):

```bash
openclaw cerebellum evaluate "your task here"
```

View statistics:

```bash
openclaw cerebellum stats
```

## Tips

1. **Use `cb` for quick tasks** - It's the fastest way to trigger local AI
2. **Use `<cb>...</cb>` for batch processing** - Process multiple paragraphs locally
3. **Cerebellum is smart** - It will automatically handle simple tasks even without keywords
4. **Fallback available** - If Cerebellum fails, it automatically falls back to Cerebrum

## Examples in Action

```
User: cb what's 2+2?
AI (Cerebellum): The answer is 4.

User: Cerebellum, summarize this article
AI (Cerebellum): [Quick summary using local model]

User: <cb>Write a Python function to calculate fibonacci</cb>
AI (Cerebellum): [Code generated locally]
```

## Configuration

Cerebellum uses **Ollama** as the local AI provider with the `qwen2.5:0.5b` model by default.

To customize, edit your `~/.openclaw/config.json`:

```json
{
  "cerebellum": {
    "enabled": true,
    "provider": "ollama",
    "model": "qwen2.5:0.5b",
    "baseUrl": "http://127.0.0.1:11434"
  }
}
```

---

**Remember:** Start with `cb` or `小脑` for quick local processing, use `<cb>...</cb>` for full local mode!
