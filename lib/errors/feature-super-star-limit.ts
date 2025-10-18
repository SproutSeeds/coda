export class FeatureSuperStarLimitError extends Error {
  constructor() {
    super("You can super star up to three features per idea. Remove one before promoting another.");
    this.name = "FeatureSuperStarLimitError";
  }
}
