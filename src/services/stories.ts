import { getEnv } from "../lib/env";

export type Story = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  voteCount?: number;
};

type ListResult =
  | { ok: true; data: Story[] }
  | { ok: false; data: []; reason: "error" | "empty" };

type DetailResult =
  | { ok: true; data: Story }
  | { ok: false; data: null; reason: "not_found" | "error" };

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function mapRow(r: Record<string, unknown>): Story | null {
  const id = asStr(r.id);
  const title = asStr(r.title);
  const content = asStr(r.content) ?? asStr(r.body);
  const createdAt = asStr(r.created_at);
  if (!id || !title || !content || !createdAt) return null;
  const voteCount = typeof r.vote_count === "number" && Number.isFinite(r.vote_count) ? r.vote_count : undefined;
  return { id, title, content, createdAt, voteCount };
}

export async function listStories(params: { limit?: number; accessToken?: string } = {}): Promise<ListResult> {
  try {
    const { supabaseUrl, supabaseAnonKey } = getEnv();
    const limit = Math.max(1, Math.min(100, params.limit ?? 50));
    const q = new URLSearchParams({
      select: "id,title,body,created_at,is_blocked",
      is_blocked: "eq.false",
      order: "created_at.desc",
      limit: String(limit),
    });
    const res = await fetch(`${supabaseUrl}/rest/v1/stories?${q}`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: params.accessToken ? `Bearer ${params.accessToken}` : `Bearer ${supabaseAnonKey}`,
      },
    });
    const payload = await res.json();
    if (!res.ok) return { ok: false, data: [], reason: "error" };
    const rows = Array.isArray(payload) ? payload : [];
    const data = rows.map((r) => mapRow(r as Record<string, unknown>)).filter((s): s is Story => s !== null);
    return { ok: true, data };
  } catch {
    return { ok: false, data: [], reason: "error" };
  }
}

export async function getStory(id: string, accessToken?: string): Promise<DetailResult> {
  try {
    const { supabaseUrl, supabaseAnonKey } = getEnv();
    const q = new URLSearchParams({
      select: "id,title,body,content,created_at",
      id: `eq.${id}`,
      limit: "1",
    });
    const res = await fetch(`${supabaseUrl}/rest/v1/stories?${q}`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${supabaseAnonKey}`,
      },
    });
    const payload = await res.json();
    if (!res.ok) return { ok: false, data: null, reason: "error" };
    const rows = Array.isArray(payload) ? payload : [];
    const story = rows.length > 0 ? mapRow(rows[0] as Record<string, unknown>) : null;
    if (!story) return { ok: false, data: null, reason: "not_found" };
    return { ok: true, data: story };
  } catch {
    return { ok: false, data: null, reason: "error" };
  }
}
