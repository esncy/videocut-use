#!/usr/bin/env python3
"""
FunASR 本地转录（替代火山引擎云端 ASR）

输出格式与 volcengine_transcribe.sh 完全一致，
generate_subtitles.js 无需改动。

用法: python funasr_transcribe.py <audio_file> [output.json]
默认输出: volcengine_result.json
"""

import sys
import json
import os

def main():
    if len(sys.argv) < 2:
        print("❌ 用法: python funasr_transcribe.py <audio_file> [output.json]")
        sys.exit(1)

    audio_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "volcengine_result.json"

    if not os.path.exists(audio_file):
        print(f"❌ 找不到音频文件: {audio_file}")
        sys.exit(1)

    print(f"🎤 FunASR 本地转录...")
    print(f"音频: {audio_file}")

    from funasr import AutoModel

    # 加载模型（首次会自动下载，约 1GB）
    print("⏳ 加载 paraformer-zh 模型...")
    model = AutoModel(
        model="paraformer-zh",
        vad_model="fsmn-vad",
        punc_model="ct-punc",
        model_revision="v2.0.4",
        vad_model_revision="v2.0.4",
        punc_model_revision="v2.0.4",
    )

    # 转录（返回字级别时间戳）
    print("⏳ 转录中...")
    result = model.generate(
        input=audio_file,
        batch_size_s=300,
        hotword="",
    )

    if not result or len(result) == 0:
        print("❌ 转录失败：无结果")
        sys.exit(1)

    # 转换为 Volcengine 兼容格式
    utterances = []
    all_text = []

    for item in result:
        # item 结构因 FunASR 版本而异，兼容处理
        text = item.get("text", "")
        all_text.append(text)

        # 获取句子级别时间戳
        sentence_start = item.get("timestamp", [[0]])[0][0] if item.get("timestamp") else 0
        sentence_end = item.get("timestamp", [[0]])[-1][1] if item.get("timestamp") else 0

        # 构建 words 数组
        words = []
        if "timestamp" in item and item["timestamp"]:
            # 每个 timestamp 是 [start_ms, end_ms] 对应一个字
            chars = list(text.replace(" ", ""))
            timestamps = item["timestamp"]
            for i, ts in enumerate(timestamps):
                if i < len(chars):
                    words.append({
                        "text": chars[i],
                        "start_time": int(ts[0]),
                        "end_time": int(ts[1]),
                    })

        utterance = {
            "text": text,
            "start_time": int(sentence_start),
            "end_time": int(sentence_end),
            "words": words,
            "additions": {},
        }
        utterances.append(utterance)

    # 输出格式
    output = {
        "utterances": utterances,
        "text": "".join(all_text),
        "audio_info": {},
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    total_words = sum(len(u["words"]) for u in utterances)
    print(f"✅ 转录完成，已保存 {output_file}")
    print(f"📝 识别到 {len(utterances)} 段语音，{total_words} 个词")


if __name__ == "__main__":
    main()
