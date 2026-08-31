import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiThemeToggle } from '@aic-shared/ui';

@Component({
  imports: [RouterOutlet, UiThemeToggle],
  selector: 'agent-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
