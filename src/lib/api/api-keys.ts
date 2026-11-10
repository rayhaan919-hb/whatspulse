import crypto from 'crypto';
import type { WorkspaceApiKey } from '../../types/crm';

/**
 * ApiKeyService manages workspace REST API keys:
 * - Generates secure tokens starting with `wp_live_`
 * - Computes SHA-256 hashes for storage at rest (raw secret is revealed only once)
 * - Verifies API keys using constant-time timingSafeEqual
 * - Resolves incoming Authorization: Bearer headers
 */
export class ApiKeyService {
  /**
   * Generates a new API key for the workspace.
   * Returns the database record (holding only the hash & prefix) and the one-time secretKey.
   */
  public static generateApiKey(
    workspaceId: string,
    name: string
  ): { keyRecord: WorkspaceApiKey; secretKey: string } {
    const rawEntropy = crypto.randomBytes(24).toString('hex');
    const secretKey = `wp_live_${rawEntropy}`;
    const keyPrefix = `${secretKey.substring(0, 15)}...`;
    const keyHash = this.hashKey(secretKey);

    const keyRecord: WorkspaceApiKey = {
      id: `key_${crypto.randomUUID()}`,
      workspaceId,
      name,
      keyPrefix,
      keyHash,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date().toISOString(),
    };

    return {
      keyRecord,
      secretKey,
    };
  }

  /**
   * Computes SHA-256 hex digest of an API key
   */
  public static hashKey(secretKey: string): string {
    return crypto.createHash('sha256').update(secretKey).digest('hex');
  }

  /**
   * Constant-time verification of a plaintext API key against the stored SHA-256 hash.
   */
  public static verifyApiKey(secretKey: string, storedHash: string): boolean {
    if (!secretKey || !storedHash) {
      return false;
    }

    const computedHash = this.hashKey(secretKey);
    const computedBuffer = Buffer.from(computedHash, 'utf8');
    const storedBuffer = Buffer.from(storedHash, 'utf8');

    if (computedBuffer.length !== storedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuffer, storedBuffer);
  }

  /**
   * Authenticates an incoming HTTP Authorization header against the known API key records.
   */
  public static authenticateRequest(
    authHeader: string | null | undefined,
    keyStore: WorkspaceApiKey[]
  ): WorkspaceApiKey | null {
    if (!authHeader) {
      return null;
    }

    const trimmed = authHeader.trim();
    if (!trimmed.toLowerCase().startsWith('bearer ')) {
      return null;
    }

    const token = trimmed.substring(7).trim();
    if (!token.startsWith('wp_live_')) {
      return null;
    }

    const computedHash = this.hashKey(token);

    for (const record of keyStore) {
      if (record.revokedAt) {
        continue;
      }

      if (record.keyHash.length === computedHash.length) {
        const isMatch = crypto.timingSafeEqual(
          Buffer.from(computedHash, 'utf8'),
          Buffer.from(record.keyHash, 'utf8')
        );
        if (isMatch) {
          return record;
        }
      }
    }

    return null;
  }
}
