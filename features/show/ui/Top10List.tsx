import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Audio } from "expo-av";

export type Top10Track = {
  id: string;
  title: string;
  artist?: string | null;
};

type Props = {
  tracks: Top10Track[];
  onVote: (finalTrackId: string) => Promise<void>;
  getPlayUrl: (
    finalTrackId: string,
  ) => Promise<{ signedUrl: string; expiresIn: number; correlationId?: string }>;
  votedTrackIds?: Set<string>;
  isVoting?: (finalTrackId: string) => boolean;
};

export default function Top10List({
  tracks,
  onVote,
  getPlayUrl,
  votedTrackIds,
  isVoting,
}: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const currentTrackIdRef = useRef<string | null>(null);

  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [playLoadingTrackId, setPlayLoadingTrackId] = useState<string | null>(null);
  const [playErrorTrackId, setPlayErrorTrackId] = useState<string | null>(null);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      (async () => {
        try {
          if (soundRef.current) {
            await soundRef.current.unloadAsync();
          }
        } catch {}
        soundRef.current = null;
        currentTrackIdRef.current = null;
      })();
    };
  }, []);

  const stopAndUnload = async () => {
    try {
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
        } catch {}
        try {
          await soundRef.current.unloadAsync();
        } catch {}
      }
    } finally {
      soundRef.current = null;
      currentTrackIdRef.current = null;
      setPlayingTrackId(null);
    }
  };

  const handleTogglePlay = async (finalTrackId: string) => {
    setPlayErrorTrackId(null);

    if (playingTrackId === finalTrackId) {
      await stopAndUnload();
      return;
    }

    await stopAndUnload();
    setPlayLoadingTrackId(finalTrackId);

    try {
      const { signedUrl, correlationId } = await getPlayUrl(finalTrackId);
      if (correlationId) {
        console.log("[show][getPlayUrl] correlationId=", correlationId);
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: signedUrl },
        { shouldPlay: true },
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if ("didJustFinish" in status && status.didJustFinish) {
          stopAndUnload().catch(() => {});
        }
      });

      soundRef.current = sound;
      currentTrackIdRef.current = finalTrackId;
      setPlayingTrackId(finalTrackId);
    } catch {
      setPlayErrorTrackId(finalTrackId);
      await stopAndUnload();
    } finally {
      setPlayLoadingTrackId(null);
    }
  };

  return (
    <View style={{ gap: 12, padding: 16 }}>
      {tracks.map((track, index) => {
        const isPlaying = playingTrackId === track.id;
        const isLoading = playLoadingTrackId === track.id;
        const isPlayError = playErrorTrackId === track.id;
        const voted = votedTrackIds?.has(track.id);
        const voting = isVoting?.(track.id) ?? false;

        return (
          <View
            key={track.id}
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 12,
              opacity: voting ? 0.7 : 1,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600" }}>
              {index + 1}. {track.title}
            </Text>
            {!!track.artist && <Text style={{ marginTop: 4 }}>{track.artist}</Text>}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={() => void handleTogglePlay(track.id)}
                disabled={isLoading}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {isLoading ? <ActivityIndicator /> : null}
                <Text>{isLoading ? "로딩…" : isPlaying ? "정지" : "재생"}</Text>
              </Pressable>

              <Pressable
                onPress={() => void onVote(track.id)}
                disabled={voting}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                }}
              >
                <Text>{voting ? "투표 중…" : "투표"}</Text>
              </Pressable>

              {voted ? (
                <View style={{ justifyContent: "center" }}>
                  <Text>투표됨</Text>
                </View>
              ) : null}
            </View>

            {isPlayError ? (
              <Text style={{ marginTop: 8 }}>재생에 실패했어요. 다시 시도해 주세요.</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
