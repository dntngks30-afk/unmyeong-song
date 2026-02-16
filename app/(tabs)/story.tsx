// contracts: docs/contracts/ux-flows.md (사연 작성 플로우, 공통 상태머신)
import { useState } from "react";
import { Button, Text, View } from "react-native";

type ScreenState = "loading" | "empty" | "error" | "ready";

function StateSkeleton({
  title,
  state,
}: {
  title: string;
  state: ScreenState;
}) {
  if (state === "loading") return <Text>{title} 목록을 불러오는 중...</Text>;
  if (state === "empty") return <Text>아직 사연이 없어요.</Text>;
  if (state === "error") return <Text>{title} 데이터를 불러오지 못했어요.</Text>;
  return <Text>{title} 화면 준비 완료 (ready)</Text>;
}

export default function StoryTabScreen() {
  const [state, setState] = useState<ScreenState>("loading");

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>사연 탭</Text>
      <StateSkeleton title="사연" state={state} />
      <View style={{ gap: 8 }}>
        <Button title="loading" onPress={() => setState("loading")} />
        <Button title="empty" onPress={() => setState("empty")} />
        <Button title="error" onPress={() => setState("error")} />
        <Button title="ready" onPress={() => setState("ready")} />
      </View>
    </View>
  );
}
