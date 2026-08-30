---
name: ux-psychology-designer
description: >-
  UX Psychology & Cognitive Laws Audit Skill (Gestalt principles, Fitts's Law, Hick's Law, Miller's Law,
  cognitive load reduction, CTA focal hierarchy, and user churn elimination).
  Use this skill for comprehensive UX audits of layouts, components, and pages before code review.
---

# UX Psychology & Cognitive Laws Audit Skill

Inspired by `Owl-Listener/designer-skills`, this skill evaluates UI layouts, interaction patterns, and cognitive workflows through the lens of psychological perception and cognitive ergonomics.

---

## 🎯 When to Invoke
- **Pre-Release UX Audit**: Before merging major UI features, layouts, or modal dialogs.
- **Workflow & Ergonomics Review**: When introducing complex multi-step workflows, popovers, or floating toolbars.
- **Churn & Drop-off Diagnostics**: When users report confusion, hesitation, or friction in navigation and prompt submission.

---

## 🧠 Core Responsibility & Evaluation Domains

### 1. Gestalt Principles of Perception
- **Law of Proximity**: Related controls (e.g. prompt input + submit + model picker) must be visually grouped closer together than unrelated elements.
- **Law of Similarity**: Interactive elements with identical affordances must share consistent visual signatures (pill buttons, badges, ghost triggers).
- **Law of Focal Point & Visual Hierarchy**: Key CTAs (Send Prompt, Approve Tool, Start Server) must possess clear visual weight over secondary actions.
- **Law of Figure-Ground & Glassmorphism Depth**: Backdrop blur layers and modals must provide sufficient elevation and separation from underlying workspace content.
- **Law of Continuity**: Information streams (chat messages, plan steps, live telemetries) must guide the eye naturally from top to bottom.

### 2. Ergonomic Laws (Fitts & Hick)
- **Fitts's Law**: Target acquisition time is a function of target distance and target size.
  - Critical buttons (Send, Stop, Confirm) must have minimum touch/click targets (≥40×40px on desktop, ≥44×44px on mobile) and be positioned near thumb/mouse rest zones.
- **Hick's Law**: Decision time increases logarithmically with the number and complexity of choices.
  - Eliminate excessive simultaneous menu options. Group model switches, permission presets, and reasoning settings into progressive disclosure menus.
- **Miller's Law & Chunking**: The human working memory holds 7 ± 2 chunks.
  - Break telemetry metrics, tool arguments, and session lists into structured, bite-sized categories.

### 3. Cognitive Load & Flow State
- **Intrinsic vs Extraneous Load**: Strip visual clutter, redundant status badges, and ambiguous iconography.
- **Feedback Immediacy**: Every user action (click, keystroke, rollback) must provide instant visual feedback (<100 ms) via micro-animations or state updates.
- **Error Prevention & Recovery**: Destructive actions (session deletion, tool rejection, server termination) must offer clear confirmations or single-click rollbacks.

---

## 📋 Standard Audit Execution Protocol

1. **Information Architecture Scan**: Map out the visual density and element count across active views (`Navbar`, `Sidebar`, `ChatArea`, `FloatingCommandBar`, `CodeEditor`).
2. **Cognitive Walkthrough**: Simulate user journeys (e.g., creating a project, sending a prompt, reviewing tool diffs, switching models, reverting a turn).
3. **Ergonomic & Distance Check**: Measure physical travel distance between common repetitive clicks.
4. **Actionable Checklist Generation**: Produce a prioritized table classifying findings by Severity (`[CRIT]`, `[WARN]`, `[OK]`), Law Violated, Affected Component, and Specific Remediation.
