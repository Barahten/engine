export type AspectRatio = { w: number; h: number }

export type NormalizedRect = {
  x: number | null
  y: number | null
  width: number
  height: number
}

export type ArtboardRect = {
  x: number
  y: number
  width: number
  height: number
}

export class CoordSystem {
  private artboardWidth: number
  private artboardHeight: number
  private canvasWidth: number
  private canvasHeight: number
  private scaleX: number
  private scaleY: number
  private offsetX: number
  private offsetY: number

  constructor(aspectRatio: AspectRatio, canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
    this.artboardWidth = 1
    this.artboardHeight = aspectRatio.h / aspectRatio.w

    const scaleByWidth = canvasWidth
    const scaleByHeight = canvasHeight / this.artboardHeight

    const scale = Math.min(scaleByWidth, scaleByHeight)
    const renderedW = this.artboardWidth * scale
    const renderedH = this.artboardHeight * scale

    this.scaleX = renderedW
    this.scaleY = renderedH
    this.offsetX = (canvasWidth - renderedW) / 2
    this.offsetY = (canvasHeight - renderedH) / 2
  }

  toCanvas(rect: NormalizedRect): ArtboardRect {
    const w = rect.width * this.scaleX
    const h = rect.height * this.scaleY
    const cx = rect.x ?? 0.5  // null → центр артборда
    const cy = rect.y ?? 0.5
    return {
      x: this.offsetX + cx * this.scaleX - w / 2,
      y: this.offsetY + cy * this.scaleY - h / 2,
      width: w,
      height: h,
    }
  }

  toNormalized(rect: ArtboardRect): NormalizedRect {
    return {
      x: (rect.x - this.offsetX + rect.width / 2) / this.scaleX,
      y: (rect.y - this.offsetY + rect.height / 2) / this.scaleY,
      width: rect.width / this.scaleX,
      height: rect.height / this.scaleY,
    }
  }

  get artboardRect(): ArtboardRect {
    return {
      x: this.offsetX,
      y: this.offsetY,
      width: this.scaleX,
      height: this.scaleY,
    }
  }

  get canvas() {
    return { width: this.canvasWidth, height: this.canvasHeight }
  }
}