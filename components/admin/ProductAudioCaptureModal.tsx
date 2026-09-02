"use client";

import { useEffect, useRef, useState } from "react";

import { ADMIN_CLIENT_FETCH_LONG_TIMEOUT_MS, adminClientFetch, adminClientFetchError } from "../../lib/admin-client-fetch";
import {
  audioFilenameFromUrl,
  audioStemFromProduct,
  extensionForAudioUpload,
  filterExistingAudioStories,
  formatAudioClock,
  type ExistingAudioStory,
} from "../../lib/photo-audio";
import { encodeMonoWav, mixToMono } from "../../lib/wav-encode";
import styles from "./ProductAudioCaptureModal.module.css";

type ProductAudioCaptureModalProps = {
  open: boolean;
  slug: string;
  title: string;
  currentProductId?: string | null;
  onClose: () => void;
  onApplied: (fields: { audioUrl: string; audioDuration: string; audioTranscript: string }) => void;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

const pickRecorderMimeType = (): string => {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
};

const readAudioDuration = (file: Blob): Promise<number | null> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });

const recordingToWav = async (blob: Blob): Promise<{ file: File; durationSeconds: number } | null> => {
  const context = new AudioContext();
  try {
    if (context.state === "suspended") await context.resume();
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) =>
      decoded.getChannelData(index),
    );
    const wav = encodeMonoWav(mixToMono(channels), decoded.sampleRate);
    const file = new File([wav], "recording.wav", { type: "audio/wav" });
    return { file, durationSeconds: decoded.duration };
  } catch {
    return null;
  } finally {
    await context.close().catch(() => undefined);
  }
};

const createSpeechRecognition = (): SpeechRecognitionLike | null => {
  const SpeechRecognitionCtor =
    typeof window === "undefined"
      ? null
      : ((window as Window & {
          SpeechRecognition?: new () => SpeechRecognitionLike;
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }).SpeechRecognition ??
        (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
          .webkitSpeechRecognition);
  if (!SpeechRecognitionCtor) return null;
  const recognition = new SpeechRecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-AU";
  return recognition;
};

export function ProductAudioCaptureModal({
  open,
  slug,
  title,
  currentProductId = null,
  onClose,
  onApplied,
}: ProductAudioCaptureModalProps) {
  const stem = audioStemFromProduct(slug, title);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const tickRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stories, setStories] = useState<ExistingAudioStory[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const [storyQuery, setStoryQuery] = useState("");
  const [selectedStoryUrl, setSelectedStoryUrl] = useState<string | null>(null);

  const resetPreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPendingFile(null);
  };

  const stopMedia = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRecording(false);
  };

  useEffect(() => {
    if (open) return;
    stopMedia();
    resetPreview();
    setLiveTranscript("");
    setElapsedSeconds(0);
    setError(null);
    setStatus(null);
    setSaving(false);
    setMode("new");
    setStoryQuery("");
    setSelectedStoryUrl(null);
    setStoriesError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close resets capture state
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setStoriesLoading(true);
    setStoriesError(null);

    void adminClientFetch("/api/admin/audio")
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { stories?: ExistingAudioStory[]; error?: string }
          | null;
        if (!active) return;
        if (!response.ok) {
          setStories([]);
          setStoriesError(payload?.error ?? "Could not load existing audio.");
          return;
        }
        setStories(payload?.stories ?? []);
      })
      .catch((loadError) => {
        if (!active) return;
        setStories([]);
        setStoriesError(adminClientFetchError(loadError));
      })
      .finally(() => {
        if (active) setStoriesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open, saving]);

  useEffect(
    () => () => {
      stopMedia();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const setPreparedFile = (file: File, objectUrl?: string) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = objectUrl ?? URL.createObjectURL(file);
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
    setPendingFile(file);
  };

  const chooseExisting = () => {
    stopMedia();
    resetPreview();
    setLiveTranscript("");
    setError(null);
    setStatus(null);
    setMode("existing");
  };

  const chooseNew = () => {
    setSelectedStoryUrl(null);
    setError(null);
    setStatus(null);
    setMode("new");
  };

  const startRecording = async () => {
    setError(null);
    setStatus(null);
    setMode("new");
    setSelectedStoryUrl(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record audio. Upload a file instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      resetPreview();
      setLiveTranscript("");
      setElapsedSeconds(0);

      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void (async () => {
          const wav = await recordingToWav(blob);
          if (wav) {
            setPreparedFile(wav.file);
            return;
          }
          const extension = extensionForAudioUpload({ name: "recording", type: blob.type }) ?? "webm";
          setPreparedFile(new File([blob], `recording.${extension}`, { type: blob.type || "audio/webm" }));
        })();
      };
      recorder.start();
      setRecording(true);
      tickRef.current = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);

      const recognition = createSpeechRecognition();
      if (recognition) {
        let finalText = "";
        recognition.onresult = (event) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result) continue;
            if (result.isFinal) finalText = `${finalText} ${result[0].transcript}`.trim();
            else interim = `${interim} ${result[0].transcript}`.trim();
          }
          setLiveTranscript([finalText, interim].filter(Boolean).join(" ").trim());
        };
        recognition.onerror = () => undefined;
        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          recognitionRef.current = null;
        }
      }
    } catch {
      setError("Microphone permission was denied. You can still upload a file.");
      stopMedia();
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRecording(false);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!extensionForAudioUpload(file)) {
      setError("Use an MP3, M4A, OGG, WAV, or WEBM file.");
      return;
    }
    setLiveTranscript("");
    setPreparedFile(file);
    setMode("new");
    setSelectedStoryUrl(null);
  };

  const saveAudio = async () => {
    if (mode === "existing") {
      const story = stories.find((item) => item.audio_url === selectedStoryUrl);
      if (!story) {
        setError("Select an existing recording first.");
        return;
      }
      onApplied({
        audioUrl: story.audio_url,
        audioDuration: story.audio_duration ?? "",
        audioTranscript: story.audio_transcript ?? "",
      });
      onClose();
      return;
    }

    if (!pendingFile) {
      setError("Record or choose a file first.");
      return;
    }
    if (!stem) {
      setError("Add a product title first so the file can be named to match this photograph.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus("Saving audio and transcribing…");

    try {
      const durationSeconds =
        (await readAudioDuration(pendingFile)) ?? (elapsedSeconds > 0 ? elapsedSeconds : null);
      const body = new FormData();
      body.append("file", pendingFile, pendingFile.name);
      body.append("slug", slug);
      body.append("title", title);
      if (durationSeconds !== null) body.append("duration_seconds", String(durationSeconds));
      if (liveTranscript.trim()) body.append("live_transcript", liveTranscript.trim());

      const response = await adminClientFetch("/api/admin/upload/audio", {
        method: "POST",
        body,
        timeoutMs: ADMIN_CLIENT_FETCH_LONG_TIMEOUT_MS,
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        url_path?: string;
        duration?: string | null;
        transcript?: string | null;
        transcript_source?: "whisper" | "browser" | "none";
        transcript_error?: string | null;
      } | null;

      if (!response.ok || !payload?.url_path) {
        setError(payload?.error ?? "Failed to save audio.");
        setStatus(null);
        return;
      }

      const transcript = payload.transcript?.trim() ?? "";
      onApplied({
        audioUrl: payload.url_path,
        audioDuration: payload.duration ?? (durationSeconds !== null ? formatAudioClock(durationSeconds) : ""),
        audioTranscript: transcript,
      });
      if (!transcript && payload.transcript_error) {
        setStatus(null);
        setError(
          `${payload.transcript_error} The file is saved on the product; add a transcript by hand if needed.`,
        );
        return;
      }
      onClose();
    } catch (saveError) {
      setError(adminClientFetchError(saveError));
      setStatus(null);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const pendingExtension = pendingFile ? extensionForAudioUpload(pendingFile) : null;
  const targetName = stem ? `${stem}.${pendingExtension ?? "wav"}` : "add-a-title-first";
  const visibleStories = filterExistingAudioStories(stories, storyQuery);
  const selectedStory = stories.find((story) => story.audio_url === selectedStoryUrl) ?? null;
  const canUse =
    mode === "existing" ? Boolean(selectedStory) : Boolean(pendingFile && stem);

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-audio-capture-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Hear the story</p>
            <h2 id="product-audio-capture-title">Audio for this photograph</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} disabled={saving} aria-label="Close">
            ×
          </button>
        </header>

        <p className={styles.filename}>
          {mode === "existing" ? (
            <>
              Choose a recording already used on another photograph. Both products keep the same file and transcript —
              this is not a copy.
            </>
          ) : stem ? (
            <>
              New recordings are saved as <code>/audio/{targetName}</code>. Recordings are stored as WAV; uploaded files
              keep their original format.
            </>
          ) : (
            <>Enter a title on the product first so a new file can be named to match it.</>
          )}
        </p>

        <div className={styles.actions}>
          {recording ? (
            <button type="button" className={styles.recordStop} onClick={stopRecording} disabled={saving}>
              Stop recording · {formatAudioClock(elapsedSeconds)}
            </button>
          ) : (
            <button
              type="button"
              className={mode === "new" ? styles.recordStart : styles.secondary}
              onClick={() => {
                chooseNew();
                void startRecording();
              }}
              disabled={saving || !stem}
            >
              Record audio
            </button>
          )}
          <button
            type="button"
            className={styles.secondary}
            onClick={() => fileInputRef.current?.click()}
            disabled={saving || recording || !stem}
          >
            Upload a file
          </button>
          <button
            type="button"
            className={mode === "existing" ? styles.recordStart : styles.secondary}
            onClick={chooseExisting}
            disabled={saving || recording}
          >
            Use existing audio
          </button>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept="audio/mpeg,audio/mp4,audio/m4a,audio/ogg,audio/wav,audio/webm,.mp3,.m4a,.ogg,.wav,.webm"
            onChange={(event) => {
              handleFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </div>

        {mode === "existing" ? (
          <div className={styles.existing}>
            <label className={styles.search}>
              Search photographs or filename
              <input
                type="search"
                value={storyQuery}
                onChange={(event) => setStoryQuery(event.target.value)}
                placeholder="Sandy Currents"
                disabled={saving}
              />
            </label>
            {storiesLoading ? <p className={styles.hint}>Loading existing recordings…</p> : null}
            {storiesError ? <p className={styles.error}>{storiesError}</p> : null}
            {!storiesLoading && !storiesError && stories.length === 0 ? (
              <p className={styles.hint}>No photographs have audio yet. Record or upload one first.</p>
            ) : null}
            {!storiesLoading && stories.length > 0 && visibleStories.length === 0 ? (
              <p className={styles.hint}>No recordings match that search.</p>
            ) : null}
            {visibleStories.length > 0 ? (
              <ul className={styles.existingList}>
                {visibleStories.map((story) => {
                  const titles = story.products
                    .filter((product) => product.id !== currentProductId)
                    .map((product) => product.title);
                  const label = titles.length > 0 ? titles.join(", ") : story.products.map((product) => product.title).join(", ");
                  const selected = story.audio_url === selectedStoryUrl;
                  return (
                    <li key={story.audio_url}>
                      <button
                        type="button"
                        className={`${styles.existingItem} ${selected ? styles.existingItemActive : ""}`}
                        onClick={() => {
                          setSelectedStoryUrl(story.audio_url);
                          setError(null);
                        }}
                        disabled={saving}
                      >
                        <span className={styles.existingTitles}>{label}</span>
                        <span className={styles.existingMeta}>
                          {audioFilenameFromUrl(story.audio_url)}
                          {story.audio_duration ? ` · ${story.audio_duration}` : ""}
                          {story.products.length > 1 ? ` · ${story.products.length} photographs` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {selectedStory ? (
              <div className={styles.preview}>
                <p className={styles.previewLabel}>Preview</p>
                <audio controls preload="metadata" src={selectedStory.audio_url}>
                  Your browser cannot preview this recording.
                </audio>
                {selectedStory.audio_transcript ? (
                  <p className={styles.existingTranscript}>{selectedStory.audio_transcript}</p>
                ) : (
                  <p className={styles.hint}>This recording has no transcript yet. You can add one on the product after applying it.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {recording ? <p className={styles.recordingFlag}>Recording… speak the story for this photograph.</p> : null}

            {previewUrl ? (
              <div className={styles.preview}>
                <p className={styles.previewLabel}>{pendingFile?.name ?? "Preview"}</p>
                <audio controls preload="metadata" src={previewUrl}>
                  Your browser cannot preview this recording.
                </audio>
              </div>
            ) : null}

            {liveTranscript ? (
              <label className={styles.transcript}>
                Draft transcript
                <textarea value={liveTranscript} onChange={(event) => setLiveTranscript(event.target.value)} rows={5} />
              </label>
            ) : (
              <p className={styles.hint}>
                Saving transcribes the recording automatically and copies the text into the transcript field.
              </p>
            )}
          </>
        )}

        {error ? <p className={styles.error}>{error}</p> : null}
        {status && !error ? <p className={styles.status}>{status}</p> : null}

        <div className={styles.footer}>
          <button type="button" className={styles.secondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={styles.primary} onClick={() => void saveAudio()} disabled={saving || !canUse}>
            {saving ? "Saving…" : "Use this audio"}
          </button>
        </div>
      </div>
    </div>
  );
}
