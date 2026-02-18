import { toAppError, type AppError } from "../../../src/lib/errors";
import { getEnv } from "../../../src/lib/env";

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

export async function getTrackPlayUrl(input: GetPlayUrlInput): Promise<GetPlayUrlResponse> {
  try {
    const { supabaseUrl, supabaseAnonKey } = getEnv();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    };
    if (input.accessToken) {
      headers.Authorization = `Bearer ${input.accessToken}`;
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/get-track-play-url`, {
      method: "POST",
      headers,
      body: JSON.stringify({ finalTrackId: input.finalTrackId }),
    });

    const payload = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        return {
          ok: false,
          error: {
            code: "AUTH_REQUIRED",
            message: typeof (payload as any)?.message === "string" ? (payload as any).message : "AUTH_REQUIRED",
            userMessage: "로그인이 필요해요",
            retryable: false,
            details: payload,
            correlationId:
              typeof (payload as any)?.correlationId === "string" ? (payload as any).correlationId : undefined,
          },
        };
      }
      if (res.status === 403) {
        return {
          ok: false,
          error: {
            code: "FORBIDDEN_ROLE",
            message: typeof (payload as any)?.message === "string" ? (payload as any).message : "FORBIDDEN_ROLE",
            userMessage: "권한이 없어요",
            retryable: false,
            details: payload,
            correlationId:
              typeof (payload as any)?.correlationId === "string" ? (payload as any).correlationId : undefined,
          },
        };
      }
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

/** 재생 수 집계 (5분 내 중복 방지는 호출 측에서 처리) */
export async function incrementTrackPlay(
  finalTrackId: string,
  accessToken?: string
): Promise<{ ok: true } | { ok: false }> {
  if (!accessToken) return { ok: false };
  try {
    const { supabase } = await import("../../../src/lib/supabase");
    const { error } = await supabase.rpc("increment_track_play", {
      p_final_track_id: finalTrackId,
    });
    return error ? { ok: false } : { ok: true };
  } catch {
    return { ok: false };
  }
}
