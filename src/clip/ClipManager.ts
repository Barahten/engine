import { ClipLifecycle } from './ClipLifecycle'
import type { ClipLifecycleState } from './ClipLifecycle'
import type { ClipState } from '../state/types'

export class ClipManager {
  private clips = new Map<string, ClipLifecycle>()

  get(clipId: string): ClipLifecycle | null {
    return this.clips.get(clipId) ?? null
  }

  getOrCreate(clip: ClipState): ClipLifecycle {
    if (!this.clips.has(clip.id)) {
      const lc = new ClipLifecycle(clip.id)
      this.clips.set(clip.id, lc)
    }
    return this.clips.get(clip.id)!
  }

  transition(clipId: string, to: ClipLifecycleState): boolean {
    const lc = this.clips.get(clipId)
    if (!lc) return false
    return lc.transition(to)
  }

isActive(clip: ClipState, timeSeconds: number): boolean {
  const duration = clip.duration ?? 0
  return timeSeconds >= clip.offset && timeSeconds < clip.offset + duration
}

  syncWithTime(clips: ClipState[], timeSeconds: number) {
    for (const clip of clips) {
      const lc = this.getOrCreate(clip)
      const active = this.isActive(clip, timeSeconds)

      if (active && lc.is('ready')) {
        lc.transition('playing')
      } else if (active && lc.is('ended')) {
        lc.transition('idle')
        lc.transition('loading')
        lc.transition('ready')
        lc.transition('playing')
      } else if (!active && lc.is('playing')) {
        lc.transition('ended')
      }
    }
  }

  resetAll() {
    for (const lc of this.clips.values()) {
      lc.reset()
    }
  }

  remove(clipId: string) {
    this.clips.delete(clipId)
  }

  pruneStale(currentClipIds: Set<string>) {
    for (const id of this.clips.keys()) {
      if (!currentClipIds.has(id)) this.clips.delete(id)
    }
  }
}