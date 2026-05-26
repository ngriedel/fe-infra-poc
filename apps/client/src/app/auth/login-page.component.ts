import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmButtonDirective } from '@aic/shared/ui';
import { AuthService } from './auth.service';

@Component({
  selector: 'client-login-page',
  standalone: true,
  imports: [FormsModule, HlmButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="container mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p class="text-sm text-muted-foreground">
          We'll send a 6-digit code to verify your email.
        </p>
      </header>

      @if (step() === 'email') {
        <form (submit)="onRequest($event)" class="space-y-3">
          <label class="block space-y-1">
            <span class="text-sm font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              [(ngModel)]="email"
              class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                     ring-offset-background placeholder:text-muted-foreground
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </label>
          <button hlmBtn type="submit" class="w-full" [disabled]="busy()">
            {{ busy() ? 'Sending…' : 'Send code' }}
          </button>
        </form>
      } @else {
        <form (submit)="onVerify($event)" class="space-y-3">
          <p class="text-sm text-muted-foreground">
            Code sent to <span class="font-medium text-foreground">{{ email() }}</span>.
            @if (devOtp()) {
              <span class="block text-xs text-amber-600">
                Dev OTP: <code class="font-mono">{{ devOtp() }}</code>
              </span>
            }
          </p>
          <label class="block space-y-1">
            <span class="text-sm font-medium">6-digit code</span>
            <input
              type="text"
              name="code"
              inputmode="numeric"
              maxlength="6"
              required
              [(ngModel)]="code"
              class="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg tracking-widest"
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
        <p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{{ error() }}</p>
      }
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
