import type { CompositionState } from '../state/types'
import type { SourceManager } from '../decoder/SourceManager'
import type { Renderer } from '../renderer/Renderer'

export class ScrubEngine {
  private pending: number | null = null
  private scrubbing = false

  constructor(
    private sources: SourceManager,
    private renderer: Renderer,
  ) {}

  async scrub(
    timeSeconds: number,
    state: CompositionState,
    onScrub?: (t: number) => void
  ) {
    this.pending = timeSeconds

    if (this.scrubbing) return
    this.scrubbing = true

    while (this.pending !== null) {
      const t = this.pending
      this.pending = null

      for (const layer of state.layers) {
        for (const clip of layer.clips) {
          const rangeStart = clip.range?.start ?? 0
          const mediaTime = rangeStart + (t - clip.offset)
          const clamped = Math.max(rangeStart, mediaTime)
          const video = this.sources.getVideoSync(clip.src)
          if (video) await video.seek(clamped)
        }
      }

      this.renderer.render(state, t, this.sources)
      onScrub?.(t)
    }

    this.scrubbing = false
  }

  get isScrubbing() {
    return this.scrubbing
  }
}