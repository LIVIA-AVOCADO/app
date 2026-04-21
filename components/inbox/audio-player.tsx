'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLAYBACK_SPEEDS = [1, 1.5, 2] as const;

interface AudioPlayerProps {
  src: string;
  durationMs?: number | null;
  className?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSpeedLabel(rate: (typeof PLAYBACK_SPEEDS)[number]): string {
  if (rate === 1) return '1x';
  if (rate === 1.5) return '1.5x';
  return '2x';
}

export function AudioPlayer({ src, durationMs, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [speedIndex, setSpeedIndex] = useState(0);
  const playbackRate: (typeof PLAYBACK_SPEEDS)[number] =
    PLAYBACK_SPEEDS[speedIndex] ?? PLAYBACK_SPEEDS[0];

  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: durationMs ? durationMs / 1000 : 0,
    isLoading: false,
    hasError: false,
  });

  const { isPlaying, currentTime, duration, isLoading, hasError } = playerState;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => setPlayerState((s) => ({ ...s, duration: audio.duration }));
    const onTimeUpdate = () => setPlayerState((s) => ({ ...s, currentTime: audio.currentTime }));
    const onEnded = () => setPlayerState((s) => ({ ...s, isPlaying: false, currentTime: 0 }));
    const onWaiting = () => setPlayerState((s) => ({ ...s, isLoading: true }));
    const onCanPlay = () => setPlayerState((s) => ({ ...s, isLoading: false }));
    const onError = () => setPlayerState((s) => ({ ...s, hasError: true, isLoading: false }));

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || hasError) return;

    if (isPlaying) {
      audio.pause();
      setPlayerState((s) => ({ ...s, isPlaying: false }));
    } else {
      setPlayerState((s) => ({ ...s, isLoading: true }));
      audio.play()
        .then(() => setPlayerState((s) => ({ ...s, isPlaying: true, isLoading: false })))
        .catch(() => setPlayerState((s) => ({ ...s, hasError: true, isLoading: false })));
    }
  }, [isPlaying, hasError]);

  const cyclePlaybackSpeed = useCallback(() => {
    if (hasError) return;
    setSpeedIndex((i) => (i + 1) % PLAYBACK_SPEEDS.length);
  }, [hasError]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar || !duration) return;

    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(ratio * duration, duration));
    audio.currentTime = newTime;
    setPlayerState((s) => ({ ...s, currentTime: newTime }));
  }, [duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayDuration = duration > 0 ? formatTime(duration) : durationMs ? formatTime(durationMs / 1000) : '--:--';
  const displayCurrent = formatTime(currentTime);
  const speedLabel = formatSpeedLabel(playbackRate);
  const speedAriaLabel = `Velocidade de reprodução, ${playbackRate === 1 ? 'normal' : `${playbackRate} vezes`}. Clicar para alterar.`;

  return (
    <div className={cn('flex items-center gap-2 w-[268px]', className)}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Ícone de microfone */}
      <div className="text-muted-foreground flex-shrink-0">
        <Mic className="h-4 w-4" />
      </div>

      {/* Botão play/pause */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={hasError}
        className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
          hasError
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-primary/10 hover:bg-primary/20 text-primary'
        )}
        aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
      >
        {isLoading ? (
          <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5 ml-0.5" />
        )}
      </button>

      {/* Barra de progresso + tempo */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className={cn(
            'h-1 rounded-full bg-border relative overflow-hidden',
            duration > 0 && !hasError ? 'cursor-pointer' : 'cursor-default'
          )}
        >
          <div
            className="h-full rounded-full bg-primary transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between gap-1">
          <span className="text-[10px] leading-none text-muted-foreground">
            {hasError ? 'Erro ao carregar' : displayCurrent}
          </span>
          <span className="text-[10px] leading-none text-muted-foreground tabular-nums">
            {displayDuration}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={cyclePlaybackSpeed}
        disabled={hasError}
        title={speedAriaLabel}
        aria-label={speedAriaLabel}
        className={cn(
          'flex-shrink-0 min-w-[2.5rem] h-7 px-1 rounded-md text-[10px] font-medium tabular-nums transition-colors',
          'border border-border bg-muted/40',
          hasError
            ? 'text-muted-foreground cursor-not-allowed opacity-60'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer'
        )}
      >
        {speedLabel}
      </button>
    </div>
  );
}
