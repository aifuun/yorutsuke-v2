/**
 * Instant Processor Lambda Handler
 * Tests Receipt Analysis with Multiple AI Models
 *
 * Supports:
 * - AWS Textract (AWS)
 * - Amazon Nova Mini (Bedrock)
 * - Amazon Nova Pro (Bedrock)
 * - Azure Document Intelligence (Azure REST SDK)
 */

import { MultiModelAnalyzer } from '/opt/nodejs/shared/model-analyzer.mjs';
import { logger } from '/opt/nodejs/shared/logger.mjs';

const analyzer = new MultiModelAnalyzer();

/**
 * Lambda handler for S3 receipt uploads
 * Triggers multi-model analysis and saves results
 */
export const handler = async (event) => {
  console.log('📋 Instant Processor Lambda Started');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Parse S3 event
    const s3Records = event.Records || [];

    if (s3Records.length === 0) {
      console.log('⚠️  No S3 records found in event');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No S3 records in event' }),
      };
    }

    const results = [];

    // Process each S3 record
    for (const record of s3Records) {
      const bucket = record.s3.bucket.name;
      const key = record.s3.object.key;

      console.log(`\n📦 Processing S3 object: s3://${bucket}/${key}`);

      // Generate trace ID for this request
      const traceId = `lambda-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Mock image data for testing (minimal JPEG)
      // In production, would download from S3
      const mockImageBase64 =
        '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k';

      try {
        console.log('🔍 Starting multi-model analysis...');

        // Call analyzer
        const analysisResult = await analyzer.analyzeReceipt({
          imageBase64: mockImageBase64,
          imageFormat: 'jpeg',
          s3Key: key,
          bucket: bucket,
          traceId: traceId,
          imageId: key.split('/').pop(),
        });

        console.log('✅ Analysis completed');
        console.log('📊 Results:', JSON.stringify(analysisResult, null, 2));

        results.push({
          s3Key: key,
          traceId: traceId,
          analysisResult: analysisResult,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`❌ Analysis failed for ${key}:`, error.message);
        results.push({
          s3Key: key,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Return results
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Receipt analysis completed',
        recordsProcessed: s3Records.length,
        results: results,
      }),
    };

    console.log('\n📤 Lambda returning:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('❌ Lambda error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Lambda execution failed',
        message: error.message,
      }),
    };
  }
};
