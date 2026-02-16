import { toAppError, type AppError } from "../../../src/lib/errors";

type GetPlayUrlInput = {
  finalTrackId: string;
  accessToken?: string;
};

type GetPlayUrlOk = {
  ok: true;
  data: {
    signedUrl: string;
    expiresIn: number;
    correlationId?: string;
  };
};

type GetPlayUrlFail = {
  ok: false;
  error: AppError;
};

export type GetPlayUrlResponse = GetPlayUrlOk | GetPlayUrlFail;

function getSupabaseEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_CONFIG_MISSING");
  }
  return { url, anonKey };
}

export async function getTrackPlayUrl(input: GetPlayUrlInput): Promise<GetPlayUrlResponse> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(`${url}/functions/v1/get-track-play-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: input.accessToken ? `Bearer ${input.accessToken}` : `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ finalTrackId: input.finalTrackId }),
    });

    const payload = await res.json();
    if (!res.ok) {
      return { ok: false, error: toAppError(payload) };
    }

    const record = payload as Record<string, unknown>;
    if (typeof record.signedUrl !== "string" || typeof record.expiresIn !== "number") {
      return {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: "Invalid get-track-play-url response shape",
          userMessage: "잠시 후 다시 시도해 주세요",
          retryable: true,
        },
      };
    }

    return {
      ok: true,
      data: {
        signedUrl: record.signedUrl,
        expiresIn: record.expiresIn,
        correlationId: typeof record.correlationId === "string" ? record.correlationId : undefined,
      },
    };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}
