export type AspectRatio = { w: number; h: number }

export type ClipType = 'video' | 'audio' | 'image' | 'text'

export type Fit = 'contain' | 'cover' | 'fill'

export type Transform = {
  x: number | null
  y: number | null
  width: number
  height: number
  rotation: number
  opacity: number
  borderRadius: [number, number, number, number]
  flipX: boolean
  flipY: boolean
  fit: Fit
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
  duration: number
  range?: { start: number; end: number }
  transform: Transform
  audio: AudioState
  content?: string
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

export type TransformInput = Partial<Transform> & {
  x: number | null
  y: number | null
  width: number
  height: number
}

export type ClipInput = {
  id: string
  type: ClipType
  src: string
  offset?: number
  duration?: number
  range?: { start: number; end: number }
  transform?: Partial<Transform>
  audio?: Partial<AudioState>
  content?: string
}

export type LayerInput = {
  id: string
  clips: ClipInput[]
}

export type CompositionInput = Omit<CompositionState, 'layers'> & {
  layers: LayerInput[]
}