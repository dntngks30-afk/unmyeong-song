import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Button, ScrollView, Text, View } from "react-native";
import { getRoundTrackDetail } from "../../features/show/api/queries";

type DetailState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      data: {
        title: string;
        artist?: string | null;
        roundType: string;
        displayOrder: number;
      };
    };

export default function ShowTrackDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const trackId = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [playNotice, setPlayNotice] = useState("");

  const load = async () => {
    if (!trackId) {
      setState({ status: "not_found" });
      return;
    }

    setState({ status: "loading" });
    const result = await getRoundTrackDetail(trackId);
    if (!result.ok) {
      if (!result.error) {
        setState({ status: "not_found" });
        return;
      }
      setState({ status: "error", message: result.error.userMessage });
      return;
    }

    setState({
      status: "ready",
      data: {
        title: result.data.title,
        artist: result.data.artist,
        roundType: result.data.roundType,
        displayOrder: result.data.displayOrder,
      },
    });
  };

  useEffect(() => {
    void load();
  }, [trackId]);

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
        <Text>트랙 정보를 찾을 수 없어요.</Text>
        <Button title="다시 시도" onPress={() => void load()} />
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View style={{ flex: 1, padding: 16, gap: 10 }}>
        <Text>{state.message}</Text>
        <Button title="다시 시도" onPress={() => void load()} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>{state.data.title}</Text>
      <Text>{state.data.artist ?? "익명 뮤지션"}</Text>
      <Text style={{ color: "#737373" }}>
        라운드: {state.data.roundType} · 순서 {state.data.displayOrder}
      </Text>

      <Button
        title="재생 (PR05에서 활성화)"
        onPress={() => setPlayNotice("재생 기능은 PR05에서 활성화될 예정이에요.")}
      />
      {playNotice ? <Text>{playNotice}</Text> : null}
    </ScrollView>
  );
}
