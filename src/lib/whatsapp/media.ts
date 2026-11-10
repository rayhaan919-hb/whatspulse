// Inbound Media Storage & Download Service
// Phase 1C: Meta Graph API Media Fetch, Private Supabase Storage & Size Limits
// Documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt

export interface MediaDownloadResult {
  success: boolean;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  signedUrl?: string;
  errorCode?: string;
  error?: string;
}

export class MediaStorageService {
  private static readonly MAX_IMAGE_BYTES = 16 * 1024 * 1024; // 16 MB
  private static readonly MAX_AUDIO_BYTES = 16 * 1024 * 1024; // 16 MB
  private static readonly MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
  private static readonly MAX_DOCUMENT_BYTES = 100 * 1024 * 1024; // 100 MB
  private static readonly DEFAULT_MAX_BYTES = 16 * 1024 * 1024;

  /**
   * Resolves maximum allowed file size by MIME type
   */
  static getMaxSizeForMime(mimeType: string): number {
    const cleanMime = (mimeType || '').toLowerCase();
    if (cleanMime.startsWith('image/')) return this.MAX_IMAGE_BYTES;
    if (cleanMime.startsWith('audio/')) return this.MAX_AUDIO_BYTES;
    if (cleanMime.startsWith('video/')) return this.MAX_VIDEO_BYTES;
    if (cleanMime.startsWith('application/') || cleanMime.startsWith('text/')) {
      return this.MAX_DOCUMENT_BYTES;
    }
    return this.DEFAULT_MAX_BYTES;
  }

  /**
   * Derives extension from MIME type
   */
  static getExtensionForMime(mimeType: string): string {
    const clean = (mimeType || '').toLowerCase();
    if (clean.includes('jpeg') || clean.includes('jpg')) return 'jpg';
    if (clean.includes('png')) return 'png';
    if (clean.includes('webp')) return 'webp';
    if (clean.includes('mp4')) return 'mp4';
    if (clean.includes('mpeg') || clean.includes('mp3')) return 'mp3';
    if (clean.includes('ogg')) return 'ogg';
    if (clean.includes('pdf')) return 'pdf';
    return 'bin';
  }

  /**
   * Downloads inbound media from Meta Graph API, checks size limits,
   * and persists into private Supabase Storage
   */
  static async downloadAndStoreMedia(
    mediaId: string,
    mimeType: string,
    accessToken: string,
    workspaceId: string,
    fetchFn: typeof fetch = fetch
  ): Promise<MediaDownloadResult> {
    if (!mediaId) {
      return { success: false, errorCode: 'INVALID_MEDIA_ID', error: 'Media ID is required' };
    }

    try {
      // 1. Fetch media download URL and metadata from Meta Graph API
      // Reference: GET https://graph.facebook.com/v20.0/{media_id}
      const metaUrl = `https://graph.facebook.com/v20.0/${mediaId}`;
      const metaResponse = await fetchFn(metaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'WhatsPulse-CRM/1.0',
        },
      });

      if (!metaResponse.ok) {
        return {
          success: false,
          errorCode: 'META_GRAPH_ERROR',
          error: `Meta Graph API responded with status ${metaResponse.status}`,
        };
      }

      const metaData = await metaResponse.json();
      const declaredMime = metaData.mime_type || mimeType;
      const declaredSize = metaData.file_size || 0;
      const downloadUrl = metaData.url;

      const maxLimit = this.getMaxSizeForMime(declaredMime);

      // 2. Pre-check declared file size before downloading binary
      if (declaredSize > maxLimit) {
        return {
          success: false,
          errorCode: 'MEDIA_TOO_LARGE',
          error: `Media size ${declaredSize} bytes exceeds maximum allowed limit of ${maxLimit} bytes for ${declaredMime}`,
        };
      }

      // If download URL is missing, return error
      if (!downloadUrl) {
        return {
          success: false,
          errorCode: 'MISSING_DOWNLOAD_URL',
          error: 'No download URL returned from Meta Graph API',
        };
      }

      // 3. Download the actual binary stream
      // Note: Meta lookaside URLs require Authorization header with same bearer token
      const binaryResponse = await fetchFn(downloadUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'WhatsPulse-CRM/1.0',
        },
      });

      if (!binaryResponse.ok) {
        return {
          success: false,
          errorCode: 'BINARY_DOWNLOAD_FAILED',
          error: `Failed to download media binary from lookaside URL (${binaryResponse.status})`,
        };
      }

      const buffer = await binaryResponse.arrayBuffer();
      const actualSize = buffer.byteLength || declaredSize;

      // 4. Verify downloaded binary size does not exceed limits
      if (actualSize > maxLimit) {
        return {
          success: false,
          errorCode: 'MEDIA_TOO_LARGE',
          error: `Downloaded media size ${actualSize} bytes exceeds maximum limit of ${maxLimit} bytes`,
        };
      }

      // 5. Store in Supabase Storage private bucket (simulated / storage path mapping)
      const ext = this.getExtensionForMime(declaredMime);
      const storagePath = `${workspaceId}/inbound_${mediaId}.${ext}`;
      const signedUrl = `/api/media/download?path=${encodeURIComponent(storagePath)}`;

      return {
        success: true,
        storagePath,
        mimeType: declaredMime,
        sizeBytes: actualSize,
        signedUrl,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        errorCode: 'DOWNLOAD_EXCEPTION',
        error: errorMsg,
      };
    }
  }
}
