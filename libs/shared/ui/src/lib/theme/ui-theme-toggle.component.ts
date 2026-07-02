import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMonitor, lucideMoon, lucideSun } from '@ng-icons/lucide';
import { HlmButton } from '../button/hlm-button';
import { ThemeService, type ThemeMode } from './theme.service';

/**
 * Segmented light / system / dark theme control. Composes the helm button +
 * lucide icons and drives {@link ThemeService}. A generic, app-agnostic
 * composite → lives in shared/ui with the `ui` prefix.
 */
@Component({
  selector: 'ui-theme-toggle',
  standalone: true,
  imports: [NgIcon, HlmButton],
  providers: [provideIcons({ lucideSun, lucideMonitor, lucideMoon })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5',
    role: 'group',
    'aria-label': 'Theme',
  },
  template: `
    @for (opt of options; track opt.mode) {
      <button
        hlmBtn
        size="icon-sm"
        type="button"
        [variant]="theme.mode() === opt.mode ? 'secondary' : 'ghost'"
        [attr.aria-label]="opt.label"
        [attr.aria-pressed]="theme.mode() === opt.mode"
        (click)="theme.set(opt.mode)"
      >
        <ng-icon [name]="opt.icon" size="1rem" aria-hidden="true" />
      </button>
    }
  `,
})
export class UiThemeToggle {
  protected readonly theme = inject(ThemeService);

  protected readonly options: ReadonlyArray<{ mode: ThemeMode; icon: string; label: string }> = [
    { mode: 'light', icon: 'lucideSun', label: 'Light theme' },
    { mode: 'system', icon: 'lucideMonitor', label: 'System theme' },
    { mode: 'dark', icon: 'lucideMoon', label: 'Dark theme' },
  ];
}
