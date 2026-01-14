/**
 * Test Azure Document Intelligence SDK with Real S3 Receipts
 *
 * This script:
 * 1. Lists latest receipt images from S3
 * 2. Generates signed URLs for each
 * 3. Sends them to Azure DI using the official SDK
 * 4. Polls results and displays extracted data
 */

import { execSync } from "child_process";
import DocumentIntelligence, {
  isUnexpected,
  parseResultIdFromResponse,
} from "@azure-rest/ai-document-intelligence";
import { AzureKeyCredential } from "@azure/core-auth";

// Configuration
const ENDPOINT = process.env.AZURE_DI_ENDPOINT || "https://rj0088.cognitiveservices.azure.com/";
const API_KEY = process.env.AZURE_DI_API_KEY || "<REDACTED_SECRET>";
const S3_BUCKET = "yorutsuke-images-us-dev-696249060859";
const AWS_PROFILE = "dev";

/**
 * Get latest receipt images from S3
 */
function getLatestReceipts(count = 3) {
  console.log(`\n📁 Listing latest ${count} receipts from S3...\n`);

  try {
    const output = execSync(
      `aws s3 ls s3://${S3_BUCKET}/processed/ --recursive --profile ${AWS_PROFILE} | grep -E '\\.(jpg|webp)$' | sort -r | head -${count}`,
      { encoding: "utf-8" }
    );

    const receipts = output
      .trim()
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const parts = line.split(/\s+/);
        return {
          date: `${parts[0]} ${parts[1]}`,
          size: parts[2],
          path: parts[3],
        };
      });

    return receipts;
  } catch (error) {
    console.error("❌ Error listing receipts:", error.message);
    return [];
  }
}

/**
 * Generate signed S3 URL valid for 1 hour
 */
function generateSignedUrl(s3Path) {
  try {
    const signedUrl = execSync(
      `aws s3 presign s3://${S3_BUCKET}/${s3Path} --expires-in 3600 --profile ${AWS_PROFILE}`,
      { encoding: "utf-8" }
    ).trim();
    return signedUrl;
  } catch (error) {
    console.error(`❌ Error generating signed URL for ${s3Path}:`, error.message);
    return null;
  }
}

/**
 * Display extracted fields from Azure result
 */
function displayResults(analyzeResult, receiptName) {
  const doc = analyzeResult.documents?.[0];
  if (!doc) {
    console.log("⚠️  No documents found in response");
    return;
  }

  const fields = doc.fields || {};

  console.log("   📋 Extracted Fields:");
  console.log(`     - Merchant: ${fields.VendorName?.value || "N/A"} (${((fields.VendorName?.confidence || 0) * 100).toFixed(0)}%)`);
  console.log(`     - Date: ${fields.InvoiceDate?.value || "N/A"} (${((fields.InvoiceDate?.confidence || 0) * 100).toFixed(0)}%)`);
  console.log(`     - Total: ${fields.InvoiceTotal?.value || "N/A"} (${((fields.InvoiceTotal?.confidence || 0) * 100).toFixed(0)}%)`);
  console.log(`     - Tax: ${fields.TotalTax?.value || "N/A"}`);

  if (fields.Items?.value && Array.isArray(fields.Items.value)) {
    console.log(`\n   📦 Items (${fields.Items.value.length}):`);
    fields.Items.value.slice(0, 3).forEach((item, i) => {
      const desc = item.fields?.Description?.value || "Unknown";
      const amount = item.fields?.Amount?.value || "N/A";
      console.log(`     ${i + 1}. ${desc} = ${amount}`);
    });
    if (fields.Items.value.length > 3) {
      console.log(`     ... and ${fields.Items.value.length - 3} more items`);
    }
  }
}

/**
 * Analyze receipt with SDK
 */
async function analyzeReceipt(client, signedUrl, receiptName) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📄 Analyzing: ${receiptName}`);
  console.log(`URL: ${signedUrl.substring(0, 100)}...`);
  console.log("=".repeat(80));

  try {
    // Start async analysis
    const initialResponse = await client
      .path("/documentModels/{modelId}:analyze", "prebuilt-invoice")
      .post({
        contentType: "application/json",
        body: {
          urlSource: signedUrl,
        },
      });

    if (isUnexpected(initialResponse)) {
      console.log(`❌ Error: ${initialResponse.body.error.message}`);
      return { success: false, error: initialResponse.body.error.message, receiptName };
    }

    console.log("✅ Submitted for analysis (202 Async)");

    // Poll for result
    console.log("⏳ Polling for results...");
    const resultId = parseResultIdFromResponse(initialResponse);

    let analyzeResult = null;
    const maxRetries = 30;
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusResponse = await client
        .path("/documentModels/{modelId}/analyzeResults/{resultId}", "prebuilt-invoice", resultId)
        .get();

      if (statusResponse.body.status === "succeeded") {
        analyzeResult = statusResponse.body.analyzeResult;
        console.log(`✅ Analysis complete (${i + 1} polls)`);
        break;
      } else if (statusResponse.body.status === "failed") {
        console.log(`❌ ERROR: Analysis failed`);
        return { success: false, error: statusResponse.body.error, receiptName };
      }
    }

    if (!analyzeResult) {
      console.log("❌ ERROR: Analysis timeout");
      return { success: false, error: "Timeout", receiptName };
    }

    displayResults(analyzeResult, receiptName);

    return {
      success: true,
      receiptName,
      analyzeResult,
    };
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { success: false, error: error.message, receiptName };
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════════════════════╗");
  console.log("║        Test Azure DI SDK with Real Japanese Receipts from S3                   ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════════╝");

  // Initialize SDK client
  console.log("\n🔐 Initializing Azure Document Intelligence client...");
  const client = DocumentIntelligence(ENDPOINT, new AzureKeyCredential(API_KEY));
  console.log("✅ Client initialized\n");

  // Get latest receipts
  const receipts = getLatestReceipts(3);
  if (receipts.length === 0) {
    console.log("❌ No receipts found in S3");
    process.exit(1);
  }

  console.log(`Found ${receipts.length} receipts:`);
  receipts.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.path} (${r.size} bytes)`);
  });

  // Test each receipt
  const results = [];
  for (const receipt of receipts) {
    const receiptName = receipt.path.split("/").pop();

    // Generate signed URL
    const signedUrl = generateSignedUrl(receipt.path);
    if (!signedUrl) {
      results.push({ success: false, error: "Failed to generate signed URL", receiptName });
      continue;
    }

    // Analyze receipt
    const result = await analyzeReceipt(client, signedUrl, receiptName);
    results.push(result);

    // Delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════════════════════╗");
  console.log("║                              SUMMARY                                          ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════════╝\n");

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Successful: ${successful.length}`);
  successful.forEach((r) => {
    console.log(`   - ${r.receiptName}`);
  });

  console.log(`\n❌ Failed: ${failed.length}`);
  failed.forEach((r) => {
    console.log(`   - ${r.receiptName}: ${r.error}`);
  });

  if (successful.length > 0) {
    console.log(`\n🎯 RESULT: Azure DI SDK successfully analyzed ${successful.length} receipt(s)!\n`);
    process.exit(0);
  } else {
    console.log("\n❌ All receipts failed\n");
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
