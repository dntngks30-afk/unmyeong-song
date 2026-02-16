export type AppErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN_ROLE"
  | "RATE_LIMITED"
  | "RLS_DENIED"
  | "CONTENT_BLOCKED"
  | "VOTE_LIMIT_EXCEEDED"
  | "DUPLICATE_VOTE"
  | "STORAGE_PATH_INVALID"
  | "NOT_FOUND"
  | "CONFLICT"
  | "NETWORK_UNAVAILABLE"
  | "UNKNOWN";

export type AppError = {
  code: AppErrorCode;
  message: string;
  userMessage: string;
  retryable: boolean;
  correlationId?: string;
  details?: unknown;
};

export type RpcMappedCode = "DUPLICATE_VOTE" | "VOTE_LIMIT_EXCEEDED" | "UNKNOWN";
export type RpcMappedError = {
  code: RpcMappedCode;
  raw: unknown;
};

const USER_MESSAGES: Record<AppErrorCode, string> = {
  AUTH_REQUIRED: "로그인이 필요합니다.",
  FORBIDDEN_ROLE: "권한이 없습니다.",
  RATE_LIMITED: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  RLS_DENIED: "요청을 처리할 수 없습니다.",
  CONTENT_BLOCKED: "정책상 등록할 수 없는 내용이 포함되어 있습니다.",
  VOTE_LIMIT_EXCEEDED: "투표는 최대 3표까지 가능해요",
  DUPLICATE_VOTE: "이미 이 트랙에 투표했어요",
  STORAGE_PATH_INVALID: "파일 경로가 올바르지 않습니다.",
  NOT_FOUND: "요청한 정보를 찾을 수 없습니다.",
  CONFLICT: "이미 처리된 요청입니다.",
  NETWORK_UNAVAILABLE: "네트워크 연결을 확인해 주세요.",
  UNKNOWN: "잠시 후 다시 시도해 주세요",
};

const RETRYABLE_CODES = new Set<AppErrorCode>(["RATE_LIMITED", "NETWORK_UNAVAILABLE", "UNKNOWN"]);
const KNOWN_CODES = new Set<AppErrorCode>([
  "AUTH_REQUIRED",
  "FORBIDDEN_ROLE",
  "RATE_LIMITED",
  "RLS_DENIED",
  "CONTENT_BLOCKED",
  "VOTE_LIMIT_EXCEEDED",
  "DUPLICATE_VOTE",
  "STORAGE_PATH_INVALID",
  "NOT_FOUND",
  "CONFLICT",
  "NETWORK_UNAVAILABLE",
  "UNKNOWN",
]);

function inferCodeFromMessage(message: string): AppErrorCode {
  const upper = message.toUpperCase();
  if (upper.includes("DUPLICATE_VOTE")) return "DUPLICATE_VOTE";
  if (upper.includes("VOTE_LIMIT_EXCEEDED")) return "VOTE_LIMIT_EXCEEDED";
  if (upper.includes("AUTH_REQUIRED")) return "AUTH_REQUIRED";
  if (upper.includes("FORBIDDEN_ROLE")) return "FORBIDDEN_ROLE";
  if (upper.includes("RATE_LIMITED")) return "RATE_LIMITED";
  if (upper.includes("RLS_DENIED")) return "RLS_DENIED";
  if (upper.includes("CONTENT_BLOCKED")) return "CONTENT_BLOCKED";
  if (upper.includes("STORAGE_PATH_INVALID")) return "STORAGE_PATH_INVALID";
  if (upper.includes("NOT_FOUND")) return "NOT_FOUND";
  if (upper.includes("CONFLICT")) return "CONFLICT";
  if (upper.includes("NETWORK")) return "NETWORK_UNAVAILABLE";
  return "UNKNOWN";
}

const warnedUnknownObjects = new WeakSet<object>();
const warnedUnknownFingerprints = new Set<string>();

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function detectVoteCodeFromText(text: string): RpcMappedCode {
  const upper = text.toUpperCase();
  if (upper.includes("DUPLICATE_VOTE")) return "DUPLICATE_VOTE";
  if (upper.includes("VOTE_LIMIT_EXCEEDED")) return "VOTE_LIMIT_EXCEEDED";
  return "UNKNOWN";
}

function warnUnknownRpcErrorOnce(raw: unknown): void {
  if (raw && typeof raw === "object") {
    const objectRef = raw as object;
    if (warnedUnknownObjects.has(objectRef)) return;
    warnedUnknownObjects.add(objectRef);
    console.warn("[rpc-error] UNKNOWN mapping", raw);
    return;
  }

  const fingerprint = `${typeof raw}:${String(raw)}`;
  if (warnedUnknownFingerprints.has(fingerprint)) return;
  warnedUnknownFingerprints.add(fingerprint);
  console.warn("[rpc-error] UNKNOWN mapping", raw);
}

function mapRpcErrorInternal(err: unknown, warnUnknown: boolean): RpcMappedError {
  const record = typeof err === "object" && err !== null ? (err as Record<string, unknown>) : null;

  // 1) 정형 필드 우선 확인
  const structuredCandidates: unknown[] = record
    ? [record.code, record.error, record.status]
    : [];
  for (const candidate of structuredCandidates) {
    if (typeof candidate === "string" || typeof candidate === "number") {
      const fromStructured = detectVoteCodeFromText(String(candidate));
      if (fromStructured !== "UNKNOWN") {
        return { code: fromStructured, raw: err };
      }
    }
  }

  // 2) 문자열 소스 풀(message/details/hint/name/stack/JSON.stringify)
  const sources: string[] = [];
  if (record) {
    const fieldNames = ["message", "details", "hint", "name", "stack"] as const;
    for (const field of fieldNames) {
      const value = record[field];
      if (typeof value === "string") {
        sources.push(value);
      } else if (value != null) {
        sources.push(safeStringify(value));
      }
    }
    sources.push(safeStringify(record));
  } else if (typeof err === "string") {
    sources.push(err);
  } else {
    sources.push(String(err));
  }

  const merged = sources.join("\n");
  const fromTextPool = detectVoteCodeFromText(merged);
  if (fromTextPool !== "UNKNOWN") {
    return { code: fromTextPool, raw: err };
  }

  if (warnUnknown) {
    warnUnknownRpcErrorOnce(err);
  }
  return { code: "UNKNOWN", raw: err };
}

export function mapRpcError(err: unknown): RpcMappedError {
  return mapRpcErrorInternal(err, true);
}

function coerceCode(rawCode: unknown, message: string): AppErrorCode {
  if (typeof rawCode === "string") {
    const trimmed = rawCode.trim().toUpperCase() as AppErrorCode;
    if (KNOWN_CODES.has(trimmed)) return trimmed;
  }
  return inferCodeFromMessage(message);
}

export function toAppError(error: unknown): AppError {
  const mappedRpc = mapRpcErrorInternal(error, false);
  const voteMappedCode = mappedRpc.code === "UNKNOWN" ? null : mappedRpc.code;

  if (typeof error === "object" && error !== null) {
    const maybeRecord = error as Record<string, unknown>;
    const nestedError =
      maybeRecord.error && typeof maybeRecord.error === "object"
        ? (maybeRecord.error as Record<string, unknown>)
        : null;
    const source = nestedError ?? maybeRecord;
    const message =
      typeof source.message === "string"
        ? source.message
        : "Unknown error";

    const code = voteMappedCode ?? coerceCode(source.code, message);
    const retryable = RETRYABLE_CODES.has(code);

    return {
      code,
      message,
      userMessage: USER_MESSAGES[code],
      retryable,
      correlationId:
        typeof source.correlationId === "string"
          ? source.correlationId
          : undefined,
      details: source.details,
    };
  }

  const message = typeof error === "string" ? error : "Unknown error";
  const code = voteMappedCode ?? inferCodeFromMessage(message);
  return {
    code,
    message,
    userMessage: USER_MESSAGES[code],
    retryable: RETRYABLE_CODES.has(code),
  };
}
