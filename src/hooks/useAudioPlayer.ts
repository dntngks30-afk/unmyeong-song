import { useCallback, useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import { getTrackPlayUrl, incrementTrackPlay } from "../../features/show/api/mutations";

const PLAY_COUNT_THROTTLE_MS = 5 * 60 * 1000; // 5분

export function formatTimeMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const lastPlayCountByTrack = new Map<string, number>();

export function useAudioPlayer(accessToken?: string) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const currentTrackIdRef = useRef<string | null>(null);

  const [trackId, setTrackId] = useState<string | null>(null);
  const [errorTrackId, setErrorTrackId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const stopAndUnload = useCallback(async () => {
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
      setTrackId(null);
      setErrorTrackId(null);
      setError(null);
      setIsPlaying(false);
      setPositionMs(0);
      setDurationMs(0);
    }
  }, []);

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
      stopAndUnload();
    };
  }, [stopAndUnload]);

  /** PR-NEXT-05: 직접 signed URL로 재생 (관리자 샘플곡용) */
  const playFromUrl = useCallback(
    async (signedUrl: string, sourceId?: string) => {
      setError(null);
      setErrorTrackId(null);

      const id = sourceId ?? "url";
      if (trackId === id) {
        await stopAndUnload();
        return;
      }

      await stopAndUnload();
      setIsLoading(true);

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: signedUrl },
          { shouldPlay: true }
        );

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            setPositionMs(status.positionMillis ?? 0);
            setDurationMs(status.durationMillis ?? 0);
            setIsPlaying(status.isPlaying ?? false);
            if ("didJustFinish" in status && status.didJustFinish) {
              stopAndUnload().catch(() => {});
            }
          }
        });

        soundRef.current = sound;
        currentTrackIdRef.current = id;
        setTrackId(id);
        setIsPlaying(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "재생에 실패했어요");
        setErrorTrackId(id);
      } finally {
        setIsLoading(false);
      }
    },
    [trackId, stopAndUnload]
  );

  const toggle = useCallback(
    async (finalTrackId: string) => {
      setError(null);
      setErrorTrackId(null);

      if (trackId === finalTrackId) {
        await stopAndUnload();
        return;
      }

      await stopAndUnload();
      setIsLoading(true);

      try {
        const result = await getTrackPlayUrl({
          finalTrackId,
          accessToken,
        });
        if (!result.ok) {
          setError(result.error.userMessage);
          setErrorTrackId(finalTrackId);
          return;
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: result.data.signedUrl },
          { shouldPlay: true }
        );

        const now = Date.now();
        const last = lastPlayCountByTrack.get(finalTrackId) ?? 0;
        if (accessToken && now - last >= PLAY_COUNT_THROTTLE_MS) {
          lastPlayCountByTrack.set(finalTrackId, now);
          void incrementTrackPlay(finalTrackId, accessToken);
        }

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            setPositionMs(status.positionMillis ?? 0);
            setDurationMs(status.durationMillis ?? 0);
            setIsPlaying(status.isPlaying ?? false);
            if ("didJustFinish" in status && status.didJustFinish) {
              stopAndUnload().catch(() => {});
            }
          }
        });

        soundRef.current = sound;
        currentTrackIdRef.current = finalTrackId;
        setTrackId(finalTrackId);
        setIsPlaying(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "재생에 실패했어요");
        setErrorTrackId(finalTrackId);
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, trackId, stopAndUnload]
  );

  return {
    trackId,
    errorTrackId,
    isLoading,
    error,
    toggle,
    playFromUrl,
    stopAndUnload,
    isPlaying,
    positionMs,
    durationMs,
  };
}
