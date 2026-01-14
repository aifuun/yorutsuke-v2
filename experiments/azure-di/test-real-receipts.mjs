/**
 * Test Azure Document Intelligence with Real Receipts from S3
 *
 * This script:
 * 1. Lists latest receipt images from S3
 * 2. Generates signed URLs for each
 * 3. Sends them to Azure DI API
 * 4. Displays extraction results
 */

import { execSync } from 'child_process';

// Configuration
const ENDPOINT = process.env.AZURE_DI_ENDPOINT || 'https://rj0088.cognitiveservices.azure.com/';
const API_KEY = process.env.AZURE_DI_API_KEY || '<REDACTED_SECRET>';
const S3_BUCKET = 'yorutsuke-images-us-dev-696249060859';
const AWS_PROFILE = 'dev';

/**
 * Get latest receipt images from S3
 */
function getLatestReceipts(count = 3) {
  console.log(`\n📁 Listing latest ${count} receipts from S3...\n`);

  try {
    const output = execSync(
      `aws s3 ls s3://${S3_BUCKET}/processed/ --recursive --profile ${AWS_PROFILE} | grep -E '\\.(jpg|webp)$' | sort -r | head -${count}`,
      { encoding: 'utf-8' }
    );

    const receipts = output
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split(/\s+/);
        return {
          date: `${parts[0]} ${parts[1]}`,
          size: parts[2],
          path: parts[3],
        };
      });

    return receipts;
  } catch (error) {
    console.error('❌ Error listing receipts:', error.message);
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
      { encoding: 'utf-8' }
    ).trim();
    return signedUrl;
  } catch (error) {
    console.error(`❌ Error generating signed URL for ${s3Path}:`, error.message);
    return null;
  }
}

/**
 * Send receipt to Azure Document Intelligence
 */
async function analyzeReceipt(signedUrl, receiptName) {
  const baseUrl = ENDPOINT.replace(/\/$/, '');
  const url = `${baseUrl}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30`;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📄 Analyzing: ${receiptName}`);
  console.log(`URL: ${signedUrl.substring(0, 100)}...`);
  console.log('='.repeat(80));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': API_KEY,
      },
      body: JSON.stringify({
        urlSource: signedUrl,
      }),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (response.status === 202) {
      // Async analysis started
      const operationLocation = response.headers.get('operation-location');
      console.log(`✅ Analysis started (202 Accepted)`);
      console.log(`Operation-Location: ${operationLocation}`);
      return { success: true, operationLocation, receiptName };
    } else if (response.status === 200) {
      // Sync analysis complete
      const result = await response.json();
      console.log(`✅ Analysis complete (200 OK)`);
      displayResults(result, receiptName);
      return { success: true, result, receiptName };
    } else {
      const body = await response.text();
      try {
        const json = JSON.parse(body);
        console.log(`❌ Error: ${json.error?.message || body}`);
      } catch {
        console.log(`❌ Error: ${body.substring(0, 200)}`);
      }
      return { success: false, error: response.status, receiptName };
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { success: false, error: error.message, receiptName };
  }
}

/**
 * Display extracted fields from Azure result
 */
function displayResults(result, receiptName) {
  if (!result.analyzeResult || !result.analyzeResult.documents || result.analyzeResult.documents.length === 0) {
    console.log('⚠️  No documents found in response');
    return;
  }

  const doc = result.analyzeResult.documents[0];
  const fields = doc.fields || {};

  console.log('\n📋 Extracted Fields:');
  console.log(`  Merchant: ${fields.MerchantName?.value || 'N/A'}`);
  console.log(`  Total: ${fields.Total?.value || 'N/A'}`);
  console.log(`  Tax: ${fields.TotalTax?.value || 'N/A'}`);
  console.log(`  Date: ${fields.TransactionDate?.value || 'N/A'}`);

  if (fields.Items?.value && Array.isArray(fields.Items.value)) {
    console.log(`  Items: ${fields.Items.value.length}`);
    fields.Items.value.slice(0, 3).forEach((item, i) => {
      console.log(`    ${i + 1}. ${item.fields?.Description?.value || 'Unknown'} - ${item.fields?.Amount?.value || 'N/A'}`);
    });
  }

  console.log(`\n✅ Result for ${receiptName}:`);
  console.log(JSON.stringify(doc.fields, null, 2).substring(0, 500) + '\n...');
}

/**
 * Poll for async result
 */
async function pollForResult(operationLocation, maxRetries = 10) {
  console.log(`\n⏳ Polling for result (${maxRetries} retries)...`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(operationLocation, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': API_KEY,
        },
      });

      if (response.status === 200) {
        const result = await response.json();
        if (result.status === 'succeeded') {
          console.log(`✅ Analysis complete!`);
          return result;
        } else if (result.status === 'failed') {
          console.log(`❌ Analysis failed: ${result.error}`);
          return null;
        } else {
          console.log(`  Status: ${result.status} (${i + 1}/${maxRetries})`);
          // Wait 2 seconds before next poll
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.error(`Polling error: ${error.message}`);
    }
  }

  console.log('⏱️  Timeout waiting for result');
  return null;
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║            Test Azure DI with Real Receipts from S3                           ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');

  // Get latest receipts
  const receipts = getLatestReceipts(3);
  if (receipts.length === 0) {
    console.log('❌ No receipts found in S3');
    process.exit(1);
  }

  console.log(`Found ${receipts.length} receipts:`);
  receipts.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.path} (${r.size} bytes)`);
  });

  // Test each receipt
  const results = [];
  for (const receipt of receipts) {
    const receiptName = receipt.path.split('/').pop();

    // Generate signed URL
    const signedUrl = generateSignedUrl(receipt.path);
    if (!signedUrl) {
      results.push({ success: false, error: 'Failed to generate signed URL', receiptName });
      continue;
    }

    // Analyze receipt
    const result = await analyzeReceipt(signedUrl, receiptName);
    results.push(result);

    // Delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              SUMMARY                                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}`);
  successful.forEach(r => {
    if (r.operationLocation) {
      console.log(`   - ${r.receiptName} (async - pending results)`);
    } else {
      console.log(`   - ${r.receiptName} (complete)`);
    }
  });

  console.log(`\n❌ Failed: ${failed.length}`);
  failed.forEach(r => {
    console.log(`   - ${r.receiptName}: ${r.error}`);
  });

  if (successful.length > 0) {
    console.log(`\n🎯 RESULT: Azure DI API is working correctly!`);
    console.log(`✅ Accepted ${successful.length} receipts for analysis`);
  }

  process.exit(successful.length > 0 ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
