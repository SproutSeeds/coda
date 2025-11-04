const IDEA_ROOM_PREFIX = "idea:";

export function getIdeaRoomId(ideaId: string) {
  return `${IDEA_ROOM_PREFIX}${ideaId}`;
}

export function parseIdeaRoomId(roomId: string) {
  if (!roomId.startsWith(IDEA_ROOM_PREFIX)) {
    return null;
  }
  return roomId.slice(IDEA_ROOM_PREFIX.length);
}
