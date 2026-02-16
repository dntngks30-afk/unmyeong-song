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

export type AppErrorPayload = {
  code: AppErrorCode;
  message: string;
  userMessage: string;
  retryable: boolean;
  correlationId: string;
  details?: Record<string, unknown>;
};

const USER_MESSAGES: Record<AppErrorCode, string> = {
  AUTH_REQUIRED: "로그인이 필요합니다.",
  FORBIDDEN_ROLE: "권한이 없습니다.",
  RATE_LIMITED: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  RLS_DENIED: "요청을 처리할 수 없습니다.",
  CONTENT_BLOCKED: "정책상 등록할 수 없는 내용이 포함되어 있습니다.",
  VOTE_LIMIT_EXCEEDED: "투표 가능 횟수를 초과했습니다.",
  DUPLICATE_VOTE: "이미 투표한 곡입니다.",
  STORAGE_PATH_INVALID: "파일 경로가 올바르지 않습니다.",
  NOT_FOUND: "요청한 정보를 찾을 수 없습니다.",
  CONFLICT: "이미 처리된 요청입니다.",
  NETWORK_UNAVAILABLE: "네트워크 연결을 확인해 주세요.",
  UNKNOWN: "일시적인 오류가 발생했습니다. 다시 시도해 주세요.",
};

const RETRYABLE_CODES = new Set<AppErrorCode>([
  "RATE_LIMITED",
  "NETWORK_UNAVAILABLE",
  "UNKNOWN",
]);

export class AppError extends Error {
  code: AppErrorCode;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    status: number,
    message?: string,
    details?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function makeCorrelationId(): string {
  return crypto.randomUUID();
}

export function toAppErrorPayload(
  error: unknown,
  correlationId: string,
): { status: number; payload: { error: AppErrorPayload } } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      payload: {
        error: {
          code: error.code,
          message: error.message,
          userMessage: USER_MESSAGES[error.code],
          retryable: RETRYABLE_CODES.has(error.code),
          correlationId,
          details: error.details,
        },
      },
    };
  }

  const message = error instanceof Error ? error.message : "UNKNOWN";
  return {
    status: 500,
    payload: {
      error: {
        code: "UNKNOWN",
        message,
        userMessage: USER_MESSAGES.UNKNOWN,
        retryable: true,
        correlationId,
      },
    },
  };
}

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

