export interface TutorialStep {
  id: number;
  targetId: string; // Matches data-tutorial attribute
  title: string;
  description: string;
  placement: "top" | "right" | "bottom" | "left" | "auto";
  actionType: string; // Journey task action type that triggers this step
  route?: string; // The route where this step should happen
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    targetId: "sidebar-ideas-link",
    title: "Enter Your Workshop",
    description: "Welcome, Wanderer. Click here to enter your workshop where ideas take form.",
    placement: "right",
    actionType: "visit_dashboard",
    route: "/dashboard",
  },
  {
    id: 2,
    targetId: "new-idea-button",
    title: "Spark a Vision",
    description: "Create your first idea to begin the manifestation process.",
    placement: "bottom",
    actionType: "create_idea",
    route: "/dashboard/ideas",
  },
  {
    id: 3,
    targetId: "idea-title-input",
    title: "Name Your Creation",
    description: "Give your idea a name. It can be anything—a product, a story, a dream.",
    placement: "bottom",
    actionType: "create_idea_title_focus",
    route: "/dashboard/ideas",
  },
  {
    id: 4,
    targetId: "idea-notes-input",
    title: "Describe the Essence",
    description: "Add some notes to capture the details of your vision.",
    placement: "top",
    actionType: "add_idea_notes",
    route: "/dashboard/ideas",
  },
  {
    id: 5,
    targetId: "ideas-list-item",
    title: "Manifestation Complete",
    description: "Your idea now appears here. You've manifested it!",
    placement: "right",
    actionType: "view_ideas_list",
    route: "/dashboard/ideas",
  },
  {
    id: 6,
    targetId: "idea-card-link",
    title: "Deepen the Connection",
    description: "Click on your idea to enter its detail view and refine it further.",
    placement: "right",
    actionType: "view_idea_detail",
    route: "/dashboard/ideas",
  },
  {
    id: 7,
    targetId: "quest-hub-link",
    title: "The Path Awaits",
    description: "Stage 1 complete! Visit the Quest Hub to see your progress and claim your rewards.",
    placement: "bottom",
    actionType: "view_path_complete",
    route: "/dashboard/path",
  },
];

export function getTutorialStepByAction(actionType: string): TutorialStep | undefined {
  return TUTORIAL_STEPS.find(step => step.actionType === actionType);
}
