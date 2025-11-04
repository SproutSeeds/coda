export type IdeaPresence = {
  status: "idle" | "editing" | "viewing";
  focus: { type: "idea" } | { type: "feature"; featureId: string } | null;
  role: "owner" | "editor" | "commenter" | "viewer";
};

export type IdeaRoomStorage = Record<string, never>;

export type IdeaRoomEvent =
  | { type: "feature:highlight"; featureId: string }
  | { type: "idea:ping" };

export type IdeaUserMetadata = {
  name?: string;
  email?: string | null;
  avatar?: string;
};
