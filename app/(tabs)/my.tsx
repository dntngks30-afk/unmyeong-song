// contracts: docs/contracts/ux-flows.md (공통 상태머신, 제출 업로드 플로우), docs/contracts/api.md (entitlement)
import { useState } from "react";
import { useRouter } from "expo-router";
import { Button, Text, View } from "react-native";

type ScreenState = "loading" | "empty" | "error" | "ready";

function StateSkeleton({
  title,
  state,
}: {
  title: string;
  state: ScreenState;
}) {
  if (state === "loading") return <Text>{title} 정보를 불러오는 중...</Text>;
  if (state === "empty") return <Text>{title}에 표시할 정보가 없어요.</Text>;
  if (state === "error") return <Text>{title} 정보를 불러오지 못했어요.</Text>;
  return <Text>{title} 화면 준비 완료 (ready)</Text>;
}

export default function MyTabScreen() {
  const router = useRouter();
  const [state, setState] = useState<ScreenState>("loading");

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>마이 탭</Text>
      <Text>오디오 업로드 후 제출을 완료하세요.</Text>
      <Button title="노래 제출하기" onPress={() => router.push("/submission/new")} />
      <StateSkeleton title="마이" state={state} />
      <View style={{ gap: 8 }}>
        <Button title="loading" onPress={() => setState("loading")} />
        <Button title="empty" onPress={() => setState("empty")} />
        <Button title="error" onPress={() => setState("error")} />
        <Button title="ready" onPress={() => setState("ready")} />
      </View>
    </View>
  );
}
