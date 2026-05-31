# GPX Video Generator

GPXファイルから地図アニメーション動画(MP4)を生成するツールです。

## Features

* GPX読み込み
* MapLibreによる地図表示
* TileServer-GLによるローカル地図配信
* カメラ追従アニメーション
* Puppeteerによるレンダリング
* FFmpegによるMP4生成

## Usage

```bash
node generate-video.js -g input.gpx -m output.mp4
```

## Requirements

* Node.js
* FFmpeg
* TileServer-GL
* maplibre

## Map Data

TileServer-GLとMBTilesファイルはリポジトリに含まれていません。

別途取得し、serverディレクトリに配置してください。

## Architecture

GPX
→ RouteData
→ MapLibre
→ Puppeteer
→ PNG Frames
→ FFmpeg
→ MP4
