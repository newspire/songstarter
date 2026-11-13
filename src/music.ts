import type { Mode, VoicePart } from "./types";

export interface KeyOption {
  tonic: string;
  pitchClass: number;
  signature: number;
}

export const KEY_OPTIONS: Record<Mode, KeyOption[]> = {
  major: [
    { tonic: "C", pitchClass: 0, signature: 0 },
    { tonic: "G", pitchClass: 7, signature: 1 },
    { tonic: "D", pitchClass: 2, signature: 2 },
    { tonic: "A", pitchClass: 9, signature: 3 },
    { tonic: "E", pitchClass: 4, signature: 4 },
    { tonic: "B", pitchClass: 11, signature: 5 },
    { tonic: "F♯", pitchClass: 6, signature: 6 },
    { tonic: "C♯", pitchClass: 1, signature: 7 },
    { tonic: "F", pitchClass: 5, signature: -1 },
    { tonic: "B♭", pitchClass: 10, signature: -2 },
    { tonic: "E♭", pitchClass: 3, signature: -3 },
    { tonic: "A♭", pitchClass: 8, signature: -4 },
    { tonic: "D♭", pitchClass: 1, signature: -5 },
    { tonic: "G♭", pitchClass: 6, signature: -6 },
    { tonic: "C♭", pitchClass: 11, signature: -7 }
  ],
  minor: [
    { tonic: "A", pitchClass: 9, signature: 0 },
    { tonic: "E", pitchClass: 4, signature: 1 },
    { tonic: "B", pitchClass: 11, signature: 2 },
    { tonic: "F♯", pitchClass: 6, signature: 3 },
    { tonic: "C♯", pitchClass: 1, signature: 4 },
    { tonic: "G♯", pitchClass: 8, signature: 5 },
    { tonic: "D♯", pitchClass: 3, signature: 6 },
    { tonic: "A♯", pitchClass: 10, signature: 7 },
    { tonic: "D", pitchClass: 2, signature: -1 },
    { tonic: "G", pitchClass: 7, signature: -2 },
    { tonic: "C", pitchClass: 0, signature: -3 },
    { tonic: "F", pitchClass: 5, signature: -4 },
    { tonic: "B♭", pitchClass: 10, signature: -5 },
    { tonic: "E♭", pitchClass: 3, signature: -6 },
    { tonic: "A♭", pitchClass: 8, signature: -7 }
  ]
};

export const VOICE_RANGES: Record<VoicePart, { min: number; max: number; clef: "treble" | "bass" }> = {
  soprano: { min: 60, max: 81, clef: "treble" },
  alto: { min: 55, max: 74, clef: "treble" },
  tenor: { min: 48, max: 67, clef: "bass" },
  bass: { min: 40, max: 60, clef: "bass" }
};

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
const SHARP_Y: Record<string, number> = { F: 17, C: 27.5, G: 13.5, D: 24, A: 34.5, E: 20.5, B: 31 };
const FLAT_Y: Record<string, number> = { B: 31, E: 20.5, A: 34.5, D: 24, G: 38, C: 27.5, F: 41.5 };
const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const NATURAL_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteName(midi: number): string {
  const pitch = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitch]}${octave}`;
}

export function getKeyOption(tonic: string, mode: Mode): KeyOption {
  const option = KEY_OPTIONS[mode].find((item) => item.tonic === tonic);
  if (!option) {
    throw new Error(`Unknown ${mode} key: ${tonic}`);
  }
  return option;
}

export function tonicMidi(tonic: string, mode: Mode): number {
  return 60 + getKeyOption(tonic, mode).pitchClass;
}

export function getNoteChoices(voice: VoicePart): number[] {
  const range = VOICE_RANGES[voice];
  return Array.from({ length: range.max - range.min + 1 }, (_, index) => range.min + index);
}

export function keySignatureMarks(signature: number): { note: string; y: number; symbol: string }[] {
  const order = signature >= 0 ? SHARP_ORDER : FLAT_ORDER;
  const positions = signature >= 0 ? SHARP_Y : FLAT_Y;
  return order.slice(0, Math.abs(signature)).map((note) => ({
    note,
    y: positions[note],
    symbol: signature >= 0 ? "♯" : "♭"
  }));
}

export function staffPosition(midi: number, clef: "treble" | "bass"): { step: number; y: number; accidental: string } {
  const name = noteName(midi);
  const letter = name[0];
  const octave = Math.floor(midi / 12) - 1;
  const baseLetter = clef === "treble" ? "E" : "G";
  const baseOctave = clef === "treble" ? 4 : 2;
  const step = LETTER_INDEX[letter] + (octave - baseOctave) * 7 - LETTER_INDEX[baseLetter];
  const naturalMidi = (octave + 1) * 12 + NATURAL_SEMITONES[letter];
  const accidental = midi === naturalMidi ? "" : midi > naturalMidi ? "♯" : "♭";
  return { step, y: 100 - step * 4, accidental };
}

export function formatShift(shift: number): string {
  if (shift === 0) return "0 semitones";
  return `${shift > 0 ? "+" : "−"}${Math.abs(shift)} ${Math.abs(shift) === 1 ? "semitone" : "semitones"}`;
}
