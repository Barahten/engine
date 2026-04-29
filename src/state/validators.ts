import type { CompositionState, ClipState, AspectRatio, Transform } from './types'

export type ValidationError = { field: string; message: string }

export function validateAspectRatio(ar: AspectRatio): ValidationError | null {
  if (ar.w <= 0 || ar.h <= 0) {
    return { field: 'aspectRatio', message: `Invalid aspect ratio: ${ar.w}/${ar.h}` }
  }
  return null
}

export function validateTransform(t: Transform): ValidationError[] {
  const errors: ValidationError[] = []
  if (t.x !== null && (t.x < 0 || t.x > 1)) {
    errors.push({ field: 'transform.x', message: `x must be 0..1, got ${t.x}` })
  }
  if (t.y !== null && (t.y < 0 || t.y > 1)) {
    errors.push({ field: 'transform.y', message: `y must be 0..1, got ${t.y}` })
  }
  if (t.width <= 0 || t.width > 4) {
    errors.push({ field: 'transform.width', message: `width must be > 0, got ${t.width}` })
  }
  if (t.height <= 0 || t.height > 4) {
    errors.push({ field: 'transform.height', message: `height must be > 0, got ${t.height}` })
  }
  if (t.opacity < 0 || t.opacity > 1) {
    errors.push({ field: 'transform.opacity', message: `opacity must be 0..1, got ${t.opacity}` })
  }
  if (t.borderRadius.some(r => r < 0 || r > 1)) {
    errors.push({ field: 'transform.borderRadius', message: 'borderRadius values must be 0..1' })
  }
  return errors
}

export function validateClip(clip: ClipState): ValidationError[] {
  const errors: ValidationError[] = []
  if (clip.offset < 0) {
    errors.push({ field: 'clip.offset', message: `offset must be >= 0, got ${clip.offset}` })
  }
  if (clip.duration !== undefined && clip.duration <= 0) {
    errors.push({ field: 'clip.duration', message: `duration must be > 0, got ${clip.duration}` })
  }
  if (clip.range && clip.range.end <= clip.range.start) {
    errors.push({ field: 'clip.range', message: `range.end must be > range.start` })
  }
  if (!clip.src) {
    errors.push({ field: 'clip.src', message: 'src is required' })
  }
  errors.push(...validateTransform(clip.transform))
  return errors
}

export function validateCompositionState(state: CompositionState): ValidationError[] {
  const errors: ValidationError[] = []
  const arError = validateAspectRatio(state.aspectRatio)
  if (arError) errors.push(arError)
  if (state.fps <= 0) {
    errors.push({ field: 'fps', message: `fps must be > 0, got ${state.fps}` })
  }
  for (const layer of state.layers) {
    for (const clip of layer.clips) {
      errors.push(...validateClip(clip))
    }
  }
  return errors
}