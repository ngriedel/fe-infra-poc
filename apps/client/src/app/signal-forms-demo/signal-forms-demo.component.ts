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
import {
  HlmButton,
  HlmErrorComponent,
  HlmFormFieldComponent,
  HlmInputDirective,
  HlmLabelDirective,
  numberMask,
} from '@aic/shared/ui';
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
  imports: [
    FormField,
    JsonPipe,
    RouterLink,
    MaskitoDirective,
    HlmButton,
    HlmFormFieldComponent,
    HlmInputDirective,
    HlmLabelDirective,
    HlmErrorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
          <hlm-form-field label="First name">
            <input hlmInput type="text" [formField]="profileForm.name" />
          </hlm-form-field>

          <hlm-form-field label="Surname">
            <input hlmInput type="text" [formField]="profileForm.surname" />
          </hlm-form-field>

          <hlm-form-field label="Email">
            <input hlmInput type="email" [formField]="profileForm.email" />
          </hlm-form-field>

          <hlm-form-field label="Age">
            <input hlmInput type="number" [formField]="profileForm.age" />
          </hlm-form-field>

          <hlm-form-field label="Amount (Maskito number mask)">
            <input
              hlmInput
              type="text"
              inputmode="numeric"
              data-testid="amount"
              [maskito]="numberMask"
              [formField]="profileForm.amount"
            />
          </hlm-form-field>

          <hlm-form-field label="Favourite colour">
            <select hlmInput [formField]="profileForm.color">
              <option value="" disabled>Choose a colour…</option>
              <option value="red">Red</option>
              <option value="green">Green</option>
              <option value="blue">Blue</option>
              <option value="other">Other</option>
            </select>
          </hlm-form-field>

          <!-- Radio group: a fieldset reuses <hlm-error> directly for its message -->
          @if (profileForm.color().value() === 'other') {
            <fieldset class="space-y-1.5">
              <legend hlmLabel>Which other colour?</legend>
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
              <hlm-error [field]="profileForm.otherColor" />
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
          <pre class="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs">{{
            model() | json
          }}</pre>
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
