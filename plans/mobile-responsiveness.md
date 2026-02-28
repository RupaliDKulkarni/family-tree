# Mobile Responsiveness Plan for Family Tree App

## Overview
Make the Family Tree application fully responsive for all devices (375px and up).

**8 files modified, 0 new component files** — all changes are CSS additions + touch handler additions in Canvas.tsx.

---

## 1. Pinch-to-Zoom on Canvas (`Canvas.tsx`)
- Add `onTouchStart`, `onTouchMove`, `onTouchEnd` handlers
- Track two-finger distance to calculate zoom delta
- Apply same zoom logic as `onWheel` but triggered by pinch gesture
- Prevent default browser pinch-zoom to avoid conflict

## 2. Sidebar to Bottom Tab Bar on Mobile (`Sidebar.tsx`, `Sidebar.css`)
- Add `@media (max-width: 768px)` breakpoints
- Reposition sidebar from left-column to fixed bottom bar
- Show tab icons: Trees list, Members, New Tree, Import
- Tapping a tab opens a slide-up panel with the full content (tree list, members list)
- Hide sidebar completely from the flex layout on mobile; canvas takes full width

## 3. Ribbon Toolbar — Essential Buttons + Overflow (`Canvas.css`, `Canvas.tsx`)
- On mobile (< 768px): show only Back/Forward + Zoom +/- + Add Person
- Remaining buttons (Siblings, Cousins, Full Tree, Reset Zoom) go into a "..." overflow dropdown menu
- Tree title and badges move into the overflow or hide

## 4. Floating Bottom Toolbar Responsive (`Canvas.css`)
- On mobile: use icons only (no text labels) to fit in small screens
- Ensure it sits above the bottom tab bar (adjust `bottom` offset)
- Make horizontally scrollable if still overflows

## 5. PersonSlider Full-Width on Mobile (`PersonSlider.css`)
- `@media (max-width: 768px)`: `width: 100vw` instead of `350px`
- Ensure form fields and buttons don't overflow

## 6. Modals Responsive (`NewTreeModal.css`, `ConfirmModal.css`)
- `@media (max-width: 768px)`: `min-width: auto; width: 90vw; max-width: 320px`
- Ensure modals don't overflow on small screens

## 7. Touch Interactions for Hover Features (`Canvas.tsx`)
- **Full Tree lineage**: Convert hover to tap-to-toggle. Tap a person node to show lineage lines, tap again or tap elsewhere to dismiss
- **Sidebar tree actions**: Always show edit/delete buttons on mobile instead of hover-reveal (CSS change in `Sidebar.css`)

## 8. TreeSlider Full-Width on Mobile (`TreeSlider.css`)
- Same treatment as PersonSlider: `width: 100vw` on mobile

---

## Breakpoints

| Range | Target | Behavior |
|-------|--------|----------|
| `<= 768px` | Phone / small tablet | Bottom tab bar, compact toolbar, full-width sliders |
| `769px - 1024px` | Tablet | Collapsible sidebar, full toolbar |
| `> 1024px` | Desktop | Current layout, no changes |

## Files to Modify

| File | Changes |
|------|---------|
| `Canvas.tsx` | Pinch-to-zoom handlers, overflow menu state, tap-to-toggle lineage |
| `Canvas.css` | Responsive ribbon, responsive floating toolbar, mobile canvas offset |
| `Sidebar.tsx` | Bottom tab bar mode on mobile, slide-up panels |
| `Sidebar.css` | Bottom bar positioning, tab icons, mobile panel styles |
| `PersonSlider.css` | Full-width on mobile |
| `TreeSlider.css` | Full-width on mobile |
| `NewTreeModal.css` | Responsive width |
| `ConfirmModal.css` | Responsive width |
| `index.css` | Remove sidebar-width from layout on mobile |
| `App.css` | Flex direction change on mobile |
