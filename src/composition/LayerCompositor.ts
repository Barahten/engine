export class LayerCompositor {
  private offscreens = new Map<string, OffscreenCanvas>()

  getOrCreate(layerId: string, width: number, height: number): OffscreenCanvas {
    const existing = this.offscreens.get(layerId)
    if (existing && existing.width === width && existing.height === height) {
      return existing
    }
    const canvas = new OffscreenCanvas(width, height)
    this.offscreens.set(layerId, canvas)
    return canvas
  }

  clear(layerId: string) {
    const canvas = this.offscreens.get(layerId)
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  clearAll() {
    for (const [id] of this.offscreens) {
      this.clear(id)
    }
  }

  composite(target: CanvasRenderingContext2D, layerIds: string[]) {
    for (const id of layerIds) {
      const canvas = this.offscreens.get(id)
      if (!canvas) continue
      target.drawImage(canvas, 0, 0)
    }
  }

  pruneStale(activeIds: Set<string>) {
    for (const id of this.offscreens.keys()) {
      if (!activeIds.has(id)) this.offscreens.delete(id)
    }
  }
}