import type { CompositionState, ClipState, Background, LayerState } from '../state/types'
import type { SourceManager } from '../decoder/SourceManager'
import { Artboard, ArtboardRect } from '../artboard/Artboard'
import { LayerCompositor } from '../composition/LayerCompositor'
import { isClipActive } from '../clip/clipUtils'

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private artboard: Artboard
  private compositor: LayerCompositor
  private imageCache = new Map<string, HTMLImageElement>()



  private loadImage(src: string) {
    if (this.imageCache.has(src)) return
    const el = new Image()
    el.onload = () => this.imageCache.set(src, el)
    el.onerror = () => console.warn(`[Renderer] Failed to load image: ${src}`)
    el.src = src
  }

  constructor(ctx: CanvasRenderingContext2D, artboard: Artboard) {
    this.ctx = ctx
    this.artboard = artboard
    this.compositor = new LayerCompositor()
  }

  updateArtboard(artboard: Artboard) {
    this.artboard = artboard
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
    ctx: OffscreenCanvasRenderingContext2D,
    ab: ArtboardRect
  ) {
    for (const clip of layer.clips) {
      if (!this.isActive(clip, timeSeconds)) continue
      this.renderClip(clip, timeSeconds, sources, ctx, ab)
    }
  }

  private isActive(clip: ClipState, t: number): boolean {
    return isClipActive(clip, t)
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
      this.loadImage(bg.src)
      const img = this.imageCache.get(bg.src)
      if (img) ctx.drawImage(img, ab.x, ab.y, ab.width, ab.height)
    }
  }

  private renderClip(
    clip: ClipState,
    timeSeconds: number,
    sources: SourceManager,
    ctx: OffscreenCanvasRenderingContext2D,
    ab: ArtboardRect
  ) {
    const { transform } = clip
    const { x: px, y: py, width: pw, height: ph } = this.artboard.toCanvas(transform)

    ctx.save()
    ctx.globalAlpha = transform.opacity

    if (transform.rotation !== 0) {
      ctx.translate(px + pw / 2, py + ph / 2)
      ctx.rotate((transform.rotation * Math.PI) / 180)
      ctx.translate(-(px + pw / 2), -(py + ph / 2))
    }

    switch (clip.type) {
      case 'video': this.drawVideo(clip, px, py, pw, ph, sources, ctx); break
      case 'image': this.drawImage(clip, px, py, pw, ph, ctx); break
      case 'text':  this.drawText(clip, px, py, pw, ph, ctx); break
    }

    ctx.restore()
  }

private drawVideo(
    clip: ClipState,
    px: number, py: number, pw: number, ph: number,
    sources: SourceManager,
    ctx: OffscreenCanvasRenderingContext2D
  ) {
    const source = sources.getVideoSync(clip.src, clip.id)
    const canvas = source?.getCanvas()
    if (!canvas) {
      ctx.fillStyle = '#222'
      ctx.fillRect(px, py, pw, ph)
      return
    }

    const { flipX, flipY, fit } = clip.transform

    let dw: number, dh: number
    if (fit === 'fill') {
      dw = pw
      dh = ph
    } else if (fit === 'cover') {
      const scale = Math.max(pw / canvas.width, ph / canvas.height)
      dw = canvas.width * scale
      dh = canvas.height * scale
    } else {
      const scale = Math.min(pw / canvas.width, ph / canvas.height)
      dw = canvas.width * scale
      dh = canvas.height * scale
    }

    const ox = px + (pw - dw) / 2
    const oy = py + (ph - dh) / 2

    ctx.save()

    if (fit === 'cover') {
      ctx.beginPath()
      ctx.rect(px, py, pw, ph)
      ctx.clip()
    }

    this.applyRoundRect(ox, oy, dw, dh, clip.transform.borderRadius, ctx)

    if (flipX || flipY) {
      ctx.translate(px + pw / 2, py + ph / 2)
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
      ctx.translate(-(px + pw / 2), -(py + ph / 2))
    }

    ctx.drawImage(canvas, ox, oy, dw, dh)
    ctx.restore()
  }

  private drawImage(
    clip: ClipState,
    px: number, py: number, pw: number, ph: number,
    ctx: OffscreenCanvasRenderingContext2D
  ) {
    this.loadImage(clip.src)
    const img = this.imageCache.get(clip.src)
    if (!img) return
    const scale = Math.min(pw / img.width, ph / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    const ox = px + (pw - dw) / 2
    const oy = py + (ph - dh) / 2
    this.applyRoundRect(ox, oy, dw, dh, clip.transform.borderRadius, ctx)
    ctx.drawImage(img, ox, oy, dw, dh)
  }

  private drawText(
    clip: ClipState,
    px: number, py: number, pw: number, ph: number,
    ctx: OffscreenCanvasRenderingContext2D
  ) {
    ctx.fillStyle = '#fff'
    ctx.font = '16px sans-serif'
    ctx.fillStyle = '#fff'
    ctx.fillText(clip.content ?? '', px, py, pw)  // pw как maxWidth обрезает за границей
  }

  private applyRoundRect(
    x: number, y: number, w: number, h: number,
    radii: [number, number, number, number],
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
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

  clearImageCache() {
    this.imageCache.clear()
  }
}