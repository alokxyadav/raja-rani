import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Matches the brief's platform-settings requirements (Section 100/101):
// minimum supported app version, force-update flag, maintenance mode, plus
// simple feature flags. An allowlist rather than free-form keys — an admin
// panel typo shouldn't silently create an unused setting nobody reads.
const KNOWN_KEYS = [
  'MIN_SUPPORTED_APP_VERSION',
  'LATEST_APP_VERSION',
  'FORCE_UPDATE',
  'MAINTENANCE_MODE',
  'LIVE_CLASSES_ENABLED',
  'COMMUNITY_ENABLED',
] as const;

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    const rows = await this.prisma.appSetting.findMany();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    // Always return every known key, even if never explicitly set, with a
    // documented default — the mobile app and admin panel can both rely on
    // a complete shape rather than handling "key missing" everywhere.
    return {
      MIN_SUPPORTED_APP_VERSION: map.get('MIN_SUPPORTED_APP_VERSION') ?? '1.0.0',
      LATEST_APP_VERSION: map.get('LATEST_APP_VERSION') ?? '1.0.0',
      FORCE_UPDATE: map.get('FORCE_UPDATE') ?? 'false',
      MAINTENANCE_MODE: map.get('MAINTENANCE_MODE') ?? 'false',
      LIVE_CLASSES_ENABLED: map.get('LIVE_CLASSES_ENABLED') ?? 'true',
      COMMUNITY_ENABLED: map.get('COMMUNITY_ENABLED') ?? 'true',
    };
  }

  async set(key: string, value: string) {
    if (!KNOWN_KEYS.includes(key as (typeof KNOWN_KEYS)[number])) {
      throw new BadRequestException(`unknown setting key: ${key}`);
    }
    return this.prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
