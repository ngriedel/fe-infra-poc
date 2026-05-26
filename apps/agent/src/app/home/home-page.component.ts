import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HlmButtonDirective } from '@aic/shared/ui';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'agent-home-page',
  standalone: true,
  imports: [HlmButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="container mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
      <header class="flex items-end justify-between">
        <div class="space-y-1">
          <p class="text-sm text-muted-foreground">Workbench</p>
          <h1 class="text-2xl font-semibold tracking-tight">{{ auth.user()?.displayName }}</h1>
          <p class="text-xs text-muted-foreground">
            {{ auth.user()?.email }} · roles: {{ auth.user()?.roles?.join(', ') }}
          </p>
        </div>
        <button hlmBtn size="sm" variant="outline" (click)="logout()">Sign out</button>
      </header>

      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (card of cards; track card.title) {
          <article class="rounded-md border border-border bg-card p-4 text-card-foreground">
            <h3 class="text-sm font-medium">{{ card.title }}</h3>
            <p class="mt-1 text-xs text-muted-foreground">{{ card.body }}</p>
          </article>
        }
      </section>
    </main>
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly cards = [
    { title: 'Claims queue', body: 'Placeholder for the active claims list.' },
    { title: 'Policies', body: 'Search and manage customer policies.' },
    { title: 'Risk alerts', body: 'Cases flagged for review.' },
  ];

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
