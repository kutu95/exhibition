import { afterEach, describe, expect, it, vi } from "vitest";

import { transcribeSpokenStory } from "../lib/audio-transcript";

describe("transcribeSpokenStory", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("explains when Whisper is not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const result = await transcribeSpokenStory({
      buffer: Buffer.from("fake"),
      filename: "story.wav",
      mimeType: "audio/wav",
    });
    expect(result).toEqual({ ok: false, error: "OPENAI_API_KEY is not configured." });
  });

  it("returns Whisper text", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ text: "  The ship went down at dawn. " }),
      })),
    );

    const result = await transcribeSpokenStory({
      buffer: Buffer.from("fake"),
      filename: "story.wav",
      mimeType: "audio/wav",
    });
    expect(result).toEqual({ ok: true, text: "The ship went down at dawn." });
  });
});
