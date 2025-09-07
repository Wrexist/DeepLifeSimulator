# Translation System Guide

## Overview

DeeplifeSim now supports multiple languages through a comprehensive translation system. The game currently supports:

- **English** (default)
- **Svenska** (Swedish)
- **Español** (Spanish)
- **Français** (French)
- **Deutsch** (German)

## Architecture

### Core Files

1. **`utils/translations.ts`** - Main translation data and utilities
2. **`hooks/useTranslation.ts`** - React hook for easy translation access
3. **`components/SettingsModal.tsx`** - Language selection UI
4. **`contexts/GameContext.tsx`** - Language setting storage

### Translation Structure

The translation system uses a nested object structure with dot notation for accessing translations:

```typescript
interface TranslationKeys {
  settings: {
    title: string;
    darkMode: string;
    // ... more settings
  };
  game: {
    week: string;
    age: string;
    // ... more game UI
  };
  // ... more categories
}
```

## Usage

### Basic Translation

```typescript
import { useTranslation } from '@/hooks/useTranslation';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <Text>{t('settings.title')}</Text>
  );
}
```

### Translation Function

```typescript
import { t } from '@/utils/translations';

// Direct translation (requires language parameter)
const translatedText = t('English', 'settings.title');
```

## Adding New Translations

### 1. Add Translation Keys

Add new keys to the `TranslationKeys` interface in `utils/translations.ts`:

```typescript
interface TranslationKeys {
  // ... existing keys
  newSection: {
    newKey: string;
    anotherKey: string;
  };
}
```

### 2. Add Translations for All Languages

Add the actual translations for each language:

```typescript
const translations: Record<Language, TranslationKeys> = {
  English: {
    // ... existing translations
    newSection: {
      newKey: 'English text',
      anotherKey: 'More English text',
    },
  },
  Svenska: {
    // ... existing translations
    newSection: {
      newKey: 'Svensk text',
      anotherKey: 'Mer svensk text',
    },
  },
  // ... repeat for all languages
};
```

### 3. Use in Components

```typescript
const { t } = useTranslation();
<Text>{t('newSection.newKey')}</Text>
```

## Language Categories

### Settings (`settings.*`)
- UI settings and preferences
- Language selection
- Game configuration options

### Main Menu (`mainMenu.*`)
- Main menu buttons and descriptions
- Continue, New Game, Settings options

### Game UI (`game.*`)
- Core game interface elements
- Stats, buttons, labels
- Character information

### Tabs (`tabs.*`)
- Navigation tab labels
- Home, Work, Market, etc.

### Work (`work.*`)
- Work screen elements
- Job categories, buttons, descriptions

### Market (`market.*`)
- Market interface elements
- Buy/sell actions, prices, quantities

### Computer (`computer.*`)
- Computer screen elements
- Terminal, apps, actions

### Mobile (`mobile.*`)
- Mobile phone interface
- Apps, banking, social features

### Jail (`jail.*`)
- Jail/prison interface
- Activities, bail, time remaining

### Common (`common.*`)
- Reusable UI elements
- Buttons, confirmations, errors

### Tutorial (`tutorial.*`)
- Tutorial system text
- Welcome messages, navigation

## Best Practices

### 1. Consistent Naming
- Use descriptive, hierarchical keys
- Group related translations together
- Use camelCase for key names

### 2. Context-Aware Translations
- Consider cultural differences
- Adapt idioms and expressions
- Maintain consistent tone across languages

### 3. Testing
- Test all languages thoroughly
- Check for text overflow in different languages
- Verify UI layout with longer/shorter translations

### 4. Fallback Handling
- The system falls back to English if a translation is missing
- Missing keys return the key name as a fallback
- Always provide English translations first

## Adding a New Language

### 1. Update Language Type

Add the new language to the `Language` type:

```typescript
export type Language = 'English' | 'Svenska' | 'Español' | 'Français' | 'Deutsch' | 'NewLanguage';
```

### 2. Add Language to Settings

Update the languages array in `SettingsModal.tsx`:

```typescript
const languages = ['English', 'Svenska', 'Español', 'Français', 'Deutsch', 'NewLanguage'];
```

### 3. Add Complete Translation Set

Add a complete translation object for the new language in `utils/translations.ts`:

```typescript
NewLanguage: {
  settings: { /* all settings translations */ },
  game: { /* all game translations */ },
  // ... all other categories
},
```

### 4. Test Thoroughly

- Test all screens and features
- Verify text fits in UI elements
- Check for cultural appropriateness

## Current Implementation Status

### ✅ Completed
- Core translation system
- Language selection in settings
- Main menu translations
- Settings modal translations
- Identity card translations
- Tab navigation translations
- Work screen basic translations

### 🔄 In Progress
- Work screen detailed translations
- Market screen translations
- Computer screen translations
- Mobile screen translations
- Jail screen translations
- Tutorial system translations

### 📋 Planned
- Error message translations
- Achievement translations
- Event system translations
- Dynamic content translations
- Number formatting per locale
- Date/time formatting per locale

## Technical Notes

### Performance
- Translations are loaded once and cached
- No runtime translation file loading
- Minimal performance impact

### Type Safety
- TypeScript ensures translation key existence
- Compile-time checking for missing translations
- IntelliSense support for translation keys

### Maintainability
- Centralized translation management
- Easy to add new languages
- Clear separation of concerns

## Troubleshooting

### Missing Translation
If you see a translation key instead of translated text:
1. Check if the key exists in `TranslationKeys` interface
2. Verify the key is added to all language objects
3. Ensure the key is being used correctly in components

### Language Not Changing
If language selection doesn't work:
1. Check if the language is added to the `Language` type
2. Verify the language is in the settings languages array
3. Ensure the language has complete translations

### UI Layout Issues
If text doesn't fit properly:
1. Test with longer translations (German often has longer text)
2. Adjust UI component sizing
3. Consider using responsive text sizing

## Future Enhancements

### Planned Features
- **Dynamic Content Translation**: Translate game events and stories
- **Locale-Specific Formatting**: Numbers, dates, currencies
- **RTL Language Support**: Right-to-left languages like Arabic
- **Translation Management System**: Web interface for translators
- **Auto-Detection**: Detect device language on first launch

### Community Contributions
- Translation files can be easily shared and updated
- Clear guidelines for community translators
- Version control for translation updates
