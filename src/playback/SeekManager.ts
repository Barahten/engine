import { SourceManager } from '../decoder/SourceManager'
import { ScrubEngine } from './ScrubEngine'
import { Renderer } from '../renderer/Renderer'
import { buildSchedule } from './ClipScheduler'
import { AudioSyncManager } from './AudioSyncManager'
import type { MasterClock } from './MasterClock'
import type { CompositionState } from '../state/types'

export class SeekManager {
  private sources: SourceManager
  private clock: MasterClock
  private audioSync: AudioSyncManager
  private scrubEngine: ScrubEngine
  private renderer: Renderer

  private seekGeneration = 0
  private scrubGeneration = 0

  onTimeUpdate: ((t: number) => void) | null = null

  constructor(
    sources: SourceManager,
    clock: MasterClock,
    audioSync: AudioSyncManager,
    scrubEngine: ScrubEngine,
    renderer: Renderer
  ) {
    this.sources = sources
    this.clock = clock
    this.audioSync = audioSync
    this.scrubEngine = scrubEngine
    this.renderer = renderer
  }

  async seek(timeSeconds: number, state: CompositionState, wasPlaying: boolean) {
    const generation = ++this.seekGeneration

    this.audioSync.reset()
    this.clock.seek(timeSeconds)

    const seekPromises: Promise<void>[] = []
    for (const { clip, mediaTime } of buildSchedule(state, timeSeconds)) {
      const video = this.sources.getVideoSync(clip.src, clip.id)
      if (video) seekPromises.push(video.seek(mediaTime))
      const audio = this.sources.getAudioSync(clip.src, clip.id)
      if (audio) seekPromises.push(audio.seek(mediaTime))
    }
    await Promise.all(seekPromises)

    if (generation !== this.seekGeneration) return

    for (const { clip } of buildSchedule(state, timeSeconds)) {
      const lc = this.audioSync.getOrCreateClip(clip, state)
      lc.transition('loading')
      lc.transition('ready')
    }

    this.renderer.render(state, timeSeconds, this.sources)

    if (wasPlaying) await this.clock.play()
  }

  async scrub(timeSeconds: number, state: CompositionState) {
    const generation = ++this.scrubGeneration

    await this.scrubEngine.scrub(
      timeSeconds,
      state,
      this.onTimeUpdate ?? undefined
    )

    if (generation !== this.scrubGeneration) return

    this.clock.seek(timeSeconds)
    this.audioSync.reset()

    for (const { clip, mediaTime, active } of buildSchedule(state, timeSeconds)) {
      if (!active) continue
      const audio = this.sources.getAudioSync(clip.src, clip.id)
      if (audio) await audio.seek(mediaTime)
      const lc = this.audioSync.getOrCreateClip(clip, state)
      lc.transition('loading')
      lc.transition('ready')
    }
  }

  invalidate() {
    ++this.seekGeneration
    ++this.scrubGeneration
  }
}