# Azure Document Intelligence - Quick Start (5 Minutes)

## 🎯 Goal
Test Azure invoice recognition accuracy on your 3 test receipts and compare with AWS Textract.

## ✅ What You Get
- ✅ Environment configured (done)
- ✅ REST API integration in Lambda (done)
- ✅ Easy testing via web UI (ready)
- ✅ Credentials saved locally (ready)

---

## Option 1: Web UI - Fastest Test (2 minutes, no coding)

### **Step 1: Open Document Intelligence Studio**
```bash
# Open in browser:
open https://formrecognizer.appliedai.azure.com/
# Or copy to address bar:
https://formrecognizer.appliedai.azure.com/
```

### **Step 2: Sign In**
- Use your Azure account (the one with the credentials)
- Or continue as guest

### **Step 3: Configure Resource**
1. Click "Manage" or "Settings"
2. Paste these values:
   - **Endpoint**: `https://rj0088.cognitiveservices.azure.com/`
   - **API Key**: `<REDACTED_SECRET>`

### **Step 4: Select Model**
- Choose: **Invoice** (best for receipts with tax)
- Language: **Japanese (ja-JP)**

### **Step 5: Upload Test Receipt**
- Upload your first test image from `/private/tmp/yorutsuke-test/`
- Wait for results

### **Step 6: View Results**
- Visual: See highlighted fields on receipt
- JSON: See extracted data in JSON format
- **Copy the JSON output for comparison**

### **Repeat for all 3 test receipts**

### ✅ When to Use
- Need immediate visual feedback
- Quick validation
- Comparing field extraction
- **Recommended first step**

---

## Option 2: Python SDK - Best for Local Testing (5 minutes)

### **Step 1: Install SDK**
```bash
pip install azure-ai-documentintelligence
```

### **Step 2: Create Test Script**

Create `test_azure_di.py`:

```python
#!/usr/bin/env python3
import sys
import json
from pathlib import Path
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential

# Configuration
ENDPOINT = "https://rj0088.cognitiveservices.azure.com/"
API_KEY = "<REDACTED_SECRET>"

# Create client
client = DocumentIntelligenceClient(
    endpoint=ENDPOINT,
    credential=AzureKeyCredential(API_KEY)
)

def analyze_receipt(image_path):
    print(f"\n📄 Analyzing: {image_path}")
    print("-" * 60)

    with open(image_path, "rb") as f:
        poller = client.begin_analyze_document(
            model_id="prebuilt-invoice",
            document=f,
            locale="ja-JP"
        )
        result = poller.result()

    if not result.documents:
        print("❌ No document detected")
        return None

    doc = result.documents[0]
    fields = doc.fields or {}

    # Extract key fields
    extracted = {
        "merchant": fields.get("VendorName", {}).get("value", "Unknown"),
        "totalAmount": fields.get("TotalAmount", {}).get("value", 0),
        "taxAmount": fields.get("TotalTax", {}).get("value", 0),
        "subtotal": fields.get("SubtotalAmount", {}).get("value", 0),
        "taxRate": fields.get("TaxRate", {}).get("value", 0),
        "date": fields.get("InvoiceDate", {}).get("value", "Unknown"),
        "confidence": round((
            sum([f.get("confidence", 0.9) for f in fields.values()]) /
            max(len(fields), 1)
        ) * 100, 0),
    }

    # Print results
    print(f"🏪 Merchant: {extracted['merchant']}")
    print(f"💰 Total: {extracted['totalAmount']}")
    print(f"🧾 Tax: {extracted['taxAmount']}")
    print(f"📊 Subtotal: {extracted['subtotal']}")
    print(f"📈 Confidence: {extracted['confidence']}%")

    return extracted

if __name__ == "__main__":
    test_dir = Path("/private/tmp/yorutsuke-test")

    if not test_dir.exists():
        print(f"❌ Test directory not found: {test_dir}")
        sys.exit(1)

    results = {}

    # Test all JPG files
    for image in sorted(test_dir.glob("*.jpg")):
        result = analyze_receipt(str(image))
        if result:
            results[image.name] = result

    # Summary
    print("\n" + "=" * 60)
    print("📋 SUMMARY")
    print("=" * 60)
    print(json.dumps(results, indent=2, ensure_ascii=False))

    print("\n✅ Comparison ready - Compare with AWS Textract results")

```

### **Step 3: Run the Test**
```bash
python3 test_azure_di.py
```

### ✅ Output Example
```
📄 Analyzing: test_receipt_1.jpg
────────────────────────────────────────────────────────
🏪 Merchant: セブン-イレブン (7-Eleven)
💰 Total: 1626
🧾 Tax: 120
📊 Subtotal: 1506
📈 Confidence: 95%

📄 Analyzing: test_receipt_2.jpg
────────────────────────────────────────────────────────
🏪 Merchant: Unknown
💰 Total: 577
🧾 Tax: 39
📊 Subtotal: 538
📈 Confidence: 90%

📄 Analyzing: test_receipt_3.jpg
────────────────────────────────────────────────────────
🏪 Merchant: Jolly-Pasta
💰 Total: 2136
🧾 Tax: 178
📊 Subtotal: 1958
📈 Confidence: 90%
```

---

## Option 3: REST API - Direct HTTP (For Testing Locally)

### **Simple Curl Test**
```bash
# Test with a local file
IMAGE_PATH="/private/tmp/yorutsuke-test/receipt_1.jpg"

# Convert to base64
IMAGE_B64=$(base64 -i "$IMAGE_PATH")

# Call Azure API with base64
curl -X POST \
  "https://rj0088.cognitiveservices.azure.com/documentintelligence/document-models/prebuilt-invoice/analyze?api-version=2024-02-29-preview" \
  -H "Ocp-Apim-Subscription-Key: <REDACTED_SECRET>" \
  -H "Content-Type: application/json" \
  -d "{
    \"base64Source\": \"$IMAGE_B64\"
  }" | jq .
```

### ⚠️ Or Use S3 URL (Recommended for Lambda)
```bash
BUCKET="yorutsuke-images-us-dev-696249060859"
S3_KEY="processed/device-xxx/timestamp-uuid.jpg"
S3_URL="https://${BUCKET}.s3.amazonaws.com/${S3_KEY}"

curl -X POST \
  "https://rj0088.cognitiveservices.azure.com/documentintelligence/document-models/prebuilt-invoice/analyze?api-version=2024-02-29-preview" \
  -H "Ocp-Apim-Subscription-Key: <REDACTED_SECRET>" \
  -H "Content-Type: application/json" \
  -d "{
    \"urlSource\": \"$S3_URL\"
  }" | jq .
```

---

## 📊 Comparison Matrix

After testing, compare results:

| Aspect | AWS Textract | Azure DI | Nova Pro |
|--------|------------|----------|----------|
| **Receipt 1 - Merchant** | ? | ? | ? |
| **Receipt 1 - Total** | ? | ? | ? |
| **Receipt 2 - Merchant** | ? | ? | ? |
| **Receipt 2 - Total** | ? | ? | ? |
| **Receipt 3 - Merchant** | ? | ? | ? |
| **Receipt 3 - Total** | ? | ? | ? |
| **Avg Confidence** | ? | ? | ? |

---

## 🚀 Next Steps

### If Azure Results Look Good ✅
1. Deploy Lambda with Azure DI enabled
   ```bash
   cd infra
   cdk deploy --context env=dev --profile dev
   ```
2. Upload test receipts via app
3. Check results in DynamoDB (should include `azure_di` in modelComparison)

### If Azure Results Need Work ⚠️
1. Try different fields mapping
2. Test with different image quality
3. Consider "receipt" model instead of "invoice"
4. Check if locale needs adjustment

### To Enable in Production 🚀
1. Add credentials to AWS Secrets Manager:
   ```bash
   aws secretsmanager create-secret \
     --name yorutsuke/azure-di \
     --secret-string '{
       "endpoint": "https://rj0088.cognitiveservices.azure.com/",
       "apiKey": "<REDACTED_SECRET>"
     }'
   ```

2. Update CDK to read from secrets
3. Deploy with `ENABLE_AZURE_DI=true`

---

## 🐛 Troubleshooting

### Studio Credentials Not Accepted
- ❌ **Wrong endpoint**: Use exactly `https://rj0088.cognitiveservices.azure.com/`
- ✅ **Fix**: Copy/paste endpoint from .env

### Python Script Hangs
- ❌ **Network issue**: Check if you can reach Azure
- ✅ **Fix**: Test with curl first

### No Documents Detected
- ❌ **Image quality**: Receipt too small/blurry
- ✅ **Fix**: Use clear, well-lit receipt images

### Field Extraction Empty
- ❌ **Wrong model**: Using "receipt" instead of "invoice"
- ✅ **Fix**: Switch to "prebuilt-invoice"

---

## 📚 Full Documentation
See: `docs/operations/AZURE_DOCUMENT_INTELLIGENCE.md` for detailed info

---

## ✅ Checklist

- [ ] Opened Document Intelligence Studio
- [ ] Configured endpoint & API key
- [ ] Tested with receipt 1
- [ ] Tested with receipt 2
- [ ] Tested with receipt 3
- [ ] Compared results with Textract
- [ ] Decided: Use Azure / Use Textract / Use both?

