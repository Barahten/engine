export type ClipLifecycleState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'ended'

type Transition = Record<ClipLifecycleState, ClipLifecycleState[]>

const ALLOWED: Transition = {
  idle:    ['loading'],
  loading: ['ready', 'idle'],
  ready:   ['playing', 'idle'],
  playing: ['paused', 'ended', 'idle'],
  paused:  ['playing', 'idle'],
  ended:   ['idle'],
}

export class ClipLifecycle {
  private _state: ClipLifecycleState = 'idle'
  private _clipId: string

  onTransition: ((from: ClipLifecycleState, to: ClipLifecycleState) => void) | null = null

  constructor(clipId: string) {
    this._clipId = clipId
  }

  get state(): ClipLifecycleState {
    return this._state
  }

  transition(to: ClipLifecycleState): boolean {
    if (!ALLOWED[this._state].includes(to)) {
      console.warn(`[Clip ${this._clipId}] Invalid transition: ${this._state} → ${to}`)
      return false
    }
    const from = this._state
    this._state = to
    this.onTransition?.(from, to)
    return true
  }

  reset() {
    if (this._state === 'idle') return
    const from = this._state
    this._state = 'idle'
    this.onTransition?.(from, 'idle')
  }

  is(state: ClipLifecycleState): boolean {
    return this._state === state
  }

  isOneOf(...states: ClipLifecycleState[]): boolean {
    return states.includes(this._state)
  }
}