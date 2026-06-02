import { Outlet } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import GeminiFooter from "@/components/GeminiFooter";
import MobileBottomNav from "@/components/MobileBottomNav";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      {/* Add bottom padding on mobile so the fixed bottom nav doesn't overlap content */}
      <main className="flex-1 pb-safe-nav sm:pb-0">
        <Outlet />
      </main>
      <GeminiFooter />
      <MobileBottomNav />
    </div>
  );
}
