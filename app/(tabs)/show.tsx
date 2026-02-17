// contracts: docs/contracts/api.md (active season rounds), docs/contracts/ux-flows.md (Show 시즌/라운드 플로우)
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Button, Pressable, ScrollView, Text, View } from "react-native";
import {
  getActiveSeasonRoundTracks,
  type RoundTrack,
  type ShowRoundType,
} from "../../features/show/api/queries";

type LoadState = "loading" | "empty" | "error" | "ready";

const ROUND_LABELS: Record<ShowRoundType, string> = {
  qualifier: "예선",
  semi: "본선",
  final: "결승",
};

export default function ShowTabScreen() {
  const router = useRouter();
  const [tracks, setTracks] = useState<RoundTrack[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [statusText, setStatusText] = useState("");

  const loadRounds = async () => {
    setLoadState("loading");
    setStatusText("");
    const response = await getActiveSeasonRoundTracks();
    if (!response.ok) {
      setLoadState("error");
      setStatusText(response.error.userMessage);
      return;
    }
    if (response.state === "empty") {
      setTracks([]);
      setLoadState("empty");
      return;
    }
    setTracks(response.data);
    setLoadState("ready");
  };

  useEffect(() => {
    void loadRounds();
  }, []);

  const grouped = useMemo(() => {
    const base: Record<ShowRoundType, RoundTrack[]> = {
      qualifier: [],
      semi: [],
      final: [],
    };
    for (const track of tracks) base[track.roundType].push(track);
    return base;
  }, [tracks]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>쇼</Text>
      <Button title="시즌 새로고침" onPress={() => void loadRounds()} />

      {loadState === "loading" ? <Text>불러오는 중…</Text> : null}
      {loadState === "empty" ? <Text>현재 진행 중인 라운드 트랙이 없어요</Text> : null}
      {loadState === "error" ? (
        <View style={{ gap: 8 }}>
          <Text>{statusText || "시즌 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."}</Text>
          <Button title="다시 시도" onPress={() => void loadRounds()} />
        </View>
      ) : null}

      {loadState === "ready"
        ? (Object.keys(ROUND_LABELS) as ShowRoundType[]).map((roundType) => (
            <View key={roundType} style={{ gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: "600" }}>{ROUND_LABELS[roundType]}</Text>
              {grouped[roundType].length === 0 ? (
                <Text>트랙이 없어요.</Text>
              ) : (
                grouped[roundType].map((track) => (
                  <Pressable
                    key={`${roundType}-${track.trackId}`}
                    onPress={() => router.push(`/show/${track.trackId}`)}
                    style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 10, padding: 12, gap: 4 }}
                  >
                    <Text style={{ fontWeight: "700" }}>{track.title}</Text>
                    <Text>{track.artist ?? "익명 뮤지션"}</Text>
                    <Text style={{ color: "#737373" }}>
                      {ROUND_LABELS[roundType]} · 순서 {track.displayOrder}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          ))
        : null}
    </ScrollView>
  );
}
