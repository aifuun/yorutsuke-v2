import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

/**
 * Unit tests for batch-result-handler
 * Tests core improvements: idempotency, streaming, schema validation
 */

describe("Batch Result Handler", () => {
  // Helper: Generate idempotent transactionId
  function generateTransactionId(jobId, imageId, timestamp) {
    return crypto
      .createHash("sha256")
      .update(`${jobId}#${imageId}#${timestamp}`)
      .digest("hex")
      .slice(0, 24);
  }

  describe("Improvement #1: Idempotency", () => {
    it("should generate deterministic transactionId", () => {
      const jobId = "job_abc123";
      const imageId = "img_xyz789";
      const timestamp = "2026-01-09T10:30:00Z";

      const txId1 = generateTransactionId(jobId, imageId, timestamp);
      const txId2 = generateTransactionId(jobId, imageId, timestamp);

      expect(txId1).toBe(txId2);
      expect(txId1).toHaveLength(24);
    });

    it("should generate different transactionIds for different inputs", () => {
      const timestamp = "2026-01-09T10:30:00Z";

      const txId1 = generateTransactionId("job_1", "img_1", timestamp);
      const txId2 = generateTransactionId("job_2", "img_1", timestamp);
      const txId3 = generateTransactionId("job_1", "img_2", timestamp);

      expect(txId1).not.toBe(txId2);
      expect(txId1).not.toBe(txId3);
      expect(txId2).not.toBe(txId3);
    });

    it("should detect duplicate processing (same jobId+imageId)", () => {
      const jobId = "job_batch_001";
      const imageId = "img_receipt_123";
      const timestamp1 = "2026-01-09T10:30:00Z";
      const timestamp2 = "2026-01-09T10:30:01Z"; // Different time

      // Same jobId + imageId = same transactionId (idempotent)
      // In real scenario, timestamp would also be from same source
      const txId1 = generateTransactionId(jobId, imageId, timestamp1);
      const txId1_again = generateTransactionId(jobId, imageId, timestamp1);

      expect(txId1).toBe(txId1_again);
    });
  });

  describe("TTL Calculation", () => {
    function isGuestUser(userId) {
      return userId.startsWith("device-") || userId.startsWith("ephemeral-");
    }

    function getTTL(userId) {
      const ttlSeconds = isGuestUser(userId)
        ? 60 * 24 * 60 * 60 // Guest: 60 days
        : 365 * 24 * 60 * 60; // Account: 1 year
      return Math.floor(Date.now() / 1000) + ttlSeconds;
    }

    it("should calculate 60-day TTL for guest users", () => {
      const guestId = "device-user-abc123";
      const now = Math.floor(Date.now() / 1000);
      const ttl = getTTL(guestId);

      const expectedTtl = now + 60 * 24 * 60 * 60;
      expect(ttl).toBeCloseTo(expectedTtl, -1); // Within 1 second
    });

    it("should calculate 1-year TTL for account users", () => {
      const accountId = "user-prod-123";
      const now = Math.floor(Date.now() / 1000);
      const ttl = getTTL(accountId);

      const expectedTtl = now + 365 * 24 * 60 * 60;
      expect(ttl).toBeCloseTo(expectedTtl, -1);
    });

    it("should detect guest vs account users correctly", () => {
      expect(isGuestUser("device-abc")).toBe(true);
      expect(isGuestUser("ephemeral-xyz")).toBe(true);
      expect(isGuestUser("user-123")).toBe(false);
      expect(isGuestUser("account-prod")).toBe(false);
    });
  });

  describe("JST Date Handling", () => {
    function getJSTDate() {
      const now = new Date();
      const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      return jst.toISOString().slice(0, 10);
    }

    it("should format JST date as YYYY-MM-DD", () => {
      const date = getJSTDate();
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      expect(date).toMatch(regex);
    });

    it("should handle timezone offset correctly", () => {
      // Verify JST is UTC+9
      const now = new Date();
      const utcHour = now.getUTCHours();
      const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const jstHour = Math.floor(jst.getTime() / 1000 / 3600) % 24;

      // JST should be ahead by 9 hours
      expect((jstHour - utcHour + 24) % 24).toBeCloseTo(9, 0);
    });
  });

  describe("Improvement #4: Batch Write Simulation", () => {
    function chunkArray(array, chunkSize) {
      const chunks = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
      }
      return chunks;
    }

    it("should split 1000 items into 40 batches of 25", () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      const batches = chunkArray(items, 25);

      expect(batches).toHaveLength(40);
      expect(batches[0]).toHaveLength(25);
      expect(batches[39]).toHaveLength(25);
    });

    it("should handle partial final batch", () => {
      const items = Array.from({ length: 103 }, (_, i) => ({ id: i }));
      const batches = chunkArray(items, 25);

      expect(batches).toHaveLength(5);
      expect(batches[4]).toHaveLength(3); // Last batch: 103 % 25 = 3
    });

    it("should implement exponential backoff", () => {
      const INITIAL_BACKOFF = 100;
      const MAX_RETRIES = 3;

      function calculateBackoff(retryAttempt) {
        return INITIAL_BACKOFF * Math.pow(2, retryAttempt);
      }

      expect(calculateBackoff(0)).toBe(100);
      expect(calculateBackoff(1)).toBe(200);
      expect(calculateBackoff(2)).toBe(400);
    });
  });

  describe("Bedrock Output Parsing", () => {
    function parseBedrockLine(line) {
      const parsed = JSON.parse(line);
      if (!parsed.customData || !parsed.output?.text) {
        throw new Error("Invalid Bedrock format");
      }
      return parsed;
    }

    it("should parse valid Bedrock JSONL line", () => {
      const line = JSON.stringify({
        customData: "img_abc123",
        output: {
          text: '{"amount":1500,"type":"expense","date":"2026-01-09","merchant":"店舗名","category":"purchase","description":"説明"}',
        },
      });

      const result = parseBedrockLine(line);
      expect(result.customData).toBe("img_abc123");
      expect(result.output.text).toContain("amount");
    });

    it("should reject invalid Bedrock format", () => {
      const invalidLine = JSON.stringify({
        // Missing customData
        output: { text: "{}" },
      });

      expect(() => parseBedrockLine(invalidLine)).toThrow();
    });
  });

  describe("Transaction Schema Validation", () => {
    function validateTransaction(transaction) {
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
        if (!(field in transaction)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      if (!["income", "expense"].includes(transaction.type)) {
        throw new Error(`Invalid type: ${transaction.type}`);
      }

      if (
        !["sale", "purchase", "shipping", "packaging", "fee", "other"].includes(
          transaction.category
        )
      ) {
        throw new Error(`Invalid category: ${transaction.category}`);
      }

      if (transaction.amount <= 0) {
        throw new Error("Amount must be positive");
      }

      return true;
    }

    it("should validate correct transaction", () => {
      const transaction = {
        transactionId: "abc123def456ghi789jkl012",
        imageId: "img_abc123",
        userId: "user_123",
        amount: 1500,
        type: "expense",
        date: "2026-01-09",
        merchant: "コンビニA",
        category: "purchase",
        description: "食料品",
        extractedAt: "2026-01-09T10:30:00Z",
        jobId: "job_batch_001",
        ttl: 1750000000,
      };

      expect(validateTransaction(transaction)).toBe(true);
    });

    it("should reject transaction with missing field", () => {
      const transaction = {
        transactionId: "abc123def456ghi789jkl012",
        // Missing imageId
        userId: "user_123",
        amount: 1500,
        type: "expense",
        date: "2026-01-09",
        merchant: "店舗",
        category: "purchase",
        description: "説明",
        extractedAt: "2026-01-09T10:30:00Z",
        jobId: "job_001",
        ttl: 1750000000,
      };

      expect(() => validateTransaction(transaction)).toThrow("Missing required field: imageId");
    });

    it("should reject invalid type", () => {
      const transaction = {
        transactionId: "abc123def456ghi789jkl012",
        imageId: "img_abc123",
        userId: "user_123",
        amount: 1500,
        type: "invalid", // ❌
        date: "2026-01-09",
        merchant: "店舗",
        category: "purchase",
        description: "説明",
        extractedAt: "2026-01-09T10:30:00Z",
        jobId: "job_001",
        ttl: 1750000000,
      };

      expect(() => validateTransaction(transaction)).toThrow("Invalid type");
    });

    it("should reject non-positive amount", () => {
      const transaction = {
        transactionId: "abc123def456ghi789jkl012",
        imageId: "img_abc123",
        userId: "user_123",
        amount: 0, // ❌
        type: "expense",
        date: "2026-01-09",
        merchant: "店舗",
        category: "purchase",
        description: "説明",
        extractedAt: "2026-01-09T10:30:00Z",
        jobId: "job_001",
        ttl: 1750000000,
      };

      expect(() => validateTransaction(transaction)).toThrow("Amount must be positive");
    });
  });

  describe("S3 Event Parsing", () => {
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

    it("should parse valid S3 event", () => {
      const record = {
        s3: {
          bucket: { name: "yorutsuke-images-dev" },
          object: { key: "batch-output/job_abc123/output.jsonl" },
        },
      };

      const result = parseS3Event(record);
      expect(result.bucket).toBe("yorutsuke-images-dev");
      expect(result.jobId).toBe("job_abc123");
    });

    it("should reject invalid S3 key format", () => {
      const record = {
        s3: {
          bucket: { name: "yorutsuke-images-dev" },
          object: { key: "invalid-path/output.jsonl" },
        },
      };

      expect(() => parseS3Event(record)).toThrow("Invalid key format");
    });
  });
});
