import { UrlSource, Input, ALL_FORMATS, AudioBufferSink } from 'mediabunny'
import type { AudioState } from '../state/types'

const CLICK_FADE = 0.008

export class AudioPlayer {
  private url: string
  private sink: AudioBufferSink | null = null
  private iterator: AsyncGenerator<{ buffer: AudioBuffer; timestamp: number }> | null = null
  private queuedNodes = new Set<AudioBufferSourceNode>()
  readonly actx: AudioContext
  private gainNode: GainNode
  private ctxStartTime: number = 0
  private mediaStartTime: number = 0
  durationSeconds: number = 0

  constructor(url: string, actx: AudioContext) {
    this.url = url
    this.actx = actx
    this.gainNode = actx.createGain()
    this.gainNode.connect(actx.destination)
  }

  async init() {
    const input = new Input({ source: new UrlSource(this.url), formats: ALL_FORMATS })
    const track = await input.getPrimaryAudioTrack()
    if (!track) return
    this.durationSeconds = (await input.computeDuration()) ?? 0
    this.sink = new AudioBufferSink(track)
  }

  async seek(timeSeconds: number) {
    this.stopNodes()
    void this.iterator?.return(undefined)
    this.iterator = null
    this.mediaStartTime = timeSeconds
  }

  async play(mediaTime: number, audio: AudioState, clipDuration: number) {
    if (!this.sink) return
    this.stopNodes()
    void this.iterator?.return(undefined)
    this.mediaStartTime = mediaTime
    this.iterator = this.sink.buffers(mediaTime)
    this.ctxStartTime = this.actx.currentTime - mediaTime
    this.scheduleGain(audio, mediaTime, clipDuration)
    void this.schedule()
  }

  pause() {
    const now = this.actx.currentTime
    this.gainNode.gain.cancelScheduledValues(now)
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now)
    this.gainNode.gain.linearRampToValueAtTime(0, now + CLICK_FADE)
    setTimeout(() => this.stopNodes(), (CLICK_FADE * 1000) + 5)
    // iterator НЕ убиваем
  }

  stop() {
    const now = this.actx.currentTime
    this.gainNode.gain.cancelScheduledValues(now)
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now)
    this.gainNode.gain.linearRampToValueAtTime(0, now + CLICK_FADE)
    void this.iterator?.return(undefined)
    this.iterator = null
    setTimeout(() => this.stopNodes(), (CLICK_FADE * 1000) + 5)
  }

  applyGain(audio: AudioState, mediaTime: number, clipDuration: number) {
    this.scheduleGain(audio, mediaTime, clipDuration)
  }

  private scheduleGain(audio: AudioState, mediaTime: number, clipDuration: number) {
    const now = this.actx.currentTime
    this.gainNode.gain.cancelScheduledValues(now)

    if (audio.muted) {
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now)
      this.gainNode.gain.linearRampToValueAtTime(0, now + CLICK_FADE)
      return
    }

    const vol = audio.volume
    const fadeIn = audio.fade.in
    const fadeOut = audio.fade.out
    const pos = mediaTime - this.mediaStartTime
    const remaining = clipDuration - pos

    if (fadeIn > 0 && pos < fadeIn) {
      this.gainNode.gain.setValueAtTime(0, now)
      this.gainNode.gain.linearRampToValueAtTime(vol, now + (fadeIn - pos))
    } else {
      this.gainNode.gain.setValueAtTime(vol, now)
    }

    if (fadeOut > 0 && remaining > 0) {
      const fadeOutStart = remaining - fadeOut
      if (fadeOutStart > 0) {
        this.gainNode.gain.setValueAtTime(vol, now + fadeOutStart)
      }
      this.gainNode.gain.linearRampToValueAtTime(0, now + remaining)
    }
  }

  private async schedule() {
    if (!this.iterator) return
    const iter = this.iterator
    for await (const { buffer, timestamp } of iter) {
      if (iter !== this.iterator) break
      const node = this.actx.createBufferSource()
      node.buffer = buffer
      node.connect(this.gainNode)
      const when = this.ctxStartTime + timestamp
      const offset = Math.max(0, this.actx.currentTime - when)
      if (offset >= buffer.duration) continue
      node.start(Math.max(when, this.actx.currentTime), offset)
      this.queuedNodes.add(node)
      node.onended = () => this.queuedNodes.delete(node)

      const ahead = timestamp - (this.actx.currentTime - this.ctxStartTime)
      if (ahead >= 1) {
        await new Promise<void>(resolve => {
          const id = setInterval(() => {
            const a = timestamp - (this.actx.currentTime - this.ctxStartTime)
            if (iter !== this.iterator || a < 1) { clearInterval(id); resolve() }
          }, 100)
        })
      }
    }
  }

  private stopNodes() {
    for (const node of this.queuedNodes) {
      try { node.stop() } catch {}
    }
    this.queuedNodes.clear()
  }

  destroy() {
    this.stopNodes()
    void this.iterator?.return(undefined)
  }
}