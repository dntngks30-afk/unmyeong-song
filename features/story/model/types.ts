export type StoryStatus = "open" | "blocked";

export type Story = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  authorId?: string;
  status?: StoryStatus;
  voteCount?: number;
};

export type StoryListState =
  | { status: "loading"; data: Story[] }
  | { status: "empty"; data: Story[] }
  | { status: "ready"; data: Story[] }
  | { status: "error"; data: Story[]; errorMessage: string };

export type StoryDetailState =
  | { status: "loading"; data: null }
  | { status: "not_found"; data: null }
  | { status: "ready"; data: Story }
  | { status: "error"; data: null; errorMessage: string };
