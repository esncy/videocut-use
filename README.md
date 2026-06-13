# Videocut Use

> 基于 [Ceeon/videocut-skills](https://github.com/Ceeon/videocut-skills) 的增强版 Claude Code Skill，专为口播视频设计。

## 增强功能（相比原版）

| 功能 | 说明 |
|------|------|
| **字幕叠加预览** | 视频播放时实时显示当前字幕，选中的字幕显示红色删除线 |
| **音频波形显示** | 专业编辑器风格波形（深灰背景 + 绿色波形线），选中区域红色高亮 |
| **字幕-波形联动** | 选中字幕 → 波形变红；波形框选 → 自动选中字幕 |
| **可拖动分栏** | 左右面板默认 50/50，拖动中间分隔线调整，双击重置 |
| **深色模式** | 一键切换暗/亮主题，偏好自动保存 |
| **项目管理** | 头部下拉框列出所有已有项目，点击切换 |
| **末尾静音检测** | 自动检测最后一词到视频结尾的空白 |
| **打开目录** | 剪辑完成后一键打开输出目录 |

## 为什么做这个？

剪映的"智能剪口播"有两个痛点：
1. **无法理解语义**：重复说的句子、说错后纠正的内容，它识别不出来
2. **字幕质量差**：专业术语（Claude Code、MCP、API）经常识别错误

这个 Agent 用 Claude 的语义理解能力解决第一个问题，用自定义词典解决第二个问题。

## 快速开始

### 1. 安装

```bash
git clone https://github.com/YOUR_USERNAME/videocut-use.git ~/.claude/skills/videocut-use
```

### 2. 配置 API Key

```bash
cd ~/.claude/skills/videocut-use
cp .env.example .env
# 编辑 .env，填入火山引擎 API Key（UUID 格式）
```

API Key 获取：https://console.volcengine.com/speech/app

### 3. 依赖

| 依赖 | 用途 | 安装 |
|------|------|------|
| Node.js 18+ | 运行脚本 | `brew install node` |
| FFmpeg | 视频剪辑 | `brew install ffmpeg` |
| Claude Code | AI Agent | https://claude.ai/code |

### 4. 使用

在 Claude Code 中输入：

```
/videocut-use:剪口播 视频.mp4
```

或直接说：「帮我剪这个口播视频 xxx.mp4」

## 使用流程

```
视频文件
  ↓
提取音频 → 火山引擎 ASR 转录（字级别时间戳）
  ↓
AI 多 Agent 并行分析（静音/口误/重复/语气词）
  ↓
生成增强版审核网页
  ├── 视频播放 + 字幕叠加
  ├── 音频波形（可框选）
  ├── 左右可拖动分栏
  └── 项目切换 / 深色模式
  ↓
人工审核 → 执行剪辑 → 输出目录
```

## 审核页面快捷键

| 快捷键 | 功能 |
|--------|------|
| Space | 播放/暂停 |
| 双击字幕 | 选中/取消 |
| Shift + 拖动 | 批量选择 |
| ← → | 跳 1 秒 |
| Shift + ← → | 跳 5 秒 |
| ⌘K | 搜索 |

## 目录结构

```
videocut-use/
├── README.md           # 本文件
├── LICENSE             # MIT License
├── SKILL.md            # Claude Code skill 入口
├── .env.example        # API Key 模板
├── 剪口播/             # 核心：转录 + 审核 + 剪辑
│   ├── SKILL.md
│   ├── scripts/
│   │   ├── volcengine_transcribe.sh  # 火山引擎 ASR（v3 API）
│   │   ├── generate_subtitles.js     # 字幕生成
│   │   ├── generate_review.js        # 增强版审核页面
│   │   ├── review_server.js          # 审核服务器
│   │   └── cut_video.sh              # FFmpeg 剪辑
│   └── 用户习惯/      # 可自定义规则
├── 导入字幕/           # 字幕导入剪映
├── 高清化/             # 2-pass + 锐化导出
├── 自进化/             # AI 自学习偏好
└── 字幕/词典.txt       # 专业术语词典
```

## 致谢

本项目基于 [Ceeon/videocut-skills](https://github.com/Ceeon/videocut-skills) 开发，遵循 MIT License。

## License

[MIT](LICENSE)
