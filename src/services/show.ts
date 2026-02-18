import { getTop10Tracks } from "../lib/rpc/tracks";
import { toAppError, type AppError } from "../lib/errors";

export type ShowTrack = {
  id: string;
  title: string;
  artist?: string | null;
  rank?: number | null;
  voteCount: number;
  playCount: number;
};

export function formatCheerDisplay(voteCount: number): string {
  const n = typeof voteCount === "number" && Number.isFinite(voteCount) ? voteCount : 0;
  return n >= 1000 ? `응원 ${(n / 1000).toFixed(1)}K` : `응원 ${n}`;
}

export function formatPlayCountDisplay(playCount: number): string {
  const n = typeof playCount === "number" && Number.isFinite(playCount) ? playCount : 0;
  return n >= 1000 ? `재생 ${(n / 1000).toFixed(1)}K회` : `재생 ${n}회`;
}

export async function getShowTracks(
  accessToken?: string
): Promise<
  | { ok: true; data: ShowTrack[] }
  | { ok: false; error: AppError }
> {
  try {
    const result = await getTop10Tracks(accessToken);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    const data: ShowTrack[] = result.data.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist ?? null,
      rank: t.rank ?? null,
      voteCount: 0,
      playCount: t.play_count ?? 0,
    }));
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: toAppError(e) };
  }
}

export async function getTrackById(
  trackId: string,
  accessToken?: string
): Promise<
  | { ok: true; data: { title: string; artist: string | null; voteCount: number; playCount: number } }
  | { ok: false }
> {
  try {
    const result = await getTop10Tracks(accessToken);
    if (!result.ok) {
      return { ok: false };
    }
    const t = result.data.find((r) => r.id === trackId);
    if (!t) {
      return { ok: false };
    }
    return {
      ok: true,
      data: {
        title: t.title,
        artist: t.artist ?? null,
        voteCount: 0,
        playCount: t.play_count ?? 0,
      },
    };
  } catch {
    return { ok: false };
  }
}
