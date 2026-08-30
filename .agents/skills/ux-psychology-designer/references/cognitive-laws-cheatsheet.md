# UX Psychology & Cognitive Laws Reference Guide

## 1. Gestalt Principles in IDE / Chat UI Design
| Principle | Definition | Application in 0xAgent |
| :--- | :--- | :--- |
| **Proximity** | Objects near each other form a perceptual group | Keep prompt input, attachment button, and send CTA within unified pill container |
| **Similarity** | Visually similar items are assumed to have similar function | Standardize badge styling across all HUDs (telemetry, tool status, model selector) |
| **Closure** | The mind completes incomplete shapes | Use subtle rounded border borders (`rounded-2xl`, `bento-card`) for glass panels |
| **Figure / Ground** | Objects stand out from their background | Ensure backdrop blur (`backdrop-blur-2xl`) cleanly separates popovers from chat text |
| **Focal Point** | Distinct elements draw immediate attention first | The primary CTA (Send / Stop / Accept Proposal) must be the most luminous element |

---

## 2. Quantitative Ergonomics (Fitts, Hick, Miller)
- **Fitts's Law ($T = a + b \log_2(2D/W)$)**:
  - Keep primary action buttons large ($W \ge 38\text{px}$) and close ($D \le 120\text{px}$) to the natural resting position.
  - Floating command bar is anchored at the bottom center to optimize for thumb reach (mobile) and bottom-screen focus.
- **Hick's Law ($T = b \log_2(n + 1)$)**:
  - Collapse fine-grained model parameters into popovers instead of exposing all 15+ knobs on main screen.
- **Miller's Law ($7 \pm 2$ chunks)**:
  - Do not render more than 5-7 top-level tabs or inline metrics without hierarchical grouping.
