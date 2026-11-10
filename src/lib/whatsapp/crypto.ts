// Token & Secret Encryption Service (AES-256-GCM)
// Phase 1C: Encryption at Rest & Key Rotation for Meta API Tokens & App Secrets
// Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt

import crypto from 'crypto';

export interface DecryptedSecret {
  keyVersion: string;
  plaintext: string;
}

export class CryptoService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // 96 bits recommended for AES-GCM
  private static readonly TAG_LENGTH = 16; // 128-bit authentication tag

  /**
   * Resolves a 32-byte Buffer from a hex string, raw string, or Buffer
   */
  private static normalizeKey(keyInput: string | Buffer): Buffer {
    if (Buffer.isBuffer(keyInput)) {
      if (keyInput.length === 32) return keyInput;
      return crypto.createHash('sha256').update(keyInput).digest();
    }

    if (typeof keyInput === 'string') {
      const cleanHex = keyInput.trim();
      if (/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
        return Buffer.from(cleanHex, 'hex');
      }
      return crypto.createHash('sha256').update(cleanHex, 'utf8').digest();
    }

    throw new Error('Encryption key must be a valid 32-byte hex string or Buffer');
  }

  /**
   * Encrypts plaintext token using AES-256-GCM
   * Output format: `${keyVersion}:${ivHex}:${tagHex}:${cipherHex}`
   */
  static encrypt(plaintext: string, keyInput: string | Buffer, keyVersion = 'v1'): string {
    if (typeof plaintext !== 'string') {
      throw new Error('Plaintext must be a string');
    }

    const key = this.normalizeKey(keyInput);
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv, {
      authTagLength: this.TAG_LENGTH,
    });

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${keyVersion}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
  }

  /**
   * Decrypts an encrypted token package using AES-256-GCM
   * Verifies authentication tag against tampering
   */
  static decrypt(cipherPackage: string, keyInput: string | Buffer): string {
    if (!cipherPackage || typeof cipherPackage !== 'string') {
      throw new Error('Cipher package must be a non-empty string');
    }

    const parts = cipherPackage.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted payload format: expected version:iv:tag:ciphertext');
    }

    const [, ivHex, tagHex, cipherHex] = parts;
    const key = this.normalizeKey(keyInput);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv, {
      authTagLength: this.TAG_LENGTH,
    });

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Decrypts ciphertext using a multi-version keyring
   * Selects matching master key based on package version prefix
   */
  static decryptWithKeyring(cipherPackage: string, keyring: Record<string, string>): string {
    if (!cipherPackage || typeof cipherPackage !== 'string') {
      throw new Error('Cipher package must be a non-empty string');
    }

    const parts = cipherPackage.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted payload format');
    }

    const [keyVersion] = parts;
    const masterKey = keyring[keyVersion];

    if (!masterKey) {
      throw new Error(`Master key version "${keyVersion}" not found in keyring`);
    }

    return this.decrypt(cipherPackage, masterKey);
  }

  /**
   * RLS Security Contract: Verify caller role authorization on workspace_secrets table
   * Guaranteed: anon=false, authenticated=false, service_role=true
   */
  static checkRlsAccess(role: 'anon' | 'authenticated' | 'service_role'): boolean {
    return role === 'service_role';
  }

  /**
   * Masks sensitive credentials for UI display and safe logging
   * Example: EAAGm0...9821 -> ••••••••••••9821
   */
  static maskSecret(val: string): string {
    if (!val || typeof val !== 'string') return '';
    const trimmed = val.trim();
    if (trimmed.length <= 6) return '••••••';
    const last4 = trimmed.slice(-4);
    return `••••••••••••${last4}`;
  }
}
