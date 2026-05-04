import { Composition } from './composition/Composition'
import type { CompositionState, AudioState, Transform, ClipInput, CompositionInput } from './state/types'

const VIDEO_URL_1 = 'http://localhost:8000/storage/v1/object/public/media/84819847-a018-44a6-bf4d-9d39892d3aeb/19ff0b7f-d58a-4dd2-a3b9-5fa5a01e0dbc/266031893_134042295681049_7804354067868527199_n.mp4'
const VIDEO_URL_2 = 'http://localhost:8000/storage/v1/object/public/media/84819847-a018-44a6-bf4d-9d39892d3aeb/19ff0b7f-d58a-4dd2-a3b9-5fa5a01e0dbc/cart.mp4'
const VIDEO_URL_3 = 'http://localhost:8000/storage/v1/object/public/media/84819847-a018-44a6-bf4d-9d39892d3aeb/19ff0b7f-d58a-4dd2-a3b9-5fa5a01e0dbc/Favourite%20number.mp4'
const VIDEO_URL_4 = 'http://localhost:8000/storage/v1/object/public/media/84819847-a018-44a6-bf4d-9d39892d3aeb/59b57f5b-4cab-4102-b82a-817390977388/audio.mp4'
const VIDEO_URL_5 = 'http://localhost:8000/storage/v1/object/public/media/84819847-a018-44a6-bf4d-9d39892d3aeb/59b57f5b-4cab-4102-b82a-817390977388/poster.jpg'
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const container = canvas.parentElement!
 
const clip_1: ClipInput  = {
  id: 'clip-1',
  type: 'video',
  src: VIDEO_URL_1,
  offset: 0,
  duration: 11.19,
  playbackRate: 1.5,
  transform: { x: null, y: null, width: .5, height: .5, rotation: 0, opacity: 1, borderRadius: [0, 0, 0, 0] },
  audio: { muted: false, volume: 1, fade: { in: 0, out: 2 } },
  animation: {
    out: { type: 'drop' },
    in: { type: 'wipe', direction: 'bottom' }
  }
}
const clip_2: ClipInput  = {
  id: 'clip-2',
  type: 'video',
  src: VIDEO_URL_2,
  offset: 0,
  duration: 4.32,
  transform: { x: .25, y: .25, width: 0.5, height: 0.5, rotation: 0, opacity: 1, borderRadius: [0, 0, 0, 0] },
  audio: { muted: false, volume: 1, fade: { in: 0, out: 0 } },
  animation: {
    out: { type: 'drop' }
  }
}
const clip_3: ClipInput  = {
  id: 'clip-3',
  type: 'video',
  src: VIDEO_URL_3,
  offset: 20.19,
  duration: 19.08,
  transform: { x: null, y: null, width: 1, height: 1 },
  audio: { muted: false, volume: 1, fade: { in: 2, out: 0 } }
}
const clip_4: ClipInput = {
  id: 'clip-4',
  type: 'audio',
  src: VIDEO_URL_4,
  offset: 0,
  duration: 17.70,
  transform: { x: null, y: null, width: 1, height: 1, rotation: 0, opacity: 1, borderRadius: [0, 0, 0, 0] },
  audio: { muted: false, volume: 1, fade: { in: 0, out: 0 } }
}
const clip_5: ClipInput = {
  id: 'clip-5',
  type: 'image',
  src: VIDEO_URL_5,
  offset: 4,
  duration: 5,
  transform: { x: 0.5, y: 0.5, width: 0.8, height: 0.2 },
  animation: {
    out: { type: 'drop' },
    in: { type: 'wipe', direction: 'left'}
  }
  //audio: { muted: false, volume: 1, fade: { in: 0, out: 0 } }
}
const clip_text: ClipInput = {
  id: 'text-1',
  type: 'text',
  src: '',
  offset: 0,
  duration: 5,
  transform: { x: 0.4, y: 0.1, width: 0.8, height: 0.2 },
  lines: [
    {
      content: 'Montserrat',
      style: {
        fontFamily: 'Kablammo',
        fontSize: 0.06,
        fontWeight: 400,
        fontStyle: 'normal',
        color: '#ffffff',
        align: 'left',
        background: '#7c3aed',
      },
      animation: {
        in: { type: 'block', duration: 0.6 }
      },
    },
    {
      content: 'ART DIRECTOR',
      style: {
        fontFamily: 'Arial',
        fontSize: 0.04,
        fontWeight: 400,
        fontStyle: 'normal',
        color: '#ffffff',
        align: 'left',
        background: '#000000',
        marginTop: 0.02,
        opacity: .05,
      }
    }
  ]
}

const clips = [clip_1, clip_3, clip_2, clip_5, clip_text]
 
let state: CompositionInput  = {
  aspectRatio: { w: 16, h: 9 },
  fps: 30,
  background: { type: 'solid', color: '#000' },
  layers: [{ id: 'layer-1', clips: clips }]
}
 
const ro = new ResizeObserver(entries => {
  const { width } = entries[0].contentRect
  canvas.width = width
  canvas.height = width * (state.aspectRatio.h / state.aspectRatio.w)
  comp.onResize()
})
ro.observe(container)
 
const comp = new Composition(canvas, state)
comp.onEnd = () => comp.seek(0)
comp.onTimeUpdate = (t) => console.log('time:', t.toFixed(2))
 
const preloaded = await comp.preloadAll(clips)
await comp.setState(state)
function update(patch: Partial<CompositionState>) {
  state = { ...state, ...patch }
  const { width } = container.getBoundingClientRect()
  canvas.width = width
  canvas.height = width * (state.aspectRatio.h / state.aspectRatio.w)
  comp.setState(state)
}

function updateClipAudio(clipId: string, audio: Partial<AudioState>) {
  const clips = state.layers[0].clips.map(c =>
    c.id === clipId ? { ...c, audio: { ...c.audio, ...audio } } : c
  )
  state = { ...state, layers: [{ ...state.layers[0], clips }] }
  comp.setState(state)
  const clip = clips.find(c => c.id === clipId)!
  comp.setClipAudio(clipId, { muted: false, volume: 1, fade: { in: 0, out: 0 }, ...clip.audio })
}

function updateClipTransform(clipId: string, transform: Partial<Transform>) {
  const clips = state.layers[0].clips.map(c =>
    c.id === clipId ? { ...c, transform: { ...c.transform, ...transform } } : c
  )
  state = { ...state, layers: [{ ...state.layers[0], clips }] }
  comp.setState(state)
}
 
document.getElementById('btn-play')!.onclick = () => comp.play()
document.getElementById('btn-pause')!.onclick = () => comp.pause()
document.getElementById('btn-seek')!.onclick = () => comp.seek(20)
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
function getClip(clipId: string) {
  return state.layers[0].clips.find(c => c.id === clipId)!
}

document.getElementById('btn-mute')!.onclick = () =>
  updateClipAudio('clip-1', { ...clip_1.audio, muted: true })
document.getElementById('btn-unmute')!.onclick = () =>
  updateClipAudio('clip-1', { ...clip_1.audio, muted: false })

document.getElementById('btn-flip-x')!.onclick = () => {
  const clip = getClip('clip-1')
  updateClipTransform('clip-1', { flipX: !(clip.transform?.flipX ?? false) })
}

document.getElementById('btn-flip-y')!.onclick = () => {
  const clip = getClip('clip-1')
  updateClipTransform('clip-1', { flipY: !(clip.transform?.flipY ?? false) })
}



document.getElementById('btn-fit-contain')!.onclick = () =>
  updateClipTransform('clip-1', { x: 0.5, y: 0.5, width: 1, height: 1, fit: 'contain' })

document.getElementById('btn-fit-cover')!.onclick = () =>
  updateClipTransform('clip-1', { x: 0.5, y: 0.5, width: 1, height: 1, fit: 'cover' })

document.getElementById('btn-fit-fill')!.onclick = () =>
  updateClipTransform('clip-1', { x: 0.5, y: 0.5, width: 1, height: 1, fit: 'fill' })



const progressBar = document.getElementById('progress-bar')!
const timeCurrent = document.getElementById('time-current')!
const timeTotal = document.getElementById('time-total')!
const progressContainer = document.getElementById('progress-container')!

const totalDuration = Math.max(...preloaded.map(c => {
  const offset = c.offset ?? 0
  const rate = c.playbackRate ?? 1
  const start = c.range?.start ?? 0
  const end = c.range?.end ?? c.duration ?? 0
  return offset + (end - start) / rate
}))


function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

timeTotal.textContent = formatTime(totalDuration)

comp.onTimeUpdate = (t) => {
  const pct = Math.min(100, (t / totalDuration) * 100)
  progressBar.style.width = `${pct}%`
  timeCurrent.textContent = formatTime(t)
}

progressContainer.addEventListener('click', (e) => {
  const rect = progressContainer.getBoundingClientRect()
  const pct = (e.clientX - rect.left) / rect.width
  comp.seek(pct * totalDuration)
})
