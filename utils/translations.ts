import en from './locales/en';

export const translations = {
    English: en,
};

export type Language = keyof typeof translations;

export function t(language: Language = 'English', key: string): string {
    const currentTranslations = translations[language] || translations['English'];

    const keys = key.split('.');
    let value: any = currentTranslations;

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return key; // Return key if not found
        }
    }

    return typeof value === 'string' ? value : key;
}
