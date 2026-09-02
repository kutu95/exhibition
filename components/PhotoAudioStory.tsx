"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { formatAudioClock, parseAudioDuration } from "../lib/photo-audio";
import { usePhotoAudioStoryPlayback } from "./PhotoAudioStoryProvider";
import styles from "./PhotoAudioStory.module.css";

type PhotoAudioStoryProps = {
  storyId: string;
  title: string;
  audioUrl: string;
  audioDuration?: string | null;
  audioTranscript?: string | null;
};

export function PhotoAudioStory({
  storyId,
  title,
  audioUrl,
  audioDuration,
  audioTranscript,
}: PhotoAudioStoryProps) {
  const transcriptId = useId();
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { activeStoryId, claimStory, releaseStory } = usePhotoAudioStoryPlayback();

  const [expanded, setExpanded] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const labelledDuration = parseAudioDuration(audioDuration ?? null);
  const durationSeconds = fileDuration && fileDuration > 0 ? fileDuration : labelledDuration;
  const durationLabel = durationSeconds !== null ? formatAudioClock(durationSeconds) : null;
  const transcript = audioTranscript?.trim() || null;

  const pausePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (activeStoryId !== storyId) {
      pausePlayback();
    }
  }, [activeStoryId, pausePlayback, storyId]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      releaseStory(storyId);
    };
  }, [releaseStory, storyId]);

  const playStory = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    claimStory(storyId);
    setLoadError(null);
    try {
      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      setIsPlaying(false);
      setLoadError(error instanceof Error ? error.message : "The recording could not be played.");
    }
  };

  const handleHearStory = () => {
    setExpanded(true);
    void playStory();
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pausePlayback();
      return;
    }
    void playStory();
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    void playStory();
  };

  const handleClose = () => {
    pausePlayback();
    setExpanded(false);
    releaseStory(storyId);
  };

  const handleSeek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      handleClose();
    }
  };

  const inviteLabel = durationLabel ? `Hear the story, ${durationLabel}` : `Hear the story of ${title}`;

  return (
    <div className={styles.wrap} onKeyDown={handleKeyDown}>
      <audio
        ref={audioRef}
        className={styles.audio}
        src={audioUrl}
        preload={expanded ? "metadata" : "none"}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const next = event.currentTarget.duration;
          if (Number.isFinite(next) && next > 0) setFileDuration(next);
        }}
        onDurationChange={(event) => {
          const next = event.currentTarget.duration;
          if (Number.isFinite(next) && next > 0) setFileDuration(next);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          releaseStory(storyId);
        }}
        onError={() => setLoadError("The recording could not be loaded.")}
      />

      {!expanded ? (
        <button
          type="button"
          className={styles.invite}
          onClick={handleHearStory}
          aria-label={inviteLabel}
          aria-expanded={false}
          aria-controls={playerId}
        >
          <span className={styles.inviteIcon} aria-hidden>
            ▶
          </span>
          <span>Hear the story</span>
          {durationLabel ? <span className={styles.inviteDuration}>· {durationLabel}</span> : null}
        </button>
      ) : (
        <div className={styles.player} id={playerId}>
          <div className={styles.playerRow}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={handlePlayPause}
              aria-label={isPlaying ? `Pause story: ${title}` : `Play story: ${title}`}
            >
              <span aria-hidden>{isPlaying ? "❚❚" : "▶"}</span>
            </button>
            <label className={styles.progressLabel}>
              <span className={styles.srOnly}>Story playback position</span>
              <input
                type="range"
                className={styles.progress}
                min={0}
                max={Math.max(durationSeconds ?? 0, currentTime, 0.01)}
                step={0.1}
                value={Math.min(currentTime, durationSeconds ?? currentTime)}
                onChange={(event) => handleSeek(Number(event.currentTarget.value))}
                aria-valuetext={`${formatAudioClock(currentTime)} of ${durationLabel ?? formatAudioClock(currentTime)}`}
              />
            </label>
            <p className={styles.times}>
              <span>{formatAudioClock(currentTime)}</span>
              <span aria-hidden> / </span>
              <span>{durationLabel ?? "0:00"}</span>
            </p>
            <button
              type="button"
              className={styles.iconButton}
              onClick={handleRestart}
              aria-label={`Restart story: ${title}`}
            >
              <span aria-hidden>↺</span>
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={handleClose}
              aria-label="Close story player"
            >
              <span aria-hidden>×</span>
            </button>
          </div>
          {loadError ? <p className={styles.error}>{loadError}</p> : null}
        </div>
      )}

      {transcript ? (
        <div className={expanded ? styles.transcriptBlock : undefined}>
          {expanded ? (
            <button
              type="button"
              className={styles.transcriptToggle}
              aria-expanded={transcriptOpen}
              aria-controls={transcriptId}
              onClick={() => setTranscriptOpen((open) => !open)}
            >
              {transcriptOpen ? "Hide transcript" : "Read transcript"}
            </button>
          ) : null}
          <div
            id={transcriptId}
            className={styles.transcript}
            hidden={!expanded || !transcriptOpen}
            role="region"
            aria-label={`Transcript of ${title}`}
          >
            <p>{transcript}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
