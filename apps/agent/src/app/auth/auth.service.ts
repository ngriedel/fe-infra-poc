import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { SessionResponse, SessionUser } from '@aic/bff/contracts';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _user = signal<SessionUser | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  /** Refresh session state from the BFF. Returns true if signed in. */
  async refresh(): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.get<SessionResponse>('/api/auth/session', { withCredentials: true }),
      );
      this._user.set(res.user);
      return res.user !== null;
    } catch {
      this._user.set(null);
      return false;
    }
  }

  /** Full-page redirect to the BFF login (which redirects to Azure AD / stub IdP). */
  beginLogin(returnTo = '/'): void {
    const q = new URLSearchParams({ returnTo });
    window.location.assign(`/api/auth/login?${q.toString()}`);
  }

  async logout(): Promise<void> {
    await firstValueFrom(
      this.http.post<SessionResponse>('/api/auth/logout', {}, { withCredentials: true }),
    );
    this._user.set(null);
  }
}
