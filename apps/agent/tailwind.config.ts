import type { Config } from 'tailwindcss';
import { createGlobPatternsForDependencies } from '@nx/angular/tailwind';
import { join } from 'node:path';
import { uiTailwindPreset } from '../../libs/shared/ui-tailwind-preset/src';

export default {
  presets: [uiTailwindPreset],
  content: [
    join(__dirname, 'src/**/*.{html,ts}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      // Per-app branding overrides go here (or via CSS vars in styles.css).
    },
  },
} satisfies Config;
