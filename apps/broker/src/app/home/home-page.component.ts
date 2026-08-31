import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { Router } from '@angular/router';
import { HlmButton, HlmTableImports } from '@aic-shared/ui';
import { AuthService } from '@aic-shared/auth';
import { brokerPoliciesResponseSchema } from '@aic-broker/contracts';

@Component({
  selector: 'broker-home-page',
  standalone: true,
  imports: [HlmButton, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="container mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-8">
      <header class="flex items-end justify-between">
        <div class="space-y-1">
          <p class="text-sm text-muted-foreground">Broker portal</p>
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
              Fetched on demand through the whole authenticated chain: Angular → broker-bff (session
              cookie, audience-checked) → ESL (identity forwarded as X-User-* headers), then parsed
              against the shared Zod contract before it reaches the template.
            </p>
          </div>
          <button hlmBtn size="sm" [disabled]="policies.isLoading()" (click)="fetchPolicies()">
            {{ policies.isLoading() ? 'Fetching…' : 'Fetch policies' }}
          </button>
        </div>

        @if (errorMessage(); as message) {
          <p
            class="rounded-md border border-error bg-error-filled px-3 py-2 text-xs text-foreground"
          >
            {{ message }}
          </p>
        }

        @if (policies.hasValue()) {
          <div hlmTableContainer class="rounded-md border border-border">
            <table hlmTable>
              <thead hlmTableHeader class="bg-muted">
                <tr hlmTableRow>
                  <th hlmTableHead>Policy</th>
                  <th hlmTableHead>Product</th>
                  <th hlmTableHead>Status</th>
                  <th hlmTableHead class="text-right">Monthly</th>
                  <th hlmTableHead>fieldA</th>
                  <th hlmTableHead>fieldK</th>
                  <th hlmTableHead>fieldL</th>
                  <th hlmTableHead>fieldM</th>
                  <th hlmTableHead>fieldN</th>
                  <th hlmTableHead>fieldO</th>
                </tr>
              </thead>
              <tbody hlmTableBody>
                @for (p of policies.value(); track p.id) {
                  <tr hlmTableRow>
                    <td hlmTableCell class="font-mono text-xs">{{ p.id }}</td>
                    <td hlmTableCell>{{ p.product }}</td>
                    <td hlmTableCell>{{ p.status }}</td>
                    <td hlmTableCell class="text-right">R{{ p.monthlyPremium }}</td>
                    <td hlmTableCell class="font-mono text-xs">{{ p.fieldA }}</td>
                    <td hlmTableCell class="font-mono text-xs">{{ p.fieldK }}</td>
                    <td hlmTableCell class="font-mono text-xs">{{ p.fieldL }}</td>
                    <td hlmTableCell class="font-mono text-xs">{{ p.fieldM }}</td>
                    <td hlmTableCell class="font-mono text-xs">{{ p.fieldN }}</td>
                    <td hlmTableCell class="font-mono text-xs">{{ p.fieldO }}</td>
                  </tr>
                } @empty {
                  <tr hlmTableRow>
                    <td hlmTableCell colspan="10" class="py-6 text-center text-muted-foreground">
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

  /** Stays `false` until the button is clicked, which keeps the resource idle. */
  private readonly requested = signal(false);

  /**
   * The whole fetch: request, loading flag, error channel and contract validation.
   *
   * Returning `undefined` from the url function is what holds the resource in
   * `idle` — no request is issued and `value()` has nothing, so the table stays
   * hidden. `parse` runs the shared Zod schema, so a BFF that drifts from the
   * contract surfaces as an error here rather than as undefined fields in the
   * template.
   */
  protected readonly policies = httpResource(
    () => (this.requested() ? '/api/policies' : undefined),
    { parse: (raw: unknown) => brokerPoliciesResponseSchema.parse(raw).policies },
  );

  /**
   * A schema failure arrives with `statusCode() === 200` — the transport worked
   * and the payload did not match. That is worth distinguishing from a 401.
   */
  protected readonly errorMessage = computed(() => {
    if (!this.policies.error()) return null;
    const code = this.policies.statusCode();
    if (code === 401) return 'Not authenticated — your session may have expired. Sign in again.';
    if (code === 200) return 'The BFF returned data that does not match the agreed contract.';
    return `Could not reach the ESL through the BFF (HTTP ${code ?? 'no response'}).`;
  });

  protected fetchPolicies(): void {
    // First click starts it; later clicks re-run it. `reload()` is a no-op while idle.
    if (this.requested()) this.policies.reload();
    else this.requested.set(true);
  }

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
