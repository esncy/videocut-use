# Videocut Use

> 基于 [Ceeon/videocut-skills](https://github.com/Ceeon/videocut-skills) 的增强版 Claude Code Skill，专为口播视频设计。

## 主要功能

### 1. 剪口播 — 口播视频智能剪辑

AI 自动识别口误、重复、停顿、语气词，增强版审核页面人工确认后一键剪辑。

- 增强版审核页：视频字幕叠加 + 音频波形 + 深色模式 + 项目切换
- 支持火山引擎云端 / FunASR 本地两种转录模式
- 支持 .mp4 / .mkv / .mov 等多种格式

### 2. 导入字幕 — 一键生成剪映草稿

AI 转录 + 校对，默认直接生成剪映草稿（带花字效果 + 入场动画），也可导出 SRT。

### 3. 高清化 — 专业级导出

2-pass 编码 + 锐化，匹配原片参数的 1.2x 码率输出，肉眼无损。

### 4. 自进化 — AI 越用越准

用户纠错后自动更新规则文件，记住你的偏好（静音阈值、语气词处理等）。

## 审核页面增强（相比原版）

原版审核页只有纯文字列表，本版增加了专业级可视化：

| 功能 | 说明 |
|------|------|
| **视频字幕叠加** | 播放时视频底部实时显示当前字幕，待删除字幕显示红色删除线 |
| **音频波形图** | 专业编辑器风格（深灰背景 + 绿色波形），选中区域红色高亮，播放头绿色发光跟踪 |
| **波形交互** | 点击波形跳转，拖动框选时间段自动选中对应字幕 |
| **字幕-波形联动** | 文字列表选中 → 波形同步变红，双向实时同步 |
| **可拖动分栏** | 左右面板默认 50/50，拖动中间分隔线调整宽度，双击重置 |
| **深色模式** | 一键切换暗/亮主题，偏好自动保存到 localStorage |
| **项目管理** | 头部下拉框列出所有已有项目，点击切换 |
| **末尾静音检测** | 自动检测最后一词到视频结尾的空白（原版不处理） |
| **剪辑完成弹窗** | 替代原版 alert，新增「📂 打开目录」按钮直接打开输出目录 |

## 其他优化

### 火山引擎 API 修复

原作者脚本使用的 API 端点已过时，本版修复为官方最新接口：

| 项目 | 原作者 | 本版修复 |
|------|--------|---------|
| 端点 | `/api/v1/vc/submit` | `/api/v3/auc/bigmodel/submit` |
| 认证 | `x-api-key: appid:token` | `x-api-key: {UUID key}` |
| 配置 | 需要 APPID + Token + Cluster | **只需一个 API Key** |

### FunASR 本地转录

新增离线转录能力，无需网络和 API Key：

- 使用阿里 FunASR `paraformer-zh` 模型，支持字级别时间戳
- `.env` 中一行切换：`TRANSCRIPTION_MODE=funasr`
- 首次运行自动下载模型（约 1GB），之后完全本地运行

### 兼容性修复

| 问题 | 修复 |
|------|------|
| MKV 文件支持 | ffprobe/ffmpeg 命令兼容 .mkv 等多种容器格式 |
| ffprobe 尾部逗号 | macOS 上输出带逗号导致编码失败，已修复 |
| cut_video.sh 参数错误 | 码率/像素格式解析失败导致剪辑报错，已修复 |
| 中文路径 | 用 Python 处理中文路径，避免 shell 编码问题 |

## 快速开始

### 1. 安装

```bash
git clone https://github.com/esncy/videocut-use.git ~/.claude/skills/videocut-use
```

### 2. 配置

```bash
cd ~/.claude/skills/videocut-use
cp .env.example .env
# 编辑 .env，至少配置以下之一：
#   VOLCENGINE_API_KEY=xxx  （火山引擎云端转录）
#   TRANSCRIPTION_MODE=funasr  （本地转录，无需 key）
```

### 3. 依赖

| 依赖 | 用途 | 安装 |
|------|------|------|
| Node.js 18+ | 运行脚本 | `brew install node` |
| FFmpeg | 视频剪辑 | `brew install ffmpeg` |
| Claude Code | AI Agent | https://claude.ai/code |
| FunASR（可选） | 本地转录 | `pip install funasr modelscope` |

### 4. 使用

```
/videocut-use:剪口播 视频.mp4
```

## 完整流程

```
视频文件 (.mp4/.mkv/.mov)
  ↓
提取音频 → 转录（火山引擎云端 / FunASR 本地）
  ↓
AI 多 Agent 并行分析（静音/口误/重复/语气词）
  ↓
增强版审核页面
  ├── 视频 + 字幕叠加预览
  ├── 音频波形（可点击/框选）
  ├── 深色模式 / 项目切换
  └── 可拖动左右分栏
  ↓
人工确认 → FFmpeg 剪辑 → 输出目录
  ↓（可选）
导入字幕 → 剪映草稿（带花字+动画）
  ↓（可选）
高清化 → 2-pass + 锐化 → 最终输出
```

## 目录结构

```
videocut-use/
├── SKILL.md                # Claude Code skill 入口
├── LICENSE                 # MIT License
├── .env.example            # 配置模板
├── 剪口播/                 # 核心：转录 + 审核 + 剪辑
│   └── scripts/
│       ├── transcribe.sh          # 统一转录路由
│       ├── funasr_transcribe.py   # FunASR 本地转录
│       ├── volcengine_transcribe.sh  # 火山引擎 v3 API
│       ├── generate_subtitles.js
│       ├── generate_review.js     # 增强版审核页
│       ├── review_server.js       # 审核服务器
│       └── cut_video.sh           # FFmpeg 剪辑
├── 导入字幕/               # 字幕导入剪映
├── 高清化/                 # 2-pass + 锐化导出
├── 自进化/                 # AI 自学习偏好
└── 字幕/词典.txt           # 专业术语词典
```

## 致谢

基于 [Ceeon/videocut-skills](https://github.com/Ceeon/videocut-skills) 开发，遵循 MIT License。

## License

[MIT](LICENSE)
