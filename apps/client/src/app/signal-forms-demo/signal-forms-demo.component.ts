import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  FormField,
  email,
  form,
  max,
  min,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { MaskitoDirective } from '@maskito/angular';
import { HlmButtonDirective, numberMask } from '@aic/shared/ui';
import {
  type ColorOption,
  type OtherColor,
  ProfileService,
  type ProfileDto,
} from './profile.service';

/**
 * Form model. Differs slightly from {@link ProfileDto}: the dropdown and radio
 * can be in an "unselected" state (`''`) and age starts empty (`null`), which
 * is what the validators guard against.
 */
interface ProfileFormModel {
  name: string;
  surname: string;
  email: string;
  age: number | null;
  color: ColorOption | '';
  otherColor: OtherColor | '';
  /** Masked control value (string form, e.g. "1,234,567"). */
  amount: string;
}

const EMPTY_PROFILE: ProfileFormModel = {
  name: '',
  surname: '',
  email: '',
  age: null,
  color: '',
  otherColor: '',
  amount: '',
};

const OTHER_COLORS: readonly { value: OtherColor; label: string }[] = [
  { value: 'purple', label: 'Purple' },
  { value: 'orange', label: 'Orange' },
  { value: 'pink', label: 'Pink' },
  { value: 'teal', label: 'Teal' },
];

@Component({
  selector: 'client-signal-forms-demo',
  standalone: true,
  imports: [FormField, JsonPipe, RouterLink, MaskitoDirective, HlmButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .field-input {
        @apply h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
          ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2;
      }
      .field-input[aria-invalid='true'] {
        @apply border-destructive focus-visible:ring-destructive;
      }
      .field-error {
        @apply text-xs font-medium text-destructive;
      }
      .field-label {
        @apply text-sm font-medium;
      }
    `,
  ],
  template: `
    <main class="container mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <header class="space-y-1">
        <a
          routerLink="/login"
          class="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >← Back</a
        >
        <h1 class="text-2xl font-semibold tracking-tight">Signal Forms demo</h1>
        <p class="text-sm text-muted-foreground">
          A fully reactive form built on Angular’s <code>&#64;angular/forms/signals</code>. Data is
          loaded from a (mock) service, then bound two-way to the model below.
        </p>
      </header>

      @if (loading()) {
        <p class="text-sm text-muted-foreground">Loading profile from the server…</p>
      } @else {
        <form (submit)="onSubmit($event)" class="space-y-5" novalidate>
          <!-- Name -->
          <label class="block space-y-1">
            <span class="field-label">First name</span>
            <input
              type="text"
              class="field-input"
              [formField]="profileForm.name"
              [attr.aria-invalid]="isInvalid(profileForm.name)"
            />
            @if (isInvalid(profileForm.name)) {
              @for (e of profileForm.name().errors(); track e.kind) {
                <span class="field-error">{{ e.message }}</span>
              }
            }
          </label>

          <!-- Surname (with a custom validator) -->
          <label class="block space-y-1">
            <span class="field-label">Surname</span>
            <input
              type="text"
              class="field-input"
              [formField]="profileForm.surname"
              [attr.aria-invalid]="isInvalid(profileForm.surname)"
            />
            @if (isInvalid(profileForm.surname)) {
              @for (e of profileForm.surname().errors(); track e.kind) {
                <span class="field-error">{{ e.message }}</span>
              }
            }
          </label>

          <!-- Email -->
          <label class="block space-y-1">
            <span class="field-label">Email</span>
            <input
              type="email"
              class="field-input"
              [formField]="profileForm.email"
              [attr.aria-invalid]="isInvalid(profileForm.email)"
            />
            @if (isInvalid(profileForm.email)) {
              @for (e of profileForm.email().errors(); track e.kind) {
                <span class="field-error">{{ e.message }}</span>
              }
            }
          </label>

          <!-- Age -->
          <label class="block space-y-1">
            <span class="field-label">Age</span>
            <input
              type="number"
              class="field-input"
              [formField]="profileForm.age"
              [attr.aria-invalid]="isInvalid(profileForm.age)"
            />
            @if (isInvalid(profileForm.age)) {
              @for (e of profileForm.age().errors(); track e.kind) {
                <span class="field-error">{{ e.message }}</span>
              }
            }
          </label>

          <!-- SPIKE: Maskito number mask composed with [formField] -->
          <label class="block space-y-1">
            <span class="field-label">Amount (Maskito number mask)</span>
            <input
              type="text"
              inputmode="numeric"
              class="field-input"
              data-testid="amount"
              [maskito]="numberMask"
              [formField]="profileForm.amount"
            />
            <span class="text-xs text-muted-foreground">
              Type digits — grouped with commas; the model stores the masked string.
            </span>
          </label>

          <!-- Colour dropdown -->
          <label class="block space-y-1">
            <span class="field-label">Favourite colour</span>
            <select
              class="field-input"
              [formField]="profileForm.color"
              [attr.aria-invalid]="isInvalid(profileForm.color)"
            >
              <option value="" disabled>Choose a colour…</option>
              <option value="red">Red</option>
              <option value="green">Green</option>
              <option value="blue">Blue</option>
              <option value="other">Other</option>
            </select>
            @if (isInvalid(profileForm.color)) {
              @for (e of profileForm.color().errors(); track e.kind) {
                <span class="field-error">{{ e.message }}</span>
              }
            }
          </label>

          <!-- Radio: only shown (and only required) when "Other" is selected -->
          @if (profileForm.color().value() === 'other') {
            <fieldset class="space-y-2">
              <legend class="field-label">Which other colour?</legend>
              <div class="flex flex-wrap gap-4">
                @for (opt of otherColors; track opt.value) {
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      class="h-4 w-4"
                      [value]="opt.value"
                      [formField]="profileForm.otherColor"
                    />
                    {{ opt.label }}
                  </label>
                }
              </div>
              @if (isInvalid(profileForm.otherColor)) {
                @for (e of profileForm.otherColor().errors(); track e.kind) {
                  <span class="field-error">{{ e.message }}</span>
                }
              }
            </fieldset>
          }

          <div class="flex items-center gap-3 pt-2">
            <button hlmBtn type="submit" [disabled]="profileForm().submitting()">
              {{ profileForm().submitting() ? 'Saving…' : 'Save profile' }}
            </button>
            <button hlmBtn variant="outline" type="button" (click)="reload()">
              Reload from server
            </button>
            @if (savedId(); as id) {
              <span class="text-sm text-emerald-600">Saved ✓ (id: {{ id }})</span>
            }
          </div>
        </form>

        <!-- Live model preview: proves the two-way binding -->
        <section class="space-y-1">
          <h2 class="text-sm font-medium text-muted-foreground">Live model</h2>
          <pre
            class="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs"
            >{{ model() | json }}</pre
          >
          <p class="text-xs text-muted-foreground">
            Form valid: <span class="font-medium">{{ profileForm().valid() }}</span>
          </p>
        </section>
      }
    </main>
  `,
})
export class SignalFormsDemoComponent implements OnInit {
  private readonly profile = inject(ProfileService);

  protected readonly otherColors = OTHER_COLORS;
  protected readonly numberMask = numberMask;
  protected readonly loading = signal(true);
  protected readonly savedId = signal<string | null>(null);

  /** The reactive data model. Setting it (e.g. from the service) updates the form. */
  protected readonly model = signal<ProfileFormModel>(EMPTY_PROFILE);

  /** The signal form: a schema of validation rules bound to {@link model}. */
  protected readonly profileForm = form(this.model, (path) => {
    required(path.name, { message: 'Please enter your first name.' });
    minLength(path.name, 2, { message: 'First name must be at least 2 characters.' });

    required(path.surname, { message: 'Please enter your surname.' });
    // Custom validator — methodology demo: a surname may not contain digits.
    validate(path.surname, ({ value }) =>
      /\d/.test(value())
        ? { kind: 'surnameHasDigits', message: 'Surname cannot contain numbers.' }
        : null,
    );

    required(path.email, { message: 'Email is required.' });
    email(path.email, { message: 'Enter a valid email address (e.g. you@example.com).' });

    required(path.age, { message: 'Age is required.' });
    min(path.age, 18, { message: 'You must be at least 18.' });
    max(path.age, 120, { message: 'Please enter a realistic age.' });

    required(path.color, { message: 'Please choose a colour.' });

    // Conditional rule: the radio is only required when "Other" is the chosen colour.
    required(path.otherColor, {
      when: ({ valueOf }) => valueOf(path.color) === 'other',
      message: 'Please choose which other colour you mean.',
    });
  });

  ngOnInit(): void {
    void this.reload();
  }

  /** Fetch from the service and populate the form. Component → service → back. */
  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.savedId.set(null);
    try {
      const dto = await firstValueFrom(this.profile.loadProfile());
      this.model.set({ ...dto, otherColor: dto.otherColor ?? '', amount: '' });
    } finally {
      this.loading.set(false);
    }
  }

  /** Signal Forms `submit()`: marks fields touched, runs the action only if valid. */
  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.savedId.set(null);
    await submit(this.profileForm, async () => {
      const res = await firstValueFrom(this.profile.saveProfile(this.toDto(this.model())));
      this.savedId.set(res.id);
      return undefined; // no server-side validation errors to report back
    });
  }

  /** A field is only "invalid" to the user once they've interacted with it. */
  protected isInvalid(field: { (): { touched(): boolean; invalid(): boolean } }): boolean {
    return field().touched() && field().invalid();
  }

  private toDto(m: ProfileFormModel): ProfileDto {
    return {
      name: m.name,
      surname: m.surname,
      email: m.email,
      age: m.age as number,
      color: m.color as ColorOption,
      otherColor: m.color === 'other' ? (m.otherColor as OtherColor) : null,
    };
  }
}
