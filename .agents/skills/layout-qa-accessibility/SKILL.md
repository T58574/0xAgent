---
name: layout-qa-accessibility
description: >-
  Layout QA, Pixel-Level Spacing & Accessibility (WCAG 2.1 AA/AAA) Review Skill.
  Use this skill for auditing spacing, paddings, text contrast, mobile responsiveness,
  keyboard accessibility, and design regression checks in code/markup.
---

# Layout QA & Accessibility (a11y) Review Skill

Inspired by `jakubkrehel/skills`, this skill performs meticulous pixel-level spacing checks, responsive layout audits, WCAG contrast verification, and Git diff regression analysis across UI codebases.

---

## 🎯 When to Invoke
- **Final Layout QA & Pre-Merge Code Review**: Validating alignment, paddings, and CSS class hygiene.
- **Accessibility & Contrast Verification**: Checking text, icon, and surface contrast ratios against WCAG 2.1 AA (4.5:1 for body text, 3:1 for UI components).
- **Responsive & Mobile Viewport Audit**: Verifying layout elasticity from 320px mobile screens up to 4K ultra-wide monitors.
- **Design System Regression Check**: Detecting unintentional overrides, broken CSS variables, or inconsistent border radii.

---

## 📐 Core Responsibility & Inspection Vectors

### 1. Spacing & Rhythm (Pixel Audit)
- **4px / 8px Spatial System**: Ensure consistent padding/margin scales (`p-1` = 4px, `p-2` = 8px, `p-3` = 12px, `p-4` = 16px, `p-6` = 24px).
- **Border Radii Hierarchy**: Maintain organic sci-fi geometry:
  - Base cards / Bento containers: `rounded-2xl` (16px) or `rounded-[26px]`.
  - Inner items / list items: `rounded-xl` (12px) or `rounded-lg` (8px).
  - Badges / Action pills: `rounded-full` (9999px).
- **Overflow & Clipping Safeguards**: All text containers must specify `truncate`, `break-words`, or `overflow-hidden` to prevent horizontal viewport breaking.

### 2. Accessibility (a11y) & WCAG 2.1 AA/AAA
- **Contrast Ratios**:
  - Normal text (<18pt / <14pt bold): Minimum **4.5:1** contrast against background.
  - Large text (≥18pt / ≥14pt bold) and active UI icons: Minimum **3.0:1** contrast.
  - Subdued / muted text: Minimum **3.0:1** for functional labels; avoid illegible low-opacity text (`opacity-40` or low contrast grays).
- **Touch Target Sizes**: Minimum **44×44px** on touch devices, minimum **36×36px** on desktop mouse interfaces.
- **Focus Indicators & Keyboard Nav**: Clear focus rings (`focus-visible:ring-2`) on all interactive inputs and buttons.
- **ARIA & Semantic Roles**: Explicit `type="button"`, `aria-label`, `aria-hidden` attributes on all icon buttons and overlays.

### 3. Responsive Breakpoints & Safe Areas
- **Breakpoints**:
  - `xs`: 480px (Compact Mobile)
  - `sm`: 640px (Standard Mobile / Phablet)
  - `md`: 768px (Tablet / Collapsible Sidebar threshold)
  - `lg`: 1024px (Desktop Split-view)
  - `xl`: 1280px+ (Ultra-wide workspace)
- **Safe Area Insets**: Explicit handling of `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` for mobile PWA standalone mode.

---

## 📋 Standard Audit Execution Protocol

1. **CSS & Token Verification**: Audit theme tokens in `src/index.css` across dark (`graphite`, `obsidian`, `cyber`, `matrix`) and light (`light`, `cloud_dancer`) modes.
2. **Component Markup Inspection**: Check JSX trees for missing `type="button"`, unlabeled icon buttons, and fixed-width layout traps.
3. **Viewport Stress-Testing**: Evaluate behavior under 360px, 768px, and 1440px widths.
4. **Actionable Bug-Report & Remediation**: Compile a structured table with precise component names, line numbers, WCAG criteria, and CSS patches.
