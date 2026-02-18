/**
 * Admin pending list queries
 * SSOT: docs/contracts/api.md, docs/plan/execution-logs/pr-next-01-admin-ops.md
 */
import { supabase } from "../../../src/lib/supabase";

export type PendingStory = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author_display_name?: string | null;
  author_nickname?: string | null;
};

export type PendingMusician = {
  id: string;
  user_id: string;
  bio: string;
  artist_name: string | null;
  created_at: string;
  sample_song_audio_path?: string | null;
  sample_song_url?: string | null;
  email?: string | null;
  display_name?: string | null;
  nickname?: string | null;
};

export type ApprovedMusician = {
  id: string;
  display_name: string | null;
  nickname: string | null;
  updated_at: string;
};

export type PendingTrack = {
  id: string;
  song_id: string;
  status: string;
  created_at: string;
  title: string;
  artist_name: string | null;
};

type QueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function fetchPendingStories(): Promise<QueryResult<PendingStory[]>> {
  try {
    const { data, error } = await supabase
      .from("stories")
      .select("id,title,body,created_at,author_id")
      .eq("story_status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return { ok: false, error: error.message };
    }

    const authorIds = [...new Set((data ?? []).map((r: any) => r.author_id).filter(Boolean))];
    let authorMap: Record<string, { display_name: string | null; nickname: string | null }> = {};
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,display_name,nickname")
        .in("id", authorIds);
      authorMap = (profiles ?? []).reduce(
        (acc: any, p: any) => {
          acc[p.id] = { display_name: p.display_name ?? null, nickname: p.nickname ?? null };
          return acc;
        },
        {}
      );
    }

    const rows = (data ?? []).map((r: any) => {
      const author = authorMap[r.author_id];
      return {
        id: r.id,
        title: r.title ?? "",
        body: r.body ?? "",
        created_at: r.created_at ?? "",
        author_display_name: author?.display_name ?? null,
        author_nickname: author?.nickname ?? null,
      };
    });

    return { ok: true, data: rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function fetchPendingMusicians(): Promise<QueryResult<PendingMusician[]>> {
  try {
    const { data, error } = await supabase
      .from("musician_applications")
      .select("id,user_id,bio,artist_name,created_at,sample_song_audio_path,sample_song_url")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return { ok: false, error: error.message };
    }

    const userIds = [...new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))];
    let profileMap: Record<string, { display_name: string | null; nickname: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,display_name,nickname")
        .in("id", userIds);
      profileMap = (profiles ?? []).reduce(
        (acc: any, p: any) => {
          acc[p.id] = { display_name: p.display_name ?? null, nickname: p.nickname ?? null };
          return acc;
        },
        {}
      );
    }

    const rows = (data ?? []).map((r: any) => {
      const profile = profileMap[r.user_id];
      return {
        id: r.id,
        user_id: r.user_id,
        bio: r.bio ?? "",
        artist_name: r.artist_name ?? null,
        created_at: r.created_at ?? "",
        sample_song_audio_path: r.sample_song_audio_path ?? null,
        sample_song_url: r.sample_song_url ?? null,
        display_name: profile?.display_name ?? null,
        nickname: profile?.nickname ?? null,
        email: null,
      };
    });

    return { ok: true, data: rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function fetchApprovedMusicians(): Promise<QueryResult<ApprovedMusician[]>> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,display_name,nickname,updated_at")
      .eq("is_musician_approved", true)
      .neq("role", "admin")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      return { ok: false, error: error.message };
    }

    const rows = (data ?? []).map((r: any) => ({
      id: r.id,
      display_name: r.display_name ?? null,
      nickname: r.nickname ?? null,
      updated_at: r.updated_at ?? "",
    }));

    return { ok: true, data: rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function fetchPendingTracks(): Promise<QueryResult<PendingTrack[]>> {
  try {
    const { data, error } = await supabase
      .from("final_tracks")
      .select("id,song_id,status,created_at")
      .eq("status", "candidate")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return { ok: false, error: error.message };
    }

    const songIds = [...new Set((data ?? []).map((r: any) => r.song_id).filter(Boolean))];
    let songMap: Record<string, { title: string; artist_id: string }> = {};
    let artistMap: Record<string, string> = {};
    if (songIds.length > 0) {
      const { data: songs } = await supabase
        .from("songs")
        .select("id,title,artist_id")
        .in("id", songIds);
      songMap = (songs ?? []).reduce(
        (acc: any, s: any) => {
          acc[s.id] = { title: s.title ?? "", artist_id: s.artist_id ?? "" };
          return acc;
        },
        {}
      );
      const artistIds = [...new Set(Object.values(songMap).map((s) => s.artist_id).filter(Boolean))];
      if (artistIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,display_name,nickname")
          .in("id", artistIds);
        artistMap = (profiles ?? []).reduce(
          (acc: any, p: any) => {
            acc[p.id] = p.display_name ?? p.nickname ?? "익명 뮤지션";
            return acc;
          },
          {}
        );
      }
    }

    const rows = (data ?? []).map((r: any) => {
      const song = songMap[r.song_id];
      const artistName = song ? artistMap[song.artist_id] ?? "익명 뮤지션" : "익명 뮤지션";
      const title = song?.title ?? `트랙 ${r.id?.slice(0, 8) ?? ""}`;
      return {
        id: r.id,
        song_id: r.song_id,
        status: r.status ?? "candidate",
        created_at: r.created_at ?? "",
        title,
        artist_name: artistName,
      };
    });

    return { ok: true, data: rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
