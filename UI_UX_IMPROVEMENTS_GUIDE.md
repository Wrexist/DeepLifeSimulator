# UI/UX Improvements Guide

This guide explains how to use the new UI/UX improvements implemented in DeeplifeSim.

## Overview

The following improvements have been added to enhance user experience:

1. **Loading States** - Visual feedback for all operations
2. **Error Handling** - User-friendly error messages with different severity levels
3. **Confirmation Dialogs** - Enhanced confirmation dialogs for important actions
4. **Tutorial System** - Comprehensive tutorial for new users

## Components

### 1. LoadingSpinner

A versatile loading component with multiple variants.

```tsx
import { useLoading } from '@/contexts/UIUXContext';
import LoadingSpinner from '@/components/LoadingSpinner';

function MyComponent() {
  const { showLoading, hideLoading, isLoading } = useLoading();

  const handleAsyncOperation = async () => {
    showLoading('save-game', 'Saving your progress...', 'overlay');
    
    try {
      await saveGame();
    } finally {
      hideLoading('save-game');
    }
  };

  return (
    <View>
      {/* Your content */}
      <LoadingSpinner 
        visible={isLoading('save-game')}
        message="Saving..."
        variant="overlay"
      />
    </View>
  );
}
```

**Variants:**
- `default` - Centered loading spinner
- `overlay` - Full-screen overlay with background
- `inline` - Inline loading within content

### 2. ErrorMessage

User-friendly error messages with different severity levels.

```tsx
import { useError } from '@/contexts/UIUXContext';

function MyComponent() {
  const { showError, showInfo, showWarning, hideError } = useError();

  const handleOperation = async () => {
    try {
      await riskyOperation();
    } catch (error) {
      showError('operation-failed', 'Failed to complete operation', 'error', 'Error', () => {
        // Retry function
        handleOperation();
      });
    }
  };

  // Show info message
  showInfo('welcome', 'Welcome to the game!');

  // Show warning
  showWarning('low-energy', 'Your energy is getting low');
}
```

**Severity Levels:**
- `info` - Blue, auto-dismisses
- `warning` - Yellow
- `error` - Red
- `critical` - Red with support option

### 3. ConfirmDialog

Enhanced confirmation dialogs with different types and icons.

```tsx
import ConfirmDialog from '@/components/ConfirmDialog';

function MyComponent() {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <View>
      <TouchableOpacity onPress={() => setShowConfirm(true)}>
        <Text>Delete Account</Text>
      </TouchableOpacity>

      <ConfirmDialog
        visible={showConfirm}
        title="Delete Account"
        message="This action cannot be undone. All your data will be permanently deleted."
        type="danger"
        showIcon={true}
        destructive={true}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {
          deleteAccount();
          setShowConfirm(false);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </View>
  );
}
```

**Types:**
- `default` - Blue theme
- `warning` - Yellow theme
- `danger` - Red theme
- `success` - Green theme

### 4. Tutorial System

Comprehensive tutorial system for new users.

```tsx
import { useTutorial } from '@/contexts/UIUXContext';
import { getTutorialSteps } from '@/utils/tutorialData';

function MyComponent() {
  const { 
    startTutorial, 
    completeTutorial, 
    skipTutorial, 
    hasCompletedTutorial 
  } = useTutorial();

  const showGameTutorial = () => {
    startTutorial(getTutorialSteps('game'));
  };

  const showOnboardingTutorial = () => {
    startTutorial(getTutorialSteps('onboarding'));
  };

  const showAdvancedTutorial = () => {
    startTutorial(getTutorialSteps('advanced'));
  };

  return (
    <View>
      <TouchableOpacity onPress={showGameTutorial}>
        <Text>Show Tutorial</Text>
      </TouchableOpacity>
    </View>
  );
}
```

## Context Usage

### UIUXContext

The main context that manages all UI/UX state.

```tsx
import { useUIUX } from '@/contexts/UIUXContext';

function MyComponent() {
  const {
    // Loading
    showLoading,
    hideLoading,
    isLoading,
    
    // Error handling
    showError,
    hideError,
    showInfo,
    showWarning,
    
    // Tutorial
    startTutorial,
    completeTutorial,
    skipTutorial,
    hasCompletedTutorial,
  } = useUIUX();

  // Use the functions as needed
}
```

### Convenience Hooks

For specific use cases, use the convenience hooks:

```tsx
import { useLoading, useError, useTutorial } from '@/contexts/UIUXContext';

function MyComponent() {
  const { showLoading, hideLoading } = useLoading();
  const { showError, showInfo } = useError();
  const { startTutorial } = useTutorial();
}
```

## Best Practices

### 1. Loading States

- Use unique IDs for each loading operation
- Always hide loading states in finally blocks
- Use appropriate variants based on context

```tsx
const handleSave = async () => {
  showLoading('save-operation', 'Saving...', 'overlay');
  
  try {
    await saveData();
    showInfo('save-success', 'Data saved successfully!');
  } catch (error) {
    showError('save-failed', 'Failed to save data', 'error');
  } finally {
    hideLoading('save-operation');
  }
};
```

### 2. Error Handling

- Provide meaningful error messages
- Include retry functionality when appropriate
- Use appropriate severity levels

```tsx
const handleNetworkOperation = async () => {
  try {
    await fetchData();
  } catch (error) {
    showError(
      'network-error',
      'Unable to connect to server. Please check your internet connection.',
      'error',
      'Connection Error',
      () => handleNetworkOperation() // Retry function
    );
  }
};
```

### 3. Confirmation Dialogs

- Use for destructive or irreversible actions
- Provide clear, descriptive messages
- Use appropriate types and icons

```tsx
const handleDelete = () => {
  setShowDeleteConfirm(true);
};

<ConfirmDialog
  visible={showDeleteConfirm}
  title="Delete Item"
  message="Are you sure you want to delete this item? This action cannot be undone."
  type="danger"
  showIcon={true}
  destructive={true}
  confirmText="Delete"
  onConfirm={() => {
    deleteItem();
    setShowDeleteConfirm(false);
  }}
  onCancel={() => setShowDeleteConfirm(false)}
/>
```

### 4. Tutorial System

- Show tutorials for new users automatically
- Provide manual tutorial access in settings
- Use appropriate tutorial contexts

```tsx
// Auto-show for new users
useEffect(() => {
  if (!hasCompletedTutorial && isNewUser) {
    startTutorial(getTutorialSteps('game'));
  }
}, [hasCompletedTutorial, isNewUser]);

// Manual tutorial access
const showTutorial = () => {
  startTutorial(getTutorialSteps('game'));
};
```

## Integration Examples

### Game Save Operation

```tsx
const handleSaveGame = async () => {
  showLoading('save-game', 'Saving your progress...', 'overlay');
  
  try {
    await saveGameToStorage();
    showInfo('save-success', 'Game saved successfully!');
  } catch (error) {
    showError(
      'save-failed',
      'Failed to save game. Please try again.',
      'error',
      'Save Error',
      handleSaveGame
    );
  } finally {
    hideLoading('save-game');
  }
};
```

### Purchase Confirmation

```tsx
const handlePurchase = (item) => {
  setShowPurchaseConfirm({
    visible: true,
    item,
    cost: item.price,
  });
};

<ConfirmDialog
  visible={showPurchaseConfirm.visible}
  title="Confirm Purchase"
  message={`Are you sure you want to buy ${showPurchaseConfirm.item?.name} for $${showPurchaseConfirm.cost}?`}
  type="default"
  showIcon={true}
  confirmText="Buy"
  onConfirm={() => {
    purchaseItem(showPurchaseConfirm.item);
    setShowPurchaseConfirm({ visible: false });
  }}
  onCancel={() => setShowPurchaseConfirm({ visible: false })}
/>
```

### Tutorial Integration

```tsx
// In main game screen
useEffect(() => {
  if (!hasCompletedTutorial && gameState.week === 1) {
    const timer = setTimeout(() => {
      startTutorial(getTutorialSteps('game'));
    }, 1000);
    
    return () => clearTimeout(timer);
  }
}, [hasCompletedTutorial, gameState.week]);

// In settings
const showTutorial = () => {
  startTutorial(getTutorialSteps('game'));
  onClose();
};
```

## Customization

### Adding New Tutorial Steps

```tsx
// In utils/tutorialData.ts
export const CUSTOM_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'custom-feature',
    title: 'Custom Feature',
    description: 'This is how to use the custom feature...',
    position: 'center',
  },
];

// Usage
startTutorial(CUSTOM_TUTORIAL_STEPS);
```

### Custom Error Messages

```tsx
// Create custom error handling
const handleCustomError = (error) => {
  if (error.type === 'network') {
    showError('network-error', 'Network connection lost', 'error');
  } else if (error.type === 'validation') {
    showWarning('validation-error', 'Please check your input', 'warning');
  } else {
    showError('unknown-error', 'An unexpected error occurred', 'critical');
  }
};
```

## Troubleshooting

### Common Issues

1. **Loading state not hiding**: Ensure `hideLoading` is called in finally block
2. **Tutorial not showing**: Check if `hasCompletedTutorial` is false
3. **Error messages not appearing**: Verify the error ID is unique
4. **Confirmation dialog not working**: Check if `visible` prop is properly managed

### Debug Tips

- Use console.log to track loading state changes
- Check AsyncStorage for tutorial completion status
- Verify context providers are properly wrapped
- Ensure all imports are correct

## Performance Considerations

- Loading states are optimized with minimal re-renders
- Error messages auto-dismiss when appropriate
- Tutorial data is loaded only when needed
- Context updates are batched for better performance

This guide covers all the major UI/UX improvements. For specific implementation details, refer to the component source code and context implementations.
