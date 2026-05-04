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
      const rate = clip.playbackRate ?? 1
      const mediaTime = Math.max(rangeStart, rangeStart + (timeSeconds - clip.offset) * rate)

      result.push({ clip, mediaTime, active: isClipActive(clip, timeSeconds) })
      //console.log(clip.id, 'active', isClipActive(clip, timeSeconds), 'mediaTime', mediaTime, 'timeSeconds', timeSeconds)
    }
  }

  return result
}