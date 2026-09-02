"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type PhotoAudioStoryContextValue = {
  activeStoryId: string | null;
  claimStory: (storyId: string) => void;
  releaseStory: (storyId: string) => void;
};

const PhotoAudioStoryContext = createContext<PhotoAudioStoryContextValue | null>(null);

export function PhotoAudioStoryProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);

  useEffect(() => {
    setActiveStoryId(null);
  }, [pathname]);

  const claimStory = useCallback((storyId: string) => {
    setActiveStoryId(storyId);
  }, []);

  const releaseStory = useCallback((storyId: string) => {
    setActiveStoryId((current) => (current === storyId ? null : current));
  }, []);

  const value = useMemo<PhotoAudioStoryContextValue>(
    () => ({ activeStoryId, claimStory, releaseStory }),
    [activeStoryId, claimStory, releaseStory],
  );

  return <PhotoAudioStoryContext.Provider value={value}>{children}</PhotoAudioStoryContext.Provider>;
}

export function usePhotoAudioStoryPlayback(): PhotoAudioStoryContextValue {
  const context = useContext(PhotoAudioStoryContext);
  if (!context) {
    throw new Error("usePhotoAudioStoryPlayback must be used within PhotoAudioStoryProvider");
  }
  return context;
}
