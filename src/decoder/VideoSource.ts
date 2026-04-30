// src/decoder/VideoSource.ts
import { UrlSource, Input, ALL_FORMATS, CanvasSink } from 'mediabunny'
import type { WrappedCanvas } from 'mediabunny'

const BUFFER_SIZE = 8
const BACKPRESSURE_MS = 4

class FrameBuffer {
  private frames: WrappedCanvas[] = []

  push(frame: WrappedCanvas) { this.frames.push(frame) }
  isFull() { return this.frames.length >= BUFFER_SIZE }
  isEmpty() { return this.frames.length === 0 }
  clear() { this.frames = [] }

  // Выбрасывает устаревшие кадры, возвращает актуальный для времени t
  consume(t: number): WrappedCanvas | null {
    let current: WrappedCanvas | null = null
    while (this.frames.length > 0 && this.frames[0].timestamp <= t) {
      current = this.frames.shift()!
    }
    return current
  }

  peek(): WrappedCanvas | null {
    return this.frames[0] ?? null
  }
}

export class VideoSource {
  private url: string
  private sink: CanvasSink | null = null
  private iterator: AsyncGenerator<WrappedCanvas> | null = null
  private buffer = new FrameBuffer()
  private currentFrame: WrappedCanvas | null = null
  private abortController: AbortController | null = null

  durationSeconds: number = 0
  nativeWidth: number = 0
  nativeHeight: number = 0
  nativeAspectRatio: number = 1

  constructor(url: string) {
    this.url = url
  }

  async init() {
    const input = new Input({ source: new UrlSource(this.url), formats: ALL_FORMATS })
    const track = await input.getPrimaryVideoTrack()
    if (!track) throw new Error(`No video track: ${this.url}`)
    this.durationSeconds = (await input.computeDuration()) ?? 0
    this.nativeWidth = track.displayWidth
    this.nativeHeight = track.displayHeight
    this.nativeAspectRatio = this.nativeWidth / (this.nativeHeight || 1)
    this.sink = new CanvasSink(track, { poolSize: BUFFER_SIZE + 2, fit: 'cover' })
  }

  async seek(timeSeconds: number) {
    this._stopDecodeLoop()
    this.buffer.clear()
    //this.currentFrame = null

    if (!this.sink) return

    this.iterator = this.sink.canvases(timeSeconds)

    if (!this.currentFrame) {
      // первый seek — ждём первый кадр
      const first = (await this.iterator.next()).value ?? null
      if (first) this.currentFrame = first
    }

    // Первый кадр — синхронно, чтобы seek был визуально мгновенным
    // const first = (await this.iterator.next()).value ?? null
    // if (first) {
    //   this.currentFrame = first
    // }

    this._startDecodeLoop()
  }

  tick(t: number) {
    const consumed = this.buffer.consume(t)
    if (consumed) this.currentFrame = consumed
  }

  private _startDecodeLoop() {
    this.abortController = new AbortController()
    const { signal } = this.abortController
    void this._runDecodeLoop(signal)
  }

  private _stopDecodeLoop() {
    this.abortController?.abort()
    this.abortController = null
    void this.iterator?.return(undefined)
    this.iterator = null
  }

  private async _runDecodeLoop(signal: AbortSignal) {
    const iterator = this.iterator
    if (!iterator) return

    while (!signal.aborted) {
      if (this.buffer.isFull()) {
        await new Promise(r => setTimeout(r, BACKPRESSURE_MS))
        continue
      }

      const result = await iterator.next()
      if (signal.aborted) break
      if (result.done || !result.value) break

      this.buffer.push(result.value)
    }
  }

  getCanvas(): HTMLCanvasElement | OffscreenCanvas | null {
    return this.currentFrame?.canvas ?? null
  }

  destroy() {
    this._stopDecodeLoop()
    this.buffer.clear()
    this.currentFrame = null
  }
}