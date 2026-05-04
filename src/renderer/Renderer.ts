import type { CompositionState, ClipState, Background, LayerState } from '../state/types'
import type { SourceManager } from '../decoder/SourceManager'
import { Artboard, ArtboardRect } from '../artboard/Artboard'
import { LayerCompositor } from '../composition/LayerCompositor'
import { isClipActive } from '../clip/clipUtils'
import { AnimationModifier, DEFAULT_ANIMATION_DURATION, resolveAnimationIn, resolveAnimationOut } from '../animation/AnimationEngine'
import { ClipRenderer } from './ClipRenderer'

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private artboard: Artboard
  private compositor: LayerCompositor
  private imageCache = new Map<string, HTMLImageElement>()
  private clipRenderer: ClipRenderer

  constructor(ctx: CanvasRenderingContext2D, artboard: Artboard) {
    this.ctx = ctx
    this.artboard = artboard
    this.compositor = new LayerCompositor()
    this.clipRenderer = new ClipRenderer(artboard, this.imageCache)
  }

  updateArtboard(artboard: Artboard) {
    this.artboard = artboard
    this.clipRenderer.updateArtboard(artboard)
  }

  render(state: CompositionState, timeSeconds: number, sources: SourceManager) {
    const { ctx } = this
    const { width, height } = ctx.canvas
    const ab = this.artboard.artboardRect

    ctx.clearRect(0, 0, width, height)
    this.drawBackground(state.background)

    const activeIds = new Set(state.layers.map(l => l.id))
    this.compositor.pruneStale(activeIds)

    for (const layer of state.layers) {
      const offscreen = this.compositor.getOrCreate(layer.id, width, height)
      const offCtx = offscreen.getContext('2d')!
      offCtx.clearRect(0, 0, width, height)
      this.renderLayer(layer, timeSeconds, sources, offCtx, ab)
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(ab.x, ab.y, ab.width, ab.height)
    ctx.clip()
    this.compositor.composite(ctx, state.layers.map(l => l.id))
    ctx.restore()
  }

  private renderLayer(
    layer: LayerState,
    timeSeconds: number,
    sources: SourceManager,
    ctx: CanvasRenderingContext2D,
    ab: ArtboardRect
  ) {
    for (const clip of layer.clips) {
      if (!isClipActive(clip, timeSeconds)) continue
      this.renderClip(clip, timeSeconds, sources, ctx, ab)
    }
  }

  private renderClip(
    clip: ClipState,
    timeSeconds: number,
    sources: SourceManager,
    ctx: CanvasRenderingContext2D,
    ab: ArtboardRect
  ) {
    const { transform } = clip
    const { x: px, y: py, width: pw, height: ph } = this.artboard.toCanvas(transform)

    const mod = this.resolveAnimation(clip, timeSeconds)

    ctx.save()
    ctx.globalAlpha = transform.opacity * mod.opacity

    const cx = px + pw / 2
    const cy = py + ph / 2
    ctx.translate(cx, cy)
    if (mod.scaleX !== 1 || mod.scaleY !== 1) ctx.scale(mod.scaleX, mod.scaleY)
    if (mod.rotation !== 0) ctx.rotate((mod.rotation * Math.PI) / 180)
    if (mod.translateX !== 0 || mod.translateY !== 0) {
      ctx.translate(mod.translateX * ab.width, mod.translateY * ab.height)
    }
    ctx.translate(-cx, -cy)

    if (transform.rotation !== 0) {
      ctx.translate(cx, cy)
      ctx.rotate((transform.rotation * Math.PI) / 180)
      ctx.translate(-cx, -cy)
    }

    if (mod.clipRect) {
      ctx.beginPath()
      ctx.rect(px + mod.clipRect.x * pw, py + mod.clipRect.y * ph, mod.clipRect.w * pw, mod.clipRect.h * ph)
      ctx.clip()
    }

    this.clipRenderer.draw(clip, px, py, pw, ph, sources, ctx, timeSeconds)

    ctx.restore()
  }

  private resolveAnimation(clip: ClipState, t: number): AnimationModifier {
    const DEFAULT: AnimationModifier = { opacity: 1, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotation: 0 }
    if (!clip.animation) return DEFAULT

    const elapsed = t - clip.offset

    // range может отсутствовать у image/text — считаем duration напрямую
    const clipDuration = clip.range
      ? (clip.range.end - clip.range.start) / (clip.playbackRate ?? 1)
      : clip.duration

    if (clip.animation.in) {
      const dur = clip.animation.in.duration ?? DEFAULT_ANIMATION_DURATION
      if (elapsed < dur) return resolveAnimationIn(clip.animation.in, elapsed / dur)
    }

    if (clip.animation.out) {
      const dur = clip.animation.out.duration ?? DEFAULT_ANIMATION_DURATION
      const outStart = clipDuration - dur
      if (elapsed >= outStart) return resolveAnimationOut(clip.animation.out, (elapsed - outStart) / dur)
    }

    return DEFAULT
  }

  private drawBackground(bg: Background) {
    const ab = this.artboard.artboardRect
    const { ctx } = this

    if (bg.type === 'solid') {
      ctx.fillStyle = bg.color
      ctx.fillRect(ab.x, ab.y, ab.width, ab.height)
    } else if (bg.type === 'gradient') {
      const rad = (bg.angle * Math.PI) / 180
      const cx = ab.x + ab.width / 2
      const cy = ab.y + ab.height / 2
      const len = Math.sqrt(ab.width ** 2 + ab.height ** 2) / 2
      const grad = ctx.createLinearGradient(
        cx - Math.cos(rad) * len, cy - Math.sin(rad) * len,
        cx + Math.cos(rad) * len, cy + Math.sin(rad) * len
      )
      for (const stop of bg.stops) grad.addColorStop(stop.position, stop.color)
      ctx.fillStyle = grad
      ctx.fillRect(ab.x, ab.y, ab.width, ab.height)
    } else if (bg.type === 'image') {
      this.clipRenderer.loadImage(bg.src)
      const img = this.imageCache.get(bg.src)
      if (img) ctx.drawImage(img, ab.x, ab.y, ab.width, ab.height)
    }
  }

  clearImageCache() {
    this.imageCache.clear()
  }
}