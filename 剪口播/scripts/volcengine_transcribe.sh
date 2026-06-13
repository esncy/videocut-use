#!/bin/bash
#
# 火山引擎录音文件识别大模型版（v3 API）
# 文档: https://www.volcengine.com/docs/6561/1354868
#
# 用法: ./volcengine_transcribe.sh <audio_url>
# 输出: volcengine_result.json
#

AUDIO_URL="$1"

if [ -z "$AUDIO_URL" ]; then
  echo "❌ 用法: ./volcengine_transcribe.sh <audio_url>"
  exit 1
fi

# 获取 API Key
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$(dirname "$(dirname "$SCRIPT_DIR")")/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 找不到 $ENV_FILE"
  echo "请创建 .env 并填入 VOLCENGINE_API_KEY=你的key"
  exit 1
fi

API_KEY=$(grep '^VOLCENGINE_API_KEY=' "$ENV_FILE" | head -1 | cut -d'=' -f2-)

if [ -z "$API_KEY" ]; then
  echo "❌ VOLCENGINE_API_KEY 未配置"
  exit 1
fi

echo "🎤 提交火山引擎转录任务..."
echo "音频 URL: $AUDIO_URL"

# 生成请求 ID
REQUEST_ID=$(uuidgen 2>/dev/null || node -e "console.log(require('crypto').randomUUID())")

# 步骤1: 提交任务（v3 API）
SUBMIT_HEADERS=$(mktemp)
curl -s -D "$SUBMIT_HEADERS" -L -X POST 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit' \
  -H 'Content-Type: application/json' \
  -H "x-api-key: $API_KEY" \
  -H 'X-Api-Resource-Id: volc.seedasr.auc' \
  -H "X-Api-Request-Id: $REQUEST_ID" \
  -H 'X-Api-Sequence: -1' \
  -d "{
    \"user\": {\"uid\": \"豆包语音\"},
    \"audio\": {\"url\": \"$AUDIO_URL\", \"format\": \"mp3\", \"codec\": \"raw\", \"rate\": 16000, \"bits\": 16, \"channel\": 1},
    \"request\": {\"model_name\": \"bigmodel\", \"enable_itn\": true, \"enable_punc\": false, \"enable_ddc\": false, \"enable_speaker_info\": false, \"enable_channel_split\": false, \"show_utterances\": true, \"vad_segment\": false, \"sensitive_words_filter\": \"\"}
  }" > /dev/null

STATUS=$(grep -i "^x-api-status-code:" "$SUBMIT_HEADERS" | awk '{print $2}' | tr -d '\r')
rm -f "$SUBMIT_HEADERS"

if [ "$STATUS" != "20000000" ]; then
  echo "❌ 提交失败，状态码: $STATUS"
  exit 1
fi

echo "✅ 任务已提交，Request ID: $REQUEST_ID"
echo "⏳ 等待转录完成..."

# 步骤2: 轮询结果
MAX_ATTEMPTS=120
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  sleep 3
  ATTEMPT=$((ATTEMPT + 1))

  QUERY_HEADERS=$(mktemp)
  QUERY_BODY=$(mktemp)
  curl -s -D "$QUERY_HEADERS" -o "$QUERY_BODY" -L -X POST 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query' \
    -H 'Content-Type: application/json' \
    -H "x-api-key: $API_KEY" \
    -H 'X-Api-Resource-Id: volc.seedasr.auc' \
    -H "X-Api-Request-Id: $REQUEST_ID" \
    -d '{}'

  STATUS=$(grep -i "^x-api-status-code:" "$QUERY_HEADERS" | awk '{print $2}' | tr -d '\r')
  rm -f "$QUERY_HEADERS"

  if [ "$STATUS" = "20000000" ]; then
    # 成功完成 — 转换为 generate_subtitles.js 期望的格式
    cat "$QUERY_BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
result = data.get('result', data)
converted = {
    'utterances': result.get('utterances', []),
    'text': result.get('text', ''),
    'audio_info': data.get('audio_info', {})
}
json.dump(converted, sys.stdout, ensure_ascii=False, indent=2)
" > volcengine_result.json
    rm -f "$QUERY_BODY"
    echo "✅ 转录完成，已保存 volcengine_result.json"

    UTTERANCES=$(python3 -c "import json; print(len(json.load(open('volcengine_result.json')).get('utterances',[])))")
    echo "📝 识别到 $UTTERANCES 段语音"
    exit 0
  elif [ "$STATUS" = "20000001" ] || [ "$STATUS" = "20000002" ]; then
    # 处理中
    rm -f "$QUERY_BODY"
    echo -n "."
  else
    echo ""
    echo "❌ 查询失败，状态码: $STATUS"
    cat "$QUERY_BODY" 2>/dev/null
    rm -f "$QUERY_BODY"
    exit 1
  fi
done

echo ""
echo "❌ 超时，任务未完成"
exit 1
