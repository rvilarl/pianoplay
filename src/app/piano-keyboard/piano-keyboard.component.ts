// [PianoPlay](https://michaelecke.com/pianoplay) - Copyright (c) 2021 Rodrigo Jorge Vilar de Linares.

import { Component } from '@angular/core';

import { NotesService } from '../notes.service';

@Component({
  selector: 'app-piano-keyboard',
  templateUrl: './piano-keyboard.component.html',
  styleUrls: ['./piano-keyboard.component.scss'],
})
export class PianoKeyboardComponent {
  // Piano keyboard
  keys: string[] = [];
  keyStates: string[] = [];
  keyFingers: string[] = [];

  constructor(private notesService: NotesService) {
    // Initialize keboard to unpressed
    for (let i = 0; i < 88; i++) {
      this.keyStates.push('unpressed');
      this.keyFingers.push('');
    }
    // Generate keyboard
    this.keys = this.keys.concat(['white a', 'black as ', 'white b']);
    for (let i = 0; i < 7; i++) {
      this.keys = this.keys.concat([
        'white c',
        'black cs',
        'white d',
        'black ds',
        'white e',
        'white f',
        'black fs',
        'white g',
        'black gs',
        'white a',
        'black as',
        'white b',
      ]);
    }
    this.keys = this.keys.concat(['white c']);
  }

  // Update note status for piano keyboard
  updateNotesStatus(): void {
    for (let i = 0; i < 88; i++) {
      this.keyStates[i] = 'unpressed';
      this.keyFingers[i] = '';
    }
    if (this.notesService.getMapRequired().size) {
      for (const [key] of this.notesService.getMapPressed()) {
        if (this.notesService.getMapRequired().has(key) && this.notesService.getMapPrevRequired().has(key)) {
          this.keyStates[parseInt(key) - 9] = 'pressedkeep';
        } else if (this.notesService.getMapRequired().has(key)) {
          this.keyStates[parseInt(key) - 9] = 'pressed';
        } else if (this.notesService.getMapPrevRequired().has(key)) {
          this.keyStates[parseInt(key) - 9] = 'pressed';
        } else {
          this.keyStates[parseInt(key) - 9] = 'pressedwrong';
        }
      }
      for (const [, value] of this.notesService.getMapRequired()) {
        this.keyFingers[parseInt(value.key) - 9] = value.fingering;
      }
      for (const [key, value] of this.notesService.getMapRequired()) {
        if (value.value === 0) {
          if (this.keyStates[parseInt(key) - 9] == 'unpressed') {
            this.keyStates[parseInt(key) - 9] = 'unpressedreq';
          } else if ((this.notesService.getMapPressed().get(key) ?? -1) > 1) {
            this.keyStates[parseInt(value.key) - 9] = 'pressedreq';
          }
        }
      }
    } else {
      for (const [key] of this.notesService.getMapPressed()) {
        this.keyStates[parseInt(key) - 9] = 'pressed';
      }
    }
    //rvilarl this.changeRef.detectChanges();
  }
}
