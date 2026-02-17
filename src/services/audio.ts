// Contract: docs/contracts/api.md, ticket-05-be.md
// POST /functions/v1/get-track-play-url { finalTrackId } → signedUrl, expiresIn

import { getEnv } from "../lib/env";

export type GetPlayableAudioUrlResult =
  | { ok: true; url: string; expiresAt: number }
  | { ok: false; userMessage: string; code?: string };

const USER_MSG = "재생 링크를 가져오지 못했어요.";

export async function getPlayableAudioUrl(
  trackId: string,
  accessToken: string | undefined
): Promise<GetPlayableAudioUrlResult> {
  if (!accessToken) {
    return { ok: false, userMessage: USER_MSG, code: "AUTH_REQUIRED" };
  }

  const { supabaseUrl } = getEnv();
  const endpoint = `${supabaseUrl}/functions/v1/get-track-play-url`;

  const attempt = async (): Promise<GetPlayableAudioUrlResult> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ finalTrackId: trackId }),
    });

    const data = await res.json().catch(() => ({}));
    const err = data?.error;
    const code = (err?.code ?? data?.code ?? String(res.status)) as string;

    if (res.ok) {
      const url = typeof data?.signedUrl === "string" ? data.signedUrl : null;
      const expiresIn = typeof data?.expiresIn === "number" ? data.expiresIn : 60;
      if (url) {
        const expiresAt = Date.now() + expiresIn * 1000;
        return { ok: true, url, expiresAt };
      }
    }

    return { ok: false, userMessage: USER_MSG, code };
  };

  const first = await attempt();
  if (first.ok) return first;

  const retryable = [403, 404, 500, 503].some(
    (s) => first.code === String(s) || String(first.code).includes("NOT_FOUND") || String(first.code).includes("UNKNOWN")
  );
  if (retryable) {
    const second = await attempt();
    if (second.ok) return second;
    return second;
  }

  return first;
}
