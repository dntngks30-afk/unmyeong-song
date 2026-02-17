// contracts: docs/contracts/api.md (stories 조회), docs/contracts/ux-flows.md (사연 목록/에러/빈상태)
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Button, Pressable, ScrollView, Text, View } from "react-native";
import { castStoryVoteMax1 } from "../../features/story/api/mutations";
import { getBestStories, getStoryList, initialStoryListState } from "../../features/story/api/queries";
import type { StoryListState } from "../../features/story/model/types";

export default function StoryTabScreen() {
  const router = useRouter();
  const [state, setState] = useState<StoryListState>(initialStoryListState);
  const [bestState, setBestState] = useState<StoryListState>(initialStoryListState);
  const [statusText, setStatusText] = useState("");
  const [votingStoryId, setVotingStoryId] = useState<string | null>(null);

  const generateUuidV4 = () =>
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
          const rand = Math.floor(Math.random() * 16);
          const value = char === "x" ? rand : (rand & 0x3) | 0x8;
          return value.toString(16);
        });

  const loadStories = async () => {
    setState({ status: "loading", data: [] });
    setBestState({ status: "loading", data: [] });

    const best = await getBestStories(4);
    if (!best.ok) {
      setBestState({ status: "error", data: [], errorMessage: best.error.userMessage });
    } else if (best.state === "empty") {
      setBestState({ status: "empty", data: [] });
    } else {
      setBestState({ status: "ready", data: best.data });
    }

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

  const handleVote = async (storyId: string) => {
    if (votingStoryId) return;
    setVotingStoryId(storyId);
    setStatusText("");

    const result = await castStoryVoteMax1({
      storyId,
      clientRequestId: generateUuidV4(),
    });
    setVotingStoryId(null);

    if (!result.ok) {
      if (result.error.code === "DUPLICATE_VOTE") {
        setStatusText("이미 추천한 사연이에요.");
        return;
      }
      setStatusText(result.error.userMessage);
      return;
    }

    setStatusText(result.idempotentReplay ? "같은 요청으로 이미 추천이 반영되었어요." : "추천이 반영되었어요.");
    await loadStories();
  };

  useEffect(() => {
    void loadStories();
  }, []);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>사연</Text>
      <Button title="사연 쓰기" onPress={() => router.push("/story/write")} />
      {statusText ? <Text>{statusText}</Text> : null}

      <Text style={{ fontSize: 16, fontWeight: "600" }}>Best 사연</Text>
      {bestState.status === "loading" ? <Text>Best 불러오는 중...</Text> : null}
      {bestState.status === "empty" ? <Text>Best 사연이 아직 없어요.</Text> : null}
      {bestState.status === "error" ? <Text>{bestState.errorMessage}</Text> : null}
      {bestState.status === "ready" ? (
        <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
          {bestState.data.map((story) => (
            <Pressable
              key={`best-${story.id}`}
              onPress={() => router.push(`/story/${story.id}`)}
              style={{ width: 260, borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 10, gap: 6 }}
            >
              <Text style={{ fontWeight: "700" }}>{story.title}</Text>
              <Text numberOfLines={2}>{story.content}</Text>
              <Text style={{ color: "#737373" }}>추천수 {story.voteCount ?? 0}</Text>
              <Button
                title={votingStoryId === story.id ? "추천 중..." : "추천"}
                onPress={() => void handleVote(story.id)}
                disabled={votingStoryId !== null}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

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
              <Text style={{ color: "#737373" }}>추천수 {story.voteCount ?? 0}</Text>
              <Text style={{ color: "#737373" }}>
                {new Date(story.createdAt).toLocaleString()}
              </Text>
              <Button
                title={votingStoryId === story.id ? "추천 중..." : "추천"}
                onPress={() => void handleVote(story.id)}
                disabled={votingStoryId !== null}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
