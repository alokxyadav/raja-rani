import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';
import '../../../courses/data/courses_providers.dart';
import '../../../../core/theme/app_theme.dart';

/// Plays a lesson. Fetches a fresh, short-lived signed URL every time this
/// screen opens (never caches or hard-codes one) — matches the entitlement
/// model built on the backend, where the token expires in 20 minutes.
class LessonPlayerScreen extends ConsumerStatefulWidget {
  const LessonPlayerScreen({super.key, required this.lessonId, required this.lessonTitle});
  final String lessonId;
  final String lessonTitle;

  @override
  ConsumerState<LessonPlayerScreen> createState() => _LessonPlayerScreenState();
}

class _LessonPlayerScreenState extends ConsumerState<LessonPlayerScreen> {
  VideoPlayerController? _controller;
  Timer? _progressTimer;
  bool _loading = true;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    _loadAndPlay();
  }

  Future<void> _loadAndPlay() async {
    setState(() {
      _loading = true;
      _errorText = null;
    });
    try {
      final auth = await ref.read(coursesRepositoryProvider).getPlaybackToken(widget.lessonId);
      final controller = VideoPlayerController.networkUrl(Uri.parse(auth['playbackUrl']));
      await controller.initialize();

      final resumeFrom = (auth['resumeFromSeconds'] as num?)?.toInt() ?? 0;
      if (resumeFrom > 0) {
        await controller.seekTo(Duration(seconds: resumeFrom));
      }

      controller.play();
      setState(() {
        _controller = controller;
        _loading = false;
      });

      // Throttled sync — every 20s while playing, not per-frame/per-second,
      // per the brief's explicit "don't make a network request every
      // second" requirement.
      _progressTimer = Timer.periodic(const Duration(seconds: 20), (_) => _syncProgress());
    } catch (e) {
      setState(() {
        _loading = false;
        // A 403 here means "not entitled" — the entitlement check already
        // ran server-side; this screen just surfaces that plainly rather
        // than showing a generic video error.
        _errorText = e.toString().contains('403')
            ? "You're not enrolled in this course."
            : 'Could not load this video. Please try again.';
      });
    }
  }

  Future<void> _syncProgress({bool completed = false}) async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    final position = controller.value.position.inSeconds;
    try {
      await ref.read(coursesRepositoryProvider).updateProgress(
            widget.lessonId,
            position,
            completed: completed ? true : null,
          );
    } catch (_) {
      // Progress sync is best-effort from the UI's perspective — a failed
      // sync shouldn't interrupt playback. It'll catch up on the next tick.
    }
  }

  @override
  void dispose() {
    _progressTimer?.cancel();
    _syncProgress(); // final sync on the way out, so closing early isn't lost
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(widget.lessonTitle, overflow: TextOverflow.ellipsis),
      ),
      body: Center(
        child: _loading
            ? const CircularProgressIndicator(color: Colors.white)
            : _errorText != null
                ? Padding(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_errorText!, style: const TextStyle(color: Colors.white), textAlign: TextAlign.center),
                        const SizedBox(height: AppSpacing.md),
                        ElevatedButton(onPressed: _loadAndPlay, child: const Text('Retry')),
                      ],
                    ),
                  )
                : AspectRatio(
                    aspectRatio: _controller!.value.aspectRatio,
                    child: Stack(
                      alignment: Alignment.bottomCenter,
                      children: [
                        VideoPlayer(_controller!),
                        _PlayerControls(controller: _controller!, onMarkComplete: () => _syncProgress(completed: true)),
                      ],
                    ),
                  ),
      ),
    );
  }
}

class _PlayerControls extends StatefulWidget {
  const _PlayerControls({required this.controller, required this.onMarkComplete});
  final VideoPlayerController controller;
  final VoidCallback onMarkComplete;

  @override
  State<_PlayerControls> createState() => _PlayerControlsState();
}

class _PlayerControlsState extends State<_PlayerControls> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onTick);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTick);
    super.dispose();
  }

  void _onTick() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final value = widget.controller.value;
    return Container(
      color: Colors.black54,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Row(
        children: [
          IconButton(
            color: Colors.white,
            icon: Icon(value.isPlaying ? Icons.pause : Icons.play_arrow),
            onPressed: () => setState(() => value.isPlaying ? widget.controller.pause() : widget.controller.play()),
          ),
          Expanded(
            child: VideoProgressIndicator(widget.controller, allowScrubbing: true, colors: const VideoProgressColors(playedColor: AppColors.secondary)),
          ),
          TextButton(
            onPressed: widget.onMarkComplete,
            child: const Text('Mark complete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
