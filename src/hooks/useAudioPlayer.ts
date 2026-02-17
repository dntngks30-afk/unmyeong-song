import { Audio } from "expo-av";
import { useCallback, useEffect, useState } from "react";
import { getPlayableAudioUrl } from "../services/audio";

type PlaybackState = {
  trackId: string | null;
  errorTrackId: string | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  isLoading: boolean;
  error: string | null;
};

const listeners = new Set<(s: PlaybackState) => void>();
let state: PlaybackState = {
  trackId: null,
  errorTrackId: null,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  isLoading: false,
  error: null,
};

let currentSound: Audio.Sound | null = null;
let currentTrackId: string | null = null;

function notify() {
  listeners.forEach((cb) => cb({ ...state }));
}

async function unloadCurrent() {
  if (currentSound) {
    try {
      await currentSound.unloadAsync();
    } catch {
      /* ignore */
    }
    currentSound = null;
  }
  currentTrackId = null;
}

export function useAudioPlayer(accessToken: string | undefined) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>(state);

  useEffect(() => {
    const handler = (s: PlaybackState) => setPlaybackState(s);
    listeners.add(handler);
    setPlaybackState(state);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const play = useCallback(
    async (trackId: string) => {
      if (state.isLoading) return;
      if (!accessToken) {
        state.error = "재생 링크를 가져오지 못했어요.";
        notify();
        return;
      }

      if (currentTrackId === trackId && currentSound) {
        const status = await currentSound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await currentSound.pauseAsync();
          state.isPlaying = false;
        } else {
          await currentSound.playAsync();
          state.isPlaying = true;
        }
        notify();
        return;
      }

      state.isLoading = true;
      state.error = null;
      state.errorTrackId = null;
      state.trackId = trackId;
      state.positionMs = 0;
      state.durationMs = 0;
      notify();

      await unloadCurrent();

      const result = await getPlayableAudioUrl(trackId, accessToken);
      if (!result.ok) {
        state.isLoading = false;
        state.error = result.userMessage;
        state.errorTrackId = trackId;
        state.trackId = null;
        notify();
        return;
      }

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: result.url },
          { shouldPlay: true, progressUpdateIntervalMillis: 500 },
          (status) => {
            if (status.isLoaded) {
              state.positionMs = status.positionMillis;
              state.durationMs = status.durationMillis ?? 0;
              state.isPlaying = status.isPlaying;
              if (status.didJustFinish && !status.isLooping) {
                state.isPlaying = false;
                state.positionMs = state.durationMs;
              }
              notify();
            }
          }
        );
        currentSound = sound;
        currentTrackId = trackId;
        const st = await sound.getStatusAsync();
        if (st.isLoaded) {
          state.durationMs = st.durationMillis ?? 0;
          state.positionMs = st.positionMillis ?? 0;
          state.isPlaying = st.isPlaying ?? true;
        }
      } catch {
        state.error = "재생 링크를 가져오지 못했어요.";
        state.errorTrackId = trackId;
        state.trackId = null;
      }
      state.isLoading = false;
      notify();
    },
    [accessToken]
  );

  const pause = useCallback(async () => {
    if (currentSound) {
      try {
        await currentSound.pauseAsync();
        state.isPlaying = false;
        notify();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const toggle = useCallback(
    (trackId: string) => {
      if (currentTrackId === trackId && state.isPlaying) {
        void pause();
      } else {
        void play(trackId);
      }
    },
    [play, pause]
  );

  useEffect(() => {
    return () => {
      /* don't unload on unmount - keep playing when navigating */
    };
  }, []);

  return {
    ...playbackState,
    play,
    pause,
    toggle,
  };
}

export function formatTimeMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
