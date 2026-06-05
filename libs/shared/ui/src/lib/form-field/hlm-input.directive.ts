import { Directive, computed, inject, input } from '@angular/core';
import { cva } from 'class-variance-authority';
import { FormField } from '@angular/forms/signals';
import { cn } from '../utils/cn';

export const inputVariants = cva(
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background ' +
    'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
    'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
);

/**
 * Styles a native form control (`input` / `select` / `textarea`) with the shared
 * design tokens.
 *
 * When the element is also bound to a Signal Form via `[formField]`, this
 * directive injects that binding and applies the error styling automatically
 * once the field is **touched and invalid** — so the business template never has
 * to wire up `aria-invalid` or error classes by hand. Provide `[invalid]` to
 * override that automatic behaviour for non-signal-forms usage.
 */
@Directive({
  selector: 'input[hlmInput], select[hlmInput], textarea[hlmInput]',
  standalone: true,
  host: {
    '[class]': 'classes()',
    '[attr.aria-invalid]': 'showError() ? "true" : null',
  },
})
export class HlmInputDirective {
  private readonly boundField = inject(FormField, { self: true, optional: true });

  readonly userClass = input<string>('', { alias: 'class' });
  /** Manual override; when unset the error state is derived from the bound field. */
  readonly invalid = input<boolean | undefined>(undefined);

  protected readonly showError = computed(() => {
    const manual = this.invalid();
    if (manual !== undefined) return manual;
    const state = this.boundField?.state();
    return state ? state.touched() && state.invalid() : false;
  });

  protected readonly classes = computed(() =>
    cn(
      inputVariants(),
      this.showError() && 'border-destructive focus-visible:ring-destructive',
      this.userClass(),
    ),
  );
}
