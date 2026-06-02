import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.693f38f0fd12468791b16036a995ed65",
  appName: "TML Concierge",
  webDir: "dist",
  server: {
    url: "https://693f38f0-fd12-4687-91b1-6036a995ed65.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#FDFCF8",
      showSpinner: false,
    },
  },
};

export default config;