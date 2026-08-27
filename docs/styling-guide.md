# Styling & theming: a guide for new frontend developers

Everything you need to know to change how these apps **look**, without breaking
anything or annoying the design team. No Angular knowledge assumed.

If you read only one thing, read [The one rule](#1-the-one-rule).

---

## 1. The one rule

> **Never write a colour.**

Not `#AF144B`. Not `red`. Not `rgb(175, 20, 75)`. Not even the correct brand colour.

You write a **name** instead:

```html
<!-- yes -->
<button class="bg-primary text-primary-foreground">Save</button>

<!-- no -->
<button style="background: #AF144B; color: white">Save</button>
```

Both look identical today. Only the first one:

- still looks right when the brand changes,
- still looks right in dark mode,
- still looks right in a portal that themes its buttons a different colour,
- passes the automated check that runs before you can push.

Everything else in this guide follows from that rule.

---

## 2. How the colours are organised

Three layers. You will mostly live in layer 3.

```
Layer 1   The palette          #AF144B, #FF9700 …        design team owns this
             ↓
Layer 2   Semantic names       primary, border, muted    "what is it FOR"
             ↓
Layer 3   Utility classes      bg-primary, border-info   what you type
```

### Layer 1 — the palette (you do not touch this)

The official Absa colours, in
[`libs/shared/ui/src/theme.css`](../libs/shared/ui/src/theme.css). They all start
with `--aic-`:

| Group          | Tokens                                                                  |
| -------------- | ----------------------------------------------------------------------- |
| Brand          | `--aic-brand` `#AF144B`                                                 |
| Logo           | `--aic-logo` `#DC0032` — **reserved for the logo, never use it in UI**  |
| Focus          | `--aic-focus` `#AF144B`                                                 |
| Information    | `--aic-info` `#099EF3` · `--aic-info-filled` `#F5FBFF`                  |
| Success        | `--aic-success` `#3BB719` · `--aic-success-filled` `#F7FCF6`            |
| Warning        | `--aic-warning` `#FF9700` · `--aic-warning-filled` `#FFFBF5`            |
| Error          | `--aic-error` `#D32F2F` · `--aic-error-filled` `#FFF6F5`                |
| Secondary      | active `#B5B2B2` · helper `#524A4A` · filled `#F9F8F8` · line `#E3E2E2` |
| Step indicator | selected `#870A3C` · disabled `#CAC7C7`                                 |
| Autofill       | `--aic-autofill` `#FAFFBD`                                              |

Each status has two parts, and they are **not interchangeable**:

- the plain one (`--aic-warning`) is the **strong** colour — a border, an icon, a line;
- the `-filled` one (`--aic-warning-filled`) is a **pale background wash**.

Putting the strong colour behind text, or the pale one on a 1px border, will look wrong.

There is also a `-foreground` for each: the text colour that is **guaranteed readable**
on top of that colour. Use it. Section 7 explains why guessing here is dangerous.

**Changing a value in layer 1 re-skins every app at once.** That is a design decision,
not a developer one. If you need a colour that isn't here, ask design — do not add one.

### Layer 2 — semantic names

These say _what a colour is for_, not what it looks like:

| Name                             | Use it for                                |
| -------------------------------- | ----------------------------------------- |
| `background` / `foreground`      | the page and its normal text              |
| `card` / `card-foreground`       | panels sitting on the page                |
| `primary` / `primary-foreground` | main action — the button you want pressed |
| `secondary`                      | a quieter action                          |
| `muted-foreground`               | small print, helper text, captions        |
| `border` / `input`               | lines and field outlines                  |
| `ring`                           | the focus outline when tabbing            |
| `destructive`                    | delete / irreversible actions             |
| `app-accent`                     | the current portal's identity colour      |

Plus the status set: `info`, `success`, `warning`, `error` — each with `-foreground`
and `-filled`.

### Layer 3 — what you actually type

Tailwind turns every layer-2 name into classes:

```
bg-<name>        background        bg-card, bg-success-filled
text-<name>      text colour       text-muted-foreground, text-warning
border-<name>    border colour     border-info, border-border
```

So `border-warning bg-warning-filled` gives you the standard warning box, and it is
correct in light mode, dark mode, and every portal, for free.

---

## 3. The four portals and their themes

| App    | Port | Theme class     | Accent               |
| ------ | ---- | --------------- | -------------------- |
| client | 4200 | `.theme-client` | brand plum `#AF144B` |
| agent  | 4201 | `.theme-agent`  | dark plum `#870A3C`  |
| dealer | 4202 | `.theme-dealer` | orange `#FF9700`     |
| broker | 4203 | `.theme-broker` | blue `#099EF3`       |

The class is applied to `<body>` in each app's `index.html`. That's the whole mechanism:
one class on one element re-colours the entire app.

Dealer also themes its **buttons** — it is the worked example. Compare a button on
`:4202` with one on `:4203` and you'll see the difference with no component code
involved.

---

## 4. What you may theme (and what you may not)

An app may override **exactly five tokens**, in its own `styles.css`:

```
--app-accent            the portal's identity colour
--app-accent-foreground  text that sits on it
--primary               main action colour
--primary-foreground     text that sits on it
--radius                corner rounding
```

That's it. Everything else is design's.

A theme looks like this — and note it assigns a **name**, never a colour:

```css
/* apps/dealer/src/styles.css */
.theme-dealer {
  --app-accent: var(--aic-warning);
  --app-accent-foreground: var(--aic-warning-foreground);
  --primary: var(--aic-warning);
  --primary-foreground: var(--aic-warning-foreground);
}
```

### Why `var(--aic-warning)` and not `#FF9700`?

Two reasons, and the second one bites silently:

1. It proves the colour came from the official palette.
2. **Dark mode comes free.** Several palette entries change under `.dark` — the brand
   crimson lightens, for instance. Writing `var(--aic-brand)` picks that up
   automatically. Writing `#AF144B` does not, and your theme will be subtly wrong at
   night with nothing to tell you.

### This is checked automatically

Before any push, a test reads every app's `styles.css` and fails if you:

- set a token that isn't one of the five,
- write a raw colour instead of a `var(--aic-*)` reference,
- redefine a `--aic-*` palette value,
- forget to put the theme class on `<body>`.

It's not there to nag. Every one of those produces a bug that is invisible until
someone switches to dark mode or the brand changes.

---

## 5. How to make common changes

### Change one portal's accent colour

Edit that app's `styles.css`, point `--app-accent` at a different palette token. One line.

### Make one portal's buttons a different colour

Add `--primary` and `--primary-foreground` to its theme class. Copy dealer's. **Always
set the matching `-foreground`** — see section 7.

### Add a warning box to a page

```html
<p class="rounded-md border border-warning bg-warning-filled px-3 py-2 text-sm text-foreground">
  Your policy renews in 7 days.
</p>
```

No new CSS. No colours written.

### Round the corners more

`--radius` is themeable. Change it in the app's theme class; every component follows.

### Change something the whole company sees

You don't — that's layer 1. Raise it with design.

---

## 6. Dark mode

Every app has a light/dark/system toggle, top right. It adds a `dark` class to the page,
and the palette re-points itself.

**You get this for free** if you follow the one rule. `bg-card` is white in light mode
and dark grey at night without you doing anything.

**You lose it the moment you write a colour.** A hardcoded `#FFFFFF` background stays
blazing white in dark mode. This is the single most common way new developers break
things here, and it looks fine in review because reviewers usually have light mode on.

**Always check both modes before you call something done.** It takes one click.

⚠️ The dark values are our **best guess**. Design has only supplied light-mode colours so
far. If something looks off in dark mode, it may genuinely be wrong — flag it rather
than patching it locally.

---

## 7. Contrast: the trap that catches everyone

Text must be readable on its background. There's a measurable standard (WCAG), and
`4.5:1` is the pass mark for normal text.

Here's why you should never eyeball this. White text on the palette's own colours:

| Background           | White text | Verdict   |
| -------------------- | ---------- | --------- |
| orange `#FF9700`     | 2.17 : 1   | ❌ fails  |
| success `#3BB719`    | 2.63 : 1   | ❌ fails  |
| info blue `#099EF3`  | 2.92 : 1   | ❌ fails  |
| brand plum `#AF144B` | 6.94 : 1   | ✅ passes |

White looks fine on orange to most eyes on a good monitor. It is not fine, and it is a
real accessibility failure. This exact bug was in this codebase.

> **These ratios are light mode.** Dark mode re-points several palette values, so the
> same pair can land somewhere else entirely — and did. `.dark` lifted `--aic-brand`
> without re-declaring `--aic-brand-foreground`, leaving white on the lifted plum at
> **4.07 : 1** — a real AA failure on every default button in three portals, live until
> 2026-08-27. It is now `#C93F72` at **4.73 : 1**, and `palette contrast` in
> `theming-contract.spec.ts` recomputes every pair in both modes on each test run, so a
> value that drifts under 4.5 : 1 fails the build rather than shipping.

**You never have to think about it.** Every colour has a matching `-foreground` that has
already been measured:

```html
<!-- yes: measured, guaranteed readable -->
<span class="bg-warning text-warning-foreground">Overdue</span>

<!-- no: looks fine, fails the standard -->
<span class="bg-warning text-white">Overdue</span>
```

Rule of thumb: **if you set a `bg-x`, set `text-x-foreground` with it.**

---

## 8. Do and don't

### Do

- Use semantic names — `bg-primary`, not the plum colour that happens to be primary today.
- Pair `bg-x` with `text-x-foreground`.
- Check light **and** dark before you finish.
- Reuse a component from the UI library before building your own.
- Ask design for a colour that doesn't exist yet.

### Don't

- **Don't write a colour anywhere** — no hex, no `red`, no `rgb()`.
- **Don't use `--aic-*` directly in a component.** Those are the raw palette. Components
  use semantic names, so that theming can re-point them. `bg-primary` ✅, `bg-brand` in a
  button ❌.
- **Don't use the logo red `#DC0032`.** Reserved for the logo.
- **Don't use `-filled` as a strong colour or the plain one as a background.** They're
  a border/background pair.
- **Don't put styles in a component's own CSS file** if a utility class exists. Local CSS
  is invisible to theming.
- **Don't fix a dark-mode problem by hardcoding a light-mode colour.** That's how you get
  a page that's broken the other way round.
- **Don't edit `theme.css` to get your feature working.** That file re-skins four apps.

---

## 9. When something looks wrong

| Symptom                               | Almost always                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Colour ignores the portal theme       | you wrote a hex, or used `--aic-*` directly instead of a semantic name                         |
| Looks right in light, wrong in dark   | a hardcoded colour, or a local CSS override                                                    |
| Text hard to read on a coloured badge | you used `text-white` instead of `text-x-foreground`                                           |
| Class seems to do nothing             | Tailwind only sees class names written out in full — it can't see strings you build at runtime |
| Push rejected, styling test failing   | read the message; it names the token and the rule                                              |

That last one about built-up class names catches people. This does **not** work:

```ts
const cls = `border-${status}`; // Tailwind never sees "border-warning"
```

Write the full names out and pick between them.

---

## 10. Where things live

| I want to…                 | Go to                                                          |
| -------------------------- | -------------------------------------------------------------- |
| see the palette            | `libs/shared/ui/src/theme.css`                                 |
| change one portal's theme  | `apps/<app>/src/styles.css`                                    |
| see what's themeable       | `libs/shared/ui/src/lib/theme/theming-contract.ts`             |
| find a shared component    | `libs/shared/ui/src/lib/`                                      |
| see a component done right | `libs/shared/ui/src/lib/card/ui-transaction-card.component.ts` |
| understand the reasoning   | [spartan-ui-architecture.md](spartan-ui-architecture.md)       |

---

## 11. Your first change

A safe way to build the mental model in ten minutes:

1. Start the apps and open `:4202` and `:4203` side by side. Notice the coloured strip
   at the top, and that dealer's buttons are orange while broker's are crimson.
2. Open `apps/broker/src/styles.css`. Change `--app-accent` to `var(--aic-success)`.
   Watch the strip turn green — you just re-themed an app without touching a component.
3. Toggle dark mode on both. Everything still works.
4. Now break it on purpose: set `--app-accent: #00FF00`. Run
   `nx test ui`. Read the failure — that's the guard rail, and now you know what it
   sounds like.
5. Put it back.

Then go and read the top of `theme.css`. It'll make sense now.

---

**Still unsure?** Ask before you write a colour. It's a thirty-second question and a
genuinely annoying thing to unpick later.
