import type { Mode, NoteAccidental, NoteLetter, NoteSpelling, VoicePart } from "./types";

export interface NoteChoice extends NoteSpelling {
  midi: number;
}

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
  soprano: { min: 59, max: 81, clef: "treble" },
  alto: { min: 55, max: 74, clef: "treble" },
  tenor: { min: 48, max: 67, clef: "bass" },
  bass: { min: 40, max: 60, clef: "bass" }
};

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
const NOTE_LETTERS: NoteLetter[] = ["C", "D", "E", "F", "G", "A", "B"];
const SHARP_Y: Record<string, number> = { F: 17, C: 27.5, G: 13.5, D: 24, A: 34.5, E: 20.5, B: 31 };
const FLAT_Y: Record<string, number> = { B: 31, E: 20.5, A: 34.5, D: 24, G: 38, C: 27.5, F: 41.5 };
const LETTER_INDEX: Record<NoteLetter, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const NATURAL_SEMITONES: Record<NoteLetter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

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

function keySignatureAccidental(letter: NoteLetter, signature: number): NoteAccidental | null {
  if (signature > 0 && SHARP_ORDER.slice(0, signature).includes(letter)) return "sharp";
  if (signature < 0 && FLAT_ORDER.slice(0, Math.abs(signature)).includes(letter)) return "flat";
  return null;
}

function visibleAccidental(note: NoteSpelling, signature: number): string {
  const keyAccidental = keySignatureAccidental(note.letter, signature);
  if (note.accidental === "natural") return keyAccidental ? "♮" : "";
  if (note.accidental === keyAccidental) return "";
  if (note.accidental === "sharp") return "♯";
  if (note.accidental === "flat") return "♭";
  return "";
}

function writtenAccidental(note: NoteSpelling, signature: number): NoteAccidental | null {
  return note.accidental === "natural"
    ? "natural"
    : note.accidental ?? keySignatureAccidental(note.letter, signature);
}

function accidentalSymbol(accidental: NoteAccidental | null): string {
  if (accidental === "natural") return "♮";
  if (accidental === "flat") return "♭";
  if (accidental === "sharp") return "♯";
  return "";
}

export function formatNoteName(note: NoteSpelling, signature: number): string {
  return `${note.letter}${accidentalSymbol(writtenAccidental(note, signature))}${note.octave}`;
}

export function describeNote(note: NoteSpelling, signature: number): string {
  const accidental = writtenAccidental(note, signature);
  const accidentalName = accidental === "flat" ? " flat" : accidental === "sharp" ? " sharp" : accidental === "natural" ? " natural" : "";
  return `${note.letter}${accidentalName} ${note.octave}`;
}

export function getNoteChoices(voice: VoicePart, signature: number): NoteChoice[] {
  const range = VOICE_RANGES[voice];
  const lowestOctave = Math.floor(range.min / 12) - 2;
  const highestOctave = Math.floor(range.max / 12);
  const choices: NoteChoice[] = [];

  function addChoice(midi: number, letter: NoteLetter, octave: number, accidental: NoteAccidental | null) {
    if (midi >= range.min && midi <= range.max) {
      choices.push({ midi, letter, octave, accidental });
    }
  }

  for (let octave = lowestOctave; octave <= highestOctave; octave += 1) {
    if (signature === 0) {
      NOTE_NAMES.forEach((name, pitchClass) => {
        const accidental = name.includes("♯") ? "sharp" : name.includes("♭") ? "flat" : null;
        addChoice(12 * (octave + 1) + pitchClass, name[0] as NoteLetter, octave, accidental);
      });
      continue;
    }

    for (const letter of NOTE_LETTERS) {
      const naturalMidi = 12 * (octave + 1) + NATURAL_SEMITONES[letter];
      const keyAccidental = keySignatureAccidental(letter, signature);
      if (keyAccidental) {
        addChoice(naturalMidi + (keyAccidental === "flat" ? -1 : 1), letter, octave, keyAccidental);
        addChoice(naturalMidi, letter, octave, "natural");
      } else {
        addChoice(naturalMidi, letter, octave, null);
        const accidental = signature < 0 ? "flat" : "sharp";
        addChoice(naturalMidi + (accidental === "flat" ? -1 : 1), letter, octave, accidental);
      }
    }
  }

  return choices.sort((a, b) =>
    a.midi - b.midi ||
    a.octave - b.octave ||
    LETTER_INDEX[a.letter] - LETTER_INDEX[b.letter]
  );
}

export function getPreferredNoteSpelling(
  midi: number,
  voice: VoicePart,
  signature: number,
  preferred?: NoteSpelling | null
): NoteSpelling {
  const choices = getNoteChoices(voice, signature).filter((choice) => choice.midi === midi);
  const match = preferred && choices.find((choice) =>
    choice.letter === preferred.letter &&
    choice.octave === preferred.octave &&
    choice.accidental === preferred.accidental
  );
  const choice = match ?? choices.find((item) => visibleAccidental(item, signature) === "") ?? choices[0];
  if (!choice) {
    const name = NOTE_NAMES[((midi % 12) + 12) % 12];
    return {
      letter: name[0] as NoteLetter,
      octave: Math.floor(midi / 12) - 1,
      accidental: name.includes("♯") ? "sharp" : name.includes("♭") ? "flat" : null
    };
  }
  return { letter: choice.letter, octave: choice.octave, accidental: choice.accidental };
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

export function staffPosition(
  note: NoteSpelling,
  clef: "treble" | "bass",
  signature: number
): { step: number; y: number; accidental: string } {
  const baseLetter = clef === "treble" ? "E" : "G";
  const baseOctave = clef === "treble" ? 4 : 2;
  const step = LETTER_INDEX[note.letter] + (note.octave - baseOctave) * 7 - LETTER_INDEX[baseLetter];
  return { step, y: 100 - step * 4, accidental: visibleAccidental(note, signature) };
}

export function formatShift(shift: number): string {
  if (shift === 0) return "0 semitones";
  return `${shift > 0 ? "+" : "−"}${Math.abs(shift)} ${Math.abs(shift) === 1 ? "semitone" : "semitones"}`;
}
