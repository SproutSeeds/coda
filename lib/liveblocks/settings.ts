export const LIVEBLOCKS_AUTH_ENDPOINT = "/api/liveblocks/auth";

export const LIVEBLOCKS_PUBLIC_KEY = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY ?? "";
export const LIVEBLOCKS_SECRET_KEY = process.env.LIVEBLOCKS_SECRET_KEY ?? "";

export function hasLiveblocksConfig() {
  return Boolean(LIVEBLOCKS_PUBLIC_KEY || LIVEBLOCKS_SECRET_KEY);
}
