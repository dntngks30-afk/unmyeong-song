/**
 * Admin RPC mutations
 * SSOT: docs/contracts/api.md, docs/plan/execution-logs/pr-next-01-admin-ops.md
 */
import { supabase } from "../../../src/lib/supabase";

export type AdminMutationResult =
  | { ok: true }
  | { ok: false; userMessage: string };

function mapRpcError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "처리에 실패했어요. 잠시 후 다시 시도해 주세요.";
  }
  const rec = error as Record<string, unknown>;
  const msg = String(rec.message ?? rec.details ?? "").toUpperCase();
  const code = String(rec.code ?? rec.error ?? "").toUpperCase();

  if (
    msg.includes("AUTH_REQUIRED") ||
    code.includes("AUTH_REQUIRED") ||
    msg.includes("JWT") ||
    msg.includes("UNAUTHORIZED")
  ) {
    return "로그인이 필요해요";
  }
  if (
    msg.includes("FORBIDDEN") ||
    msg.includes("RLS_DENIED") ||
    msg.includes("FORBIDDEN_ROLE") ||
    code.includes("FORBIDDEN") ||
    code.includes("RLS_DENIED") ||
    code.includes("PGRST301")
  ) {
    return "관리자 권한이 없어요";
  }
  return "처리에 실패했어요. 잠시 후 다시 시도해 주세요.";
}

export async function approveStory(
  _accessToken: string | undefined,
  storyId: string
): Promise<AdminMutationResult> {
  try {
    const { error } = await supabase.rpc("approve_story", {
      p_story_id: storyId,
    });
    if (error) {
      return { ok: false, userMessage: mapRpcError(error) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, userMessage: mapRpcError(e) };
  }
}

export async function rejectStory(
  _accessToken: string | undefined,
  storyId: string
): Promise<AdminMutationResult> {
  try {
    const { error } = await supabase.rpc("reject_story", {
      p_story_id: storyId,
    });
    if (error) {
      return { ok: false, userMessage: mapRpcError(error) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, userMessage: mapRpcError(e) };
  }
}

export async function approveMusicianApplication(
  _accessToken: string | undefined,
  applicationId: string
): Promise<AdminMutationResult> {
  try {
    const { error } = await supabase.rpc("approve_musician_application", {
      p_application_id: applicationId,
    });
    if (error) {
      return { ok: false, userMessage: mapRpcError(error) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, userMessage: mapRpcError(e) };
  }
}

export async function rejectMusicianApplication(
  _accessToken: string | undefined,
  applicationId: string,
  note?: string | null
): Promise<AdminMutationResult> {
  try {
    const { error } = await supabase.rpc("reject_musician_application", {
      p_application_id: applicationId,
      p_note: note ?? null,
    });
    if (error) {
      return { ok: false, userMessage: mapRpcError(error) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, userMessage: mapRpcError(e) };
  }
}

export async function undoMusicianApproval(
  _accessToken: string | undefined,
  userId: string
): Promise<AdminMutationResult> {
  try {
    const { error } = await supabase.rpc("undo_musician_approval", {
      p_user_id: userId,
    });
    if (error) {
      return { ok: false, userMessage: mapRpcError(error) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, userMessage: mapRpcError(e) };
  }
}

export async function approveFinalTrack(
  _accessToken: string | undefined,
  finalTrackId: string
): Promise<AdminMutationResult> {
  try {
    const { error } = await supabase.rpc("approve_final_track", {
      p_final_track_id: finalTrackId,
    });
    if (error) {
      return { ok: false, userMessage: mapRpcError(error) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, userMessage: mapRpcError(e) };
  }
}

export async function rejectFinalTrack(
  _accessToken: string | undefined,
  finalTrackId: string
): Promise<AdminMutationResult> {
  try {
    const { error } = await supabase.rpc("reject_final_track", {
      p_final_track_id: finalTrackId,
    });
    if (error) {
      return { ok: false, userMessage: mapRpcError(error) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, userMessage: mapRpcError(e) };
  }
}
