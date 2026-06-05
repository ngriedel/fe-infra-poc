import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { cn } from '../utils/cn';

/** Minimal structural view of a Signal Forms field's state, for error display. */
export interface FieldErrorState {
  touched(): boolean;
  invalid(): boolean;
  errors(): readonly { readonly kind: string; readonly message?: string }[];
}
/** A Signal Forms field accessor: call it to get its current {@link FieldErrorState}. */
export type FieldErrorAccessor = () => FieldErrorState;

/**
 * Renders a single validation message for a Signal Forms field, with the project's
 * error UX baked in:
 *  - only shows once the field is **touched** (i.e. after blur), never on a clean field;
 *  - shows the **first** error (highest priority by schema declaration order);
 *  - reserves a line of height and fades via **opacity** so the layout never jumps;
 *  - holds the last message during fade-out so the text doesn't flicker away.
 */
@Component({
  selector: 'hlm-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p [class]="classes()" [class.opacity-0]="!show()" aria-live="polite">{{ message() }}</p>`,
})
export class HlmErrorComponent {
  readonly field = input.required<FieldErrorAccessor>();
  readonly userClass = input<string>('', { alias: 'class' });

  private readonly state = computed(() => this.field()());
  protected readonly show = computed(() => {
    const s = this.state();
    return s.touched() && s.invalid();
  });
  private readonly topError = computed(() => this.state().errors()[0]?.message ?? '');

  /** Held copy of the message so it stays rendered while opacity fades out. */
  protected readonly message = signal('');

  protected readonly classes = computed(() =>
    cn(
      'block min-h-4 text-xs font-medium text-destructive transition-opacity duration-150',
      this.userClass(),
    ),
  );

  constructor() {
    effect(() => {
      const m = this.topError();
      if (m) this.message.set(m);
    });
  }
}
