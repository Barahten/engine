export type ClockState = 'stopped' | 'playing' | 'scrubbing'

export class MasterClock {
  readonly actx: AudioContext
  private _state: ClockState = 'stopped'
  private startOffset: number = 0
  private startActxTime: number = 0

  onTick: ((timeSeconds: number) => void) | null = null
  private rafId: number = 0

  constructor() {
    this.actx = new AudioContext()
  }

  get state(): ClockState {
    return this._state
  }

  get currentTime(): number {
    if (this._state === 'stopped') return this.startOffset
    return Math.max(0, this.startOffset + (this.actx.currentTime - this.startActxTime))
  }

  async play(fromSeconds?: number) {
    if (this._state === 'playing') return
    if (fromSeconds !== undefined) this.startOffset = fromSeconds
    if (this.actx.state === 'suspended') await this.actx.resume()
    this.startActxTime = this.actx.currentTime
    this._state = 'playing'
    this.startRaf()
  }

  pause() {
    if (this._state !== 'playing') return
    this.startOffset = this.currentTime
    this._state = 'stopped'
    this.stopRaf()
  }

  seek(timeSeconds: number) {
    const t = Math.max(0, timeSeconds)  // ← guard
    const wasPlaying = this._state === 'playing'
    if (wasPlaying) this.stopRaf()
    this.startOffset = t
    this.startActxTime = this.actx.currentTime
    if (wasPlaying) this.startRaf()
    this.onTick?.(t)
  }

  private startRaf() {
    const loop = () => {
      if (this._state !== 'playing') return
      this.onTick?.(this.currentTime)
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  private stopRaf() {
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }

  destroy() {
    this.stopRaf()
    if (this.actx.state !== 'closed') {
      void this.actx.close()
    }
  }
}