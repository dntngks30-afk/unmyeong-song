import { getStoryDetail, getStoryList } from "../../features/story/api/queries";
import type { Story } from "../../features/story/model/types";

export type { Story };

export async function listStories(params: {
  limit?: number;
  accessToken?: string;
}): Promise<
  | { ok: true; data: Story[] }
  | { ok: false; reason: "error" | "empty" }
> {
  const result = await getStoryList({
    limit: params.limit,
    accessToken: params.accessToken,
  });
  if (!result.ok) {
    return { ok: false, reason: "error" };
  }
  if (result.state === "empty" || result.data.length === 0) {
    return { ok: true, data: [] };
  }
  return { ok: true, data: result.data };
}

export async function getStory(
  storyId: string,
  accessToken?: string
): Promise<
  | { ok: true; data: { title: string; content: string } }
  | { ok: false; reason: "not_found" | "error" }
> {
  const result = await getStoryDetail(storyId, accessToken);
  if (!result.ok) {
    return { ok: false, reason: result.state === "not_found" ? "not_found" : "error" };
  }
  return {
    ok: true,
    data: {
      title: result.data.title,
      content: result.data.content,
    },
  };
}
