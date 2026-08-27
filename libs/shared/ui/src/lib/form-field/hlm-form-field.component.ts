import { ChangeDetectionStrategy, Component, computed, contentChild, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { HlmErrorComponent, type FieldErrorAccessor } from './hlm-error.component';
import { HlmLabel } from '../label';

/**
 * Wraps a single form control with its label and error message, removing the
 * repeated `<label><span>…</span> + @if/@for errors` scaffold from every field.
 *
 * The projected control is discovered via `contentChild(FormField)`, so the field
 * is bound exactly once — on the input:
 *
 * ```html
 * <hlm-form-field label="Email">
 *   <input hlmInput type="email" [formField]="form.email" />
 * </hlm-form-field>
 * ```
 *
 * The label wraps the control (implicit association); errors render below via
 * {@link HlmErrorComponent}.
 */
@Component({
  selector: 'hlm-form-field',
  standalone: true,
  imports: [HlmErrorComponent, HlmLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <label class="block space-y-1.5">
      @if (label(); as l) {
        <span hlmLabel>{{ l }}</span>
      }
      <ng-content />
    </label>
    @if (field(); as f) {
      <hlm-error [field]="f" class="mt-1" />
    }
  `,
})
export class HlmFormFieldComponent {
  readonly label = input<string>('');

  private readonly control = contentChild(FormField);

  /** The bound field's state accessor, derived from the projected control. */
  protected readonly field = computed<FieldErrorAccessor | undefined>(
    () => this.control()?.state as FieldErrorAccessor | undefined,
  );
}
