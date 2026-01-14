/**
 * Direct Lambda Handler Test (No Docker Needed)
 *
 * Runs the Lambda handler directly in Node.js
 * Simulates the S3 event and tests Azure DI integration
 *
 * Usage:
 *   export AZURE_DI_ENDPOINT=...
 *   export AZURE_DI_API_KEY=...
 *   node test-lambda-direct.mjs
 */

import { MultiModelAnalyzer } from '../../infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs';
import { logger } from '../../infra/lambda/shared-layer/nodejs/shared/logger.mjs';

console.log('🚀 Lambda Handler Direct Test (No Docker)');
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

// Mock S3 Event
const s3Event = {
  Records: [
    {
      s3: {
        bucket: {
          name: 'yorutsuke-images-us-dev-696249060859',
        },
        object: {
          key: 'uploads/1768363465275-test-receipt.jpg',
        },
      },
    },
  ],
};

console.log('📦 S3 Event Simulation:');
console.log(`   Bucket: ${s3Event.Records[0].s3.bucket.name}`);
console.log(`   Key: ${s3Event.Records[0].s3.object.key}\n`);

// Handler function
async function handler(event) {
  console.log('🔧 Lambda Handler Executing\n');

  try {
    const s3Records = event.Records || [];

    if (s3Records.length === 0) {
      console.log('⚠️  No S3 records found');
      return { statusCode: 400, body: 'No S3 records' };
    }

    const results = [];

    for (const record of s3Records) {
      const bucket = record.s3.bucket.name;
      const key = record.s3.object.key;

      console.log(`📊 Processing: s3://${bucket}/${key}`);

      const traceId = `lambda-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Minimal valid JPEG (1x1 white pixel)
      const minimalJpeg =
        '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k';

      try {
        const analyzer = new MultiModelAnalyzer();

        console.log('🔍 Starting multi-model analysis...\n');

        const result = await analyzer.analyzeReceipt({
          imageBase64: minimalJpeg,
          imageFormat: 'jpeg',
          s3Key: key,
          bucket: bucket,
          traceId: traceId,
          imageId: key.split('/').pop(),
        });

        console.log('\n✅ Analysis Completed\n');

        console.log('📊 Model Results:');
        console.log('==================\n');

        // Show results from each model
        if (result.textract) {
          console.log('📄 Textract:');
          console.log(`   Vendor: ${result.textract.vendor || 'N/A'}`);
          console.log(`   Amount: ${result.textract.totalAmount || 'N/A'}`);
          console.log(`   Tax: ${result.textract.taxAmount || 'N/A'}`);
        }

        if (result.nova_mini) {
          console.log('\n🤖 Nova Mini:');
          console.log(`   Vendor: ${result.nova_mini.vendor || 'N/A'}`);
          console.log(`   Amount: ${result.nova_mini.totalAmount || 'N/A'}`);
          console.log(`   Confidence: ${result.nova_mini.confidence || 'N/A'}%`);
        }

        if (result.nova_pro) {
          console.log('\n🤖 Nova Pro:');
          console.log(`   Vendor: ${result.nova_pro.vendor || 'N/A'}`);
          console.log(`   Amount: ${result.nova_pro.totalAmount || 'N/A'}`);
          console.log(`   Confidence: ${result.nova_pro.confidence || 'N/A'}%`);
        }

        if (result.azure_di) {
          console.log('\n☁️  Azure Document Intelligence:');
          if (result.azure_di.vendor) {
            console.log(`   ✅ Vendor: ${result.azure_di.vendor}`);
            console.log(`   ✅ Amount: ${result.azure_di.totalAmount || 'N/A'}`);
            console.log(`   ✅ Tax: ${result.azure_di.taxAmount || 'N/A'}`);
            console.log(`   ✅ Confidence: ${result.azure_di.confidence || 'N/A'}%`);
          } else {
            console.log('   ⚠️  No fields extracted (expected with minimal test image)');
          }
        } else {
          console.log('\n☁️  Azure Document Intelligence:');
          console.log('   ⚠️  Not executed (check credentials)');
        }

        console.log('\n📋 Comparison Status:');
        console.log(`   Status: ${result.comparisonStatus}`);
        console.log(`   Success: ${result.successCount}/4 models`);
        if (result.comparisonErrors) {
          console.log(`   Errors: ${result.comparisonErrors.length}`);
          result.comparisonErrors.forEach((err) => {
            console.log(`      - ${err.model}: ${err.error}`);
          });
        }

        results.push({
          s3Key: key,
          traceId: traceId,
          comparisonStatus: result.comparisonStatus,
          successCount: result.successCount,
          failureCount: result.failureCount,
        });
      } catch (error) {
        console.error(`❌ Analysis failed: ${error.message}`);
        console.error(error.stack);
        results.push({
          s3Key: key,
          error: error.message,
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Receipt analysis completed',
        results: results,
      }),
    };
  } catch (error) {
    console.error(`❌ Handler error: ${error.message}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

// Run handler
handler(s3Event)
  .then((response) => {
    console.log('\n' + '='.repeat(60));
    console.log('📤 Handler Response:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(JSON.parse(response.body), null, 2));
    console.log('='.repeat(60) + '\n');

    if (response.statusCode === 200) {
      console.log('✅ Test Passed!');
    } else {
      console.log('❌ Test Failed');
    }
  })
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
