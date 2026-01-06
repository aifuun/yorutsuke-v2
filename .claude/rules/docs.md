---
paths: docs/**
---
# Documentation Rules

Files in `docs/` are **Source of Truth**. Read before coding.

## Directory Structure

| Directory | Contents |
|-----------|----------|
| `product/` | REQUIREMENTS, ROADMAP, CHANGELOG |
| `architecture/` | ARCHITECTURE, SCHEMA, INTERFACES, PROGRAM_PATHS, MOCKING |
| `design/` | COLOR (25-color palette), TYPOGRAPHY, view mockups (0-4) |
| `operations/` | DEPLOYMENT, OPERATIONS, QUOTA, LOGGING, ADMIN_PANEL |
| `planning/` | MVP_PLAN |
| `tests/` | FRONTEND, BACKEND test scenarios |
| `archive/` | Historical docs |

## Core Documents (Required)

| Document | Purpose | Content |
|----------|---------|---------|
| `product/REQUIREMENTS.md` | What to build | Features, specs, acceptance criteria |
| `architecture/ARCHITECTURE.md` | How to organize | Modules, tech stack, data flow |
| `architecture/SCHEMA.md` | Data model | Entities, relationships, constraints |

## Tauri Desktop App

| Document | Purpose |
|----------|---------|
| `design/COLOR.md` | 25-color palette with semantic tokens |
| `design/TYPOGRAPHY.md` | Font scales and text styles |
| `design/0-4 *.md` | View-specific UI specs |
| `architecture/INTERFACES.md` | IPC commands + Cloud API |

## By Product Type (Reference)

| Product Type | Additional Docs | Purpose |
|--------------|-----------------|---------|
| Desktop (Tauri) | `DESIGN.md` + `INTERFACES.md` | UI + IPC/API |
| Web Frontend | `DESIGN.md` | Components, layout, interactions |
| Backend API | `INTERFACES.md` | Endpoints, request/response, auth |
| CLI Tool | `COMMANDS.md` | Commands, arguments, output format |
| Complex Business | `DOMAIN.md` | Domain model, business rules, glossary |

## Quick Reference

| Type | REQ | ARCH | SCHEMA | DESIGN | INTERFACES | DOMAIN |
|------|:---:|:----:|:------:|:------:|:----------:|:------:|
| Desktop (Tauri) | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| Web Frontend | ✅ | ✅ | ✅ | ✅ | - | - |
| Backend API | ✅ | ✅ | ✅ | - | ✅ | - |
| CLI Tool | ✅ | ✅ | △ | - | - | - |
| Enterprise | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

✅ Required | △ Optional | - Not needed

## Guidelines

- **Read docs/ first** before implementing features
- **Update docs/** when requirements change
- **Conflicts**: docs/ wins over code comments
