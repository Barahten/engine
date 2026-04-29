export { Composition } from './composition/Composition'

export type {
  CompositionState,
  LayerState,
  ClipState,
  ClipType,
  Transform,
  AudioState,
  AspectRatio,
  Background,
  BackgroundSolid,
  BackgroundGradient,
  BackgroundImage,
} from './state/types'

export { validateCompositionState, validateClip, validateTransform, validateAspectRatio } from './state/validators'
export type { ValidationError } from './state/validators'

export type { NormalizedRect, CanvasRect } from './artboard/CoordSystem'
export type { ClipLifecycleState } from './clip/ClipLifecycle'