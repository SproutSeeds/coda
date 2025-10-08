"use client";

import type { Feature } from "./types";
import { FeatureCard } from "./FeatureCard";

export function FeatureList({ ideaId, features }: { ideaId: string; features: Feature[] }) {
  if (features.length === 0) {
    return <p className="text-sm text-muted-foreground">No features yet. Add one to start shaping this idea.</p>;
  }

  return (
    <div className="space-y-3" data-testid="feature-list">
      {features.map((feature) => (
        <FeatureCard key={feature.id} feature={feature} ideaId={ideaId} />
      ))}
    </div>
  );
}
