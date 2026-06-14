---
name: videocut-use:剪口播
description: 口播视频转录和口误识别（增强版：字幕叠加+波形显示+拖动分栏）。触发词：剪口播、处理视频、识别口误、videocut-use
---

> 本 skill 是 videocut-use 的入口，增强版审核页面。

请读取以下文件获取完整指令：

@剪口播/SKILL.md

## 增强功能（相比原版 videocut）

审核页面新增：
- 视频字幕叠加预览（当前字幕实时显示在视频画面上）
- 音频波形显示（专业编辑器风格，深灰背景+绿色波形线）
- 字幕-波形双向联动（选中字幕→波形变红，波形框选→选中字幕）
- 左右可拖动分栏（默认 50/50，双击重置）
- 末尾静音自动检测（最后一词到视频结尾的空白自动识别）

转录支持：
- 火山引擎云端 ASR（默认）
- FunASR 本地转录（`.env` 中设置 `TRANSCRIPTION_MODE=funasr`）

## 脚本路径

所有脚本在 `剪口播/scripts/` 目录下：
- `volcengine_transcribe.sh` — 转录（已修复为 v3 API）
- `generate_subtitles.js` — 生成字幕
- `generate_review.js` — 生成增强版审核页
- `review_server.js` — 审核服务器
- `cut_video.sh` — 执行剪辑
