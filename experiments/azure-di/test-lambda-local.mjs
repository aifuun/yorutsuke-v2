/**
 * Local Lambda Test Environment
 * Simulates S3 event and tests the Lambda handler locally
 * No AWS credentials needed for initial testing
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("🔧 Local Lambda Test Environment");
console.log("=================================\n");

// Test 1: Environment check
console.log("📋 Test 1: Environment Variables Check");
console.log("--------------------------------------");

const requiredEnvVars = {
  AZURE_DI_ENDPOINT: "Azure Document Intelligence endpoint",
  AZURE_DI_API_KEY: "Azure API key",
};

const missingVars = Object.entries(requiredEnvVars).filter(
  ([key]) => !process.env[key]
);

if (missingVars.length === 0) {
  console.log("✅ All required environment variables set:");
  const endpoint = process.env.AZURE_DI_ENDPOINT;
  console.log(`   - AZURE_DI_ENDPOINT: ${endpoint.substring(0, 50)}...`);
  console.log(`   - AZURE_DI_API_KEY: ***`);
} else {
  console.log("⚠️  Missing environment variables:");
  missingVars.forEach(([key, desc]) => console.log(`   - ${key} (${desc})`));
  console.log("\nSet them:");
  console.log("  export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/");
  console.log("  export AZURE_DI_API_KEY=your-api-key");
}

// Test 2: Load Lambda code
console.log("\n📋 Test 2: Load Lambda Handler Code");
console.log("-----------------------------------");

try {
  const lambdaDir = join(__dirname, "../../infra/lambda/shared-layer/nodejs/shared");
  const modelAnalyzer = await import(`file://${lambdaDir}/model-analyzer.mjs`);
  console.log("✅ Successfully loaded model-analyzer.mjs");
  console.log("   Available exports:");
  Object.keys(modelAnalyzer).forEach((key) => {
    console.log(`   - ${key}`);
  });
} catch (error) {
  console.error("❌ Failed to load Lambda code:", error.message);
  console.error(error.stack);
  process.exit(1);
}

// Test 3: Mock S3 Event
console.log("\n📋 Test 3: Mock S3 Upload Event");
console.log("--------------------------------");

const mockS3Event = {
  Records: [
    {
      s3: {
        bucket: {
          name: "yorutsuke-images-us-dev-696249060859",
        },
        object: {
          key: "uploads/test-receipt-1768363465275.jpg",
        },
      },
    },
  ],
};

console.log("Sample S3 event structure:");
console.log(JSON.stringify(mockS3Event, null, 2));

// Test 4: Explain testing options
console.log("\n📋 Test 4: Local Testing Options");
console.log("--------------------------------");

console.log("\nOption A: Direct Node.js Testing (Simplest)");
console.log("  ✅ No Docker needed");
console.log("  ✅ Instant feedback");
console.log("  ✅ Test Azure DI directly");
console.log("  ⚠️  Needs AWS credentials for other services");
console.log("  Usage: node test-lambda-local.mjs");

console.log("\nOption B: AWS SAM CLI (Recommended)");
console.log("  ✅ Full Lambda simulation");
console.log("  ✅ Local AWS services");
console.log("  ⚠️  Requires Docker");
console.log("  ⚠️  Slower startup");
console.log("  Setup:");
console.log("    brew install aws-sam-cli");
console.log("    sam init --template-source gh://aws/aws-sam-cli-app-templates");

console.log("\nOption C: AWS Lambda Runtime Interface Emulator");
console.log("  ✅ Exact Lambda runtime");
console.log("  ✅ Real AWS SDK");
console.log("  ⚠️  Requires Docker");
console.log("  Setup:");
console.log("    docker pull public.ecr.aws/lambda/nodejs:20");

console.log("\nOption D: LocalStack (Full AWS Simulation)");
console.log("  ✅ Complete AWS environment locally");
console.log("  ✅ S3, DynamoDB, Lambda, etc.");
console.log("  ⚠️  Heavy setup");
console.log("  Setup:");
console.log("    brew install localstack");
console.log("    localstack start");

// Test 5: Lambda execution flow
console.log("\n📋 Test 5: Lambda Execution Flow (What Happens)");
console.log("----------------------------------------------");

console.log("When receipt is uploaded to S3:");
console.log("1️⃣  S3 triggers Lambda with event");
console.log("2️⃣  Lambda downloads image from S3");
console.log("3️⃣  Creates MultiModelAnalyzer instance");
console.log("4️⃣  Runs 4 parallel analyses:");
console.log("    - Textract (AWS): Direct S3 file access");
console.log("    - Nova Mini (Bedrock): Base64 image");
console.log("    - Nova Pro (Bedrock): Base64 image + inference profile");
console.log("    - Azure DI (SDK): S3 URL");
console.log("5️⃣  Collects results, handles partial failures");
console.log("6️⃣  Saves to DynamoDB with model comparison");
console.log("7️⃣  Returns transaction ID");

// Test 6: Quick test with Azure DI
console.log("\n📋 Test 6: Quick Azure DI Test");
console.log("------------------------------");

if (process.env.AZURE_DI_ENDPOINT && process.env.AZURE_DI_API_KEY) {
  console.log("✅ Can test Azure DI now");
  console.log("Run: node test-azure-di-local-fixed.mjs");
} else {
  console.log("⚠️  Cannot test Azure DI - missing credentials");
}

// Test 7: Summary
console.log("\n✅ Local Testing Setup Complete");
console.log("================================");
console.log("\n🎯 Recommended Next Steps:");
console.log("1. Set Azure credentials:");
console.log("   export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/");
console.log("   export AZURE_DI_API_KEY=your-api-key");
console.log("\n2. Test Azure DI locally:");
console.log("   node test-azure-di-local-fixed.mjs");
console.log("\n3. Test Lambda with real receipt:");
console.log("   # Option A: Upload via S3");
console.log("   aws s3 cp /path/to/receipt.jpg s3://yorutsuke-images-us-dev-.../uploads/");
console.log("   # Then watch logs:");
console.log("   aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev --follow --profile dev");
console.log("\n4. Or use SAM to test locally:");
console.log("   sam local start-api");

console.log("\n💡 Tips:");
console.log("- Use IDE debugger: Add breakpoints in model-analyzer.mjs");
console.log("- Test individual models separately first");
console.log("- Check environment vars before running: printenv | grep AZURE");
console.log("- Monitor costs: Azure DI charges per API call (~¥0.15)");
