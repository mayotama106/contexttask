import { Capacitor } from "@capacitor/core";

/**
 * Native shell wiring. Every call is guarded so the same bundle still runs as a
 * plain web page in the browser during development.
 *
 * Status-bar style and the launch background are set declaratively in
 * ios/App/App/Info.plist and the LaunchScreen storyboard rather than through
 * @capacitor/status-bar + @capacitor/splash-screen: those plugins' current
 * releases do not compile against Capacitor core 8.5 (renamed Swift APIs), and
 * they were only doing cosmetic work here.
 */
export const isNative = (): boolean => Capacitor.isNativePlatform();

export async function initNativeShell(): Promise<void> {
  if (!isNative()) return;

  const { Keyboard } = await import("@capacitor/keyboard");
  // The accessory bar steals vertical space and does not match the Deep Mist tone.
  await Keyboard.setAccessoryBarVisible({ isVisible: false });
}
