# New User UX Walk-Through Checklist

Act as someone who has never seen this product before. No prior context.

## Landing
- [ ] Can you tell what the product does within 5 seconds?
- [ ] Is there a clear primary action (CTA)?
- [ ] Does the page load without errors?

## Navigation
- [ ] Can you reach all sections from the nav?
- [ ] Does mobile nav work (hamburger or equivalent)?
- [ ] Are there any broken links (404s)?
- [ ] Scroll-to-top available on long pages?

## Interactions
- [ ] Do all buttons produce visible feedback?
- [ ] Are disabled states clearly communicated?
- [ ] Do form inputs validate and show errors?
- [ ] Are loading states shown during async operations?

## Primary Flow (the #1 thing the app does)
- [ ] Can you complete it without instructions?
- [ ] Is there an empty state when there's no data?
- [ ] Do errors explain what went wrong + how to fix it?

## Mobile (375px)
- [ ] Layout doesn't overflow horizontally
- [ ] Tap targets are at least 44px
- [ ] Text is readable without zooming
- [ ] Nav is accessible on small screen

## Accessibility
- [ ] Images have alt text
- [ ] Buttons have labels (not just icons)
- [ ] Focus styles are visible
- [ ] Color contrast is sufficient

## Red flags (auto-critical)
- Dead button (click produces zero response)
- CSS calc with JS ternary inside string (broken layout)
- Hardcoded user data shown to new users
- No mobile nav
- Raw URLs shown as link text
