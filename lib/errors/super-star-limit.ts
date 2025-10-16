export class SuperStarLimitError extends Error {
  constructor() {
    super("You can super star up to three ideas. Remove one before starring another.");
    this.name = "SuperStarLimitError";
  }
}
