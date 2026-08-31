import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HlmButton } from '@aic-shared/ui';
import { AuthService } from '@aic-shared/auth';

@Component({
  selector: 'dealer-login-page',
  standalone: true,
  imports: [HlmButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="container mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">Dealer portal</h1>
        <p class="text-sm text-muted-foreground">Sign in with your dealer account.</p>
      </header>

      <button hlmBtn class="w-full" (click)="auth.beginLogin('/')">Sign in</button>

      <p class="text-xs text-muted-foreground">
        You'll be taken to a secure page to enter your email and password. Accounts are issued by
        AIC — there is no self-service sign-up.
      </p>
    </main>
  `,
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
}
