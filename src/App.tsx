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
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import TripWorkspace from "./pages/TripWorkspace";
import Studio from "./pages/Studio";
import Tools from "./pages/Tools";
import Today from "./pages/Today";
import Network from "./pages/Network";
import NetworkUserProfile from "./pages/NetworkUserProfile";
import NetworkUserTrip from "./pages/NetworkUserTrip";
import NotFound from "./pages/NotFound";
import PublicTripView from "./pages/PublicTripView";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
