import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
            const storedSettings = await AsyncStorage.getItem('settings');
            if (storedSettings) {
                setSettings({ ...defaultSettings, ...JSON.parse(storedSettings) });
            }
        } catch (error) {
            logger.error('Failed to load settings:', error);
        }
    };

    const updateSettings = async (newSettings: Partial<Settings>) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        try {
            await AsyncStorage.setItem('settings', JSON.stringify(updated));
        } catch (error) {
            logger.error('Failed to save settings:', error);
        }
    };

    const toggleDarkMode = async () => {
        await updateSettings({ darkMode: !settings.darkMode });
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, toggleDarkMode }}>
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
