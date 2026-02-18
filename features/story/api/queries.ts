import { toAppError, type AppError } from "../../../src/lib/errors";
import { getEnv } from "../../../src/lib/env";
import { supabase } from "../../../src/lib/supabase";
import type { Story, StoryDetailState, StoryListState } from "../model/types";

type RawStory = {
  id?: unknown;
  title?: unknown;
  body?: unknown;
  content?: unknown;
  created_at?: unknown;
  author_id?: unknown;
  user_id?: unknown;
  is_blocked?: unknown;
  vote_count?: unknown;
};

type ListParams = {
  limit?: number;
  offset?: number;
  accessToken?: string;
};

type StoryListResult =
  | { ok: true; state: "ready" | "empty"; data: Story[] }
  | { ok: false; state: "error"; error: AppError; data: Story[] };

type StoryDetailResult =
  | { ok: true; state: "ready"; data: Story }
  | { ok: false; state: "not_found" | "error"; error?: AppError; data: null };

const DEFAULT_LIMIT = 20;

async function resolveAccessToken(input?: string): Promise<string | undefined> {
  if (input) return input;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function mapStory(raw: RawStory): Story | null {
  const id = asString(raw.id);
  const title = asString(raw.title);
  const content = asString(raw.content) ?? asString(raw.body);
  const createdAt = asString(raw.created_at);
  if (!id || !title || !content || !createdAt) return null;

  const authorId = asString(raw.user_id) ?? asString(raw.author_id) ?? undefined;
  const status = raw.is_blocked === true ? "blocked" : "open";
  const voteCount = typeof raw.vote_count === "number" ? raw.vote_count : undefined;

  return {
    id,
    title,
    content,
    createdAt,
    authorId,
    status,
    voteCount,
  };
}

export const initialStoryListState: StoryListState = { status: "loading", data: [] };
export const initialStoryDetailState: StoryDetailState = { status: "loading", data: null };

export async function getStoryList(params: ListParams = {}): Promise<StoryListResult> {
  try {
    const { supabaseUrl: url, supabaseAnonKey: anonKey } = getEnv();
    const accessToken = await resolveAccessToken(params.accessToken);
    const limit = Number.isFinite(params.limit) ? Math.max(1, Number(params.limit)) : DEFAULT_LIMIT;
    const offset = Number.isFinite(params.offset) ? Math.max(0, Number(params.offset)) : 0;
    const query = new URLSearchParams({
      select: "id,title,body,created_at,author_id,is_blocked",
      story_status: "eq.approved",
      is_blocked: "eq.false",
      order: "created_at.desc",
      limit: String(limit),
      offset: String(offset),
    });

    const reqUrl = `${url}/rest/v1/stories?${query.toString()}`;
    if (__DEV__) {
      console.log("[getStoryList] query", { story_status: "approved", source: "stories" });
    }
    const res = await fetch(reqUrl, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${anonKey}`,
      },
    });

    const payload = await res.json();
    if (!res.ok) {
      if (__DEV__) {
        console.warn("[getStoryList] failed", { status: res.status, payload });
      }
      return { ok: false, state: "error", error: toAppError(payload), data: [] };
    }

    const rows = Array.isArray(payload) ? payload : [];
    const mapped = rows
      .map((row) => mapStory(row as RawStory))
      .filter((story): story is Story => story !== null);

    if (mapped.length === 0) {
      return { ok: true, state: "empty", data: [] };
    }

    return { ok: true, state: "ready", data: mapped };
  } catch (error) {
    return { ok: false, state: "error", error: toAppError(error), data: [] };
  }
}

export async function getStoryDetail(storyId: string, accessToken?: string): Promise<StoryDetailResult> {
  try {
    const { supabaseUrl: url, supabaseAnonKey: anonKey } = getEnv();
    const resolvedToken = await resolveAccessToken(accessToken);
    const query = new URLSearchParams({
      select: "id,title,body,content,created_at,author_id,user_id,is_blocked",
      id: `eq.${storyId}`,
      limit: "1",
    });

    const res = await fetch(`${url}/rest/v1/stories?${query.toString()}`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: resolvedToken ? `Bearer ${resolvedToken}` : `Bearer ${anonKey}`,
      },
    });

    const payload = await res.json();
    if (!res.ok) {
      return { ok: false, state: "error", error: toAppError(payload), data: null };
    }

    const rows = Array.isArray(payload) ? payload : [];
    const mapped = rows.length > 0 ? mapStory(rows[0] as RawStory) : null;
    if (!mapped) {
      return { ok: false, state: "not_found", data: null };
    }

    return { ok: true, state: "ready", data: mapped };
  } catch (error) {
    return { ok: false, state: "error", error: toAppError(error), data: null };
  }
}

export async function getMyStoryList(input: {
  userId: string;
  accessToken: string;
  limit?: number;
}): Promise<StoryListResult> {
  try {
    const { supabaseUrl: url, supabaseAnonKey: anonKey } = getEnv();
    const safeLimit = Number.isFinite(input.limit) ? Math.max(1, Number(input.limit)) : DEFAULT_LIMIT;
    const query = new URLSearchParams({
      select: "id,title,body,content,created_at,author_id,user_id,is_blocked",
      or: `(user_id.eq.${input.userId},author_id.eq.${input.userId})`,
      order: "created_at.desc",
      limit: String(safeLimit),
    });

    const res = await fetch(`${url}/rest/v1/stories?${query.toString()}`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${input.accessToken}`,
      },
    });

    const payload = await res.json();
    if (!res.ok) {
      return { ok: false, state: "error", error: toAppError(payload), data: [] };
    }

    const rows = Array.isArray(payload) ? payload : [];
    const mapped = rows
      .map((row) => mapStory(row as RawStory))
      .filter((story): story is Story => story !== null);

    if (mapped.length === 0) {
      return { ok: true, state: "empty", data: [] };
    }
    return { ok: true, state: "ready", data: mapped };
  } catch (error) {
    return { ok: false, state: "error", error: toAppError(error), data: [] };
  }
}

export async function getBestStories(limit = 3, accessToken?: string): Promise<StoryListResult> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(4, Number(limit))) : 3;
  try {
    const { supabaseUrl: url, supabaseAnonKey: anonKey } = getEnv();
    const resolvedToken = await resolveAccessToken(accessToken);
    const query = new URLSearchParams({
      select: "id,title,body,created_at,author_id,vote_count",
      order: "vote_count.desc,created_at.desc",
      limit: String(safeLimit),
    });

    const res = await fetch(`${url}/rest/v1/best_stories_v?${query.toString()}`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: resolvedToken ? `Bearer ${resolvedToken}` : `Bearer ${anonKey}`,
      },
    });

    const payload = await res.json();

    if (!res.ok) {
      const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload ?? "");
      const isViewNotFound =
        res.status === 404 ||
        payloadStr.toUpperCase().includes("PGRST205") ||
        payloadStr.includes("best_stories_v") ||
        payloadStr.includes("does not exist");
      if (isViewNotFound && __DEV__) {
        console.warn("[getBestStories] best_stories_v unavailable, fallback to stories approved", {
          status: res.status,
          code: (payload as Record<string, unknown>)?.code,
        });
      }
      if (isViewNotFound) {
        return await getStoryListFallbackForBest(
          safeLimit,
          resolvedToken ?? anonKey,
          url,
          anonKey
        );
      }
      return { ok: false, state: "error", error: toAppError(payload), data: [] };
    }

    const rows = Array.isArray(payload) ? payload : [];
    const mapped = rows
      .map((row) => mapStory(row as RawStory))
      .filter((story): story is Story => story !== null);

    if (mapped.length === 0) {
      return { ok: true, state: "empty", data: [] };
    }

    return { ok: true, state: "ready", data: mapped };
  } catch (error) {
    if (__DEV__) {
      console.warn("[getBestStories] exception, fallback to stories approved", error);
    }
    try {
      const { supabaseUrl: url, supabaseAnonKey: anonKey } = getEnv();
      const token = await resolveAccessToken(accessToken);
      return await getStoryListFallbackForBest(
        safeLimit,
        token ?? anonKey,
        url,
        anonKey
      );
    } catch (fallbackError) {
      return { ok: false, state: "error", error: toAppError(fallbackError), data: [] };
    }
  }
}

async function getStoryListFallbackForBest(
  limit: number,
  authHeader: string,
  url: string,
  anonKey: string
): Promise<StoryListResult> {
  const query = new URLSearchParams({
    select: "id,title,body,created_at,author_id,is_blocked",
    story_status: "eq.approved",
    is_blocked: "eq.false",
    order: "created_at.desc",
    limit: String(limit),
  });
  const res = await fetch(`${url}/rest/v1/stories?${query.toString()}`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${authHeader}`,
    },
  });
  const payload = await res.json();
  if (!res.ok) {
    return { ok: false, state: "error", error: toAppError(payload), data: [] };
  }
  const rows = Array.isArray(payload) ? payload : [];
  const mapped = rows
    .map((row: unknown) => mapStory(row as RawStory))
    .filter((story): story is Story => story !== null);
  return {
    ok: true,
    state: mapped.length > 0 ? "ready" : "empty",
    data: mapped,
  };
}
