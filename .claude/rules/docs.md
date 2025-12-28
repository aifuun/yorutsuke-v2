---
paths: docs/**
---
# Documentation Rules

Files in `docs/` are **Source of Truth**. Read before coding.

## Core Documents (Required)

| Document | Purpose | Content |
|----------|---------|---------|
| `REQUIREMENTS.md` | What to build | Features, specs, acceptance criteria |
| `ARCHITECTURE.md` | How to organize | Modules, tech stack, data flow |
| `SCHEMA.md` | Data model | Entities, relationships, constraints |

## Tauri Desktop App

| Document | Purpose | Template |
|----------|---------|----------|
| `DESIGN.md` | UI/UX design system + screens | `docs/templates/DESIGN.md` |
| `INTERFACES.md` | IPC commands + Cloud API | `docs/templates/INTERFACES.md` |

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
