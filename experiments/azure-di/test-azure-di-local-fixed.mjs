/**
 * Local test for Azure Document Intelligence with fixed SDK initialization
 * Tests the corrected DocumentIntelligence class import and initialization
 */

import DocumentIntelligence, {
  isUnexpected,
  parseResultIdFromResponse,
} from "@azure-rest/ai-document-intelligence";
import { AzureKeyCredential } from "@azure/core-auth";

const AZURE_DI_ENDPOINT = "https://rj0088.cognitiveservices.azure.com/";
const AZURE_DI_API_KEY = "<REDACTED_SECRET>";

// Test 1: SDK Initialization
console.log("📋 Test 1: DocumentIntelligence SDK Initialization");
console.log("====================================================");

try {
  const client = DocumentIntelligence(
    AZURE_DI_ENDPOINT,
    new AzureKeyCredential(AZURE_DI_API_KEY)
  );
  console.log("✅ SDK initialized successfully");
  console.log("   Client type:", typeof client);
  console.log("   Client has path method:", typeof client.path === "function");
} catch (error) {
  console.error("❌ SDK initialization failed:", error.message);
  process.exit(1);
}

// Test 2: Test with Microsoft sample PDF
console.log("\n📋 Test 2: Analyze Sample Invoice (Microsoft Test PDF)");
console.log("====================================================");

const SAMPLE_INVOICE_URL =
  "https://raw.githubusercontent.com/Azure-Samples/cognitive-services-REST-api-samples/master/curl/form-recognizer/sample-invoice.pdf";

async function testAnalysis() {
  try {
    const client = DocumentIntelligence(
      AZURE_DI_ENDPOINT,
      new AzureKeyCredential(AZURE_DI_API_KEY)
    );

    console.log("Submitting analysis request...");
    const initialResponse = await client
      .path("/documentModels/{modelId}:analyze", "prebuilt-invoice")
      .post({
        contentType: "application/json",
        body: {
          urlSource: SAMPLE_INVOICE_URL,
        },
      });

    if (isUnexpected(initialResponse)) {
      console.error("❌ API error:", initialResponse.body.error);
      return;
    }

    console.log("✅ Analysis submitted (202 Accepted)");
    const resultId = parseResultIdFromResponse(initialResponse);
    console.log("   Result ID:", resultId);

    // Poll for result
    console.log("Polling for analysis result...");
    const maxRetries = 30;

    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const statusResponse = await client
        .path(
          "/documentModels/{modelId}/analyzeResults/{resultId}",
          "prebuilt-invoice",
          resultId
        )
        .get();

      if (statusResponse.body.status === "succeeded") {
        console.log(`✅ Analysis completed (${i + 1} polls)`);
        const result = statusResponse.body.analyzeResult;

        if (result.documents && result.documents.length > 0) {
          const doc = result.documents[0];
          console.log("\n📊 Extracted Fields:");
          console.log("   - Vendor:", doc.fields.VendorName?.value || "N/A");
          console.log(
            "   - Invoice Date:",
            doc.fields.InvoiceDate?.value || "N/A"
          );
          console.log("   - Total Amount:", doc.fields.Total?.value || "N/A");
          console.log("   - Tax Amount:", doc.fields.TotalTax?.value || "N/A");
          console.log("   - Confidence Scores:");
          Object.entries(doc.fields)
            .filter(([_, field]) => field?.confidence)
            .slice(0, 5)
            .forEach(([name, field]) => {
              console.log(
                `      ${name}: ${Math.round(field.confidence * 100)}%`
              );
            });
        }
        return;
      } else if (statusResponse.body.status === "failed") {
        console.error("❌ Analysis failed:", statusResponse.body.error);
        return;
      }

      if (i % 5 === 0) {
        console.log(`  ... still processing (attempt ${i + 1}/${maxRetries})`);
      }
    }

    console.error("❌ Analysis timeout after", maxRetries, "attempts");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Run test
testAnalysis().then(() => {
  console.log("\n✅ All tests completed");
});
