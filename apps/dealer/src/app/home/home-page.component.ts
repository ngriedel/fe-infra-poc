import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient, type HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { HlmButton } from '@aic/shared/ui';
import { AuthService } from '@aic/shared/auth';
import type { DealerPoliciesResponse, DealerPolicy } from '@aic/dealer/contracts';

@Component({
  selector: 'dealer-home-page',
  standalone: true,
  imports: [HlmButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="container mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-8">
      <header class="flex items-end justify-between">
        <div class="space-y-1">
          <p class="text-sm text-muted-foreground">Dealer portal</p>
          <h1 class="text-2xl font-semibold tracking-tight">{{ auth.user()?.displayName }}</h1>
          <p class="text-xs text-muted-foreground">
            {{ auth.user()?.email }} · roles: {{ auth.user()?.roles?.join(', ') }}
          </p>
        </div>
        <button hlmBtn size="sm" variant="outline" (click)="logout()">Sign out</button>
      </header>

      <section class="space-y-3">
        <div class="flex items-end justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-sm font-medium">Upstream policies</h2>
            <p class="text-xs text-muted-foreground">
              Fetched on demand through the whole authenticated chain: Angular → dealer-bff (session
              cookie, audience-checked) → ESL (identity forwarded as X-User-* headers).
            </p>
          </div>
          <button hlmBtn size="sm" [disabled]="loading()" (click)="fetchPolicies()">
            {{ loading() ? 'Fetching…' : 'Fetch policies' }}
          </button>
        </div>

        @if (error(); as message) {
          <p
            class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {{ message }}
          </p>
        }

        @if (policies(); as rows) {
          <div class="overflow-hidden rounded-md border border-border">
            <table class="w-full text-sm">
              <thead class="bg-muted text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">Policy</th>
                  <th class="px-3 py-2 text-left font-medium">Product</th>
                  <th class="px-3 py-2 text-left font-medium">Status</th>
                  <th class="px-3 py-2 text-right font-medium">Monthly</th>
                  <th class="px-3 py-2 text-left font-medium">fieldF</th>
                  <th class="px-3 py-2 text-left font-medium">fieldG</th>
                  <th class="px-3 py-2 text-left font-medium">fieldH</th>
                  <th class="px-3 py-2 text-left font-medium">fieldI</th>
                  <th class="px-3 py-2 text-left font-medium">fieldJ</th>
                </tr>
              </thead>
              <tbody>
                @for (p of rows; track p.id) {
                  <tr class="border-t border-border">
                    <td class="px-3 py-2 font-mono text-xs">{{ p.id }}</td>
                    <td class="px-3 py-2">{{ p.product }}</td>
                    <td class="px-3 py-2">{{ p.status }}</td>
                    <td class="px-3 py-2 text-right">R{{ p.monthlyPremium }}</td>
                    <td class="px-3 py-2 font-mono text-xs">{{ p.fieldF }}</td>
                    <td class="px-3 py-2 font-mono text-xs">{{ p.fieldG }}</td>
                    <td class="px-3 py-2 font-mono text-xs">{{ p.fieldH }}</td>
                    <td class="px-3 py-2 font-mono text-xs">{{ p.fieldI }}</td>
                    <td class="px-3 py-2 font-mono text-xs">{{ p.fieldJ }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="9" class="px-3 py-6 text-center text-muted-foreground">
                      No policies returned for this identity.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </main>
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  /** `null` until the first fetch, so the table stays hidden on load. */
  protected readonly policies = signal<DealerPolicy[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /**
   * Same-origin call via the dev proxy, so the session cookie rides along.
   * dealer-bff's `requireSession` rejects anything that isn't a dealer session
   * before it ever reaches the ESL.
   */
  protected fetchPolicies(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<DealerPoliciesResponse>('/api/policies').subscribe({
      next: (res) => {
        this.policies.set(res.policies);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(
          err.status === 401
            ? 'Not authenticated — your session may have expired. Sign in again.'
            : `Could not reach the ESL through the BFF (HTTP ${err.status}).`,
        );
        this.loading.set(false);
      },
    });
  }

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
