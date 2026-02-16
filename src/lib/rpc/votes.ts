import { toAppError, type AppError } from "../errors";

type CastVotesRawRow = {
  accepted: boolean;
  remaining_votes: number;
  vote_count: number;
  vote_id: string;
  voted_track_id: string;
  idempotent_replay: boolean;
};

export type CastVotesInput = {
  finalTrackId: string;
  clientRequestId: string;
  deviceFingerprint?: string | null;
  accessToken?: string;
};

export type CastVotesResult = {
  voteId: string;
  votedTrackId: string;
  userVoteCount: number;
  idempotentReplay: boolean;
};

type CastVotesOk = {
  ok: true;
  data: CastVotesResult;
};

type CastVotesFail = {
  ok: false;
  error: AppError;
};

export type CastVotesResponse = CastVotesOk | CastVotesFail;

function getSupabaseEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_CONFIG_MISSING");
  }
  return { url, anonKey };
}

function toResult(raw: CastVotesRawRow): CastVotesResult {
  return {
    voteId: raw.vote_id,
    votedTrackId: raw.voted_track_id,
    userVoteCount: raw.vote_count,
    idempotentReplay: raw.idempotent_replay,
  };
}

export async function castVotesMax3(input: CastVotesInput): Promise<CastVotesResponse> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const requestBody = {
      p_final_track_id: input.finalTrackId,
      p_client_request_id: input.clientRequestId,
      ...(input.deviceFingerprint ? { p_device_fingerprint: input.deviceFingerprint } : {}),
    };

    const res = await fetch(`${url}/rest/v1/rpc/cast_votes_max3`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: input.accessToken ? `Bearer ${input.accessToken}` : `Bearer ${anonKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const payload = await res.json();

    if (!res.ok) {
      return { ok: false, error: toAppError(payload) };
    }

    const row = Array.isArray(payload) ? payload[0] : payload;
    return { ok: true, data: toResult(row as CastVotesRawRow) };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}
