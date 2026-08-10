import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lifequest.contexttask",
  appName: "ContextTask",
  webDir: "dist",
  ios: {
    // The Deep Mist canvas must extend under the status bar and home indicator;
    // the layout reserves those insets itself via env(safe-area-inset-*).
    contentInset: "never",
    backgroundColor: "#08080f",
  },
  plugins: {
    Keyboard: {
      // Shrink the WebView so the capture dock rides above the keyboard —
      // 100dvh then resolves to the visible area instead of the full screen.
      resize: "native",
      style: "dark",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
