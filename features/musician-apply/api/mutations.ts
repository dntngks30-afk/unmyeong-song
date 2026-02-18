/**
 * 뮤지션 승인 신청 - 샘플 업로드 API
 * PR-NEXT-03: purpose=application 전용
 */
import { toAppError, type AppError } from "../../../src/lib/errors";
import { getEnv } from "../../../src/lib/env";
import { readFileBytes } from "../../../src/lib/upload/readFileBytes";
import type { LocalFileInput, UploadSession } from "../../submission/model/types";

const AUDIO_MAX_BYTES = 10 * 1024 * 1024;

export async function createApplicationSampleUploadSession(input: {
  applicationId: string;
  accessToken: string;
  file: LocalFileInput;
}): Promise<{ ok: true; data: UploadSession } | { ok: false; error: AppError }> {
  try {
    if (!input.accessToken) {
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
    const body = {
      purpose: "application" as const,
      applicationId: input.applicationId,
      kind: "audio" as const,
      filename: input.file.filename,
      mimeType: input.file.mimeType,
    };
    console.log(
      "[uploadSession][reqKeys]",
      Object.keys(body),
      "bodyPreview",
      JSON.stringify({
        purpose: body.purpose,
        songId: undefined,
        applicationId: body.applicationId,
        kind: body.kind,
      })
    );
    const token = input.accessToken;
    const projectRef = supabaseUrl?.split("https://")[1]?.split(".")[0];
    console.log(
      "[create-upload-session][client] tokenLen=",
      token?.length ?? 0,
      "segments=",
      token ? token.split(".").length : 0,
      "projectRef=",
      projectRef
    );

    const fnUrl = `${supabaseUrl}/functions/v1/create-upload-session`;
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    const xProjectRef = res.headers.get("x-project-ref");
    console.log(
      "[create-upload-session][client] status=",
      res.status,
      "x-project-ref=",
      xProjectRef,
      "body=",
      text.slice(0, 200)
    );
    if (!res.ok) {
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
      return { ok: false, error: toAppError(payload) };
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: "Invalid JSON response",
          userMessage: "잠시 후 다시 시도해 주세요",
          retryable: true,
        },
      };
    }
    if (
      typeof payload.bucket !== "string" ||
      typeof payload.objectPath !== "string" ||
      typeof payload.signedUrl !== "string" ||
      typeof payload.expiresIn !== "number"
    ) {
      return {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: "create-upload-session response shape mismatch",
          userMessage: "잠시 후 다시 시도해 주세요",
          retryable: true,
        },
      };
    }
    return {
      ok: true,
      data: {
        bucket: payload.bucket,
        objectPath: payload.objectPath,
        signedUrl: payload.signedUrl,
        expiresIn: payload.expiresIn,
        correlationId: typeof payload.correlationId === "string" ? payload.correlationId : undefined,
      },
    };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}

export async function uploadFileToSignedUrl(
  session: UploadSession,
  file: LocalFileInput
): Promise<{ ok: true; objectPath: string } | { ok: false; error: AppError }> {
  try {
    const bytes = await readFileBytes(file.uri);
    console.log("[upload] fileUri=", file.uri, "byteLen=", bytes.length);
    if (bytes.length === 0) {
      return {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: "File is empty",
          userMessage: "파일을 읽을 수 없어요. 다시 선택해 주세요.",
          retryable: true,
        },
      };
    }
    if (bytes.length > AUDIO_MAX_BYTES) {
      return {
        ok: false,
        error: {
          code: "STORAGE_PATH_INVALID",
          message: "AUDIO_SIZE_EXCEEDED",
          userMessage: "오디오 파일은 10MB 이하만 업로드할 수 있어요.",
          retryable: false,
        },
      };
    }
    const res = await fetch(session.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.mimeType || "audio/mpeg" },
      body: bytes,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.log("[upload][FAIL]", res.status, t);
      return {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: `UPLOAD_FAILED_${res.status}`,
          userMessage: "업로드에 실패했어요. 다시 시도해 주세요.",
          retryable: true,
        },
      };
    }
    console.log("[upload][OK]", res.status, "path=", session.objectPath);
    return { ok: true, objectPath: session.objectPath };
  } catch (error) {
    console.error("[upload][FAIL] exception", error);
    return { ok: false, error: toAppError(error) };
  }
}

export async function assertStorageObject(input: {
  bucket: string;
  path: string;
  accessToken: string;
}): Promise<{ ok: true; exists: boolean } | { ok: false; error: AppError }> {
  try {
    if (!input.accessToken) {
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
    const res = await fetch(`${supabaseUrl}/functions/v1/assert-storage-object`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify({ bucket: input.bucket, path: input.path }),
    });
    const payload = await res.json();
    if (!res.ok) {
      return { ok: false, error: toAppError(payload) };
    }
    const exists = Boolean((payload as Record<string, unknown>)?.exists);
    return { ok: true, exists };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}

export async function submitMusicianApplication(input: {
  applicationId: string;
  accessToken: string;
}): Promise<{ ok: true } | { ok: false; error: AppError }> {
  try {
    if (!input.accessToken) {
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
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/submit_musician_application`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify({
        p_application_id: input.applicationId,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      const err = toAppError(payload);
      if (payload?.code === "SAMPLE_REQUIRED" || payload?.message?.includes("SAMPLE_REQUIRED")) {
        return {
          ok: false,
          error: {
            ...err,
            userMessage: "샘플 곡을 업로드해 주세요.",
          },
        };
      }
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}

export async function setMusicianApplicationSampleUrl(input: {
  applicationId: string;
  sampleUrl: string;
  accessToken: string;
}): Promise<{ ok: true } | { ok: false; error: AppError }> {
  try {
    if (!input.accessToken) {
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
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/set_musician_application_sample_url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify({
        p_application_id: input.applicationId,
        p_sample_url: input.sampleUrl,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      return { ok: false, error: toAppError(payload) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}

export async function setMusicianApplicationSamplePath(input: {
  applicationId: string;
  samplePath: string;
  accessToken: string;
}): Promise<{ ok: true } | { ok: false; error: AppError }> {
  try {
    if (!input.accessToken) {
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
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/set_musician_application_sample_path`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify({
        p_application_id: input.applicationId,
        p_sample_path: input.samplePath,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      return { ok: false, error: toAppError(payload) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}
