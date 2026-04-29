export class Clock {
  private fps: number
  private _frame: number = 0
  private _playing: boolean = false
  private lastTimestamp: number | null = null

  onTick: ((frame: number) => void) | null = null

  constructor(fps: number) {
    this.fps = fps
  }

  get frame() { return this._frame }
  get playing() { return this._playing }

  play() { this._playing = true }
  pause() {
    this._playing = false
    this.lastTimestamp = null
  }

  seek(frame: number) {
    this._frame = frame
    this.onTick?.(frame)
  }

  tick(timestamp: number) {
    if (!this._playing) return
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp
    }
    const delta = (timestamp - this.lastTimestamp) / 1000
    this.lastTimestamp = timestamp
    this._frame += delta * this.fps
    this.onTick?.(this._frame)
  }
}