import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, Pressable } from 'react-native';
// LongPressMenu uses native TouchableOpacity for compatibility

interface MenuOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: React.ReactNode;
}

interface LongPressMenuProps {
  children: React.ReactNode;
  options: MenuOption[];
  disabled?: boolean;
  delay?: number;
}

export default function LongPressMenu({
  children,
  options,
  disabled = false,
  delay = 500,
}: LongPressMenuProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPress = (event: any) => {
    if (disabled || options.length === 0) return;

    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ x: pageX, y: pageY });
    setMenuVisible(true);
  };

  const handlePressIn = () => {
    if (disabled || options.length === 0) return;
    
    longPressTimer.current = setTimeout(() => {
      // Trigger haptic feedback on long press
      // This will be handled by the parent component if needed
      handleLongPress({ nativeEvent: { pageX: 0, pageY: 0 } });
    }, delay);
  };

  const handlePressOut = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const closeMenu = () => {
    setMenuVisible(false);
  };

  const handleOptionPress = (option: MenuOption) => {
    option.onPress();
    closeMenu();
  };

  return (
    <>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
        disabled={disabled}
      >
        {children}
      </TouchableOpacity>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.overlay} onPress={closeMenu}>
          <View
            style={[
              styles.menu,
              {
                top: menuPosition.y,
                left: menuPosition.x,
              },
            ]}
          >
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuItem,
                  option.destructive && styles.menuItemDestructive,
                ]}
                onPress={() => handleOptionPress(option)}
              >
                {option.icon && <View style={styles.iconContainer}>{option.icon}</View>}
                <Text
                  style={[
                    styles.menuItemText,
                    option.destructive && styles.menuItemTextDestructive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menu: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 4,
    minWidth: 150,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  menuItemDestructive: {
    backgroundColor: '#FEF2F2',
  },
  iconContainer: {
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  menuItemTextDestructive: {
    color: '#DC2626',
  },
});

