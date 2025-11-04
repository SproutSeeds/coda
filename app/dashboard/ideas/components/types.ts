import type { FeatureRecord } from "@/lib/db/features";
import type { IdeaJoinRequestRecord, JoinRequestCounts as JoinRequestCountsRecord } from "@/lib/db/join-requests";
import type { IdeaRecord } from "@/lib/db/ideas";

type Idea = IdeaRecord;
type Feature = FeatureRecord;
type JoinRequest = IdeaJoinRequestRecord;
type JoinRequestCounts = JoinRequestCountsRecord;

export type { Idea, Feature, JoinRequest, JoinRequestCounts };
