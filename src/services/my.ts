import { supabase } from "../lib/supabase";

type MySummary = {
  storiesCount: number | null;
  songsCount: number | null;
  votesCount: number | null;
} | null;


async function safeCount(
  table: string,
  key: string,
  value: string
): Promise<number | null> {
  const { count, error } = await (supabase as any)
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(key, value);
  if (error) return null;
  return typeof count === "number" ? count : null;
}

export async function getMySummary(
  accessToken?: string
): Promise<MySummary> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const [storiesCount, songsCount, votesCount] = await Promise.all([
    safeCount("stories", "author_id", user.id),
    safeCount("songs", "artist_id", user.id),
    safeCount("votes", "voter_id", user.id),
  ]);

  return { storiesCount, songsCount, votesCount };
}

type MyEntitlement = {
  status: string;
  role?: string;
  isMusicianApproved?: boolean;
} | null;

/**
 * 현재 사용자 profile의 변경을 구독. is_musician_approved 등 갱신 시 콜백 호출.
 * PR-NEXT-05: 관리자 승인 즉시 반영용
 */
export function subscribeToProfileChanges(
  userId: string,
  onUpdate: (profile: { role?: string; is_musician_approved?: boolean }) => void
): () => void {
  const channel = supabase
    .channel(`profile-changes:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown> | null;
        if (row) {
          onUpdate({
            role: row.role as string,
            is_musician_approved: Boolean(row.is_musician_approved),
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getMyEntitlement(
  _accessToken?: string
): Promise<MyEntitlement> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,is_musician_approved,is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile as any)?.role ?? "viewer";
  const isMusicianApproved = Boolean((profile as any)?.is_musician_approved);
  const isAdmin = Boolean((profile as any)?.is_admin);

  return {
    status: isAdmin
      ? "admin"
      : isMusicianApproved
        ? "musician"
        : "user",
    role,
    isMusicianApproved,
  };
}
