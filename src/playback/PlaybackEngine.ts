import { MasterClock } from './MasterClock'
import { ScrubEngine } from './ScrubEngine'
import { SourceManager } from '../decoder/SourceManager'
import { ClipManager } from '../clip/ClipManager'
import { Renderer } from '../renderer/Renderer'
import { Artboard } from '../artboard/Artboard'
import type { CompositionState, ClipState, AudioState } from '../state/types'
import { ClipLifecycle } from '../clip/ClipLifecycle'
import { buildSchedule } from './ClipScheduler'

export class PlaybackEngine {
  private clock: MasterClock
  private sources: SourceManager
  private clips: ClipManager
  private renderer: Renderer
  private artboard: Artboard
  private scrubEngine: ScrubEngine
  private state: CompositionState
  private lastTime: number = -1

  onTimeUpdate: ((timeSeconds: number) => void) | null = null
  onEnd: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement, state: CompositionState) {
    this.state = state
    this.clock = new MasterClock()
    this.sources = new SourceManager(this.clock.actx)
    this.clips = new ClipManager()
    this.artboard = new Artboard(canvas, state.aspectRatio, state.background)
    this.renderer = new Renderer(canvas.getContext('2d')!, this.artboard)
    this.scrubEngine = new ScrubEngine(this.sources, this.renderer)

    this.clock.onTick = (t) => this.onClockTick(t)
  }

  private onClockTick(t: number) {
    const duration = this.sources.getCompositionDuration(this.state)
    if (duration <= 0) return
    if (t >= duration) {
      this.clock.pause()
      this.stopAllAudio()
      this.renderer.render(this.state, duration - 0.001, this.sources)
      this.onEnd?.()
      return
    }

    this.syncAudio(t)
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

  private syncAudio(t: number) {
    for (const { clip, active } of buildSchedule(this.state, t)) {
      if (clip.type !== 'video' && clip.type !== 'audio') continue
      const lc = this.getOrCreateClip(clip)
      if (active && lc.isOneOf('ready', 'paused')) {
        lc.transition('playing')
      } else if (!active && lc.is('playing')) {
        lc.transition('ended')
      }
    }
  }

  private stopAllAudio() {
    for (const layer of this.state.layers) {
      for (const clip of layer.clips) {
        if (clip.type !== 'video' && clip.type !== 'audio') continue
        this.sources.getAudioSync(clip.src, clip.id)?.stop()
        const lc = this.clips.get(clip.id)
        if (lc && !lc.is('ended')) lc.transition('ended')
      }
    }
  }

  private clipMediaTime(clip: ClipState, timelineSeconds: number): number {
    const rangeStart = clip.range?.start ?? 0
    return Math.max(rangeStart, rangeStart + (timelineSeconds - clip.offset))
  }

  async preloadClip(clip: ClipState): Promise<ClipState> {
    const enriched = await this.sources.preloadClip(clip)
    const lc = this.getOrCreateClip(enriched)
    lc.transition('loading')
    lc.transition('ready')
    return enriched
  }

  setState(state: CompositionState) {
    this.state = state
    this.artboard.update(state.aspectRatio, state.background)
    const t = Math.min(this.clock.currentTime, this.sources.getCompositionDuration(state) - 0.001)
    this.renderer.render(this.state, Math.max(0, t), this.sources)
  }

  setClipAudio(clipId: string, audio: AudioState) {
    for (const layer of this.state.layers) {
      for (const clip of layer.clips) {
        if (clip.id !== clipId) continue
        const player = this.sources.getAudioSync(clip.src, clip.id)  // ← добавить clip.id
        if (!player) return
        const mediaTime = this.clipMediaTime(clip, this.clock.currentTime)
        player.applyGain(audio, mediaTime, clip.duration ?? 0)
        return
      }
    }
  }

  async play() {
    await this.clock.play()
  }

  pause() {
    this.clock.pause()
    for (const layer of this.state.layers) {
      for (const clip of layer.clips) {
        if (clip.type !== 'video' && clip.type !== 'audio') continue
        const lc = this.clips.get(clip.id)
        if (lc?.is('playing')) {
          lc.transition('paused')
          this.sources.getAudioSync(clip.src, clip.id)?.pause()
        }
      }
    }
  }

  private seekGeneration = 0
  async seek(timeSeconds: number) {
    const generation = ++this.seekGeneration
    const wasPlaying = this.clock.state === 'playing'
    if (wasPlaying) this.pause()
    this.lastTime = -1
    this.clips.resetAll()
    this.clock.seek(timeSeconds)
    const seekPromises: Promise<void>[] = []
    for (const { clip, mediaTime } of buildSchedule(this.state, timeSeconds)) {
      const video = this.sources.getVideoSync(clip.src, clip.id)
      if (video) seekPromises.push(video.seek(mediaTime))
      const audio = this.sources.getAudioSync(clip.src, clip.id)
      if (audio) seekPromises.push(audio.seek(mediaTime))
    }
    await Promise.all(seekPromises)
    if (generation !== this.seekGeneration) return
    for (const { clip } of buildSchedule(this.state, timeSeconds)) {
      const lc = this.getOrCreateClip(clip)
      lc.transition('loading')
      lc.transition('ready')
    }
    this.renderer.render(this.state, timeSeconds, this.sources)
    if (wasPlaying) await this.play()
  }

  private scrubGeneration = 0
  async scrub(timeSeconds: number) {
    const generation = ++this.scrubGeneration
    await this.scrubEngine.scrub(timeSeconds, this.state, this.onTimeUpdate ?? undefined)
    if (generation !== this.scrubGeneration) return
    this.clock.seek(timeSeconds)
    this.clips.resetAll()
    for (const { clip, mediaTime, active } of buildSchedule(this.state, timeSeconds)) {
      if (!active) continue  // ← та же фильтрация что в ScrubEngine
      const audio = this.sources.getAudioSync(clip.src, clip.id)
      if (audio) await audio.seek(mediaTime)  // ← mediaTime из buildSchedule, не clipMediaTime
      const lc = this.getOrCreateClip(clip)
      lc.transition('loading')
      lc.transition('ready')
    }
  }

  private getOrCreateClip(clip: ClipState): ClipLifecycle {
    const existing = this.clips.get(clip.id)
    if (existing) return existing

    const lc = this.clips.getOrCreate(clip)
    lc.onTransition = (from, to) => {
      if (clip.type !== 'video' && clip.type !== 'audio') return
      if (to === 'playing') {
        const player = this.sources.getAudioSync(clip.src, clip.id)
        if (player) {
          // берём актуальный клип из state, не из замыкания
          const currentClip = this.state.layers
            .flatMap(l => l.clips)
            .find(c => c.id === clip.id)
          const audio = currentClip?.audio ?? clip.audio
          const mediaTime = this.clipMediaTime(clip, this.clock.currentTime)
          void player.play(mediaTime, clip.audio, clip.duration ?? 0, clip.range?.start ?? 0)
        }
      } else if (to === 'paused') {
        this.sources.getAudioSync(clip.src, clip.id)?.pause()
      } else if (to === 'ended' || to === 'idle') {
        this.sources.getAudioSync(clip.src, clip.id)?.stop()
      }
    }
    return lc
  }

  onResize() {
    this.artboard.onCanvasResize()
    this.renderer.render(this.state, this.clock.currentTime, this.sources)
  }

  get currentTime(): number {
    return this.clock.currentTime
  }

  destroy() {
  this.stopAllAudio()
  this.sources.pruneStale(new Set())
  this.renderer.clearImageCache()
  ++this.seekGeneration
  ++this.scrubGeneration
  this.clock.destroy()
}
}