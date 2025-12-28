# Security Rules

## Sensitive Data

- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive config
- Avoid logging sensitive information

## File Operations

- Never execute untrusted scripts
- Confirm before deleting files
- Avoid destructive commands (rm -rf, drop, etc.)

## Dependencies

- Check package sources before installing
- Prefer well-maintained packages
- Review security advisories for dependencies

## Input Handling

- Validate and sanitize user input
- Use parameterized queries for databases
- Escape output in templates
