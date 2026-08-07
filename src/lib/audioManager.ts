import keyAwakeningUrl from '../../assets/audio/key-awakening.mp3'
import resonanceUpUrl from '../../assets/audio/resonance-up.mp3'
import stampDuplicateUrl from '../../assets/audio/stamp-duplicate.mp3'
import answerWrongUrl from '../../assets/audio/answer-wrong.mp3'
import ambienceUrl from '../../assets/audio/shuxin-ambience.mp3'
import revealMusicUrl from '../../assets/audio/shuxin-reveal.mp3'

export type AudioEvent = 'keyAwakening' | 'resonanceUp' | 'stampDuplicate' | 'answerWrong'

export interface AudioSettings { enabled: boolean; volume: number }
export interface MusicSettings { enabled: boolean }

export const AUDIO_SETTINGS_STORAGE_KEY = 'shuxin-audio-settings-v1'
export const MUSIC_SETTINGS_STORAGE_KEY = 'shuxin-music-settings-v1'
export const DEFAULT_AUDIO_VOLUME = 0.48
export const DEFAULT_MUSIC_VOLUME = 0.08
export const AMBIENCE_PATH = ambienceUrl

export const AUDIO_PATHS: Record<AudioEvent, string> = {
  keyAwakening: keyAwakeningUrl,
  resonanceUp: resonanceUpUrl,
  stampDuplicate: stampDuplicateUrl,
  answerWrong: answerWrongUrl,
}

const defaults: AudioSettings = { enabled: true, volume: DEFAULT_AUDIO_VOLUME }
const musicDefaults: MusicSettings = { enabled: true }

class AudioManager {
  private settings = this.loadSettings()
  private sounds = new Map<AudioEvent, HTMLAudioElement>()
  private active: HTMLAudioElement | null = null
  private ambience: HTMLAudioElement | null = null
  private revealMusic: HTMLAudioElement | null = null
  private unlocked = false
  private musicSettings = this.loadMusicSettings()
  private musicFadeFrame: number | null = null
  private revealFadeFrame: number | null = null
  private playbackToken = 0

  constructor() {
    if (typeof Audio === 'undefined') return
    for (const [event, path] of Object.entries(AUDIO_PATHS) as [AudioEvent, string][]) {
      const sound = new Audio(path)
      sound.preload = 'auto'
      sound.volume = this.settings.volume
      sound.addEventListener('error', () => console.warn(`[SHUXIN audio] Unable to load ${path}`))
      this.sounds.set(event, sound)
    }
    this.ambience = new Audio(AMBIENCE_PATH)
    this.ambience.preload = 'auto'
    this.ambience.loop = true
    this.ambience.volume = DEFAULT_MUSIC_VOLUME
    this.ambience.addEventListener('error', () => console.warn(`[SHUXIN audio] Unable to load ${AMBIENCE_PATH}`))
    this.revealMusic = new Audio(revealMusicUrl)
    this.revealMusic.preload = 'auto'
    this.revealMusic.volume = 0
    this.revealMusic.addEventListener('error', () => console.warn(`[SHUXIN audio] Unable to load ${revealMusicUrl}`))
  }

  private loadSettings(): AudioSettings {
    if (typeof localStorage === 'undefined') return defaults
    try {
      const value = JSON.parse(localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY) ?? '') as Partial<AudioSettings>
      return {
        enabled: typeof value.enabled === 'boolean' ? value.enabled : defaults.enabled,
        volume: typeof value.volume === 'number' ? Math.min(1, Math.max(0, value.volume)) : defaults.volume,
      }
    } catch { return defaults }
  }

  private saveSettings() {
    try { localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(this.settings)) } catch { /* storage unavailable */ }
  }

  private loadMusicSettings(): MusicSettings {
    if (typeof localStorage === 'undefined') return musicDefaults
    try {
      const value = JSON.parse(localStorage.getItem(MUSIC_SETTINGS_STORAGE_KEY) ?? '') as Partial<MusicSettings>
      return { enabled: typeof value.enabled === 'boolean' ? value.enabled : musicDefaults.enabled }
    } catch { return musicDefaults }
  }

  private saveMusicSettings() {
    try { localStorage.setItem(MUSIC_SETTINGS_STORAGE_KEY, JSON.stringify(this.musicSettings)) } catch { /* storage unavailable */ }
  }

  private fadeMusicTo(target: number, duration: number) {
    const music = this.ambience
    if (!music) return
    if (this.musicFadeFrame !== null) cancelAnimationFrame(this.musicFadeFrame)
    const from = music.volume
    const startedAt = performance.now()
    const step = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - startedAt) / Math.max(1, duration)))
      music.volume = Math.max(0, Math.min(1, from + (target - from) * progress))
      if (progress < 1) this.musicFadeFrame = requestAnimationFrame(step)
      else this.musicFadeFrame = null
    }
    this.musicFadeFrame = requestAnimationFrame(step)
  }

  private startMusic() {
    if (!this.unlocked || !this.musicSettings.enabled || !this.ambience || !this.ambience.paused) return
    this.ambience.volume = 0
    void this.ambience.play().then(() => this.fadeMusicTo(DEFAULT_MUSIC_VOLUME, 800)).catch((error) => {
      console.warn(`[SHUXIN audio] Playback failed for ${AMBIENCE_PATH}`, error)
    })
  }

  private fadeRevealTo(target: number, duration: number) {
    const music = this.revealMusic
    if (!music) return
    if (this.revealFadeFrame !== null) cancelAnimationFrame(this.revealFadeFrame)
    const from = music.volume
    const startedAt = performance.now()
    const step = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - startedAt) / Math.max(1, duration)))
      music.volume = Math.max(0, Math.min(1, from + (target - from) * progress))
      if (progress < 1) this.revealFadeFrame = requestAnimationFrame(step)
      else this.revealFadeFrame = null
    }
    this.revealFadeFrame = requestAnimationFrame(step)
  }

  unlock() { this.unlocked = true; this.startMusic() }
  getSettings(): AudioSettings { return { ...this.settings } }
  getMusicSettings(): MusicSettings { return { ...this.musicSettings } }

  setMusicEnabled(enabled: boolean) {
    this.musicSettings.enabled = enabled
    this.saveMusicSettings()
    if (enabled) this.startMusic()
    else if (this.ambience) {
      this.fadeMusicTo(0, 300)
      this.fadeRevealTo(0, 300)
      window.setTimeout(() => { if (this.ambience && !this.musicSettings.enabled) this.ambience.pause() }, 320)
      window.setTimeout(() => { if (this.revealMusic && !this.musicSettings.enabled) this.revealMusic.pause() }, 320)
    }
  }

  startRevealMusic() {
    this.fadeMusicTo(0.015, 800)
    if (!this.unlocked || !this.musicSettings.enabled || !this.revealMusic) return
    this.revealMusic.pause()
    this.revealMusic.currentTime = 0
    this.revealMusic.volume = 0
    void this.revealMusic.play().then(() => this.fadeRevealTo(0.2, 1500)).catch((error) => {
      console.warn(`[SHUXIN audio] Playback failed for ${revealMusicUrl}`, error)
    })
  }

  finishRevealMusic() {
    const music = this.revealMusic
    if (!music) return
    this.fadeRevealTo(0, 2000)
    window.setTimeout(() => {
      if (!this.revealMusic || this.revealMusic.volume > 0.001) return
      this.revealMusic.pause()
      this.revealMusic.currentTime = 0
    }, 2050)
  }

  beginAnswerCheck() {
    if (this.musicSettings.enabled) this.fadeMusicTo(0.04, 180)
  }

  restoreMusic() {
    if (this.musicSettings.enabled) this.fadeMusicTo(DEFAULT_MUSIC_VOLUME, 800)
  }

  setEnabled(enabled: boolean) {
    this.settings.enabled = enabled
    if (!enabled) this.stop()
    this.saveSettings()
  }

  setVolume(volume: number) {
    this.settings.volume = Math.min(1, Math.max(0, volume))
    this.sounds.forEach((sound) => { sound.volume = this.settings.volume })
    this.saveSettings()
  }

  stop() {
    this.playbackToken += 1
    if (!this.active) return
    this.active.onended = null
    this.active.pause()
    this.active.currentTime = 0
    this.active = null
  }

  play(event: AudioEvent, volumeScale = 1) {
    this.fadeMusicTo(0.01, 300)
    if (!this.unlocked || !this.settings.enabled) { this.restoreMusic(); return }
    this.stop()
    const sound = this.sounds.get(event)
    if (!sound) return
    sound.volume = Math.min(1, this.settings.volume * Math.max(0, volumeScale))
    sound.currentTime = 0
    this.active = sound
    const token = ++this.playbackToken
    sound.onended = () => {
      if (token !== this.playbackToken) return
      this.active = null
      this.restoreMusic()
    }
    void sound.play().catch((error) => {
      if (token === this.playbackToken && this.active === sound) this.active = null
      this.restoreMusic()
      console.warn(`[SHUXIN audio] Playback failed for ${AUDIO_PATHS[event]}`, error)
    })
  }
}

export const audioManager = new AudioManager()
