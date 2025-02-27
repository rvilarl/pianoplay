// [PianoPlay](https://michaelecke.com/pianoplay) - Copyright (c) 2021 Rodrigo Jorge Vilar de Linares.

import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Piano } from '@tonejs/piano';
import * as vexml from '@stringsync/vexml';

import { NotesService } from '../notes.service';
import { PianoKeyboardComponent } from '../piano-keyboard/piano-keyboard.component';

import MIDIAccess = WebMidi.MIDIAccess;
import MIDIConnectionEvent = WebMidi.MIDIConnectionEvent;
import MIDIMessageEvent = WebMidi.MIDIMessageEvent;
import MIDIInput = WebMidi.MIDIInput;
import MIDIOutput = WebMidi.MIDIOutput;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePageComponent implements OnInit {
  @ViewChild(IonContent, { static: false }) content!: IonContent;
  @ViewChild(PianoKeyboardComponent) private pianoKeyboard?: PianoKeyboardComponent;
  score?: vexml.Score;
  cursor1?: vexml.Cursor;
  cursor2?: vexml.Cursor;
  cursorComponent1?: vexml.SimpleCursor;
  cursorComponent2?: vexml.SimpleCursor;  
  cursorHandle1: number = 0;
  cursorHandle2: number = 0;

  // Music Sheet GUI
  isMobileLayout = false;
  checkboxStaveUp: boolean = true;
  checkboxStaveDown: boolean = true;
  checkboxAutoplay: boolean = false;
  fileLoadError: boolean = false;
  fileLoaded: boolean = false;
  running: boolean = false;
  checkboxColor: boolean = false;
  checkboxKeyboard: boolean = false;
  inputMeasure = { lower: 0, upper: 0 };
  inputMeasureRange = { lower: 0, upper: 0 };
  repeatValue: number = 0;
  repeatText: string = '0';
  repeatCfg: number = 0;
  zoomValue: number = 1;
  zoomText: string = '100%';
  speedValue: number = 1;
  speedText: string = '100%';

  // wakeLock used with Midi Input
  wakeLockObj?: WakeLockSentinel;
  wakeLockTimer?: number;

  // MIDI Devices
  midiAvailable = false;
  midiInputs: MIDIInput[] = [];
  midiOutputs: MIDIOutput[] = [];
  midiDevice = 'none';

  // Initialize maps of notes comming from MIDI Input
  mapNotesAutoPressed = new Map();

  // Play
  timePlayStart: number = 0;
  autoplaySkip: number = 0;
  tempoInBPM: number = 120;

  // Language
  lang: string = 'gb';
  // tonejs/piano
  piano: Piano;

  constructor(
    private notesService: NotesService,
    private changeRef: ChangeDetectorRef,
    public translate: TranslateService
  ) {
    // create the piano and load 1 velocity steps to reduce memory consumption
    this.piano = new Piano({
      velocities: 1,
    });
    //connect it to the speaker output
    this.piano.toDestination();

    this.piano.load();

    //Set english as default
    this.lang = 'gb';
    this.translate.setDefaultLang('gb');
    this.translate.use('gb');
  }

  ngOnInit(): void {
    // Adjust zoom for mobile devices
    if (window.innerWidth <= 991) {
      this.isMobileLayout = true;
      this.zoomValue = 0.7;
      this.zoomText = this.zoomValue * 100 + '%';
    }
    window.onresize = () => (this.isMobileLayout = window.innerWidth <= 991);
    this.midiSetup();
  }

  // GUI Language
  useLanguage(language: string): void {
    this.lang = language;
    this.translate.use(language);
  }

  // GUI Zoom
  updateZoom(qp: string): void {
    this.zoomValue = parseInt(qp) / 100;
    if (isNaN(this.zoomValue)) this.zoomValue = 1;
    if (this.zoomValue < 0.1) this.zoomValue = 0.1;
    if (this.zoomValue > 2) this.zoomValue = 2;
    this.zoomText = (this.zoomValue * 100).toFixed(0) + '%';
  }

  // GUI Play speed
  updateSpeed(qp: string): void {
    this.speedValue = parseInt(qp) / 100;
    if (isNaN(this.speedValue)) this.speedValue = 1;
    if (this.speedValue < 0.1) this.speedValue = 0.1;
    if (this.speedValue > 2) this.speedValue = 2;
    this.speedText = (this.speedValue * 100).toFixed(0) + '%';
  }

  // GUI Repeat
  updateRepeat(qp: string): void {
    this.repeatValue = parseInt(qp);
    if (isNaN(this.repeatValue)) this.repeatValue = 0;
    if (this.repeatValue < 0) this.repeatValue = 0;
    if (this.repeatValue > 100) this.repeatValue = 100;
    this.repeatText = this.repeatValue.toFixed(0);
    this.repeatValue = parseInt(this.repeatText);
  }

  // GUI Lower measure
  updateLowerMeasure(qp: string): void {
    this.inputMeasure.lower = parseInt(qp);
    if (isNaN(this.inputMeasure.lower)) {
      this.inputMeasure.lower = this.inputMeasureRange.lower;
    }
    if (this.inputMeasure.lower < this.inputMeasureRange.lower) {
      this.inputMeasure.lower = this.inputMeasureRange.lower;
    }
    // Pussh upper if required
    if (this.inputMeasure.lower > this.inputMeasure.upper) {
      if (this.inputMeasure.lower > this.inputMeasureRange.upper) {
        this.inputMeasure.lower = this.inputMeasureRange.upper;
      }
      this.inputMeasure.upper = this.inputMeasure.lower;
    }
  }

  // GUI Upper Measure
  updateUpperMeasure(qp: string): void {
    this.inputMeasure.upper = parseInt(qp);
    if (isNaN(this.inputMeasure.upper)) {
      this.inputMeasure.upper = this.inputMeasureRange.upper;
    }
    if (this.inputMeasure.upper > this.inputMeasureRange.upper) {
      this.inputMeasure.upper = this.inputMeasureRange.upper;
    }
    // Push lower if required
    if (this.inputMeasure.upper < this.inputMeasure.lower) {
      if (this.inputMeasure.upper < this.inputMeasureRange.lower) {
        this.inputMeasure.upper = this.inputMeasureRange.lower;
      }
      this.inputMeasure.lower = this.inputMeasure.upper;
    }
  }

  // toggle between blackWhite and Color
  vexmlColor(checked: boolean): void {
    this.checkboxColor = checked;
  }

  // Load selected file
  vexmlLoadFiles(files: Blob[]): void {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const div = document.getElementById('vexmlContainer');
      vexml.renderMXL(file, div as HTMLDivElement).then((score) => {
        this.score = score;
        this.fileLoaded = true;
        this.fileLoadError = false; // Reset error
        this.vexmlReset();
      }).catch(() => {
        this.fileLoadError = true;
      });
    }
  }

  // Load selected file
  vexmlLoadURL(url: string): void {
    // Load Music Sheet
    fetch(url)
    .then(res => res.blob()) // Gets the response and returns it as a blob
    .then(blob => {
      const div = document.getElementById('vexmlContainer');
      vexml.renderMXL(blob, div as HTMLDivElement).then((score) => {
        this.score = score;
        this.fileLoaded = true;
        this.fileLoadError = false; // Reset error
        this.vexmlReset();
      }).catch(() => {
        this.fileLoadError = true;
      });
    }).catch(() => {
      this.fileLoadError = true;
    });
  }


  vexmlEndReached(cursorId: number): boolean {
    // Check end reached
    let endReached = false;
    return endReached;
  }

  // Move cursor to next note
  vexmlCursorPlayMoveNext(): void {
    // Required to stop next calls if stop is pressed during play
    if (!this.running) return;
    // if ended reached check repeat and stat or stop
  }

  // Stop cursor
  vexmlCursorStop(): void {
    this.checkboxAutoplay = false;
    this.vexmlShowFeedback();
    if (this.cursor1) {
      this.cursor1.removeAllEventListeners();
      this.cursor1 = undefined;
    }
    if (this.cursorComponent1) {
      this.cursorComponent1.remove();
      this.cursorComponent1 = undefined;
    }
    if (this.cursor2) {
      this.cursor2.removeAllEventListeners();
      this.cursor2 = undefined;
    }
    if (this.cursorComponent2) {
      this.cursorComponent2.remove();
      this.cursorComponent2 = undefined;
    }
    this.running = false;
    this.notesService.clear();
    for (const [key] of this.mapNotesAutoPressed) {
      this.midiReleaseNote(parseInt(key) + 12);
    }
    if (this.pianoKeyboard) this.pianoKeyboard.updateNotesStatus();
  }

  // Reset selection on measures and set the cursor to the origin
  vexmlReset(): void {
    this.vexmlCursorStop();
    this.checkboxStaveUp = true;
    this.checkboxStaveDown = true;
    this.inputMeasure.lower = 1;
    this.inputMeasureRange.lower = 1;
  }

  // Play
  vexmlPlay(): void {
    this.running = true;
    this.autoplaySkip = 0;
    this.vexmlResetFeedback();
    this.checkboxAutoplay = true;
    this.repeatCfg = this.repeatValue;
    this.startFlashCount = 0;
    this.vexmlCursorStart();
  }

  startFlashCount = 0;
  // Practice
  vexmlPractice(): void {
    this.running = true;
    this.autoplaySkip = 0;
    this.vexmlResetFeedback();
    this.checkboxAutoplay = false;
    this.repeatCfg = this.repeatValue;
    this.startFlashCount = 4;
    this.vexmlCursorStart();
  }

  // Resets the cursor to the first note
  vexmlCursorStart(): void {
    this.content.scrollToTop();
    
    if (this.score === undefined) return;
    this.cursor1 = this.score.addCursor();
    // Render
    this.cursorComponent1 = vexml.SimpleCursor.render(this.score.getOverlayElement());

    // Listen
    this.cursorHandle1 = this.cursor1.addEventListener(
      'change',
      (e) => {
        if (this.cursorComponent1) {
          this.cursorComponent1.update(e.cursorRect);
        }
        // The model infers its visibility via the cursorRect. It assumes you've updated appropriately.
        if (this.cursor1 && !this.cursor1.isFullyVisible()) {
          //cursorModel.scrollIntoView(scrollBehavior);
        }
      },
      { emitBootstrapEvent: true }
    );
        // Update keyboard
    if (this.pianoKeyboard) this.pianoKeyboard.updateNotesStatus();
    this.vexmlCursorStart2();  
  }

  vexmlCursorStart2(): void {
    if (this.score === undefined) return;
    this.cursor2 = this.score.addCursor();
    // Render
    this.cursorComponent2 = vexml.SimpleCursor.render(this.score.getOverlayElement());

    // Listen
    this.cursorHandle2 = this.cursor2.addEventListener(
      'change',
      (e) => {
        console.log(e);
        this.notesService.calculateRequired(e,this.checkboxStaveUp,
          this.checkboxStaveDown);
        this.notesService.autoplayRequired(this.midiPressNote.bind(this), this.midiReleaseNote.bind(this));
        if (this.cursorComponent2) {
          this.cursorComponent2.update(e.cursorRect);
        }
        // The model infers its visibility via the cursorRect. It assumes you've updated appropriately.
        if (this.cursor1 && !this.cursor1.isFullyVisible()) {
          //cursorModel.scrollIntoView(scrollBehavior);
        }
        setTimeout(() => {
          
          if (this.cursor2) this.cursor2.next();
        }, (e.sequenceEntry.durationRange.end.ms - e.sequenceEntry.durationRange.start.ms)/this.speedValue);
      },
      { emitBootstrapEvent: true }
    );
  }

  // Remove all feedback elements
  vexmlResetFeedback(): void {
    let elems = document.getElementsByClassName('feedback');
    // Remove all elements
    while (elems.length > 0) {
      for (let i = 0; i < elems.length; i++) {
        const parent = elems[i].parentNode;
        if (parent) parent.removeChild(elems[i]);
      }
      elems = document.getElementsByClassName('feedback');
    }
  }

  // Hide all feedback elements
  vexmlHideFeedback(): void {
    document.querySelectorAll<HTMLElement>('.feedback').forEach(function (el) {
      el.style.visibility = 'hidden';
    });
  }

  // Hide all feedback elements
  vexmlShowFeedback(): void {
    document.querySelectorAll<HTMLElement>('.feedback').forEach(function (el) {
      el.style.visibility = 'visible';
    });
  }

  // Present feedback text at cursor location
  vexmlTextFeedback(text: string, x: number, y: number): void {
    const id =
      (document.getElementById('cursorImg-0')?.style.top ?? '') +
      x +
      '_' +
      (document.getElementById('cursorImg-0')?.style.left ?? '') +
      y +
      '_' +
      this.repeatValue;
    const feedbackElementId = `feedback-${id}`;
    // find unique id in document
    if (document.getElementById(feedbackElementId)) {
      //const elem: HTMLElement = document.getElementById(feedbackElementId)
      //elem.innerHTML += text;
    } else {
      const elem: HTMLElement = document.createElement('p');
      elem.id = feedbackElementId;
      elem.className = 'feedback r' + this.repeatValue;
      elem.style.position = 'absolute';
      elem.style.zIndex = '-1';
      elem.innerHTML = text;
      const parent = document.getElementById('vexmlCanvasPage1');
      if (parent) parent.appendChild(elem);
      elem.style.top = parseInt(document.getElementById('cursorImg-0')?.style.top ?? '') - 40 - y + 'px';
      elem.style.left = parseInt(document.getElementById('cursorImg-0')?.style.left ?? '') + x + 'px';
    }
  }

  // Initialize MIDI
  midiSetup(): void {
    navigator.requestMIDIAccess?.({ sysex: true }).then(this.midiSuccess.bind(this), () => {
      this.midiAvailable = false;
    });
  }

  // Register MIDI Inputs' handlers and outputs
  midiInitDev(access: MIDIAccess): void {
    const iterInputs = access.inputs.values();
    const inputs = [];
    for (let o = iterInputs.next(); !o.done; o = iterInputs.next()) {
      if (!o.value.name?.includes('Midi Through')) inputs.push(o.value);
    }
    this.midiDevice = 'none';

    for (let port = 0; port < inputs.length; port++) {
      this.midiDevice = inputs[port].name + ' (' + inputs[port].manufacturer + ')';
      inputs[port].onmidimessage = (event: MIDIMessageEvent) => {
        const NOTE_ON = 9;
        const NOTE_OFF = 8;
        const cmd = event.data[0] >> 4;
        // const channel = event.data[0] & 0xf;
        let pitch = 0;
        if (event.data.length > 1) pitch = event.data[1];
        let velocity = 0;
        if (event.data.length > 2) velocity = event.data[2];
        if (cmd === NOTE_OFF || (cmd === NOTE_ON && velocity === 0)) {
          this.midiNoteOff(event.timeStamp, pitch);
        } else if (cmd === NOTE_ON) {
          this.midiNoteOn(event.timeStamp, pitch);
        }
      };
    }

    const iterOutputs = access.outputs.values();
    const outputs = [];
    for (let o = iterOutputs.next(); !o.done; o = iterOutputs.next()) {
      if (!o.value.name?.includes('Midi Through')) outputs.push(o.value);
    }

    this.midiInputs = inputs;
    this.midiOutputs = outputs;
    this.changeRef.detectChanges();
  }

  // Initialize MIDI event listeners
  midiSuccess(access: MIDIAccess): void {
    this.midiAvailable = true;

    access.onstatechange = (event: MIDIConnectionEvent) => {
      this.midiInitDev(event.target as MIDIAccess);
    };

    this.midiInitDev(access);
  }

  // Press note on Ouput MIDI Device
  midiPressNote(pitch: number, velocity: number): void {
    this.mapNotesAutoPressed.set((pitch - 12).toFixed(), 1);
    const iter = this.midiOutputs.values();
    for (let o = iter.next(); !o.done; o = iter.next()) {
      o.value.send([0x90, pitch, velocity], window.performance.now());
    }
    setTimeout(() => {
      this.midiNoteOn(Date.now() - this.timePlayStart, pitch);
    }, 0);
    if (this.midiOutputs.values().next().done) {
      this.piano.keyDown({ midi: pitch });
    }
  }

  // Release note on Ouput MIDI Device
  midiReleaseNote(pitch: number): void {
    this.mapNotesAutoPressed.delete((pitch - 12).toFixed());
    const iter = this.midiOutputs.values();
    for (let o = iter.next(); !o.done; o = iter.next()) {
      o.value.send([0x80, pitch, 0x00], window.performance.now());
    }
    setTimeout(() => {
      this.midiNoteOff(Date.now() - this.timePlayStart, pitch);
    }, 0);
    if (this.midiOutputs.values().next().done) this.piano.keyUp({ midi: pitch });
  }

  // Midi input note pressed
  midiNoteOn(time: number, pitch: number /*, velocity: number*/): void {
    this.refreshWakeLock();
    const halbTone = pitch - 12;
    const name = halbTone.toFixed();
    this.notesService.press(name);

    // Key wrong pressed
    if (!this.notesService.getMapRequired().has(name)) {
      this.vexmlTextFeedback('&#x1F4A9;', 0, 20);
    }

    if (this.pianoKeyboard) this.pianoKeyboard.updateNotesStatus();
    if (this.notesService.checkRequired()) this.vexmlCursorPlayMoveNext();
  }

  // Midi input note released
  midiNoteOff(time: number, pitch: number): void {
    const halbTone = pitch - 12;
    const name = halbTone.toFixed();
    this.notesService.release(name);

    if (this.pianoKeyboard) this.pianoKeyboard.updateNotesStatus();
    if (this.notesService.checkRequired()) this.vexmlCursorPlayMoveNext();
  }

  // Refresh wakelock for two minutes
  refreshWakeLock(): void {
    if (navigator.wakeLock) {
      if (!this.wakeLockObj) {
        navigator.wakeLock.request('screen').then((wakeLock) => {
          this.wakeLockObj = wakeLock;
          this.wakeLockObj.addEventListener('release', () => {
            this.wakeLockObj = undefined;
          });
          //})
          //.catch((err) => {
          // console.log('wakelock failed to acquire: ' + err.message);
        });
      }
      // Maintain wake lock for 2 minutes
      clearTimeout(this.wakeLockTimer);
      this.wakeLockTimer = window.setTimeout(() => {
        if (this.wakeLockObj) this.wakeLockObj.release();
      }, 120000);
    }
  }
}
