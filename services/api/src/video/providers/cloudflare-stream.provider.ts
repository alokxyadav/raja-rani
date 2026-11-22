import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DirectUploadResult, PlaybackAuthorization, VideoProvider } from './video-provider.interface';

// Cloudflare Stream requires the video to be marked "requireSignedURLs":
// true when uploaded (done at upload time, not here — see docs/VIDEO.md).
// This adapter asks Cloudflare's API to mint a short-lived signed token for
// one specific video; the resulting HLS/DASH manifest URL only plays with
// that token attached, and it self-expires — no separate revocation call
// needed once ttlSeconds elapses.
@Injectable()
export class CloudflareStreamProvider implements VideoProvider {
  readonly name = 'cloudflare_stream';

  constructor(private config: ConfigService) {}

  async generatePlaybackToken(
    videoAssetId: string,
    ttlSeconds: number,
  ): Promise<PlaybackAuthorization> {
    const accountId = this.config.get<string>('CF_ACCOUNT_ID');
    const apiToken = this.config.get<string>('CF_STREAM_API_TOKEN');
    if (!accountId || !apiToken) {
      throw new Error(
        'Cloudflare Stream is not configured — set CF_ACCOUNT_ID/CF_STREAM_API_TOKEN in .env. ' +
          'Requires a Cloudflare account with Stream enabled.',
      );
    }

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoAssetId}/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exp: Math.floor(expiresAt.getTime() / 1000),
          downloadable: false, // never allow direct file download of paid content
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Cloudflare Stream token request failed: ${res.status} ${body}`);
    }

    const json = (await res.json()) as { result: { token: string } };
    return {
      playbackUrl: `https://videodelivery.net/${json.result.token}/manifest/video.m3u8`,
      expiresAt,
    };
  }

  // "Direct creator upload" — the admin's browser uploads the video file
  // straight to Cloudflare using this URL; the API server (and thus the
  // Cloudflare API token) never touches the video bytes. This is what
  // keeps a multi-GB upload off our own server's bandwidth/memory.
  async createDirectUploadUrl(maxDurationSeconds: number): Promise<DirectUploadResult> {
    const accountId = this.config.get<string>('CF_ACCOUNT_ID');
    const apiToken = this.config.get<string>('CF_STREAM_API_TOKEN');
    if (!accountId || !apiToken) {
      throw new Error(
        'Cloudflare Stream is not configured — set CF_ACCOUNT_ID/CF_STREAM_API_TOKEN in .env.',
      );
    }

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds,
          // The flag that matters most: without this, the video defaults
          // to publicly playable the moment upload finishes, bypassing
          // every entitlement check this whole system is built around.
          requireSignedURLs: true,
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Cloudflare direct-upload request failed: ${res.status} ${body}`);
    }

    const json = (await res.json()) as { result: { uploadURL: string; uid: string } };
    return { uploadUrl: json.result.uploadURL, videoAssetId: json.result.uid };
  }
}
