/**
 * Local Azure Document Intelligence API Testing
 *
 * This script tests different API versions and formats to find the correct endpoint.
 * Once verified locally, apply the same format to Lambda.
 *
 * Reference: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/quickstarts/get-started-sdks-rest-api?view=doc-intel-4.0.0
 */

// Configuration from environment
const ENDPOINT = process.env.AZURE_DI_ENDPOINT || 'https://rj0088.cognitiveservices.azure.com/';
const API_KEY = process.env.AZURE_DI_API_KEY || '<REDACTED_SECRET>';

// Test document URL
// Use a public test image from Azure docs or your own signed S3 URL
// For now, we're testing endpoint format, not actual OCR
const TEST_S3_URL = 'https://raw.githubusercontent.com/Azure-Samples/cognitive-services-REST-api-samples/master/curl/form-recognizer/invoice.png';

/**
 * Test different API formats
 */
const API_FORMATS = [
  {
    name: 'v4.0 (Latest GA - 2024-11-30)',
    path: '/documentintelligence/documentModels/prebuilt-invoice:analyze',
    apiVersion: '2024-11-30',
    description: 'Official format: documentModels (camelCase) + :analyze (colon)',
  },
  {
    name: 'v3.1 (GA - 2023-07-31)',
    path: '/formrecognizer/documentModels/prebuilt-invoice:analyze',
    apiVersion: '2023-07-31',
    description: 'Legacy format: formrecognizer namespace',
  },
  {
    name: 'v3.0 (GA - 2022-08-31)',
    path: '/formrecognizer/documentModels/prebuilt-invoice:analyze',
    apiVersion: '2022-08-31',
    description: 'Legacy format: formrecognizer namespace',
  },
  {
    name: 'Incorrect: document-models (with hyphen)',
    path: '/documentintelligence/document-models/prebuilt-invoice/analyze',
    apiVersion: '2024-02-29-preview',
    description: '❌ Wrong: hyphen + /analyze instead of :analyze',
  },
];

/**
 * Test single API format
 */
async function testApiFormat(format) {
  const baseUrl = ENDPOINT.replace(/\/$/, '');
  const url = `${baseUrl}${format.path}?api-version=${format.apiVersion}`;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${format.name}`);
  console.log(`${format.description}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(80));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': API_KEY,
      },
      body: JSON.stringify({
        urlSource: TEST_S3_URL,
      }),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Headers:`);
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase().startsWith('operation') || key.toLowerCase().startsWith('content')) {
        console.log(`  ${key}: ${value.substring(0, 100)}`);
      }
    }

    const body = await response.text();
    if (body) {
      try {
        const json = JSON.parse(body);
        console.log(`Response: ${JSON.stringify(json, null, 2).substring(0, 500)}`);
      } catch {
        console.log(`Response: ${body.substring(0, 200)}`);
      }
    }

    if (response.status === 202) {
      console.log(`✅ SUCCESS: Got 202 Accepted - API format is CORRECT`);
      const operationLocation = response.headers.get('operation-location');
      console.log(`Operation-Location: ${operationLocation}`);
      return { success: true, format, operationLocation };
    } else if (response.status === 404) {
      console.log(`❌ FAILED: 404 Not Found - endpoint path is INCORRECT`);
      return { success: false, format, error: '404 (bad path)' };
    } else if (response.status === 400) {
      // 400 with "Could not download" means API path is correct, but test URL failed
      if (body.includes('download')) {
        console.log(`✅ SUCCESS (200-level): API path is CORRECT (test URL couldn't be downloaded)`);
        return { success: true, format, error: 'Note: test URL needs access' };
      } else {
        console.log(`⚠️  WARNING: 400 Bad Request - check request format`);
        return { success: false, format, error: '400 (check format)' };
      }
    } else if (response.status === 401 || response.status === 403) {
      console.log(`❌ FAILED: ${response.status} - authentication/authorization issue`);
      return { success: false, format, error: `${response.status} (auth)` };
    } else {
      console.log(`⚠️  UNEXPECTED: ${response.status} - check details above`);
      return { success: false, format, error: `${response.status}` };
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { success: false, format, error: error.message };
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║       Azure Document Intelligence - Local API Format Testing                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\nEndpoint: ${ENDPOINT}`);
  console.log(`Test Document: ${TEST_S3_URL}`);
  console.log('\nTesting API formats...\n');

  const results = [];
  for (const format of API_FORMATS) {
    const result = await testApiFormat(format);
    results.push(result);

    // Delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              TEST SUMMARY                                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}`);
  successful.forEach(r => {
    console.log(`   - ${r.format.name}`);
    console.log(`     Path: ${r.format.path}?api-version=${r.format.apiVersion}`);
  });

  console.log(`\n❌ Failed: ${failed.length}`);
  failed.forEach(r => {
    console.log(`   - ${r.format.name} (${r.error})`);
  });

  if (successful.length > 0) {
    console.log('\n🎯 RECOMMENDATION FOR LAMBDA:');
    const correct = successful[0];
    console.log(`Use API format: ${correct.format.name}`);
    console.log(`Path: ${correct.format.path}`);
    console.log(`API Version: ${correct.format.apiVersion}`);

    console.log('\nJavaScript code for Lambda:');
    console.log('```javascript');
    console.log(`const apiUrl = \`\${endpoint.replace(/\\/$/, '')}${correct.format.path}?api-version=${correct.format.apiVersion}\`;`);
    console.log('```');
  }

  process.exit(successful.length > 0 ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
