#!/usr/bin/env node

/**
 * test-azure-di-local.mjs - Pure Node.js Local Test for Azure Document Intelligence
 *
 * 用途: 在本地测试 Lambda 对 Azure DI 的访问，不依赖 AWS 服务
 * 原理: 复用 shared-layer 中的 analyzeAzureDI 和 normalizeAzureDIResult 方法
 * 适配: ADR-016 Layer 1 - Pure Node.js 本地测试
 *
 * 使用方法:
 *   export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
 *   export AZURE_DI_API_KEY=your-key
 *   node test-azure-di-local.mjs [image-path]
 *
 * 示例:
 *   # 使用本地测试图片
 *   node test-azure-di-local.mjs ~/test-receipt.jpg
 *
 *   # 使用生成的样本 base64
 *   node test-azure-di-local.mjs --sample
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ============================================================================
// 日志工具（模拟 Lambda 环境）
// ============================================================================

const logger = {
  debug: (tag, data) => console.log(`[DEBUG] ${tag}`, JSON.stringify(data, null, 2)),
  info: (tag, data) => console.log(`[INFO] ${tag}`, JSON.stringify(data, null, 2)),
  warn: (tag, data) => console.warn(`[WARN] ${tag}`, JSON.stringify(data, null, 2)),
  error: (tag, data) => console.error(`[ERROR] ${tag}`, JSON.stringify(data, null, 2)),
};

// ============================================================================
// Azure DI 分析器（从 shared-layer 复制的核心逻辑）
// ============================================================================

class AzureDIAnalyzer {
  /**
   * 分析收据图片（使用 Base64）
   */
  async analyzeAzureDI(imageBase64, traceId) {
    try {
      const endpoint = process.env.AZURE_DI_ENDPOINT?.replace(/\/$/, ""); // 移除末尾斜杠
      const apiKey = process.env.AZURE_DI_API_KEY;

      if (!endpoint || !apiKey) {
        throw new Error("Azure DI credentials not configured (AZURE_DI_ENDPOINT, AZURE_DI_API_KEY)");
      }

      logger.debug("AZURE_DI_REQUEST_START", {
        traceId,
        endpoint,
        method: "base64-encoded-image",
        imageSize: imageBase64.length,
      });

      // Step 1: 提交分析请求
      const analyzeUrl = `${endpoint}/documentModels/prebuilt-receipt:analyze?api-version=2024-02-29-preview`;

      logger.info("AZURE_DI_SUBMITTING_REQUEST", {
        traceId,
        url: analyzeUrl,
      });

      const analyzeResponse = await fetch(analyzeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": apiKey,
        },
        body: JSON.stringify({
          base64Source: imageBase64,
        }),
      });

      if (!analyzeResponse.ok) {
        const errorBody = await analyzeResponse.text();
        logger.error("AZURE_DI_SUBMIT_FAILED", {
          status: analyzeResponse.status,
          statusText: analyzeResponse.statusText,
          body: errorBody,
        });
        throw new Error(`Azure API error (${analyzeResponse.status}): ${errorBody}`);
      }

      // 获取 Operation-Location 用于轮询
      const operationLocation = analyzeResponse.headers.get("Operation-Location");
      if (!operationLocation) {
        throw new Error("No Operation-Location header in response");
      }

      logger.debug("AZURE_DI_ANALYSIS_SUBMITTED", {
        traceId,
        operationLocation: operationLocation.substring(0, 100),
      });

      // Step 2: 轮询结果
      let analyzeResult = null;
      const maxRetries = 30;

      for (let i = 0; i < maxRetries; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 等待 1 秒

        logger.debug("AZURE_DI_POLLING", {
          traceId,
          attempt: i + 1,
          maxRetries,
        });

        const statusResponse = await fetch(operationLocation, {
          method: "GET",
          headers: {
            "Ocp-Apim-Subscription-Key": apiKey,
          },
        });

        if (!statusResponse.ok) {
          throw new Error(`Status check failed (${statusResponse.status})`);
        }

        const statusData = await statusResponse.json();

        if (statusData.status === "succeeded") {
          analyzeResult = statusData.analyzeResult;
          logger.debug("AZURE_DI_RESPONSE_RECEIVED", {
            traceId,
            status: statusData.status,
            hasDocuments: !!analyzeResult?.documents?.length,
          });
          break;
        } else if (statusData.status === "failed") {
          throw new Error(`Analysis failed: ${statusData.error?.message || "Unknown error"}`);
        }
        // 继续轮询
      }

      if (!analyzeResult) {
        throw new Error("Analysis polling timeout after 30 seconds");
      }

      return this.normalizeAzureDIResult(analyzeResult);
    } catch (error) {
      logger.error("AZURE_DI_ERROR", {
        traceId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 规范化 Azure DI 响应
   */
  normalizeAzureDIResult(analyzeResult) {
    const doc = analyzeResult?.documents?.[0];
    if (!doc) {
      return null;
    }

    const fields = doc.fields || {};
    const lineItems = [];

    // 提取行项目
    if (fields.Items?.valueArray) {
      fields.Items.valueArray.forEach((item) => {
        const itemFields = item.valueObject || {};
        lineItems.push({
          description: itemFields.Description?.valueString || "",
          quantity: itemFields.Quantity?.valueNumber || 1,
          unitPrice: itemFields.Price?.valueNumber || 0,
          totalPrice: itemFields.TotalPrice?.valueNumber || 0,
        });
      });
    }

    return {
      vendor: fields.MerchantName?.valueString || "",
      lineItems: lineItems.length > 0 ? lineItems : undefined,
      subtotal: fields.Subtotal?.valueNumber || undefined,
      taxAmount: fields.TotalTax?.valueNumber || undefined,
      totalAmount: fields.Total?.valueNumber || 0,
      confidence: doc.confidence ? Math.round(doc.confidence * 100) : undefined,
      rawResponse: {
        documentType: doc.doc_type,
        pages: analyzeResult.pages?.length || 0,
      },
    };
  }
}

// ============================================================================
// 测试工具函数
// ============================================================================

/**
 * 读取图片文件并转换为 Base64
 */
function readImageAsBase64(imagePath) {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString("base64");
}

/**
 * 生成样本收据的 Base64 数据
 * 这是一个 1x1 的最小 JPEG 图片用于测试
 */
function generateSampleReceiptBase64() {
  // 这是一个有效的最小 JPEG 文件（1x1 像素）
  const minimalJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a, 0xff, 0xc4, 0x00, 0x14,
    0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0xff, 0xd9,
  ]);

  return minimalJpeg.toString("base64");
}

/**
 * 生成测试报告
 */
function generateReport(result, startTime) {
  const duration = Date.now() - startTime;

  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║          Azure Document Intelligence 本地测试结果             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  console.log("📊 测试详情:");
  console.log(`   耗时: ${duration}ms`);
  console.log(`   状态: ${result.vendor ? "✅ 成功" : "⚠️ 部分结果"}\n`);

  console.log("📝 提取的字段:");
  console.log(`   商户名: ${result.vendor || "N/A"}`);
  console.log(`   小计: ${result.subtotal ?? "N/A"}`);
  console.log(`   税额: ${result.taxAmount ?? "N/A"}`);
  console.log(`   总额: ${result.totalAmount ?? "N/A"}`);
  console.log(`   置信度: ${result.confidence ? `${result.confidence}%` : "N/A"}\n`);

  if (result.lineItems && result.lineItems.length > 0) {
    console.log("🛒 行项目:");
    result.lineItems.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.description || "Unknown"}`);
      console.log(`      数量: ${item.quantity}, 单价: ${item.unitPrice}, 小计: ${item.totalPrice}`);
    });
    console.log();
  }

  if (result.rawResponse) {
    console.log("🔧 原始响应信息:");
    console.log(`   文档类型: ${result.rawResponse.documentType}`);
    console.log(`   页数: ${result.rawResponse.pages}\n`);
  }

  console.log("✨ 测试完成！\n");
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const useSample = args.includes("--sample");
  const imagePath = args[0] && !args[0].startsWith("--") ? args[0] : null;

  console.log("🚀 Azure Document Intelligence 本地测试\n");

  // 前置检查
  console.log("📋 前置检查:");
  if (!process.env.AZURE_DI_ENDPOINT) {
    console.error("❌ 缺少环境变量: AZURE_DI_ENDPOINT");
    console.error("   设置方法: export AZURE_DI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/");
    process.exit(1);
  }
  if (!process.env.AZURE_DI_API_KEY) {
    console.error("❌ 缺少环境变量: AZURE_DI_API_KEY");
    console.error("   设置方法: export AZURE_DI_API_KEY=your-api-key");
    process.exit(1);
  }

  console.log("✓ AZURE_DI_ENDPOINT 已配置");
  console.log("✓ AZURE_DI_API_KEY 已配置\n");

  // 准备测试数据
  console.log("📁 准备测试数据:");
  let imageBase64;

  if (useSample) {
    console.log("   使用样本收据图片 (1x1 最小 JPEG)");
    imageBase64 = generateSampleReceiptBase64();
  } else if (imagePath) {
    const resolvedPath = path.resolve(imagePath);
    console.log(`   读取本地文件: ${resolvedPath}`);
    try {
      imageBase64 = readImageAsBase64(resolvedPath);
      console.log(`   ✓ 图片加载成功 (${imageBase64.length} bytes Base64)`);
    } catch (error) {
      console.error(`   ❌ 读取失败: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.error("❌ 请提供图片路径或使用 --sample 参数");
    console.error("   用法: node test-azure-di-local.mjs [image-path | --sample]");
    process.exit(1);
  }

  console.log();

  // 执行测试
  console.log("🔍 向 Azure Document Intelligence 发送请求:");
  const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const analyzer = new AzureDIAnalyzer();
  const startTime = Date.now();

  try {
    const result = await analyzer.analyzeAzureDI(imageBase64, traceId);

    // 生成报告
    generateReport(result, startTime);

    // 输出完整的 JSON 结果
    console.log("📄 完整结果 (JSON):");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\n❌ 测试失败:");
    console.error(`   错误: ${error.message}\n`);

    console.log("💡 故障排查建议:");
    console.log("   1. 验证 Azure 凭证是否正确");
    console.log("   2. 检查网络连接是否正常");
    console.log("   3. 确认 Azure 资源是否可用");
    console.log("   4. 查看 Azure 门户中的使用限额\n");

    process.exit(1);
  }
}

// 运行
main().catch(console.error);
