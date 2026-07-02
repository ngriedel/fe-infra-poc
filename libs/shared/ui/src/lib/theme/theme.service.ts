import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

/**
 * Reactive light / dark / system theme controller.
 *
 * - `mode` is the user's choice; `'system'` follows the OS preference live.
 * - `isDark` resolves the effective theme.
 * - An effect toggles the `.dark` class on `<html>` and persists `mode` to
 *   `localStorage` under the SAME key the pre-boot no-flash script reads (see
 *   each app's `index.html`), so a reload never flashes the wrong theme.
 *
 * SSR-safe: all DOM/storage access is guarded by `isPlatformBrowser`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly media =
    this.isBrowser && typeof this.document.defaultView?.matchMedia === 'function'
      ? this.document.defaultView.matchMedia('(prefers-color-scheme: dark)')
      : null;

  private readonly systemDark = signal(this.media?.matches ?? false);

  /** The user's selected mode (persisted). */
  readonly mode = signal<ThemeMode>(this.readMode());

  /** The effective theme after resolving `'system'`. */
  readonly isDark = computed(
    () => this.mode() === 'dark' || (this.mode() === 'system' && this.systemDark()),
  );

  constructor() {
    this.media?.addEventListener('change', (e) => this.systemDark.set(e.matches));

    effect(() => {
      const dark = this.isDark();
      if (this.isBrowser) {
        this.document.documentElement.classList.toggle('dark', dark);
      }
    });

    effect(() => {
      const mode = this.mode();
      if (!this.isBrowser) return;
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // localStorage unavailable (e.g. private mode) — theme just won't persist.
      }
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  /** Flip between explicit light and dark (resolves `'system'` first). */
  toggle(): void {
    this.mode.set(this.isDark() ? 'light' : 'dark');
  }

  private readMode(): ThemeMode {
    if (!this.isBrowser) return 'system';
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
    } catch {
      return 'system';
    }
  }
}
