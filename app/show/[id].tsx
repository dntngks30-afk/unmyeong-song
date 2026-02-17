import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Button, ScrollView, Text, View } from "react-native";
import { Audio } from "expo-av";
import { getRoundTrackDetail } from "../../features/show/api/queries";
import { getTrackPlayUrl } from "../../features/show/api/mutations";
import { supabase } from "../../src/lib/supabase";

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayLoading, setIsPlayLoading] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [token, setToken] = useState<string | undefined>(undefined);
  const soundRef = useRef<Audio.Sound | null>(null);

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

  useEffect(() => {
    let alive = true;
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setToken(data.session?.access_token);
    };
    void syncSession();
    const sub = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!alive) return;
      setToken(session?.access_token);
    });
    return () => {
      alive = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      void (async () => {
        if (soundRef.current) {
          try {
            await soundRef.current.stopAsync();
          } catch {}
          try {
            await soundRef.current.unloadAsync();
          } catch {}
        }
        soundRef.current = null;
      })();
    };
  }, []);

  const stopPlayback = async () => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.stopAsync();
    } catch {}
    try {
      await soundRef.current.unloadAsync();
    } catch {}
    soundRef.current = null;
    setIsPlaying(false);
  };

  const shouldRetryWithNewUrl = (message: string) => {
    const text = message.toLowerCase();
    return text.includes("expired") || text.includes("403") || text.includes("forbidden") || text.includes("url");
  };

  const startPlayback = async (allowRetry: boolean) => {
    setPlayerError("");
    setPlayNotice("");
    setIsPlayLoading(true);

    const playUrlRes = await getTrackPlayUrl({
      finalTrackId: trackId,
      accessToken: token,
    });

    if (!playUrlRes.ok) {
      setIsPlayLoading(false);
      if (playUrlRes.error.code === "AUTH_REQUIRED") {
        setPlayerError("로그인이 필요해요");
        return;
      }
      if (playUrlRes.error.code === "FORBIDDEN_ROLE") {
        setPlayerError("권한이 없어요");
        return;
      }
      setPlayerError("재생 URL을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    if (playUrlRes.data.correlationId) {
      console.log("[show][playback] correlationId=", playUrlRes.data.correlationId);
    }

    try {
      await stopPlayback();
      const created = await Audio.Sound.createAsync(
        { uri: playUrlRes.data.signedUrl },
        { shouldPlay: true },
      );
      soundRef.current = created.sound;
      setIsPlaying(true);
      created.sound.setOnPlaybackStatusUpdate((status) => {
        if ("didJustFinish" in status && status.didJustFinish) {
          void stopPlayback();
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (allowRetry && shouldRetryWithNewUrl(message)) {
        setPlayNotice("재생 URL이 만료되어 다시 요청했어요.");
        await startPlayback(false);
        return;
      }
      setPlayerError("재생에 실패했어요. 다시 시도해 주세요.");
      await stopPlayback();
    } finally {
      setIsPlayLoading(false);
    }
  };

  const handleTogglePlay = async () => {
    if (isPlayLoading) return;
    if (isPlaying) {
      await stopPlayback();
      return;
    }
    await startPlayback(true);
  };

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
        title={isPlayLoading ? "재생 준비 중..." : isPlaying ? "정지" : "재생"}
        onPress={() => void handleTogglePlay()}
      />
      {isPlayLoading ? <ActivityIndicator /> : null}
      {playNotice ? <Text>{playNotice}</Text> : null}
      {playerError ? <Text>{playerError}</Text> : null}
    </ScrollView>
  );
}
