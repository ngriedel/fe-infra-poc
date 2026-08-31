import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  RequestMagicLinkRequest,
  RequestMagicLinkResponse,
  SessionResponse,
  SessionUser,
  VerifyOtpRequest,
} from '@aic-shared/contracts';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _user = signal<SessionUser | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  /** Refresh from the BFF. Returns true if signed in. */
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

  requestMagicLink(payload: RequestMagicLinkRequest): Promise<RequestMagicLinkResponse> {
    return firstValueFrom(
      this.http.post<RequestMagicLinkResponse>('/api/auth/request', payload, {
        withCredentials: true,
      }),
    );
  }

  async verifyOtp(payload: VerifyOtpRequest): Promise<SessionUser | null> {
    const res = await firstValueFrom(
      this.http.post<SessionResponse>('/api/auth/verify', payload, { withCredentials: true }),
    );
    this._user.set(res.user);
    return res.user;
  }

  async logout(): Promise<void> {
    await firstValueFrom(
      this.http.post<SessionResponse>('/api/auth/logout', {}, { withCredentials: true }),
    );
    this._user.set(null);
  }
}
