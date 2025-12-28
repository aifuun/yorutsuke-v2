# DESIGN.md Template

> UI/UX design - Screens and interactions

## Overview

**Product**: [Product name]
**Version**: [Version]
**Last Updated**: [Date]

## Design System

### Colors
| Name | Value | Usage |
|------|-------|-------|
| Primary | #3B82F6 | Buttons, links |
| Secondary | #6B7280 | Secondary text |
| Success | #10B981 | Success states |
| Error | #EF4444 | Error states |
| Background | #FFFFFF | Main background |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| H1 | Inter | 24px | 700 |
| H2 | Inter | 20px | 600 |
| Body | Inter | 14px | 400 |
| Caption | Inter | 12px | 400 |

### Spacing
- Base unit: 4px
- Common: 8px, 16px, 24px, 32px

## Screen Inventory

| ID | Screen | Route | Description |
|----|--------|-------|-------------|
| S-001 | Home | `/` | Dashboard |
| S-002 | Login | `/login` | Authentication |
| S-003 | Settings | `/settings` | User preferences |

## Screen Specifications

### S-001: Home

**Purpose**: Main dashboard showing [overview]

**Layout**:
```
┌─────────────────────────────────────────┐
│  Header (Logo, Nav, User Menu)          │
├─────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │ Card A  │  │ Card B  │  │ Card C  │  │
│  └─────────┘  └─────────┘  └─────────┘  │
├─────────────────────────────────────────┤
│  Main Content Area                      │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  Footer                                 │
└─────────────────────────────────────────┘
```

**Components**:
| Component | Props | Behavior |
|-----------|-------|----------|
| Header | user | Shows user menu on click |
| Card | title, value | Displays metric |

**States**:
- Loading: Skeleton cards
- Empty: "No data" message
- Error: Error banner with retry

---

### S-002: [Screen name]
...

## Interactions

### I-001: [Interaction name]
**Trigger**: [User action]
**Flow**:
1. User clicks [element]
2. System shows [feedback]
3. System navigates to [destination]

**Edge Cases**:
- If offline: [behavior]
- If error: [behavior]

## Component Library

### Button
```
Variants: primary | secondary | ghost
Sizes: sm | md | lg
States: default | hover | active | disabled | loading
```

### Input
```
Types: text | password | email | number
States: default | focus | error | disabled
Validation: inline error message
```

### Modal
```
Sizes: sm (400px) | md (600px) | lg (800px)
Behavior: ESC to close, click outside to close
```

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column |
| Tablet | 640-1024px | Two columns |
| Desktop | > 1024px | Full layout |

## Accessibility

- [ ] Color contrast ratio >= 4.5:1
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels for icons
- [ ] Focus indicators visible

## References

- [Figma/Design file link]
- [REQUIREMENTS.md](./REQUIREMENTS.md)
