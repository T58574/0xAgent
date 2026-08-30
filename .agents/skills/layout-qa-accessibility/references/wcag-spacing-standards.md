# WCAG 2.1 & Spacing Standards Reference Guide

## 1. WCAG 2.1 Checklist for Web IDE & Chat UI
| Criterion | Level | Requirement | 0xAgent Implementation Guideline |
| :--- | :--- | :--- | :--- |
| **1.4.3 Contrast (Minimum)** | AA | Text contrast $\ge 4.5:1$ (normal), $\ge 3:1$ (large) | Verify `--theme-text` and `--theme-text-muted` against `--theme-card-bg` and `--theme-bg` |
| **1.4.11 Non-text Contrast** | AA | UI components and icons $\ge 3:1$ | Ensure icons and borders have distinct contrast against backdrop |
| **2.1.1 Keyboard Accessible** | A | All functionality operable via keyboard | Ensure Escape closes popovers, Enter sends message, Tab moves focus cleanly |
| **2.4.7 Focus Visible** | AA | Focus indicator visible on focused elements | Use `focus-visible:ring-1` or `focus-visible:ring-2` with `--theme-accent` |
| **2.5.5 Target Size** | AAA / AA | Minimum target size $\ge 44 \times 44\text{px}$ (touch) | Add padding or min-h / min-w to mobile icon buttons |
| **1.4.10 Reflow** | AA | Content reflows without loss of information down to 320px | No horizontal window scrolling; responsive drawer for sidebar |

---

## 2. Spacing Scale (4px / 8px Spatial System)
```
4px   -> p-1 / gap-1   (Micro spacing between icon and badge label)
8px   -> p-2 / gap-2   (Tight spacing inside compact pills and toolbars)
12px  -> p-3 / gap-3   (Default container inner padding)
16px  -> p-4 / gap-4   (Card paddings, dialog sections)
24px  -> p-6 / gap-6   (Modal headers, settings sections)
```
