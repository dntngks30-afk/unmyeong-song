// contracts: docs/contracts/ux-flows.md (공통 상태머신), docs/contracts/api.md (Best 사연/Top10 조회)
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Button, Pressable, ScrollView, Text, View } from "react-native";
import { getBestStories } from "../../features/story/api/queries";
import { getTop10Tracks, type Top10Track } from "../../src/lib/rpc/tracks";
import type { Story } from "../../features/story/model/types";

type ScreenState = "loading" | "empty" | "error" | "ready";

export default function HomeTabScreen() {
  const router = useRouter();
  const [state, setState] = useState<ScreenState>("loading");
  const [stories, setStories] = useState<Story[]>([]);
  const [tracks, setTracks] = useState<Top10Track[]>([]);
  const [message, setMessage] = useState("");

  const hasContent = useMemo(() => stories.length > 0 || tracks.length > 0, [stories.length, tracks.length]);

  const loadHome = async () => {
    setState("loading");
    setMessage("");

    const [bestStoriesResult, top10Result] = await Promise.all([
      getBestStories(3),
      getTop10Tracks(),
    ]);

    const nextStories = bestStoriesResult.ok ? bestStoriesResult.data.slice(0, 3) : [];
    const nextTracks = top10Result.ok ? top10Result.data.slice(0, 3) : [];
    setStories(nextStories);
    setTracks(nextTracks);

    if (!bestStoriesResult.ok && !top10Result.ok) {
      setState("error");
      setMessage("홈 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    if (nextStories.length === 0 && nextTracks.length === 0) {
      setState("empty");
      return;
    }

    setState("ready");
  };

  useEffect(() => {
    void loadHome();
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>홈 탭</Text>
      {state === "loading" ? <Text>홈 데이터를 불러오는 중...</Text> : null}
      {state === "error" ? (
        <View style={{ gap: 8 }}>
          <Text>{message || "홈 데이터를 불러오지 못했어요."}</Text>
          <Button title="다시 시도" onPress={() => void loadHome()} />
        </View>
      ) : null}
      {state === "empty" ? (
        <View style={{ gap: 8 }}>
          <Text>홈에 표시할 데이터가 아직 없어요.</Text>
          <Button title="새로고침" onPress={() => void loadHome()} />
        </View>
      ) : null}
      {state === "ready" && hasContent ? (
        <>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "600" }}>인기 사연 미리보기</Text>
              <Button title="사연 더보기" onPress={() => router.push("/story")} />
            </View>
            {stories.length === 0 ? <Text>표시할 사연이 없어요.</Text> : null}
            {stories.map((story) => (
              <Pressable
                key={story.id}
                onPress={() => router.push(`/story/${story.id}`)}
                style={{ borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 10, padding: 10, gap: 4 }}
              >
                <Text style={{ fontWeight: "600" }} numberOfLines={1}>
                  {story.title}
                </Text>
                <Text numberOfLines={2}>{story.content}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "600" }}>Top 곡 미리보기</Text>
              <Button title="쇼로 이동" onPress={() => router.push("/show")} />
            </View>
            {tracks.length === 0 ? <Text>표시할 곡이 없어요.</Text> : null}
            {tracks.map((track) => (
              <Pressable
                key={track.id}
                onPress={() => router.push(`/show/${track.id}`)}
                style={{ borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 10, padding: 10, gap: 4 }}
              >
                <Text style={{ fontWeight: "600" }}>
                  {(track.rank ?? "-")}. {track.title}
                </Text>
                <Text>{track.artist ?? "익명 뮤지션"}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
