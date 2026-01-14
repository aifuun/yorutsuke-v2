/**
 * Poll Azure Document Intelligence for Analysis Results
 *
 * Usage:
 *   node poll-results.mjs <operationLocation1> [operationLocation2] ...
 *
 * Example:
 *   node poll-results.mjs \
 *     "https://rj0088.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-invoice/analyzeResults/22c9fb14-18cc-4292-ad96-3ae6cefcbbaa?api-version=2024-11-30"
 */

// Configuration
const API_KEY = process.env.AZURE_DI_API_KEY || '<REDACTED_SECRET>';

// Get operation locations from command line
const operationLocations = process.argv.slice(2);

if (operationLocations.length === 0) {
  console.log('Usage: node poll-results.mjs <operationLocation> [operationLocation2] ...');
  process.exit(1);
}

/**
 * Display extracted invoice fields
 */
function displayInvoiceFields(doc) {
  const fields = doc.fields || {};

  console.log('\n📋 Extracted Fields:');

  // Key fields
  const keyFields = [
    { key: 'MerchantName', label: '🏪 Merchant' },
    { key: 'InvoiceId', label: '🔢 Invoice ID' },
    { key: 'TransactionDate', label: '📅 Date' },
    { key: 'Total', label: '💰 Total' },
    { key: 'TotalTax', label: '📊 Tax' },
    { key: 'SubTotal', label: '📌 Subtotal' },
  ];

  keyFields.forEach(({ key, label }) => {
    const field = fields[key];
    if (field && field.value) {
      const confidence = field.confidence ? `(${(field.confidence * 100).toFixed(0)}%)` : '';
      console.log(`  ${label}: ${field.value} ${confidence}`);
    }
  });

  // Line items
  if (fields.Items && fields.Items.value && Array.isArray(fields.Items.value)) {
    console.log(`\n📦 Items (${fields.Items.value.length}):`);
    fields.Items.value.slice(0, 5).forEach((item, i) => {
      const desc = item.fields?.Description?.value || 'Unknown';
      const qty = item.fields?.Quantity?.value || '1';
      const amount = item.fields?.Amount?.value || 'N/A';
      console.log(`  ${i + 1}. ${desc} x${qty} = ${amount}`);
    });
    if (fields.Items.value.length > 5) {
      console.log(`  ... and ${fields.Items.value.length - 5} more items`);
    }
  }
}

/**
 * Poll single operation result
 */
async function pollResult(operationLocation, index) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📄 Operation ${index + 1}`);
  console.log(`URL: ${operationLocation.substring(0, 80)}...`);
  console.log('='.repeat(80));

  const maxRetries = 30; // ~1 minute with 2s intervals
  let lastStatus = 'unknown';

  for (let retry = 0; retry < maxRetries; retry++) {
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
          console.log(`\n✅ SUCCESS - Analysis complete!\n`);

          if (result.analyzeResult && result.analyzeResult.documents) {
            result.analyzeResult.documents.forEach((doc, i) => {
              console.log(`\nDocument ${i + 1}:`);
              displayInvoiceFields(doc);
            });

            return {
              success: true,
              operationLocation,
              result,
              documents: result.analyzeResult.documents.length,
            };
          }
        } else if (result.status === 'failed') {
          console.log(`\n❌ FAILED`);
          console.log(`Error: ${result.error?.message || 'Unknown error'}`);

          return {
            success: false,
            operationLocation,
            error: result.error,
          };
        } else if (result.status === 'running') {
          lastStatus = 'running';
          console.log(`⏳ Status: ${result.status} - analyzing... (${retry + 1}/${maxRetries})`);
        } else {
          lastStatus = result.status;
          console.log(`⏳ Status: ${result.status} (${retry + 1}/${maxRetries})`);
        }
      } else {
        console.log(`⚠️  HTTP ${response.status} - retrying...`);
      }

      // Wait before next poll (exponential backoff: 2s, 2s, 2s...)
      const waitTime = 2000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    } catch (error) {
      console.log(`⚠️  Error: ${error.message} - retrying...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n⏱️  Timeout after ${maxRetries} retries (last status: ${lastStatus})`);
  return {
    success: false,
    operationLocation,
    error: 'Timeout',
  };
}

/**
 * Main runner
 */
async function runPolling() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║           Poll Azure DI Results for Receipt Analysis                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');

  console.log(`\nPolling ${operationLocations.length} operation(s)...\n`);

  const results = [];
  for (let i = 0; i < operationLocations.length; i++) {
    const result = await pollResult(operationLocations[i], i);
    results.push(result);

    // Delay between polling different operations
    if (i < operationLocations.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              SUMMARY                                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}`);
  successful.forEach((r, i) => {
    console.log(`   ${i + 1}. Extracted from ${r.documents} document(s)`);
  });

  console.log(`\n❌ Failed: ${failed.length}`);
  failed.forEach((r, i) => {
    console.log(`   ${i + 1}. Error: ${r.error?.message || r.error}`);
  });

  if (successful.length > 0) {
    console.log(`\n🎯 RESULT: Azure DI successfully extracted data from ${successful.length} receipt(s)`);
  }

  process.exit(successful.length > 0 ? 0 : 1);
}

// Run polling
runPolling().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
