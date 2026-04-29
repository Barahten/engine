import { MasterClock } from './MasterClock'
import { ScrubEngine } from './ScrubEngine'
import { SourceManager } from '../decoder/SourceManager'
import { ClipManager } from '../clip/ClipManager'
import { Renderer } from '../renderer/Renderer'
import { Artboard } from '../artboard/Artboard'
import type { CompositionState, ClipState, AudioState } from '../state/types'

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
    if (duration > 0 && t >= duration) {
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
    for (const layer of this.state.layers) {
      for (const clip of layer.clips) {
        if (clip.type !== 'video') continue
        if (!this.clips.isActive(clip, t)) continue
        const source = this.sources.getVideoSync(clip.src)
        if (!source) continue
        const mediaTime = this.clipMediaTime(clip, t)
        source.tick(mediaTime)
      }
    }
  }

  private syncAudio(t: number) {
    for (const layer of this.state.layers) {
      for (const clip of layer.clips) {
        if (clip.type !== 'video' && clip.type !== 'audio') continue
        const lc = this.clips.getOrCreate(clip)
        const active = this.clips.isActive(clip, t)
        const player = this.sources.getAudioSync(clip.src)
        if (!player) continue

        if (active && lc.is('ready')) {
          lc.transition('playing')
          const mediaTime = this.clipMediaTime(clip, t)
          void player.play(mediaTime, clip.audio, clip.duration ?? 0)
        } else if (active && lc.is('paused')) {
          lc.transition('playing')
          const mediaTime = this.clipMediaTime(clip, t)
          void player.play(mediaTime, clip.audio, clip.duration ?? 0)
        } else if (!active && lc.is('playing')) {
          lc.transition('ended')
          player.stop()
        }
      }
    }
  }

  private stopAllAudio() {
    for (const layer of this.state.layers) {
      for (const clip of layer.clips) {
        if (clip.type !== 'video' && clip.type !== 'audio') continue
        this.sources.getAudioSync(clip.src)?.stop()
        this.clips.get(clip.id)?.transition('ended')
      }
    }
  }

  private clipMediaTime(clip: ClipState, timelineSeconds: number): number {
    const rangeStart = clip.range?.start ?? 0
    return rangeStart + (timelineSeconds - clip.offset)
  }

  async preloadClip(clip: ClipState) {
    await this.sources.preloadClip(clip)
    const lc = this.clips.getOrCreate(clip)
    lc.transition('loading')
    lc.transition('ready')
  }

  setState(state: CompositionState) {
    this.state = state
    this.artboard.update(state.aspectRatio, state.background)
    const t = Math.min(this.clock.currentTime, this.sources.getCompositionDuration(state) - 0.001)
    this.renderer.render(this.state, Math.max(0, t), this.sources)
  }

  setClipAudio(clipSrc: string, audio: AudioState) {
    const player = this.sources.getAudioSync(clipSrc)
    if (!player) return
    for (const layer of this.state.layers) {
      for (const clip of layer.clips) {
        if (clip.src !== clipSrc) continue
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
          this.sources.getAudioSync(clip.src)?.pause()
        }
      }
    }
  }

  async seek(timeSeconds: number) {
    const wasPlaying = this.clock.state === 'playing'
    if (wasPlaying) this.pause()
    this.lastTime = -1
    this.clips.resetAll()
    this.clock.seek(timeSeconds)

    for (const layer of this.state.layers) {
      for (const clip of layer.clips) {
        const mediaTime = this.clipMediaTime(clip, timeSeconds)
        const video = this.sources.getVideoSync(clip.src)
        if (video) await video.seek(mediaTime)
        const audio = this.sources.getAudioSync(clip.src)
        if (audio) await audio.seek(mediaTime)
        const lc = this.clips.getOrCreate(clip)
        lc.transition('loading')
        lc.transition('ready')
      }
    }

    this.renderer.render(this.state, timeSeconds, this.sources)
    if (wasPlaying) await this.play()
  }

  async scrub(timeSeconds: number) {
    return this.scrubEngine.scrub(timeSeconds, this.state, this.onTimeUpdate ?? undefined)
  }

  get currentTime(): number {
    return this.clock.currentTime
  }

  destroy() {
    this.clock.destroy()
  }
}