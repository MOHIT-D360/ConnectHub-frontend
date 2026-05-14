import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Registers <emoji-picker> custom element used in chat UI.
import 'emoji-picker-element';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
