'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function AudioPlayer({ src, durationMs, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationMs ? durationMs / 1000 : 0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Reseta estado quando o src muda (novo áudio)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsPlaying(false);
    setCurrentTime(0);
    setHasError(false);
    setIsLoading(false);
    setDuration(durationMs ? durationMs / 1000 : 0);
    audio.load();
  }, [src, durationMs]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => setDuration(audio.duration);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onError = () => { setHasError(true); setIsLoading(false); };

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
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audio.play()
        .then(() => { setIsPlaying(true); setIsLoading(false); })
        .catch(() => { setHasError(true); setIsLoading(false); });
    }
  }, [isPlaying, hasError]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar || !duration) return;

    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(ratio * duration, duration));
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayDuration = duration > 0 ? formatTime(duration) : durationMs ? formatTime(durationMs / 1000) : '--:--';
  const displayCurrent = formatTime(currentTime);

  return (
    <div className={cn('flex items-center gap-2 w-[220px]', className)}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Ícone de microfone */}
      <div className="text-muted-foreground flex-shrink-0">
        <Mic className="h-4 w-4" />
      </div>

      {/* Botão play/pause */}
      <button
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

        <div className="flex justify-between">
          <span className="text-[10px] leading-none text-muted-foreground">
            {hasError ? 'Erro ao carregar' : displayCurrent}
          </span>
          <span className="text-[10px] leading-none text-muted-foreground">
            {displayDuration}
          </span>
        </div>
      </div>
    </div>
  );
}
