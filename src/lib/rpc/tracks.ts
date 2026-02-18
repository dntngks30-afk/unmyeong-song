import { getEnv } from "../env";
import { toAppError, type AppError } from "../errors";

type RawTrack = Record<string, unknown>;

export type Top10Track = {
  id: string;
  title: string;
  artist?: string;
  rank?: number;
  play_count?: number;
};

type GetTop10TracksOk = {
  ok: true;
  data: Top10Track[];
};

type GetTop10TracksFail = {
  ok: false;
  error: AppError;
};

export type GetTop10TracksResponse = GetTop10TracksOk | GetTop10TracksFail;

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapRawTrack(raw: RawTrack, index: number): Top10Track | null {
  const id = asOptionalString(raw.id);
  if (!id) return null;

  const rank = asOptionalNumber(raw.rank);
  const playCount = asOptionalNumber(raw.play_count) ?? 0;
  const title =
    asOptionalString(raw.title) ??
    asOptionalString(raw.song_title) ??
    asOptionalString(raw.name) ??
    `트랙 ${rank ?? index + 1}`;
  const artist = asOptionalString(raw.artist) ?? asOptionalString(raw.artist_name);

  return { id, title, artist, rank, play_count: playCount };
}

function toTop10QueryError(error: unknown): AppError {
  const mapped = toAppError(error);
  const textPool = `${mapped.message}\n${JSON.stringify(mapped.details ?? {})}`.toUpperCase();

  if (textPool.includes("PGRST205") || textPool.includes("FINAL_TRACKS_PUBLIC_V")) {
    return {
      code: "NOT_FOUND",
      message: mapped.message,
      userMessage: "Top10 뷰(final_tracks_public_v)를 찾을 수 없어요. DB 마이그레이션 상태를 확인해 주세요.",
      retryable: false,
      details: mapped.details,
      correlationId: mapped.correlationId,
    };
  }

  if (mapped.message.includes("SUPABASE_CONFIG_MISSING")) {
    return {
      code: "UNKNOWN",
      message: mapped.message,
      userMessage:
        "SUPABASE_CONFIG_MISSING: .env에 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY를 추가하고 공백 없이 다시 실행해 주세요.",
      retryable: false,
      details: mapped.details,
      correlationId: mapped.correlationId,
    };
  }

  return mapped;
}

const VIEW_NAMES = ["final_tracks_public_v", "final_tracks_public", "final_tracks_public_view"] as const;

function flattenFallbackRow(raw: Record<string, unknown>): RawTrack | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  if (!id) return null;
  const rank = typeof raw.rank_order === "number" ? raw.rank_order : null;
  let title: string | undefined;
  let artist: string | undefined;
  const songs = raw.songs;
  if (songs && typeof songs === "object" && !Array.isArray(songs)) {
    const s = songs as Record<string, unknown>;
    title = typeof s.title === "string" ? s.title : undefined;
    const prof = s.profiles;
    if (prof && typeof prof === "object" && !Array.isArray(prof)) {
      const p = prof as Record<string, unknown>;
      const dn = p.display_name;
      artist = typeof dn === "string" && dn.trim() ? dn : "익명 뮤지션";
    } else {
      artist = "익명 뮤지션";
    }
  }
  if (!title) return null;
  return {
    id,
    title,
    artist: artist ?? "익명 뮤지션",
    rank: rank ?? undefined,
    play_count: 0,
  } as RawTrack;
}

export async function getTop10Tracks(accessToken?: string): Promise<GetTop10TracksResponse> {
  const { supabaseUrl, supabaseAnonKey } = getEnv();
  const authHeader = accessToken ? `Bearer ${accessToken}` : `Bearer ${supabaseAnonKey}`;
  const headers = { apikey: supabaseAnonKey, Authorization: authHeader };
  const query = "select=id,title,artist,rank,play_count&order=rank.asc.nullslast,id.asc&limit=10";

  for (const viewName of VIEW_NAMES) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/${viewName}?${query}`, {
        method: "GET",
        headers,
      });
      const payload = await response.json();

      if (response.ok) {
        const rows = Array.isArray(payload) ? payload : [];
        const mapped = rows
          .map((row, index) => mapRawTrack(row as RawTrack, index))
          .filter((row): row is Top10Track => row !== null);
        if (viewName !== VIEW_NAMES[0] && __DEV__) {
          console.log(`[tracks] Top10 from fallback view: ${viewName}`);
        }
        return { ok: true, data: mapped };
      }

      if (response.status === 404) {
        if (__DEV__) {
          console.log(`[tracks] View ${viewName} not found (404), trying next`);
        }
        continue;
      }

      return { ok: false, error: toTop10QueryError(payload) };
    } catch (error) {
      if (__DEV__) {
        console.warn(`[tracks] Fetch ${viewName} failed:`, error);
      }
      continue;
    }
  }

  try {
    const fallbackQuery =
      "select=id,rank_order,songs(title,artist_id,profiles(display_name))&status=eq.top10&order=rank_order.asc.nullslast,id.asc&limit=10";
    const response = await fetch(`${supabaseUrl}/rest/v1/final_tracks?${fallbackQuery}`, {
      method: "GET",
      headers,
    });
    const payload = await response.json();

    if (response.ok) {
      const rows = Array.isArray(payload) ? payload : [];
      const mapped = rows
        .map((r) => flattenFallbackRow(r as Record<string, unknown>))
        .filter((row): row is RawTrack => row !== null)
        .map((row, index) => mapRawTrack(row, index))
        .filter((row): row is Top10Track => row !== null);
      if (__DEV__) {
        console.log("[tracks] Top10 from final_tracks table fallback");
      }
      return { ok: true, data: mapped };
    }
  } catch (e) {
    if (__DEV__) {
      console.warn("[tracks] final_tracks fallback failed:", e);
    }
  }

  return {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message: "All Top10 sources failed (view missing or schema mismatch)",
      userMessage: "Top10 뷰를 찾을 수 없어요. DB 마이그레이션을 확인해 주세요. (supabase db push)",
      retryable: false,
      details: { tried: [...VIEW_NAMES, "final_tracks"] },
    },
  };
}
