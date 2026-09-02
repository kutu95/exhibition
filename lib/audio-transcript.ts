export type TranscriptionResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

const WHISPER_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

export const transcribeSpokenStory = async (params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<TranscriptionResult> => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "OPENAI_API_KEY is not configured." };
  }

  const file = new File([new Uint8Array(params.buffer)], params.filename, {
    type: params.mimeType,
  });
  const body = new FormData();
  body.append("file", file);
  body.append("model", "whisper-1");
  body.append("response_format", "json");

  const response = await fetch(WHISPER_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  });

  const payload = (await response.json().catch(() => null)) as
    | { text?: string; error?: { message?: string } }
    | null;

  if (!response.ok) {
    return {
      ok: false,
      error: payload?.error?.message ?? `Transcription failed (${response.status}).`,
    };
  }

  const text = payload?.text?.trim() ?? "";
  if (!text) {
    return { ok: false, error: "Whisper returned an empty transcript." };
  }

  return { ok: true, text };
};
