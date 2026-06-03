import { Outlet, useLocation } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import GeminiFooter from "@/components/GeminiFooter";
import MobileBottomNav from "@/components/MobileBottomNav";

export default function AppLayout() {
  const { pathname } = useLocation();
  // Trip workspace has its own embedded ConciergePanel — avoid double UI.
  const hideFloatingConcierge = pathname.startsWith("/trip/");
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      {/* Add bottom padding on mobile so the fixed bottom nav doesn't overlap content */}
      <main className="flex-1 pb-safe-nav sm:pb-0">
        <Outlet />
      </main>
      {!hideFloatingConcierge && <GeminiFooter />}
      <MobileBottomNav />
    </div>
  );
}
