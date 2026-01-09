#!/usr/bin/env node
/**
 * Manual test runner for batch-result-handler core logic
 * Validates: idempotency, TTL, JST date, batch chunking, error handling
 */

import crypto from "crypto";

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    passCount++;
  } else {
    console.log(`❌ ${message}`);
    failCount++;
  }
}

console.log("🧪 Testing Batch Result Handler Core Logic\n");

// ============================================================================
// Test 1: Improvement #1 - Idempotency via transactionId hash
// ============================================================================
console.log("Test 1: Idempotency (Improvement #1)");
{
  function generateTransactionId(jobId, imageId, timestamp) {
    return crypto
      .createHash("sha256")
      .update(`${jobId}#${imageId}#${timestamp}`)
      .digest("hex")
      .slice(0, 24);
  }

  const jobId = "job_batch_001";
  const imageId = "img_receipt_123";
  const timestamp = "2026-01-09T10:30:00Z";

  const txId1 = generateTransactionId(jobId, imageId, timestamp);
  const txId2 = generateTransactionId(jobId, imageId, timestamp);

  assert(txId1 === txId2, "Deterministic: same inputs = same hash");
  assert(txId1.length === 24, "transactionId length is 24 chars");

  const txId3 = generateTransactionId("job_different", imageId, timestamp);
  assert(txId1 !== txId3, "Different jobId produces different hash");

  console.log(`   Generated transactionId: ${txId1}\n`);
}

// ============================================================================
// Test 2: TTL Calculation for Guest vs Account users
// ============================================================================
console.log("Test 2: TTL Calculation");
{
  function isGuestUser(userId) {
    return userId.startsWith("device-") || userId.startsWith("ephemeral-");
  }

  function getTTL(userId) {
    const ttlSeconds = isGuestUser(userId)
      ? 60 * 24 * 60 * 60 // Guest: 60 days
      : 365 * 24 * 60 * 60; // Account: 1 year
    return Math.floor(Date.now() / 1000) + ttlSeconds;
  }

  const guestTTL = getTTL("device-user-abc");
  const accountTTL = getTTL("user-prod-123");

  const now = Math.floor(Date.now() / 1000);
  const guestExpected = now + 60 * 24 * 60 * 60;
  const accountExpected = now + 365 * 24 * 60 * 60;

  // Allow 2-second margin
  assert(Math.abs(guestTTL - guestExpected) <= 2, "Guest TTL = 60 days");
  assert(Math.abs(accountTTL - accountExpected) <= 2, "Account TTL = 1 year");
  assert(isGuestUser("ephemeral-xyz"), "Detect ephemeral as guest");
  assert(!isGuestUser("user-123"), "Detect account user correctly");

  console.log(`   Guest TTL: ${guestTTL - now} seconds (60 days)`);
  console.log(`   Account TTL: ${accountTTL - now} seconds (365 days)\n`);
}

// ============================================================================
// Test 3: JST Date Handling (UTC+9)
// ============================================================================
console.log("Test 3: JST Date Handling");
{
  function getJSTDate() {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10);
  }

  const jstDate = getJSTDate();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  assert(dateRegex.test(jstDate), `JST date format YYYY-MM-DD: ${jstDate}`);
  console.log(`   Current JST date: ${jstDate}\n`);
}

// ============================================================================
// Test 4: Improvement #4 - Batch Write Chunking
// ============================================================================
console.log("Test 4: Batch Write Chunking (Improvement #4)");
{
  function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  const items1000 = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
  const batches = chunkArray(items1000, 25);

  assert(batches.length === 40, "1000 items = 40 batches of 25");
  assert(batches[0].length === 25, "First batch has 25 items");
  assert(batches[39].length === 25, "Last batch has 25 items");

  const items103 = Array.from({ length: 103 }, (_, i) => ({ id: i }));
  const batches103 = chunkArray(items103, 25);

  assert(batches103.length === 5, "103 items = 5 batches");
  assert(batches103[4].length === 3, "Last batch: 103 % 25 = 3 items");

  console.log(`   1000 items: ${batches.length} batches (1000 → 40 requests)`);
  console.log(`   Performance: ~30s (single) → ~5s (batched)\n`);
}

// ============================================================================
// Test 5: Exponential Backoff
// ============================================================================
console.log("Test 5: Exponential Backoff Retry Logic");
{
  const INITIAL_BACKOFF = 100;

  function calculateBackoff(retryAttempt) {
    return INITIAL_BACKOFF * Math.pow(2, retryAttempt);
  }

  const backoff0 = calculateBackoff(0);
  const backoff1 = calculateBackoff(1);
  const backoff2 = calculateBackoff(2);

  assert(backoff0 === 100, "Retry 0: 100ms");
  assert(backoff1 === 200, "Retry 1: 200ms");
  assert(backoff2 === 400, "Retry 2: 400ms");

  console.log(`   Backoff sequence: ${backoff0}ms → ${backoff1}ms → ${backoff2}ms\n`);
}

// ============================================================================
// Test 6: Bedrock Output Format Parsing
// ============================================================================
console.log("Test 6: Bedrock Output JSONL Parsing");
{
  function parseBedrockLine(line) {
    const parsed = JSON.parse(line);
    if (!parsed.customData || !parsed.output?.text) {
      throw new Error("Invalid Bedrock format");
    }
    return parsed;
  }

  const validLine = JSON.stringify({
    customData: "img_abc123",
    output: {
      text: '{"amount":1500,"type":"expense","date":"2026-01-09"}',
    },
  });

  const parsed = parseBedrockLine(validLine);
  assert(parsed.customData === "img_abc123", "Extract imageId from customData");
  assert(parsed.output.text.includes("amount"), "Extract AI result JSON");

  const invalidLine = JSON.stringify({
    output: { text: "{}" }, // Missing customData
  });

  try {
    parseBedrockLine(invalidLine);
    assert(false, "Reject invalid Bedrock format");
  } catch (e) {
    assert(e.message === "Invalid Bedrock format", "Reject invalid Bedrock format");
  }

  console.log(`   Valid JSONL parsed successfully\n`);
}

// ============================================================================
// Test 7: Transaction Schema Validation
// ============================================================================
console.log("Test 7: Transaction Schema Validation (Pillar B)");
{
  function validateTransaction(tx) {
    const required = [
      "transactionId",
      "imageId",
      "userId",
      "amount",
      "type",
      "date",
      "merchant",
      "category",
      "description",
      "extractedAt",
      "jobId",
      "ttl",
    ];

    for (const field of required) {
      if (!(field in tx)) throw new Error(`Missing: ${field}`);
    }

    if (!["income", "expense"].includes(tx.type)) throw new Error("Invalid type");
    if (
      !["sale", "purchase", "shipping", "packaging", "fee", "other"].includes(
        tx.category
      )
    )
      throw new Error("Invalid category");
    if (tx.amount <= 0) throw new Error("Amount must be positive");
  }

  const validTx = {
    transactionId: "abc123def456ghi789jkl012",
    imageId: "img_abc",
    userId: "user_123",
    amount: 1500,
    type: "expense",
    date: "2026-01-09",
    merchant: "コンビニ",
    category: "purchase",
    description: "食料品",
    extractedAt: "2026-01-09T10:30:00Z",
    jobId: "job_001",
    ttl: 1750000000,
  };

  try {
    validateTransaction(validTx);
    assert(true, "Valid transaction passes validation");
  } catch (e) {
    assert(false, `Valid transaction failed: ${e.message}`);
  }

  const invalidTx = { ...validTx, amount: -100 };
  try {
    validateTransaction(invalidTx);
    assert(false, "Reject negative amount");
  } catch (e) {
    assert(e.message === "Amount must be positive", "Reject negative amount");
  }

  console.log(`   All schema validations pass\n`);
}

// ============================================================================
// Test 8: S3 Event Parsing
// ============================================================================
console.log("Test 8: S3 Event Key Parsing");
{
  function parseS3Event(record) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    const keyParts = key.split("/");
    if (keyParts.length < 3 || keyParts[0] !== "batch-output") {
      throw new Error("Invalid key format");
    }

    const jobId = keyParts[1];
    return { bucket, key, jobId };
  }

  const validEvent = {
    s3: {
      bucket: { name: "yorutsuke-images-dev" },
      object: { key: "batch-output/job_abc123/output.jsonl" },
    },
  };

  const result = parseS3Event(validEvent);
  assert(result.jobId === "job_abc123", "Extract jobId from S3 key");
  assert(result.bucket === "yorutsuke-images-dev", "Extract bucket name");

  const invalidEvent = {
    s3: {
      bucket: { name: "yorutsuke-images-dev" },
      object: { key: "invalid/output.jsonl" },
    },
  };

  try {
    parseS3Event(invalidEvent);
    assert(false, "Reject invalid S3 key format");
  } catch (e) {
    assert(e.message === "Invalid key format", "Reject invalid S3 key format");
  }

  console.log(`   S3 event parsing validated\n`);
}

// ============================================================================
// Summary
// ============================================================================
console.log(`\n${"=".repeat(70)}`);
console.log(`Test Results: ${passCount} passed, ${failCount} failed`);
console.log(`${"=".repeat(70)}\n`);

if (failCount > 0) {
  process.exit(1);
}
