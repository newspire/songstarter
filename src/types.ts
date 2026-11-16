export const VOICES = ["soprano", "alto", "tenor", "bass"] as const;

export type VoicePart = (typeof VOICES)[number];
export type Mode = "major" | "minor";

export type NoteLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type NoteAccidental = "natural" | "flat" | "sharp";

export interface NoteSpelling {
  letter: NoteLetter;
  octave: number;
  accidental: NoteAccidental | null;
}

export interface Song {
  id: string;
  title: string;
  tonic: string;
  mode: Mode;
  notes: Record<VoicePart, number | null>;
  noteSpellings?: Record<VoicePart, NoteSpelling | null>;
  shift: number;
}

export interface MusicEvent {
  id: string;
  name: string;
  songIds: string[];
}

export interface AppData {
  songs: Song[];
  events: MusicEvent[];
  globalShift: number;
}

export const EMPTY_APP_DATA: AppData = {
  songs: [],
  events: [],
  globalShift: 0
};

export const VOICE_LABELS: Record<VoicePart, string> = {
  soprano: "Soprano",
  alto: "Alto",
  tenor: "Tenor",
  bass: "Bass"
};
