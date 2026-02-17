// Contract: docs/contracts/api.md - cast_votes_max3 RPC
// Params: p_final_track_id, p_client_request_id, p_device_fingerprint (optional)
// Returns: remaining_votes, vote_count, voted_track_id, ...

import { getEnv } from "../lib/env";

export type VoteTrackResult =
  | { ok: true; remaining: number }
  | { ok: false; code: string; message?: string };

function generateClientRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function voteTrack(
  trackId: string,
  accessToken: string | undefined
): Promise<VoteTrackResult> {
  if (!accessToken) {
    return { ok: false, code: "AUTH_REQUIRED", message: "로그인이 필요해요" };
  }

  const { supabaseUrl, supabaseAnonKey } = getEnv();
  const body = {
    p_final_track_id: trackId,
    p_client_request_id: generateClientRequestId(),
  };

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/cast_votes_max3`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  const err = payload?.error ?? payload;
  const msg =
    typeof err?.message === "string"
      ? err.message
      : typeof payload?.message === "string"
        ? payload.message
        : "";

  if (!res.ok) {
    let code =
      (err?.code ?? (typeof payload?.code === "string" ? payload.code : null) ?? String(res.status)) as string;
    if (msg.includes("DUPLICATE_VOTE")) code = "DUPLICATE_VOTE";
    else if (msg.includes("VOTE_LIMIT_EXCEEDED")) code = "VOTE_LIMIT_EXCEEDED";
    const message =
      typeof err?.userMessage === "string" ? err.userMessage : msg ? String(msg).slice(0, 80) : undefined;
    return { ok: false, code, message };
  }

  const row = Array.isArray(payload) ? payload[0] : payload;
  const remaining =
    typeof row?.remaining_votes === "number" ? row.remaining_votes : typeof row?.remaining_votes === "string" ? parseInt(row.remaining_votes, 10) : 0;
  return { ok: true, remaining: Number.isFinite(remaining) ? Math.max(0, remaining) : 0 };
}
