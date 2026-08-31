import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideSpartanHlm } from '@aic-shared/ui';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideSpartanHlm(),
    provideRouter(appRoutes),
    provideHttpClient(), // fetch is the default backend in v22; withFetch() is deprecated
  ],
};
