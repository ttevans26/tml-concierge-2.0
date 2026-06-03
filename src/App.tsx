import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";

// Lazy-loaded routes — these chunks load on demand to keep first paint fast.
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const TripWorkspace = lazy(() => import("./pages/TripWorkspace"));
const Studio = lazy(() => import("./pages/Studio"));
const Tools = lazy(() => import("./pages/Tools"));
const Today = lazy(() => import("./pages/Today"));
const Network = lazy(() => import("./pages/Network"));
const NetworkUserProfile = lazy(() => import("./pages/NetworkUserProfile"));
const NetworkUserTrip = lazy(() => import("./pages/NetworkUserTrip"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicTripView = lazy(() => import("./pages/PublicTripView"));

const RouteFallback = () => (
  <div className="flex flex-1 items-center justify-center p-12">
    <div className="h-1 w-32 overflow-hidden rounded-full bg-foil-soft">
      <div className="h-full w-1/3 animate-pulse bg-foil" />
    </div>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/itinerary/:token" element={<PublicTripView />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Index />} />
                <Route path="/today" element={<Today />} />
                <Route path="/studio" element={<Studio />} />
                <Route path="/tools" element={<Tools />} />
                <Route path="/network" element={<Network />} />
                <Route path="/network/user/:id" element={<NetworkUserProfile />} />
                <Route path="/network/user/:id/trip/:tripId" element={<NetworkUserTrip />} />
                <Route path="/trip/:id" element={<TripWorkspace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
