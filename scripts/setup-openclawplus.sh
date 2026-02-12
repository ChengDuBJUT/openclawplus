#!/bin/bash
#
# OpenClawPlus Setup Script
# 自动安装和配置 Ollama + Qwen 0.5B 模型
#

set -e

echo "🧠 OpenClawPlus Setup Script"
echo "=============================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 安装 Ollama
install_ollama() {
    echo "📦 Installing Ollama..."
    
    if command_exists ollama; then
        echo -e "${GREEN}✓ Ollama is already installed${NC}"
        return 0
    fi

    # 检测操作系统
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -fsSL https://ollama.com/install.sh | sh
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command_exists brew; then
            brew install ollama
        else
            echo -e "${YELLOW}⚠ Homebrew not found. Installing Ollama manually...${NC}"
            curl -fsSL https://ollama.com/install.sh | sh
        fi
    else
        echo -e "${RED}✗ Unsupported operating system: $OSTYPE${NC}"
        echo "Please install Ollama manually from https://ollama.ai"
        exit 1
    fi

    echo -e "${GREEN}✓ Ollama installed successfully${NC}"
}

# 拉取模型
pull_model() {
    local model="${1:-qwen2.5:0.5b}"
    
    echo ""
    echo "📥 Pulling model: $model"
    echo "This may take a few minutes..."
    echo ""
    
    ollama pull "$model"
    
    echo -e "${GREEN}✓ Model $model pulled successfully${NC}"
}

# 启动 Ollama 服务
start_ollama() {
    echo ""
    echo "🚀 Starting Ollama service..."
    
    # 检查是否已经在运行
    if curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Ollama is already running${NC}"
        return 0
    fi
    
    # 启动服务
    ollama serve &
    local pid=$!
    
    # 等待服务启动
    echo "Waiting for Ollama to start..."
    local retries=0
    while ! curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; do
        sleep 1
        retries=$((retries + 1))
        if [ $retries -gt 30 ]; then
            echo -e "${RED}✗ Failed to start Ollama${NC}"
            kill $pid 2>/dev/null || true
            exit 1
        fi
    done
    
    echo -e "${GREEN}✓ Ollama is running (PID: $pid)${NC}"
}

# 测试模型
test_model() {
    echo ""
    echo "🧪 Testing model..."
    
    local response=$(curl -s http://127.0.0.1:11434/api/generate \
        -H "Content-Type: application/json" \
        -d '{
            "model": "qwen2.5:0.5b",
            "prompt": "Say hello",
            "stream": false
        }')
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Model is working${NC}"
        echo "Response: $(echo "$response" | grep -o '"response":"[^"]*"' | cut -d'"' -f4)"
    else
        echo -e "${RED}✗ Model test failed${NC}"
    fi
}

# 配置 OpenClaw
configure_openclaw() {
    echo ""
    echo "⚙️  Configuring OpenClaw..."
    
    local config_dir="$HOME/.openclaw"
    local config_file="$config_dir/openclaw.json"
    
    # 确保配置目录存在
    mkdir -p "$config_dir"
    
    # 检查现有配置
    if [ -f "$config_file" ]; then
        echo -e "${YELLOW}⚠ Configuration file already exists: $config_file${NC}"
        echo "Backing up to: $config_file.backup.$(date +%Y%m%d%H%M%S)"
        cp "$config_file" "$config_file.backup.$(date +%Y%m%d%H%M%S)"
    fi
    
    # 创建新配置
    cat > "$config_file" << 'EOF'
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
  },
  "agent": {
    "model": "anthropic/claude-3-5-sonnet-20241022"
  }
}
EOF
    
    echo -e "${GREEN}✓ Configuration saved to: $config_file${NC}"
}

# 显示状态
show_status() {
    echo ""
    echo "📊 Status"
    echo "========="
    
    # Ollama 版本
    if command_exists ollama; then
        echo "Ollama: $(ollama --version 2>/dev/null || echo 'installed')"
    else
        echo -e "Ollama: ${RED}not installed${NC}"
    fi
    
    # Ollama 服务状态
    if curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
        echo -e "Ollama Service: ${GREEN}running${NC}"
    else
        echo -e "Ollama Service: ${RED}not running${NC}"
    fi
    
    # 模型状态
    if curl -s http://127.0.0.1:11434/api/tags 2>/dev/null | grep -q "qwen2.5"; then
        echo -e "Qwen 0.5B Model: ${GREEN}available${NC}"
    else
        echo -e "Qwen 0.5B Model: ${RED}not available${NC}"
    fi
}

# 主函数
main() {
    local skip_ollama=false
    local skip_model=false
    local skip_config=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-ollama)
                skip_ollama=true
                shift
                ;;
            --skip-model)
                skip_model=true
                shift
                ;;
            --skip-config)
                skip_config=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-ollama    Skip Ollama installation"
                echo "  --skip-model     Skip model pulling"
                echo "  --skip-config    Skip configuration"
                echo "  --help, -h       Show this help message"
                echo ""
                echo "Example:"
                echo "  $0                           # Full setup"
                echo "  $0 --skip-ollama             # Setup without installing Ollama"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # 执行步骤
    if [ "$skip_ollama" = false ]; then
        install_ollama
    fi
    
    start_ollama
    
    if [ "$skip_model" = false ]; then
        pull_model "qwen2.5:0.5b"
    fi
    
    test_model
    
    if [ "$skip_config" = false ]; then
        configure_openclaw
    fi
    
    show_status
    
    echo ""
    echo -e "${GREEN}✓ OpenClawPlus setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run 'openclaw cerebellum status' to check status"
    echo "  2. Run 'openclaw cerebellum test' to test the model"
    echo "  3. Start chatting with your AI assistant!"
    echo ""
}

# 运行主函数
main "$@"
