import { getEnv } from "../../../src/lib/env";
import { toAppError, type AppError } from "../../../src/lib/errors";

export type ShowRoundType = "qualifier" | "semi" | "final";

export type RoundTrack = {
  seasonId: string;
  roundId: string;
  roundType: ShowRoundType;
  trackId: string;
  title: string;
  artist?: string | null;
  displayOrder: number;
};

type RoundTrackListResult =
  | { ok: true; state: "ready" | "empty"; data: RoundTrack[] }
  | { ok: false; state: "error"; error: AppError; data: RoundTrack[] };

type RoundTrackDetailResult =
  | { ok: true; data: RoundTrack }
  | { ok: false; error: AppError | null };

type RawRoundTrack = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseRoundType(value: unknown): ShowRoundType | null {
  if (value === "qualifier" || value === "semi" || value === "final") return value;
  return null;
}

function mapRoundTrack(raw: RawRoundTrack): RoundTrack | null {
  const seasonId = asString(raw.season_id);
  const roundId = asString(raw.round_id);
  const roundType = parseRoundType(raw.round_type);
  const trackId = asString(raw.track_id);
  const title = asString(raw.title);
  const displayOrder = asNumber(raw.display_order);
  if (!seasonId || !roundId || !roundType || !trackId || !title || displayOrder === null) {
    return null;
  }

  return {
    seasonId,
    roundId,
    roundType,
    trackId,
    title,
    artist: asString(raw.artist),
    displayOrder,
  };
}

export async function getActiveSeasonRoundTracks(accessToken?: string): Promise<RoundTrackListResult> {
  try {
    const { supabaseUrl, supabaseAnonKey } = getEnv();
    const query = new URLSearchParams({
      select: "season_id,round_id,round_type,track_id,title,artist,display_order",
      order: "round_type.asc,display_order.asc",
      limit: "100",
    });

    const res = await fetch(`${supabaseUrl}/rest/v1/active_season_round_tracks_v?${query.toString()}`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${supabaseAnonKey}`,
      },
    });

    const payload = await res.json();
    if (!res.ok) {
      return { ok: false, state: "error", error: toAppError(payload), data: [] };
    }

    const rows = Array.isArray(payload) ? payload : [];
    const mapped = rows
      .map((row) => mapRoundTrack(row as RawRoundTrack))
      .filter((row): row is RoundTrack => row !== null);

    if (mapped.length === 0) {
      return { ok: true, state: "empty", data: [] };
    }
    return { ok: true, state: "ready", data: mapped };
  } catch (error) {
    return { ok: false, state: "error", error: toAppError(error), data: [] };
  }
}

export async function getRoundTrackDetail(trackId: string, accessToken?: string): Promise<RoundTrackDetailResult> {
  try {
    const { supabaseUrl, supabaseAnonKey } = getEnv();
    const query = new URLSearchParams({
      select: "season_id,round_id,round_type,track_id,title,artist,display_order",
      track_id: `eq.${trackId}`,
      limit: "1",
    });

    const res = await fetch(`${supabaseUrl}/rest/v1/active_season_round_tracks_v?${query.toString()}`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${supabaseAnonKey}`,
      },
    });

    const payload = await res.json();
    if (!res.ok) {
      return { ok: false, error: toAppError(payload) };
    }

    const rows = Array.isArray(payload) ? payload : [];
    const mapped = rows.length > 0 ? mapRoundTrack(rows[0] as RawRoundTrack) : null;
    if (!mapped) return { ok: false, error: null };
    return { ok: true, data: mapped };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}
