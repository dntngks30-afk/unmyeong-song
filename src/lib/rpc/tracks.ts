import { getEnv } from "../env";
import { toAppError, type AppError } from "../errors";

type RawTrack = Record<string, unknown>;

export type Top10Track = {
  id: string;
  title: string;
  artist?: string;
  rank?: number;
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
  const title =
    asOptionalString(raw.title) ??
    asOptionalString(raw.song_title) ??
    asOptionalString(raw.name) ??
    `트랙 ${rank ?? index + 1}`;
  const artist = asOptionalString(raw.artist) ?? asOptionalString(raw.artist_name);

  return { id, title, artist, rank };
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

export async function getTop10Tracks(accessToken?: string): Promise<GetTop10TracksResponse> {
  try {
    const { supabaseUrl, supabaseAnonKey } = getEnv();
    const query =
      "select=id,title,artist,rank&order=rank.asc.nullslast,id.asc&limit=10";

    const response = await fetch(`${supabaseUrl}/rest/v1/final_tracks_public_v?${query}`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${supabaseAnonKey}`,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      return { ok: false, error: toTop10QueryError(payload) };
    }

    const rows = Array.isArray(payload) ? payload : [];
    const mapped = rows
      .map((row, index) => mapRawTrack(row as RawTrack, index))
      .filter((row): row is Top10Track => row !== null);

    return { ok: true, data: mapped };
  } catch (error) {
    return { ok: false, error: toTop10QueryError(error) };
  }
}
