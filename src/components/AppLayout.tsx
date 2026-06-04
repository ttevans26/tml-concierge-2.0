import { Outlet, useLocation } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import GeminiFooter from "@/components/GeminiFooter";
import MobileBottomNav from "@/components/MobileBottomNav";
import AppErrorBoundary from "@/components/AppErrorBoundary";

export default function AppLayout() {
  const { pathname } = useLocation();
  // Trip workspace has its own embedded ConciergePanel — avoid double UI.
  const hideFloatingConcierge = pathname.startsWith("/trip/");
  return (
    <div className="flex min-h-screen flex-col bg-surface-1">
      {/* Skip-to-content for keyboard users (a11y). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-sm focus:bg-foreground focus:px-3 focus:py-2 focus:text-background"
      >
        Skip to content
      </a>
      <AppHeader />
      {/* Add bottom padding on mobile so the fixed bottom nav doesn't overlap content.
          Note: do NOT key on pathname — that unmounts the entire page tree on every
          navigation, blowing away component state and forcing every effect/fetch to
          rerun. Route components manage their own freshness via the trip store. */}
      <main
        id="main-content"
        className="flex-1 animate-editorial-in pb-safe-nav sm:pb-0"
      >
        {/* Route-level boundary: a crash inside one route does not white-screen
            the persistent header / bottom nav / concierge. */}
        <AppErrorBoundary>
          <Outlet />
        </AppErrorBoundary>
      </main>
      {!hideFloatingConcierge && <GeminiFooter />}
      <MobileBottomNav />
    </div>
  );
}
