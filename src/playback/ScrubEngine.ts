import type { CompositionState } from '../state/types'
import type { SourceManager } from '../decoder/SourceManager'
import type { Renderer } from '../renderer/Renderer'
import { isClipActive } from '../clip/clipUtils'
import { buildSchedule } from './ClipScheduler'

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

      for (const { clip, mediaTime, active } of buildSchedule(state, t)) {
        if (!active) continue
        const video = this.sources.getVideoSync(clip.src, clip.id)
        if (video) await video.seek(mediaTime)
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