import { useEffect, useMemo, useState } from "react";
import { Alert, Button, ScrollView, Text, TextInput, View } from "react-native";
import { getTop10Tracks, type Top10Track } from "../src/lib/rpc/tracks";
import { castVotesMax3 } from "../src/lib/rpc/votes";

function generateUuidV4(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  // Fallback for runtime where randomUUID is unavailable.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function Home() {
  const [tracks, setTracks] = useState<Top10Track[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [votedTrackIds, setVotedTrackIds] = useState<string[]>([]);
  const [accessToken, setAccessToken] = useState("");
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [lastClientRequestId, setLastClientRequestId] = useState<string | null>(null);
  const [lastRequestedTrackId, setLastRequestedTrackId] = useState<string | null>(null);
  const [userVoteCount, setUserVoteCount] = useState<number | null>(null);
  const [statusText, setStatusText] = useState("대기 중");
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasLoadedTracks, setHasLoadedTracks] = useState(false);

  const selectedTrack = useMemo(
    () => tracks.find((track) => track.id === selectedTrackId) ?? null,
    [tracks, selectedTrackId],
  );
  const canRetry = useMemo(
    () => Boolean(lastClientRequestId && selectedTrackId === lastRequestedTrackId && !isSubmitting),
    [lastClientRequestId, lastRequestedTrackId, selectedTrackId, isSubmitting],
  );

  const loadTop10 = async (forceRefresh = false) => {
    if (hasLoadedTracks && !forceRefresh) return;

    setIsLoadingTracks(true);
    const response = await getTop10Tracks(accessToken.trim() || undefined);
    setIsLoadingTracks(false);
    setHasLoadedTracks(true);

    if (!response.ok) {
      setStatusText("잠시 후 다시 시도해 주세요");
      return;
    }

    setTracks(response.data);
    if (response.data.length === 0) {
      setStatusText("현재 투표 가능한 트랙이 없어요");
      setSelectedTrackId(null);
      return;
    }

    setSelectedTrackId((prev) => prev ?? response.data[0].id);
    setStatusText(`Top10 ${response.data.length}곡 불러오기 완료`);
  };

  useEffect(() => {
    void loadTop10(false);
    // mount-time 1회 로딩
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runVote = async (trackId: string, clientRequestId: string) => {
    setIsSubmitting(true);
    setStatusText(`요청 중... (${clientRequestId})`);

    const response = await castVotesMax3({
      finalTrackId: trackId,
      clientRequestId,
      accessToken: accessToken.trim() || undefined,
      deviceFingerprint: deviceFingerprint.trim() || null,
    });

    setIsSubmitting(false);

    if (response.ok) {
      const suffix = response.data.idempotentReplay ? " (재시도 재사용 성공)" : "";
      const message = `투표 완료: ${response.data.userVoteCount}/3${suffix}`;
      setUserVoteCount(response.data.userVoteCount);
      setVotedTrackIds((prev) =>
        prev.includes(response.data.votedTrackId) ? prev : [...prev, response.data.votedTrackId],
      );
      setStatusText(message);
      Alert.alert("투표 결과", message);
      return;
    }

    if (response.error.code === "DUPLICATE_VOTE") {
      setStatusText("이미 이 트랙에 투표했어요");
      Alert.alert("투표 결과", "이미 이 트랙에 투표했어요");
      return;
    }

    if (response.error.code === "VOTE_LIMIT_EXCEEDED") {
      setStatusText("투표는 최대 3표까지 가능해요");
      Alert.alert("투표 결과", "투표는 최대 3표까지 가능해요");
      return;
    }

    setStatusText("잠시 후 다시 시도해 주세요");
    Alert.alert("오류", "잠시 후 다시 시도해 주세요");
  };

  const handleVotePress = async (trackId: string) => {
    setSelectedTrackId(trackId);
    const requestId = generateUuidV4();
    setLastClientRequestId(requestId);
    setLastRequestedTrackId(trackId);
    await runVote(trackId, requestId);
  };

  const handleRetryPress = async () => {
    if (!lastClientRequestId || !selectedTrackId || selectedTrackId !== lastRequestedTrackId) {
      Alert.alert("안내", "같은 트랙을 선택한 뒤 먼저 투표를 시도해 주세요.");
      return;
    }
    await runVote(selectedTrackId, lastClientRequestId);
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>무명의 노래 - Top10 투표</Text>
      <TextInput
        value={accessToken}
        onChangeText={setAccessToken}
        placeholder="accessToken (선택: 로그인 JWT)"
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 }}
      />
      <TextInput
        value={deviceFingerprint}
        onChangeText={setDeviceFingerprint}
        placeholder="deviceFingerprint (선택)"
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 }}
      />
      <Button
        title={isLoadingTracks ? "불러오는 중…" : "Top10 다시 불러오기"}
        disabled={isLoadingTracks}
        onPress={() => {
          void loadTop10(true);
        }}
      />

      {isLoadingTracks ? (
        <Text>불러오는 중…</Text>
      ) : tracks.length === 0 ? (
        <Text>현재 투표 가능한 트랙이 없어요</Text>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {tracks.map((track, index) => {
            const isSelected = selectedTrackId === track.id;
            const isVoted = votedTrackIds.includes(track.id);
            const labelPrefix = track.rank ? `${track.rank}. ` : `${index + 1}. `;
            const artistText = track.artist ? ` - ${track.artist}` : "";

            return (
              <View
                key={track.id}
                style={{
                  borderWidth: 1,
                  borderColor: isSelected ? "#666" : "#ddd",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <Text>{`${labelPrefix}${track.title}${artistText}`}</Text>
                <Button
                  title={isSubmitting && isSelected ? "투표 요청 중..." : "이 트랙에 투표"}
                  disabled={isSubmitting}
                  onPress={() => {
                    void handleVotePress(track.id);
                  }}
                />
                {isVoted ? <Text>투표됨</Text> : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Button title="같은 요청 ID로 재시도" disabled={!canRetry} onPress={() => void handleRetryPress()} />
      <Text>마지막 clientRequestId: {lastClientRequestId ?? "-"}</Text>
      <Text>선택된 트랙: {selectedTrack?.title ?? "-"}</Text>
      <Text>현재 투표 수: {userVoteCount ?? "-"}</Text>
      <Text>상태: {statusText}</Text>
    </View>
  );
}
