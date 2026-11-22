import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Simple StateProvider rather than a FutureProvider because the router's
/// redirect callback needs a synchronous value to check on every
/// navigation — it can't await a network call mid-redirect. Splash screen
/// fetches settings once and writes the result here; the router just reads
/// it.
final maintenanceModeProvider = StateProvider<bool>((ref) => false);
