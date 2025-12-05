"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TutorialStep, getTutorialStepByAction } from "@/lib/journey/tutorial-steps";
import { TutorialOverlay } from "./TutorialOverlay";

interface TutorialContextType {
  activeStep: TutorialStep | null;
  showTutorial: (actionType: string) => void;
  hideTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
}

interface TutorialProviderProps {
  children: React.ReactNode;
}

export function TutorialProvider({ children }: TutorialProviderProps) {
  const [activeStep, setActiveStep] = useState<TutorialStep | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const hideTutorial = () => {
    setActiveStep(null);
  };

  // Hide tutorial on navigation, unless the new route has a tutorial param
  useEffect(() => {
    const tutorialParam = searchParams.get("tutorial");
    if (!tutorialParam) {
        hideTutorial();
    }
  }, [pathname, searchParams]);

  // Check for tutorial param on mount/update
  useEffect(() => {
    const tutorialParam = searchParams.get("tutorial");
    if (tutorialParam) {
      const step = getTutorialStepByAction(tutorialParam);
      if (step) {
        // If we are on the correct route (or no route specified), show it
        if (!step.route || step.route === pathname) {
            setActiveStep(step);
            // Clean up URL
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete("tutorial");
            router.replace(`${pathname}?${newParams.toString()}`);
        }
      }
    }
  }, [searchParams, pathname, router]);

  const showTutorial = (actionType: string) => {
    const step = getTutorialStepByAction(actionType);
    if (step) {
      // If step requires a specific route and we are not there, navigate
      if (step.route && step.route !== pathname) {
        router.push(`${step.route}?tutorial=${actionType}`);
      } else {
        setActiveStep(step);
      }
    } else {
      console.warn(`No tutorial step found for action: ${actionType}`);
    }
  };

  return (
    <TutorialContext.Provider
      value={{
        activeStep,
        showTutorial,
        hideTutorial,
      }}
    >
      {children}
      {activeStep && <TutorialOverlay />}
    </TutorialContext.Provider>
  );
}
