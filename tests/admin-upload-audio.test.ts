import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const writeFile = vi.fn(async () => undefined);
const mkdir = vi.fn(async () => undefined);

vi.mock("node:fs/promises", () => ({
  default: { mkdir, writeFile },
  mkdir,
  writeFile,
}));

vi.mock("../lib/admin-auth", () => ({
  verifyAdminSession: vi.fn(),
}));

vi.mock("../lib/audio-transcript", () => ({
  transcribeSpokenStory: vi.fn(),
}));

vi.mock("../lib/media-storage", () => ({
  resolveCanonicalMediaPath: (relativePath: string) => `/tmp/${relativePath}`,
}));

describe("POST /api/admin/upload/audio", () => {
  beforeEach(() => {
    vi.resetModules();
    writeFile.mockClear();
    mkdir.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated uploads", async () => {
    const { verifyAdminSession } = await import("../lib/admin-auth");
    vi.mocked(verifyAdminSession).mockResolvedValue(false);
    const { POST } = await import("../app/api/admin/upload/audio/route");
    const response = await POST(new Request("http://localhost/api/admin/upload/audio", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("renames the file to the product slug and returns a transcript", async () => {
    const { verifyAdminSession } = await import("../lib/admin-auth");
    const { transcribeSpokenStory } = await import("../lib/audio-transcript");
    vi.mocked(verifyAdminSession).mockResolvedValue(true);
    vi.mocked(transcribeSpokenStory).mockResolvedValue({ ok: true, text: "The rocks hold the last light." });

    const { POST } = await import("../app/api/admin/upload/audio/route");
    const body = new FormData();
    body.append("file", new File([new Uint8Array([1, 2, 3])], "Take 3.MP3", { type: "audio/mpeg" }));
    body.append("slug", "redgate-beach-panorama-1-1");
    body.append("title", "Hiding in Plain Sight");
    body.append("duration_seconds", "47");

    const response = await POST(
      new Request("http://localhost/api/admin/upload/audio", { method: "POST", body }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      url_path: "/audio/redgate-beach-panorama-1-1.mp3",
      duration: "0:47",
      transcript: "The rocks hold the last light.",
      transcript_source: "whisper",
    });
    expect(writeFile).toHaveBeenCalledWith(
      "/tmp/audio/redgate-beach-panorama-1-1.mp3",
      expect.any(Buffer),
    );
  });
});
