import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** The four status treatments the Absa palette defines for elements. */
export type TransactionStatus = 'success' | 'warning' | 'error' | 'info';

/**
 * Status → utility classes.
 *
 * Written as complete literal strings rather than composed at runtime
 * (`border-${status}`), because Tailwind scans source text for class names and
 * never sees an interpolated one.
 *
 * Every entry is a SEMANTIC token from the shared theme — no hex, and no
 * `--aic-*` value read directly — so re-theming or a dark-mode swap never
 * reaches this component.
 */
const STATUS_CLASSES: Record<TransactionStatus, { accent: string; badge: string }> = {
  success: { accent: 'bg-success', badge: 'bg-success-filled text-foreground border-success' },
  warning: { accent: 'bg-warning', badge: 'bg-warning-filled text-foreground border-warning' },
  error: { accent: 'bg-error', badge: 'bg-error-filled text-foreground border-error' },
  info: { accent: 'bg-info', badge: 'bg-info-filled text-foreground border-info' },
};

/**
 * A transaction summary card.
 *
 * Exists to demonstrate the token contract in a real component: surfaces come
 * from `card`/`border`/`muted-foreground`, the status treatments from the Absa
 * element palette, and the left rule from `--app-accent` so the card visibly
 * picks up whichever portal theme is applied.
 */
@Component({
  selector: 'ui-transaction-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="relative overflow-hidden rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <!-- Portal accent rule: inherits whatever .theme-<app> set on <body>. -->
      <span class="absolute inset-y-0 left-0 w-1 bg-app-accent" aria-hidden="true"></span>

      <div class="flex items-start justify-between gap-4 pl-2">
        <div class="space-y-0.5">
          <p class="text-sm font-medium">{{ reference() }}</p>
          <p class="text-xs text-muted-foreground">{{ description() }}</p>
        </div>
        <p class="shrink-0 font-mono text-sm tabular-nums">R{{ amount() }}</p>
      </div>

      <div class="mt-3 flex items-center gap-2 pl-2">
        <span
          class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
          [class]="badgeClass()"
        >
          {{ status() }}
        </span>
        <span class="text-xs text-muted-foreground">{{ occurredOn() }}</span>
      </div>
    </article>
  `,
})
export class UiTransactionCard {
  readonly reference = input.required<string>();
  readonly description = input('');
  readonly amount = input.required<number>();
  readonly occurredOn = input('');
  readonly status = input<TransactionStatus>('info');

  protected readonly badgeClass = computed(() => STATUS_CLASSES[this.status()].badge);
}
