import { supabase } from "../lib/supabase";

export type MySummary = {
  storiesCount: number | null;
  songsCount: number | null;
  votesCount: number | null;
};

export type MyEntitlement = {
  status: string;
} | null;

export async function getMySummary(accessToken?: string): Promise<MySummary | null> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = accessToken ?? session.session?.access_token;
    const userId = session.session?.user?.id;
    if (!userId || !token) return null;

    const out: MySummary = { storiesCount: null, songsCount: null, votesCount: null };

    const [storiesRes, songsRes, votesRes] = await Promise.all([
      supabase.from("stories").select("id", { count: "exact", head: true }).eq("author_id", userId),
      supabase.from("songs").select("id", { count: "exact", head: true }).eq("artist_id", userId),
      supabase.from("votes").select("id", { count: "exact", head: true }).eq("voter_id", userId),
    ]);

    if (!storiesRes.error && typeof storiesRes.count === "number") out.storiesCount = storiesRes.count;
    if (!songsRes.error && typeof songsRes.count === "number") out.songsCount = songsRes.count;
    if (!votesRes.error && typeof votesRes.count === "number") out.votesCount = votesRes.count;

    return out;
  } catch {
    return null;
  }
}

export async function getMyEntitlement(accessToken?: string): Promise<MyEntitlement> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = accessToken ?? session.session?.access_token;
    const userId = session.session?.user?.id;
    if (!userId || !token) return null;

    const { data, error } = await supabase
      .from("entitlements")
      .select("status")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const status = typeof data.status === "string" ? data.status : "inactive";
    return { status };
  } catch {
    return null;
  }
}
