import { MasterClock } from './MasterClock'
import { ScrubEngine } from './ScrubEngine'
import { SourceManager } from '../decoder/SourceManager'
import { ClipManager } from '../clip/ClipManager'
import { Renderer } from '../renderer/Renderer'
import { Artboard } from '../artboard/Artboard'
import { AudioSyncManager } from './AudioSyncManager'
import { SeekManager } from './SeekManager'
import { buildSchedule } from './ClipScheduler'
import type { CompositionState, ClipState, AudioState } from '../state/types'

export class PlaybackEngine {
  private clock: MasterClock
  private sources: SourceManager
  private renderer: Renderer
  private artboard: Artboard
  private audioSync: AudioSyncManager
  private seekManager: SeekManager
  private state: CompositionState
  private lastTime: number = -1

  onTimeUpdate: ((timeSeconds: number) => void) | null = null
  onEnd: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement, state: CompositionState) {
    this.state = state
    this.clock = new MasterClock()
    this.sources = new SourceManager(this.clock.actx)
    this.artboard = new Artboard(canvas, state.aspectRatio, state.background)
    this.renderer = new Renderer(canvas.getContext('2d')!, this.artboard)

    const clips = new ClipManager()
    const scrubEngine = new ScrubEngine(this.sources, this.renderer)
    this.audioSync = new AudioSyncManager(this.sources, clips, this.clock)
    this.seekManager = new SeekManager(this.sources, this.clock, this.audioSync, scrubEngine, this.renderer)

    this.clock.onTick = (t) => this.onClockTick(t)
  }

  private onClockTick(t: number) {
    const duration = this.sources.getCompositionDuration(this.state)
    if (duration <= 0) return
    if (t >= duration) {
      this.clock.pause()
      this.audioSync.stopAll(this.state)
      this.renderer.render(this.state, duration - 0.001, this.sources)
      this.onEnd?.()
      return
    }

    this.audioSync.sync(this.state, t)
    this.tickVideo(t)
    this.renderer.render(this.state, t, this.sources)
    this.onTimeUpdate?.(t)
    this.lastTime = t
  }

  private tickVideo(t: number) {
    for (const { clip, mediaTime, active } of buildSchedule(this.state, t)) {
      if (clip.type !== 'video' || !active) continue
      this.sources.getVideoSync(clip.src, clip.id)?.tick(mediaTime)
    }
  }

  async preloadClip(clip: ClipState): Promise<ClipState> {
    const enriched = await this.sources.preloadClip(clip)
    const lc = this.audioSync.getOrCreateClip(enriched, this.state)
    lc.transition('loading')
    lc.transition('ready')
    return enriched
  }

  setState(state: CompositionState) {
    this.state = state
    this.artboard.update(state.aspectRatio, state.background)
    const t = Math.min(this.clock.currentTime, this.sources.getCompositionDuration(state) - 0.001)
    let frames = 0
    const tick = () => {
      this.renderer.render(this.state, t, this.sources)
      if (++frames < 5) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  setClipAudio(clipId: string, audio: AudioState) {
    this.audioSync.setClipAudio(clipId, audio, this.state)
  }

  async play() {
    await this.clock.play()
  }

  pause() {
    this.clock.pause()
    this.audioSync.pauseAll(this.state)
  }

  async seek(timeSeconds: number) {
    const wasPlaying = this.clock.state === 'playing'
    if (wasPlaying) this.pause()
    this.lastTime = -1
    this.seekManager.onTimeUpdate = this.onTimeUpdate
    await this.seekManager.seek(timeSeconds, this.state, wasPlaying)
  }

  async scrub(timeSeconds: number) {
    this.seekManager.onTimeUpdate = this.onTimeUpdate
    await this.seekManager.scrub(timeSeconds, this.state)
  }

  onResize() {
    this.artboard.onCanvasResize()
    this.renderer.render(this.state, this.clock.currentTime, this.sources)
  }

  get currentTime(): number {
    return this.clock.currentTime
  }

  destroy() {
    this.audioSync.stopAll(this.state)
    this.sources.pruneStale(new Set())
    this.renderer.clearImageCache()
    this.seekManager.invalidate()
    this.clock.destroy()
  }
}