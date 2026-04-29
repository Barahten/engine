export type AspectRatio = { w: number; h: number }

export type ClipType = 'video' | 'audio' | 'image' | 'text'

export type Transform = {
  x: number | null
  y: number | null
  width: number
  height: number
  rotation: number
  opacity: number
  borderRadius: [number, number, number, number]
}

export type AudioState = {
  muted: boolean
  volume: number
  fade: { in: number; out: number }
}

export type ClipState = {
  id: string
  type: ClipType
  src: string
  offset: number
  duration?: number
  range?: { start: number; end: number }
  transform: Transform
  audio: AudioState
}

export type LayerState = {
  id: string
  clips: ClipState[]
}

export type BackgroundSolid = { type: 'solid'; color: string }
export type BackgroundGradient = { type: 'gradient'; stops: { color: string; position: number }[]; angle: number }
export type BackgroundImage = { type: 'image'; src: string }
export type Background = BackgroundSolid | BackgroundGradient | BackgroundImage

export type CompositionState = {
  aspectRatio: AspectRatio
  fps: number
  background: Background
  layers: LayerState[]
}