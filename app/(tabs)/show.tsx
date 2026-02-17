// contracts: docs/contracts/api.md (Top10/투표/재생URL), docs/contracts/ux-flows.md (결선 쇼 재생/투표 플로우)
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, ScrollView, Text, TextInput, View } from "react-native";
import Top10List, { type Top10Track as ListTrack } from "../../features/show/ui/Top10List";
import { getTrackPlayUrl } from "../../features/show/api/mutations";
import { getTop10Tracks } from "../../src/lib/rpc/tracks";
import { castVotesMax3 } from "../../src/lib/rpc/votes";

type LoadState = "loading" | "empty" | "error" | "ready";

function generateUuidV4(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function ShowTabScreen() {
  const [tracks, setTracks] = useState<ListTrack[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [statusText, setStatusText] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [userVoteCount, setUserVoteCount] = useState<number | null>(null);
  const [votedTrackIds, setVotedTrackIds] = useState<Set<string>>(new Set());
  const [votingTrackIds, setVotingTrackIds] = useState<Set<string>>(new Set());

  const loadTop10 = useCallback(async () => {
    setLoadState("loading");
    const response = await getTop10Tracks(accessToken.trim() || undefined);
    if (!response.ok) {
      setLoadState("error");
      setStatusText(`${response.error.userMessage} (${response.error.code})`);
      return;
    }

    const mapped: ListTrack[] = response.data.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist ?? null,
    }));

    if (mapped.length === 0) {
      setTracks([]);
      setLoadState("empty");
      return;
    }

    setTracks(mapped);
    setLoadState("ready");
  }, [accessToken]);

  useEffect(() => {
    void loadTop10();
  }, [loadTop10]);

  const isVoting = useCallback((trackId: string) => votingTrackIds.has(trackId), [votingTrackIds]);

  const getPlayUrl = useCallback(
    async (finalTrackId: string) => {
      const response = await getTrackPlayUrl({
        finalTrackId,
        accessToken: accessToken.trim() || undefined,
      });

      if (!response.ok) {
        if (response.error.correlationId) {
          console.log("[show][getPlayUrl] correlationId=", response.error.correlationId);
        }
        throw new Error(response.error.code);
      }

      if (response.data.correlationId) {
        console.log("[show][getPlayUrl] correlationId=", response.data.correlationId);
      }
      return response.data;
    },
    [accessToken],
  );

  const onVote = useCallback(
    async (finalTrackId: string) => {
      if (votingTrackIds.has(finalTrackId)) return;
      setVotingTrackIds((prev) => {
        const next = new Set(prev);
        next.add(finalTrackId);
        return next;
      });

      try {
        const response = await castVotesMax3({
          finalTrackId,
          clientRequestId: generateUuidV4(),
          deviceFingerprint: deviceFingerprint.trim() || undefined,
          accessToken: accessToken.trim() || undefined,
        });

        if (!response.ok) {
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
          if (response.error.code === "AUTH_REQUIRED") {
            setStatusText("로그인이 필요해요");
            Alert.alert("안내", "로그인이 필요해요");
            return;
          }
          setStatusText("잠시 후 다시 시도해 주세요");
          Alert.alert("오류", "잠시 후 다시 시도해 주세요");
          return;
        }

        setVotedTrackIds((prev) => {
          const next = new Set(prev);
          next.add(finalTrackId);
          return next;
        });
        setUserVoteCount(response.data.userVoteCount);
        setStatusText("투표가 반영되었어요");
      } finally {
        setVotingTrackIds((prev) => {
          const next = new Set(prev);
          next.delete(finalTrackId);
          return next;
        });
      }
    },
    [accessToken, deviceFingerprint, votingTrackIds],
  );

  const votedMemo = useMemo(() => votedTrackIds, [votedTrackIds]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>쇼</Text>
      <TextInput
        placeholder="accessToken (선택)"
        value={accessToken}
        onChangeText={setAccessToken}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 10 }}
      />
      <TextInput
        placeholder="deviceFingerprint (선택)"
        value={deviceFingerprint}
        onChangeText={setDeviceFingerprint}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 10 }}
      />
      <Button title="Top10 새로고침" onPress={() => void loadTop10()} />

      {loadState === "loading" ? <Text>불러오는 중…</Text> : null}
      {loadState === "empty" ? <Text>현재 투표 가능한 트랙이 없어요</Text> : null}
      {loadState === "error" ? <Text>잠시 후 다시 시도해 주세요</Text> : null}
      {userVoteCount !== null ? <Text>내 투표 수: {userVoteCount}</Text> : null}
      {statusText ? <Text>{statusText}</Text> : null}

      {loadState === "ready" ? (
        <Top10List
          tracks={tracks}
          getPlayUrl={getPlayUrl}
          onVote={onVote}
          votedTrackIds={votedMemo}
          isVoting={isVoting}
        />
      ) : null}
    </ScrollView>
  );
}
