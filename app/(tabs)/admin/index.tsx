/**
 * Admin approval operations screen
 * PR-NEXT-01: SSOT docs/plan/execution-logs/pr-next-01-admin-ops.md
 */
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { supabase } from "../../../src/lib/supabase";
import {
  fetchPendingStories,
  fetchPendingMusicians,
  fetchApprovedMusicians,
  fetchPendingTracks,
  type PendingStory,
  type PendingMusician,
  type ApprovedMusician,
  type PendingTrack,
} from "../../../features/admin/api/queries";
import {
  approveStory,
  rejectStory,
  approveMusicianApplication,
  rejectMusicianApplication,
  undoMusicianApproval,
  approveFinalTrack,
  rejectFinalTrack,
} from "../../../features/admin/api/mutations";
import { getApplicationSamplePlayUrl } from "../../../features/admin/api/samplePlay";
import { useAudioPlayer } from "../../../src/hooks/useAudioPlayer";

type Segment = "stories" | "musicians" | "tracks";

type ListState = "loading" | "ready" | "empty" | "error";

const FORBIDDEN_MSG = "관리자 권한이 없어요. 이 화면에 접근할 수 없습니다.";

function formatDate(iso: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function authorLabel(s: PendingStory): string {
  return s.author_display_name ?? s.author_nickname ?? "익명";
}

function musicianLabel(m: PendingMusician): string {
  return m.artist_name ?? m.display_name ?? m.nickname ?? "익명";
}

export default function AdminScreen() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [forbiddenMsg, setForbiddenMsg] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment>("stories");
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);

  const [stories, setStories] = useState<PendingStory[]>([]);
  const [musicians, setMusicians] = useState<PendingMusician[]>([]);
  const [approvedMusicians, setApprovedMusicians] = useState<ApprovedMusician[]>([]);
  const [tracks, setTracks] = useState<PendingTrack[]>([]);

  const [storiesState, setStoriesState] = useState<ListState>("loading");
  const [musiciansState, setMusiciansState] = useState<ListState>("loading");
  const [tracksState, setTracksState] = useState<ListState>("loading");

  const [acting, setActing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [samplePlayError, setSamplePlayError] = useState<string | null>(null);

  const { playFromUrl, stopAndUnload, trackId, isPlaying, error: playerError } = useAudioPlayer(accessToken);

  const checkAdmin = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const userId = data.session?.user?.id;
    setAccessToken(token);

    if (!userId || !token) {
      setIsAdmin(false);
      setForbiddenMsg("로그인이 필요해요.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();

    const admin = Boolean((profile as { is_admin?: boolean })?.is_admin);
    setIsAdmin(admin);
    if (!admin) {
      setForbiddenMsg(FORBIDDEN_MSG);
    }
  }, []);

  const loadStories = useCallback(async () => {
    setStoriesState("loading");
    const result = await fetchPendingStories();
    if (result.ok) {
      setStories(result.data);
      setStoriesState(result.data.length > 0 ? "ready" : "empty");
    } else {
      setStoriesState("error");
      setStories([]);
    }
  }, []);

  const loadMusicians = useCallback(async () => {
    setMusiciansState("loading");
    const [pendingRes, approvedRes] = await Promise.all([
      fetchPendingMusicians(),
      fetchApprovedMusicians(),
    ]);
    if (pendingRes.ok) {
      setMusicians(pendingRes.data);
      setMusiciansState(pendingRes.data.length > 0 ? "ready" : "empty");
    } else {
      setMusiciansState("error");
      setMusicians([]);
    }
    if (approvedRes.ok) {
      setApprovedMusicians(approvedRes.data);
    } else {
      setApprovedMusicians([]);
    }
  }, []);

  const loadTracks = useCallback(async () => {
    setTracksState("loading");
    const result = await fetchPendingTracks();
    if (result.ok) {
      setTracks(result.data);
      setTracksState(result.data.length > 0 ? "ready" : "empty");
    } else {
      setTracksState("error");
      setTracks([]);
    }
  }, []);

  useEffect(() => {
    void checkAdmin();
  }, [checkAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadStories();
    void loadMusicians();
    void loadTracks();
  }, [isAdmin, loadStories, loadMusicians, loadTracks]);

  const handleApproveStory = async (id: string) => {
    setActing(id);
    setActionError(null);
    const result = await approveStory(accessToken, id);
    setActing(null);
    if (result.ok) {
      setStories((prev) => prev.filter((s) => s.id !== id));
      if (stories.length <= 1) setStoriesState("empty");
    } else {
      setActionError(result.userMessage);
    }
  };

  const handleRejectStory = async (id: string) => {
    setActing(id);
    setActionError(null);
    const result = await rejectStory(accessToken, id);
    setActing(null);
    if (result.ok) {
      setStories((prev) => prev.filter((s) => s.id !== id));
      if (stories.length <= 1) setStoriesState("empty");
    } else {
      setActionError(result.userMessage);
    }
  };

  const handleApproveMusician = async (id: string) => {
    setActing(id);
    setActionError(null);
    const result = await approveMusicianApplication(accessToken, id);
    setActing(null);
    if (result.ok) {
      setMusicians((prev) => prev.filter((m) => m.id !== id));
      if (musicians.length <= 1) setMusiciansState("empty");
      void loadMusicians();
    } else {
      setActionError(result.userMessage);
    }
  };

  const handleRejectMusician = async (id: string) => {
    setActing(id);
    setActionError(null);
    const result = await rejectMusicianApplication(accessToken, id);
    setActing(null);
    if (result.ok) {
      setMusicians((prev) => prev.filter((m) => m.id !== id));
      if (musicians.length <= 1) setMusiciansState("empty");
    } else {
      setActionError(result.userMessage);
    }
  };

  const handleUndoMusician = async (userId: string) => {
    setActing(userId);
    setActionError(null);
    const result = await undoMusicianApproval(accessToken, userId);
    setActing(null);
    if (result.ok) {
      setApprovedMusicians((prev) => prev.filter((m) => m.id !== userId));
      void loadMusicians();
    } else {
      setActionError(result.userMessage);
    }
  };

  const handleApproveTrack = async (id: string) => {
    setActing(id);
    setActionError(null);
    const result = await approveFinalTrack(accessToken, id);
    setActing(null);
    if (result.ok) {
      setTracks((prev) => prev.filter((t) => t.id !== id));
      if (tracks.length <= 1) setTracksState("empty");
    } else {
      setActionError(result.userMessage);
    }
  };

  const handleRejectTrack = async (id: string) => {
    setActing(id);
    setActionError(null);
    const result = await rejectFinalTrack(accessToken, id);
    setActing(null);
    if (result.ok) {
      setTracks((prev) => prev.filter((t) => t.id !== id));
      if (tracks.length <= 1) setTracksState("empty");
    } else {
      setActionError(result.userMessage);
    }
  };

  if (isAdmin === null) {
    return (
      <Screen title="관리자" onBackPress={() => router.back()}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#60a5fa" />
        </View>
      </Screen>
    );
  }

  if (!isAdmin) {
    return (
      <Screen title="관리자" onBackPress={() => router.replace("/(tabs)/home")}>
        <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
          <Text style={{ color: "#f87171", fontSize: 15, textAlign: "center" }}>
            {forbiddenMsg ?? FORBIDDEN_MSG}
          </Text>
          <Pressable
            onPress={() => router.replace("/(tabs)/home")}
            style={{
              marginTop: 20,
              paddingVertical: 12,
              backgroundColor: "#374151",
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>마이로 돌아가기</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const segs: { key: Segment; label: string }[] = [
    { key: "stories", label: "사연" },
    { key: "musicians", label: "뮤지션" },
    { key: "tracks", label: "트랙" },
  ];

  return (
    <Screen title="승인 관리" onBackPress={() => router.back()}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {segs.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSegment(s.key)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: segment === s.key ? "#4338ca" : "#374151",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "500" }}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {(actionError || samplePlayError || playerError) ? (
        <Card style={{ backgroundColor: "rgba(220,38,38,0.1)", marginBottom: 12 }}>
          <Text style={{ color: "#dc2626", fontSize: 13 }}>
            {actionError ?? samplePlayError ?? playerError}
          </Text>
        </Card>
      ) : null}

      {segment === "stories" && (
        <>
          {storiesState === "loading" && (
            <Card>
              <ActivityIndicator color="#60a5fa" />
              <Text style={{ color: "#94a3b8", marginTop: 8, textAlign: "center" }}>
                사연 목록 불러오는 중...
              </Text>
            </Card>
          )}
          {storiesState === "empty" && (
            <Card>
              <Text style={{ color: "#94a3b8" }}>대기 중인 사연이 없어요.</Text>
            </Card>
          )}
          {storiesState === "error" && (
            <Card style={{ backgroundColor: "rgba(220,38,38,0.08)" }}>
              <Text style={{ color: "#dc2626" }}>목록을 불러오지 못했어요.</Text>
            </Card>
          )}
          {storiesState === "ready" &&
            stories.map((s) => (
              <Card key={s.id} style={{ marginBottom: 12 }}>
                <Text style={{ fontWeight: "600", fontSize: 15 }}>{s.title}</Text>
                <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                  {authorLabel(s)} · {formatDate(s.created_at)}
                </Text>
                <Text style={{ color: "#64748b", fontSize: 12, marginTop: 6 }} numberOfLines={2}>
                  {s.body}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <Pressable
                    onPress={() => void handleApproveStory(s.id)}
                    disabled={acting === s.id}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 6,
                      backgroundColor: "#22c55e",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 13 }}>
                      {acting === s.id ? "처리 중..." : "승인"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleRejectStory(s.id)}
                    disabled={acting === s.id}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 6,
                      backgroundColor: "#dc2626",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 13 }}>거절</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
        </>
      )}

      {segment === "musicians" && (
        <>
          {musiciansState === "loading" && (
            <Card>
              <ActivityIndicator color="#60a5fa" />
              <Text style={{ color: "#94a3b8", marginTop: 8, textAlign: "center" }}>
                뮤지션 목록 불러오는 중...
              </Text>
            </Card>
          )}
          {musiciansState === "empty" && musicians.length === 0 && approvedMusicians.length === 0 && (
            <Card>
              <Text style={{ color: "#94a3b8" }}>승인 대기/승인된 뮤지션이 없어요.</Text>
            </Card>
          )}
          {musiciansState === "error" && (
            <Card style={{ backgroundColor: "rgba(220,38,38,0.08)" }}>
              <Text style={{ color: "#dc2626" }}>목록을 불러오지 못했어요.</Text>
            </Card>
          )}

          <Text style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>승인 대기</Text>
          {musiciansState === "ready" && musicians.length === 0 && (
            <Card style={{ marginBottom: 12 }}>
              <Text style={{ color: "#94a3b8" }}>승인 대기 뮤지션이 없어요.</Text>
            </Card>
          )}
          {musiciansState === "ready" &&
            musicians.map((m) => {
              const hasPath = Boolean(m.sample_song_audio_path?.trim());
              const hasUrl = Boolean(m.sample_song_url?.trim());
              const hasSample = hasPath || hasUrl;
              const isThisPlaying = trackId === `sample:${m.id}`;
              return (
                <Card key={m.id} style={{ marginBottom: 12 }}>
                  <Text style={{ fontWeight: "600", fontSize: 15 }}>{musicianLabel(m)}</Text>
                  <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                    {formatDate(m.created_at)}
                  </Text>
                  <Text style={{ color: "#64748b", fontSize: 12, marginTop: 6 }} numberOfLines={2}>
                    {m.bio}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {hasSample ? (
                      <Pressable
                        onPress={async () => {
                          if (isThisPlaying) {
                            await stopAndUnload();
                            return;
                          }
                          setSamplePlayError(null);
                          if (hasPath && accessToken) {
                            const res = await getApplicationSamplePlayUrl(m.id, accessToken);
                            if (!res.ok) {
                              setSamplePlayError(res.error.userMessage);
                              return;
                            }
                            void playFromUrl(res.signedUrl, `sample:${m.id}`);
                          } else if (hasUrl) {
                            void playFromUrl(m.sample_song_url!, `sample:${m.id}`);
                          }
                        }}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 6,
                          backgroundColor: isThisPlaying ? "#64748b" : "#3b82f6",
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 13 }}>
                          {isThisPlaying ? "정지" : "샘플 재생"}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={{ color: "#94a3b8", fontSize: 12 }}>샘플곡이 없습니다.</Text>
                    )}
                    <Pressable
                      onPress={() => void handleApproveMusician(m.id)}
                      disabled={acting === m.id}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 6,
                        backgroundColor: "#22c55e",
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 13 }}>
                        {acting === m.id ? "처리 중..." : "승인"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void handleRejectMusician(m.id)}
                      disabled={acting === m.id}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 6,
                        backgroundColor: "#dc2626",
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 13 }}>거절</Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })}

          <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 20, marginBottom: 8 }}>
            승인됨 (되돌리기)
          </Text>
          {approvedMusicians.length === 0 ? (
            <Card>
              <Text style={{ color: "#94a3b8" }}>승인된 뮤지션이 없어요.</Text>
            </Card>
          ) : (
            approvedMusicians.map((m) => (
              <Card key={m.id} style={{ marginBottom: 12 }}>
                <Text style={{ fontWeight: "600", fontSize: 15 }}>
                  {m.display_name ?? m.nickname ?? m.id.slice(0, 8)}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <Pressable
                    onPress={() => void handleUndoMusician(m.id)}
                    disabled={acting === m.id}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 6,
                      backgroundColor: "#f59e0b",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 13 }}>
                      {acting === m.id ? "처리 중..." : "되돌리기"}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            ))
          )}
        </>
      )}

      {segment === "tracks" && (
        <>
          {tracksState === "loading" && (
            <Card>
              <ActivityIndicator color="#60a5fa" />
              <Text style={{ color: "#94a3b8", marginTop: 8, textAlign: "center" }}>
                트랙 목록 불러오는 중...
              </Text>
            </Card>
          )}
          {tracksState === "empty" && (
            <Card>
              <Text style={{ color: "#94a3b8" }}>대기 중인 트랙이 없어요.</Text>
            </Card>
          )}
          {tracksState === "error" && (
            <Card style={{ backgroundColor: "rgba(220,38,38,0.08)" }}>
              <Text style={{ color: "#dc2626" }}>목록을 불러오지 못했어요.</Text>
            </Card>
          )}
          {tracksState === "ready" &&
            tracks.map((t) => (
              <Card key={t.id} style={{ marginBottom: 12 }}>
                <Text style={{ fontWeight: "600", fontSize: 15 }}>{t.title}</Text>
                <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                  {t.artist_name ?? "익명 뮤지션"} · {formatDate(t.created_at)}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <Pressable
                    onPress={() => void handleApproveTrack(t.id)}
                    disabled={acting === t.id}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 6,
                      backgroundColor: "#22c55e",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 13 }}>
                      {acting === t.id ? "처리 중..." : "승인"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleRejectTrack(t.id)}
                    disabled={acting === t.id}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 6,
                      backgroundColor: "#dc2626",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 13 }}>거절</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
        </>
      )}
    </Screen>
  );
}
