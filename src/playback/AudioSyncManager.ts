import { SourceManager } from '../decoder/SourceManager'
import { ClipManager } from '../clip/ClipManager'
import { ClipLifecycle } from '../clip/ClipLifecycle'
import { buildSchedule } from './ClipScheduler'
import type { CompositionState, ClipState, AudioState } from '../state/types'
import type { MasterClock } from './MasterClock'

export class AudioSyncManager {
  private sources: SourceManager
  private clips: ClipManager
  private clock: MasterClock

  constructor(sources: SourceManager, clips: ClipManager, clock: MasterClock) {
    this.sources = sources
    this.clips = clips
    this.clock = clock
  }

  sync(state: CompositionState, t: number) {
    for (const { clip, active } of buildSchedule(state, t)) {
      if (clip.type !== 'video' && clip.type !== 'audio') continue
      const lc = this.getOrCreateClip(clip, state)
      if (active && lc.isOneOf('ready', 'paused')) {
        lc.transition('playing')
      } else if (!active && lc.is('playing')) {
        lc.transition('ended')
      }
    }
  }

  stopAll(state: CompositionState) {
    for (const layer of state.layers) {
      for (const clip of layer.clips) {
        if (clip.type !== 'video' && clip.type !== 'audio') continue
        this.sources.getAudioSync(clip.src, clip.id)?.stop()
        const lc = this.clips.get(clip.id)
        if (lc && !lc.is('ended')) lc.transition('ended')
      }
    }
  }

  pauseAll(state: CompositionState) {
    for (const layer of state.layers) {
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

  setClipAudio(clipId: string, audio: AudioState, state: CompositionState) {
    const t = this.clock.currentTime
    for (const { clip, mediaTime } of buildSchedule(state, t)) {
      if (clip.id !== clipId) continue
      const player = this.sources.getAudioSync(clip.src, clip.id)
      if (!player) return
      player.applyGain(audio, mediaTime, clip.duration ?? 0)
      return
    }
  }

  reset() {
    this.clips.resetAll()
  }

  getOrCreateClip(clip: ClipState, state: CompositionState): ClipLifecycle {
    const existing = this.clips.get(clip.id)
    if (existing) return existing

    const lc = this.clips.getOrCreate(clip)
    lc.onTransition = (from, to) => {
      if (clip.type !== 'video' && clip.type !== 'audio') return

      if (to === 'playing') {
        const player = this.sources.getAudioSync(clip.src, clip.id)
        if (!player) return
        const currentClip = state.layers
          .flatMap(l => l.clips)
          .find(c => c.id === clip.id)
        const audio = currentClip?.audio ?? clip.audio
        const mediaTime = this.resolveMediaTime(clip, state)
        void player.play(
          mediaTime,
          audio,
          clip.duration ?? 0,
          clip.range?.start ?? 0,
          currentClip?.playbackRate ?? clip.playbackRate ?? 1
        )
      } else if (to === 'paused') {
        this.sources.getAudioSync(clip.src, clip.id)?.pause()
      } else if (to === 'ended' || to === 'idle') {
        this.sources.getAudioSync(clip.src, clip.id)?.stop()
      }
    }
    return lc
  }

  private resolveMediaTime(clip: ClipState, state: CompositionState): number {
    const t = this.clock.currentTime
    for (const entry of buildSchedule(state, t)) {
      if (entry.clip.id === clip.id) return entry.mediaTime
    }
    // fallback: compute directly if clip not in schedule at current time
    const rangeStart = clip.range?.start ?? 0
    return Math.max(rangeStart, rangeStart + (t - clip.offset))
  }
}