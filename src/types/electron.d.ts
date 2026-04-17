export {}

declare global {
  interface Window {
    recorder: import('../../electron/preload').RecorderAPI
  }
}
