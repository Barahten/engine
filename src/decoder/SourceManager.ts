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

  async getVideo(url: string, clipId: string): Promise<VideoSource> {
    const key = `${url}::${clipId}`
    if (this.videoSources.has(key)) return this.videoSources.get(key)!
    const source = new VideoSource(url)
    await source.init()
    this.videoSources.set(key, source)
    return source
  }

  getVideoSync(url: string, clipId: string): VideoSource | null {
    return this.videoSources.get(`${url}::${clipId}`) ?? null
  }

  async getAudio(url: string, clipId: string): Promise<AudioPlayer> {
    const key = `${url}::${clipId}`
    if (this.audioPlayers.has(key)) return this.audioPlayers.get(key)!
    const player = new AudioPlayer(url, this.actx)
    await player.init()
    this.audioPlayers.set(key, player)
    return player
  }

  getAudioSync(url: string, clipId: string): AudioPlayer | null {
    return this.audioPlayers.get(`${url}::${clipId}`) ?? null
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

  async preloadClip(clip: ClipState): Promise<ClipState> {
    const rangeStart = clip.range?.start ?? 0
    let duration = clip.duration
    let range = clip.range

    if (clip.type === 'video') {
      const video = await this.getVideo(clip.src, clip.id)
      if (!duration) duration = video.durationSeconds
      if (!range) range = { start: 0, end: video.durationSeconds }
      await video.seek(rangeStart)
    }

    if (clip.type === 'video' || clip.type === 'audio') {
      const audio = await this.getAudio(clip.src, clip.id)
      if (!duration) duration = audio.durationSeconds
      await audio.seek(rangeStart)
    }

    return { ...clip, duration, range }  // ← возвращаем новый объект, не мутируем
  }

  destroyVideo(url: string, clipId: string) {
    const key = `${url}::${clipId}`
    this.videoSources.get(key)?.destroy()
    this.videoSources.delete(key)
  }

  pruneStale(clipIds: Set<string>) {
    for (const key of this.videoSources.keys()) {
      const clipId = key.split('::')[1]
      if (!clipIds.has(clipId)) {
        this.videoSources.get(key)?.destroy()
        this.videoSources.delete(key)
      }
    }
    for (const key of this.audioPlayers.keys()) {
      const clipId = key.split('::')[1]
      if (!clipIds.has(clipId)) {
        this.audioPlayers.get(key)?.destroy()
        this.audioPlayers.delete(key)
      }
    }
  }
}