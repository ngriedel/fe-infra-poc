import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HlmButton, UiTransactionCard } from '@aic/shared/ui';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'client-home-page',
  standalone: true,
  imports: [HlmButton, UiTransactionCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="container mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-8">
      <header class="space-y-2">
        <p class="text-sm text-muted-foreground">Signed in as</p>
        <h1 class="text-3xl font-semibold tracking-tight">{{ auth.user()?.displayName }}</h1>
        <p class="text-sm text-muted-foreground">{{ auth.user()?.email }}</p>
      </header>

      <section class="space-y-3">
        <div class="space-y-1">
          <h2 class="text-sm font-medium">Recent activity</h2>
          <p class="text-xs text-muted-foreground">
            Shared <code class="font-mono">ui-transaction-card</code> from the UI library. Its
            surfaces, status badges and accent rule all come from design tokens — the component
            contains no colour of its own, so it re-skins with the theme.
          </p>
        </div>

        @for (t of transactions; track t.reference) {
          <ui-transaction-card
            [reference]="t.reference"
            [description]="t.description"
            [amount]="t.amount"
            [occurredOn]="t.occurredOn"
            [status]="t.status"
          />
        }
      </section>

      <div>
        <button hlmBtn variant="outline" (click)="logout()">Sign out</button>
      </div>
    </main>
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);

  /** Stub rows — enough to show each status treatment from the palette. */
  protected readonly transactions = [
    {
      reference: 'Premium — Motor Comprehensive',
      description: 'Monthly debit order',
      amount: 1195,
      occurredOn: '1 Aug 2026',
      status: 'success' as const,
    },
    {
      reference: 'Premium — Home Contents',
      description: 'Retry scheduled for 5 Aug',
      amount: 465,
      occurredOn: '1 Aug 2026',
      status: 'warning' as const,
    },
    {
      reference: 'Claim payout — CLM-4471',
      description: 'Rejected: policy lapsed',
      amount: 8200,
      occurredOn: '28 Jul 2026',
      status: 'error' as const,
    },
    {
      reference: 'Annual review',
      description: 'Cover options updated',
      amount: 0,
      occurredOn: '14 Jul 2026',
      status: 'info' as const,
    },
  ];
  private readonly router = inject(Router);

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
