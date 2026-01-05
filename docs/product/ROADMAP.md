# Roadmap

> Future plans and backlog for yorutsuke-v2

## Current Status

**Version**: 2.1.0
**Last Updated**: 2026-01-03

All core features complete. See [CHANGELOG.md](./CHANGELOG.md) for version history.

## Version Summary

| Version | Status | Highlights |
|---------|--------|------------|
| v0.1.0 - v2.1.0 | ✅ Complete | Core app + Backend APIs |
| v2.2.0 | 🔄 Next | Cloud Sync |
| v3.0.0 | 📋 Planned | Payment / Subscription |

---

## Next: v2.2.0 - Cloud Sync

> Sync AI-processed results from backend to local app

### Scope

| Feature | Tier | Description |
|---------|------|-------------|
| Report Sync | T2 | Fetch AI reports from Lambda |
| Transaction Sync | T2 | Sync confirmed transactions |
| Conflict Resolution | T3 | Handle local vs cloud conflicts |

### Tasks

- [ ] Report Sync API integration
- [ ] `useReport.ts` - fetch with local cache
- [ ] Offline queue for local changes
- [ ] Sync status indicator in UI
- [ ] Conflict resolution UI

---

## Backlog

### Cloud Sync (Deferred)

**Why deferred**:
- Current local-first SQLite works for MVP
- Requires careful offline-first design
- Sync complexity needs more planning

### Multi-device Support

- [ ] Device registration API
- [ ] Data merge on login
- [ ] Device limit enforcement (by tier)

### Payment Integration (v3.0)

- [ ] Stripe integration
- [ ] Subscription management
- [ ] Tier upgrade flow
- [ ] Invoice/receipt generation

### Mobile App (Future)

- [ ] React Native or Flutter evaluation
- [ ] Shared business logic
- [ ] Camera integration for receipts

---

## Out of Scope

These are explicitly not planned:

- Real-time OCR (batch-only by design)
- Advanced analytics / ML predictions
- Multi-currency support
- Team / organization features

---

## Archived

Completed phase details: [archive/ROADMAP-v2-history.md](../archive/ROADMAP-v2-history.md)

---

## References

- Source project: `../../yorutsuke/`
- Protocol: `../../.prot/CHEATSHEET.md`
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
