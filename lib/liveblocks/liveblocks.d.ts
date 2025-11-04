import type { IdeaPresence, IdeaRoomEvent, IdeaRoomStorage, IdeaUserMetadata } from "./types";

declare global {
  interface Liveblocks {
    Presence: IdeaPresence;
    Storage: IdeaRoomStorage;
    UserMeta: {
      id?: string;
      info?: IdeaUserMetadata;
    };
    RoomEvent: IdeaRoomEvent;
  }
}

export {};
