#!/usr/bin/env node

/**
 * 本地测试 Bedrock Nova 模型
 *
 * 用途: 在部署到 Lambda 之前，验证 Nova Mini 和 Nova Pro 是否工作
 *
 * 使用方法:
 *   export AWS_PROFILE=dev
 *   export AWS_REGION=us-east-1
 *   export TEST_IMAGE_URL="https://example.com/receipt.jpg"
 *   node test-bedrock-nova.js
 *
 * 预期输出:
 *   ✅ Nova Mini: { vendor: "...", totalAmount: 123, ... }
 *   ✅ Nova Pro: { vendor: "...", totalAmount: 123, ... }
 */

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// ============================================================================
// 配置
// ============================================================================

const TEST_IMAGE_URL = process.env.TEST_IMAGE_URL || "https://raw.githubusercontent.com/Azure-Samples/cognitive-services-REST-api-samples/master/curl/form-recognizer/sample-invoice.pdf";
const REGION = process.env.AWS_REGION || "us-east-1";
const PROFILE = process.env.AWS_PROFILE || "dev";

// 模型定义
const MODELS = {
  NOVA_MINI: "us.amazon.nova-micro-v1:0",
  NOVA_PRO: "us.amazon.nova-pro-v1:0",
};

// OCR 提示词
const OCR_PROMPT = `Extract receipt information in JSON format:
{
  "vendor": "Store name",
  "totalAmount": 123.45,
  "taxAmount": 10.00,
  "subtotal": 113.45,
  "currency": "JPY",
  "date": "2024-01-14",
  "items": [
    {"name": "Item", "price": 10.00, "quantity": 1}
  ]
}

Return only valid JSON, no markdown.`;

// ============================================================================
// 业务逻辑（纯函数，可直接用于 shared-layer）
// ============================================================================

/**
 * 调用 Bedrock 模型
 * @param {string} modelId - Nova Mini 或 Nova Pro
 * @param {string} imageBase64 - Base64 编码的图片
 * @returns {Promise<Object>} 解析的结果
 */
async function invokeBedrockModel(client, modelId, imageBase64) {
  const payload = {
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: OCR_PROMPT,
          },
        ],
      },
    ],
    max_tokens: 1024,
    temperature: 0.1,
  };

  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));

  // 提取文本响应
  const textContent = body.content?.[0]?.text;
  if (!textContent) {
    throw new Error(`No text response from ${modelId}`);
  }

  // 尝试解析 JSON
  try {
    return JSON.parse(textContent);
  } catch {
    // 如果是 markdown 包裹的 JSON，尝试提取
    const jsonMatch = textContent.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    throw new Error(`Invalid JSON from ${modelId}: ${textContent.substring(0, 100)}`);
  }
}

/**
 * 标准化 Bedrock 结果
 */
function normalizeBedrockResult(rawResult) {
  return {
    vendor: rawResult.vendor || null,
    totalAmount: parseFloat(rawResult.totalAmount) || null,
    taxAmount: parseFloat(rawResult.taxAmount) || null,
    subtotal: parseFloat(rawResult.subtotal) || null,
    currency: rawResult.currency || "JPY",
    date: rawResult.date || null,
    lineItems: rawResult.items || [],
    confidence: 85, // Bedrock 的置信度通常较高
  };
}

// ============================================================================
// 测试
// ============================================================================

async function fetchImageAsBase64(imageUrl) {
  console.log(`📥 Downloading image from: ${imageUrl}`);
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString("base64");
}

async function runTests() {
  console.log("\n🚀 Bedrock Nova 本地测试\n");
  console.log(`配置:`);
  console.log(`  Region: ${REGION}`);
  console.log(`  Profile: ${PROFILE}`);
  console.log(`  Image URL: ${TEST_IMAGE_URL}\n`);

  // Step 1: 初始化客户端
  console.log("1️⃣ 初始化 Bedrock 客户端...");
  const client = new BedrockRuntimeClient({ region: REGION });
  console.log("   ✅ 已连接\n");

  // Step 2: 下载图片
  console.log("2️⃣ 下载测试图片...");
  let imageBase64;
  try {
    imageBase64 = await fetchImageAsBase64(TEST_IMAGE_URL);
    console.log(`   ✅ 已下载 (${(imageBase64.length / 1024).toFixed(1)} KB)\n`);
  } catch (error) {
    console.error(`   ❌ 下载失败: ${error.message}`);
    console.log("\n💡 提示: 使用本地文件而不是 URL");
    console.log("   export TEST_IMAGE_PATH='/path/to/receipt.jpg'");
    process.exit(1);
  }

  // Step 3: 测试 Nova Mini
  console.log("3️⃣ 测试 Nova Mini 模型...");
  try {
    const miniResult = await invokeBedrockModel(client, MODELS.NOVA_MINI, imageBase64);
    const normalizedMini = normalizeBedrockResult(miniResult);
    console.log(`   ✅ Nova Mini 成功`);
    console.log(`   结果:`, JSON.stringify(normalizedMini, null, 4));
  } catch (error) {
    console.error(`   ❌ Nova Mini 失败: ${error.message}`);
  }

  console.log();

  // Step 4: 测试 Nova Pro
  console.log("4️⃣ 测试 Nova Pro 模型...");
  try {
    const proResult = await invokeBedrockModel(client, MODELS.NOVA_PRO, imageBase64);
    const normalizedPro = normalizeBedrockResult(proResult);
    console.log(`   ✅ Nova Pro 成功`);
    console.log(`   结果:`, JSON.stringify(normalizedPro, null, 4));
  } catch (error) {
    console.error(`   ❌ Nova Pro 失败: ${error.message}`);
  }

  console.log("\n✨ 测试完成!\n");
  console.log("下一步:");
  console.log("  1. 如果上面的输出格式正确，可以将 invokeBedrockModel 和");
  console.log("     normalizeBedrockResult 函数复制到:");
  console.log("     infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs");
  console.log("\n  2. 然后运行: npm run layer:publish");
  console.log("     最后运行: npm run deploy\n");
}

// ============================================================================
// 主入口
// ============================================================================

runTests().catch((error) => {
  console.error("\n❌ 测试失败:\n", error);
  process.exit(1);
});
