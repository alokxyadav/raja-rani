// Same principle as PaymentProvider: business logic (VideoService) never
// talks to Cloudflare/Mux/Bunny directly. It asks this interface for a
// short-lived playback authorization and hands that to the client — the
// provider is swappable without touching entitlement or lesson logic.

export interface PlaybackAuthorization {
  playbackUrl: string;
  expiresAt: Date;
}

export interface DirectUploadResult {
  uploadUrl: string; // admin's browser/device uploads the video file directly here
  videoAssetId: string; // save this on Lesson.videoAssetId once upload completes
}

export interface VideoProvider {
  readonly name: string;
  // videoAssetId is the provider-side ID stored on Lesson.videoAssetId —
  // never a public/permanent URL. ttlSeconds should stay short (minutes,
  // not hours) since a leaked token should have a small blast radius.
  generatePlaybackToken(videoAssetId: string, ttlSeconds: number): Promise<PlaybackAuthorization>;

  // Returns a one-time upload URL the ADMIN'S CLIENT uploads directly to —
  // the API server never proxies the video bytes through itself, and the
  // Cloudflare API token never reaches the admin panel's frontend code.
  // See admin's video upload flow (video-upload.controller.ts).
  createDirectUploadUrl(maxDurationSeconds: number): Promise<DirectUploadResult>;
}
