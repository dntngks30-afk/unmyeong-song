// contracts: docs/contracts/api.md (stories 조회), docs/contracts/ux-flows.md (사연 목록/에러/빈상태)
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Button, Pressable, ScrollView, Text, View } from "react-native";
import { getStoryList, initialStoryListState } from "../../features/story/api/queries";
import type { StoryListState } from "../../features/story/model/types";

export default function StoryTabScreen() {
  const router = useRouter();
  const [state, setState] = useState<StoryListState>(initialStoryListState);

  const loadStories = async () => {
    setState({ status: "loading", data: [] });
    const result = await getStoryList({ limit: 20, offset: 0 });
    if (!result.ok) {
      setState({ status: "error", data: [], errorMessage: result.error.userMessage });
      return;
    }
    if (result.state === "empty") {
      setState({ status: "empty", data: [] });
      return;
    }
    setState({ status: "ready", data: result.data });
  };

  useEffect(() => {
    void loadStories();
  }, []);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>사연</Text>
      <Button title="사연 쓰기" onPress={() => router.push("/story/write")} />

      {state.status === "loading" ? <Text>불러오는 중...</Text> : null}
      {state.status === "empty" ? <Text>아직 사연이 없어요.</Text> : null}
      {state.status === "error" ? (
        <View style={{ gap: 8 }}>
          <Text>{state.errorMessage}</Text>
          <Button title="다시 시도" onPress={() => void loadStories()} />
        </View>
      ) : null}
      {state.status === "ready" ? (
        <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
          {state.data.map((story) => (
            <Pressable
              key={story.id}
              onPress={() => router.push(`/story/${story.id}`)}
              style={{ borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 8, padding: 12, gap: 4 }}
            >
              <Text style={{ fontSize: 16, fontWeight: "600" }}>{story.title}</Text>
              <Text numberOfLines={2}>{story.content}</Text>
              <Text style={{ color: "#737373" }}>
                {new Date(story.createdAt).toLocaleString()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
