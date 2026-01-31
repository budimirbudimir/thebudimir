#!/bin/bash
# Start Ollama with optimized settings for AMD Ryzen AI 7 350 + Radeon 860M

# Load environment variables
export $(cat $(dirname "$0")/../.env | grep -v '^#' | xargs)

# GPU Configuration (AMD ROCm)
export OLLAMA_GPU_OVERHEAD=0
export HSA_OVERRIDE_GFX_VERSION=11.0.0
export OLLAMA_NUM_GPU=999

# CPU Configuration (use 8 threads = 50% of 16)
export OLLAMA_NUM_THREAD=8

# Memory Management
export OLLAMA_MAX_LOADED_MODELS=1
export OLLAMA_KEEP_ALIVE=10m

# Context and Performance
export OLLAMA_NUM_CTX=4096
export OLLAMA_NUM_BATCH=512
export OLLAMA_NUM_PARALLEL=2

# Start Ollama
echo "🚀 Starting Ollama with optimized settings..."
echo "   GPU: AMD Radeon 860M (ROCm enabled)"
echo "   CPU: 8 threads (50% of available)"
echo "   Vision Model: $OLLAMA_VISION_MODEL"
echo ""

ollama serve
