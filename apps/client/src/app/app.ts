import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HlmButtonDirective } from '@aic/shared/ui';

@Component({
  imports: [RouterModule, HlmButtonDirective],
  selector: 'client-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = 'AIC Client';
}
