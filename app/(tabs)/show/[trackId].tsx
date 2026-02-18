import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Card } from "../../../src/components/ui/Card";
import { PrimaryButton } from "../../../src/components/ui/PrimaryButton";
import { Screen } from "../../../src/components/ui/Screen";
import { getTrackById, formatCheerDisplay, formatPlayCountDisplay } from "../../../src/services/show";
import { voteTrack } from "../../../src/services/votes";
import { supabase } from "../../../src/lib/supabase";
import { useAudioPlayer, formatTimeMs } from "../../../src/hooks/useAudioPlayer";

const DUMMY: Record<string, { title: string; artist: string }> = {
  "1": { title: "곡 제목 A", artist: "아티스트" },
  "2": { title: "곡 제목 B", artist: "뮤지션" },
  "3": { title: "곡 제목 C", artist: "음악가" },
  "4": { title: "곡 제목 D", artist: "아티스트" },
  "5": { title: "곡 제목 E", artist: "뮤지션" },
  "6": { title: "곡 제목 F", artist: "음악가" },
  "7": { title: "곡 제목 G", artist: "아티스트" },
  "8": { title: "곡 제목 H", artist: "뮤지션" },
  "9": { title: "곡 제목 I", artist: "음악가" },
  "10": { title: "곡 제목 J", artist: "아티스트" },
};

export default function ShowDetailScreen() {
  const router = useRouter();
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const [voteCount, setVoteCount] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [remainingVotes, setRemainingVotes] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [hasVotedThisTrack, setHasVotedThisTrack] = useState(false);
  const [voteLimitReached, setVoteLimitReached] = useState(false);
  const [voteMessage, setVoteMessage] = useState<string | null>(null);
  const [data, setData] = useState({
    title: trackId && DUMMY[trackId] ? DUMMY[trackId].title : "곡 정보",
    artist: trackId && DUMMY[trackId] ? DUMMY[trackId].artist : "-",
  });
  const { trackId: playingTrackId, errorTrackId, isPlaying, positionMs, durationMs, isLoading, error, toggle } =
    useAudioPlayer(accessToken);

  useEffect(() => {
    setHasVotedThisTrack(false);
    setVoteMessage(null);
  }, [trackId]);

  useEffect(() => {
    if (!trackId) return;
    let alive = true;
    const fn = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (alive) setAccessToken(session.session?.access_token);
      const result = await getTrackById(trackId, session.session?.access_token);
      if (!alive) return;
      if (result.ok) {
        setData({ title: result.data.title, artist: result.data.artist ?? "-" });
        setVoteCount(result.data.voteCount);
        setPlayCount(result.data.playCount);
      }
    };
    void fn();
    return () => {
      alive = false;
    };
  }, [trackId]);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_e, session) => setAccessToken(session?.access_token));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  const handleCheer = useCallback(async () => {
    if (!trackId || isVoting) return;
    if (hasVotedThisTrack) {
      setVoteMessage("이미 응원했어요");
      return;
    }
    if (voteLimitReached) return;

    setIsVoting(true);
    setVoteMessage(null);

    const result = await voteTrack(trackId, accessToken);
    setIsVoting(false);

    if (result.ok) {
      setVoteCount((c) => c + 1);
      setHasVotedThisTrack(true);
      setRemainingVotes(result.remaining);
      setVoteMessage("응원 완료");
      if (result.remaining <= 0) setVoteLimitReached(true);
      return;
    }

    if (result.code === "DUPLICATE_VOTE") {
      setHasVotedThisTrack(true);
      setVoteMessage("이미 응원했어요");
      return;
    }
    if (result.code === "VOTE_LIMIT_EXCEEDED") {
      setVoteLimitReached(true);
      setVoteMessage("오늘 응원권을 모두 사용했어요");
      return;
    }
    setVoteMessage(result.message ?? "잠시 후 다시 시도해 주세요.");
  }, [trackId, accessToken, isVoting, hasVotedThisTrack, voteLimitReached]);

  return (
    <Screen title="결선 쇼" subcopy="이번 주 결선곡" onBackPress={() => router.back()}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* 1) 커버/정보 카드 */}
        <Card style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
          <View
            style={{
              height: 180,
              backgroundColor: "#374151",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
          />
          <View style={{ padding: 18 }}>
            <Text style={{ fontWeight: "700", fontSize: 18 }}>{data.title}</Text>
            <Text style={{ color: "#666", fontSize: 14, marginTop: 4 }}>{data.artist}</Text>
            <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>
              {formatCheerDisplay(voteCount)} · {formatPlayCountDisplay(playCount)}
            </Text>
          </View>
        </Card>

        {/* 2) 미니 플레이어 카드 */}
        {trackId && (
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Pressable
                onPress={() => toggle(trackId)}
                disabled={isLoading}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: playingTrackId === trackId && isPlaying ? "#4338ca" : "#e0e7ff",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: playingTrackId === trackId && isPlaying ? "#fff" : "#4338ca" }}>
                  {isLoading && playingTrackId === trackId ? "..." : isPlaying && playingTrackId === trackId ? "⏸" : "▶"}
                </Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    height: 6,
                    backgroundColor: "#e5e7eb",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      width: `${durationMs > 0 ? (positionMs / durationMs) * 100 : 0}%`,
                      backgroundColor: "#4338ca",
                      borderRadius: 3,
                    }}
                  />
                </View>
                <Text style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>
                  {formatTimeMs(positionMs)} / {formatTimeMs(durationMs)}
                </Text>
              </View>
            </View>
            {error && errorTrackId === trackId ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                <Text style={{ color: "#dc2626", fontSize: 12, flex: 1 }}>{error}</Text>
                <Pressable onPress={() => toggle(trackId)}>
                  <Text style={{ color: "#60a5fa", fontSize: 12 }}>다시 시도</Text>
                </Pressable>
              </View>
            ) : null}
          </Card>
        )}

        {/* 3) 사연 한 줄 카드 */}
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>사연 한 줄</Text>
          <Text style={{ color: "#374151", fontSize: 14, lineHeight: 20 }}>
            이 곡의 영감이 된 사연의 요약 텍스트입니다. 더미 문장 두 줄 정도로 표시됩니다.
          </Text>
        </Card>

        {/* 4) 메이킹 노트 카드 */}
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>메이킹 노트</Text>
          <Text style={{ color: "#374151", fontSize: 13, lineHeight: 22 }}>• 감정을 담아 첫 구절을 썼어요.</Text>
          <Text style={{ color: "#374151", fontSize: 13, lineHeight: 22, marginTop: 4 }}>• 후렴에서 메시지를 강조했어요.</Text>
          <Text style={{ color: "#374151", fontSize: 13, lineHeight: 22, marginTop: 4 }}>• 마지막에 희망을 담았어요.</Text>
        </Card>
      </ScrollView>

      <View style={{ paddingHorizontal: 20 }}>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, textAlign: "center", marginBottom: 8 }}>
          남은 응원: {remainingVotes !== null ? `${remainingVotes}/3` : "—"} · 마감: 01:22:45
        </Text>
        {voteMessage ? (
          <Text style={{ color: hasVotedThisTrack ? "#22c55e" : voteLimitReached ? "#94a3b8" : "#f87171", fontSize: 13, textAlign: "center", marginBottom: 8 }}>
            {voteMessage}
          </Text>
        ) : null}
        <PrimaryButton
          label={isVoting ? "응원 중..." : hasVotedThisTrack ? "응원함" : "응원하기(오늘 3표)"}
          onPress={handleCheer}
          disabled={isVoting || hasVotedThisTrack || voteLimitReached}
        />
      </View>
    </Screen>
  );
}
