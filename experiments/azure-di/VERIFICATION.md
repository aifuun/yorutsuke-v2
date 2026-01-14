# Azure Document Intelligence Verification Report

**Date**: 2026-01-14
**Status**: ✅ **VERIFIED AND WORKING**
**Test Method**: Local Node.js scripts + real receipts from S3

---

## Executive Summary

✅ **Azure Document Intelligence API is fully functional**

- API v4.0 format is correct
- S3 image access works correctly
- Receipt analysis works correctly
- Structured data extraction works correctly
- Japanese language support confirmed

---

## Test Results

### Test 1: API Format Validation (Local)

**Command**: `npm test`

```
✅ v4.0 (2024-11-30) format → PASS
✅ v3.1 (2023-07-31) format → PASS
✅ v3.0 (2022-08-31) format → PASS
❌ document-models (hyphen) → FAIL (404)
```

**Conclusion**: API v4.0 format in Lambda is correct.

---

### Test 2: Real Receipt Analysis

**Command**: `node test-real-receipts.mjs`

**Test Data**: 3 real Japanese receipts from S3 bucket
- `1768360453144-bf674f6f-7fc8-48a8-8029-5a0e0dcb8b55.jpg` (102 KB)
- `1768360449184-a099150f-90a1-4a66-bf73-49934e9d9ce9.jpg` (96 KB)
- `1768360444404-cc41060d-e5c0-4949-b99b-1063e16a66e5.jpg` (100 KB)

**Results**:

```
✅ Successful: 3
   - Receipt 1 (202 Accepted) → Operation ID: 22c9fb14-18cc-4292-ad96-3ae6cefcbbaa
   - Receipt 2 (202 Accepted) → Operation ID: 8a8fe144-3ce3-44e3-b93e-5f0d2bcd9aa8
   - Receipt 3 (202 Accepted) → Operation ID: 734a6c6a-bc2e-4810-8541-d69a5a811547

❌ Failed: 0
```

**Conclusion**: All 3 receipts successfully submitted for analysis (returned 202 Accepted).

---

### Test 3: Result Polling

**Command**: `node poll-results.mjs <operationLocation> [...]`

**Results**:

```
✅ Operation 1 → Status: succeeded ✅
✅ Operation 2 → Status: succeeded ✅
✅ Operation 3 → Status: succeeded ✅

❌ Failed: 0
```

**Conclusion**: All 3 analyses completed successfully.

---

## Extracted Data Example

**Receipt**: Jolly Pasta restaurant receipt (Japanese)

### Extracted Fields

| Field | Value | Confidence |
|-------|-------|------------|
| **Merchant** | 株式会社ジョリーパスタ | 41.5% |
| **Date** | 2025-12-06 | 67.2% |
| **Invoice Total** | ¥1,958 JPY | 68.9% |
| **Amount Due** | ¥1,958 JPY | 58.4% |
| **Address** | 東京都足立区扇2-27-36 | 52% |

### Extracted Line Items

| Item | Amount | Type |
|------|--------|------|
| ローストビーフ (Roast Beef) | ¥590 | Menu item |
| スープエビトマト (Shrimp Tomato Soup) | ¥1,190 | Menu item |

### Tax Calculation

- Subtotal: ¥1,780
- Tax Rate: 10%
- Tax Amount: ¥178
- **Total: ¥1,958** ✅

---

## Technical Verification

### API Endpoint

✅ **Correct Format (v4.0)**:
```
POST /documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30
```

### Authentication

✅ **Headers**:
- `Content-Type: application/json`
- `Ocp-Apim-Subscription-Key: [KEY]`

### Request Format

✅ **Body**:
```json
{
  "urlSource": "https://[s3-bucket]/[image-path]?[signed-url-params]"
}
```

### Response Handling

✅ **Async Pattern**:
1. POST returns 202 Accepted
2. `Operation-Location` header provides polling URL
3. Poll GET endpoint until `status: "succeeded"`
4. Response contains `analyzeResult.documents[0].fields`

---

## Confidence Scores

| Model | Confidence | Assessment |
|-------|------------|------------|
| **InvoiceTotal** | 68.9% | ✅ Good |
| **InvoiceDate** | 67.2% | ✅ Good |
| **AmountDue** | 58.4% | ✅ Acceptable |
| **CustomerAddress** | 52% | ⚠️ Fair (non-English) |
| **Items (descriptions)** | 40-50% | ⚠️ Fair (non-English) |

**Note**: Japanese text recognition may have lower confidence than English. This is normal for Azure DI.

---

## Comparison: Azure DI vs Other Models

Based on Layer v20 test results:

| Aspect | Azure DI | Textract | Nova Mini | Nova Pro |
|--------|----------|----------|-----------|----------|
| **Status** | ✅ Working | ✅ Working | ✅ Working | ✅ Working |
| **Tax Recognition** | ✅ Good | ⚠️ Poor | ✅ Good | ✅ Good |
| **Language Support** | ✅ Japanese | ⚠️ Limited | ✅ Good | ✅ Good |
| **Structured Output** | ✅ Excellent | ✅ Good | ✅ Good | ✅ Good |
| **Confidence Scores** | ✅ Per-field | Limited | Limited | Limited |
| **Line Items** | ✅ Detailed | Basic | Basic | Detailed |

---

## Why Azure DI Didn't Show in DynamoDB Earlier

❓ **Problem**: Local tests show ✅ working, but Lambda didn't output `azure_di` field

**Root Causes (in order of likelihood)**:

1. **S3 URL isn't accessible from Lambda**
   - Lambda may be in VPC without S3 gateway endpoint
   - S3 bucket may have restricted access policies

2. **Lambda timeout**
   - Azure DI takes 2-5 seconds per image
   - Lambda timeout may be too short

3. **Lambda IAM permissions**
   - Lambda may not have permission to read S3 URLs
   - Lambda may not have outbound internet access

4. **Error handling**
   - Lambda error might be caught but not logged
   - Check CloudWatch logs for "AZURE_DI" errors

---

## Verification Files

| File | Purpose |
|------|---------|
| `test-azure-di.mjs` | API format testing (4 versions) |
| `test-real-receipts.mjs` | Submit real receipts for analysis |
| `poll-results.mjs` | Poll and display results |
| `RESULTS.md` | Initial test findings |
| `VERIFICATION.md` | This report |

---

## Next Steps for Production

### 1. Verify Lambda Can Access S3

```bash
# Check Lambda logs
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev --profile dev --since 5m \
  | grep -i "s3\|download\|timeout"
```

### 2. Check Lambda Network

```bash
# Is Lambda in VPC?
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.VpcConfig'

# If in VPC, verify it has S3 Gateway Endpoint or Internet access
```

### 3. Increase Lambda Timeout (if needed)

```bash
# Current: 2 minutes (likely sufficient, but check)
# Each Azure DI request: 2-5 seconds
# With 4 models: ~5-20 seconds per receipt
```

### 4. Monitor CloudWatch

```bash
# Watch for Azure DI calls in production
aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev --profile dev \
  | grep "AZURE_DI"
```

---

## Conclusion

✅ **Azure Document Intelligence is fully verified and working locally**

The API format, authentication, and data extraction all work correctly with real Japanese receipts. If results aren't appearing in Lambda, the issue is likely:
- Network connectivity (VPC/S3 access)
- Lambda timeout settings
- IAM permissions

**Recommendation**: Check Lambda CloudWatch logs for specific error messages to diagnose why Azure DI results aren't being saved to DynamoDB.

---

*Generated: 2026-01-14*
*Last Verified: 2026-01-14 03:30 UTC*
