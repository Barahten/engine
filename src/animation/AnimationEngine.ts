export type AnimationModifier = {
  opacity: number
  scaleX: number
  scaleY: number
  translateX: number
  translateY: number
  rotation: number
  clipRect?: { x: number; y: number; w: number; h: number }
}

const DEFAULT_MODIFIER: AnimationModifier = {
  opacity: 1,
  scaleX: 1,
  scaleY: 1,
  translateX: 0,
  translateY: 0,
  rotation: 0,
}
export const DEFAULT_ANIMATION_DURATION = 0.6

// easing functions
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function bounceOut(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375
}

function elastic(t: number): number {
  return t === 0 ? 0 : t === 1 ? 1
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1
}

import type { AnimationIn, AnimationOut, AnimationDirection, TextAnimationIn, TextAnimationOut } from '../state/types'

export function resolveAnimationIn(anim: AnimationIn, t: number): AnimationModifier {
  const e = easeOut(t)
  const dir = anim.direction ?? 'right'

  switch (anim.type) {
    case 'fade':
      return { ...DEFAULT_MODIFIER, opacity: t }

    case 'float': {
      const offset = (1 - e) * 0.05
      return {
        ...DEFAULT_MODIFIER,
        opacity: t,
        translateX: dir === 'left' ? -offset : dir === 'right' ? offset : 0,
        translateY: dir === 'top' ? -offset : dir === 'bottom' ? offset : 0,
      }
    }

    case 'zoom_in':
      return { ...DEFAULT_MODIFIER, opacity: t, scaleX: 0.5 + e * 0.5, scaleY: 0.5 + e * 0.5 }

    case 'ken_burns':
      return { ...DEFAULT_MODIFIER, scaleX: 1 + (1 - t) * 0.1, scaleY: 1 + (1 - t) * 0.1 }

    case 'slide': {
      const offset = (1 - e) * 0.3
      return {
        ...DEFAULT_MODIFIER,
        translateX: dir === 'left' ? -offset : dir === 'right' ? offset : 0,
        translateY: dir === 'top' ? -offset : dir === 'bottom' ? offset : 0,
      }
    }

    case 'wipe': {
        const progress = easeOut(t)
        const clipRect = dir === 'left'   ? { x: 1 - progress, y: 0, w: progress, h: 1 }
                        : dir === 'right'  ? { x: 0, y: 0, w: progress, h: 1 }
                        : dir === 'top'    ? { x: 0, y: 1 - progress, w: 1, h: progress }
                        :                    { x: 0, y: 0, w: 1, h: progress }
        return { ...DEFAULT_MODIFIER, clipRect }
        }

      case 'drop': {
          const e = easeOut(t)
          const scale = 1 + (1 - e) * 1.5  // от 2.5x до 1x
          return { ...DEFAULT_MODIFIER, opacity: t, scaleX: scale, scaleY: scale }
      }

    case 'pop':
      return { ...DEFAULT_MODIFIER, opacity: t, scaleX: 0.8 + elastic(t) * 0.2, scaleY: 0.8 + elastic(t) * 0.2 }

    case 'bounce':
      return { ...DEFAULT_MODIFIER, translateY: -(1 - bounceOut(t)) * 0.15 }

    case 'spin':
      return { ...DEFAULT_MODIFIER, opacity: t, rotation: dir === 'right' ? (1 - e) * 180 : -(1 - e) * 180 }

    case 'slide_bounce': {
      const offset = (1 - bounceOut(t)) * 0.3
      return {
        ...DEFAULT_MODIFIER,
        translateX: dir === 'left' ? -offset : dir === 'right' ? offset : 0,
        translateY: dir === 'top' ? -offset : dir === 'bottom' ? offset : 0,
      }
    }

    case 'gentle_float': {
      const offset = (1 - easeInOut(t)) * 0.03
      return {
        ...DEFAULT_MODIFIER,
        opacity: t,
        translateX: dir === 'left' ? -offset : dir === 'right' ? offset : 0,
        translateY: dir === 'top' ? -offset : dir === 'bottom' ? offset : 0,
      }
    }

    default:
      return { ...DEFAULT_MODIFIER }
  }
}

export function resolveAnimationOut(anim: AnimationOut, t: number): AnimationModifier {
  // t идёт от 0 до 1 где 1 = конец клипа
  return resolveAnimationIn(anim as AnimationIn, 1 - t)
}




export type TextCharModifier = {
  opacity: number
  scaleX: number
  scaleY: number
  translateX: number
  translateY: number
  rotation: number
  blur: number
  clipRect?: { x: number; y: number; w: number; h: number }
}

const DEFAULT_CHAR_MODIFIER: TextCharModifier = {
  opacity: 1, scaleX: 1, scaleY: 1,
  translateX: 0, translateY: 0,
  rotation: 0, blur: 0,
}

// t = 0..1 прогресс анимации всей линии
// charIndex = индекс символа
// totalChars = всего символов в линии
export function resolveTextAnimationIn(
  anim: TextAnimationIn,
  t: number,
  charIndex: number,
  totalChars: number
): TextCharModifier {
  // stagger — каждый символ стартует чуть позже
  const stagger = totalChars > 1 ? charIndex / (totalChars - 1) * 0.5 : 0
  const localT = Math.max(0, Math.min(1, (t - stagger) / (1 - stagger * 0.5)))
  const e = easeOut(localT)

  switch (anim.type) {
    case 'fade':
        return { ...DEFAULT_CHAR_MODIFIER, opacity: localT }

    case 'slide':
        return { ...DEFAULT_CHAR_MODIFIER, opacity: e, translateX: (1 - e) * 0.05 }

    // case 'block': {
    //     // wipe слева направо — символ видим если его индекс уже "открыт"
    //     const revealed = charIndex / totalChars < t
    //     return { ...DEFAULT_CHAR_MODIFIER, opacity: revealed ? 1 : 0 }
    // }

    case 'typewriter':
        return { ...DEFAULT_CHAR_MODIFIER, opacity: charIndex < Math.floor(t * totalChars) ? 1 : 0 }

    case 'rise':
        return { ...DEFAULT_CHAR_MODIFIER, opacity: e, translateY: (1 - e) * 0.05 }

    case 'pop':
        return { ...DEFAULT_CHAR_MODIFIER, opacity: e, scaleX: 0.8 + elastic(localT) * 0.2, scaleY: 0.8 + elastic(localT) * 0.2 }

    case 'drop':
        return { ...DEFAULT_CHAR_MODIFIER, opacity: e, scaleX: 1 + (1 - e) * 1.5, scaleY: 1 + (1 - e) * 1.5 }

    case 'compress':
        return { ...DEFAULT_CHAR_MODIFIER, opacity: e, scaleX: e, scaleY: 1 }

    case 'bounce':
        return { ...DEFAULT_CHAR_MODIFIER, translateY: -(1 - bounceOut(localT)) * 0.08 }

    case 'wave': {
        const wave = Math.sin(charIndex * 0.8 - t * Math.PI * 4) * (1 - t)
        return { ...DEFAULT_CHAR_MODIFIER, translateY: wave * 0.05 }
    }

    case 'fall':
        return { ...DEFAULT_CHAR_MODIFIER, opacity: e, translateY: -(1 - e) * 0.08 }

    case 'skid':
        return { ...DEFAULT_CHAR_MODIFIER, opacity: e, translateX: (1 - e) * 0.15, rotation: (1 - e) * -15 }

    case 'flipboard':
        return { ...DEFAULT_CHAR_MODIFIER, opacity: localT > 0.5 ? 1 : 0, scaleY: Math.abs(Math.cos(localT * Math.PI)) }

    case 'scale':
        return { ...DEFAULT_CHAR_MODIFIER, opacity: e, scaleX: 0.3 + e * 0.7, scaleY: 0.3 + e * 0.7 }

    case 'dragonfly': {
        const chaos = 1 - e
        return {
            ...DEFAULT_CHAR_MODIFIER,
            opacity: e,
            translateX: Math.sin(charIndex * 2.3 + t * 8) * chaos * 0.04,
            translateY: Math.cos(charIndex * 1.7 + t * 6) * chaos * 0.04,
            rotation: chaos * 30 * Math.sin(t * 5 + charIndex)
        }
    }

    case 'billboard':
        return { ...DEFAULT_CHAR_MODIFIER, opacity: localT > 0.5 ? 1 : 0, scaleX: Math.abs(Math.cos(localT * Math.PI)) }

    case 'roll':
        return { ...DEFAULT_CHAR_MODIFIER, opacity: e, translateX: -(1 - e) * 0.08, rotation: (1 - e) * -180 }

    default:
      return { ...DEFAULT_CHAR_MODIFIER }
  }
}

export function resolveTextAnimationOut(
    anim: TextAnimationOut,
    t: number,
    charIndex: number,
    totalChars: number
): TextCharModifier {
    return resolveTextAnimationIn(anim as TextAnimationIn, 1 - t, totalChars - 1 - charIndex, totalChars)
}

