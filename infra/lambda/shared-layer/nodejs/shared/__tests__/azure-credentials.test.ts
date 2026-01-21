/**
 * Unit Tests for Azure Credentials Manager
 *
 * Tests cover:
 * - Loading credentials from AWS Secrets Manager
 * - Container-level caching (55-minute TTL)
 * - Schema validation (Pillar B: Airlock)
 * - Graceful degradation on errors
 * - Cache management functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import {
  getAzureCredentials,
  clearAzureCredentialsCache,
  getAzureCredentialsCacheStatus,
} from '../azure-credentials.js';

// Mock AWS Secrets Manager
const secretsManagerMock = mockClient(SecretsManagerClient);

describe('azure-credentials.ts', () => {
  const validSecretArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:azure-di-test';
  const validCredentials = {
    endpoint: 'https://test.cognitiveservices.azure.com/',
    apiKey: 'abcdefghijklmnopqrstuvwxyz1234567890abcd',
  };

  beforeEach(() => {
    // Reset mocks
    secretsManagerMock.reset();
    // Clear cache before each test
    clearAzureCredentialsCache();
    // Reset console.error mock
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('getAzureCredentials() - Basic Loading', () => {
    it('should load valid credentials from Secrets Manager', async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(validCredentials),
      });

      const result = await getAzureCredentials(validSecretArn);

      expect(result).toEqual(validCredentials);
    });

    it('should return null for empty secretArn', async () => {
      const result = await getAzureCredentials('');
      expect(result).toBeNull();
      expect(secretsManagerMock.calls()).toHaveLength(0); // Should not call AWS
    });

    it('should return null for null secretArn', async () => {
      const result = await getAzureCredentials(null as any);
      expect(result).toBeNull();
      expect(secretsManagerMock.calls()).toHaveLength(0);
    });

    it('should return null for undefined secretArn', async () => {
      const result = await getAzureCredentials(undefined as any);
      expect(result).toBeNull();
      expect(secretsManagerMock.calls()).toHaveLength(0);
    });

    it('should return null for non-string secretArn', async () => {
      const result = await getAzureCredentials(123 as any);
      expect(result).toBeNull();
      expect(secretsManagerMock.calls()).toHaveLength(0);
    });
  });

  describe('getAzureCredentials() - Caching', () => {
    it('should cache credentials for 55 minutes', async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(validCredentials),
      });

      // First call - loads from Secrets Manager
      const result1 = await getAzureCredentials(validSecretArn);
      expect(result1).toEqual(validCredentials);
      expect(secretsManagerMock.calls()).toHaveLength(1);

      // Second call - uses cache
      const result2 = await getAzureCredentials(validSecretArn);
      expect(result2).toEqual(validCredentials);
      expect(secretsManagerMock.calls()).toHaveLength(1); // No additional call
    });

    it('should refresh cache after expiration', async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(validCredentials),
      });

      // First call
      const result1 = await getAzureCredentials(validSecretArn);
      expect(result1).toEqual(validCredentials);

      // Simulate cache expiration (time travel)
      const status = getAzureCredentialsCacheStatus();
      expect(status.isCached).toBe(true);

      // Mock time passing (55 minutes + 1ms)
      vi.useFakeTimers();
      vi.advanceTimersByTime(55 * 60 * 1000 + 1);

      // Second call - cache expired, should reload
      const result2 = await getAzureCredentials(validSecretArn);
      expect(result2).toEqual(validCredentials);
      expect(secretsManagerMock.calls()).toHaveLength(2);

      vi.useRealTimers();
    });

    it('should use separate cache for different secretArns', async () => {
      const secretArn1 = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:azure-di-1';
      const secretArn2 = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:azure-di-2';

      const credentials1 = {
        ...validCredentials,
        apiKey: 'key1111111111111111111111111111111111111',
      };
      const credentials2 = {
        ...validCredentials,
        apiKey: 'key2222222222222222222222222222222222222',
      };

      secretsManagerMock
        .on(GetSecretValueCommand, { SecretId: secretArn1 })
        .resolves({ SecretString: JSON.stringify(credentials1) })
        .on(GetSecretValueCommand, { SecretId: secretArn2 })
        .resolves({ SecretString: JSON.stringify(credentials2) });

      // Load first secret
      const result1 = await getAzureCredentials(secretArn1);
      expect(result1).toEqual(credentials1);

      // Load second secret - cache miss (different ARN)
      const result2 = await getAzureCredentials(secretArn2);
      expect(result2).toEqual(credentials2);

      expect(secretsManagerMock.calls()).toHaveLength(2);
    });
  });

  describe('getAzureCredentials() - Schema Validation', () => {
    it('should reject credentials with invalid endpoint', async () => {
      const invalidCredentials = {
        endpoint: 'not-a-url',
        apiKey: 'abcdefghijklmnopqrstuvwxyz1234567890abcd',
      };

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(invalidCredentials),
      });

      const result = await getAzureCredentials(validSecretArn);
      expect(result).toBeNull(); // Graceful degradation
      expect(console.error).toHaveBeenCalled();
    });

    it('should reject credentials with short apiKey', async () => {
      const invalidCredentials = {
        endpoint: 'https://test.cognitiveservices.azure.com/',
        apiKey: 'short', // Less than 32 characters
      };

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(invalidCredentials),
      });

      const result = await getAzureCredentials(validSecretArn);
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should reject credentials missing endpoint', async () => {
      const invalidCredentials = {
        apiKey: 'abcdefghijklmnopqrstuvwxyz1234567890abcd',
      };

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(invalidCredentials),
      });

      const result = await getAzureCredentials(validSecretArn);
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should reject credentials missing apiKey', async () => {
      const invalidCredentials = {
        endpoint: 'https://test.cognitiveservices.azure.com/',
      };

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(invalidCredentials),
      });

      const result = await getAzureCredentials(validSecretArn);
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should reject endpoint without .cognitiveservices.azure.com domain', async () => {
      const invalidCredentials = {
        endpoint: 'https://test.example.com/',
        apiKey: 'abcdefghijklmnopqrstuvwxyz1234567890abcd',
      };

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(invalidCredentials),
      });

      const result = await getAzureCredentials(validSecretArn);
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getAzureCredentials() - Error Handling', () => {
    it('should return null when secret not found', async () => {
      secretsManagerMock.on(GetSecretValueCommand).rejects({
        name: 'ResourceNotFoundException',
        message: 'Secret not found',
        code: 'ResourceNotFoundException',
      });

      const result = await getAzureCredentials(validSecretArn);
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'AZURE_CREDENTIALS_LOAD_ERROR',
        expect.objectContaining({
          secretArn: validSecretArn,
          code: 'ResourceNotFoundException',
        })
      );
    });

    it('should return null on Secrets Manager access denied', async () => {
      secretsManagerMock.on(GetSecretValueCommand).rejects({
        name: 'AccessDeniedException',
        message: 'Access denied',
        code: 'AccessDeniedException',
      });

      const result = await getAzureCredentials(validSecretArn);
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should return null on network error', async () => {
      secretsManagerMock.on(GetSecretValueCommand).rejects(new Error('Network timeout'));

      const result = await getAzureCredentials(validSecretArn);
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should return null for binary secrets', async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretBinary: Buffer.from('binary-secret-data'),
      });

      const result = await getAzureCredentials(validSecretArn);
      expect(result).toBeNull();
    });

    it('should return null for malformed JSON', async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: 'not-valid-json{',
      });

      const result = await getAzureCredentials(validSecretArn);
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('clearAzureCredentialsCache()', () => {
    it('should clear cached credentials', async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(validCredentials),
      });

      // Load credentials
      await getAzureCredentials(validSecretArn);
      expect(getAzureCredentialsCacheStatus().isCached).toBe(true);

      // Clear cache
      clearAzureCredentialsCache();
      expect(getAzureCredentialsCacheStatus().isCached).toBe(false);

      // Next call should reload from Secrets Manager
      await getAzureCredentials(validSecretArn);
      expect(secretsManagerMock.calls()).toHaveLength(2);
    });

    it('should reset all cache fields', () => {
      clearAzureCredentialsCache();
      const status = getAzureCredentialsCacheStatus();

      expect(status.secretArn).toBeNull();
      expect(status.isCached).toBe(false);
      expect(status.expiresIn).toBe(0);
    });
  });

  describe('getAzureCredentialsCacheStatus()', () => {
    it('should return empty status when cache is empty', () => {
      const status = getAzureCredentialsCacheStatus();

      expect(status.secretArn).toBeNull();
      expect(status.isCached).toBe(false);
      expect(status.expiresIn).toBe(0);
    });

    it('should return cached status with valid cache', async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(validCredentials),
      });

      await getAzureCredentials(validSecretArn);
      const status = getAzureCredentialsCacheStatus();

      expect(status.secretArn).toBe(validSecretArn);
      expect(status.isCached).toBe(true);
      expect(status.expiresIn).toBeGreaterThan(0);
      expect(status.expiresIn).toBeLessThanOrEqual(55 * 60 * 1000);
    });

    it('should show cache as expired after TTL', async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(validCredentials),
      });

      await getAzureCredentials(validSecretArn);

      vi.useFakeTimers();
      vi.advanceTimersByTime(55 * 60 * 1000 + 1); // 55 minutes + 1ms

      const status = getAzureCredentialsCacheStatus();
      expect(status.isCached).toBe(false);
      expect(status.expiresIn).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle multiple invocations on same Lambda container', async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(validCredentials),
      });

      // First call - loads from Secrets Manager
      const firstResult = await getAzureCredentials(validSecretArn);
      expect(firstResult).toEqual(validCredentials);
      expect(secretsManagerMock.calls()).toHaveLength(1);

      // Subsequent 9 calls - all use cache
      const results = await Promise.all(
        Array.from({ length: 9 }, () => getAzureCredentials(validSecretArn))
      );

      // All results should be valid
      results.forEach((result) => {
        expect(result).toEqual(validCredentials);
      });

      // Still only 1 call to Secrets Manager (all others cached)
      expect(secretsManagerMock.calls()).toHaveLength(1);
    });

    it('should gracefully degrade when Azure DI is unavailable', async () => {
      secretsManagerMock.on(GetSecretValueCommand).rejects(new Error('Service unavailable'));

      // Should not throw, just return null
      const result = await getAzureCredentials(validSecretArn);
      expect(result).toBeNull();

      // Instant processor can continue with other models
      expect(console.error).toHaveBeenCalledWith(
        'AZURE_CREDENTIALS_LOAD_ERROR',
        expect.objectContaining({
          secretArn: validSecretArn,
        })
      );
    });
  });
});
