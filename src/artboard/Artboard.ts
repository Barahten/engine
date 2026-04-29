import { CoordSystem, AspectRatio, NormalizedRect, CanvasRect } from './CoordSystem'
import type { Background } from '../state/types'

export type { AspectRatio, NormalizedRect, CanvasRect }

export class Artboard {
  private _aspectRatio: AspectRatio
  private _background: Background
  private _coords: CoordSystem
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement, aspectRatio: AspectRatio, background: Background) {
    this.canvas = canvas
    this._aspectRatio = aspectRatio
    this._background = background
    this._coords = new CoordSystem(aspectRatio, canvas.width, canvas.height)
  }

  update(aspectRatio: AspectRatio, background: Background) {
    this._aspectRatio = aspectRatio
    this._background = background
    this._coords = new CoordSystem(aspectRatio, this.canvas.width, this.canvas.height)
  }

  onCanvasResize() {
    this._coords = new CoordSystem(this._aspectRatio, this.canvas.width, this.canvas.height)
  }

  toCanvas(rect: NormalizedRect): CanvasRect {
    return this._coords.toCanvas(rect)
  }

  toNormalized(rect: CanvasRect): NormalizedRect {
    return this._coords.toNormalized(rect)
  }

  get coords(): CoordSystem {
    return this._coords
  }

  get aspectRatio(): AspectRatio {
    return this._aspectRatio
  }

  get background(): Background {
    return this._background
  }

  get artboardRect(): CanvasRect {
    return this._coords.artboardRect
  }
}