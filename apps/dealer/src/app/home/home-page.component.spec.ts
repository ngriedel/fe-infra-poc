import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@aic-shared/auth';
import { HomePage } from './home-page.component';

/**
 * The canonical `httpResource` behaviours, pinned.
 *
 * Angular documents the httpResource testing story by assertion rather than by
 * worked example, so this file doubles as the example for the POC: it is what
 * "typed, validated, signal-native data access" looks like under test. Each case
 * covers a property the three portal home pages now rely on.
 */
describe('HomePage — httpResource', () => {
  let http: HttpTestingController;

  const policy = {
    id: 'P-1',
    product: 'Motor',
    status: 'active',
    monthlyPremium: 499,
    fieldF: 'f',
    fieldG: 1,
    fieldH: true,
    fieldI: 'i',
    fieldJ: 2,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal(null), logout: async () => undefined } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * Two helpers, and the distinction is the whole trick.
   *
   * `tick()` runs change detection and effects synchronously — enough for the
   * resource's effect to ISSUE the request. It must not be `whenStable()` here:
   * that waits for the in-flight request, which only completes once the test
   * flushes it, so the two wait on each other and the test times out.
   *
   * `settle()` is for AFTER the flush, when nothing is in flight. The response
   * arrives through a microtask, which a synchronous tick cannot drain.
   */
  const tick = () => TestBed.tick();
  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  function mount() {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    tick();
    // `protected` members are ordinary properties at runtime.
    return fixture.componentInstance as unknown as {
      policies: {
        isLoading(): boolean;
        hasValue(): boolean;
        value(): unknown;
        error(): Error | undefined;
        statusCode(): number | undefined;
      };
      errorMessage(): string | null;
      fetchPolicies(): void;
    };
  }

  it('issues no request until asked — the url function returns undefined while idle', () => {
    const cmp = mount();
    http.expectNone('/api/policies');
    expect(cmp.policies.hasValue()).toBe(false);
    expect(cmp.policies.isLoading()).toBe(false);
  });

  it('fetches on demand and exposes the parsed value', async () => {
    const cmp = mount();
    cmp.fetchPolicies();
    tick();

    http.expectOne('/api/policies').flush({ policies: [policy] });
    await settle();

    expect(cmp.policies.hasValue()).toBe(true);
    expect(cmp.policies.value()).toEqual([policy]);
    expect(cmp.errorMessage()).toBeNull();
  });

  it('surfaces a 401 as an auth error, not a transport error', async () => {
    const cmp = mount();
    cmp.fetchPolicies();
    tick();

    http
      .expectOne('/api/policies')
      .flush({ message: 'nope' }, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(cmp.policies.error()).toBeTruthy();
    expect(cmp.policies.statusCode()).toBe(401);
    expect(cmp.errorMessage()).toContain('Not authenticated');
  });

  // The property that earns `parse` its bundle cost: contract drift is
  // distinguishable from transport failure, because the transport succeeded.
  it('turns a contract mismatch into an error while the status stays 200', async () => {
    const cmp = mount();
    cmp.fetchPolicies();
    tick();

    http.expectOne('/api/policies').flush({ policies: [{ ...policy, monthlyPremium: 'lots' }] });
    await settle();

    expect(cmp.policies.error()).toBeInstanceOf(Error);
    expect(cmp.policies.statusCode()).toBe(200);
    expect(cmp.policies.hasValue()).toBe(false);
    expect(cmp.errorMessage()).toContain('does not match the agreed contract');
  });

  it('re-runs on a second request rather than staying on the first result', async () => {
    const cmp = mount();
    cmp.fetchPolicies();
    tick();
    http.expectOne('/api/policies').flush({ policies: [policy] });
    await settle();

    cmp.fetchPolicies();
    tick();
    http.expectOne('/api/policies').flush({ policies: [{ ...policy, id: 'P-2' }] });
    await settle();

    expect(cmp.policies.value()).toEqual([{ ...policy, id: 'P-2' }]);
  });
});
