import type { ClipState, TextLine, TextStyle } from '../state/types'
import type { Artboard } from '../artboard/Artboard'
import {
  DEFAULT_ANIMATION_DURATION,
  resolveTextAnimationIn,
  resolveTextAnimationOut,
  type TextCharModifier,
  easeOut,
} from '../animation/AnimationEngine'

export class TextRenderer {
  private artboard: Artboard

  constructor(artboard: Artboard) {
    this.artboard = artboard
  }

  draw(
    clip: ClipState,
    px: number, py: number, pw: number, ph: number,
    ctx: CanvasRenderingContext2D,
    timeSeconds: number
  ) {
    if (!clip.lines?.length) return

    const abHeight = this.artboard.artboardRect.height
    const clipDuration = (clip.range!.end - clip.range!.start) / (clip.playbackRate ?? 1)
    const elapsed = timeSeconds - clip.offset

    let cursorY = py

    for (const line of clip.lines) {
      cursorY = this.drawLine(line, px, py, pw, ph, cursorY, elapsed, clipDuration, abHeight, ctx)
    }
  }

  private drawLine(
    line: TextLine,
    px: number, _py: number, pw: number, _ph: number,
    cursorY: number,
    elapsed: number,
    clipDuration: number,
    abHeight: number,
    ctx: CanvasRenderingContext2D
  ): number {
    const { style, animation } = line
    const fontSize = style.fontSize * abHeight
    const lineHeight = fontSize * (style.lineHeight ?? 1.2)
    const letterSpacing = (style.letterSpacing ?? 0) * abHeight

    cursorY += (style.marginTop ?? 0) * abHeight

    ctx.save()
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px "${style.fontFamily}"`
    ctx.textBaseline = 'top'

    const chars = [...line.content]
    const totalChars = chars.length

    // 1. totalWidth и cursorX
    let totalWidth = 0
    for (const ch of chars) totalWidth += ctx.measureText(ch).width + letterSpacing

    let cursorX: number
    if (style.align === 'center') cursorX = px + pw / 2 - totalWidth / 2
    else if (style.align === 'right') cursorX = px + pw - totalWidth
    else cursorX = px

    // 2. rotation линии
    if (style.rotation) {
      const lineCx = cursorX + totalWidth / 2
      const lineCy = cursorY + fontSize / 2
      ctx.translate(lineCx, lineCy)
      ctx.rotate((style.rotation * Math.PI) / 180)
      ctx.translate(-lineCx, -lineCy)
    }

    // 3. opacity линии
    ctx.globalAlpha = style.opacity ?? 1

    // 4. animMod
    let animMod: ((i: number) => TextCharModifier) | null = null
    if (animation?.in && animation.in.type !== 'block') {
      const dur = animation.in.duration ?? DEFAULT_ANIMATION_DURATION
      if (elapsed < dur) {
        const t = elapsed / dur
        animMod = (i) => resolveTextAnimationIn(animation.in!, t, i, totalChars)
      }
    }
    if (!animMod && animation?.out && animation.out.type !== 'block') {
      const dur = animation.out.duration ?? DEFAULT_ANIMATION_DURATION
      const outStart = clipDuration - dur
      if (elapsed >= outStart) {
        const t = (elapsed - outStart) / dur
        animMod = (i) => resolveTextAnimationOut(animation.out!, t, i, totalChars)
      }
    }

    // 5. фон
    if (style.background) {
      ctx.save()
      ctx.globalAlpha = 1
      ctx.fillStyle = style.background
      ctx.fillRect(cursorX - 4, cursorY - 2, totalWidth + 8, lineHeight + 4)
      ctx.restore()
    }

    // 6. block анимация
    if (animation?.in?.type === 'block' && elapsed < (animation.in.duration ?? DEFAULT_ANIMATION_DURATION)) {
      this.drawBlock(chars, cursorX, cursorY, totalWidth, lineHeight, letterSpacing, elapsed, animation.in.duration ?? DEFAULT_ANIMATION_DURATION, style, ctx)
      ctx.restore()
      return cursorY + lineHeight
    }

    // 7. посимвольный рендер
    this.drawChars(chars, cursorX, cursorY, fontSize, letterSpacing, abHeight, style, animMod, ctx)

    ctx.restore()
    return cursorY + lineHeight
  }

  private drawBlock(
    chars: string[],
    cursorX: number,
    cursorY: number,
    totalWidth: number,
    lineHeight: number,
    letterSpacing: number,
    elapsed: number,
    duration: number,
    style: TextStyle,
    ctx: CanvasRenderingContext2D
  ) {
    const t = elapsed / duration
    const progress = easeOut(Math.min(t * 2, 1))
    const reveal = easeOut(Math.max(t * 2 - 1, 0))

    const bx0 = cursorX - 4
    const by0 = cursorY - 2
    const bw = totalWidth + 8
    const bh = lineHeight + 4

    ctx.save()
    ctx.beginPath()
    ctx.rect(bx0, by0, bw, bh)
    ctx.clip()

    ctx.save()
    ctx.beginPath()
    ctx.rect(bx0, by0, bw * reveal, bh)
    ctx.clip()
    let bx = cursorX
    for (const ch of chars) {
      ctx.fillStyle = style.color
      ctx.fillText(ch, bx, cursorY)
      bx += ctx.measureText(ch).width + letterSpacing
    }
    ctx.restore()

    const maskX = bx0 + bw * reveal
    const maskW = bw * (progress - reveal)
    if (maskW > 0) {
      ctx.fillStyle = style.color
      ctx.fillRect(maskX, by0, maskW, bh)
    }

    ctx.restore()
  }

  private drawChars(
    chars: string[],
    cursorX: number,
    cursorY: number,
    fontSize: number,
    letterSpacing: number,
    abHeight: number,
    style: TextStyle,
    animMod: ((i: number) => TextCharModifier) | null,
    ctx: CanvasRenderingContext2D
  ) {
    let cx = cursorX
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i]
      const charWidth = ctx.measureText(ch).width
      const mod = animMod ? animMod(i) : null

      ctx.save()

      ctx.globalAlpha = style.opacity ?? 1
      if (mod) {
        ctx.globalAlpha *= mod.opacity
        const charCx = cx + charWidth / 2
        const charCy = cursorY + fontSize / 2
        ctx.translate(charCx, charCy)
        if (mod.scaleX !== 1 || mod.scaleY !== 1) ctx.scale(mod.scaleX, mod.scaleY)
        if (mod.rotation !== 0) ctx.rotate((mod.rotation * Math.PI) / 180)
        if (mod.translateX !== 0 || mod.translateY !== 0) {
          ctx.translate(mod.translateX * abHeight, mod.translateY * abHeight)
        }
        ctx.translate(-charCx, -charCy)
      }

      if (style.shadow) {
        ctx.shadowColor = style.shadow.color
        ctx.shadowBlur = style.shadow.blur
        ctx.shadowOffsetX = style.shadow.offsetX
        ctx.shadowOffsetY = style.shadow.offsetY
      }

      if (style.stroke) {
        ctx.strokeStyle = style.stroke.color
        ctx.lineWidth = style.stroke.width
        ctx.lineJoin = 'round'
        ctx.strokeText(ch, cx, cursorY)
      }

      ctx.fillStyle = style.color
      ctx.fillText(ch, cx, cursorY)

      ctx.restore()
      cx += charWidth + letterSpacing
    }
  }
}