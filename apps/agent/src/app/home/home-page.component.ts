import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { HlmButton } from '@aic/shared/ui';
import { AuthService } from '@aic/shared/auth';
import type { AgentPoliciesResponse, AgentPolicy } from '@aic/agent/contracts';

@Component({
  selector: 'agent-home-page',
  standalone: true,
  imports: [HlmButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="container mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-8">
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

      <section class="space-y-3">
        <h2 class="text-sm font-medium text-muted-foreground">
          Your policies <span class="text-xs">(live from the ESL, scoped to your identity)</span>
        </h2>
        <div class="overflow-hidden rounded-md border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">Policy</th>
                <th class="px-3 py-2 text-left font-medium">Product</th>
                <th class="px-3 py-2 text-left font-medium">Status</th>
                <th class="px-3 py-2 text-right font-medium">Monthly</th>
                <th class="px-3 py-2 text-left font-medium">fieldA</th>
                <th class="px-3 py-2 text-left font-medium">fieldB</th>
                <th class="px-3 py-2 text-left font-medium">fieldC</th>
                <th class="px-3 py-2 text-left font-medium">fieldD</th>
                <th class="px-3 py-2 text-left font-medium">fieldE</th>
              </tr>
            </thead>
            <tbody>
              @for (p of policies(); track p.id) {
                <tr class="border-t border-border">
                  <td class="px-3 py-2 font-mono text-xs">{{ p.id }}</td>
                  <td class="px-3 py-2">{{ p.product }}</td>
                  <td class="px-3 py-2">{{ p.status }}</td>
                  <td class="px-3 py-2 text-right">R{{ p.monthlyPremium }}</td>
                  <td class="px-3 py-2 font-mono text-xs">{{ p.fieldA }}</td>
                  <td class="px-3 py-2 font-mono text-xs">{{ p.fieldB }}</td>
                  <td class="px-3 py-2 font-mono text-xs">{{ p.fieldC }}</td>
                  <td class="px-3 py-2 font-mono text-xs">{{ p.fieldD }}</td>
                  <td class="px-3 py-2 font-mono text-xs">{{ p.fieldE }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9" class="px-3 py-6 text-center text-muted-foreground">
                    No policies.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </main>
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  /** Policies fetched from this app's BFF (same-origin via the dev proxy). */
  protected readonly policies = toSignal(
    this.http.get<AgentPoliciesResponse>('/api/policies').pipe(
      map((r) => r.policies),
      catchError(() => of([] as AgentPolicy[])),
    ),
    { initialValue: [] as AgentPolicy[] },
  );

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
