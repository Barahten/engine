import type { ClipState } from '../state/types'
import type { SourceManager } from '../decoder/SourceManager'
import type { ArtboardRect } from '../artboard/Artboard'
import { TextRenderer } from './Textrenderer'
import type { Artboard } from '../artboard/Artboard'

export class ClipRenderer {
  private imageCache: Map<string, HTMLImageElement>
  private textRenderer: TextRenderer

  constructor(artboard: Artboard, imageCache: Map<string, HTMLImageElement>) {
    this.imageCache = imageCache
    this.textRenderer = new TextRenderer(artboard)
  }

  updateArtboard(artboard: Artboard) {
    this.textRenderer = new TextRenderer(artboard)
  }

  draw(
    clip: ClipState,
    px: number, py: number, pw: number, ph: number,
    sources: SourceManager,
    ctx: CanvasRenderingContext2D,
    timeSeconds: number
  ) {
    switch (clip.type) {
      case 'video': this.drawVideo(clip, px, py, pw, ph, sources, ctx); break
      case 'image': this.drawImage(clip, px, py, pw, ph, ctx); break
      case 'text':  this.textRenderer.draw(clip, px, py, pw, ph, ctx, timeSeconds); break
    }
  }

  private drawVideo(
    clip: ClipState,
    px: number, py: number, pw: number, ph: number,
    sources: SourceManager,
    ctx: CanvasRenderingContext2D
  ) {
    const source = sources.getVideoSync(clip.src, clip.id)
    const canvas = source?.getCanvas()
    if (!canvas) {
      ctx.fillStyle = '#222'
      ctx.fillRect(px, py, pw, ph)
      return
    }

    const { flipX, flipY, fit } = clip.transform
    const { dw, dh } = this.fitDimensions(fit, pw, ph, canvas.width, canvas.height)
    const ox = px + (pw - dw) / 2
    const oy = py + (ph - dh) / 2

    ctx.save()
    if (fit === 'cover') {
      ctx.beginPath()
      ctx.rect(px, py, pw, ph)
      ctx.clip()
    }
    this.applyRoundRect(ox, oy, dw, dh, clip.transform.borderRadius, ctx)
    this.applyFlip(flipX, flipY, px, py, pw, ph, ctx)
    ctx.drawImage(canvas, ox, oy, dw, dh)
    ctx.restore()
  }

  private drawImage(
    clip: ClipState,
    px: number, py: number, pw: number, ph: number,
    ctx: CanvasRenderingContext2D
  ) {
    this.loadImage(clip.src)
    const img = this.imageCache.get(clip.src)
    if (!img) return

    const { flipX, flipY, fit } = clip.transform
    const { dw, dh } = this.fitDimensions(fit, pw, ph, img.width, img.height)
    const ox = px + (pw - dw) / 2
    const oy = py + (ph - dh) / 2

    ctx.save()
    if (fit === 'cover') {
      ctx.beginPath()
      ctx.rect(px, py, pw, ph)
      ctx.clip()
    }
    this.applyRoundRect(ox, oy, dw, dh, clip.transform.borderRadius, ctx)
    this.applyFlip(flipX, flipY, px, py, pw, ph, ctx)
    ctx.drawImage(img, ox, oy, dw, dh)
    ctx.restore()
  }

  private fitDimensions(
    fit: string | undefined,
    pw: number, ph: number,
    srcW: number, srcH: number
  ): { dw: number; dh: number } {
    if (fit === 'fill') return { dw: pw, dh: ph }
    const scale = fit === 'cover'
      ? Math.max(pw / srcW, ph / srcH)
      : Math.min(pw / srcW, ph / srcH)
    return { dw: srcW * scale, dh: srcH * scale }
  }

  private applyFlip(
    flipX: boolean, flipY: boolean,
    px: number, py: number, pw: number, ph: number,
    ctx: CanvasRenderingContext2D
  ) {
    if (!flipX && !flipY) return
    ctx.translate(px + pw / 2, py + ph / 2)
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
    ctx.translate(-(px + pw / 2), -(py + ph / 2))
  }

  private applyRoundRect(
    x: number, y: number, w: number, h: number,
    radii: [number, number, number, number],
    ctx: CanvasRenderingContext2D
  ) {
    if (radii.every(r => r === 0)) return
    const [tl, tr, br, bl] = radii.map(r => r * Math.min(w, h))
    ctx.beginPath()
    ctx.moveTo(x + tl, y)
    ctx.lineTo(x + w - tr, y)
    ctx.arcTo(x + w, y, x + w, y + tr, tr)
    ctx.lineTo(x + w, y + h - br)
    ctx.arcTo(x + w, y + h, x + w - br, y + h, br)
    ctx.lineTo(x + bl, y + h)
    ctx.arcTo(x, y + h, x, y + h - bl, bl)
    ctx.lineTo(x, y + tl)
    ctx.arcTo(x, y, x + tl, y, tl)
    ctx.closePath()
    ctx.clip()
  }

  loadImage(src: string) {
    if (this.imageCache.has(src)) return
    const el = new Image()
    el.onload = () => this.imageCache.set(src, el)
    el.onerror = () => console.warn(`[ClipRenderer] Failed to load image: ${src}`)
    el.src = src
  }
}