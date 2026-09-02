import { describe, expect, it } from "vitest";

import {
  audioStemFromProduct,
  extensionForAudioUpload,
  formatAudioClock,
  hasPhotoAudioStory,
  isValidAudioUrl,
  normalizeAudioFields,
  parseAudioDuration,
  productAudioUrl,
} from "../lib/photo-audio";

describe("isValidAudioUrl", () => {
  it("accepts managed local audio paths", () => {
    expect(isValidAudioUrl("/audio/hiding-in-plain-sight.mp3")).toBe(true);
    expect(isValidAudioUrl("/audio/isaac-rock.m4a")).toBe(true);
    expect(isValidAudioUrl("/audio/isaac-rock.wav")).toBe(true);
  });

  it("rejects other locations", () => {
    expect(isValidAudioUrl("/images/photo.mp3")).toBe(false);
    expect(isValidAudioUrl("https://cdn.example.com/story.mp3")).toBe(false);
    expect(isValidAudioUrl("/audio/../secret.mp3")).toBe(false);
  });
});

describe("audio duration", () => {
  it("parses m:ss and formats a clock", () => {
    expect(parseAudioDuration("0:47")).toBe(47);
    expect(parseAudioDuration("1:05")).toBe(65);
    expect(parseAudioDuration("99")).toBeNull();
    expect(formatAudioClock(47)).toBe("0:47");
    expect(formatAudioClock(65.9)).toBe("1:05");
  });
});

describe("normalizeAudioFields", () => {
  it("turns blank strings into null", () => {
    expect(
      normalizeAudioFields({
        audio_url: "  ",
        audio_duration: "",
        audio_transcript: "\n",
      }),
    ).toEqual({
      ok: true,
      value: { audio_url: null, audio_duration: null, audio_transcript: null },
    });
  });

  it("rejects a bad url or duration", () => {
    expect(normalizeAudioFields({ audio_url: "/audio/story.aac" }).ok).toBe(false);
    expect(normalizeAudioFields({ audio_duration: "47s" }).ok).toBe(false);
  });
});

describe("hasPhotoAudioStory", () => {
  it("is only true when a valid audio url is present", () => {
    expect(hasPhotoAudioStory({ audio_url: "/audio/hiding-in-plain-sight.mp3" })).toBe(true);
    expect(hasPhotoAudioStory({ audio_url: null })).toBe(false);
    expect(hasPhotoAudioStory({ audio_url: "/audio/missing.txt" })).toBe(false);
  });
});

describe("product audio filenames", () => {
  it("prefers the product slug so the file can be matched back", () => {
    expect(audioStemFromProduct("redgate-beach-panorama-1-1", "Hiding in Plain Sight")).toBe(
      "redgate-beach-panorama-1-1",
    );
    expect(audioStemFromProduct("", "Hiding in Plain Sight")).toBe("hiding-in-plain-sight");
    expect(audioStemFromProduct(" ", "")).toBeNull();
    expect(productAudioUrl("isaac-rock", "wav")).toBe("/audio/isaac-rock.wav");
  });

  it("maps an uploaded file to a managed extension", () => {
    expect(extensionForAudioUpload({ name: "Take 3.MP3", type: "" })).toBe("mp3");
    expect(extensionForAudioUpload({ name: "recording", type: "audio/webm;codecs=opus" })).toBe("webm");
    expect(extensionForAudioUpload({ name: "notes.txt", type: "text/plain" })).toBeNull();
  });
});
