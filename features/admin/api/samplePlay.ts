/**
 * Admin: 신청 샘플곡 재생용 signed URL 조회
 * PR-NEXT-05: get-application-sample-url edge function 호출
 */
import { toAppError, type AppError } from "../../../src/lib/errors";
import { getEnv } from "../../../src/lib/env";

export type GetApplicationSampleUrlResult =
  | { ok: true; signedUrl: string; expiresIn: number }
  | { ok: false; error: AppError };

export async function getApplicationSamplePlayUrl(
  applicationId: string,
  accessToken: string
): Promise<GetApplicationSampleUrlResult> {
  try {
    if (!accessToken) {
      return {
        ok: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "AUTH_REQUIRED",
          userMessage: "로그인이 필요해요",
          retryable: false,
        },
      };
    }
    const { supabaseUrl, supabaseAnonKey } = getEnv();
    const res = await fetch(`${supabaseUrl}/functions/v1/get-application-sample-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ applicationId }),
    });

    const payload = await res.json();
    if (!res.ok) {
      const status = res.status;
      let userMessage: string;
      if (status === 401) {
        userMessage = "로그인이 필요해요";
      } else if (status === 403) {
        userMessage = "관리자 권한이 필요해요";
      } else if (status === 404) {
        userMessage = "샘플 파일을 찾을 수 없어요";
      } else {
        const mapped = toAppError(payload);
        userMessage = mapped.userMessage;
      }
      return {
        ok: false,
        error: {
          ...toAppError(payload),
          userMessage,
        },
      };
    }

    const signedUrl = payload?.signedUrl;
    const expiresIn = payload?.expiresIn ?? 60;
    if (typeof signedUrl !== "string") {
      return {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: "Invalid response shape",
          userMessage: "재생 URL을 가져오지 못했어요",
          retryable: true,
        },
      };
    }

    return { ok: true, signedUrl, expiresIn };
  } catch (error) {
    return {
      ok: false,
      error: toAppError(error),
    };
  }
}
