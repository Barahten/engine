import { Composition } from './composition/Composition'
import type { CompositionState, ClipState } from './state/types'

const VIDEO_URL = 'http://localhost:8000/storage/v1/object/public/media/84819847-a018-44a6-bf4d-9d39892d3aeb/19ff0b7f-d58a-4dd2-a3b9-5fa5a01e0dbc/cesdk-2026-01-11T14_09_35.550Z.mp4'
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const container = canvas.parentElement!
 
const clip: ClipState = {
  id: 'clip-1',
  type: 'video',
  src: VIDEO_URL,
  offset: 0,
  transform: { x: null, y: null, width: 1, height: 1, rotation: 0, opacity: 1, borderRadius: [0, 0, 0, 0] },
  audio: { muted: false, volume: 1, fade: { in: 0, out: 0 } }
}
 
let state: CompositionState = {
  aspectRatio: { w: 16, h: 9 },
  fps: 30,
  background: { type: 'solid', color: '#1a1a2e' },
  layers: [{ id: 'layer-1', clips: [clip] }]
}
 
const ro = new ResizeObserver(entries => {
  const { width } = entries[0].contentRect
  canvas.width = width
  canvas.height = width * (state.aspectRatio.h / state.aspectRatio.w)
  comp.setState(state)
})
ro.observe(container)
 
const comp = new Composition(canvas, state)
comp.onEnd = () => comp.seek(0)
comp.onTimeUpdate = (t) => console.log('time:', t.toFixed(2))
 
await comp.preloadClip(clip)
comp.setState(state)
 
function update(patch: Partial<CompositionState>) {
  state = { ...state, ...patch }
  const { width } = container.getBoundingClientRect()
  canvas.width = width
  canvas.height = width * (state.aspectRatio.h / state.aspectRatio.w)
  comp.setState(state)
}
 
document.getElementById('btn-play')!.onclick = () => comp.play()
document.getElementById('btn-pause')!.onclick = () => comp.pause()
document.getElementById('btn-seek')!.onclick = () => comp.seek(5)
document.getElementById('btn-scrub')!.onclick = () => comp.scrub(3)
document.getElementById('btn-169')!.onclick = () => update({ aspectRatio: { w: 16, h: 9 } })
document.getElementById('btn-916')!.onclick = () => update({ aspectRatio: { w: 9, h: 16 } })
document.getElementById('btn-solid')!.onclick = () => update({ background: { type: 'solid', color: '#1565c0' } })
document.getElementById('btn-gradient')!.onclick = () => update({
  background: {
    type: 'gradient', angle: 135,
    stops: [{ color: '#f953c6', position: 0 }, { color: '#b91d73', position: 1 }]
  }
})
document.getElementById('btn-mute')!.onclick = () =>
  comp.setClipAudio(VIDEO_URL, { ...clip.audio, muted: true })
document.getElementById('btn-unmute')!.onclick = () =>
  comp.setClipAudio(VIDEO_URL, { ...clip.audio, muted: false })