import { toAppError, type AppError } from "../errors";
import { getEnv } from "../env";

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
    const { supabaseUrl, supabaseAnonKey } = getEnv();
    const requestBody = {
      p_final_track_id: input.finalTrackId,
      p_client_request_id: input.clientRequestId,
      ...(input.deviceFingerprint ? { p_device_fingerprint: input.deviceFingerprint } : {}),
    };

    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/cast_votes_max3`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: input.accessToken ? `Bearer ${input.accessToken}` : `Bearer ${supabaseAnonKey}`,
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
