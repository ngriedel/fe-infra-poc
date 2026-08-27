import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient, type HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { HlmButton, HlmTableImports } from '@aic/shared/ui';
import { AuthService } from '@aic/shared/auth';
import type { DealerPoliciesResponse, DealerPolicy } from '@aic/dealer/contracts';

@Component({
  selector: 'dealer-home-page',
  standalone: true,
  imports: [HlmButton, HlmTableImports],
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
            class="rounded-md border border-error bg-error-filled px-3 py-2 text-xs text-foreground"
          >
            {{ message }}
          </p>
        }

        @if (policies(); as rows) {
          <div hlmTableContainer class="rounded-md border border-border">
            <table hlmTable>
              <thead hlmTableHeader class="bg-muted">
                <tr hlmTableRow>
                  <th hlmTableHead>Policy</th>
                  <th hlmTableHead>Product</th>
                  <th hlmTableHead>Status</th>
                  <th hlmTableHead class="text-right">Monthly</th>
                  <th hlmTableHead>fieldF</th>
                  <th hlmTableHead>fieldG</th>
                  <th hlmTableHead>fieldH</th>
                  <th hlmTableHead>fieldI</th>
                  <th hlmTableHead>fieldJ</th>
                </tr>
              </thead>
              <tbody hlmTableBody>
                @for (p of rows; track p.id) {
                  <tr hlmTableRow>
                    <td hlmTableCell class="font-mono text-xs">{{ p.id }}</td>
                    <td hlmTableCell>{{ p.product }}</td>
                    <td hlmTableCell>{{ p.status }}</td>
                    <td hlmTableCell class="text-right">R{{ p.monthlyPremium }}</td>
                    <td hlmTableCell class="font-mono text-xs">{{ p.fieldF }}</td>
                    <td hlmTableCell class="font-mono text-xs">{{ p.fieldG }}</td>
                    <td hlmTableCell class="font-mono text-xs">{{ p.fieldH }}</td>
                    <td hlmTableCell class="font-mono text-xs">{{ p.fieldI }}</td>
                    <td hlmTableCell class="font-mono text-xs">{{ p.fieldJ }}</td>
                  </tr>
                } @empty {
                  <tr hlmTableRow>
                    <td hlmTableCell colspan="9" class="py-6 text-center text-muted-foreground">
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
