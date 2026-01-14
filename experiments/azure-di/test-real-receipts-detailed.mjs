/**
 * Detailed Azure Document Intelligence SDK Test with Real S3 Receipts
 * Shows complete extracted fields and raw JSON responses
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
  try {
    const output = execSync(
      `aws s3 ls s3://${S3_BUCKET}/processed/ --recursive --profile ${AWS_PROFILE} | grep -E '\\.(jpg|webp)$' | sort -r | head -${count}`,
      { encoding: "utf-8" }
    );

    return output
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
    return execSync(
      `aws s3 presign s3://${S3_BUCKET}/${s3Path} --expires-in 3600 --profile ${AWS_PROFILE}`,
      { encoding: "utf-8" }
    ).trim();
  } catch (error) {
    console.error(`❌ Error generating signed URL:`, error.message);
    return null;
  }
}

/**
 * Display detailed extracted fields
 */
function displayDetailedResults(analyzeResult, receiptName) {
  const doc = analyzeResult.documents?.[0];
  if (!doc) {
    console.log("⚠️  No documents found");
    return;
  }

  const fields = doc.fields || {};

  console.log(`\n📄 Receipt: ${receiptName}`);
  console.log(`   Document Type: ${doc.docType}`);
  console.log(`   Confidence: ${(doc.confidence * 100).toFixed(1)}%\n`);

  console.log("   📋 All Extracted Fields:");

  // Display all fields
  Object.entries(fields).forEach(([key, field]) => {
    if (field && field.value !== undefined) {
      const confidence = field.confidence ? ` (${(field.confidence * 100).toFixed(0)}%)` : "";
      const value = typeof field.value === "string" ? field.value : JSON.stringify(field.value).substring(0, 50);
      console.log(`     • ${key}: ${value}${confidence}`);
    }
  });

  // Display line items if present
  if (fields.Items?.value && Array.isArray(fields.Items.value)) {
    console.log(`\n   📦 Line Items (${fields.Items.value.length} items):`);
    fields.Items.value.forEach((item, i) => {
      const desc = item.fields?.Description?.value || "Unknown";
      const qty = item.fields?.Quantity?.value || "1";
      const amount = item.fields?.Amount?.value || "N/A";
      const unitPrice = item.fields?.UnitPrice?.value || "N/A";
      console.log(`     ${i + 1}. ${desc}`);
      console.log(`        Qty: ${qty} × Unit Price: ${unitPrice} = ${amount}`);
    });
  }

  // Show raw JSON
  console.log(`\n   📄 Raw JSON Response:`);
  console.log(JSON.stringify(doc, null, 2).split("\n").slice(0, 30).join("\n"));
  if (JSON.stringify(doc, null, 2).split("\n").length > 30) {
    console.log("   ... (truncated for brevity)");
  }
}

/**
 * Analyze receipt with SDK
 */
async function analyzeReceipt(client, signedUrl, receiptName) {
  try {
    console.log(`\n${"=".repeat(100)}`);
    console.log(`Analyzing: ${receiptName}`);
    console.log("=".repeat(100));

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
      return { success: false, error: initialResponse.body.error.message };
    }

    console.log("✅ Submitted for analysis (202 Async)");

    // Poll for result
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
        console.log(`✅ Analysis complete (${i + 1} polls)\n`);
        break;
      } else if (statusResponse.body.status === "failed") {
        console.log(`❌ Analysis failed`);
        return { success: false, error: statusResponse.body.error };
      }
    }

    if (!analyzeResult) {
      console.log("❌ Analysis timeout");
      return { success: false, error: "Timeout" };
    }

    displayDetailedResults(analyzeResult, receiptName);

    return {
      success: true,
      analyzeResult,
    };
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main runner
 */
async function runDetailed() {
  console.log("\n");
  console.log("╔" + "=".repeat(98) + "╗");
  console.log("║" + " ".repeat(20) + "DETAILED Azure DI SDK Results - Real Japanese Receipts" + " ".repeat(24) + "║");
  console.log("╚" + "=".repeat(98) + "╝\n");

  // Initialize SDK
  console.log("🔐 Initializing Azure Document Intelligence client...");
  const client = DocumentIntelligence(ENDPOINT, new AzureKeyCredential(API_KEY));
  console.log("✅ Client initialized\n");

  // Get receipts
  console.log("📁 Fetching latest 3 receipts from S3...\n");
  const receipts = getLatestReceipts(3);
  if (receipts.length === 0) {
    console.log("❌ No receipts found");
    process.exit(1);
  }

  // Analyze each receipt
  const results = [];
  for (const receipt of receipts) {
    const receiptName = receipt.path.split("/").pop();
    const signedUrl = generateSignedUrl(receipt.path);

    if (!signedUrl) {
      results.push({ success: false, error: "Failed to generate signed URL" });
      continue;
    }

    const result = await analyzeReceipt(client, signedUrl, receiptName);
    results.push(result);

    // Delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log("\n" + "=".repeat(100));
  console.log("SUMMARY");
  console.log("=".repeat(100));
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}\n`);

  process.exit(successful > 0 ? 0 : 1);
}

runDetailed().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
