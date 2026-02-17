import { getTop10Tracks, type Top10Track } from "../lib/rpc/tracks";
import type { GetTop10TracksResponse } from "../lib/rpc/tracks";
import { getEnv } from "../lib/env";

export type ShowTrack = Top10Track & { voteCount: number };

const VOTE_COLUMN_ALIASES = ["vote_count", "votes", "cheer_count"];

function formatCheerCount(n: number): string {
  return n.toLocaleString();
}

export function formatCheerDisplay(voteCount: number): string {
  return `응원 ${formatCheerCount(voteCount)}`;
}

async function fetchWithVoteCount(
  token: string | undefined
): Promise<{ ok: true; data: ShowTrack[] } | { ok: false; fallback: true }> {
  const { supabaseUrl, supabaseAnonKey } = getEnv();
  const select = "id,title,artist,rank,vote_count";
  const url = `${supabaseUrl}/rest/v1/final_tracks_public_v?select=${encodeURIComponent(select)}&order=rank.asc.nullslast,id.asc&limit=10`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: token ? `Bearer ${token}` : `Bearer ${supabaseAnonKey}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = String(body?.message ?? body?.code ?? res.status);
    if (msg.includes("PGRST204") || msg.includes("vote_count") || msg.includes("column")) {
      return { ok: false, fallback: true };
    }
    throw new Error(msg);
  }

  const rows = await res.json();
  if (!Array.isArray(rows)) return { ok: false, fallback: true };

  const data: ShowTrack[] = rows.map((r: Record<string, unknown>, i: number) => {
    const id = typeof r.id === "string" ? r.id : String(r.id ?? "");
    const title =
      (typeof r.title === "string" ? r.title : null) ??
      (typeof (r as Record<string, unknown>).song_title === "string" ? (r as Record<string, unknown>).song_title : null) ??
      `트랙 ${i + 1}`;
    const artist =
      typeof r.artist === "string" ? r.artist : undefined;
    const rank = typeof r.rank === "number" ? r.rank : i + 1;
    let voteCount = 0;
    for (const alias of VOTE_COLUMN_ALIASES) {
      const v = (r as Record<string, unknown>)[alias];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        voteCount = Math.floor(v);
        break;
      }
    }
    return { id, title, artist, rank, voteCount };
  });

  return { ok: true, data };
}

export async function getShowTracks(accessToken?: string): Promise<
  | { ok: true; data: ShowTrack[] }
  | Extract<GetTop10TracksResponse, { ok: false }>
> {
  try {
    const withVotes = await fetchWithVoteCount(accessToken);
    if (withVotes.ok) return withVotes;

    const base = await getTop10Tracks(accessToken);
    if (!base.ok) return base;

    const data: ShowTrack[] = base.data.map((t) => ({ ...t, voteCount: 0 }));
    return { ok: true, data };
  } catch {
    const base = await getTop10Tracks(accessToken);
    if (!base.ok) return base;
    const data: ShowTrack[] = base.data.map((t) => ({ ...t, voteCount: 0 }));
    return { ok: true, data };
  }
}

export async function getTrackById(
  trackId: string,
  accessToken?: string
): Promise<{ ok: true; data: ShowTrack } | { ok: false }> {
  const list = await getShowTracks(accessToken);
  if (!list.ok) return { ok: false };
  const found = list.data.find((t) => t.id === trackId);
  if (found) return { ok: true, data: found };
  return { ok: false };
}
