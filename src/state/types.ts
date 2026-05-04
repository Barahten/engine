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

export type TextShadow = {
  color: string
  blur: number
  offsetX: number
  offsetY: number
}

export type TextStroke = {
  color: string
  width: number
}

export type TextStyle = {
  fontFamily: string
  fontSize: number          // нормализованный 0..1 относительно высоты artboard
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  color: string
  align: 'left' | 'center' | 'right'
  background?: string
  letterSpacing?: number
  lineHeight?: number
  shadow?: TextShadow
  stroke?: TextStroke
  opacity?: number
  rotation?: number
  marginTop?: number
}

export type TextLine = {
  content: string
  style: TextStyle
  animation?: TextAnimation
}

export type ClipState = {
  id: string
  type: ClipType
  src: string
  offset: number
  duration: number
  range?: { start: number; end: number }
  playbackRate?: number
  transform: Transform
  audio: AudioState
  lines?: TextLine[]
  animation?: Animation
}

export type LayerState = {
  id: string
  clips: ClipState[]
}

export type BackgroundSolid = { type: 'solid'; color: string }
export type BackgroundGradient = { type: 'gradient'; stops: { color: string; position: number }[]; angle: number }
export type BackgroundImage = { type: 'image'; src: string }
export type Background = BackgroundSolid | BackgroundGradient | BackgroundImage


export type AnimationDirection = 'left' | 'right' | 'top' | 'bottom'
export type SpinDirection = 'left' | 'right'

export type ClipAnimationInType = 'fade' | 'float' | 'zoom_in' | 'ken_burns' | 'drop' | 'slide' | 'wipe' | 'pop' | 'bounce' | 'spin' | 'slide_bounce' | 'gentle_float'
export type ClipAnimationOutType = 'fade' | 'float' | 'zoom_out' | 'drop' | 'slide' | 'wipe' | 'pop' | 'bounce' | 'spin' | 'slide_bounce' | 'gentle_float'
export type TextAnimationInType = 'fade' | 'slide' | 'block' | 'typewriter' | 'rise' | 'pop' | 'drop' | 'compress' | 'bounce' | 'wave' | 'fall' | 'skid' | 'flipboard' | 'scale' | 'dragonfly' | 'billboard' | 'roll'
export type TextAnimationOutType = 'fade' | 'slide' | 'block' | 'typewriter' | 'rise' | 'pop' | 'drop' | 'compress' | 'bounce' | 'wave' | 'fall' | 'skid' | 'flipboard' | 'scale' | 'dragonfly' | 'billboard' | 'roll'

export type AnimationIn = {
  type: ClipAnimationInType
  duration?: number
  direction?: AnimationDirection | SpinDirection
}

export type AnimationOut = {
  type: ClipAnimationOutType
  duration?: number
  direction?: AnimationDirection | SpinDirection
}

export type Animation = {
  in?: AnimationIn
  out?: AnimationOut
}

export type TextAnimationIn = {
  type: TextAnimationInType
  duration?: number
}

export type TextAnimationOut = {
  type: TextAnimationOutType
  duration?: number
}

export type TextAnimation = {
  in?: TextAnimationIn
  out?: TextAnimationOut
}

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
  playbackRate?: number
  transform?: Partial<Transform>
  audio?: Partial<AudioState>
  lines?: TextLine[]
  animation?: Animation
}

export type LayerInput = {
  id: string
  clips: ClipInput[]
}

export type FontDef = {
  family: string
  weight?: number
  style?: 'normal' | 'italic'
}

export type CompositionInput = Omit<CompositionState, 'layers'> & {
  layers: LayerInput[]
}