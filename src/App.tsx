import { useEffect } from "react";
import { MobileDashboard } from "./screens/MobileDashboard";
import { DesktopDashboard } from "./screens/DesktopDashboard";
import { useTaskStore } from "./features/tasks/store";
import { startObsidianSync } from "./features/sync/obsidianSync";
import { useMediaQuery } from "./lib/useClock";
import { initNativeShell, isNative } from "./lib/native";
import { useTaggerStore } from "./features/capture/taggerSelection";

export function App() {
  const hydrate = useTaskStore((s) => s.hydrate);
  const hydrated = useTaskStore((s) => s.hydrated);
  // On the phone the mobile dashboard is the app, regardless of viewport.
  const wideViewport = useMediaQuery("(min-width: 900px)");
  const isDesktop = wideViewport && !isNative();

  useEffect(() => {
    void initNativeShell();
    // Pick the tagger before hydrate resumes any queued jobs.
    void useTaggerStore.getState().load().then(hydrate);
    // No vault adapter is wired — see obsidianSync.ts.
    return startObsidianSync();
  }, [hydrate]);

  // Nothing renders before the local DB is read — it takes a frame or two, and
  // showing a spinner here would contradict the product's instant-save promise.
  if (!hydrated) return null;

  return isDesktop ? <DesktopDashboard /> : <MobileDashboard />;
}
