import React, {
  useState, useEffect, useCallback, useRef, useMemo
} from 'react'
import {
  Video, Square, AlertCircle, FolderOpen,
  Mic, MicOff, Monitor, AppWindow, Loader2
} from 'lucide-react'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Toast, type ToastType } from './components/ui/toast'
import type { CaptureSource, SourceList } from '../electron/preload'

// ─── 型 ────────────────────────────────────────────────────────────────────

type RecordingState = 'idle' | 'recording' | 'stopping'
type SourceTab = 'screen' | 'window'
type ToastState = { message: string; type: ToastType } | null

type AudioInputDevice = {
  deviceId: string
  label: string
}

// ─── 定数 ──────────────────────────────────────────────────────────────────

const QUALITY_OPTIONS = [
  { value: 'high',     label: '高画質',  videoBitsPerSecond: 8_000_000 },
  { value: 'standard', label: '標準',    videoBitsPerSecond: 4_000_000 },
  { value: 'compact',  label: '省容量',  videoBitsPerSecond: 1_500_000 },
]

// ─── カスタムフック ──────────────────────────────────────────────────────────

/** 経過時間タイマー */
function useElapsedTimer(active: boolean): number {
  const [elapsed, setElapsed] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (active) {
      setElapsed(0)
      ref.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } else {
      if (ref.current) { clearInterval(ref.current); ref.current = null }
      setElapsed(0)
    }
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [active])

  return elapsed
}

/** マイク音量モニタリング（0〜1） */
function useAudioMonitor(deviceId: string | null): number {
  const [level, setLevel] = useState(0)
  const rafRef = useRef<number | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      // 前のストリームを停止
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ctxRef.current?.close()

      if (!deviceId || deviceId === 'none') { setLevel(0); return }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId === 'default'
            ? true
            : { deviceId: { exact: deviceId } },
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }

        streamRef.current = stream
        const ctx = new AudioContext()
        ctxRef.current = ctx
        const src = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        src.connect(analyser)

        const buf = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(buf)
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length
          setLevel(avg / 255)
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        setLevel(0)
      }
    }

    start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ctxRef.current?.close()
    }
  }, [deviceId])

  return level
}

// ─── ユーティリティ ───────────────────────────────────────────────────────

function formatElapsed(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`
}

function shortenPath(p: string): string {
  const sep = p.includes('\\') ? '\\' : '/'
  const parts = p.split(sep)
  return parts.length <= 3 ? p : `~${sep}${parts.slice(-2).join(sep)}`
}

function getMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
}

// ─── コンポーネント ───────────────────────────────────────────────────────

/** 音量メーター */
function AudioLevelMeter({ level, disabled }: { level: number; disabled: boolean }) {
  const bars = 12
  const activeCount = Math.round(level * bars)

  return (
    <div className="flex items-center gap-0.5 h-4">
      {Array.from({ length: bars }, (_, i) => {
        const active = !disabled && i < activeCount
        const isHigh = i >= bars * 0.75
        const isMid = i >= bars * 0.5
        return (
          <div
            key={i}
            className={[
              'w-1.5 rounded-sm transition-all duration-75',
              active
                ? isHigh ? 'bg-red-500 h-4'
                  : isMid ? 'bg-yellow-400 h-3'
                  : 'bg-green-500 h-2'
                : 'bg-zinc-700 h-1.5',
            ].join(' ')}
          />
        )
      })}
    </div>
  )
}

/** ソースカード（画面 or ウィンドウ） */
function SourceCard({
  source,
  selected,
  isRecording,
  onClick,
}: {
  source: CaptureSource
  selected: boolean
  isRecording: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={isRecording}
      className={[
        'relative flex flex-col rounded-lg overflow-hidden border-2 transition-all text-left',
        selected
          ? 'border-red-500 ring-1 ring-red-500/30'
          : 'border-zinc-700 hover:border-zinc-500',
        isRecording ? 'cursor-default' : 'cursor-pointer',
      ].join(' ')}
    >
      {source.thumbnailDataUrl ? (
        <img
          src={source.thumbnailDataUrl}
          alt={source.name}
          className="w-full aspect-video object-cover bg-zinc-900"
        />
      ) : (
        <div className="w-full aspect-video bg-zinc-900 flex items-center justify-center">
          <AppWindow size={20} className="text-zinc-700" />
        </div>
      )}
      <div className="px-1.5 py-1 bg-zinc-900">
        <p className="text-[10px] text-zinc-400 truncate">{source.name}</p>
      </div>
      {selected && isRecording && (
        <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/60 rounded px-1 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] text-red-400 font-medium">REC</span>
        </div>
      )}
    </button>
  )
}

// ─── メインApp ────────────────────────────────────────────────────────────

export default function App() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [sourceList, setSourceList] = useState<SourceList>({ screens: [], windows: [] })
  const [audioDevices, setAudioDevices] = useState<AudioInputDevice[]>([])
  const [sourceTab, setSourceTab] = useState<SourceTab>('screen')
  const [selectedSourceId, setSelectedSourceId] = useState<string>('')
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('none')
  const [selectedQuality, setSelectedQuality] = useState('standard')
  const [outputDir, setOutputDir] = useState('')
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [loading, setLoading] = useState(true)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const activeStreamsRef = useRef<MediaStream[]>([])

  const isRecording = recordingState === 'recording'
  const elapsed = useElapsedTimer(isRecording)
  const audioLevel = useAudioMonitor(isRecording ? null : selectedAudioDeviceId)

  const showToast = useCallback((message: string, type: ToastType) => setToast({ message, type }), [])

  const handleChooseOutputDir = useCallback(async () => {
    if (!window.recorder) return
    const chosen = await window.recorder.chooseOutputDir()
    if (chosen) setOutputDir(chosen)
  }, [])

  // 初期化
  useEffect(() => {
    async function init() {
      if (!window.recorder) return

      // マイク列挙に必要な許可を得る
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ audio: true })
        tmp.getTracks().forEach((t) => t.stop())
      } catch { /* 許可なし */ }

      const [dir, sources, devices] = await Promise.all([
        window.recorder.getOutputDir(),
        window.recorder.getSources(),
        navigator.mediaDevices.enumerateDevices(),
      ])

      setOutputDir(dir)
      setSourceList(sources)

      const audioInputs: AudioInputDevice[] = devices
        .filter((d) => d.kind === 'audioinput' && d.deviceId)
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `マイク (${d.deviceId.slice(0, 8)})` }))

      setAudioDevices(audioInputs)

      // デフォルト選択
      if (sources.screens.length > 0) setSelectedSourceId(sources.screens[0].id)
      const mic = audioInputs.find((d) => /default/i.test(d.deviceId))
        ?? audioInputs[0]
      if (mic) setSelectedAudioDeviceId(mic.deviceId)

      setLoading(false)
    }

    init()
  }, [])

  // 現在選択中のソース
  const currentSources = sourceTab === 'screen' ? sourceList.screens : sourceList.windows

  const selectedSource = useMemo(
    () => [...sourceList.screens, ...sourceList.windows].find((s) => s.id === selectedSourceId),
    [sourceList, selectedSourceId]
  )

  // 録画開始
  const handleStart = useCallback(async () => {
    if (recordingState !== 'idle' || !selectedSource) return

    const quality = QUALITY_OPTIONS.find((q) => q.value === selectedQuality)!
    const streams: MediaStream[] = []

    try {
      // 画面 or ウィンドウの映像を取得
      const videoStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          // @ts-expect-error Electron固有のAPI
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedSource.id,
          },
        },
      })
      streams.push(videoStream)

      // 音声を取得（選択している場合）
      let audioStream: MediaStream | null = null
      if (selectedAudioDeviceId && selectedAudioDeviceId !== 'none') {
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: selectedAudioDeviceId } },
          })
          streams.push(audioStream)
        } catch {
          showToast('音声デバイスの取得に失敗しました。音声なしで録画します。', 'error')
        }
      }

      activeStreamsRef.current = streams

      // ストリームを結合
      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...(audioStream?.getAudioTracks() ?? []),
      ])

      const mimeType = getMimeType()
      const recorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: quality.videoBitsPerSecond,
      })

      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      recorder.onstop = async () => {
        streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
        activeStreamsRef.current = []

        const blob = new Blob(chunksRef.current, { type: mimeType })
        const buffer = await blob.arrayBuffer()
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'

        try {
          const result = await window.recorder!.saveRecording(buffer, ext)
          setLastSavedPath(result.outputPath)
          showToast(`保存しました: ${result.outputPath.split('/').pop()}`, 'success')
        } catch {
          showToast('ファイルの保存に失敗しました', 'error')
        }

        setRecordingState('idle')
      }

      recorder.onerror = () => {
        streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
        activeStreamsRef.current = []
        showToast('録画エラーが発生しました', 'error')
        setRecordingState('idle')
      }

      mediaRecorderRef.current = recorder
      recorder.start(1000) // 1秒ごとにチャンク
      setRecordingState('recording')
    } catch (err) {
      streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
      const msg = err instanceof Error ? err.message : '録画開始に失敗しました'
      showToast(msg, 'error')
    }
  }, [recordingState, selectedSource, selectedQuality, selectedAudioDeviceId, showToast])

  // 録画停止
  const handleStop = useCallback(() => {
    if (recordingState !== 'recording') return
    setRecordingState('stopping')
    mediaRecorderRef.current?.stop()
  }, [recordingState])

  const isDisabled = recordingState === 'stopping'

  const audioOptions = [
    ...audioDevices.map((d) => ({ value: d.deviceId, label: d.label })),
    { value: 'none', label: 'なし（音声なし）' },
  ]

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden">
      {/* タイトルバー */}
      <div
        className="h-8 shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center gap-2">
          <Video size={15} className="text-zinc-400" />
          <h1 className="text-sm font-semibold text-zinc-200">Screen Recorder</h1>
        </div>

        {/* ソース選択タブ */}
        <div className="flex flex-col gap-2">
          <div className="flex rounded-lg overflow-hidden border border-zinc-800">
            {(['screen', 'window'] as SourceTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  if (!isRecording && !isDisabled) {
                    setSourceTab(tab)
                    const list = tab === 'screen' ? sourceList.screens : sourceList.windows
                    if (list.length > 0) setSelectedSourceId(list[0].id)
                  }
                }}
                disabled={isRecording || isDisabled}
                className={[
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs transition-colors',
                  sourceTab === tab
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')}
              >
                {tab === 'screen' ? <Monitor size={12} /> : <AppWindow size={12} />}
                {tab === 'screen' ? '画面全体' : 'アプリウィンドウ'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-24 rounded-lg bg-zinc-900 border border-zinc-800">
              <Loader2 size={18} className="animate-spin text-zinc-600" />
            </div>
          ) : currentSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 h-24 rounded-lg bg-zinc-900 border border-zinc-800">
              <AlertCircle size={16} className="text-zinc-600" />
              <span className="text-xs text-zinc-600">
                {sourceTab === 'window' ? 'ウィンドウが見つかりません' : '画面が見つかりません'}
              </span>
            </div>
          ) : (
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${Math.min(currentSources.length, 3)}, 1fr)` }}
            >
              {currentSources.map((src) => (
                <SourceCard
                  key={src.id}
                  source={src}
                  selected={selectedSourceId === src.id}
                  isRecording={isRecording}
                  onClick={() => !isRecording && !isDisabled && setSelectedSourceId(src.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 録画タイマー */}
        <div className="flex items-center justify-between rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2.5">
          {isRecording ? (
            <>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <Badge variant="recording">録画中</Badge>
              </div>
              <span className="font-mono text-lg font-light text-zinc-100">
                {formatElapsed(elapsed)}
              </span>
            </>
          ) : recordingState === 'stopping' ? (
            <>
              <span className="text-xs text-zinc-400">保存中...</span>
              <Loader2 size={14} className="animate-spin text-zinc-500" />
            </>
          ) : (
            <>
              <div className="h-2 w-2 rounded-full bg-zinc-700" />
              <span className="font-mono text-lg font-light text-zinc-600">00:00</span>
            </>
          )}
        </div>

        {/* 音声設定 + レベルメーター */}
        <div className="flex flex-col gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5">
          <div className="flex items-center gap-2">
            {selectedAudioDeviceId === 'none'
              ? <MicOff size={13} className="shrink-0 text-zinc-500" />
              : <Mic size={13} className="shrink-0 text-zinc-400" />}
            <span className="text-xs text-zinc-500 shrink-0">音声</span>
            <select
              value={selectedAudioDeviceId}
              onChange={(e) => setSelectedAudioDeviceId(e.target.value)}
              disabled={isRecording || isDisabled || loading}
              className="flex-1 bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700 focus:outline-none disabled:opacity-50 min-w-0"
            >
              {audioOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* リアルタイム音量メーター */}
          <div className="flex items-center gap-2 pl-[21px]">
            <span className="text-[10px] text-zinc-600 shrink-0 w-8">
              {selectedAudioDeviceId === 'none' ? '' : isRecording ? '●' : '試聴'}
            </span>
            <AudioLevelMeter
              level={audioLevel}
              disabled={selectedAudioDeviceId === 'none'}
            />
            {selectedAudioDeviceId !== 'none' && !isRecording && audioLevel < 0.01 && (
              <span className="text-[10px] text-zinc-600">← 声を出してみてください</span>
            )}
          </div>
        </div>

        {/* 画質設定 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 shrink-0 w-8">画質</span>
          <div className="flex flex-1 rounded-lg overflow-hidden border border-zinc-800">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => !isRecording && setSelectedQuality(opt.value)}
                disabled={isRecording || isDisabled}
                className={[
                  'flex-1 py-1.5 text-xs transition-colors',
                  selectedQuality === opt.value
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 録画ボタン */}
        {isRecording ? (
          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            onClick={handleStop}
            disabled={isDisabled}
          >
            <Square size={14} fill="currentColor" />
            停止して保存
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
            onClick={handleStart}
            disabled={isDisabled || loading || !selectedSource}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-white/90" />
            録画開始
          </Button>
        )}

        {/* 保存先 */}
        <div className="mt-auto flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-600">保存先 (WebM形式)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleChooseOutputDir}
                disabled={isRecording || isDisabled}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
              >
                <FolderOpen size={11} />
                変更
              </button>
              {lastSavedPath && (
                <button
                  onClick={() => window.recorder?.showInFinder(lastSavedPath)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  フォルダで開く
                </button>
              )}
            </div>
          </div>
          <p className="truncate text-xs text-zinc-500 font-mono">
            {outputDir ? shortenPath(outputDir) : '読み込み中...'}
          </p>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-4 right-4 z-50">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  )
}
