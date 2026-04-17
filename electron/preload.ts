import { contextBridge, ipcRenderer } from 'electron'

export type CaptureSource = {
  id: string
  name: string
  type: 'screen' | 'window'
  thumbnailDataUrl: string
}

export type SourceList = {
  screens: CaptureSource[]
  windows: CaptureSource[]
}

export type RecorderAPI = {
  getOutputDir: () => Promise<string>
  getSources: () => Promise<SourceList>
  saveRecording: (buffer: ArrayBuffer, extension: string) => Promise<{ success: boolean; outputPath: string }>
  chooseOutputDir: () => Promise<string | null>
  showInFinder: (filePath: string) => Promise<void>
}

contextBridge.exposeInMainWorld('recorder', {
  getOutputDir: () => ipcRenderer.invoke('recorder:get-output-dir'),
  getSources: () => ipcRenderer.invoke('recorder:get-sources'),
  saveRecording: (buffer: ArrayBuffer, extension: string) =>
    ipcRenderer.invoke('recorder:save', buffer, extension),
  chooseOutputDir: () => ipcRenderer.invoke('recorder:choose-output-dir'),
  showInFinder: (filePath: string) => ipcRenderer.invoke('recorder:show-in-finder', filePath),
} satisfies RecorderAPI)
