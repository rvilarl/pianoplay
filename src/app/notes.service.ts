// [PianoPlay](https://michaelecke.com/pianoplay) - Copyright (c) 2021 Rodrigo Jorge Vilar de Linares.

import { Injectable } from '@angular/core';
import { Note } from '@stringsync/vexml/dist/@types/elements';
import { SequenceEntry } from '@stringsync/vexml/dist/@types/playback';
import { Rect } from '@stringsync/vexml/dist/@types/spatial';

type CursorState = {
  index: number;
  hasNext: boolean;
  hasPrevious: boolean;
  cursorRect: Rect;
  sequenceEntry: SequenceEntry;
};

export type NoteObject = {
  value: number;
  key: string;
  timestamp: number;
  staffId: number;
  voice: number;
  fingering: string;
  isGrace: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class NotesService {
  mapPressed: Map<string, number> = new Map();
  // Initialize maps of notes comming from Music Sheet
  mapRequired = new Map<string, NoteObject>();
  mapPrevRequired = new Map<string, NoteObject>();
  tempoInBPM: number;

  constructor() {
    this.tempoInBPM = 120;
  }

  getMapRequired(): Map<string, NoteObject> {
    return this.mapRequired;
  }

  getMapPrevRequired(): Map<string, NoteObject> {
    return this.mapPrevRequired;
  }

  getMapPressed(): Map<string, number> {
    return this.mapPressed;
  }

  clear(): void {
    this.mapPressed.clear();
    this.mapRequired.clear();
    this.mapPrevRequired.clear();
  }

  press(name: string): void {
    this.mapPressed.set(name, 1);
  }

  release(name: string): void {
    this.mapPressed.delete(name);
  }

  // Check that new notes have been pressed since the last succesful check (value===1)
  private checkRequiredNew(): boolean {
    for (const [, noteObj] of this.mapRequired) {
      if (noteObj.value === 0) {
        if (this.mapPressed.has(noteObj.key)) {
          if ((this.mapPressed.get(noteObj.key) ?? -1) > 1) return false;
        } else {
          return false;
        }
      }
    }
    return true;
  }

  // Check required notes, if successful go to next cursor
  checkRequired(): boolean {
    // Check only new notes, hold notes with pedals would be to difficult
    if (this.checkRequiredNew() === true) {
      // Check that no pressed key is unexpexted (red key)
      for (const [key] of this.mapPressed) if (!this.mapRequired.has(key)) return false;
      // Mark all the notes as no longer new, go to next cycle
      for (const [key, value] of this.mapPressed) this.mapPressed.set(key, value + 1);
      return true;
    }
    return false;
  }

  // Calculate required notes deleting outphased onces and keeping track of new notes
  calculateRequired(cursor: CursorState, upperStave: boolean, lowerStave: boolean, back = false): void {
    // Get current source time stamp
    const timestamp = cursor.sequenceEntry.durationRange.start.ms;
    // Keep track of previous to avoid red keys before release, increment value
    this.mapPrevRequired.clear();
    for (const [key, noteObj] of this.mapRequired) {
      this.mapPrevRequired.set(key, noteObj);
      this.mapRequired.set(key, { ...noteObj, value: noteObj.value + 1 });
    }
    // Delete expired notes
    for (const [key, value] of this.mapRequired) {
      if (back || timestamp >= value.timestamp) {
        this.mapRequired.delete(key);
      }
    }
    // Register new notes under the cursor
    cursor.sequenceEntry.activeElements.forEach((value) => {
      if (value.name == "note") {
        const note = value as any;
        note.noteRender.vexflowNote.keyProps.forEach((keyProp: any) => {;
          const noteString = keyProp.intValue.toString();
          const noteTimestamp = cursor.sequenceEntry.durationRange.end.ms;
          console.log(noteString, timestamp, noteTimestamp);
          this.mapRequired.set(noteString, {
            value: 0,
            key: noteString,
            timestamp: noteTimestamp,
            staffId: 0,
            voice: 0,
            fingering: "",
            isGrace: false,
          });
        });
      }
    });
    console.log(this.mapRequired);
  }

  // Update note status for piano keyboard
  autoplayRequired(midiPress: (note: number, velocity: number) => void, midiRelease: (note: number) => void): void {
    // Release notes no longer required
    for (const [key] of this.mapPressed) {
      if (!this.mapRequired.has(key)) {
        midiRelease(parseInt(key) + 12);
      }
    }

    // Press new notes
    for (const [key, value] of this.mapRequired) {
      if (value.value === 0) {
        // If already pressed, release first
        if (this.mapPressed.has(key)) {
          midiRelease(parseInt(key) + 12);
        }
        midiPress(parseInt(key) + 12, 60);
      }
    }
  }
}
