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

function getSupabaseEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_CONFIG_MISSING");
  }
  return { url, anonKey };
}

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
  const artist =
    asOptionalString(raw.artist) ??
    asOptionalString(raw.artist_name);

  return { id, title, artist, rank };
}

export async function getTop10Tracks(accessToken?: string): Promise<GetTop10TracksResponse> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const query =
      "select=id,title,artist,rank&order=rank.asc.nullslast,id.asc&limit=10";
    const res = await fetch(`${url}/rest/v1/final_tracks_public_v?${query}`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${anonKey}`,
      },
    });

    const payload = await res.json();
    if (!res.ok) {
      return { ok: false, error: toAppError(payload) };
    }

    const rows = Array.isArray(payload) ? payload : [];
    const mapped = rows
      .map((row, index) => mapRawTrack(row as RawTrack, index))
      .filter((row): row is Top10Track => row !== null);

    return { ok: true, data: mapped };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}
