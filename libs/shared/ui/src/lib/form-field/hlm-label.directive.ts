import { Directive, computed, input } from '@angular/core';
import { cn } from '../utils/cn';

/** Shared label / legend styling for form controls. */
@Directive({
  selector: '[hlmLabel]',
  standalone: true,
  host: {
    '[class]': 'classes()',
  },
})
export class HlmLabelDirective {
  readonly userClass = input<string>('', { alias: 'class' });

  protected readonly classes = computed(() =>
    cn(
      'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      this.userClass(),
    ),
  );
}
