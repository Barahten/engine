import type { CompositionState, ClipState } from '../state/types'
import { isClipActive } from '../clip/clipUtils'

export type ClipSchedule = {
  clip: ClipState
  mediaTime: number
  active: boolean
}

export function buildSchedule(state: CompositionState, timeSeconds: number): ClipSchedule[] {
  const result: ClipSchedule[] = []
  for (const layer of state.layers) {
    for (const clip of layer.clips) {
      const rangeStart = clip.range?.start ?? 0
      const mediaTime = Math.max(rangeStart, rangeStart + (timeSeconds - clip.offset))
      result.push({ clip, mediaTime, active: isClipActive(clip, timeSeconds) })
    }
  }
  return result
}