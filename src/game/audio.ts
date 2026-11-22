export type SoundEffect =
  | "spin"
  | "card"
  | "done"
  | "skip"
  | "tick"
  | "tickFinal"
  | "expire"
  | "reveal";

const MUTE_KEY = "rolit-v2-muted";
const MIN_GAIN = 0.0001;

type AudioContextWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

let context: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMutedPreference();
const lastPlayedAt = new Map<SoundEffect, number>();

function readMutedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isSoundMuted(): boolean {
  return muted;
}

export function setSoundMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // يبقى الاختيار فعالاً لهذه الجلسة حتى لو منع المتصفح التخزين المحلي.
  }
  if (context && master) {
    master.gain.setValueAtTime(value ? 0 : 0.55, context.currentTime);
  }
}

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context?.state === "closed") {
    context = null;
    master = null;
  }
  if (context) return context;

  const Context = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
  if (!Context) return null;
  try {
    context = new Context();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(context.destination);
    return context;
  } catch {
    context = null;
    master = null;
    return null;
  }
}

/** يستدعى من تفاعل مباشر حتى يسمح المتصفح بتشغيل الصوت. */
export async function unlockAudio(): Promise<boolean> {
  if (muted) return false;
  const audio = ensureContext();
  if (!audio) return false;
  try {
    if (audio.state === "suspended") await audio.resume();
    return audio.state === "running";
  } catch {
    return false;
  }
}

/** للأحداث القادمة من الخادم أو المؤقت؛ لا ينشئ صوتاً قبل أول تفاعل. */
export function playSound(effect: SoundEffect) {
  if (muted || !context || !master || context.state !== "running") return;
  const now = performance.now();
  const previous = lastPlayedAt.get(effect) ?? -Infinity;
  const cooldown = effect === "card" || effect === "reveal" ? 700 : 80;
  if (now - previous < cooldown) return;
  lastPlayedAt.set(effect, now);
  scheduleEffect(effect, context, master);
}

/** للأزرار التي يضغطها اللاعب مباشرة. */
export async function playSoundFromGesture(effect: SoundEffect) {
  if (await unlockAudio()) playSound(effect);
}

function tone(
  audio: AudioContext,
  output: GainNode,
  frequency: number,
  delay: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  const start = audio.currentTime + delay;
  const end = start + duration;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  envelope.gain.setValueAtTime(MIN_GAIN, start);
  envelope.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.018, duration / 3));
  envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, end);
  oscillator.connect(envelope);
  envelope.connect(output);
  oscillator.start(start);
  oscillator.stop(end + 0.025);
}

function glide(
  audio: AudioContext,
  output: GainNode,
  from: number,
  to: number,
  delay: number,
  duration: number,
  volume: number,
) {
  const start = audio.currentTime + delay;
  const end = start + duration;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, end);
  envelope.gain.setValueAtTime(MIN_GAIN, start);
  envelope.gain.exponentialRampToValueAtTime(volume, start + 0.025);
  envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, end);
  oscillator.connect(envelope);
  envelope.connect(output);
  oscillator.start(start);
  oscillator.stop(end + 0.025);
}

function scheduleEffect(effect: SoundEffect, audio: AudioContext, output: GainNode) {
  switch (effect) {
    case "spin":
      glide(audio, output, 170, 520, 0, 0.48, 0.035);
      for (let index = 0; index < 8; index += 1) {
        tone(audio, output, 260 + index * 32, index * 0.058, 0.055, 0.045, "triangle");
      }
      tone(audio, output, 620, 0.48, 0.18, 0.06, "triangle");
      break;
    case "card":
      tone(audio, output, 523.25, 0, 0.24, 0.07);
      tone(audio, output, 659.25, 0.08, 0.26, 0.065);
      tone(audio, output, 783.99, 0.17, 0.34, 0.06);
      break;
    case "done":
      tone(audio, output, 523.25, 0, 0.26, 0.065, "triangle");
      tone(audio, output, 659.25, 0.07, 0.28, 0.06, "triangle");
      tone(audio, output, 783.99, 0.14, 0.32, 0.06, "triangle");
      tone(audio, output, 1046.5, 0.24, 0.36, 0.05);
      break;
    case "skip":
      glide(audio, output, 280, 150, 0, 0.28, 0.065);
      tone(audio, output, 180, 0.15, 0.2, 0.035, "triangle");
      break;
    case "tick":
      tone(audio, output, 760, 0, 0.055, 0.04, "sine");
      break;
    case "tickFinal":
      tone(audio, output, 980, 0, 0.07, 0.065, "triangle");
      break;
    case "expire":
      tone(audio, output, 330, 0, 0.18, 0.065, "triangle");
      tone(audio, output, 220, 0.15, 0.34, 0.06, "sine");
      break;
    case "reveal":
      tone(audio, output, 392, 0, 0.42, 0.05);
      tone(audio, output, 523.25, 0.09, 0.44, 0.055);
      tone(audio, output, 659.25, 0.18, 0.46, 0.055);
      tone(audio, output, 783.99, 0.3, 0.48, 0.05);
      tone(audio, output, 1046.5, 0.42, 0.5, 0.04);
      break;
  }
}
