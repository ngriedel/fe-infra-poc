import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { cn } from '../utils/cn';
import { buttonVariants, HlmButton } from './hlm-button';

// Pure CVA / merge tests — no TestBed, no DOM, zero flake.
describe('buttonVariants', () => {
  it('maps the default variant to the primary surface', () => {
    expect(buttonVariants({ variant: 'default' })).toContain('bg-primary');
  });

  it('maps the outline variant to a border surface', () => {
    expect(buttonVariants({ variant: 'outline' })).toContain('border-border');
  });

  it('applies the default size', () => {
    expect(buttonVariants({ size: 'default' })).toContain('h-9');
  });
});

describe('cn', () => {
  it('lets the last conflicting Tailwind utility win (tailwind-merge)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

@Component({
  standalone: true,
  imports: [HlmButton],
  template: `<button hlmBtn>Go</button>`,
})
class HostComponent {}

// Host test — zoneless: flush with whenStable(), NOT fakeAsync (no zone.js).
describe('HlmButton host', () => {
  it('marks the slot and applies the computed variant classes', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('data-slot')).toBe('button');
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('h-9');
  });
});
