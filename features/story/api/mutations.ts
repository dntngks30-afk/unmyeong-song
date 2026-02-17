import { toAppError, type AppError } from "../../../src/lib/errors";
import { getEnv } from "../../../src/lib/env";

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

  try {
    const { supabaseUrl: url, supabaseAnonKey: anonKey } = getEnv();

    // Contract-first: write는 RPC 우선.
    const rpcRes = await fetch(`${url}/rest/v1/rpc/submit_story_rate_limited`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${input.accessToken}`,
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

type CastStoryVoteInput = {
  storyId: string;
  clientRequestId: string;
  accessToken?: string;
};

type CastStoryVoteResult =
  | {
      ok: true;
      storyId: string;
      voteId: string;
      storyVoteCount: number;
      idempotentReplay: boolean;
    }
  | {
      ok: false;
      error: AppError;
    };

function parseStoryVoteRow(payload: unknown) {
  const row = Array.isArray(payload) ? payload[0] : payload;
  const rec = (row ?? {}) as Record<string, unknown>;
  const storyId = typeof rec.story_id === "string" ? rec.story_id : null;
  const voteId = typeof rec.vote_id === "string" ? rec.vote_id : null;
  const storyVoteCount = typeof rec.story_vote_count === "number" ? rec.story_vote_count : null;
  const idempotentReplay = rec.idempotent_replay === true;

  if (!storyId || !voteId || storyVoteCount === null) return null;
  return { storyId, voteId, storyVoteCount, idempotentReplay };
}

export async function castStoryVoteMax1(input: CastStoryVoteInput): Promise<CastStoryVoteResult> {
  try {
    const { supabaseUrl: url, supabaseAnonKey: anonKey } = getEnv();
    const authHeader = input.accessToken ? `Bearer ${input.accessToken}` : `Bearer ${anonKey}`;

    const res = await fetch(`${url}/rest/v1/rpc/cast_story_vote_max1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: authHeader,
      },
      body: JSON.stringify({
        p_story_id: input.storyId,
        p_client_request_id: input.clientRequestId,
      }),
    });

    const payload = await res.json();
    if (!res.ok) {
      return { ok: false, error: toAppError(payload) };
    }

    const parsed = parseStoryVoteRow(payload);
    if (!parsed) {
      return {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: "cast_story_vote_max1 response shape mismatch",
          userMessage: "잠시 후 다시 시도해 주세요.",
          retryable: true,
        },
      };
    }

    return { ok: true, ...parsed };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}
