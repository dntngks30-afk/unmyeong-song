import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { getTop10Tracks, type Top10Track } from "../../src/lib/rpc/tracks";
import { supabase } from "../../src/lib/supabase";
import { Card } from "../../src/components/ui/Card";
import { PrimaryButton } from "../../src/components/ui/PrimaryButton";
import { Screen } from "../../src/components/ui/Screen";

const DUMMY_FINALE = [
  { id: "1", rank: 1, title: "곡 제목 A", artist: "아티스트", cheers: 12 },
  { id: "2", rank: 2, title: "곡 제목 B", artist: "뮤지션", cheers: 8 },
  { id: "3", rank: 3, title: "곡 제목 C", artist: "음악가", cheers: 5 },
];

export default function HomeTabScreen() {
  const router = useRouter();
  const [top3, setTop3] = useState<Top10Track[] | null>(null);

  useEffect(() => {
    let alive = true;
    const fn = async () => {
      const { data: session } = await supabase.auth.getSession();
      const result = await getTop10Tracks(session.session?.access_token);
      if (!alive) return;
      if (result.ok && result.data.length > 0) {
        setTop3(result.data.slice(0, 3));
      }
    };
    void fn();
    return () => {
      alive = false;
    };
  }, []);

  const goToShow = () => router.push("/(tabs)/show");
  const goToStories = () => router.push("/(tabs)/story/write");

  const items = top3 ?? DUMMY_FINALE;

  return (
    <Screen title="무명의 노래" subcopy="사연이, 노래가 되는 곳">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>이번 주 결선 쇼</Text>
            <Pressable onPress={goToShow} hitSlop={12}>
              <Text style={{ color: "#60a5fa", fontSize: 14 }}>전체 보기 &gt;</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {items.map((t, i) => {
              const r = t as Top10Track & { cheers?: number };
              const rank = r.rank ?? i + 1;
              const cheersVal = "cheers" in r && typeof r.cheers === "number" ? r.cheers : "-";
              return (
                <Pressable key={t.id} onPress={goToShow}>
                  <Card style={{ width: 220 }}>
                    <Text style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>#{rank}</Text>
                    <Text style={{ fontWeight: "600", fontSize: 15 }}>{t.title}</Text>
                    <Text style={{ color: "#666", fontSize: 13, marginTop: 4 }}>{r.artist ?? "익명 뮤지션"}</Text>
                    <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>응원수 {cheersVal}</Text>
                  </Card>
                </Pressable>
              );
            })}
          </ScrollView>
          {top3 === null && (
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4 }}>TODO: 실데이터 연동 시 TOP3 반영</Text>
          )}
        </View>

      </ScrollView>
      <PrimaryButton label="사연 쓰기" onPress={goToStories} />
    </Screen>
  );
}
