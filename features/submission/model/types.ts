export type UploadKind = "audio" | "cover";

export type LocalFileInput = {
  uri: string;
  mimeType: string;
  filename: string;
  kind: UploadKind;
};

export type UploadSession = {
  bucket: string;
  objectPath: string;
  signedUrl: string;
  expiresIn: number;
  correlationId?: string;
};

export type SubmissionStage =
  | { type: "Idle" }
  | { type: "Issuing"; kind: UploadKind }
  | { type: "Uploading"; kind: UploadKind }
  | { type: "Submitting" }
  | { type: "Done"; songId: string }
  | { type: "Error"; code: string; message: string };

export type CreateUploadSessionInput = {
  kind: UploadKind;
  songId: string;
  accessToken?: string;
  file: LocalFileInput;
};

export type CompleteSubmissionInput = {
  songId: string;
  makingNote: string;
  audioPath: string;
  coverPath?: string | null;
  accessToken?: string;
};
