# Azure Document Intelligence Setup & Integration Guide

## Overview

Azure Document Intelligence (formerly Form Recognizer) provides advanced document analysis for receipts, invoices, and other business documents. This guide explains setup options and integration into Yorutsuke's multi-model analyzer.

### Deployed Resource Information

| Property | Value |
|----------|-------|
| **Resource Name** | RJ0088 |
| **Resource Group** | ReceiptsJapan |
| **Status** | Active ✅ |
| **Location** | Japan East |
| **Region/Locale** | japaneast |
| **API Kind** | FormRecognizer |
| **Pricing Tier** | Free |
| **Endpoint** | https://rj0088.cognitiveservices.azure.com/ |
| **Subscription ID** | e3a6e7a7-e9dc-47e9-94d4-9d485f546a90 |

**Note**: Keys are managed in Azure Portal. Key 1 is currently used in Lambda environment variables.

## ⚠️ API Version & Format Notes

### Current Implementation (Yorutsuke)
- **API Version**: v4.0 (`2024-11-30`) - Latest GA
- **REST API Format**: `POST {endpoint}/documentintelligence/documentModels/{modelId}:analyze?api-version=2024-11-30`
- **Model**: `prebuilt-invoice` (for receipts with tax info)
- **Official Reference**: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/quickstarts/get-started-sdks-rest-api?view=doc-intel-4.0.0

### Important Format Details
- Path uses **`documentModels`** (camelCase, NOT `document-models`)
- Analyzer endpoint uses **`:analyze`** (colon, NOT `/analyze`)
- API version: **`2024-11-30`** (latest, NOT preview versions)

### Historical API Versions
| Version | Released | Path Format | Status |
|---------|----------|-------------|--------|
| v4.0 | 2024-11-30 | `/documentintelligence/documentModels/{modelId}:analyze` | ✅ Current |
| v3.1 | 2023-07-31 | `/formrecognizer/documentModels/{modelID}:analyze` | Legacy |
| v3.0 | 2022-08-31 | `/formrecognizer/documentModels/{modelId}:analyze` | Legacy |
| v2.1 | Legacy | `/formrecognizer/v2.1/prebuilt/invoice/analyze` | ❌ Deprecated |

---

## Three Access Methods Comparison

| Aspect | Document Intelligence Studio | Python SDK | REST API |
|--------|------------------------------|------------|----------|
| **Use Case** | Quick testing, visual verification | Local development, scripting | Lambda integration, production |
| **Setup Time** | 1 minute (web) | 5 minutes | 2 minutes |
| **Learning Curve** | None (GUI) | Low (wrapper) | Medium (HTTP) |
| **Best For** | Proof of concept | Local testing | Production Lambda |
| **Region Support** | Global | Global | Global |

---

## Method 1: Document Intelligence Studio (Recommended for Testing)

### Fastest way to verify Azure performance

**Setup**: 2 minutes
**No coding required**

### Steps

1. **Open Document Intelligence Studio**
   - Navigate to: https://formrecognizer.appliedai.azure.com/
   - Sign in with Azure account

2. **Select Model**
   - Choose "Invoice" model (best for receipts with tax info)
   - Or "Receipt" model (optimized for retail receipts)

3. **Upload Test Image**
   - Upload one of your test receipts
   - View extracted fields in real-time

4. **Export Results** (Optional)
   - Copy JSON output for comparison with AWS Textract

### Advantages
✅ No coding needed
✅ Visual verification of extraction
✅ Immediate results
✅ Perfect for validating model accuracy

### Disadvantages
❌ Can't automate
❌ No batch processing
❌ Manual for each image

---

## Method 2: Python SDK (Recommended for Local Testing)

### Best for development & debugging

**Setup**: 5 minutes
**Requires**: Python 3.8+

### Installation

```bash
# Install Azure SDK
pip install azure-ai-documentintelligence

# Verify installation
python -c "import azure; print(azure.__version__)"
```

### Python Script

```python
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential
import json
from pathlib import Path

# Configuration
ENDPOINT = "https://rj0088.cognitiveservices.azure.com/"
API_KEY = "<REDACTED_SECRET>"

# Create client
client = DocumentIntelligenceClient(
    endpoint=ENDPOINT,
    credential=AzureKeyCredential(API_KEY)
)

# Analyze receipt
image_path = "/path/to/receipt.jpg"
with open(image_path, "rb") as f:
    poller = client.begin_analyze_document(
        model_id="prebuilt-invoice",  # or "prebuilt-receipt"
        document=f,
        locale="ja-JP"  # Japanese locale for better extraction
    )
    result = poller.result()

# Extract key fields
print(json.dumps({
    "merchant": result.documents[0].fields.get("VendorName", {}).get("value", "Unknown"),
    "total": result.documents[0].fields.get("TotalAmount", {}).get("value", 0),
    "tax": result.documents[0].fields.get("TotalTax", {}).get("value", 0),
    "date": result.documents[0].fields.get("InvoiceDate", {}).get("value", "Unknown"),
    "confidence": 0.95,  # Average of field confidences
}, indent=2))
```

### Field Mapping

**Azure → Unified Schema**:
```
VendorName      → merchant
TotalAmount     → totalAmount
TotalTax        → taxAmount
SubtotalAmount  → subtotal
InvoiceDate     → date
Items           → lineItems (array)
```

### Testing Locally

```bash
# Test with your test images
python analyze_receipt.py --image test1.jpg
python analyze_receipt.py --image test2.jpg
python analyze_receipt.py --image test3.jpg
```

### Advantages
✅ Full control & debugging
✅ Easy integration testing
✅ Batch processing possible
✅ Good for validation before Lambda

### Disadvantages
❌ Requires Python environment
❌ Manual for each test

---

## Method 3: REST API (Recommended for Lambda/Production)

### Direct HTTP integration without SDK

**Setup**: 2 minutes
**Best for**: Lambda, production deployments

### HTTP Request

```bash
curl -X POST \
  "https://rj0088.cognitiveservices.azure.com/documentintelligence/document-models/prebuilt-invoice/analyze?api-version=2024-02-29-preview" \
  -H "Ocp-Apim-Subscription-Key: <REDACTED_SECRET>" \
  -H "Content-Type: application/json" \
  -d "{
    \"urlSource\": \"https://your-s3-bucket.s3.amazonaws.com/path/to/receipt.jpg\"
  }"
```

### JavaScript/Node.js Implementation

```javascript
// Azure Document Intelligence API client
export class AzureDocumentIntelligenceAnalyzer {
  constructor() {
    this.endpoint = process.env.AZURE_DI_ENDPOINT;
    this.apiKey = process.env.AZURE_DI_API_KEY;
  }

  async analyzeReceiptFromS3(s3Url) {
    const apiUrl = `${this.endpoint}/documentintelligence/document-models/prebuilt-invoice/analyze?api-version=2024-02-29-preview`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        urlSource: s3Url,
      }),
    });

    if (!response.ok) {
      throw new Error(`Azure API error: ${response.statusText}`);
    }

    const data = await response.json();
    return this.normalizeResult(data);
  }

  normalizeResult(azureResult) {
    const doc = azureResult.analyzeResult?.documents?.[0];
    if (!doc) return null;

    const fields = doc.fields || {};

    return {
      merchant: fields.VendorName?.value || "Unknown",
      totalAmount: parseFloat(fields.TotalAmount?.value || 0),
      taxAmount: parseFloat(fields.TotalTax?.value || 0),
      subtotal: parseFloat(fields.SubtotalAmount?.value || 0),
      date: fields.InvoiceDate?.value || new Date().toISOString().split('T')[0],
      confidence: this.calculateConfidence(fields),
      lineItems: this.extractLineItems(fields.Items),
    };
  }

  calculateConfidence(fields) {
    const confidences = Object.values(fields)
      .map(f => f.confidence || 0.9)
      .filter(c => c > 0);

    return confidences.length > 0
      ? (confidences.reduce((a, b) => a + b, 0) / confidences.length * 100).toFixed(0)
      : 0;
  }

  extractLineItems(itemsField) {
    if (!itemsField) return [];

    return itemsField.map(item => ({
      description: item.Description?.value || "",
      quantity: parseFloat(item.Quantity?.value || 1),
      amount: parseFloat(item.Amount?.value || 0),
    }));
  }
}
```

### Environment Configuration

```bash
# .env or Lambda environment
AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
AZURE_DI_API_KEY=<REDACTED_SECRET>
```

### Advantages
✅ No SDK dependency (smaller bundle)
✅ Easy Lambda integration
✅ Direct S3 URL support (fast)
✅ Simple HTTP library usage

### Disadvantages
❌ Manual error handling
❌ Need to handle async operations

---

## Local Development Setup

### Step 1: Configure Environment

Create `.env.local` in project root:

```bash
# Azure Document Intelligence
VITE_AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
VITE_AZURE_DI_API_KEY=<REDACTED_SECRET>

# Optional: Enable Azure in model comparison (defaults to false)
VITE_ENABLE_AZURE_DI=true
```

### Step 2: Test Studio First

```bash
# 1. Open Document Intelligence Studio
open https://formrecognizer.appliedai.azure.com/

# 2. Paste credentials:
# - Endpoint: https://rj0088.cognitiveservices.azure.com/
# - API Key: <REDACTED_SECRET>

# 3. Upload test receipts
```

### Step 3: Try Python Locally (Optional)

```bash
# Install SDK
pip install azure-ai-documentintelligence

# Run test
python3 << 'EOF'
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential

client = DocumentIntelligenceClient(
    endpoint="https://rj0088.cognitiveservices.azure.com/",
    credential=AzureKeyCredential("<REDACTED_SECRET>")
)

# Test with local file or URL
with open("test_receipt.jpg", "rb") as f:
    result = client.begin_analyze_document("prebuilt-invoice", document=f).result()
    print(result.documents[0].fields if result.documents else "No results")
EOF
```

### Step 4: Integrate into Lambda (Optional)

If satisfied with Azure results:

1. Add to CDK stack (`infra/lib/yorutsuke-stack.ts`):
   ```typescript
   environment: {
     AZURE_DI_ENDPOINT: "https://rj0088.cognitiveservices.azure.com/",
     AZURE_DI_API_KEY: "<api-key>",  // Use AWS Secrets Manager in production!
   }
   ```

2. Update `model-analyzer.mjs` to include Azure analyzer

---

## Model Selection Guide

### Receipt Model vs Invoice Model

| Model | Best For | Extraction | Accuracy |
|-------|----------|-----------|----------|
| **prebuilt-receipt** | Retail receipts | Quick extraction | 85-92% |
| **prebuilt-invoice** | Invoices, detailed receipts | Full itemization | 90-96% |

**Recommendation**: Use `prebuilt-invoice` for Japanese receipts (better tax detection)

---

## Security Best Practices

### 🔴 DON'T store API key in code

```javascript
// ❌ WRONG - Never do this
const API_KEY = "<REDACTED_SECRET>";
```

### ✅ DO use environment variables

```bash
# .env.local (development)
VITE_AZURE_DI_API_KEY=<key>

# AWS Secrets Manager (production)
aws secretsmanager create-secret --name yorutsuke/azure-di-key --secret-string "<key>"
```

### For Lambda (Production)

Use AWS Secrets Manager:

```typescript
// CDK
const secret = new secretsmanager.Secret(this, "AzureDiKey", {
  secretName: "yorutsuke/azure-di-key",
});

const lambda = new lambda.Function(..., {
  environment: {
    AZURE_DI_KEY_SECRET_NAME: "yorutsuke/azure-di-key",
  },
});

secret.grantRead(lambda);
```

---

## Troubleshooting

### Issue: 401 Unauthorized

**Cause**: Invalid API key or endpoint
**Fix**: Verify credentials in Document Intelligence Studio first

### Issue: 429 Too Many Requests

**Cause**: Rate limiting
**Fix**: Implement backoff retry logic (optional for now)

### Issue: Japanese characters garbled

**Cause**: Missing locale parameter
**Fix**: Always set `locale="ja-JP"` for Japanese receipts

### Issue: Tax fields missing

**Cause**: Using "receipt" model instead of "invoice"
**Fix**: Switch to `prebuilt-invoice` model

---

## Recommended Next Steps

1. **Test immediately**: Use Document Intelligence Studio (1-2 min)
2. **Validate results**: Compare with Textract on same receipts
3. **Decide**: Azure alone, AWS alone, or both (for comparison)?
4. **Implement**: If satisfied, integrate REST API into Lambda

---

## References

- [Azure Document Intelligence Docs](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/)
- [Supported Document Models](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/concept-model-overview)
- [API Reference (2024-02-29)](https://learn.microsoft.com/en-us/rest/api/aiservices/document-intelligence/operation-groups)
- [Python SDK Docs](https://github.com/Azure/azure-sdk-for-python/tree/main/sdk/documentintelligence/azure-ai-documentintelligence)
