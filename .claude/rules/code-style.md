---
paths:
  - src/**/*.{js,ts,jsx,tsx}
  - lib/**/*.{js,ts}
---
# Code Style Rules

## Naming
- Files: kebab-case (e.g., `user-service.js`)
- Variables/Functions: camelCase
- Classes/Components: PascalCase
- Constants: UPPER_SNAKE_CASE

## Functions
- Keep functions small and focused
- Prefer pure functions when possible
- Document complex logic with comments

## Error Handling
- Always handle errors explicitly
- Use try-catch for async operations
- Log errors with context
