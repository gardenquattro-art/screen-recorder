# Screen Recorder

macOSの標準録画より1/10〜1/20の容量で録画できるElectronアプリ。
FFmpegのH.264エンコーダーで圧縮します。

## 前提条件

- macOS 11.0 以降
- Node.js 18 以降
- Homebrew 経由の ffmpeg

## セットアップ

### 1. ffmpeg のインストール

```bash
brew install ffmpeg
```

### 2. 依存パッケージのインストール

```bash
cd apps/screen-recorder
npm install
```

### 3. 開発モードで起動

```bash
npm run dev
```

### 4. ビルド

```bash
npm run build
npm start
```

## 使い方

1. アプリを起動
2. 音声・画質を選択
3. 「録画開始」をクリック
   - macOSの画面収録許可ダイアログが表示されたら許可してください
4. 録画が終わったら「停止して保存」をクリック
5. `~/Desktop/Recordings/` に `recording_YYYY-MM-DD_HH-MM-SS.mp4` が保存されます

## 画質設定

| 設定 | CRF値 | 用途 |
|------|-------|------|
| 高画質 | 23 | 細かいUIの録画 |
| 標準 | 28 | 通常の作業録画（推奨） |
| 省容量 | 35 | 長時間録画・容量節約 |

CRF値が低いほど高画質・大容量になります。

## 圧縮効果の目安

macOS標準（ProRes/HEVC）と比較:

| 録画時間 | macOS標準 | このアプリ（標準） | 圧縮率 |
|---------|-----------|-------------------|-------|
| 5分 | ~500MB | ~30〜50MB | 1/10〜1/15 |
| 30分 | ~3GB | ~200〜300MB | 1/10〜1/15 |

## トラブルシューティング

### ffmpeg が見つからない

```
ffmpeg が見つかりません
インストール: brew install ffmpeg
```

Homebrew で ffmpeg をインストールしてください。

### 画面収録の許可

macOS のプライバシー設定で「画面収録」の許可が必要です。

システム設定 → プライバシーとセキュリティ → 画面収録 → アプリを追加

### 音声が録音されない

- 音声設定で「マイク」を選択してください
- システム音を録音したい場合は BlackHole などの仮想オーディオドライバが別途必要です

## 技術スタック

- Electron 32
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui（インライン実装）
- Lucide React（アイコン）
- FFmpeg（avfoundation キャプチャ + H.264 エンコード）
- Vite + vite-plugin-electron
