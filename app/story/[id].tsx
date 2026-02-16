// contracts: docs/contracts/api.md (사연 상세 조회), docs/contracts/ux-flows.md (사연 상세 상태 처리)
import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Button, ScrollView, Text, View } from "react-native";
import { getStoryDetail, initialStoryDetailState } from "../../features/story/api/queries";
import type { StoryDetailState } from "../../features/story/model/types";

export default function StoryDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const storyId = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<StoryDetailState>(initialStoryDetailState);

  const load = async () => {
    if (!storyId) {
      setState({ status: "not_found", data: null });
      return;
    }
    setState({ status: "loading", data: null });
    const result = await getStoryDetail(storyId);
    if (result.ok) {
      setState({ status: "ready", data: result.data });
      return;
    }
    if (result.state === "not_found") {
      setState({ status: "not_found", data: null });
      return;
    }
    setState({
      status: "error",
      data: null,
      errorMessage: result.error?.userMessage ?? "잠시 후 다시 시도해 주세요.",
    });
  };

  useEffect(() => {
    void load();
  }, [storyId]);

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text>불러오는 중...</Text>
      </View>
    );
  }

  if (state.status === "not_found") {
    return (
      <View style={{ flex: 1, padding: 16, gap: 10 }}>
        <Text>사연을 찾을 수 없어요.</Text>
        <Button title="다시 시도" onPress={() => void load()} />
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View style={{ flex: 1, padding: 16, gap: 10 }}>
        <Text>{state.errorMessage}</Text>
        <Button title="다시 시도" onPress={() => void load()} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>{state.data.title}</Text>
      <Text style={{ color: "#737373" }}>
        작성일: {new Date(state.data.createdAt).toLocaleString()}
      </Text>
      <Text>{state.data.content}</Text>
    </ScrollView>
  );
}
