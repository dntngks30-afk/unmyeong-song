// contracts: docs/contracts/ux-flows.md (결선 쇼 재생/투표 플로우, 공통 상태머신)
import { useState } from "react";
import { Button, Text, View } from "react-native";

type ScreenState = "loading" | "empty" | "error" | "ready";

function StateSkeleton({ state }: { state: ScreenState }) {
  if (state === "loading") return <Text>Top10 목록을 불러오는 중...</Text>;
  if (state === "empty") return <Text>현재 투표 가능한 트랙이 없어요.</Text>;
  if (state === "error") return <Text>쇼 데이터를 불러오지 못했어요.</Text>;
  return <Text>쇼 화면 준비 완료 (ready)</Text>;
}

export default function ShowTabScreen() {
  const [state, setState] = useState<ScreenState>("loading");

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>쇼 탭</Text>
      <Text>Top10 + 투표 UI 이동 예정 (현재 app/index.tsx 임시 UI 유지)</Text>
      <StateSkeleton state={state} />
      <View style={{ gap: 8 }}>
        <Button title="loading" onPress={() => setState("loading")} />
        <Button title="empty" onPress={() => setState("empty")} />
        <Button title="error" onPress={() => setState("error")} />
        <Button title="ready" onPress={() => setState("ready")} />
      </View>
    </View>
  );
}
