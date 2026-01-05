# Frontend Test Scenarios

> **Scope**: Tauri + React client application
> **ID Prefix**: SC-xxx (Scenario Client)
>
> Lightweight test scenarios for manual and automated testing.
> Each scenario has a unique ID for tracking and issue linking.
>
> **See also**:
> - [BACKEND.md](./BACKEND.md) - Lambda, Batch Processing tests
> - [../architecture/PROGRAM_PATHS.md](../architecture/PROGRAM_PATHS.md) - Detailed code flow traces

## How to Use

- `[ ]` = Not tested
- `[x]` = Passed
- `[!]` = Failed (link to issue)
- `[-]` = Blocked / Not applicable

---

## 1. Capture Module

### 1.1 Happy Path

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-001 | Single image drop | Drop 1 image → wait | Compress → Upload → Status "uploaded" | [ ] |
| SC-002 | Multiple images drop | Drop 3 images at once | All processed sequentially | [ ] |
| SC-003 | Large image (>5MB) | Drop large JPEG | Compressed to <500KB WebP | [ ] |
| SC-004 | Small image (<100KB) | Drop small PNG | Still compressed to WebP | [ ] |

### 1.2 File Validation

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-010 | Valid formats | Drop JPG, PNG, HEIC | All accepted | [ ] |
| SC-011 | Invalid format | Drop .txt, .pdf | Rejected with message | [ ] |
| SC-012 | Corrupted image | Drop fake .jpg (text file) | Error: "Failed to open image" | [!] #45 |
| SC-013 | Zero-byte file | Drop empty file | Error handled gracefully | [ ] |

### 1.3 Duplicate Detection

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-020 | Same file twice | Drop A.jpg, then A.jpg again | Second detected as duplicate | [ ] |
| SC-021 | Same content, different name | Drop A.jpg, then B.jpg (copy) | Detected via MD5 | [ ] |
| SC-022 | Similar but different | Drop A.jpg, then A_edited.jpg | Both processed (different MD5) | [ ] |
| SC-023 | Rapid double-click | Double-click same file | Only one processed | [ ] |

---

## 2. Quota Scenarios

### 2.1 Guest User (tier: guest)

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-100 | Guest default quota | Open app (no login) | limit=30, tier=guest | [ ] |
| SC-101 | Guest expiration warning | Use for 46+ days | Show "expires in X days" | [ ] |
| SC-102 | Guest near limit | Upload 28/30 | Show remaining count | [ ] |
| SC-103 | Guest at limit | Upload 30/30, try 31st | Blocked with message | [ ] |

### 2.2 Free Tier (tier: free)

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-110 | Free tier quota | Login as free user | limit=50, no expiry warning | [ ] |
| SC-111 | Free at limit | Upload 50/50 | Blocked, suggest upgrade | [ ] |
| SC-112 | Free quota reset | Wait until midnight JST | used resets to 0 | [ ] |

### 2.3 Paid Tiers (tier: basic, pro)

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-120 | Basic tier quota | Login as basic | limit=100 | [ ] |
| SC-121 | Pro tier quota | Login as pro | limit=unlimited or 500 | [ ] |
| SC-122 | Pro features | Login as pro | API access enabled (future) | [-] |

### 2.4 Quota Persistence

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-130 | Quota survives restart | Upload 10, restart app | used=10 persisted | [!] #46 |
| SC-131 | Quota across sessions | Upload 5, close, reopen, upload 5 | Total=10 | [!] #46 |

---

## 3. Tier Transitions

### 3.1 Guest → Registered

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-200 | Register flow | Guest → Register → Verify → Login | Account created | [ ] |
| SC-201 | Data claim on login | Guest with 10 images → Login | "10 images migrated" | [!] #50 |
| SC-201a | Quota after claim | Guest 10/30 used → Login | Free user starts with 50/50 (quota reset) | [ ] |
| SC-202 | Queue continuity | Guest queue [A,B] → Login | Queue preserved or synced | [!] #50 |
| SC-203 | Local DB update | Guest → Login | images.user_id updated | [!] #48 |

### 3.2 Upgrade (Free → Paid)

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-210 | Upgrade mid-session | Free user → Complete payment | New limit shown | [!] #51 |
| SC-211 | Upgrade at limit | Free at 50/50 → Upgrade to basic | Can upload again | [ ] |
| SC-212 | Upgrade quota timing | Upgrade → Check quota | Immediate effect | [!] #51 |

### 3.3 Downgrade (Paid → Free)

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-220 | Downgrade quota | Basic (80/100 used) → Downgrade | Show 80/50 (over limit) | [ ] |
| SC-221 | Downgrade block | Downgraded, used > limit | Upload blocked until reset | [ ] |
| SC-222 | Downgrade data retention | Basic → Free | Historical data preserved | [ ] |

---

## 4. Network Scenarios

### 4.1 Offline Handling

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-300 | Start offline | Disable network → Open app | Can drop/compress locally | [ ] |
| SC-301 | Go offline mid-queue | Queue 3 images → Disconnect | Upload pauses, shows "offline" | [ ] |
| SC-302 | Reconnect resume | Offline → Reconnect | Uploads resume automatically | [ ] |
| SC-303 | Offline indicator | Disconnect network | UI shows offline status | [ ] |
| SC-304 | Offline view transactions | Disconnect → Open Ledger | Local transactions displayed | [ ] |
| SC-305 | Offline view dashboard | Disconnect → Open Dashboard | Local summary displayed | [ ] |
| SC-306 | Offline confirm transaction | Disconnect → Confirm tx | Local DB updated, sync queued | [ ] |
| SC-307 | Offline delete transaction | Disconnect → Delete tx | Local delete, sync queued | [ ] |

### 4.2 Network Instability

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-310 | Flaky connection | Simulate packet loss | Retries with backoff | [ ] |
| SC-311 | Timeout handling | Slow network (>15s) | Compression timeout error | [ ] |
| SC-312 | Upload retry | Upload fails once | Auto-retry up to 3 times | [ ] |
| SC-313 | Permanent failure | Fail 3 times | Status "failed", manual retry | [ ] |

### 4.3 Race Conditions

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-320 | Disconnect during upload | Upload → Disconnect → Fail | Stays paused, not idle | [!] #47 |
| SC-321 | Reconnect during retry | Retrying → Reconnect | Completes on reconnect | [ ] |

---

## 5. Error Recovery

### 5.1 Compression Errors

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-400 | File deleted before compress | Drop → Delete source → Wait | Error, other images continue | [!] #45 |
| SC-401 | Disk full during compress | Fill disk → Compress | Error with clear message | [ ] |
| SC-402 | Memory pressure | Low memory → Large image | Graceful degradation | [ ] |

### 5.2 Database Errors

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-410 | DB write fails | Compress OK → DB locked | Cleanup temp file | [!] #49 |
| SC-411 | DB corrupted | Corrupt SQLite → Open app | Reset DB or error | [ ] |
| SC-412 | Migration failure | Bad migration → Open app | Rollback or error | [ ] |

### 5.3 Upload Errors

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-420 | Presign URL expired | Wait >15min → Upload | Get new URL, retry | [ ] |
| SC-421 | S3 access denied | Invalid credentials | Error, don't retry | [ ] |
| SC-422 | Quota exceeded (server) | Server returns 429 | Pause queue, show message | [ ] |
| SC-423 | Service limit reached | Backend returns 503 (cost limit) | Show "Service temporarily unavailable" message | [ ] |

---

## 6. App Lifecycle

### 6.1 Startup

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-500 | Fresh install | Install → Open | DB initialized, guest mode | [ ] |
| SC-501 | Resume session | Close → Reopen | Auth restored, queue restored | [ ] |
| SC-502 | Restore pending | Crash with pending → Reopen | Pending images reprocessed | [ ] |
| SC-503 | Restore uploading | Crash during upload → Reopen | Reset to compressed, re-upload | [ ] |

### 6.2 Background/Foreground

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-510 | Background processing | Minimize app | Uploads continue | [ ] |
| SC-511 | Return from background | Minimize → Wait → Return | Queue status updated | [ ] |
| SC-512 | Long background | Background 1 hour → Return | Quota refreshed | [!] #51 |

---

## 7. Authentication

### 7.1 Login/Logout

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-600 | Login success | Enter credentials → Login | User info displayed | [ ] |
| SC-601 | Login failure | Wrong password | Error message, retry | [ ] |
| SC-602 | Logout | Click logout | Clear tokens, return to guest | [ ] |
| SC-603 | Session expiry | Wait for token expiry | Auto-refresh or re-login | [ ] |

### 7.2 Multi-device (Future)

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-610 | Same account, 2 devices | Login on device A and B | Data synced | [-] |
| SC-611 | Device limit | Exceed device limit | Block new device | [-] |

---

## 8. Data Integrity

### 8.1 ID Consistency

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-700 | ImageId unique | Drop 100 images | All have unique IDs | [ ] |
| SC-701 | TraceId tracking | Drop → Upload → Check logs | Same traceId throughout | [ ] |
| SC-702 | IntentId idempotency | Upload → Retry | Same intentId, no duplicate | [ ] |
| SC-703 | MD5 accuracy | Same image twice | Same MD5 hash | [ ] |

### 8.2 State Consistency

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-710 | Queue-DB sync | Drop → Compress → Check DB | DB matches queue | [ ] |
| SC-711 | Status transitions | Observe all transitions | Follow allowed paths only | [ ] |
| SC-712 | No orphan records | Process many images | DB clean, no orphans | [!] #49 |

---

## 9. Transaction/Ledger Module

### 9.1 Viewing Transactions

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-800 | Load transactions | Open Ledger tab | Transactions displayed by date desc | [ ] |
| SC-801 | Empty state | No transactions exist | "No entries" message shown | [ ] |
| SC-802 | Filter by year | Select different year | Only that year's transactions shown | [ ] |
| SC-803 | Filter by month | Select specific month | Only that month's transactions shown | [ ] |
| SC-804 | Full year view | Click "Full Year" | All months for selected year shown | [ ] |
| SC-805 | Filter by type | Select income/expense | Only that type shown | [ ] |
| SC-806 | Filter by category | Select sale/purchase/etc | Only that category shown | [ ] |
| SC-807 | Combined filters | Year + Month + Type | All filters applied correctly | [ ] |

### 9.2 Transaction Actions

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-810 | Confirm pending | Click confirm on pending tx | confirmedAt set, tag removed | [ ] |
| SC-811 | Delete transaction | Click delete → Confirm dialog | Transaction removed from list | [ ] |
| SC-812 | Delete cancel | Click delete → Cancel dialog | Transaction preserved | [ ] |

### 9.3 Summary Calculations

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-820 | Income total | View summary with income txs | Correct sum of income amounts | [ ] |
| SC-821 | Expense total | View summary with expense txs | Correct sum of expense amounts | [ ] |
| SC-822 | Mixed transactions | View with income + expense | Both totals calculated correctly | [ ] |
| SC-823 | Filtered summary | Filter by month | Summary reflects filtered data only | [ ] |

### 9.4 Transaction Display

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-830 | Income styling | View income transaction | Green amount with + prefix | [ ] |
| SC-831 | Expense styling | View expense transaction | Red amount with - prefix | [ ] |
| SC-832 | Pending indicator | View unconfirmed tx | "Pending" tag displayed | [ ] |
| SC-833 | Category display | View transaction | Category translated correctly | [ ] |

---

## 10. Report/Dashboard Module

### 10.1 Daily Summary

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-900 | Load dashboard | Open Dashboard tab | Today's summary displayed | [ ] |
| SC-901 | Empty day | No transactions today | Zero values shown | [ ] |
| SC-902 | Income display | Today has income | Correct income amount shown | [ ] |
| SC-903 | Expense display | Today has expenses | Correct expense amount shown | [ ] |
| SC-904 | Net profit | Today has both | Net = income - expense | [ ] |

### 10.2 Pending Items

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-910 | Pending count | Have unconfirmed txs | Count displayed correctly | [ ] |
| SC-911 | No pending | All txs confirmed | "0 pending" or hidden | [ ] |
| SC-912 | Pending action | Click pending item | Navigate to transaction | [-] |

### 10.3 Upload Status

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-920 | Queue empty | No uploads pending | "Ready" or empty state | [ ] |
| SC-921 | Queue active | Images in queue | Count and status shown | [ ] |
| SC-922 | Upload progress | Image uploading | Progress indicator visible | [ ] |

### 10.4 Report History (FR-006)

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-930 | Calendar view | Open history → View calendar | Calendar with transaction indicators | [ ] |
| SC-931 | Select past date | Click date on calendar | Show that day's report | [ ] |
| SC-932 | Monthly summary | Select month header | Show month's total income/expense | [ ] |
| SC-933 | Navigate months | Click prev/next arrows | Calendar updates to new month | [ ] |
| SC-934 | Empty date | Click date with no transactions | Show empty state for that date | [ ] |

---

## 11. Settings Module

### 11.1 Language Settings

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1000 | Switch to Japanese | Settings → Language → 日本語 | UI switches to Japanese | [ ] |
| SC-1001 | Switch to English | Settings → Language → English | UI switches to English | [ ] |
| SC-1002 | Language persists | Change language → Restart app | Language setting preserved | [ ] |
| SC-1003 | Date format | Switch language | Dates formatted per locale | [ ] |

### 11.2 Theme Settings

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1010 | Switch to dark | Settings → Theme → Dark | Dark theme applied | [ ] |
| SC-1011 | Switch to light | Settings → Theme → Light | Light theme applied | [ ] |
| SC-1012 | System theme | Settings → Theme → System | Follows OS preference | [ ] |
| SC-1013 | Theme persists | Change theme → Restart app | Theme setting preserved | [ ] |

### 11.3 Data Management

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1020 | Clear cache | Settings → Clear Cache → Confirm | Local data cleared | [ ] |
| SC-1021 | Clear cancel | Settings → Clear Cache → Cancel | Data preserved | [ ] |

---

## 12. Debug Module

### 12.1 System Info

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1100 | Display user info | Open Debug panel | User ID, email, tier shown | [ ] |
| SC-1101 | Display settings | Open Debug panel | Theme, language shown | [ ] |
| SC-1102 | Display versions | Open Debug panel | DB version, app version shown | [ ] |

### 12.2 Mock Data Seeding

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1110 | Seed default | Debug → Seed (default) | 14-35 transactions created | [ ] |
| SC-1111 | Seed empty | Debug → Seed (empty) | 0 transactions, empty state | [ ] |
| SC-1112 | Seed busy | Debug → Seed (busy) | 35-70 transactions created | [ ] |
| SC-1113 | Seed veteran | Debug → Seed (veteran) | 60-120 transactions, 30 days | [ ] |
| SC-1114 | Seed with force | Have data → Seed with force | Old data replaced | [ ] |
| SC-1115 | Seed shows in Ledger | Seed → Go to Ledger | Seeded transactions visible | [ ] |

### 12.3 Debug Logs

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1120 | View logs | Open Debug panel | Recent logs displayed | [ ] |
| SC-1121 | Log levels | Trigger info/warn/error | Different styling per level | [ ] |
| SC-1122 | Clear logs | Click Clear button | Logs panel emptied | [ ] |
| SC-1123 | Log persistence | Perform actions → Check logs | Actions logged with timestamps | [ ] |

### 12.4 Feature Flags

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1130 | Toggle verbose logging | Debug → Toggle verbose | Setting persisted | [ ] |

### 12.5 Danger Zone

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1140 | Clear localStorage | Debug → Clear → Confirm | All local data wiped, app reloads | [ ] |
| SC-1141 | Clear cancel | Debug → Clear → Cancel | Data preserved | [ ] |

---

## 13. Internationalization (i18n)

### 13.1 Translation Coverage

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1200 | All views translated | Switch to Japanese → Visit all views | No English fallback text | [ ] |
| SC-1201 | Error messages | Trigger errors in Japanese mode | Errors in Japanese | [ ] |
| SC-1202 | Category names | View transactions in Japanese | Categories translated | [ ] |
| SC-1203 | Placeholders | View empty states in Japanese | Empty messages translated | [ ] |

### 13.2 Number/Date Formatting

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1210 | Currency format | View amounts | ¥1,234 format (no decimals) | [ ] |
| SC-1211 | Date format (EN) | English mode → View dates | "Jan 5" format | [ ] |
| SC-1212 | Date format (JA) | Japanese mode → View dates | "1月5日" format | [ ] |

---

## 14. Performance (NFR)

### 14.1 Build Size (NFR-001)

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1400 | App bundle size | Run `npm run build` → Check dist | Total < 5MB | [ ] |
| SC-1401 | Tauri app size | Run `npm run tauri build` → Check .app/.exe | < 15MB (with Tauri runtime) | [ ] |

### 14.2 Compression Performance (NFR-002)

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1410 | Small image (<1MB) | Drop 500KB JPEG | Compress < 1 second | [ ] |
| SC-1411 | Medium image (1-5MB) | Drop 3MB JPEG | Compress < 2 seconds | [ ] |
| SC-1412 | Large image (>5MB) | Drop 8MB JPEG | Compress < 3 seconds | [ ] |
| SC-1413 | Batch compression | Drop 5 images at once | All complete < 10 seconds | [ ] |

### 14.3 App Responsiveness

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1420 | Cold start | Launch app from closed | Ready < 3 seconds | [ ] |
| SC-1421 | Tab switch | Click between tabs | Switch < 100ms | [ ] |
| SC-1422 | Large list scroll | Scroll 100+ transactions | Smooth 60fps | [ ] |
| SC-1423 | Filter apply | Apply date filter | Results < 200ms | [ ] |

### 14.4 Memory Usage

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1430 | Idle memory | App open, no activity | < 100MB RAM | [ ] |
| SC-1431 | After batch upload | Upload 20 images | < 200MB RAM, no leak | [ ] |
| SC-1432 | Long session | Use app for 1 hour | Memory stable, no growth | [ ] |

---

## 15. Cloud Sync (MVP3.5)

> **Scope**: Transaction confirmation writeback and data recovery

### 15.1 Confirmation Sync

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1500 | Confirm syncs to cloud | Confirm transaction → Check DynamoDB | Cloud has confirmedAt | [ ] |
| SC-1501 | Edit syncs to cloud | Edit amount → Confirm | Cloud has updated amount | [ ] |
| SC-1502 | Delete syncs to cloud | Delete transaction | Cloud marked as deleted | [ ] |
| SC-1503 | Offline confirm queued | Disconnect → Confirm tx | Sync queued, pending indicator | [ ] |
| SC-1504 | Queue processes on reconnect | Reconnect network | Queued syncs complete | [ ] |

### 15.2 Data Recovery

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1510 | New device detection | Login on new device | "Cloud data found" prompt | [ ] |
| SC-1511 | Restore confirmed data | Accept restore prompt | Confirmed txs restored to SQLite | [ ] |
| SC-1512 | Decline restore | Decline restore prompt | Start fresh, cloud data untouched | [ ] |
| SC-1513 | Restore merge | Have local + cloud data | Merged without duplicates | [ ] |

### 15.3 Conflict Resolution

| ID | Scenario | Steps | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SC-1520 | Last-write-wins | Edit same tx on two devices | Newer timestamp wins | [ ] |
| SC-1521 | Offline conflict | Edit offline → Sync → Conflict | Newer version applied | [ ] |

---

## Issue Cross-Reference

| Issue | Related Scenarios |
|-------|-------------------|
| #45 | SC-012, SC-400 |
| #46 | SC-130, SC-131 |
| #47 | SC-320 |
| #48 | SC-203 |
| #49 | SC-410, SC-712 |
| #50 | SC-201, SC-202 |
| #51 | SC-210, SC-212, SC-512 |
| #52 | SC-101 (related) |

---

## Test Environment Setup

### Mock Mode
```bash
# Enable mock mode for UI testing
VITE_USE_MOCK=true npm run dev
```

### Network Simulation
- Use browser DevTools → Network → Throttling
- Or: `networksetup -setairportpower en0 off/on` (macOS)

### Quota Testing
- Mock different tiers in `quotaApi.ts:createMockQuota()`

---

*Last updated: 2026-01-05*
