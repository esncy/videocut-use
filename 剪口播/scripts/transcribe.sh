#!/bin/bash
#
# 统一转录入口：根据 .env 配置选择火山引擎或 FunASR
#
# 用法: ./transcribe.sh <audio_file> [output.json]
#

AUDIO="$1"
OUTPUT="${2:-volcengine_result.json}"

if [ -z "$AUDIO" ]; then
  echo "❌ 用法: ./transcribe.sh <audio_file> [output.json]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$(dirname "$(dirname "$SCRIPT_DIR")")/.env"

# 读取配置
MODE="volcengine"
FUNASR_PYTHON_DEFAULT="python3"
if [ -f "$ENV_FILE" ]; then
  M=$(grep '^TRANSCRIPTION_MODE=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d ' ')
  [ -n "$M" ] && MODE="$M"
  P=$(grep '^FUNASR_PYTHON=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)
  [ -n "$P" ] && FUNASR_PYTHON_DEFAULT="$P"
fi

echo "📋 转录模式: $MODE"

if [ "$MODE" = "funasr" ]; then
  # 本地 FunASR
  FUNASR_PYTHON="${FUNASR_PYTHON:-$FUNASR_PYTHON_DEFAULT}"
  "$FUNASR_PYTHON" "$SCRIPT_DIR/funasr_transcribe.py" "$AUDIO" "$OUTPUT"
else
  # 火山引擎云端 ASR
  bash "$SCRIPT_DIR/volcengine_transcribe.sh" "$AUDIO"
fi
