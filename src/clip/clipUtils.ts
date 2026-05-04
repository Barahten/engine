import type { ClipState } from '../state/types'

export function isClipActive(clip: ClipState, timeSeconds: number): boolean {
  const rate = clip.playbackRate ?? 1
  const rawDuration = clip.range ? clip.range.end - clip.range.start : clip.duration
  const timelineDuration = rawDuration / rate
  return timeSeconds >= clip.offset && timeSeconds < clip.offset + timelineDuration
}