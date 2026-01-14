/**
 * Extract and display all Azure DI fields from 3 real receipts
 * Saves complete JSON results to file for review
 */

import { execSync } from "child_process";
import DocumentIntelligence, {
  isUnexpected,
  parseResultIdFromResponse,
} from "@azure-rest/ai-document-intelligence";
import { AzureKeyCredential } from "@azure/core-auth";
import fs from "fs";

const ENDPOINT = process.env.AZURE_DI_ENDPOINT || "https://rj0088.cognitiveservices.azure.com/";
const API_KEY = process.env.AZURE_DI_API_KEY || "<REDACTED_SECRET>";
const S3_BUCKET = "yorutsuke-images-us-dev-696249060859";
const AWS_PROFILE = "dev";

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
        return { path: parts[3] };
      });
  } catch (error) {
    return [];
  }
}

function generateSignedUrl(s3Path) {
  try {
    return execSync(
      `aws s3 presign s3://${S3_BUCKET}/${s3Path} --expires-in 3600 --profile ${AWS_PROFILE}`,
      { encoding: "utf-8" }
    ).trim();
  } catch (error) {
    return null;
  }
}

async function analyzeReceipt(client, signedUrl, receiptName) {
  try {
    const initialResponse = await client
      .path("/documentModels/{modelId}:analyze", "prebuilt-invoice")
      .post({
        contentType: "application/json",
        body: { urlSource: signedUrl },
      });

    if (isUnexpected(initialResponse)) {
      return null;
    }

    const resultId = parseResultIdFromResponse(initialResponse);
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusResponse = await client
        .path("/documentModels/{modelId}/analyzeResults/{resultId}", "prebuilt-invoice", resultId)
        .get();

      if (statusResponse.body.status === "succeeded") {
        return statusResponse.body.analyzeResult;
      } else if (statusResponse.body.status === "failed") {
        return null;
      }
    }
  } catch (error) {
    return null;
  }
}

function formatFields(doc) {
  const fields = doc.fields || {};
  const extracted = {};

  Object.entries(fields).forEach(([key, field]) => {
    if (!field) return;

    let value = field.value;

    // Handle special types
    if (field.type === "currency" && field.valueCurrency) {
      value = `${field.valueCurrency.currencySymbol}${field.valueCurrency.amount} ${field.valueCurrency.currencyCode}`;
    } else if (field.type === "date" && field.valueDate) {
      value = field.valueDate;
    } else if (field.type === "address" && field.valueAddress) {
      value = field.valueAddress;
    } else if (key === "Items" && Array.isArray(value)) {
      value = value.map((item, idx) => ({
        index: idx + 1,
        description: item.fields?.Description?.value || "N/A",
        quantity: item.fields?.Quantity?.value || "N/A",
        unitPrice: item.fields?.UnitPrice?.value || "N/A",
        amount: item.fields?.Amount?.value || "N/A",
      }));
    }

    extracted[key] = {
      value: value,
      confidence: field.confidence ? `${(field.confidence * 100).toFixed(1)}%` : "N/A",
      type: field.type || "unknown",
    };
  });

  return extracted;
}

async function main() {
  console.log("\n");
  console.log("╔" + "=".repeat(98) + "╗");
  console.log("║" + " ".repeat(25) + "Azure DI SDK - All Extracted Fields" + " ".repeat(39) + "║");
  console.log("╚" + "=".repeat(98) + "╝\n");

  const client = DocumentIntelligence(ENDPOINT, new AzureKeyCredential(API_KEY));
  console.log("✅ Client initialized\n");

  const receipts = getLatestReceipts(3);
  const results = [];

  for (let idx = 0; idx < receipts.length; idx++) {
    const receipt = receipts[idx];
    const receiptName = receipt.path.split("/").pop();
    const signedUrl = generateSignedUrl(receipt.path);

    console.log(`[${idx + 1}/3] Analyzing: ${receiptName}`);

    if (!signedUrl) {
      console.log("  ❌ Failed to generate signed URL\n");
      continue;
    }

    const analyzeResult = await analyzeReceipt(client, signedUrl, receiptName);
    if (!analyzeResult || !analyzeResult.documents?.[0]) {
      console.log("  ❌ Analysis failed\n");
      continue;
    }

    const doc = analyzeResult.documents[0];
    const extracted = formatFields(doc);

    results.push({
      receiptName,
      timestamp: new Date().toISOString(),
      docType: doc.docType,
      confidence: `${(doc.confidence * 100).toFixed(1)}%`,
      fields: extracted,
    });

    console.log(`  ✅ Extracted ${Object.keys(extracted).length} fields\n`);
  }

  // Print results
  console.log("\n" + "=".repeat(100));
  console.log("RESULTS");
  console.log("=".repeat(100) + "\n");

  results.forEach((result, idx) => {
    console.log(`\n📄 Receipt ${idx + 1}: ${result.receiptName}`);
    console.log(`   Type: ${result.docType} | Confidence: ${result.confidence}`);
    console.log(`   Extracted Fields:\n`);

    Object.entries(result.fields).forEach(([key, field]) => {
      if (key === "Items" && Array.isArray(field.value)) {
        console.log(`   ${key} (${field.value.length} items):`);
        field.value.forEach((item) => {
          console.log(
            `     #${item.index}: ${item.description} x${item.quantity} @ ${item.unitPrice} = ${item.amount}`
          );
        });
      } else {
        const valueStr = field.value ? JSON.stringify(field.value).substring(0, 80) : "N/A";
        console.log(`   ${key}: ${valueStr}`);
        console.log(`      └─ Confidence: ${field.confidence} (Type: ${field.type})`);
      }
    });
  });

  // Save to file
  const outputFile = "receipt-results.json";
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n\n✅ Complete results saved to: ${outputFile}\n`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
