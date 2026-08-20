import { useState, useEffect, useCallback } from 'react';

export type Platform = 'android' | 'ios' | 'desktop' | 'other';

export interface InstallPromptState {
  platform: Platform;
  isStandalone: boolean;
  canInstall: boolean;       // native prompt available (beforeinstallprompt captured)
  hasUserDismissed: boolean; // user hid the banner this session
}

const DISMISS_KEY = '0xagent-install-banner-dismissed';

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && (navigator.maxTouchPoints > 1 || 'ontouchend' in window));
  const isAndroid = /android/i.test(ua);
  if (isIos) return 'ios';
  if (isAndroid) return 'android';
  if (typeof window !== 'undefined' && window.innerWidth < 768) return 'android';
  return 'desktop';
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mm = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (window.navigator as any).standalone === true;
  return mm || iosStandalone;
}

export function useInstallPrompt() {
  const [platform, setPlatform] = useState<Platform>(detectPlatform);
  const [isStandaloneMode, setIsStandaloneMode] = useState<boolean>(isStandalone);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [hasUserDismissed, setHasUserDismissed] = useState<boolean>(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1'
  );

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsStandaloneMode(isStandalone());

    const onBeforeInstallPrompt = (e: Event) => {
      // Chrome/Android/Edge fires this on HTTPS or localhost
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const onAppInstalled = () => {
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
      setDeferredPrompt(null);
      setIsStandaloneMode(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as any);
    window.addEventListener('appinstalled', onAppInstalled as any);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as any);
      window.removeEventListener('appinstalled', onAppInstalled as any);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setDeferredPrompt(null);
        }
        return true;
      } catch (err) {
        console.warn('[PWA] Error launching native prompt:', err);
      }
    }
    // No native prompt available (iOS or LAN HTTP) -> Return false so caller opens visual guide
    return false;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setHasUserDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  }, []);

  const reopen = useCallback(() => {
    setHasUserDismissed(false);
    try { localStorage.removeItem(DISMISS_KEY); } catch {}
  }, []);

  return {
    platform,
    isStandalone: isStandaloneMode,
    canInstall: !!deferredPrompt && !isStandaloneMode,
    hasUserDismissed,
    install,
    dismiss,
    reopen,
  };
}

export type UseInstallPrompt = ReturnType<typeof useInstallPrompt>;
