#!/usr/bin/env node
/**
 * 增强版审核网页（视频版本）
 *
 * 新增功能：
 * - 视频字幕叠加预览
 * - 音频波形显示（专业编辑器风格）
 * - 左右可拖动分栏（默认 50/50）
 * - 字幕-波形双向联动
 *
 * 基于 Ceeon/videocut-skills (MIT License)
 *
 * 用法: node generate_review.js <subtitles_words.json> [auto_selected.json] [video_file]
 * 输出: review.html, video.mp4（符号链接到当前目录）
 */

const fs = require('fs');
const path = require('path');

const subtitlesFile = process.argv[2] || 'subtitles_words.json';
const autoSelectedFile = process.argv[3] || 'auto_selected.json';
const videoFile = process.argv[4] || 'video.mp4';

const videoBaseName = 'video.mp4';
if (videoFile !== videoBaseName && fs.existsSync(videoFile)) {
  const absVideoPath = path.resolve(videoFile);
  if (fs.existsSync(videoBaseName)) fs.unlinkSync(videoBaseName);
  fs.symlinkSync(absVideoPath, videoBaseName);
  console.log('📁 已链接视频到当前目录:', videoBaseName, '→', absVideoPath);
}

if (!fs.existsSync(subtitlesFile)) {
  console.error('❌ 找不到字幕文件:', subtitlesFile);
  process.exit(1);
}

const words = JSON.parse(fs.readFileSync(subtitlesFile, 'utf8'));

// 追尾静音检测：如果最后一词结束到视频结尾之间有 ≥0.5s 空白，追加 gap
let videoDuration = 0;
try {
  const { execSync } = require('child_process');
  const dur = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoFile}"`, { encoding: 'utf8' }).trim();
  videoDuration = parseFloat(dur);
} catch (e) {}
if (videoDuration > 0 && words.length > 0) {
  const lastEnd = words[words.length - 1].end;
  const trailGap = videoDuration - lastEnd;
  if (trailGap >= 0.5) {
    words.push({ text: '', start: lastEnd, end: videoDuration, isGap: true });
    console.log(`🔇 检测到末尾静音: ${trailGap.toFixed(2)}s (${lastEnd.toFixed(2)}s → ${videoDuration.toFixed(2)}s)`);
  }
}

let autoSelected = [];
if (fs.existsSync(autoSelectedFile)) {
  autoSelected = JSON.parse(fs.readFileSync(autoSelectedFile, 'utf8'));
  console.log('AI 预选:', autoSelected.length, '个元素');
}

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>剪口播 · 审核稿</title>
  <style>
    :root {
      --bg-canvas: #f7f6f3;
      --bg-surface: #ffffff;
      --bg-muted: #f4f3f0;
      --bg-subtle: #fafaf8;
      --border: rgba(15, 15, 15, 0.08);
      --divider: rgba(15, 15, 15, 0.06);
      --text: #1a1a1a;
      --text-muted: #6b6b6b;
      --text-faint: #9b9b9b;
      --accent: #0f7b6c;
      --accent-soft: #e6f5f0;
      --accent-text: #0a5c50;
      --deleted-bg: #fef1f0;
      --highlight-bg: #fef0c7;
      --highlight-fg: #7c5a10;
      --font-body: "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --font-mono: "SF Mono", "JetBrains Mono", "Menlo", monospace;
      --left-w: 50%;
      --header-h: 44px;
    }
    body.dark {
      --bg-canvas: #1a1a2e;
      --bg-surface: #22223a;
      --bg-muted: #2a2a45;
      --bg-subtle: #252540;
      --border: rgba(255, 255, 255, 0.08);
      --divider: rgba(255, 255, 255, 0.06);
      --text: #e8e8e8;
      --text-muted: #a0a0b0;
      --text-faint: #6a6a7a;
      --accent: #2dd4a8;
      --accent-soft: rgba(45, 212, 168, 0.12);
      --accent-text: #2dd4a8;
      --deleted-bg: rgba(255, 80, 80, 0.12);
      --highlight-bg: rgba(255, 200, 50, 0.2);
      --highlight-fg: #ffd060;
    }
    body.dark .waveform-wrap { background: #111122; }
    body.dark .gap { border-color: rgba(255,255,255,0.1); }
    body.dark .gap:hover { background: #333350; border-color: rgba(255,255,255,0.15); }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-body);
      background: var(--bg-canvas);
      color: var(--text);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }

    /* ─── Header ─── */
    .header {
      height: var(--header-h);
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      flex-shrink: 0;
      z-index: 10;
    }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .logo { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
    .icon { font-size: 16px; }
    .badge {
      font-size: 11px;
      background: var(--accent-soft);
      color: var(--accent-text);
      padding: 2px 8px;
      border-radius: 10px;
    }
    .header-right { display: flex; align-items: center; gap: 8px; }
    .header-divider { width: 1px; height: 20px; background: var(--border); }
    .header-btn {
      height: 30px;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg-surface);
      font-size: 13px;
      font-family: var(--font-body);
      color: var(--text);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s;
    }
    .header-btn:hover { background: var(--bg-muted); }
    .header-btn.primary {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
      font-weight: 500;
    }
    .header-btn.primary:hover { opacity: 0.9; }
    select.speed-select {
      height: 30px;
      padding: 0 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg-surface);
      font-size: 12px;
      font-family: var(--font-body);
      color: var(--text-muted);
      cursor: pointer;
      outline: none;
    }
    select.speed-select:hover { border-color: rgba(15,15,15,0.15); }

    /* ─── Main layout ─── */
    .main {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* ─── Left Panel ─── */
    .left-panel {
      width: var(--left-w);
      flex-shrink: 0;
      background: var(--bg-surface);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Video area with subtitle overlay */
    .video-area {
      position: relative;
      background: #000;
      flex-shrink: 0;
    }
    #player {
      width: 100%;
      display: block;
      max-height: 45vh;
      object-fit: contain;
    }
    .subtitle-overlay {
      position: absolute;
      bottom: 8%;
      left: 50%;
      transform: translateX(-50%);
      max-width: 90%;
      text-align: center;
      pointer-events: none;
      z-index: 5;
      transition: opacity 0.15s;
    }
    .subtitle-overlay .sub-text {
      display: inline-block;
      font-size: 20px;
      font-weight: 600;
      color: #fff;
      text-shadow: 0 0 4px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6), 1px 1px 2px rgba(0,0,0,0.9);
      padding: 4px 12px;
      border-radius: 4px;
      line-height: 1.5;
      letter-spacing: 1px;
    }
    .subtitle-overlay .sub-text.has-deleted {
      color: #ff6b6b;
      text-decoration: line-through;
      text-decoration-color: rgba(255,100,100,0.6);
    }

    /* Waveform */
    .waveform-wrap {
      position: relative;
      height: 100px;
      background: #1a1a2e;
      flex-shrink: 0;
      cursor: crosshair;
      overflow: hidden;
    }
    #waveformCanvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .waveform-time {
      position: absolute;
      bottom: 2px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      padding: 0 8px;
      font-size: 10px;
      font-family: var(--font-mono);
      color: rgba(255,255,255,0.3);
      pointer-events: none;
    }

    /* Transport */
    .transport {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-bottom: 1px solid var(--divider);
      flex-shrink: 0;
    }
    .transport-btn {
      width: 30px;
      height: 30px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg-surface);
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.12s;
      color: var(--text);
    }
    .transport-btn:hover { background: var(--bg-muted); }
    .transport-btn.playing { background: var(--accent-soft); color: var(--accent); border-color: transparent; }
    #time {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
      margin-left: auto;
    }

    /* Sidebar cards (below transport) */
    .sidebar-scroll {
      flex: 1;
      overflow-y: auto;
    }
    .sidebar-section {
      padding: 12px 14px;
    }
    .sidebar-section + .sidebar-section {
      border-top: 1px solid var(--divider);
    }
    .card {
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
    }
    .card-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .clip-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 8px;
    }
    .clip-time-old { font-size: 18px; color: var(--text-faint); text-decoration: line-through; }
    .clip-arrow { color: var(--text-faint); font-size: 14px; }
    .clip-time-big { font-size: 22px; font-weight: 700; color: var(--accent); }
    .clip-bar-wrap {
      height: 6px;
      background: #e8e8e6;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 6px;
    }
    .clip-bar-keep {
      height: 100%;
      background: var(--accent);
      border-radius: 3px;
      transition: width 0.3s;
    }
    .clip-saved { font-size: 12px; color: var(--text-muted); }
    .kbd-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 10px;
      font-size: 12px;
      color: var(--text-muted);
    }
    kbd {
      font-family: var(--font-mono);
      font-size: 11px;
      background: var(--bg-muted);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 1px 6px;
      line-height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 24px;
      border-radius: 6px;
      flex-shrink: 0;
    }

    /* ─── Divider ─── */
    .divider {
      width: 6px;
      background: var(--border);
      cursor: col-resize;
      flex-shrink: 0;
      position: relative;
      transition: background 0.15s;
      z-index: 10;
    }
    .divider:hover, .divider.active {
      background: var(--accent);
    }
    .divider::after {
      content: '⋮';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 12px;
      color: rgba(0,0,0,0.2);
      pointer-events: none;
    }
    .divider:hover::after, .divider.active::after { color: rgba(255,255,255,0.6); }

    /* ─── Right Panel ─── */
    .right-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 200px;
    }
    .filter-bar {
      height: 40px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 6px;
      flex-shrink: 0;
    }
    .search-box {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--bg-muted);
      border-radius: 6px;
      padding: 0 10px;
      height: 28px;
      font-size: 13px;
      color: var(--text-faint);
      cursor: text;
      min-width: 140px;
    }
    .search-box input {
      border: none;
      background: transparent;
      outline: none;
      font-size: 13px;
      font-family: var(--font-body);
      color: var(--text);
      width: 100%;
    }
    .search-box input::placeholder { color: var(--text-faint); }
    .search-box .hint {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--text-faint);
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 0 4px;
      line-height: 16px;
    }
    .filter-divider { width: 1px; height: 16px; background: var(--border); margin: 0 4px; }
    .filter-btn {
      height: 26px;
      padding: 0 10px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--bg-surface);
      font-size: 12px;
      font-family: var(--font-body);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.12s;
      white-space: nowrap;
    }
    .filter-btn:hover { background: var(--bg-muted); border-color: rgba(15,15,15,0.12); }
    .filter-btn.active { background: var(--accent-soft); color: var(--accent-text); border-color: transparent; }
    .filter-summary {
      margin-left: auto;
      font-size: 12px;
      color: var(--text-faint);
      font-family: var(--font-mono);
      white-space: nowrap;
    }

    /* Transcript */
    .transcript-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px 60px;
    }
    .content { line-height: 2.4; max-width: 720px; }
    .chapter-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 24px 0 8px;
      user-select: none;
    }
    .chapter-header:first-child { margin-top: 0; }
    .chapter-num {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      color: var(--text-faint);
      background: var(--bg-muted);
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .chapter-range {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-faint);
      flex-shrink: 0;
    }
    .chapter-line { flex: 1; height: 1px; background: var(--divider); }
    .chapter-count { font-size: 11px; color: var(--text-faint); flex-shrink: 0; }
    .word {
      display: inline;
      padding: 2px 1px;
      border-radius: 3px;
      cursor: pointer;
      transition: all 0.1s;
      font-size: 15px;
      color: var(--text);
    }
    .word:hover { background: var(--bg-muted); }
    .word.selected {
      color: var(--text-faint);
      text-decoration: line-through;
      text-decoration-color: var(--text-muted);
    }
    .word.selected:hover { background: var(--deleted-bg); }
    .word.current {
      background: var(--highlight-bg);
      color: var(--highlight-fg);
      border-radius: 3px;
      text-decoration: none;
    }
    .gap {
      display: inline-block;
      background: var(--bg-muted);
      border: 1px solid #d9d7d0;
      color: var(--text-muted);
      padding: 1px 8px;
      margin: 1px 2px;
      border-radius: 10px;
      font-size: 11px;
      font-family: var(--font-mono);
      cursor: pointer;
      transition: all 0.1s;
      vertical-align: middle;
      line-height: 18px;
    }
    .gap:hover { background: #eae9e5; border-color: #cccac3; }
    .gap.selected { background: #e8e8e6; color: var(--text-faint); text-decoration: line-through; border-color: #d4d3ce; }
    .gap.current { background: var(--highlight-bg); color: var(--highlight-fg); border-color: #e8d89c; text-decoration: none; }

    /* Bottom legend */
    .bottom-legend {
      height: 32px;
      background: var(--bg-surface);
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      font-size: 12px;
      color: var(--text-faint);
      flex-shrink: 0;
    }
    .legend-item { display: flex; align-items: center; gap: 5px; }
    .legend-swatch { display: inline-block; width: 28px; font-size: 12px; text-align: center; }
    .legend-swatch.del { color: var(--text-faint); text-decoration: line-through; text-decoration-color: var(--text-muted); }
    .legend-swatch.normal { color: var(--text); }
    .legend-swatch.playing { background: var(--highlight-bg); color: var(--highlight-fg); border-radius: 3px; }

    /* Loading overlay */
    .loading-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
      opacity: 0; pointer-events: none;
      transition: opacity 0.3s;
    }
    .loading-overlay.show { opacity: 1; pointer-events: auto; }
    .loading-box {
      background: var(--bg-surface);
      border-radius: 12px;
      padding: 32px 48px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .loading-spinner {
      width: 40px; height: 40px;
      border: 3px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-text { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    .loading-time { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; font-family: var(--font-mono); }
    .loading-progress-wrap {
      width: 280px; height: 6px;
      background: var(--bg-muted);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .loading-progress-bar {
      height: 100%; width: 0%;
      background: var(--accent);
      border-radius: 3px;
      transition: width 0.5s;
    }
    .loading-estimate { font-size: 12px; color: var(--text-faint); }

    /* Result dialog */
    .result-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 1001;
    }
    .result-box {
      background: var(--bg-surface);
      border-radius: 12px;
      padding: 28px 36px;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .result-box h3 { margin-bottom: 12px; font-size: 16px; color: var(--accent); }
    .result-box pre {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
      white-space: pre-wrap;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .result-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .result-actions button {
      height: 34px;
      padding: 0 16px;
      border-radius: 6px;
      font-size: 13px;
      font-family: var(--font-body);
      cursor: pointer;
      transition: all 0.15s;
    }
    .result-actions .btn-ok {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      color: var(--text);
    }
    .result-actions .btn-ok:hover { background: var(--bg-muted); }
    .result-actions .btn-dir {
      background: var(--accent);
      border: 1px solid var(--accent);
      color: #fff;
      font-weight: 500;
    }
    .result-actions .btn-dir:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <!-- Loading overlay -->
  <div class="loading-overlay" id="loadingOverlay">
    <div class="loading-box">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在剪辑中...</div>
      <div class="loading-time" id="loadingTime">已等待 0 秒</div>
      <div class="loading-progress-wrap">
        <div class="loading-progress-bar" id="loadingProgress"></div>
      </div>
      <div class="loading-estimate" id="loadingEstimate">预估剩余: 计算中...</div>
    </div>
  </div>

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <span class="logo"><span class="icon">&#9986;</span> 剪口播 · ${path.basename(videoFile)}</span>
      <span class="badge">已分析</span>
    </div>
    <div class="header-right">
      <select class="speed-select" id="projectSelect" onchange="switchProject(this.value)" title="切换项目">
        <option value="">加载项目...</option>
      </select>
      <button class="header-btn" id="darkModeBtn" onclick="toggleDarkMode()" title="深色/浅色模式">&#127769;</button>
      <div class="header-divider"></div>
      <select class="speed-select" id="speed" onchange="player.playbackRate=parseFloat(this.value)">
        <option value="0.5">0.5x</option>
        <option value="0.75">0.75x</option>
        <option value="1" selected>1.0x</option>
        <option value="1.25">1.25x</option>
        <option value="1.5">1.5x</option>
        <option value="2">2.0x</option>
      </select>
      <div class="header-divider"></div>
      <button class="header-btn" onclick="openDir()" title="打开导出目录">
        <span>&#128194;</span> 导出目录
      </button>
      <button class="header-btn" onclick="copyDeleteList()" title="复制删除列表">
        <span>&#128203;</span> 字幕
      </button>
      <button class="header-btn primary" onclick="executeCut()">执行剪辑</button>
    </div>
  </div>

  <!-- Main -->
  <div class="main">
    <!-- Left Panel -->
    <div class="left-panel" id="leftPanel">
      <!-- Video with subtitle overlay -->
      <div class="video-area">
        <video id="player" src="${videoBaseName}" preload="auto"></video>
        <div class="subtitle-overlay" id="subtitleOverlay">
          <span class="sub-text" id="subtitleText"></span>
        </div>
      </div>

      <!-- Waveform -->
      <div class="waveform-wrap" id="waveformWrap">
        <canvas id="waveformCanvas"></canvas>
        <div class="waveform-time">
          <span id="wfStart">00:00</span>
          <span id="wfEnd">00:00</span>
        </div>
      </div>

      <!-- Transport -->
      <div class="transport">
        <button class="transport-btn" onclick="player.currentTime=Math.max(0,player.currentTime-5)" title="-5s">&#9198;</button>
        <button class="transport-btn" id="playBtn" onclick="togglePlay()" title="播放/暂停">&#9654;</button>
        <button class="transport-btn" onclick="player.currentTime+=5" title="+5s">&#9197;</button>
        <span id="time">00:00 / 00:00</span>
      </div>

      <!-- Sidebar cards -->
      <div class="sidebar-scroll">
        <div class="sidebar-section">
          <div class="card" id="clipCard">
            <div class="card-title">剪辑预览</div>
            <div class="clip-row">
              <span class="clip-time-old" id="clipOld">--:--</span>
              <span class="clip-arrow">&rarr;</span>
              <span class="clip-time-big" id="clipNew">--:--</span>
            </div>
            <div class="clip-bar-wrap">
              <div class="clip-bar-keep" id="clipBar" style="width:100%"></div>
            </div>
            <div class="clip-saved" id="clipSaved">选中后实时预览</div>
          </div>
        </div>
        <div class="sidebar-section">
          <div class="card" id="suggestCard">
            <div class="card-title">AI 建议</div>
            <div id="suggestBody"></div>
          </div>
        </div>
        <div class="sidebar-section">
          <div class="card">
            <div class="card-title">快捷键</div>
            <div class="kbd-grid">
              <kbd>Space</kbd><span>播放 / 暂停</span>
              <kbd>D</kbd><span>双击选中（切换）</span>
              <kbd>&larr; &rarr;</kbd><span>跳 1 秒</span>
              <kbd>Shift + &larr;&rarr;</kbd><span>跳 5 秒</span>
              <kbd>Shift + 拖动</kbd><span>批量选择 / 取消</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div class="divider" id="divider"></div>

    <!-- Right Panel -->
    <div class="right-panel">
      <div class="filter-bar">
        <div class="search-box">
          <span style="font-size:14px;color:var(--text-faint)">&#128269;</span>
          <input type="text" id="searchInput" placeholder="搜索..." oninput="filterSearch(this.value)">
          <span class="hint">&#8984;K</span>
        </div>
        <div class="filter-divider"></div>
        <button class="filter-btn active" data-filter="all" onclick="setFilter('all',this)">全部 <span id="fAll">0</span></button>
        <button class="filter-btn" data-filter="silence" onclick="setFilter('silence',this)">静音 <span id="fSilence">0</span></button>
        <button class="filter-btn" data-filter="filler" onclick="setFilter('filler',this)">语气词 <span id="fFiller">0</span></button>
        <button class="filter-btn" data-filter="stutter" onclick="setFilter('stutter',this)">卡顿 <span id="fStutter">0</span></button>
        <button class="filter-btn" data-filter="repeat" onclick="setFilter('repeat',this)">重说 <span id="fRepeat">0</span></button>
        <span class="filter-summary">已选 <span id="selCount">0</span> / <span id="totalCount">0</span></span>
      </div>
      <div class="transcript-body" id="transcriptBody">
        <div class="content" id="content"></div>
      </div>
      <div class="bottom-legend">
        <div class="legend-item"><span class="legend-swatch del">删除</span><span>已选中</span></div>
        <div class="legend-item"><span class="legend-swatch normal">保留</span><span>未选中</span></div>
        <div class="legend-item"><span class="legend-swatch playing">播放</span><span>当前词</span></div>
        <span style="color:var(--divider)">|</span>
        <span>单击跳转 · 双击切换 · Shift+拖动批量</span>
      </div>
    </div>
  </div>

  <script>
    const words = ${JSON.stringify(words)};
    const autoSelected = new Set(${JSON.stringify(autoSelected)});
    const selected = new Set(autoSelected);

    let saveTimer = null;
    let autosaveEnabled = false;

    const player = document.getElementById('player');
    const timeDisplay = document.getElementById('time');
    const playBtn = document.getElementById('playBtn');

    function togglePlay() {
      if (player.paused) player.play();
      else player.pause();
    }
    player.addEventListener('play', () => { playBtn.classList.add('playing'); playBtn.innerHTML = '&#9646;&#9646;'; });
    player.addEventListener('pause', () => { playBtn.classList.remove('playing'); playBtn.innerHTML = '&#9654;'; });

    function formatTime(sec) {
      if (!sec || isNaN(sec)) return '00:00';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    function formatDuration(sec) {
      if (!sec || isNaN(sec)) return '0s';
      const m = Math.floor(sec / 60);
      const s = (sec % 60).toFixed(1);
      return m > 0 ? m + '分' + s + '秒' : s + '秒';
    }

    // ─── Divider drag ───
    const divider = document.getElementById('divider');
    const leftPanel = document.getElementById('leftPanel');
    let isDraggingDivider = false;

    divider.addEventListener('mousedown', (e) => {
      isDraggingDivider = true;
      divider.classList.add('active');
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDraggingDivider) return;
      const mainRect = document.querySelector('.main').getBoundingClientRect();
      const ratio = Math.max(0.2, Math.min(0.8, (e.clientX - mainRect.left) / mainRect.width));
      document.documentElement.style.setProperty('--left-w', (ratio * 100) + '%');
      resizeWaveform();
    });
    document.addEventListener('mouseup', () => {
      if (isDraggingDivider) {
        isDraggingDivider = false;
        divider.classList.remove('active');
      }
    });
    divider.addEventListener('dblclick', () => {
      document.documentElement.style.setProperty('--left-w', '50%');
      resizeWaveform();
    });

    // ─── Waveform ───
    const waveformWrap = document.getElementById('waveformWrap');
    const wfCanvas = document.getElementById('waveformCanvas');
    const wfCtx = wfCanvas.getContext('2d');
    let wfChannelData = null;
    let wfDuration = 0;
    let waveformReady = false;

    // Waveform selection state
    let wfSelecting = false;
    let wfSelectStart = -1;
    let wfSelectEnd = -1;

    function resizeWaveform() {
      const rect = waveformWrap.getBoundingClientRect();
      wfCanvas.width = rect.width * window.devicePixelRatio;
      wfCanvas.height = rect.height * window.devicePixelRatio;
      wfCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
      if (waveformReady) drawWaveform();
    }

    async function loadWaveform() {
      try {
        const response = await fetch('${videoBaseName}');
        const arrayBuffer = await response.arrayBuffer();
        const offlineCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
        wfChannelData = audioBuffer.getChannelData(0);
        wfDuration = audioBuffer.duration;
        waveformReady = true;
        document.getElementById('wfEnd').textContent = formatTime(wfDuration);
        resizeWaveform();
        offlineCtx.close();
      } catch (e) {
        console.warn('Waveform load failed:', e);
        waveformWrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.3);font-size:12px;">波形加载失败</div>';
      }
    }

    function drawWaveform() {
      if (!waveformReady) return;
      const w = waveformWrap.clientWidth;
      const h = waveformWrap.clientHeight;
      const midY = h / 2;

      wfCtx.clearRect(0, 0, w, h);

      // Background
      wfCtx.fillStyle = '#1a1a2e';
      wfCtx.fillRect(0, 0, w, h);

      // Center line
      wfCtx.strokeStyle = 'rgba(255,255,255,0.08)';
      wfCtx.lineWidth = 1;
      wfCtx.beginPath();
      wfCtx.moveTo(0, midY);
      wfCtx.lineTo(w, midY);
      wfCtx.stroke();

      // Draw selected regions (red overlay)
      selected.forEach(i => {
        const word = words[i];
        const x1 = (word.start / wfDuration) * w;
        const x2 = (word.end / wfDuration) * w;
        wfCtx.fillStyle = 'rgba(255,60,60,0.2)';
        wfCtx.fillRect(x1, 0, x2 - x1, h);
      });

      // Waveform bars
      const samplesPerPx = Math.floor(wfChannelData.length / w);
      const ampScale = midY * 0.85;

      for (let x = 0; x < w; x++) {
        const startSample = x * samplesPerPx;
        let min = 0, max = 0;
        for (let j = 0; j < samplesPerPx; j++) {
          const s = wfChannelData[startSample + j] || 0;
          if (s < min) min = s;
          if (s > max) max = s;
        }

        const barH = Math.max(1, (max - min) * ampScale);
        const barY = midY - barH / 2;

        // Color: green for normal, dimmer for selected
        const isInSelected = isTimeInSelected(x / w * wfDuration);
        wfCtx.fillStyle = isInSelected ? 'rgba(255,100,100,0.7)' : '#00cc88';
        wfCtx.fillRect(x, barY, 1, barH);
      }

      // Playhead
      if (wfDuration > 0) {
        const px = (player.currentTime / wfDuration) * w;
        wfCtx.strokeStyle = '#00ff88';
        wfCtx.lineWidth = 2;
        wfCtx.shadowColor = '#00ff88';
        wfCtx.shadowBlur = 6;
        wfCtx.beginPath();
        wfCtx.moveTo(px, 0);
        wfCtx.lineTo(px, h);
        wfCtx.stroke();
        wfCtx.shadowBlur = 0;
      }

      // Waveform drag selection overlay
      if (wfSelecting && wfSelectStart >= 0 && wfSelectEnd >= 0) {
        const x1 = Math.min(wfSelectStart, wfSelectEnd);
        const x2 = Math.max(wfSelectStart, wfSelectEnd);
        wfCtx.fillStyle = 'rgba(0,255,136,0.15)';
        wfCtx.fillRect(x1, 0, x2 - x1, h);
        wfCtx.strokeStyle = 'rgba(0,255,136,0.5)';
        wfCtx.lineWidth = 1;
        wfCtx.strokeRect(x1, 0, x2 - x1, h);
      }
    }

    function isTimeInSelected(t) {
      for (const i of selected) {
        if (t >= words[i].start && t < words[i].end) return true;
      }
      return false;
    }

    // Waveform click-to-seek
    waveformWrap.addEventListener('click', (e) => {
      if (wfSelecting) return;
      const rect = waveformWrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = (x / rect.width) * wfDuration;
      player.currentTime = Math.max(0, Math.min(t, wfDuration));
    });

    // Waveform drag-to-select
    waveformWrap.addEventListener('mousedown', (e) => {
      const rect = waveformWrap.getBoundingClientRect();
      wfSelecting = true;
      wfSelectStart = e.clientX - rect.left;
      wfSelectEnd = wfSelectStart;
    });
    document.addEventListener('mousemove', (e) => {
      if (!wfSelecting) return;
      const rect = waveformWrap.getBoundingClientRect();
      wfSelectEnd = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      drawWaveform();
    });
    document.addEventListener('mouseup', () => {
      if (!wfSelecting) return;
      if (Math.abs(wfSelectEnd - wfSelectStart) > 5) {
        // Convert pixel range to time range and toggle words
        const rect = waveformWrap.getBoundingClientRect();
        const t1 = (Math.min(wfSelectStart, wfSelectEnd) / rect.width) * wfDuration;
        const t2 = (Math.max(wfSelectStart, wfSelectEnd) / rect.width) * wfDuration;
        // Determine mode: if first word in range is selected, remove; else add
        let firstInRange = -1;
        for (let i = 0; i < words.length; i++) {
          if (words[i].end > t1 && words[i].start < t2) { firstInRange = i; break; }
        }
        const mode = (firstInRange >= 0 && selected.has(firstInRange)) ? 'remove' : 'add';
        for (let i = 0; i < words.length; i++) {
          if (words[i].end > t1 && words[i].start < t2) {
            if (mode === 'add') { selected.add(i); if (elements[i]) elements[i].classList.add('selected'); }
            else { selected.delete(i); if (elements[i]) elements[i].classList.remove('selected'); }
          }
        }
        rebuildSkipIntervals();
        updateStats();
      }
      wfSelecting = false;
      wfSelectStart = -1;
      wfSelectEnd = -1;
      drawWaveform();
    });

    // ─── Subtitle overlay ───
    const subtitleOverlay = document.getElementById('subtitleOverlay');
    const subtitleText = document.getElementById('subtitleText');
    let lastSubIdx = -1;

    function updateSubtitleOverlay(t) {
      // Find current word and build subtitle from surrounding non-gap words
      let currIdx = -1;
      for (let i = 0; i < words.length; i++) {
        if (t >= words[i].start && t < words[i].end) { currIdx = i; break; }
      }
      if (currIdx === lastSubIdx) return;
      lastSubIdx = currIdx;

      if (currIdx < 0) {
        subtitleOverlay.style.opacity = '0';
        return;
      }

      // Build subtitle text: collect a window of ~15 chars around current word
      let startI = currIdx, endI = currIdx;
      let textLen = words[currIdx].isGap ? 0 : words[currIdx].text.length;
      while (startI > 0 && textLen < 15) {
        const prev = words[startI - 1];
        if (prev.isGap) break;
        startI--;
        textLen += prev.text.length;
      }
      while (endI < words.length - 1 && textLen < 15) {
        const next = words[endI + 1];
        if (next.isGap) break;
        endI++;
        textLen += next.text.length;
      }

      let subStr = '';
      let hasDeleted = false;
      for (let i = startI; i <= endI; i++) {
        if (!words[i].isGap) {
          subStr += words[i].text;
          if (selected.has(i)) hasDeleted = true;
        }
      }

      if (subStr) {
        subtitleText.textContent = subStr;
        subtitleText.className = 'sub-text' + (hasDeleted ? ' has-deleted' : '');
        subtitleOverlay.style.opacity = '1';
      } else {
        subtitleOverlay.style.opacity = '0';
      }
    }

    // ─── Transcript rendering ───
    const content = document.getElementById('content');
    let elements = [];
    let isSelecting = false;
    let selectStart = -1;
    let selectMode = 'add';
    let activeFilter = 'all';
    let searchQuery = '';

    function buildChapters() {
      const chapters = [];
      let ch = { startIdx: 0, words: [], suggestions: 0 };
      for (let i = 0; i < words.length; i++) {
        if (i > 0 && words[i].isGap && (words[i].end - words[i].start) >= 1.5) {
          ch.endIdx = i - 1;
          ch.startTime = words[ch.startIdx].start;
          ch.endTime = words[ch.endIdx].end;
          chapters.push(ch);
          ch = { startIdx: i, words: [], suggestions: 0 };
        }
        if (autoSelected.has(i)) ch.suggestions++;
      }
      ch.endIdx = words.length - 1;
      ch.startTime = words[ch.startIdx].start;
      ch.endTime = words[ch.endIdx].end;
      chapters.push(ch);
      return chapters;
    }

    function categorize(i) {
      if (words[i].isGap) return 'silence';
      const r = (words[i].reason || '').toLowerCase();
      if (/重说|repeat/.test(r)) return 'repeat';
      if (/卡顿|stutter/.test(r)) return 'stutter';
      if (/残句|incomplete/.test(r)) return 'incomplete';
      if (/嗯|啊|呃|额|umm?|uh+/.test(words[i].text)) return 'filler';
      return 'other';
    }

    function countByCategory() {
      const counts = { silence: 0, filler: 0, stutter: 0, repeat: 0 };
      for (let i = 0; i < words.length; i++) {
        const c = categorize(i);
        if (counts[c] !== undefined) counts[c]++;
      }
      return counts;
    }

    function render() {
      content.innerHTML = '';
      elements = new Array(words.length);
      const chapters = buildChapters();

      chapters.forEach((ch, ci) => {
        const header = document.createElement('div');
        header.className = 'chapter-header';
        const num = String(ci + 1).padStart(2, '0');
        header.innerHTML = \`
          <span class="chapter-num">\${num}</span>
          <span class="chapter-range">\${formatTime(ch.startTime)} — \${formatTime(ch.endTime)}</span>
          <div class="chapter-line"></div>
          <span class="chapter-count">\${ch.suggestions ? ch.suggestions + ' 建议' : ''}</span>
        \`;
        content.appendChild(header);

        for (let i = ch.startIdx; i <= ch.endIdx; i++) {
          const word = words[i];
          const el = document.createElement('span');
          el.className = word.isGap ? 'gap' : 'word';
          if (selected.has(i)) el.classList.add('selected');
          el.textContent = word.isGap ? ((word.end - word.start).toFixed(1) + 's') : word.text;
          el.dataset.index = i;

          el.onclick = (e) => { if (!isSelecting) player.currentTime = word.start; };
          el.ondblclick = () => toggle(i);
          el.onmousedown = (e) => {
            if (e.shiftKey) {
              isSelecting = true;
              selectStart = i;
              selectMode = selected.has(i) ? 'remove' : 'add';
              e.preventDefault();
            }
          };

          content.appendChild(el);
          elements[i] = el;

          if (!word.isGap) {
            const next = words[i + 1];
            if (next && !next.isGap && i < ch.endIdx) {
              content.appendChild(document.createTextNode(' '));
            }
          }
        }
      });

      updateStats();
      updateFilterCounts();
      updateSuggestCard();
    }

    // Shift+拖动多选
    document.getElementById('content').addEventListener('mousemove', e => {
      if (!isSelecting) return;
      const target = e.target.closest('[data-index]');
      if (!target) return;
      const i = parseInt(target.dataset.index);
      const min = Math.min(selectStart, i);
      const max = Math.max(selectStart, i);
      for (let j = min; j <= max; j++) {
        if (selectMode === 'add') {
          selected.add(j);
          if (elements[j]) elements[j].classList.add('selected');
        } else {
          selected.delete(j);
          if (elements[j]) elements[j].classList.remove('selected');
        }
      }
      updateStats();
      drawWaveform();
    });

    document.addEventListener('mouseup', () => {
      if (isSelecting) rebuildSkipIntervals();
      isSelecting = false;
    });

    function toggle(i) {
      if (selected.has(i)) {
        selected.delete(i);
        if (elements[i]) elements[i].classList.remove('selected');
      } else {
        selected.add(i);
        if (elements[i]) elements[i].classList.add('selected');
      }
      rebuildSkipIntervals();
      updateStats();
      drawWaveform();
    }

    function updateStats() {
      const totalDur = words.length ? words[words.length - 1].end - words[0].start : 0;
      let deletedDur = 0;
      selected.forEach(i => { deletedDur += words[i].end - words[i].start; });
      const newDur = Math.max(0, totalDur - deletedDur);
      const pct = totalDur > 0 ? ((deletedDur / totalDur) * 100).toFixed(0) : 0;
      const keepPct = totalDur > 0 ? ((newDur / totalDur) * 100).toFixed(0) : 100;

      document.getElementById('clipOld').textContent = formatTime(totalDur);
      document.getElementById('clipNew').textContent = formatTime(newDur);
      document.getElementById('clipBar').style.width = keepPct + '%';
      document.getElementById('clipSaved').innerHTML = deletedDur > 0
        ? \`删减 \${deletedDur.toFixed(1)}s · 节省 <b>\${pct}%</b>\`
        : '尚未选择删除片段';

      document.getElementById('selCount').textContent = selected.size;
      document.getElementById('totalCount').textContent = words.length;
    }

    function updateFilterCounts() {
      const counts = countByCategory();
      document.getElementById('fAll').textContent = words.length;
      document.getElementById('fSilence').textContent = counts.silence;
      document.getElementById('fFiller').textContent = counts.filler;
      document.getElementById('fStutter').textContent = counts.stutter;
      document.getElementById('fRepeat').textContent = counts.repeat;
    }

    function updateSuggestCard() {
      const counts = countByCategory();
      const body = document.getElementById('suggestBody');
      const items = [
        { label: '静音段', count: counts.silence, color: '#e8e8e6' },
        { label: '语气词', count: counts.filler, color: '#fef0c7' },
        { label: '卡顿', count: counts.stutter, color: '#fde8e8' },
        { label: '重说', count: counts.repeat, color: '#e8f0fe' },
      ].filter(x => x.count > 0);
      body.innerHTML = items.map(x =>
        \`<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:13px;">
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:\${x.color};margin-right:6px;"></span>\${x.label}</span>
          <span style="font-family:var(--font-mono);color:var(--text-muted)">\${x.count}</span>
        </div>\`
      ).join('') || '<div style="font-size:13px;color:var(--text-faint)">无 AI 建议</div>';
    }

    // ─── Filter ───
    function setFilter(filter, btn) {
      activeFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (filter === 'all') return;
      // Highlight matching auto-selected words
      let first;
      elements.forEach((el, i) => {
        if (el && autoSelected.has(i) && categorize(i) === filter) {
          el.style.outline = '2px solid var(--accent)';
          el.style.outlineOffset = '1px';
          if (!first) first = el;
        } else if (el) {
          el.style.outline = '';
          el.style.outlineOffset = '';
        }
      });
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      clearTimeout(setFilter._timer);
      setFilter._timer = setTimeout(() => {
        elements.forEach(el => { if (el) { el.style.outline = ''; el.style.outlineOffset = ''; } });
      }, 3000);
    }

    function filterSearch(q) {
      searchQuery = q.toLowerCase();
      if (!searchQuery) {
        elements.forEach(el => { if (el) { el.style.outline = ''; el.style.outlineOffset = ''; } });
        return;
      }
      let first;
      elements.forEach((el, i) => {
        if (el && !words[i].isGap && words[i].text.toLowerCase().includes(searchQuery)) {
          el.style.outline = '2px solid var(--accent)';
          el.style.outlineOffset = '1px';
          if (!first) first = el;
        } else if (el) {
          el.style.outline = '';
          el.style.outlineOffset = '';
        }
      });
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      clearTimeout(filterSearch._timer);
      filterSearch._timer = setTimeout(() => {
        elements.forEach(el => { if (el) { el.style.outline = ''; el.style.outlineOffset = ''; } });
      }, 4000);
    }

    // ─── Web Audio API (skip logic) ───
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(player);
    const gainNode = audioCtx.createGain();
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    player.addEventListener('play', () => { if (audioCtx.state === 'suspended') audioCtx.resume(); });

    let skipIntervals = [];
    function rebuildSkipIntervals() {
      const sorted = Array.from(selected).sort((a, b) => a - b);
      skipIntervals = [];
      let i = 0;
      while (i < sorted.length) {
        let start = words[sorted[i]].start;
        let end = words[sorted[i]].end;
        let j = i + 1;
        while (j < sorted.length && words[sorted[j]].start - end < 0.1) {
          end = words[sorted[j]].end;
          j++;
        }
        skipIntervals.push({ start: start - 0.05, end });
        i = j;
      }
      autosave();
    }
    rebuildSkipIntervals();

    // ─── Autosave ───
    function autosave() {
      if (!autosaveEnabled) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const data = Array.from(selected).sort((a, b) => a - b);
        fetch('/api/save-selection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }).catch(e => console.warn('autosave failed', e));
      }, 400);
    }

    async function loadSavedSelection() {
      try {
        const r = await fetch('/api/load-selection');
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data)) {
            selected.clear();
            data.forEach(i => selected.add(i));
            document.querySelectorAll('.word.selected, .gap.selected').forEach(el => el.classList.remove('selected'));
            selected.forEach(i => { if (elements[i]) elements[i].classList.add('selected'); });
            console.log('已加载保存的选中:', data.length);
          }
        }
      } catch (e) { console.warn('load failed', e); }
      autosaveEnabled = true;
      rebuildSkipIntervals();
      updateStats();
      drawWaveform();
    }

    // ─── rAF tick ───
    let lastHighlight = -1;
    let skipLock = false;
    function tick() {
      requestAnimationFrame(tick);
      const t = player.currentTime;

      if (!player.paused) {
        for (const iv of skipIntervals) {
          if (t >= iv.start && t < iv.end) {
            if (!skipLock) {
              skipLock = true;
              gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
              player.currentTime = iv.end;
            }
            return;
          }
        }
        if (skipLock) {
          skipLock = false;
          gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        }
      }

      timeDisplay.textContent = \`\${formatTime(t)} / \${formatTime(player.duration || 0)}\`;

      // 高亮当前词
      let curr = -1;
      for (let i = 0; i < words.length; i++) {
        if (t >= words[i].start && t < words[i].end) { curr = i; break; }
      }
      if (curr !== lastHighlight) {
        if (lastHighlight >= 0 && elements[lastHighlight]) elements[lastHighlight].classList.remove('current');
        if (curr >= 0 && elements[curr]) {
          elements[curr].classList.add('current');
          elements[curr].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        lastHighlight = curr;
      }

      // Update subtitle overlay
      updateSubtitleOverlay(t);

      // Update waveform playhead
      if (waveformReady) drawWaveform();
    }
    requestAnimationFrame(tick);

    // ─── Actions ───
    function copyDeleteList() {
      const segments = [];
      const sortedSelected = Array.from(selected).sort((a, b) => a - b);
      sortedSelected.forEach(i => {
        const word = words[i];
        segments.push({ start: word.start, end: word.end });
      });
      const merged = [];
      for (const seg of segments) {
        if (merged.length === 0) { merged.push({ ...seg }); }
        else {
          const last = merged[merged.length - 1];
          if (Math.abs(seg.start - last.end) < 0.05) { last.end = seg.end; }
          else { merged.push({ ...seg }); }
        }
      }
      const json = JSON.stringify(merged, null, 2);
      navigator.clipboard.writeText(json).then(() => {
        alert('已复制 ' + merged.length + ' 个删除片段到剪贴板');
      });
    }

    function clearAll() {
      selected.clear();
      elements.forEach((el, i) => { if (el) el.classList.remove('selected'); });
      rebuildSkipIntervals();
      updateStats();
      drawWaveform();
    }

    async function executeCut() {
      const videoDuration = player.duration;
      const videoMinutes = (videoDuration / 60).toFixed(1);
      const estimatedTime = Math.max(5, Math.ceil(videoDuration / 4));
      const estMin = Math.floor(estimatedTime / 60);
      const estSec = estimatedTime % 60;
      const estText = estMin > 0 ? \`\${estMin}分\${estSec}秒\` : \`\${estSec}秒\`;

      if (!confirm(\`确认执行剪辑？\\n\\n视频时长: \${videoMinutes} 分钟\\n预计耗时: \${estText}\\n\\n点击确定开始\`)) return;

      const segments = [];
      const sortedSelected = Array.from(selected).sort((a, b) => a - b);
      sortedSelected.forEach(i => {
        const word = words[i];
        segments.push({ start: word.start, end: word.end });
      });

      const overlay = document.getElementById('loadingOverlay');
      const loadingTimeEl = document.getElementById('loadingTime');
      const loadingProgress = document.getElementById('loadingProgress');
      const loadingEstimate = document.getElementById('loadingEstimate');
      overlay.classList.add('show');
      loadingEstimate.textContent = \`预估剩余: \${estText}\`;

      const startTime = Date.now();
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        loadingTimeEl.textContent = \`已等待 \${elapsed} 秒\`;
        const progress = Math.min(95, (elapsed / estimatedTime) * 100);
        loadingProgress.style.width = progress + '%';
        const remaining = Math.max(0, estimatedTime - elapsed);
        loadingEstimate.textContent = remaining > 0 ? \`预估剩余: \${remaining} 秒\` : '即将完成...';
      }, 500);

      try {
        const res = await fetch('/api/cut', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(segments)
        });
        const data = await res.json();

        clearInterval(timer);
        loadingProgress.style.width = '100%';
        await new Promise(r => setTimeout(r, 300));
        overlay.classList.remove('show');
        loadingProgress.style.width = '0%';
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

        if (data.success) {
          const msg = \`剪辑完成！(耗时 \${totalTime}s)\\n\\n输出文件: \${data.output}\\n\\n时间统计:\\n  原时长: \${formatDuration(data.originalDuration)}\\n  新时长: \${formatDuration(data.newDuration)}\\n  删减: \${formatDuration(data.deletedDuration)} (\${data.savedPercent}%)\`;
          showResultDialog(msg, data);
        } else {
          alert('剪辑失败: ' + data.error);
        }
      } catch (err) {
        clearInterval(timer);
        overlay.classList.remove('show');
        loadingProgress.style.width = '0%';
        alert('请求失败: ' + err.message + '\\n\\n请确保使用 review_server.js 启动服务');
      }
    }

    function showResultDialog(msg, data) {
      const overlay = document.createElement('div');
      overlay.className = 'result-overlay';
      overlay.innerHTML = \`
        <div class="result-box">
          <h3>✅ 剪辑完成</h3>
          <pre>\${msg}</pre>
          <div class="result-actions">
            <button class="btn-ok" onclick="this.closest('.result-overlay').remove()">确定</button>
            <button class="btn-dir" onclick="openDirectory(this)">📂 打开目录</button>
          </div>
        </div>
      \`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    async function openDir() {
      try { await fetch('/api/open-directory', { method: 'POST' }); } catch (e) {}
    }
    async function openDirectory(btn) {
      btn.disabled = true;
      btn.textContent = '打开中...';
      try {
        await fetch('/api/open-directory', { method: 'POST' });
      } catch (e) {
        console.warn('open directory failed', e);
      }
      btn.textContent = '📂 已打开';
    }

    // ─── Keyboard shortcuts ───
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); player.currentTime = Math.max(0, player.currentTime - (e.shiftKey ? 5 : 1)); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); player.currentTime = player.currentTime + (e.shiftKey ? 5 : 1); }
      else if (e.code === 'KeyK' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); document.getElementById('searchInput').focus(); }
    });

    // ─── Project management ───
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects');
        const projects = await res.json();
        const select = document.getElementById('projectSelect');
        select.innerHTML = '<option value="">切换项目...</option>';
        projects.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.path;
          opt.textContent = (p.active ? '● ' : '  ') + p.name;
          if (p.active) opt.selected = true;
          select.appendChild(opt);
        });
      } catch (e) { console.warn('load projects failed', e); }
    }

    function switchProject(projectPath) {
      if (!projectPath) return;
      fetch('/api/switch-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath })
      }).then(r => r.json()).then(data => {
        if (data.success) {
          // 服务器已切换目录，刷新页面加载新项目
          window.location.reload();
        }
      }).catch(() => {});
    }

    // ─── Dark mode ───
    function toggleDarkMode() {
      const isDark = document.body.classList.toggle('dark');
      localStorage.setItem('darkMode', isDark ? '1' : '0');
      document.getElementById('darkModeBtn').innerHTML = isDark ? '&#9728;&#65039;' : '&#127769;';
      if (waveformReady) drawWaveform();
    }

    // Restore dark mode preference
    if (localStorage.getItem('darkMode') === '1') {
      document.body.classList.add('dark');
      document.getElementById('darkModeBtn').innerHTML = '&#9728;&#65039;';
    }

    // ─── Init ───
    render();
    loadSavedSelection();
    loadWaveform();
    loadProjects();
    window.addEventListener('resize', resizeWaveform);
  </script>
</body>
</html>`;

fs.writeFileSync('review.html', html);
console.log('✅ 已生成 review.html（增强版）');
console.log('📌 启动服务器: node review_server.js 8899 <video_file>');
console.log('📌 打开: http://localhost:8899/review.html');
