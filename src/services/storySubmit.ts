// Contract: docs/contracts/api.md (submit_story_rate_limited)
// RPC params: p_title, p_body, p_client_request_id (uuid, optional)
// Returns: [{ story_id, status }]
import { supabase } from "../lib/supabase";
import { toAppError, type AppError } from "../lib/errors";

export type SubmitStoryResult =
  | { ok: true; storyId: string }
  | { ok: false; error: AppError };

function extractStoryId(rows: unknown): string | null {
  if (Array.isArray(rows) && rows.length > 0) {
    const first = rows[0] as Record<string, unknown>;
    if (typeof first.story_id === "string" && first.story_id.length > 0) return first.story_id;
  }
  return null;
}

export async function submitStory(params: {
  title: string;
  body: string;
  clientRequestId?: string | null;
}): Promise<SubmitStoryResult> {
  const title = params.title.trim();
  const body = params.body.trim();
  if (!title || !body) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN",
        message: "Title and body are required",
        userMessage: "제목과 내용을 입력해 주세요.",
        retryable: false,
      },
    };
  }

  const payload = {
    p_title: title,
    p_body: body,
    p_client_request_id: params.clientRequestId ?? null,
  };

  const { data, error } = await supabase.rpc("submit_story_rate_limited", payload);

  if (error) {
    return { ok: false, error: toAppError(error) };
  }

  const storyId = extractStoryId(data);
  if (storyId) {
    return { ok: true, storyId };
  }

  return {
    ok: false,
    error: {
      code: "UNKNOWN",
      message: "RPC response missing story_id",
      userMessage: "잠시 후 다시 시도해 주세요.",
      retryable: true,
    },
  };
}
