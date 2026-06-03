import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { safeAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { logger } from '@/utils/logger';

interface Settings {
    darkMode: boolean;
    soundEnabled: boolean;
    notificationsEnabled: boolean;
    language: string;
}

interface SettingsContextType {
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
    toggleDarkMode: () => Promise<void>;
}

const defaultSettings: Settings = {
    darkMode: false,
    soundEnabled: true,
    notificationsEnabled: true,
    language: 'en',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<Settings>(defaultSettings);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            // safeAsyncStorage.getItem auto-parses JSON; returns null fallback if absent.
            const storedSettings = await AsyncStorage.getItem('settings', null);
            if (storedSettings && typeof storedSettings === 'object') {
                setSettings({ ...defaultSettings, ...storedSettings });
            }
        } catch (error) {
            logger.error('Failed to load settings:', error);
        }
    };

    const updateSettings = useCallback(async (newSettings: Partial<Settings>) => {
        setSettings((prev) => {
            const updated = { ...prev, ...newSettings };
            // safeAsyncStorage.setItem auto-stringifies — don't double-encode.
            void AsyncStorage.setItem('settings', updated).then((ok) => {
                if (!ok) logger.error('Failed to save settings');
            });
            return updated;
        });
    }, []);

    const toggleDarkMode = useCallback(async () => {
        await updateSettings({ darkMode: !settings.darkMode });
    }, [settings.darkMode, updateSettings]);

    // Memoize the context value — SettingsProvider is the outermost provider, so
    // a fresh value object every render cascades to the entire tree.
    const contextValue = useMemo(
        () => ({ settings, updateSettings, toggleDarkMode }),
        [settings, updateSettings, toggleDarkMode]
    );

    return (
        <SettingsContext.Provider value={contextValue}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
