import { UrlSource, Input, ALL_FORMATS, CanvasSink } from 'mediabunny'
import type { WrappedCanvas } from 'mediabunny'

export class VideoSource {
  private url: string
  private sink: CanvasSink | null = null
  private iterator: AsyncGenerator<WrappedCanvas> | null = null
  private currentFrame: WrappedCanvas | null = null
  private nextFrame: WrappedCanvas | null = null
  private fetchingNext: boolean = false
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
    this.sink = new CanvasSink(track, { poolSize: 3, fit: 'contain' }) // допинать
  }

  async seek(timeSeconds: number) {
    void this.iterator?.return(undefined)
    this.iterator = null
    this.currentFrame = null
    this.nextFrame = null
    this.fetchingNext = false
    if (!this.sink) return
    this.iterator = this.sink.canvases(timeSeconds)
    this.currentFrame = (await this.iterator.next()).value ?? null
    this.nextFrame = (await this.iterator.next()).value ?? null
  }

  tick(timeSeconds: number) {
    if (!this.nextFrame) return
    if (this.nextFrame.timestamp > timeSeconds) return

    this.currentFrame = this.nextFrame
    this.nextFrame = null

    if (!this.fetchingNext) {
      this.fetchingNext = true
      void this.fetchNext(timeSeconds)
    }
  }

  private async fetchNext(timeSeconds: number) {
    if (!this.iterator) { this.fetchingNext = false; return }
    const iter = this.iterator
    while (true) {
      const result = (await iter.next()).value ?? null
      if (iter !== this.iterator) break
      if (!result) break
      if (result.timestamp <= timeSeconds) {
        this.currentFrame = result
      } else {
        this.nextFrame = result
        break
      }
    }
    this.fetchingNext = false
  }

  getCanvas(): HTMLCanvasElement | OffscreenCanvas | null {
    return this.currentFrame?.canvas ?? null
  }

  destroy() {
    void this.iterator?.return(undefined)
    this.iterator = null
    this.currentFrame = null
    this.nextFrame = null
  }
}