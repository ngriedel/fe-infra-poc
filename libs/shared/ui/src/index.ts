// utils
export { cn } from './lib/utils/cn';
export { classes } from './lib/utils/hlm';
export { provideSpartanHlm } from './lib/utils/provide-spartan-hlm';

// theme
export { ThemeService, type ThemeMode } from './lib/theme/theme.service';
export { UiThemeToggle } from './lib/theme/ui-theme-toggle.component';

// form-field
export { numberMask } from './lib/form-field/field-masks';
export { HlmInputDirective, inputVariants } from './lib/form-field/hlm-input.directive';
export { HlmLabelDirective } from './lib/form-field/hlm-label.directive';
export {
  HlmErrorComponent,
  type FieldErrorAccessor,
  type FieldErrorState,
} from './lib/form-field/hlm-error.component';
export { HlmFormFieldComponent } from './lib/form-field/hlm-form-field.component';

// button (canonical Spartan helm — brain-wired)
export {
  HlmButton,
  HlmButtonImports,
  buttonVariants,
  type ButtonVariants,
  injectBrnButtonConfig,
  provideBrnButtonConfig,
  type BrnButtonConfig,
} from './lib/button';
