# Website Design & Implementation Rules

Standing rules for any website or web app work in this project. Section 3 is non-negotiable. Sections 5–9 are defaults — follow them unless the existing project already has an established convention (see Section 2) or the user explicitly asks for something different. Section 10 is optional, lowest priority.

## 1. Priorities

When defaults conflict, resolve in this order:

1. Content integrity & correctness
2. Usability & accessibility
3. Consistency with the existing project
4. Responsive behavior
5. Performance
6. Visual polish

## 2. Before You Start

- Inspect the existing stack, components, design tokens, and content before changing anything.
- Identify the page's primary audience and primary user action (what does "done" look like for a visitor?).
- Preserve existing functional behavior unless the user requests otherwise.
- Reuse existing components and design tokens before creating new ones.
- Do not redesign unrelated pages or components while working on one page.
- Audit any inherited/scaffolded content for fabrication before building on it (see Section 10).
- When requirements are incomplete, make conservative, reversible decisions rather than guessing big.
- **Existing project conventions override the defaults in this document** unless they create a clear accessibility, usability, or performance problem. Don't introduce a second design system into an established codebase.

## 3. Non-Negotiable Requirements

- No fabricated content, stats, testimonials, credentials, or structured data (Section 10).
- WCAG 2.2 AA compliance (thresholds in Section 6).
- Semantic HTML before ARIA.
- Usable at all breakpoints, mobile included.
- Full keyboard operability; no keyboard traps.
- Responsive images with explicit dimensions.
- No unnecessary dependencies.
- No unrelated redesigns.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

## 4. When to Ask vs. Proceed

Proceed without asking when a change is local, reversible, and consistent with the existing stack. Ask the user only when a decision would add a major dependency, alter core architecture, delete meaningful content, change business logic, or require real-world facts you don't have (actual stats, credentials, testimonials).

## 5. Layout & Navigation

- **Spacing:** base padding/margins/gaps on an 8px unit scale (4px for fine adjustments) — e.g. 4/8/16/24/32/48/64.
- **Grid:** use a consistent responsive grid. A 12-column grid suits complex desktop layouts; don't introduce one when a simpler CSS Grid/flex layout is sufficient. Keep spacing *within* a component smaller than spacing *between* components.
- **Scanning pattern:** text-heavy pages (articles, docs, search results) get scanned in an F-pattern — front-load key words in headings and first sentences. Visual, low-text pages (landing pages, heroes) get scanned in a Z-pattern — logo top-left, primary nav/CTA top-right, main CTA bottom-right.
- **Navigation:** keep it shallow and predictable. For application-style interfaces with 3–5 frequently-used destinations, a bottom tab bar can outperform a hamburger. For marketing, editorial, and portfolio sites, use a compact header/menu suited to the actual information architecture — don't impose app patterns on a five-page site.
- Provide a skip-to-main-content link as the first focusable element.
- Use breadcrumbs (visible, plus `BreadcrumbList` schema) on any site with more than one level of hierarchy.
- Prefer visual continuity (a peeking element/scroll cue) over cramming everything above the fold. Repeat primary CTAs at natural decision points, not just once at the top.

## 6. Typography

- Build a modular type scale from a 16px base using a fixed ratio (Minor/Major Third for UI-dense pages, Perfect Fourth for editorial). Size in `rem`/`em`, never `px`.
- Use `clamp()` for headline/hero sizes; keep body text on a fixed `rem` size or a narrow clamp so it never drops below 16px. Anchor any fluid term with a `rem`-relative unit, not pure `vw`.
- Constrain body text to 45–75 characters per line (~65ch default). Line-height ~1.5 for body, 1.1–1.3 for large headings. Never justify body text.
- Limit to 1–2 font families; prefer a single variable font over multiple static families. If pairing two, contrast them on purpose.
- Favor typefaces with unambiguous letterforms (distinct 1/l/I, 0/O); avoid long passages in all-caps or heavy letter-spacing.
- `font-display: swap` (or `optional`); preload only the critical above-the-fold font file.
- Typography can be a hero element (oversized headlines, expressive type) but never at the expense of the rules above.

## 7. Color & Visual Design

- Use a 60/30/10 proportion: 60% dominant/neutral, 30% secondary, 10% accent. Cap the palette at 1 primary + 1–2 accents + a neutral ramp (5–7 steps).
- Separate **brand colors** (identity) from **functional colors** (status signals). Don't let a brand color double as a status color.
- Choose a color harmony for what the page needs to communicate: complementary for one dominant CTA, analogous for calm/cohesive (needs a pulled-in accent for CTAs), split-complementary as the safest general default, triadic only for playful/creative contexts.
- Never encode information in hue alone (status dots, chart series, error/success) — pair with icon, label, pattern, or position. ~1 in 12 men have some color vision deficiency.
- Reserve fixed semantic colors (success/warning/error/info) and never reuse them for anything else. Every status color ships with an icon or text label too.
- Dark mode is a designed second palette, not an inverted filter — re-derive and re-check contrast against the dark surface; keep the same semantic tokens pointing at different values per mode.
- Motion: purposeful only (micro-interactions, state feedback), never decoration for its own sake.

## 8. Accessibility Thresholds

Reference numbers — cited elsewhere in this doc rather than repeated.

- Body text contrast: 4.5:1. Large text (18pt+/24px+, or 14pt+/18.5px+ bold): 3:1.
- UI components (borders, focus indicators, meaningful icons): 3:1 against the adjacent background.
- Touch targets: minimum 44×44px (48×48px Material), with adequate spacing between adjacent targets.
- Focus indicators: ≥2px, ≥3:1 contrast; use `:focus-visible` so it only shows for keyboard users.
- Text remains usable at 200% browser zoom without loss of content or function.
- WCAG 2.2 additions to design for: **Focus Not Obscured** (sticky headers/footers must never fully cover the focused element), **Dragging Movements** (any drag interaction needs a non-drag alternative), **Consistent Help** (a help/contact mechanism stays in the same relative position across pages).
- Forms: every input has a real `<label>` (never placeholder-as-label); errors pair `aria-invalid` with `aria-describedby` and a specific, actionable message; `aria-live="polite"` for routine updates, `aria-live="assertive"` only for urgent ones.
- Focus order follows visual/DOM order; no keyboard traps (`Esc` always releases a scoped modal/menu).
- Semantic HTML first — reach for ARIA only when no native element covers the case.
- Support screen readers, voice navigation, and switch control as first-class use cases; any hover-only or gesture-only interaction needs a keyboard/tap equivalent.
- Testing: automated scanners (axe, Lighthouse) catch roughly a third of real issues — always supplement with a manual keyboard-only pass and one real screen reader pass (NVDA/VoiceOver) before calling a page done.

## 9. Application States

Design and implement each of these explicitly wherever relevant — don't ship only the ideal-path state:

loading, empty, error, success, disabled, hover, focus, selected, skeleton (for non-trivial load times), long/overflowing text, missing images (fallback + alt text), and small vs. large datasets.

## 10. Performance

- Core Web Vitals are design constraints, not post-launch fixes. Targets at 75th percentile mobile: **LCP ≤ 2.5s**, **INP ≤ 200ms**, **CLS ≤ 0.1**.
- Images: WebP default, AVIF for high-detail photos, SVG for icons/logos. Serve responsive sizes via `srcset`/`sizes`. Set explicit `width`/`height` or `aspect-ratio` on every image. Lazy-load everything below the fold; never lazy-load the LCP image.
- Render path: defer non-critical JS, avoid render-blocking CSS. Use `preconnect`/`preload` sparingly (2–4 truly critical assets, always with `as`).
- Ship lean code; avoid unnecessary frameworks/dependencies for simple pages. Budget third-party scripts at ~100KB compressed / 200ms main-thread combined, always `async`/`defer`. Use a facade pattern for heavy embeds (chat widgets, video, maps) instead of loading them eagerly.

## 11. Content & Structure for AI/Search

- Write semantic, well-structured content parseable by both humans and LLM-based search/agents: proper heading order, landmarks, descriptive link text.
- Use structured data (JSON-LD preferred) only for fields that reflect real, visible page content — never invented ratings, review counts, or `aggregateRating`/`datePublished` values. Omit a field rather than inventing a placeholder.
- Never generate placeholder projects, case studies, or datasets just to make a page look more populated. An honest, clearly-labeled empty state beats padded content — this also risks suppressing the whole site's ranking under Google's Helpful Content system.
- For content-heavy/documentation sites, consider an `llms.txt` at the root as a token-efficient entry point for AI agents. Lower priority for a small personal/portfolio site.

## 12. Content Integrity

- Never fabricate project results, statistics, credentials, bios, testimonials, or screenshots and present them as real — including inherited scaffold/template content Claude builds on top of.
- If placeholder content is genuinely needed (scaffolding before real data exists), generate the minimum necessary and **label it visibly as sample/demo/placeholder** in the UI itself.
- Displayed counts/stats must be computed from real underlying data, not hardcoded aspirational figures.
- Images/screenshots claiming to depict a real artifact must be genuine captures or explicitly labeled as illustrations/mockups.
- Do not materially rewrite, remove, or invent user-provided content as part of a visual redesign unless explicitly requested. Improve labels/microcopy for clarity if needed, but preserve meaning.
- Before extending pre-existing content (a scaffold, template, boilerplate), audit it for fabricated data and flag that to the user separately from any structural/file questions.
- When in doubt whether something is real, verified, or invented, ask before publishing — don't guess and ship.

## 13. Avoid Generic AI Aesthetics

Unless the brief specifically calls for it, avoid: unnecessary gradients, glassmorphism, floating glow effects, oversized border radii on every element, wrapping every section in a card, excessive badges, decorative charts with no real data behind them, animation without functional purpose, and generic copy ("Unlock your potential").

## 14. Definition of Done

A page isn't complete until:

- It works at 320px, 768px, 1024px, and a wide desktop viewport with no horizontal overflow.
- All interactive elements are keyboard accessible; loading, empty, error, disabled, and success states are handled where relevant.
- Images have dimensions, meaningful alt text, and responsive sizing.
- No obvious console errors or broken links.
- Existing tests, linting, and type checks pass.
- Fabricated or placeholder content has been removed or is visibly labeled.
