/**
 * Test Azure Document Intelligence SDK
 *
 * Reference: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/quickstarts/get-started-sdks-rest-api?view=doc-intel-4.0.0&pivots=programming-language-javascript
 *
 * Tests the official @azure-rest/ai-document-intelligence SDK
 */

import DocumentIntelligence, {
  isUnexpected,
  parseResultIdFromResponse,
} from "@azure-rest/ai-document-intelligence";
import { AzureKeyCredential } from "@azure/core-auth";

// Configuration
const ENDPOINT = process.env.AZURE_DI_ENDPOINT || "https://rj0088.cognitiveservices.azure.com/";
const API_KEY = process.env.AZURE_DI_API_KEY || "<REDACTED_SECRET>";

// Test sample invoice URL (Microsoft sample)
const SAMPLE_INVOICE_URL = "https://raw.githubusercontent.com/Azure-Samples/cognitive-services-REST-api-samples/master/curl/form-recognizer/sample-invoice.pdf";

/**
 * Main test runner
 */
async function runTests() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════════════════════╗");
  console.log("║            Test Azure Document Intelligence SDK (Official)                    ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════════╝\n");

  try {
    // 1. Test SDK initialization
    console.log("✅ Step 1: SDK Initialization");
    const client = DocumentIntelligence(ENDPOINT, new AzureKeyCredential(API_KEY));
    console.log("   ✅ Client initialized successfully\n");

    // 2. Test invoice analysis with SDK
    console.log("✅ Step 2: Analyze Sample Invoice (Microsoft Sample)");
    console.log(`   URL: ${SAMPLE_INVOICE_URL.substring(0, 80)}...\n`);

    const initialResponse = await client
      .path("/documentModels/{modelId}:analyze", "prebuilt-invoice")
      .post({
        contentType: "application/json",
        body: {
          urlSource: SAMPLE_INVOICE_URL,
        },
      });

    if (isUnexpected(initialResponse)) {
      console.log(`   ❌ ERROR: ${initialResponse.body.error.message}`);
      process.exit(1);
    }

    console.log(`   ✅ Request accepted (202 Async)\n`);

    // 3. Polling for results
    console.log("✅ Step 3: Polling for Analysis Results");

    // Extract result ID and poll manually
    const resultId = parseResultIdFromResponse(initialResponse);
    console.log(`   Operation ID: ${resultId}`);

    let analyzeResult = null;
    const maxRetries = 30;
    for (let i = 0; i < maxRetries; i++) {
      // Wait before polling
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusResponse = await client
        .path("/documentModels/{modelId}/analyzeResults/{resultId}", "prebuilt-invoice", resultId)
        .get();

      if (statusResponse.body.status === "succeeded") {
        analyzeResult = statusResponse.body.analyzeResult;
        console.log(`   ✅ Analysis complete (${i + 1} polls)\n`);
        break;
      } else if (statusResponse.body.status === "failed") {
        throw new Error(`Analysis failed: ${statusResponse.body.error}`);
      } else {
        if (i % 5 === 0) {
          console.log(`   ⏳ Status: ${statusResponse.body.status} (${i + 1}/${maxRetries})`);
        }
      }
    }

    if (!analyzeResult) {
      throw new Error("Analysis timeout");
    }

    // 4. Display results
    console.log("✅ Step 4: Extracted Fields");
    if (analyzeResult?.documents?.[0]) {
      const doc = analyzeResult.documents[0];
      const fields = doc.fields || {};

      console.log(`   Document Type: ${doc.docType}`);
      console.log(`   Confidence: ${(doc.confidence * 100).toFixed(1)}%\n`);

      console.log("   📋 Key Fields:");
      console.log(`     - Vendor: ${fields.VendorName?.value || "N/A"}`);
      console.log(`     - Invoice Date: ${fields.InvoiceDate?.value || "N/A"}`);
      console.log(`     - Invoice Total: ${fields.InvoiceTotal?.value || "N/A"}`);
      console.log(`     - Total Tax: ${fields.TotalTax?.value || "N/A"}`);

      if (fields.Items?.value && Array.isArray(fields.Items.value)) {
        console.log(`\n   📦 Line Items (${fields.Items.value.length}):`);
        fields.Items.value.slice(0, 3).forEach((item, i) => {
          const desc = item.fields?.Description?.value || "Unknown";
          const amount = item.fields?.Amount?.value || "N/A";
          console.log(`     ${i + 1}. ${desc} - ${amount}`);
        });
      }

      console.log("\n✅ SDK Test Result: SUCCESS\n");
      console.log("🎯 CONCLUSION: Azure Document Intelligence SDK is working correctly!\n");
      process.exit(0);
    } else {
      console.log("   ❌ No documents found in result");
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}\n`);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
