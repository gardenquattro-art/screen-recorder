import { app, BrowserWindow, ipcMain, shell, desktopCapturer, screen, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null
let customOutputDir: string | null = null

function getOutputDir(): string {
  const dir = customOutputDir ?? path.join(os.homedir(), 'Desktop', 'Recordings')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function formatDateTime(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  )
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 700,
    resizable: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC: 出力ディレクトリ
ipcMain.handle('recorder:get-output-dir', () => getOutputDir())

// IPC: 録画ソース一覧（画面 + ウィンドウ）
ipcMain.handle('recorder:get-sources', async () => {
  const [screenSources, windowSources] = await Promise.all([
    desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 320, height: 200 },
    }),
    desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 320, height: 200 },
    }),
  ])

  const displays = screen.getAllDisplays()
  const primaryId = screen.getPrimaryDisplay().id

  const screens = displays.map((display, i) => {
    const src = screenSources.find((s) => s.display_id === String(display.id))
      ?? screenSources[i]
    return {
      id: src?.id ?? '',
      name: display.id === primaryId ? 'メイン画面' : `サブ画面 ${i}`,
      type: 'screen' as const,
      thumbnailDataUrl: src?.thumbnail.toDataURL() ?? '',
    }
  })

  const windows = windowSources
    .filter((s) => s.name.trim().length > 0)
    .map((s) => ({
      id: s.id,
      name: s.name,
      type: 'window' as const,
      thumbnailDataUrl: s.thumbnail.toDataURL(),
    }))

  return { screens, windows }
})

// IPC: 録画ファイルを保存（ArrayBufferをファイルに書き出す）
ipcMain.handle('recorder:save', async (_event, buffer: ArrayBuffer, extension: string) => {
  const outputDir = getOutputDir()
  const fileName = `recording_${formatDateTime()}.${extension}`
  const fullPath = path.join(outputDir, fileName)
  fs.writeFileSync(fullPath, Buffer.from(buffer))
  return { success: true, outputPath: fullPath }
})

// IPC: 保存先フォルダを選択
ipcMain.handle('recorder:choose-output-dir', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: '保存先フォルダを選択',
    defaultPath: getOutputDir(),
  })
  if (result.canceled || result.filePaths.length === 0) return null
  customOutputDir = result.filePaths[0]
  return customOutputDir
})

// IPC: フォルダで開く（macOS: Finder / Windows: Explorer）
ipcMain.handle('recorder:show-in-finder', async (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})
