import { castVotesMax3 } from "../lib/rpc/votes";
import { toAppError } from "../lib/errors";

function genRequestId(): string {
  if (typeof globalThis?.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type VoteTrackOk = { ok: true; remaining: number };
type VoteTrackFail = {
  ok: false;
  code: "DUPLICATE_VOTE" | "VOTE_LIMIT_EXCEEDED" | string;
  message?: string;
};

export async function voteTrack(
  trackId: string,
  accessToken?: string
): Promise<VoteTrackOk | VoteTrackFail> {
  try {
    const result = await castVotesMax3({
      finalTrackId: trackId,
      clientRequestId: genRequestId(),
      accessToken,
    });
    if (!result.ok) {
      const code = result.error.code;
      const textPool = `${result.error.message}\n${result.error.userMessage}`.toUpperCase();
      if (textPool.includes("DUPLICATE") || textPool.includes("이미")) {
        return {
          ok: false,
          code: "DUPLICATE_VOTE",
          message: result.error.userMessage,
        };
      }
      if (textPool.includes("VOTE_LIMIT") || textPool.includes("3표") || textPool.includes("응원권")) {
        return {
          ok: false,
          code: "VOTE_LIMIT_EXCEEDED",
          message: result.error.userMessage,
        };
      }
      return {
        ok: false,
        code: code,
        message: result.error.userMessage,
      };
    }
    const remaining = Math.max(0, 3 - result.data.userVoteCount);
    return { ok: true, remaining };
  } catch (e) {
    const err = toAppError(e);
    const textPool = `${err.message}\n${err.userMessage}`.toUpperCase();
    if (textPool.includes("DUPLICATE") || textPool.includes("이미")) {
      return { ok: false, code: "DUPLICATE_VOTE", message: err.userMessage };
    }
    if (textPool.includes("VOTE_LIMIT") || textPool.includes("3표") || textPool.includes("응원권")) {
      return { ok: false, code: "VOTE_LIMIT_EXCEEDED", message: err.userMessage };
    }
    return { ok: false, code: err.code, message: err.userMessage };
  }
}
