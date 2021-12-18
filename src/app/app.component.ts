// [PianoPlay](https://michaelecke.com/pianoplay) - Copyright (c) 2021 Rodrigo Jorge Vilar de Linares.

import { Component, OnInit } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Platform } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  constructor(
    private metaTagService: Meta,
    private platform: Platform,
    private splashScreen: SplashScreen,
    private statusBar: StatusBar
  ) {
    this.initializeApp();
  }

  initializeApp(): void {
    this.platform.ready().then(() => {
      this.statusBar.styleDefault();
      this.splashScreen.hide();
    });
  }

  ngOnInit(): void {
    this.metaTagService.addTags([
      { name: 'keywords', content: 'MusicXML, practice piano, MIDI keyboard' },
      { name: 'description', content: 'Practice piano with MIDI and MusicXML' },
      { name: 'robots', content: 'index, follow' },
      { name: 'author', content: 'Rodrigo Jorge Vilar de Linares' },
      //{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
      //{ name: 'date', content: '2019-10-31', scheme: 'YYYY-MM-DD' },
      //{ charset: 'UTF-8' }
    ]);
  }
}
