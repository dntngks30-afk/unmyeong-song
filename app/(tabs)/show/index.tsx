import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { getShowTracks, formatCheerDisplay, type ShowTrack } from "../../../src/services/show";
import { supabase } from "../../../src/lib/supabase";
import { useAudioPlayer } from "../../../src/hooks/useAudioPlayer";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";

type State = "loading" | "ready" | "empty" | "error";

export default function ShowListScreen() {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [tracks, setTracks] = useState<ShowTrack[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [errorDiagnostic, setErrorDiagnostic] = useState("");
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const { trackId: playingTrackId, errorTrackId, isLoading: playLoading, error: playError, toggle } =
    useAudioPlayer(accessToken);

  const load = async () => {
    setState("loading");
    setErrorMsg("");
    setErrorDiagnostic("");

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const result = await getShowTracks(token);

      if (result.ok) {
        setTracks(result.data);
        setState(result.data.length > 0 ? "ready" : "empty");
      } else {
        setState("error");
        setErrorMsg(result.error.userMessage);
        const ref = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(/^https?:\/\//, "").slice(0, 25);
        setErrorDiagnostic(`진단: ${result.error.code} · ref=${ref || "?"}`);
      }
    } catch (e) {
      setState("error");
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg("데이터를 불러오지 못했어요.");
      setErrorDiagnostic(`진단: ${msg.slice(0, 80)}`);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setAccessToken(data.session?.access_token);
    });
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setAccessToken(session?.access_token);
    });
    return () => {
      alive = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  return (
    <Screen title="이번 주 결선">
      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 4 }}>TOP 10</Text>
      <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, marginBottom: 16 }}>
        공개된 노래를 듣고 하루 1번 응원할 수 있어요.
      </Text>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 96, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {state === "loading" && (
          <Card>
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <ActivityIndicator color="#60a5fa" />
              <Text style={{ color: "#666", marginTop: 12 }}>TOP 10 불러오는 중...</Text>
            </View>
          </Card>
        )}

        {state === "empty" && (
          <Card>
            <Text style={{ color: "#666", textAlign: "center" }}>현재 공개된 곡이 없어요.</Text>
          </Card>
        )}

        {state === "error" && (
          <Card style={{ backgroundColor: "rgba(220,38,38,0.08)", borderWidth: 1, borderColor: "rgba(220,38,38,0.2)" }}>
            <Text style={{ color: "#dc2626", fontWeight: "500" }}>{errorMsg}</Text>
            <Text style={{ color: "#94a3b8", fontSize: 11, marginTop: 8 }}>{errorDiagnostic}</Text>
            <Pressable onPress={() => void load()} style={{ marginTop: 12, alignSelf: "flex-start" }}>
              <Text style={{ color: "#60a5fa", fontSize: 14 }}>다시 시도</Text>
            </Pressable>
          </Card>
        )}

        {state === "ready" &&
          tracks.map((t) => {
            const isPlaying = playingTrackId === t.id;
            return (
              <Card key={t.id} style={isPlaying ? { borderWidth: 2, borderColor: "#4338ca" } : undefined}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Pressable
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 14, minWidth: 0 }}
                    onPress={() => router.push(`/(tabs)/show/${t.id}`)}
                  >
                    <Text style={{ color: "#94a3b8", fontSize: 14, minWidth: 24 }}>{t.rank ?? "-"}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontWeight: "600", fontSize: 15 }} numberOfLines={1}>
                        {t.title}
                      </Text>
                      <Text style={{ color: "#666", fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                        {t.artist ?? "익명 뮤지션"}
                      </Text>
                      <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>{formatCheerDisplay(t.voteCount)}</Text>
                    </View>
                  </Pressable>
                    <Pressable
                      onPress={() => toggle(t.id)}
                      hitSlop={8}
                      disabled={playLoading}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: isPlaying ? "#4338ca" : "#e0e7ff",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 12, color: isPlaying ? "#fff" : "#4338ca" }}>
                        {playLoading && playingTrackId === t.id ? "..." : "▶"}
                      </Text>
                    </Pressable>
                  </View>
                  {playError && errorTrackId === t.id ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <Text style={{ color: "#dc2626", fontSize: 11, flex: 1 }}>{playError}</Text>
                      <Pressable onPress={() => toggle(t.id)}>
                        <Text style={{ color: "#60a5fa", fontSize: 11 }}>다시 시도</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </Card>
            );
          })}

        {state === "ready" && <View style={{ height: 24 }} />}
      </ScrollView>
    </Screen>
  );
}
