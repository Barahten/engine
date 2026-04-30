import type { ClipState } from '../state/types'

export function isClipActive(clip: ClipState, timeSeconds: number): boolean {
  return timeSeconds >= clip.offset && timeSeconds < clip.offset + clip.duration
}