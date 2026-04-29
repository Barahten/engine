import { VideoSource } from './VideoSource'
import { AudioPlayer } from './AudioPlayer'
import type { ClipState, CompositionState } from '../state/types'

export class SourceManager {
  private videoSources = new Map<string, VideoSource>()
  private audioPlayers = new Map<string, AudioPlayer>()
  private actx: AudioContext

  constructor(actx: AudioContext) {
    this.actx = actx
  }

  async getVideo(url: string): Promise<VideoSource> {
    if (this.videoSources.has(url)) return this.videoSources.get(url)!
    const source = new VideoSource(url)
    await source.init()
    this.videoSources.set(url, source)
    return source
  }

  getVideoSync(url: string): VideoSource | null {
    return this.videoSources.get(url) ?? null
  }

  async getAudio(url: string): Promise<AudioPlayer> {
    if (this.audioPlayers.has(url)) return this.audioPlayers.get(url)!
    const player = new AudioPlayer(url, this.actx)
    await player.init()
    this.audioPlayers.set(url, player)
    return player
  }

  getAudioSync(url: string): AudioPlayer | null {
    return this.audioPlayers.get(url) ?? null
  }

  getCompositionDuration(state: CompositionState): number {
    let max = 0
    for (const layer of state.layers) {
      for (const clip of layer.clips) {
        const end = clip.offset + (clip.duration ?? 0)
        if (end > max) max = end
      }
    }
    return max
  }

  async preloadClip(clip: ClipState): Promise<void> {
    const rangeStart = clip.range?.start ?? 0

    if (clip.type === 'video') {
      const video = await this.getVideo(clip.src)
      if (!clip.duration) {
        (clip as any).duration = video.durationSeconds
      }
      if (!clip.range) {
        (clip as any).range = { start: 0, end: video.durationSeconds }
      }
      await video.seek(rangeStart)
    }

    if (clip.type === 'video' || clip.type === 'audio') {
      const audio = await this.getAudio(clip.src)
      if (!clip.duration) {
        (clip as any).duration = audio.durationSeconds
      }
      await audio.seek(rangeStart)
    }
  }

  destroyVideo(url: string) {
    this.videoSources.get(url)?.destroy()
    this.videoSources.delete(url)
  }

  pruneStale(urls: Set<string>) {
    for (const url of this.videoSources.keys()) {
      if (!urls.has(url)) this.destroyVideo(url)
    }
    for (const url of this.audioPlayers.keys()) {
      if (!urls.has(url)) {
        this.audioPlayers.get(url)?.destroy()
        this.audioPlayers.delete(url)
      }
    }
  }
}