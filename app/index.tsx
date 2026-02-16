import { useMemo, useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
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
  const [finalTrackId, setFinalTrackId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [lastClientRequestId, setLastClientRequestId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("대기 중");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => finalTrackId.trim().length > 0 && !isSubmitting, [finalTrackId, isSubmitting]);

  const runVote = async (clientRequestId: string) => {
    setIsSubmitting(true);
    setStatusText(`요청 중... (${clientRequestId})`);

    const response = await castVotesMax3({
      finalTrackId: finalTrackId.trim(),
      clientRequestId,
      accessToken: accessToken.trim() || undefined,
      deviceFingerprint: deviceFingerprint.trim() || null,
    });

    setIsSubmitting(false);

    if (response.ok) {
      const suffix = response.data.idempotentReplay ? " (재시도 재사용 성공)" : "";
      const message = `투표 완료: ${response.data.userVoteCount}/3${suffix}`;
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

  const handleVotePress = async () => {
    const requestId = generateUuidV4();
    setLastClientRequestId(requestId);
    await runVote(requestId);
  };

  const handleRetryPress = async () => {
    if (!lastClientRequestId) {
      Alert.alert("안내", "먼저 투표를 시도해 주세요.");
      return;
    }
    await runVote(lastClientRequestId);
  };

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>무명의 노래 - 투표 테스트</Text>
      <TextInput
        value={finalTrackId}
        onChangeText={setFinalTrackId}
        placeholder="finalTrackId (UUID)"
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 }}
      />
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
      <Button title={isSubmitting ? "투표 요청 중..." : "투표하기"} disabled={!canSubmit} onPress={handleVotePress} />
      <Button title="같은 요청 ID로 재시도" disabled={isSubmitting || !lastClientRequestId} onPress={handleRetryPress} />
      <Text>마지막 clientRequestId: {lastClientRequestId ?? "-"}</Text>
      <Text>상태: {statusText}</Text>
    </View>
  );
}
