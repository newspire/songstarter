import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import QRCode from "qrcode";
import {
  describeNote,
  formatShift,
  formatNoteName,
  getKeyOption,
  getNoteChoices,
  getPreferredNoteSpelling,
  keySignatureMarks,
  noteName,
  staffPosition,
  tonicMidi,
  KEY_OPTIONS,
  VOICE_RANGES
} from "./music";
import { EMPTY_APP_DATA, VOICES, VOICE_LABELS } from "./types";
import type { AppData, Mode, MusicEvent, NoteSpelling, Song, VoicePart } from "./types";

const STORAGE_KEY = "song-starter-data-v1";
const FLAT_GLYPH_NUDGE = -3;

interface StoredDataResult {
  data: AppData;
  error: string | null;
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<AppData>;
  return (
    Array.isArray(data.songs) &&
    Array.isArray(data.events) &&
    typeof data.globalShift === "number" &&
    data.songs.every((song) =>
      typeof song.id === "string" &&
      typeof song.title === "string" &&
      typeof song.tonic === "string" &&
      (song.mode === "major" || song.mode === "minor") &&
      typeof song.shift === "number" &&
      song.notes !== null &&
      typeof song.notes === "object" &&
      VOICES.every((voice) => song.notes[voice] === null || typeof song.notes[voice] === "number") &&
      (song.noteSpellings === undefined || isSongNoteSpellings(song.noteSpellings))
    ) &&
    data.events.every((event) =>
      typeof event.id === "string" &&
      typeof event.name === "string" &&
      Array.isArray(event.songIds) &&
      event.songIds.every((id) => typeof id === "string")
    )
  );
}

function isNoteSpelling(value: unknown): value is NoteSpelling {
  if (!value || typeof value !== "object") return false;
  const spelling = value as Partial<NoteSpelling>;
  return (
    ["A", "B", "C", "D", "E", "F", "G"].includes(spelling.letter ?? "") &&
    Number.isInteger(spelling.octave) &&
    (spelling.accidental === null || spelling.accidental === "natural" || spelling.accidental === "flat" || spelling.accidental === "sharp")
  );
}

function isSongNoteSpellings(value: unknown): value is Record<VoicePart, NoteSpelling | null> {
  if (!value || typeof value !== "object") return false;
  const spellings = value as Record<VoicePart, unknown>;
  return VOICES.every((voice) => spellings[voice] === null || isNoteSpelling(spellings[voice]));
}

function getNoteLabel(
  midi: number | null,
  spelling: NoteSpelling | null,
  voice: VoicePart,
  signature: number,
  emptyLabel = "Not set"
): string {
  if (midi === null) return emptyLabel;
  return formatNoteName(getPreferredNoteSpelling(midi, voice, signature, spelling), signature);
}

function getSongNoteLabel(song: Song, voice: VoicePart): string {
  return getNoteLabel(
    song.notes[voice],
    song.noteSpellings?.[voice] ?? null,
    voice,
    getKeyOption(song.tonic, song.mode).signature,
    "—"
  );
}

function getInitialNoteSpellings(song: Song | null, signature: number): Record<VoicePart, NoteSpelling | null> {
  function getSpelling(voice: VoicePart): NoteSpelling | null {
    const midi = song?.notes[voice];
    if (!song || midi === null || midi === undefined) return null;
    return getPreferredNoteSpelling(midi, voice, signature, song.noteSpellings?.[voice]);
  }

  return {
    soprano: getSpelling("soprano"),
    alto: getSpelling("alto"),
    tenor: getSpelling("tenor"),
    bass: getSpelling("bass")
  };
}

function readStoredData(): StoredDataResult {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return { data: EMPTY_APP_DATA, error: null };
    const parsed: unknown = JSON.parse(saved);
    if (!isAppData(parsed)) {
      return {
        data: EMPTY_APP_DATA,
        error: "Saved data could not be read. Start fresh to replace the damaged local copy."
      };
    }
    return { data: parsed, error: null };
  } catch {
    return {
      data: EMPTY_APP_DATA,
      error: "Saved data could not be read. Start fresh to replace the damaged local copy."
    };
  }
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function KeySignatureGraphic({ signature }: { signature: number }) {
  const marks = keySignatureMarks(signature);
  return (
    <svg
      className="key-signature"
      viewBox="0 0 88 68"
      role="img"
      aria-label={signature === 0 ? "No sharps or flats" : `${Math.abs(signature)} ${signature > 0 ? "sharps" : "flats"}`}
    >
      {[17, 24, 31, 38, 45].map((y) => (
        <line key={y} x1="5" x2="83" y1={y} y2={y} className="staff-line" />
      ))}
      {marks.map((mark, index) => (
        <text
          key={mark.note}
          x={14 + index * 9}
          y={mark.y + (mark.symbol === "♭" ? FLAT_GLYPH_NUDGE : 0)}
          dominantBaseline="middle"
          className="signature-mark"
        >
          {mark.symbol}
        </text>
      ))}
    </svg>
  );
}

function StaffNote({
  spelling,
  clef,
  signature
}: {
  spelling: NoteSpelling | null;
  clef: "treble" | "bass";
  signature: number;
}) {
  const position = spelling === null ? null : staffPosition(spelling, clef, signature);
  const ledgerSteps: number[] = [];
  if (position) {
    for (let step = 10; step <= position.step; step += 2) ledgerSteps.push(step);
    for (let step = -2; step >= position.step; step -= 2) ledgerSteps.push(step);
  }

  return (
    <svg
      className="staff-note"
      viewBox="0 0 80 120"
      role="img"
      aria-label={spelling === null ? "No starting note selected" : `${describeNote(spelling, signature)} on the ${clef} staff`}
    >
      {[68, 76, 84, 92, 100].map((y) => (
        <line key={y} x1="8" x2="72" y1={y} y2={y} className="staff-line" />
      ))}
      {ledgerSteps.map((step) => (
        <line key={step} x1="43" x2="69" y1={100 - step * 4} y2={100 - step * 4} className="staff-line" />
      ))}
      {position?.accidental && (
        <text x="39" y={position.y + 4} className="note-accidental">
          {position.accidental}
        </text>
      )}
      {position && (
        <ellipse cx="57" cy={position.y} rx="6.5" ry="4.3" transform={`rotate(-18 57 ${position.y})`} className="note-head" />
      )}
    </svg>
  );
}

function Stepper({
  label,
  value,
  onChange,
  compact = false
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={`stepper${compact ? " stepper-compact" : ""}`} aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} aria-label={`Lower ${label} by one semitone`}>
        −
      </button>
      <span className="stepper-value" aria-live="polite">
        {formatShift(value)}
      </span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label={`Raise ${label} by one semitone`}>
        +
      </button>
    </div>
  );
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function SongEditor({
  song,
  onSave,
  onCancel
}: {
  song: Song | null;
  onSave: (song: Song) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(song?.title ?? "");
  const [mode, setMode] = useState<Mode>(song?.mode ?? "major");
  const [tonic, setTonic] = useState(song?.tonic ?? "C");
  const [notes, setNotes] = useState<Record<VoicePart, number | null>>(
    song?.notes ?? { soprano: null, alto: null, tenor: null, bass: null }
  );
  const [noteSpellings, setNoteSpellings] = useState<Record<VoicePart, NoteSpelling | null>>(
    () => getInitialNoteSpellings(song, getKeyOption(song?.tonic ?? "C", song?.mode ?? "major").signature)
  );
  const [shift, setShift] = useState(song?.shift ?? 0);
  const keyOptions = KEY_OPTIONS[mode];
  const signature = getKeyOption(tonic, mode).signature;

  function changeKey(nextMode: Mode, nextTonic: string) {
    const nextSignature = getKeyOption(nextTonic, nextMode).signature;
    setMode(nextMode);
    setTonic(nextTonic);
    setNoteSpellings((current) => {
      const next = { ...current };
      VOICES.forEach((voice) => {
        const midi = notes[voice];
        next[voice] = midi === null ? null : getPreferredNoteSpelling(midi, voice, nextSignature);
      });
      return next;
    });
  }

  function changeMode(nextMode: Mode) {
    changeKey(nextMode, nextMode === "major" ? "C" : "A");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedTitle = title.trim();
    if (!cleanedTitle) return;
    onSave({
      id: song?.id ?? makeId(),
      title: cleanedTitle,
      tonic,
      mode,
      notes,
      noteSpellings,
      shift
    });
  }

  return (
    <form className="editor-card" onSubmit={submit}>
      <div className="editor-topline">
        <div>
          <p className="eyebrow">{song ? "EDIT SONG" : "NEW SONG"}</p>
          <h2>{song ? "Update song details" : "Add a song"}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label="Close song editor">×</button>
      </div>

      <label className="field-label" htmlFor="song-title">Song name</label>
      <input
        id="song-title"
        className="text-input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="For example, Amazing Grace"
        autoComplete="off"
        required
      />

      <div className="field-block">
        <span className="field-label">Song key</span>
        <p className="helper-text">Choose the key shown in your music. The picture helps you match the symbols.</p>
        <div className="mode-toggle" role="group" aria-label="Key type">
          {(["major", "minor"] as const).map((value) => (
            <button key={value} type="button" className={mode === value ? "selected" : ""} onClick={() => changeMode(value)}>
              {value === "major" ? "Major" : "Minor"}
            </button>
          ))}
        </div>
        <div className="key-grid" role="group" aria-label={`${mode} key`}>
          {keyOptions.map((option) => (
            <button
              key={option.tonic}
              type="button"
              className={`key-choice${tonic === option.tonic ? " selected" : ""}`}
              onClick={() => changeKey(mode, option.tonic)}
              aria-pressed={tonic === option.tonic}
              aria-label={`${option.tonic} ${mode}`}
            >
              <KeySignatureGraphic signature={option.signature} />
              <span>{option.tonic}</span>
            </button>
          ))}
        </div>
        <p className="selection-summary">Selected: <strong>{tonic} {mode}</strong></p>
      </div>

      <div className="field-block">
        <span className="field-label">Starting notes</span>
        <p className="helper-text">Select each note as it appears in the score. The key signature will be applied. Sharps, flats, and naturals on the staff are only for accidentals.</p>
        <div className="voice-pickers">
          {VOICES.map((voice) => {
            const clef = VOICE_RANGES[voice].clef;
            return (
              <details className="voice-picker" key={voice} open={voice === "soprano"}>
                <summary>
                  <span className="voice-summary-label">
                    <strong>{VOICE_LABELS[voice]}</strong>
                    <span>{getNoteLabel(notes[voice], noteSpellings[voice], voice, signature)}</span>
                  </span>
                  <StaffNote spelling={noteSpellings[voice]} clef={clef} signature={signature} />
                  <span className="disclosure-mark" aria-hidden="true">⌄</span>
                </summary>
                <div className="note-grid" role="group" aria-label={`${VOICE_LABELS[voice]} starting note`}>
                  <button
                    type="button"
                    className={`note-choice note-choice-none${notes[voice] === null ? " selected" : ""}`}
                    onClick={() => {
                      setNotes((current) => ({ ...current, [voice]: null }));
                      setNoteSpellings((current) => ({ ...current, [voice]: null }));
                    }}
                    aria-pressed={notes[voice] === null}
                    aria-label={`No starting note for ${VOICE_LABELS[voice]}`}
                  >
                    <span className="note-none-mark" aria-hidden="true">—</span>
                    <span>Not set</span>
                  </button>
                  {getNoteChoices(voice, signature).map((choice) => {
                    const spelling: NoteSpelling = {
                      letter: choice.letter,
                      octave: choice.octave,
                      accidental: choice.accidental
                    };
                    const selected = notes[voice] === choice.midi &&
                      noteSpellings[voice]?.letter === choice.letter &&
                      noteSpellings[voice]?.octave === choice.octave &&
                      noteSpellings[voice]?.accidental === choice.accidental;
                    return (
                      <button
                        type="button"
                        key={`${choice.midi}-${choice.letter}-${choice.octave}-${choice.accidental ?? "none"}`}
                        className={`note-choice${selected ? " selected" : ""}`}
                        onClick={() => {
                          setNotes((current) => ({ ...current, [voice]: choice.midi }));
                          setNoteSpellings((current) => ({ ...current, [voice]: spelling }));
                        }}
                        aria-pressed={selected}
                        aria-label={`Choose ${describeNote(spelling, signature)} for ${VOICE_LABELS[voice]}`}
                      >
                        <StaffNote spelling={spelling} clef={clef} signature={signature} />
                        <span>{formatNoteName(spelling, signature)}</span>
                      </button>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="field-block song-shift-field">
        <div>
          <span className="field-label">This song’s pitch adjustment</span>
          <p className="helper-text">Raise or lower this song to suit the leader.</p>
        </div>
        <Stepper label="song pitch" value={shift} onChange={setShift} />
      </div>
      <div className="form-actions">
        <button type="button" className="button button-muted" onClick={onCancel}>Cancel</button>
        <button type="submit" className="button button-primary">{song ? "Save changes" : "Save song"}</button>
      </div>
    </form>
  );
}

function SongList({
  songs,
  globalShift,
  onAdd,
  onEdit,
  onDelete,
  onShift,
  onPlay
}: {
  songs: Song[];
  globalShift: number;
  onAdd: () => void;
  onEdit: (song: Song) => void;
  onDelete: (song: Song) => void;
  onShift: (song: Song, shift: number) => void;
  onPlay: (song: Song, notes: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const normalizedSearch = search.trim().toLocaleLowerCase().replace(/♭/g, "b").replace(/♯/g, "#");
  const filteredSongs = songs.filter((song) => {
    const searchableText = [
      song.title,
      song.tonic,
      song.mode,
      ...VOICES.flatMap((voice) => {
        const midi = song.notes[voice];
        return midi === null ? [] : [getSongNoteLabel(song, voice), noteName(midi)];
      })
    ].join(" ").toLocaleLowerCase().replace(/♭/g, "b").replace(/♯/g, "#");
    return searchableText.includes(normalizedSearch);
  });

  return (
    <section>
      <SectionHeading
        eyebrow="YOUR LIBRARY"
        title="Songs"
        action={<button className="button button-primary" onClick={onAdd}>＋ Add song</button>}
      />
      <p className="section-intro">Save each song’s key and starting notes once, then add it to any event.</p>
      {songs.length === 0 ? (
        <div className="empty-card">
          <div className="empty-illustration" aria-hidden="true">♫</div>
          <h3>Your song list starts here</h3>
          <p>Add a song’s name, key, and starting notes for all four voice parts.</p>
          <button className="button button-primary" onClick={onAdd}>Add your first song</button>
        </div>
      ) : (
        <>
          <label className="song-search">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search songs by name, key, or note"
              aria-label="Search songs by name, key, or starting note"
            />
          </label>
          {filteredSongs.length === 0 ? (
            <div className="empty-search">
              <h3>No matching songs</h3>
              <p>Try another song name, key, or starting note.</p>
            </div>
          ) : (
            <div className="song-list">
              {filteredSongs.map((song) => {
                const isPlayingOpen = playingSongId === song.id;
                return (
                  <article className="song-library-card" key={song.id}>
                    <div className="song-library-top">
                      <div className="song-title-wrap">
                        <span className="song-note-icon" aria-hidden="true">♫</span>
                        <div>
                          <h3>{song.title}</h3>
                          <p>{song.tonic} {song.mode} · {VOICES.map((voice) => getSongNoteLabel(song, voice)).join(" · ")}</p>
                        </div>
                      </div>
                      <div className="card-actions">
                        <button
                          type="button"
                          className="text-button"
                          aria-expanded={isPlayingOpen}
                          aria-controls={`library-player-${song.id}`}
                          onClick={() => setPlayingSongId(isPlayingOpen ? null : song.id)}
                        >
                          {isPlayingOpen ? "Hide" : "Play"}
                        </button>
                        <button type="button" className="text-button" onClick={() => onEdit(song)}>Edit</button>
                        <button type="button" className="text-button danger-text" onClick={() => onDelete(song)}>Remove</button>
                      </div>
                    </div>
                    <div className="library-shift">
                      <span>Song pitch</span>
                      <Stepper label={`${song.title} pitch`} value={song.shift} onChange={(shift) => onShift(song, shift)} compact />
                    </div>
                    {isPlayingOpen && (
                      <div className="library-playback-panel" id={`library-player-${song.id}`}>
                        <div className="library-play-summary">
                          <span className="total-shift">Total shift <strong>{formatShift(song.shift + globalShift)}</strong></span>
                          <span className="shift-detail">Song {formatShift(song.shift)} · Overall {formatShift(globalShift)}</span>
                        </div>
                        <SongPlaybackButtons song={song} onPlay={onPlay} />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PlaybackButton({
  children,
  onClick,
  emphasis = false,
  disabled = false
}: {
  children: ReactNode;
  onClick: () => void;
  emphasis?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`play-button${emphasis ? " play-button-emphasis" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="play-symbol" aria-hidden="true">▶</span>
      {children}
    </button>
  );
}

function SongPlaybackButtons({ song, onPlay }: { song: Song; onPlay: (song: Song, notes: number[]) => void }) {
  const availableNotes = VOICES
    .map((voice) => song.notes[voice])
    .filter((midi): midi is number => midi !== null);

  return (
    <div className="playback-grid">
      <PlaybackButton onClick={() => onPlay(song, [tonicMidi(song.tonic, song.mode)])} emphasis>Key</PlaybackButton>
      {VOICES.map((voice) => (
        <PlaybackButton
          key={voice}
          disabled={song.notes[voice] === null}
          onClick={() => {
            const midi = song.notes[voice];
            if (midi !== null) onPlay(song, [midi]);
          }}
        >
          {VOICE_LABELS[voice]}
        </PlaybackButton>
      ))}
      <PlaybackButton
        disabled={availableNotes.length === 0}
        onClick={() => {
          if (availableNotes.length > 0) onPlay(song, availableNotes);
        }}
      >
        {availableNotes.length === VOICES.length ? "All 4 voices" : "Available voices"}
      </PlaybackButton>
    </div>
  );
}

function EventManager({
  events,
  songs,
  globalShift,
  onCreate,
  onRename,
  onDelete,
  onAddSongs,
  onRemoveSong,
  onSongShift,
  onPlay
}: {
  events: MusicEvent[];
  songs: Song[];
  globalShift: number;
  onCreate: (name: string) => string;
  onRename: (event: MusicEvent, name: string) => void;
  onDelete: (event: MusicEvent) => void;
  onAddSongs: (event: MusicEvent, songIds: string[]) => void;
  onRemoveSong: (event: MusicEvent, songId: string) => void;
  onSongShift: (song: Song, shift: number) => void;
  onPlay: (song: Song, notes: number[]) => void;
}) {
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? "");
  const [newEventName, setNewEventName] = useState("");
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [showSongPicker, setShowSongPicker] = useState(false);

  useEffect(() => {
    if (!events.some((event) => event.id === selectedId)) setSelectedId(events[0]?.id ?? "");
  }, [events, selectedId]);

  const activeEvent = events.find((event) => event.id === selectedId);
  const eventSongs = activeEvent
    ? activeEvent.songIds.map((id) => songs.find((song) => song.id === id)).filter((song): song is Song => song !== undefined)
    : [];
  const availableSongs = activeEvent ? songs.filter((song) => !activeEvent.songIds.includes(song.id)) : songs;

  function submitNewEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newEventName.trim();
    if (!name) return;
    setSelectedId(onCreate(name));
    setNewEventName("");
    setShowNewEvent(false);
  }

  function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEvent || !draftName.trim()) return;
    onRename(activeEvent, draftName.trim());
    setEditingName(false);
  }

  function addSelectedSongs() {
    if (!activeEvent || selectedSongIds.length === 0) return;
    onAddSongs(activeEvent, selectedSongIds);
    setSelectedSongIds([]);
    setShowSongPicker(false);
  }

  return (
    <section>
      <SectionHeading
        eyebrow="PLAN A SERVICE OR REHEARSAL"
        title="Events"
        action={<button className="button button-primary" onClick={() => setShowNewEvent((value) => !value)}>＋ New event</button>}
      />
      <p className="section-intro">Create an event, then add the songs you’ll sing. Your pitches stay ready on your phone.</p>

      {showNewEvent && (
        <form className="inline-form" onSubmit={submitNewEvent}>
          <label className="field-label" htmlFor="new-event-name">Event name</label>
          <div className="inline-form-row">
            <input id="new-event-name" className="text-input" value={newEventName} onChange={(event) => setNewEventName(event.target.value)} placeholder="Sunday service, rehearsal..." autoFocus required />
            <button type="submit" className="button button-primary">Create</button>
            <button type="button" className="button button-muted" onClick={() => setShowNewEvent(false)}>Cancel</button>
          </div>
        </form>
      )}

      {events.length === 0 ? (
        <div className="empty-card">
          <div className="empty-illustration" aria-hidden="true">♪</div>
          <h3>No events yet</h3>
          <p>Make an event for a service or rehearsal, then pick songs from your library.</p>
          <button className="button button-primary" onClick={() => setShowNewEvent(true)}>Create an event</button>
        </div>
      ) : (
        <>
          <div className="event-tabs" role="tablist" aria-label="Your events">
            {events.map((event) => (
              <button
                type="button"
                role="tab"
                aria-selected={event.id === activeEvent?.id}
                className={`event-tab${event.id === activeEvent?.id ? " selected" : ""}`}
                key={event.id}
                onClick={() => { setSelectedId(event.id); setShowSongPicker(false); }}
              >
                {event.name}
                <span>{event.songIds.length}</span>
              </button>
            ))}
          </div>
          {activeEvent && (
            <div className="event-detail">
              <div className="event-detail-heading">
                {editingName ? (
                  <form className="rename-form" onSubmit={submitName}>
                    <input className="text-input" aria-label="Event name" value={draftName} onChange={(event) => setDraftName(event.target.value)} autoFocus required />
                    <button className="text-button" type="submit">Save</button>
                    <button className="text-button" type="button" onClick={() => setEditingName(false)}>Cancel</button>
                  </form>
                ) : (
                  <div>
                    <p className="eyebrow">EVENT SONGS</p>
                    <h3>{activeEvent.name}</h3>
                  </div>
                )}
                {!editingName && (
                  <div className="card-actions">
                    <button type="button" className="text-button" onClick={() => { setDraftName(activeEvent.name); setEditingName(true); }}>Rename</button>
                    <button type="button" className="text-button danger-text" onClick={() => onDelete(activeEvent)}>Delete event</button>
                  </div>
                )}
              </div>

              <div className="event-action-row">
                <div className="event-note"><span aria-hidden="true">♪</span> {eventSongs.length} {eventSongs.length === 1 ? "song" : "songs"}</div>
                <button
                  type="button"
                  className="button button-outline"
                  disabled={songs.length === 0 || availableSongs.length === 0}
                  onClick={() => setShowSongPicker((value) => !value)}
                >
                  ＋ Add saved songs
                </button>
              </div>

              {showSongPicker && (
                <div className="song-picker-panel">
                  {songs.length === 0 ? (
                    <p className="helper-text">Add songs to your library first.</p>
                  ) : availableSongs.length === 0 ? (
                    <p className="helper-text">Every saved song is already in this event.</p>
                  ) : (
                    <>
                      <p className="field-label">Choose songs to add</p>
                      <div className="available-songs">
                        {availableSongs.map((song) => (
                          <label className="available-song" key={song.id}>
                            <input
                              type="checkbox"
                              checked={selectedSongIds.includes(song.id)}
                              onChange={(event) => setSelectedSongIds((current) =>
                                event.target.checked ? [...current, song.id] : current.filter((id) => id !== song.id)
                              )}
                            />
                            <span><strong>{song.title}</strong><small>{song.tonic} {song.mode}</small></span>
                          </label>
                        ))}
                      </div>
                      <div className="form-actions">
                        <button className="button button-muted" type="button" onClick={() => setShowSongPicker(false)}>Cancel</button>
                        <button className="button button-primary" type="button" onClick={addSelectedSongs} disabled={selectedSongIds.length === 0}>
                          Add {selectedSongIds.length ? `${selectedSongIds.length} ` : ""}{selectedSongIds.length === 1 ? "song" : "songs"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {eventSongs.length === 0 ? (
                <div className="event-empty">
                  <span aria-hidden="true">♫</span>
                  <p>No songs in this event yet.</p>
                  <p className="helper-text">Add saved songs to see their play buttons here.</p>
                </div>
              ) : (
                <div className="event-song-list">
                  {eventSongs.map((song, index) => {
                    const effectiveShift = song.shift + globalShift;
                    return (
                      <article className="event-song-card" key={song.id}>
                        <div className="event-song-title">
                          <span className="song-order">{String(index + 1).padStart(2, "0")}</span>
                          <div>
                            <h4>{song.title}</h4>
                            <p>{song.tonic} {song.mode}</p>
                          </div>
                          <button type="button" className="text-button danger-text remove-event-song" onClick={() => onRemoveSong(activeEvent, song.id)}>Remove</button>
                        </div>
                        <div className="event-song-shift">
                          <span className="total-shift">Total shift <strong>{formatShift(effectiveShift)}</strong></span>
                          <span className="shift-detail">Song {formatShift(song.shift)} · Overall {formatShift(globalShift)}</span>
                          <Stepper label={`${song.title} pitch`} value={song.shift} onChange={(shift) => onSongShift(song, shift)} compact />
                        </div>
                        <SongPlaybackButtons song={song} onPlay={onPlay} />
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function AboutPage() {
  const websiteUrl = "https://newspire.github.io/songstarter/";
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(websiteUrl, {
      width: 192,
      margin: 2,
      color: { dark: "#23332f", light: "#fffefa" }
    }).then((dataUrl) => {
      if (!cancelled) setQrCode(dataUrl);
    }).catch(() => {
      if (!cancelled) setQrError("The QR code could not be generated. You can still share the link below.");
    });
    return () => { cancelled = true; };
  }, [websiteUrl]);

  return (
    <section className="about-page" aria-labelledby="about-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ABOUT SONG STARTER</p>
          <h2 id="about-title">Made for music leaders</h2>
        </div>
      </div>
      <p className="section-intro">Keep your songs, events, and starting pitches ready wherever you lead.</p>
      <div className="about-card">
        <div className="about-details">
          <div className="about-owner">
            <p className="eyebrow">CREATED BY</p>
            <h3>Andy Yates</h3>
          </div>
          <div className="about-contact">
            <span className="about-label">Contact</span>
            <a href="mailto:newspire@gmail.com">newspire@gmail.com</a>
          </div>
          <p className="about-copyright">© {new Date().getFullYear()} Andy Yates. All rights reserved.</p>
          <p className="about-version">Version {__APP_VERSION__}</p>
        </div>
        <div className="about-share">
          <h3>Share Song Starter</h3>
          <p>Scan this code to open the app on your phone.</p>
          <a className="about-url" href={websiteUrl}>{websiteUrl}</a>
          <div className="about-qr">
            {qrCode
              ? <img src={qrCode} alt={`QR code linking to ${websiteUrl}`} width="192" height="192" />
              : qrError
                ? <p role="alert">{qrError}</p>
                : <p aria-live="polite">Creating QR code…</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [initialData] = useState(readStoredData);
  const [data, setData] = useState<AppData>(initialData.data);
  const [storageError, setStorageError] = useState(initialData.error);
  const [storageBlocked, setStorageBlocked] = useState(Boolean(initialData.error));
  const [needsReset, setNeedsReset] = useState(Boolean(initialData.error));
  const [tab, setTab] = useState<"songs" | "events" | "about">("songs");
  const [editingSong, setEditingSong] = useState<Song | null | undefined>(undefined);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (storageBlocked) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStorageError(null);
    } catch {
      setStorageBlocked(true);
      setStorageError("This device could not save your changes. Check the browser’s available storage and try again.");
    }
  }, [data, storageBlocked]);

  useEffect(() => {
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleInstall);
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  function updateSong(updatedSong: Song) {
    setData((current) => {
      const exists = current.songs.some((song) => song.id === updatedSong.id);
      return {
        ...current,
        songs: exists
          ? current.songs.map((song) => song.id === updatedSong.id ? updatedSong : song)
          : [...current.songs, updatedSong]
      };
    });
    setEditingSong(undefined);
  }

  function updateSongShift(song: Song, shift: number) {
    setData((current) => ({
      ...current,
      songs: current.songs.map((item) => item.id === song.id ? { ...item, shift } : item)
    }));
  }

  function updateEventSongIds(event: MusicEvent, songIds: string[]) {
    setData((current) => ({
      ...current,
      events: current.events.map((item) => item.id === event.id ? { ...item, songIds } : item)
    }));
  }

  function playNotes(song: Song, notes: number[]) {
    const context = audioContext.current ?? new AudioContext();
    audioContext.current = context;
    const effectiveShift = song.shift + data.globalShift;
    void context.resume().then(() => {
      setPlaybackError(null);
      const now = context.currentTime + 0.03;
      for (const midi of notes) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "triangle";
        oscillator.frequency.value = 440 * 2 ** ((midi + effectiveShift - 69) / 12);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(notes.length > 1 ? 0.12 : 0.24, now + 0.04);
        gain.gain.setValueAtTime(notes.length > 1 ? 0.12 : 0.24, now + 0.95);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 1.18);
        oscillator.addEventListener("ended", () => {
          oscillator.disconnect();
          gain.disconnect();
        }, { once: true });
      }
    }).catch(() => {
      setPlaybackError("Audio playback could not start. Tap a play button again to retry.");
    });
  }

  function startFresh() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setData(EMPTY_APP_DATA);
      setStorageBlocked(false);
      setNeedsReset(false);
      setStorageError(null);
    } catch {
      setStorageError("The saved data could not be cleared. Check your browser settings and try again.");
    }
  }

  function retryStorage() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStorageBlocked(false);
      setStorageError(null);
    } catch {
      setStorageError("Saving still isn’t available on this device. Your current changes remain open in this tab.");
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-row">
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
          <div className="brand-copy">
            <h1>Song Starter</h1>
            <p>Your songs, ready to lead.</p>
          </div>
          {installPrompt && <button className="install-button" onClick={() => void installApp()}>Install app</button>}
        </div>
        <div className="global-pitch">
          <div className="global-pitch-copy">
            <span className="global-pitch-icon" aria-hidden="true">↕</span>
            <div>
              <strong>Leader pitch adjustment</strong>
              <span>Applies to every song</span>
            </div>
          </div>
          <Stepper label="overall pitch" value={data.globalShift} onChange={(globalShift) => setData((current) => ({ ...current, globalShift }))} compact />
        </div>
      </header>

      {storageError && (
        <div className="storage-alert" role="alert">
          <span>{storageError}</span>
          {storageBlocked && needsReset
            ? <button type="button" onClick={startFresh}>Start fresh</button>
            : storageBlocked
              ? <button type="button" onClick={retryStorage}>Try saving again</button>
              : null}
        </div>
      )}
      {playbackError && <div className="storage-alert playback-alert" role="alert">{playbackError}</div>}

      <main className="main-content">
        <nav className="main-tabs" aria-label="Main sections">
          <button type="button" className={tab === "songs" ? "active" : ""} onClick={() => { setTab("songs"); setEditingSong(undefined); }}>
            <span aria-hidden="true">♫</span> Songs <span className="tab-count">{data.songs.length}</span>
          </button>
          <button type="button" className={tab === "events" ? "active" : ""} onClick={() => { setTab("events"); setEditingSong(undefined); }}>
            <span aria-hidden="true">▦</span> Events <span className="tab-count">{data.events.length}</span>
          </button>
          <button type="button" className={tab === "about" ? "active" : ""} onClick={() => { setTab("about"); setEditingSong(undefined); }}>
            <span aria-hidden="true">ⓘ</span> About
          </button>
        </nav>

        {tab === "songs" && (
          editingSong !== undefined
            ? <SongEditor song={editingSong} onSave={updateSong} onCancel={() => setEditingSong(undefined)} />
            : <SongList
                songs={data.songs}
                globalShift={data.globalShift}
                onAdd={() => setEditingSong(null)}
                onEdit={(song) => setEditingSong(song)}
                onShift={updateSongShift}
                onPlay={playNotes}
                onDelete={(song) => {
                  if (!window.confirm(`Remove “${song.title}” from your song list and all events?`)) return;
                  setData((current) => ({
                    ...current,
                    songs: current.songs.filter((item) => item.id !== song.id),
                    events: current.events.map((event) => ({ ...event, songIds: event.songIds.filter((id) => id !== song.id) }))
                  }));
                }}
              />
        )}

        {tab === "events" && (
          <EventManager
            events={data.events}
            songs={data.songs}
            globalShift={data.globalShift}
            onCreate={(name) => {
              const event: MusicEvent = { id: makeId(), name, songIds: [] };
              setData((current) => ({ ...current, events: [...current.events, event] }));
              return event.id;
            }}
            onRename={(event, name) => setData((current) => ({
              ...current,
              events: current.events.map((item) => item.id === event.id ? { ...item, name } : item)
            }))}
            onDelete={(event) => {
              if (!window.confirm(`Delete the event “${event.name}”? Your saved songs will stay in your library.`)) return;
              setData((current) => ({ ...current, events: current.events.filter((item) => item.id !== event.id) }));
            }}
            onAddSongs={(event, songIds) => updateEventSongIds(event, [...event.songIds, ...songIds])}
            onRemoveSong={(event, songId) => updateEventSongIds(event, event.songIds.filter((id) => id !== songId))}
            onSongShift={updateSongShift}
            onPlay={playNotes}
          />
        )}

        {tab === "about" && <AboutPage />}
      </main>
      <footer className="app-footer">
        <span>Saved on this device</span>
        <span className="footer-dot" aria-hidden="true">·</span>
        <span>No account needed</span>
      </footer>
    </div>
  );
}
