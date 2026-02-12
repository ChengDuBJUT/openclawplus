#!/bin/bash
# OpenClaw+ Template Fix Script
mkdir -p /root/docs/reference/templates
if [ ! -f '/root/docs/reference/templates/AGENTS.md' ]; then
    cp /root/openclaw/docs/reference/templates/AGENTS.md /root/docs/reference/templates/
    echo 'AGENTS.md template copied successfully'
fi
