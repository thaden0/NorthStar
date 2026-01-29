'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { SiteSettings } from '@prisma/client';
import { updateSetting } from '@/server/settings/actions';

interface SettingsContextType {
  settings: SiteSettings | null;
  isLoading: boolean;
  updateSettingValue: <K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K]
  ) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

interface SettingsProviderProps {
  children: ReactNode;
  initialSettings: SiteSettings | null;
}

export function SettingsProvider({ children, initialSettings }: SettingsProviderProps) {
  const [settings, setSettings] = useState<SiteSettings | null>(initialSettings);
  const [isLoading, setIsLoading] = useState(false);

  // Apply settings to DOM
  useEffect(() => {
    if (!settings) return;

    const root = document.documentElement;

    // 1. Apply Theme
    let effectiveTheme: 'dark' | 'light' = 'dark';
    if (settings.theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = systemDark ? 'dark' : 'light';
    } else {
      effectiveTheme = settings.theme as 'dark' | 'light';
    }
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add(`theme-${effectiveTheme}`);
    root.setAttribute('data-theme', effectiveTheme);

    // 2. Apply Accent Color
    root.style.setProperty('--accent-color', settings.accentColor);
    root.style.setProperty('--blue-electric', settings.accentColor);
    // Calculate hover/glow variants
    root.style.setProperty('--shadow-glow-accent', `0 0 20px ${settings.accentColor}66`);

    // 3. Apply Animations setting
    if (settings.enableAnimations) {
      root.classList.remove('no-animations');
    } else {
      root.classList.add('no-animations');
    }

    // 4. Apply Compact Mode
    if (settings.compactMode) {
      root.classList.add('compact-mode');
    } else {
      root.classList.remove('compact-mode');
    }

    // 5. Apply Sidebar Collapsed preference (stored in localStorage for persistence)
    if (settings.sidebarCollapsed) {
      localStorage.setItem('sidebar-collapsed', 'true');
    } else {
      localStorage.removeItem('sidebar-collapsed');
    }

  }, [settings]);

  // Listen for system theme changes
  useEffect(() => {
    if (!settings || settings.theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      const effectiveTheme = e.matches ? 'dark' : 'light';
      root.classList.remove('theme-dark', 'theme-light');
      root.classList.add(`theme-${effectiveTheme}`);
      root.setAttribute('data-theme', effectiveTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings]);

  const updateSettingValue = useCallback(async <K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K]
  ) => {
    if (!settings) return;

    setIsLoading(true);
    
    // Optimistic update
    setSettings((prev: SiteSettings | null) => prev ? { ...prev, [key]: value } : null);
    
    try {
      const result = await updateSetting(
        key as keyof Omit<SiteSettings, 'id' | 'createdAt' | 'updatedAt'>,
        value as string | number | boolean | null
      );
      
      if (!result.success) {
        // Revert on error
        setSettings(initialSettings);
        console.error('Failed to update setting:', result.error);
      }
    } catch (error) {
      setSettings(initialSettings);
      console.error('Failed to update setting:', error);
    } finally {
      setIsLoading(false);
    }
  }, [settings, initialSettings]);

  const contextValue = useMemo(() => ({
    settings,
    isLoading,
    updateSettingValue,
  }), [settings, isLoading, updateSettingValue]);

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}
