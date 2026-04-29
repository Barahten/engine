import { PlaybackEngine } from '../playback/PlaybackEngine'
import { validateCompositionState } from '../state/validators'
import type { CompositionState, ClipState, AudioState } from '../state/types'

export class Composition {
  private engine: PlaybackEngine

  onTimeUpdate: ((timeSeconds: number) => void) | null = null
  onEnd: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement, state: CompositionState) {
    const errors = validateCompositionState(state)
    if (errors.length) {
      console.warn('[Composition] State validation errors:', errors)
    }
    this.engine = new PlaybackEngine(canvas, state)
    this.engine.onTimeUpdate = (t) => this.onTimeUpdate?.(t)
    this.engine.onEnd = () => this.onEnd?.()
  }

  setState(state: CompositionState) {
    const errors = validateCompositionState(state)
    if (errors.length) {
      console.warn('[Composition] State validation errors:', errors)
    }
    this.engine.setState(state)
  }

  setClipAudio(clipSrc: string, audio: AudioState) {
    this.engine.setClipAudio(clipSrc, audio)
  }

  async preloadClip(clip: ClipState) {
    return this.engine.preloadClip(clip)
  }

  async scrub(timeSeconds: number) {
    return this.engine.scrub(timeSeconds)
  }

  async play() { return this.engine.play() }
  pause() { this.engine.pause() }
  async seek(timeSeconds: number) { return this.engine.seek(timeSeconds) }

  get currentTime(): number { return this.engine.currentTime }

  destroy() { this.engine.destroy() }
}