import { toAppError, type AppError } from "../../../src/lib/errors";

type CreateStoryInput = {
  title: string;
  content: string;
  clientRequestId: string;
  accessToken?: string;
};

type CreateStorySuccess = {
  ok: true;
  storyId: string;
};

type CreateStoryFail = {
  ok: false;
  error: AppError;
};

type CreateStoryResult = CreateStorySuccess | CreateStoryFail;

const TITLE_MAX_LENGTH = 80;
const CONTENT_MAX_LENGTH = 2000;

function getSupabaseEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_CONFIG_MISSING");
  }
  return { url, anonKey };
}

function makeClientValidationError(message: string): AppError {
  return {
    code: "UNKNOWN",
    message,
    userMessage: "잠시 후 다시 시도해 주세요.",
    retryable: false,
  };
}

function validateInput(input: CreateStoryInput): AppError | null {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) {
    return makeClientValidationError("Title/content must not be empty");
  }
  if (title.length > TITLE_MAX_LENGTH) {
    return makeClientValidationError(`Title too long: max ${TITLE_MAX_LENGTH}`);
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    return makeClientValidationError(`Content too long: max ${CONTENT_MAX_LENGTH}`);
  }
  return null;
}

function extractStoryId(payload: unknown): string | null {
  if (Array.isArray(payload) && payload.length > 0) {
    const first = payload[0] as Record<string, unknown>;
    if (typeof first.id === "string" && first.id.length > 0) return first.id;
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.id === "string" && record.id.length > 0) return record.id;
    if (typeof record.story_id === "string" && record.story_id.length > 0) return record.story_id;
  }
  return null;
}

export async function createStory(input: CreateStoryInput): Promise<CreateStoryResult> {
  const inputError = validateInput(input);
  if (inputError) {
    return { ok: false, error: inputError };
  }

  try {
    const { url, anonKey } = getSupabaseEnv();
    const authHeader = input.accessToken ? `Bearer ${input.accessToken}` : `Bearer ${anonKey}`;

    // Contract-first: write는 RPC 우선.
    const rpcRes = await fetch(`${url}/rest/v1/rpc/submit_story_rate_limited`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: authHeader,
      },
      body: JSON.stringify({
        p_title: input.title.trim(),
        p_body: input.content.trim(),
        p_client_request_id: input.clientRequestId,
      }),
    });

    const rpcPayload = await rpcRes.json();
    if (rpcRes.ok) {
      const storyId = extractStoryId(rpcPayload);
      if (storyId) {
        return { ok: true, storyId };
      }
      return {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: "submit_story_rate_limited response missing story id",
          userMessage: "잠시 후 다시 시도해 주세요.",
          retryable: true,
        },
      };
    }

    return { ok: false, error: toAppError(rpcPayload) };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}
