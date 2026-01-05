# Backend Test Scenarios

> **Scope**: AWS Lambda, Batch Processing, DynamoDB, S3
> **ID Prefix**: SB-xxx (Scenario Backend)
>
> Integration test scenarios for backend services.
>
> **See also**:
> - [FRONTEND.md](./FRONTEND.md) - Client application tests
> - [../architecture/INTERFACES.md](../architecture/INTERFACES.md) - API specifications

## How to Use

- `[ ]` = Not tested
- `[x]` = Passed
- `[!]` = Failed (link to issue)
- `[-]` = Blocked / Not applicable

---

## 1. Presign Lambda

### 1.1 Happy Path

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-100 | Valid presign request | userId, imageId, contentType | S3 presigned URL returned | [ ] |
| SB-101 | URL expiration | Use URL after 15 min | 403 Forbidden | [ ] |

### 1.2 Validation

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-110 | Missing userId | No userId in request | 400 Bad Request | [ ] |
| SB-111 | Missing imageId | No imageId in request | 400 Bad Request | [ ] |
| SB-112 | Invalid contentType | contentType: "text/plain" | 400 Bad Request | [ ] |

### 1.3 Quota Enforcement

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-120 | User at quota limit | User 50/50 used | 429 + quota_exceeded message | [ ] |
| SB-121 | Guest at quota limit | Guest 30/30 used | 429 + quota_exceeded message | [ ] |
| SB-122 | Quota check failure | DynamoDB unavailable | 503 + graceful error | [ ] |

---

## 2. Batch Processing (02:00 JST)

### 2.1 Trigger & Scheduling

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-200 | Scheduled trigger | EventBridge 02:00 JST | Lambda invoked | [ ] |
| SB-201 | Manual trigger | Manual invocation | Same processing | [ ] |
| SB-202 | No pending images | Empty queue | Skip gracefully, log | [ ] |

### 2.2 Nova Lite OCR

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-210 | Clear receipt | High-quality receipt image | Extract merchant, amount, category | [ ] |
| SB-211 | Blurry receipt | Low-quality image | Low confidence score (<0.7) | [ ] |
| SB-212 | Handwritten receipt | Handwritten text | Partial extraction or needs_review | [ ] |
| SB-213 | Non-receipt image | Random photo | Rejected or marked invalid | [ ] |
| SB-214 | Multiple items | Receipt with line items | All items extracted | [ ] |

### 2.3 Transaction Creation

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-220 | Create transaction | Valid OCR result | Transaction in DynamoDB | [ ] |
| SB-221 | Duplicate prevention | Same image reprocessed | No duplicate transaction | [ ] |
| SB-222 | Category mapping | OCR category text | Mapped to valid category enum | [ ] |
| SB-223 | Currency handling | JPY amount | Stored as integer (no decimals) | [ ] |
| SB-223a | Decimal in JPY | OCR returns "1234.56" | Stored as 1234 (floor, no decimals) | [ ] |

### 2.4 Error Handling

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-230 | S3 image not found | Deleted image | Skip, log error, continue | [ ] |
| SB-231 | Nova Lite timeout | Slow response | Retry with backoff | [ ] |
| SB-232 | Nova Lite failure | API error | Mark as failed, continue batch | [ ] |
| SB-233 | DynamoDB write failure | DB unavailable | Retry, then fail gracefully | [ ] |

### 2.5 Partial Failure Recovery

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-240 | OCR success, DB failure | Nova Lite OK, DynamoDB fails | Retry uses cached OCR result (no extra cost) | [ ] |
| SB-241 | Batch boundary race | Upload at 01:59, batch at 02:00 | Included in current batch | [ ] |

---

## 3. Cost Control

### 3.1 Daily Budget Limits

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-300 | Under budget | ¥500/¥1000 spent | Normal operation | [ ] |
| SB-301 | Approaching limit | ¥900/¥1000 spent | Warning logged | [ ] |
| SB-302 | At limit | ¥1000/¥1000 spent | Hard stop, 503 response | [ ] |
| SB-303 | Budget reset | New day (JST) | Counter reset to 0 | [ ] |

### 3.2 Per-User Quotas

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-310 | Guest quota | Guest user | 30 images/day limit | [ ] |
| SB-311 | Free quota | Free tier user | 50 images/day limit | [ ] |
| SB-312 | Basic quota | Basic tier user | 100 images/day limit | [ ] |
| SB-313 | Pro quota | Pro tier user | 500 images/day limit | [ ] |
| SB-314 | Quota reset timing | Midnight JST | User quota reset | [ ] |

---

## 4. Data Lifecycle

### 4.1 S3 Image Management

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-400 | Image upload | Valid WebP | Stored in S3 bucket | [ ] |
| SB-401 | 30-day expiration | Image older than 30 days | Auto-deleted by lifecycle rule | [ ] |
| SB-402 | Metadata preserved | Image with metadata | Metadata in S3 object tags | [ ] |
| SB-403 | Orphan S3 files | Upload OK, frontend crashed before DB write | 30-day cleanup, no orphan DB records | [ ] |
| SB-404 | S3-DB consistency | S3 has file, DB missing record | Batch skips gracefully, file expires naturally | [ ] |

### 4.2 DynamoDB Operations

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-410 | Transaction query | userId + date range | Filtered results returned | [ ] |
| SB-411 | Pagination | >100 transactions | Proper pagination | [ ] |
| SB-412 | User data isolation | Query by userId | Only that user's data | [ ] |

---

## 5. Data Integrity

### 5.1 Idempotency (Pillar Q)

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-500 | Same intentId twice | Duplicate request | Only one record created | [ ] |
| SB-501 | Retry after failure | Failed request retry | Completes without duplicate | [ ] |
| SB-502 | IntentId format | Check stored intentId | Matches expected format | [ ] |

### 5.2 Traceability (Pillar N)

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-510 | TraceId propagation | Request with traceId | Same traceId in all logs | [ ] |
| SB-511 | TraceId in response | Any API call | TraceId in response header | [ ] |
| SB-512 | Log correlation | Check CloudWatch | Logs grouped by traceId | [ ] |

---

## 6. Authentication & Authorization

### 6.1 Cognito Integration

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-600 | Valid token | Valid JWT | Request authorized | [ ] |
| SB-601 | Expired token | Expired JWT | 401 Unauthorized | [ ] |
| SB-602 | Invalid token | Malformed JWT | 401 Unauthorized | [ ] |
| SB-603 | Token refresh | Refresh token request | New access token | [ ] |

### 6.2 Guest Access

| ID | Scenario | Input | Expected Result | Status |
|----|----------|-------|-----------------|--------|
| SB-610 | Guest upload | Guest userId (device-xxx) | Upload allowed | [ ] |
| SB-611 | Guest data claim | Login after guest use | Data migrated to account | [ ] |
| SB-612 | Guest expiration | Guest >60 days old | Data eligible for cleanup | [ ] |

---

## Test Environment

### Local Testing

```bash
# Run Lambda locally with SAM
cd infra
sam local invoke PresignFunction -e events/presign.json

# Run batch processor
sam local invoke BatchProcessFunction -e events/batch.json
```

### Staging Environment

```bash
# Deploy to dev stack
cdk deploy --profile dev

# Invoke Lambda
aws lambda invoke --function-name yorutsuke-presign-dev \
  --payload '{"userId":"test-user","imageId":"test-123"}' \
  response.json
```

### Mock Data

```bash
# Seed DynamoDB with test data
aws dynamodb batch-write-item --request-items file://test-data.json
```

---

*Last updated: 2026-01-05*
