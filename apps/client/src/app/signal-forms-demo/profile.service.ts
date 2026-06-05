import { Injectable } from '@angular/core';
import { delay, type Observable, of } from 'rxjs';

/**
 * Demo "remote" service for the Signal Forms page.
 *
 * It is a MOCK, but it is shaped exactly like a real one would be:
 *  - methods return `Observable`s (what `HttpClient` hands back),
 *  - latency is simulated with `delay()` so the component can show a
 *    loading state and prove the form is populated *after* the fetch.
 *
 * To make this hit a real API you only swap the bodies for the commented
 * `this.http.get/post(...)` lines — the call sites do not change.
 */

export type ColorOption = 'red' | 'green' | 'blue' | 'other';
export type OtherColor = 'purple' | 'orange' | 'pink' | 'teal';

/** The contract returned by `GET /api/profile`. */
export interface ProfileDto {
  name: string;
  surname: string;
  email: string;
  age: number;
  color: ColorOption;
  /** Only set when `color === 'other'`, otherwise `null`. */
  otherColor: OtherColor | null;
}

const MOCK_PROFILE: ProfileDto = {
  name: 'Ada',
  surname: 'Lovelace',
  email: 'ada@example.com',
  age: 36,
  color: 'other',
  otherColor: 'purple',
};

@Injectable({ providedIn: 'root' })
export class ProfileService {
  // Real app: private readonly http = inject(HttpClient);

  /** Load the saved profile that pre-populates the form. */
  loadProfile(): Observable<ProfileDto> {
    // Real: return this.http.get<ProfileDto>('/api/profile', { withCredentials: true });
    return of(MOCK_PROFILE).pipe(delay(900));
  }

  /** Persist the edited profile; returns the saved record id. */
  saveProfile(profile: ProfileDto): Observable<{ id: string }> {
    // Real: return this.http.post<{ id: string }>('/api/profile', profile, { withCredentials: true });
    return of({ id: `demo-${profile.email}` }).pipe(delay(700));
  }
}
