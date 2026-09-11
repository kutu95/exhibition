import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readFile = vi.fn();

vi.mock("node:fs/promises", () => ({
  default: { readFile },
  readFile,
}));

vi.mock("../lib/admin-auth", () => ({
  verifyAdminSession: vi.fn(),
}));

vi.mock("../lib/audio-transcript", () => ({
  transcribeSpokenStory: vi.fn(),
}));

vi.mock("../lib/media-storage", () => ({
  resolveReadableMediaPath: (relativePath: string) => `/tmp/${relativePath}`,
}));

describe("POST /api/admin/audio/transcribe", () => {
  beforeEach(() => {
    vi.resetModules();
    readFile.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    const { verifyAdminSession } = await import("../lib/admin-auth");
    vi.mocked(verifyAdminSession).mockResolvedValue(false);
    const { POST } = await import("../app/api/admin/audio/transcribe/route");
    const response = await POST(
      new Request("http://localhost/api/admin/audio/transcribe", {
        method: "POST",
        body: JSON.stringify({ audio_url: "/audio/gnarabup-eye.wav" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("transcribes an existing recording from disk", async () => {
    const { verifyAdminSession } = await import("../lib/admin-auth");
    const { transcribeSpokenStory } = await import("../lib/audio-transcript");
    vi.mocked(verifyAdminSession).mockResolvedValue(true);
    readFile.mockResolvedValue(Buffer.from("wav-bytes"));
    vi.mocked(transcribeSpokenStory).mockResolvedValue({
      ok: true,
      text: "This picture doesn't really have a left or right.",
    });

    const { POST } = await import("../app/api/admin/audio/transcribe/route");
    const response = await POST(
      new Request("http://localhost/api/admin/audio/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: "/audio/gnarabup-eye.wav" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ transcript: "This picture doesn't really have a left or right." });
    expect(readFile).toHaveBeenCalledWith("/tmp/audio/gnarabup-eye.wav");
    expect(transcribeSpokenStory).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      filename: "gnarabup-eye.wav",
      mimeType: "audio/wav",
    });
  });

  it("rejects a path outside managed audio", async () => {
    const { verifyAdminSession } = await import("../lib/admin-auth");
    vi.mocked(verifyAdminSession).mockResolvedValue(true);
    const { POST } = await import("../app/api/admin/audio/transcribe/route");
    const response = await POST(
      new Request("http://localhost/api/admin/audio/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: "/images/photo.mp3" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(readFile).not.toHaveBeenCalled();
  });
});
