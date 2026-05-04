import { PlaybackEngine } from '../playback/PlaybackEngine'
import { normalizeClip, validateCompositionState } from '../state/validators'
import type { CompositionState, ClipState, AudioState, ClipInput, CompositionInput } from '../state/types'
const FONT_CATALOG: Record<string, string> = {
  'Montserrat-400-normal': 'http://localhost:8000/storage/v1/object/public/media/fonts/Montserrat-Regular.woff2',
  'Montserrat-700-normal': 'http://localhost:8000/storage/v1/object/public/media/fonts/Montserrat-Bold.woff2',
  'Montserrat-400-italic': 'http://localhost:8000/storage/v1/object/public/media/fonts/Montserrat-Italic.woff2',
  'Kablammo-400-normal': 'http://localhost:8000/storage/v1/object/public/media/fonts/Kablammo-Regular.woff2',
}
export class Composition {
  private engine: PlaybackEngine
  private currentState: CompositionInput
  onTimeUpdate: ((timeSeconds: number) => void) | null = null
  onEnd: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement, state: CompositionInput) {
    const normalized = this.normalizeState(state)
    const errors = validateCompositionState(normalized)
    if (errors.length) throw new Error(`Invalid composition state: ${errors.map(e => e.message).join(', ')}`)
    this.currentState = state 
    this.engine = new PlaybackEngine(canvas, normalized)
    this.engine.onTimeUpdate = (t) => this.onTimeUpdate?.(t)
    this.engine.onEnd = () => this.onEnd?.()
  }

  private async loadFonts(state: CompositionInput): Promise<void> {

    const needed = new Map<string, { family: string; weight: number; style: string }>()

    for (const layer of state.layers) {
      for (const clip of layer.clips) {
        for (const line of clip.lines ?? []) {
          const { fontFamily: family, fontWeight: weight = 400, fontStyle: style = 'normal' } = line.style
          const key = `${family}-${weight}-${style}`
          if (!needed.has(key)) needed.set(key, { family, weight, style })
        }
      }
    }

    await Promise.all([...needed.entries()].map(async ([key, { family, weight, style }]) => {
      const url = FONT_CATALOG[key]
      if (!url) return
      const font = new FontFace(family, `url(${url})`, { weight: String(weight), style })
      await font.load()
      document.fonts.add(font)

    }))

  }

  private warmupFonts(state: CompositionInput) {
    const ctx = document.createElement('canvas').getContext('2d')!
    for (const layer of state.layers) {
      for (const clip of layer.clips) {
        for (const line of clip.lines ?? []) {
          const { fontFamily, fontWeight, fontStyle, fontSize } = line.style
          const px = fontSize * 100
          ctx.font = `${fontStyle} ${fontWeight} ${px}px "${fontFamily}"`
          ctx.fillText(line.content, 0, 0)
        }
      }
    }
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

  async setState(state: CompositionInput) {
    this.currentState = state
    await this.loadFonts(state)
    this.warmupFonts(state)
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