import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HlmButtonDirective } from '@aic/shared/ui';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'client-home-page',
  standalone: true,
  imports: [HlmButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="container mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-8">
      <header class="space-y-2">
        <p class="text-sm text-muted-foreground">Signed in as</p>
        <h1 class="text-3xl font-semibold tracking-tight">{{ auth.user()?.displayName }}</h1>
        <p class="text-sm text-muted-foreground">{{ auth.user()?.email }}</p>
      </header>

      <section class="rounded-lg border border-border bg-card p-6 text-card-foreground">
        <h2 class="font-medium">Insurance dashboard (placeholder)</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          This is where your policies, quotes and claims would live.
        </p>
      </section>

      <div>
        <button hlmBtn variant="outline" (click)="logout()">Sign out</button>
      </div>
    </main>
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
