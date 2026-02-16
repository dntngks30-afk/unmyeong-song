import { toAppError, type AppError } from "../../../src/lib/errors";
import type { Story, StoryDetailState, StoryListState } from "../model/types";

type RawStory = {
  id?: unknown;
  title?: unknown;
  body?: unknown;
  created_at?: unknown;
  author_id?: unknown;
  is_blocked?: unknown;
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

function getSupabaseEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_CONFIG_MISSING");
  }
  return { url, anonKey };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function mapStory(raw: RawStory): Story | null {
  const id = asString(raw.id);
  const title = asString(raw.title);
  const content = asString(raw.body);
  const createdAt = asString(raw.created_at);
  if (!id || !title || !content || !createdAt) return null;

  const authorId = asString(raw.author_id) ?? undefined;
  const status = raw.is_blocked === true ? "blocked" : "open";

  return {
    id,
    title,
    content,
    createdAt,
    authorId,
    status,
  };
}

export const initialStoryListState: StoryListState = { status: "loading", data: [] };
export const initialStoryDetailState: StoryDetailState = { status: "loading", data: null };

export async function getStoryList(params: ListParams = {}): Promise<StoryListResult> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const limit = Number.isFinite(params.limit) ? Math.max(1, Number(params.limit)) : DEFAULT_LIMIT;
    const offset = Number.isFinite(params.offset) ? Math.max(0, Number(params.offset)) : 0;
    const query = new URLSearchParams({
      select: "id,title,body,created_at,author_id,is_blocked",
      is_blocked: "eq.false",
      order: "created_at.desc",
      limit: String(limit),
      offset: String(offset),
    });

    const res = await fetch(`${url}/rest/v1/stories?${query.toString()}`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: params.accessToken ? `Bearer ${params.accessToken}` : `Bearer ${anonKey}`,
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

export async function getStoryDetail(storyId: string, accessToken?: string): Promise<StoryDetailResult> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const query = new URLSearchParams({
      select: "id,title,body,created_at,author_id,is_blocked",
      id: `eq.${storyId}`,
      limit: "1",
    });

    const res = await fetch(`${url}/rest/v1/stories?${query.toString()}`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${anonKey}`,
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
