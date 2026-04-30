import { PlaybackEngine } from '../playback/PlaybackEngine'
import { normalizeClip, validateCompositionState } from '../state/validators'
import type { CompositionState, ClipState, AudioState, ClipInput, CompositionInput } from '../state/types'

export class Composition {
  private engine: PlaybackEngine

  onTimeUpdate: ((timeSeconds: number) => void) | null = null
  onEnd: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement, state: CompositionInput) {
    const normalized = this.normalizeState(state)
    const errors = validateCompositionState(normalized)
    if (errors.length) throw new Error(`Invalid composition state: ${errors.map(e => e.message).join(', ')}`)
    this.engine = new PlaybackEngine(canvas, normalized)
    this.engine.onTimeUpdate = (t) => this.onTimeUpdate?.(t)
    this.engine.onEnd = () => this.onEnd?.()
  }

  private normalizeState(state: CompositionInput): CompositionState {
    return {
      ...state,
      layers: state.layers.map(l => ({
        ...l,
        clips: l.clips.map(c => normalizeClip(c))
      }))
    }
  }

  setState(state: CompositionInput) {
    this.engine.setState(this.normalizeState(state))
  }

  async preloadClip(clip: ClipInput): Promise<ClipState> {
    return this.engine.preloadClip(normalizeClip(clip))
  }

  async preloadAll(clips: ClipInput[], concurrency = 3): Promise<ClipState[]> {
    const results: ClipState[] = new Array(clips.length)
    const queue = clips.map((clip, i) => ({ clip, i }))
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const { clip, i } = queue.shift()!
        results[i] = await this.preloadClip(clip)
      }
    })
    await Promise.all(workers)
    return results
  }

  setClipAudio(clipId: string, audio: AudioState) {
    this.engine.setClipAudio(clipId, audio)
  }

  async scrub(timeSeconds: number) { return this.engine.scrub(timeSeconds) }
  onResize() { this.engine.onResize() }
  async play() { return this.engine.play() }
  pause() { this.engine.pause() }
  async seek(timeSeconds: number) { return this.engine.seek(timeSeconds) }
  get currentTime(): number { return this.engine.currentTime }
  destroy() { this.engine.destroy() }
}