#!/usr/bin/env node
/**
 * Test MultiModelAnalyzer with Azure DI Integration
 *
 * Tests the actual MultiModelAnalyzer from infra/lambda/shared-layer
 * with real Azure Document Intelligence credentials.
 *
 * Usage:
 *   export AZURE_DI_ENDPOINT=...
 *   export AZURE_DI_API_KEY=...
 *   node test-multimodel-analyzer.mjs
 */

// Add shared Layer to module path for local testing
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedLayerPath = path.resolve(__dirname, '../../infra/lambda/shared-layer/nodejs/shared');

// Dynamic import with explicit path resolution
const { MultiModelAnalyzer } = await import(sharedLayerPath + '/model-analyzer.mjs');
const { logger } = await import(sharedLayerPath + '/logger.mjs');

console.log('🚀 MultiModelAnalyzer Test with Azure DI');
console.log('=========================================\n');

// Verify environment variables
console.log('📋 Environment Check:');
if (!process.env.AZURE_DI_ENDPOINT) {
  console.error('❌ Missing: AZURE_DI_ENDPOINT');
  console.error('   Set: export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/');
  process.exit(1);
}
if (!process.env.AZURE_DI_API_KEY) {
  console.error('❌ Missing: AZURE_DI_API_KEY');
  console.error('   Set: export AZURE_DI_API_KEY=your-key');
  process.exit(1);
}

console.log(`✅ AZURE_DI_ENDPOINT: ${process.env.AZURE_DI_ENDPOINT.substring(0, 50)}...`);
console.log(`✅ AZURE_DI_API_KEY: ***\n`);

// Minimal valid JPEG (1x1 white pixel)
const minimalJpeg =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k';

async function runTest() {
  try {
    const analyzer = new MultiModelAnalyzer();
    const traceId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    console.log('🔧 Running MultiModelAnalyzer.analyzeReceipt()...\n');

    const result = await analyzer.analyzeReceipt({
      imageBase64: minimalJpeg,
      imageFormat: 'jpeg',
      s3Key: 'uploads/test-receipt.jpg',
      bucket: 'test-bucket',
      traceId: traceId,
      imageId: 'test-receipt',
    });

    console.log('✅ Analysis Completed\n');

    console.log('📊 Results by Model:');
    console.log('=====================\n');

    // Display results from each model
    if (result.textract) {
      console.log('📄 Textract:');
      console.log(`   Status: ${result.textract ? '✅ Completed' : '❌ Failed'}`);
      if (result.textract.vendor) {
        console.log(`   Vendor: ${result.textract.vendor}`);
        console.log(`   Amount: ${result.textract.totalAmount || 'N/A'}`);
        console.log(`   Tax: ${result.textract.taxAmount || 'N/A'}`);
      } else {
        console.log('   (No fields extracted)');
      }
    }

    if (result.nova_mini) {
      console.log('\n🤖 Nova Mini:');
      console.log(`   Status: ${result.nova_mini ? '✅ Completed' : '❌ Failed'}`);
      if (result.nova_mini.vendor) {
        console.log(`   Vendor: ${result.nova_mini.vendor}`);
        console.log(`   Amount: ${result.nova_mini.totalAmount || 'N/A'}`);
        console.log(`   Confidence: ${result.nova_mini.confidence || 'N/A'}%`);
      } else {
        console.log('   (No fields extracted)');
      }
    }

    if (result.nova_pro) {
      console.log('\n🤖 Nova Pro:');
      console.log(`   Status: ${result.nova_pro ? '✅ Completed' : '❌ Failed'}`);
      if (result.nova_pro.vendor) {
        console.log(`   Vendor: ${result.nova_pro.vendor}`);
        console.log(`   Amount: ${result.nova_pro.totalAmount || 'N/A'}`);
        console.log(`   Confidence: ${result.nova_pro.confidence || 'N/A'}%`);
      } else {
        console.log('   (No fields extracted)');
      }
    }

    if (result.azure_di) {
      console.log('\n☁️  Azure Document Intelligence:');
      console.log(`   Status: ${result.azure_di ? '✅ Completed' : '❌ Failed'}`);
      if (result.azure_di.vendor) {
        console.log(`   ✅ Vendor: ${result.azure_di.vendor}`);
        console.log(`   ✅ Amount: ${result.azure_di.totalAmount || 'N/A'}`);
        console.log(`   ✅ Tax: ${result.azure_di.taxAmount || 'N/A'}`);
        console.log(`   ✅ Confidence: ${result.azure_di.confidence || 'N/A'}%`);
      } else {
        console.log('   ⚠️  No fields extracted (expected with minimal test image)');
      }
    }

    console.log('\n📋 Comparison Summary:');
    console.log(`   Status: ${result.comparisonStatus}`);
    console.log(`   Success: ${result.successCount}/${result.failureCount + result.successCount} models`);
    if (result.comparisonErrors && result.comparisonErrors.length > 0) {
      console.log(`   Errors: ${result.comparisonErrors.length}`);
      result.comparisonErrors.forEach((err) => {
        console.log(`      - ${err.model}: ${err.error}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test Completed Successfully!');
    console.log('='.repeat(60) + '\n');

    return true;
  } catch (error) {
    console.error('\n❌ Test Failed:');
    console.error(`   Error: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

// Run the test
const success = await runTest();
process.exit(success ? 0 : 1);
