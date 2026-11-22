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

function heartbeat(audio: AudioContext, output: GainNode, delay: number, volume: number) {
  glide(audio, output, 95, 55, delay, 0.13, volume);
  glide(audio, output, 75, 50, delay + 0.17, 0.11, volume * 0.72);
}

/** نَفَس صناعي هادئ من ضوضاء مرشّحة؛ لا يستخدم تسجيلاً بشرياً أو ملفاً خارجياً. */
function breath(audio: AudioContext, output: GainNode, delay: number, duration: number, volume: number) {
  const frameCount = Math.ceil(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, frameCount, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x6d2b79f5;
  for (let index = 0; index < frameCount; index += 1) {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    data[index] = (((value ^ (value >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  }

  const start = audio.currentTime + delay;
  const end = start + duration;
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const envelope = audio.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1050, start);
  filter.frequency.exponentialRampToValueAtTime(430, end);
  filter.Q.value = 0.55;
  envelope.gain.setValueAtTime(MIN_GAIN, start);
  envelope.gain.exponentialRampToValueAtTime(volume, start + duration * 0.42);
  envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, end);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(output);
  source.start(start);
  source.stop(end + 0.025);
}

function scheduleEffect(effect: SoundEffect, audio: AudioContext, output: GainNode) {
  switch (effect) {
    case "spin":
      breath(audio, output, 0, 0.62, 0.028);
      heartbeat(audio, output, 0.06, 0.045);
      for (let index = 0; index < 6; index += 1) {
        tone(audio, output, 300 + index * 28, 0.08 + index * 0.075, 0.055, 0.026, "triangle");
      }
      tone(audio, output, 520, 0.5, 0.24, 0.045);
      break;
    case "card":
      breath(audio, output, 0, 0.46, 0.024);
      heartbeat(audio, output, 0.02, 0.035);
      tone(audio, output, 392, 0.05, 0.32, 0.05);
      tone(audio, output, 523.25, 0.12, 0.34, 0.05);
      tone(audio, output, 659.25, 0.22, 0.38, 0.045);
      break;
    case "done":
      // Warm, understated transition instead of a game-show victory jingle.
      breath(audio, output, 0, 0.9, 0.035);
      heartbeat(audio, output, 0.05, 0.055);
      glide(audio, output, 190, 125, 0.25, 0.5, 0.03);
      break;
    case "skip":
      glide(audio, output, 280, 150, 0, 0.28, 0.065);
      tone(audio, output, 180, 0.15, 0.2, 0.035, "triangle");
      break;
    case "tick":
      // No quiz-show beeps: a soft, low-frequency pulse.
      glide(audio, output, 75, 48, 0, 0.16, 0.025);
      break;
    case "tickFinal":
      heartbeat(audio, output, 0, 0.045);
      breath(audio, output, 0.04, 0.32, 0.012);
      break;
    case "expire":
      breath(audio, output, 0, 0.5, 0.02);
      tone(audio, output, 330, 0, 0.18, 0.05, "triangle");
      tone(audio, output, 220, 0.15, 0.34, 0.045, "sine");
      break;
    case "reveal":
      breath(audio, output, 0, 1.05, 0.035);
      heartbeat(audio, output, 0, 0.05);
      heartbeat(audio, output, 0.38, 0.04);
      tone(audio, output, 392, 0.08, 0.44, 0.045);
      tone(audio, output, 523.25, 0.18, 0.46, 0.05);
      tone(audio, output, 659.25, 0.3, 0.48, 0.05);
      tone(audio, output, 783.99, 0.42, 0.5, 0.045);
      tone(audio, output, 1046.5, 0.56, 0.52, 0.032);
      break;
  }
}
