import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HlmButton, HlmInput, HlmLabel } from '@aic-shared/ui';
import { AuthService } from './auth.service';

@Component({
  selector: 'client-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink, HlmButton, HlmInput, HlmLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="container mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p class="text-sm text-muted-foreground">We'll send a 6-digit code to verify your email.</p>
      </header>

      @if (step() === 'email') {
        <form (submit)="onRequest($event)" class="space-y-3">
          <label class="block space-y-1">
            <span hlmLabel>Email</span>
            <input hlmInput type="email" name="email" required [(ngModel)]="email" />
          </label>
          <button hlmBtn type="submit" class="w-full" [disabled]="busy()">
            {{ busy() ? 'Sending…' : 'Send code' }}
          </button>
        </form>
      } @else {
        <form (submit)="onVerify($event)" class="space-y-3">
          <p class="text-sm text-muted-foreground">
            Code sent to <span class="font-medium text-foreground">{{ email() }}</span
            >.
            @if (devOtp()) {
              <span class="block text-xs text-muted-foreground">
                Dev OTP: <code class="font-mono">{{ devOtp() }}</code>
              </span>
            } @else {
              <span class="block text-xs text-muted-foreground">
                Dev: read it in the Mailpit inbox at
                <a
                  href="http://localhost:8025"
                  target="_blank"
                  rel="noreferrer"
                  class="underline underline-offset-4 hover:text-foreground"
                  >localhost:8025</a
                >.
              </span>
            }
          </p>
          <label class="block space-y-1">
            <span hlmLabel>6-digit code</span>
            <input
              hlmInput
              type="text"
              name="code"
              inputmode="numeric"
              maxlength="6"
              required
              [(ngModel)]="code"
              class="text-center text-lg tracking-widest"
            />
          </label>
          <button hlmBtn type="submit" class="w-full" [disabled]="busy()">
            {{ busy() ? 'Verifying…' : 'Verify' }}
          </button>
          <button hlmBtn variant="ghost" type="button" class="w-full" (click)="resetToEmail()">
            Use a different email
          </button>
        </form>
      }

      @if (error()) {
        <p class="rounded-md border border-error bg-error-filled px-3 py-2 text-sm text-foreground">
          {{ error() }}
        </p>
      }

      <p class="text-center text-xs text-muted-foreground">
        <a routerLink="/signal-forms" class="underline underline-offset-4 hover:text-foreground"
          >View the Signal Forms demo →</a
        >
      </p>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly step = signal<'email' | 'otp'>('email');
  protected readonly email = signal('');
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly devOtp = signal<string | null>(null);
  private challengeId = '';

  async onRequest(e: Event) {
    e.preventDefault();
    this.error.set(null);
    this.busy.set(true);
    try {
      const res = await this.auth.requestMagicLink({ email: this.email() });
      this.challengeId = res.challengeId;
      this.devOtp.set(res.devOtp ?? null);
      this.step.set('otp');
    } catch (err) {
      this.error.set(this.extract(err) ?? 'Could not send the code. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  async onVerify(e: Event) {
    e.preventDefault();
    this.error.set(null);
    this.busy.set(true);
    try {
      const user = await this.auth.verifyOtp({ challengeId: this.challengeId, code: this.code() });
      if (user) this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(this.extract(err) ?? 'Invalid or expired code.');
    } finally {
      this.busy.set(false);
    }
  }

  resetToEmail() {
    this.step.set('email');
    this.code.set('');
    this.error.set(null);
  }

  private extract(err: unknown): string | null {
    if (err && typeof err === 'object' && 'error' in err) {
      const inner = (err as { error?: { message?: string } }).error;
      return inner?.message ?? null;
    }
    return null;
  }
}
