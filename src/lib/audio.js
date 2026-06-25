export const SOUND_SOURCES = {
  tap: {
    src: '/sounds/keyboard/tap.mp3',
    gain: 2.45,
    rate: 1,
  },
  ok: {
    src: '/sounds/ui/correct.wav',
    gain: 1.35,
  },
  error: {
    src: '/sounds/ui/error.wav',
    gain: 1.7,
  },
}

export function createAudioEngine() {
  return {
    context: null,
    buffers: {},
    pending: {},
  }
}

function loadSoundBuffer(context, source) {
  return fetch(source)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load audio: ${source}`)
      }

      return response.arrayBuffer()
    })
    .then((buffer) => context.decodeAudioData(buffer))
}

export function preloadSoundBuffer(engine, context, sound) {
  if (engine.buffers[sound.src]) {
    return Promise.resolve(engine.buffers[sound.src])
  }

  if (!engine.pending[sound.src]) {
    engine.pending[sound.src] = loadSoundBuffer(context, sound.src)
      .then((buffer) => {
        engine.buffers[sound.src] = buffer
        return buffer
      })
      .finally(() => {
        delete engine.pending[sound.src]
      })
  }

  return engine.pending[sound.src]
}
