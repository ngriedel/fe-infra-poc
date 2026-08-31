# Shared form-field requirements (spec)

Inventory of the old corporate field library, to be re-built on **Signal Forms**
(`@angular/forms/signals`) + the shared UI lib (`@aic-shared/ui`). Source repo is
inaccessible; this is captured from description.

**Scope (current focus):** text inputs, dropdowns (select), checkboxes.

---

## Layer 1 — Input sanitization (composable attribute directives)

Keystroke/value filters and transforms applied to a native `<input>`. In Signal
Forms these compose _next to_ `[formField]` on the same element — they sanitize the
DOM value and let the field model pick up the cleaned value (no ControlValueAccessor).

| #   | Old behaviour                                                                                                                      | Notes for new version                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | **Numeric only** — alpha chars ignored entirely                                                                                    | Digit filter on `beforeinput`/paste                                                             |
| 3   | **Named text policies** — e.g. `passport` = alphanumeric → UPPERCASE; `name` = block umlauts (server rejects them); "a few others" | One configurable directive with named presets, OR small composable directives. Preset list TBD. |
| 4   | **Trim**                                                                                                                           | Likely on blur. "Probably a better way now" — agreed; may fold into a transform.                |

Transforms seen so far: **uppercase**, **trim**, **strip disallowed chars** (umlauts),
**filter to character class** (numeric, alphanumeric).

## Layer 2 — Masks (structural formatting)

Formatting with structure + caret handling. Currently via **`@ngneat/input-mask`**
(wraps inputmask.js).

Existing masks: **number, phone, currency, alphanumeric, uppercase**
(list expected to grow in the new version).

> Note: `uppercase` and `alphanumeric` appear in BOTH layers — see "Overlaps" below.

## Layer 3 — UX behaviours

| #   | Old behaviour                                                                | Notes                                     |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------- |
| 2   | **Select-all on focus/click** — so the user can overtype without backspacing | Trivial directive: `el.select()` on focus |

---

## Overlaps / simplifications to resolve

- **uppercase**: it's a _transform_, not a structural mask. Unify as a transform (Layer 1),
  not a mask.
- **alphanumeric**: as a _filter_ (reject other chars) vs as a _mask_ (enforce length/slots)
  are different. Decide which is actually needed where.
- **trim**: a transform; doesn't need its own mechanism.

## Key architectural note (Signal Forms changes the picture)

The old lib leaned on ControlValueAccessor. Signal Forms removes CVA, and ships
**`transformedValue()`** — a native raw-UI ↔ model parse/format primitive (with parse
errors built in). Numeric/currency parse-format may be doable natively, reducing custom
code. Char-filtering/uppercase/trim are better as small input-event directives.

## Decisions made

- **Mask library = Maskito** (`@maskito/core` + `@maskito/angular` + `@maskito/kit`, v5.3.0).
  **VERIFIED** by a Playwright spike (`apps/client-e2e/src/signal-forms.spec.ts`): typing into
  `<input [maskito]="numberMask" [formField]="f">` formats with thousand separators AND syncs the
  masked value into the Signal Forms model. So `[maskito]` composes with `[formField]` — no CVA,
  no custom control. Maskito's pre/postprocessors will also cover Layer-1 transforms
  (uppercase, capitalize-words, trim, char-filter), so we do NOT need separate filter directives.
- **Masked value is a STRING.** A number/currency field stores e.g. `"1,234,567"`; extract the
  real number on submit with `maskitoParseNumber` (or bridge via `transformedValue()`).
- First preset shipped: `numberMask` in `libs/shared/ui/src/lib/form-field/field-masks.ts`.

## Remaining open decisions

2. **Text policies as presets vs directives.** One `[textPolicy]="'passport'"` directive
   with a named registry, or separate directives (`[alphanumericUpper]`, `[noUmlauts]`)?
3. **Umlaut handling.** Block on input, strip, or transliterate (ä→ae)? Old = block. Server
   constraint — confirm desired UX.
4. **Full preset list** for Layer 1 text policies and Layer 2 masks (the "few others").

## Control-type coverage

- **Text** — Layers 1 + 2 apply (sanitization + masks).
- **Dropdown (select)** — styling + error display only; no masking.
- **Checkbox** — boolean (`FormCheckboxControl` `checked`); styling + error display.
