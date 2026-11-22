// Same pattern as PaymentProvider / VideoProvider. LiveKit/Agora/Zoom can
// each be dropped in as an adapter later without touching LiveClassesService.

export interface LiveClassProvider {
  readonly name: string;
  generateJoinUrl(liveClassId: string, userId: string, role: 'host' | 'participant'): string;
}
