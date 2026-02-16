import { toAppError, type AppError } from "../../../src/lib/errors";
import type {
  CompleteSubmissionInput,
  CreateUploadSessionInput,
  LocalFileInput,
  UploadSession,
} from "../model/types";

type SubmissionResult =
  | { ok: true; songId: string; status?: string }
  | { ok: false; error: AppError };

function getSupabaseEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_CONFIG_MISSING");
  }
  return { url, anonKey };
}

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toUploadSession(payload: unknown): UploadSession | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.bucket !== "string" ||
    typeof record.objectPath !== "string" ||
    typeof record.signedUrl !== "string" ||
    typeof record.expiresIn !== "number"
  ) {
    return null;
  }
  return {
    bucket: record.bucket,
    objectPath: record.objectPath,
    signedUrl: record.signedUrl,
    expiresIn: record.expiresIn,
    correlationId: typeof record.correlationId === "string" ? record.correlationId : undefined,
  };
}

function toUploadFailure(status: number, bodyText: string): AppError {
  const upper = bodyText.toUpperCase();
  if (status === 401 || upper.includes("AUTH_REQUIRED")) {
    return {
      code: "AUTH_REQUIRED",
      message: bodyText || "AUTH_REQUIRED",
      userMessage: "로그인이 필요해요",
      retryable: false,
    };
  }
  if (status === 403 || upper.includes("FORBIDDEN_ROLE")) {
    return {
      code: "FORBIDDEN_ROLE",
      message: bodyText || "FORBIDDEN_ROLE",
      userMessage: "권한이 없어요",
      retryable: false,
    };
  }
  if (upper.includes("STORAGE_PATH_INVALID") || status === 400) {
    return {
      code: "STORAGE_PATH_INVALID",
      message: bodyText || "STORAGE_PATH_INVALID",
      userMessage: "업로드 경로가 올바르지 않아요. 다시 시도해 주세요.",
      retryable: false,
    };
  }
  return {
    code: "UNKNOWN",
    message: bodyText || `UPLOAD_HTTP_${status}`,
    userMessage: "잠시 후 다시 시도해 주세요",
    retryable: true,
  };
}

export async function createUploadSession(
  input: CreateUploadSessionInput,
): Promise<{ ok: true; data: UploadSession } | { ok: false; error: AppError }> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const res = await fetch(`${url}/functions/v1/create-upload-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: input.accessToken ? `Bearer ${input.accessToken}` : `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        songId: input.songId,
        kind: input.kind,
        filename: input.file.filename,
        mimeType: input.file.mimeType,
      }),
    });

    const payload = await res.json();
    if (!res.ok) {
      return { ok: false, error: toAppError(payload) };
    }
    const mapped = toUploadSession(payload);
    if (!mapped) {
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
    return { ok: true, data: mapped };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}

export async function uploadFileToSignedUrl(
  session: UploadSession,
  file: LocalFileInput,
): Promise<{ ok: true } | { ok: false; error: AppError }> {
  try {
    const fileRes = await fetch(file.uri);
    if (!fileRes.ok) {
      return {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: `Failed to read local file: ${file.uri}`,
          userMessage: "잠시 후 다시 시도해 주세요",
          retryable: true,
        },
      };
    }

    const blob = await fileRes.blob();
    const uploadRes = await fetch(session.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.mimeType,
      },
      body: blob,
    });

    if (!uploadRes.ok) {
      const bodyText = await uploadRes.text();
      return { ok: false, error: toUploadFailure(uploadRes.status, bodyText) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}

export async function completeSongSubmission(
  input: CompleteSubmissionInput,
): Promise<SubmissionResult> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const coverPath = trimOrNull(input.coverPath);
    const res = await fetch(`${url}/rest/v1/rpc/complete_song_submission`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: input.accessToken ? `Bearer ${input.accessToken}` : `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        p_song_id: input.songId,
        p_audio_path: input.audioPath,
        p_cover_path: coverPath,
        p_making_note: input.makingNote.trim(),
      }),
    });

    const payload = await res.json();
    if (!res.ok) {
      return { ok: false, error: toAppError(payload) };
    }

    const row = Array.isArray(payload) ? payload[0] : payload;
    const record = (row ?? {}) as Record<string, unknown>;
    const songId =
      (typeof record.song_id === "string" && record.song_id) ||
      (typeof record.id === "string" && record.id) ||
      input.songId;
    const status = typeof record.status === "string" ? record.status : undefined;
    return { ok: true, songId, status };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}
