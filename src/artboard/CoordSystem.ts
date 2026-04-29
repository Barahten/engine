export type AspectRatio = { w: number; h: number }

export type NormalizedRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CanvasRect = {
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

  toCanvas(rect: NormalizedRect): CanvasRect {
    return {
      x: this.offsetX + rect.x * this.scaleX,
      y: this.offsetY + rect.y * this.scaleY,
      width: rect.width * this.scaleX,
      height: rect.height * this.scaleY,
    }
  }

  toNormalized(rect: CanvasRect): NormalizedRect {
    return {
      x: (rect.x - this.offsetX) / this.scaleX,
      y: (rect.y - this.offsetY) / this.scaleY,
      width: rect.width / this.scaleX,
      height: rect.height / this.scaleY,
    }
  }

  get artboardRect(): CanvasRect {
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