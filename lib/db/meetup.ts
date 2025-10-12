import { and, desc, eq } from "drizzle-orm";

import { getDb } from "./index";
import { meetupCheckins } from "./schema";

type RecordMeetupCheckInInput = {
  userId: string;
  email: string;
  eventDate: string;
};

export async function recordMeetupCheckIn({ userId, email, eventDate }: RecordMeetupCheckInInput) {
  const db = getDb();

  const insertResult = await db
    .insert(meetupCheckins)
    .values({ userId, email, eventDate })
    .onConflictDoNothing({ target: [meetupCheckins.userId, meetupCheckins.eventDate] })
    .returning({ id: meetupCheckins.id });

  const alreadyCheckedIn = insertResult.length === 0;

  return { alreadyCheckedIn };
}

export async function getUserMeetupAttendance(userId: string) {
  const db = getDb();

  const rows = await db
    .select({
      id: meetupCheckins.id,
      eventDate: meetupCheckins.eventDate,
      createdAt: meetupCheckins.createdAt,
    })
    .from(meetupCheckins)
    .where(eq(meetupCheckins.userId, userId))
    .orderBy(desc(meetupCheckins.eventDate), desc(meetupCheckins.createdAt));

  return rows;
}

export async function hasUserCheckedInForEvent(userId: string, eventDate: string) {
  const db = getDb();

  const existing = await db
    .select({ id: meetupCheckins.id })
    .from(meetupCheckins)
    .where(and(eq(meetupCheckins.userId, userId), eq(meetupCheckins.eventDate, eventDate)))
    .limit(1);

  return existing.length > 0;
}
