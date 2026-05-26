import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HlmButtonDirective } from '@aic/shared/ui';
import { AuthService } from './auth.service';

@Component({
  selector: 'agent-login-page',
  standalone: true,
  imports: [HlmButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="container mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">Agent workbench</h1>
        <p class="text-sm text-muted-foreground">Sign in with your corporate account.</p>
      </header>

      <button hlmBtn class="w-full" (click)="auth.beginLogin('/')">Continue with Microsoft</button>

      <p class="text-xs text-muted-foreground">
        Dev: this calls /api/auth/login which the stub provider auto-completes back to /api/auth/callback.
      </p>
    </main>
  `,
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
}
