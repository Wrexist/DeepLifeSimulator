import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  velocityX: number;
  velocityY: number;
  rotation: number;
  scale: number;
  opacity: number;
}

interface ParticleEffectsProps {
  visible: boolean;
  type?: 'confetti' | 'coins' | 'hearts' | 'stars';
  duration?: number;
  particleCount?: number;
  onComplete?: () => void;
}

export default function ParticleEffects({
  visible,
  type = 'confetti',
  duration = 2000,
  particleCount = 50,
  onComplete,
}: ParticleEffectsProps) {
  const particles = useRef<Particle[]>([]);
  const animations = useRef<Animated.Value[]>([]);

  const getParticleConfig = (type: string) => {
    switch (type) {
      case 'confetti':
        return {
          colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'],
          shapes: ['square', 'circle'],
        };
      case 'coins':
        return {
          colors: ['#FFD700', '#FFA500', '#FF8C00'],
          shapes: ['circle'],
        };
      case 'hearts':
        return {
          colors: ['#FF69B4', '#FF1493', '#DC143C'],
          shapes: ['heart'],
        };
      case 'stars':
        return {
          colors: ['#FFD700', '#FFA500', '#FF8C00', '#FF6347'],
          shapes: ['star'],
        };
      default:
        return {
          colors: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
          shapes: ['circle'],
        };
    }
  };

  const createParticle = (index: number): Particle => {
    const config = getParticleConfig(type);
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    
    return {
      id: index,
      x: Math.random() * screenWidth,
      y: -50,
      size: Math.random() * 8 + 4,
      color,
      velocityX: (Math.random() - 0.5) * 4,
      velocityY: Math.random() * 3 + 2,
      rotation: Math.random() * 360,
      scale: Math.random() * 0.5 + 0.5,
      opacity: Math.random() * 0.5 + 0.5,
    };
  };

  useEffect(() => {
    if (visible) {
      // Create particles
      particles.current = Array.from({ length: particleCount }, (_, index) => 
        createParticle(index)
      );

      // Create animations
      animations.current = particles.current.map(() => new Animated.Value(0));

      // Start animations
      const animationPromises = animations.current.map((anim, index) => {
        return new Promise<void>((resolve) => {
          Animated.timing(anim, {
            toValue: 1,
            duration: duration + Math.random() * 1000,
            useNativeDriver: true,
          }).start(() => resolve());
        });
      });

      Promise.all(animationPromises).then(() => {
        onComplete?.();
      });
    } else {
      // Reset particles
      particles.current = [];
      animations.current.forEach(anim => anim.setValue(0));
    }
  }, [visible, type, duration, particleCount, onComplete]);

  if (!visible || particles.current.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.current.map((particle, index) => {
        const anim = animations.current[index];
        if (!anim) return null;

        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [particle.y, particle.y + screenHeight + 100],
        });

        const translateX = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [particle.x, particle.x + particle.velocityX * 100],
        });

        const rotate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [`${particle.rotation}deg`, `${particle.rotation + 360}deg`],
        });

        const opacity = anim.interpolate({
          inputRange: [0, 0.1, 0.9, 1],
          outputRange: [0, particle.opacity, particle.opacity, 0],
        });

        return (
          <Animated.View
            key={particle.id}
            style={[
              styles.particle,
              {
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
                borderRadius: type === 'coins' ? particle.size / 2 : 2,
                transform: [
                  { translateX },
                  { translateY },
                  { rotate },
                  { scale: particle.scale },
                ],
                opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// Predefined particle effect components
export function ConfettiEffect({ visible, onComplete }: { visible: boolean; onComplete?: () => void }) {
  return (
    <ParticleEffects
      visible={visible}
      type="confetti"
      duration={2000}
      particleCount={60}
      onComplete={onComplete}
    />
  );
}

export function CoinEffect({ visible, onComplete }: { visible: boolean; onComplete?: () => void }) {
  return (
    <ParticleEffects
      visible={visible}
      type="coins"
      duration={1500}
      particleCount={30}
      onComplete={onComplete}
    />
  );
}

export function HeartEffect({ visible, onComplete }: { visible: boolean; onComplete?: () => void }) {
  return (
    <ParticleEffects
      visible={visible}
      type="hearts"
      duration={1800}
      particleCount={20}
      onComplete={onComplete}
    />
  );
}

export function StarEffect({ visible, onComplete }: { visible: boolean; onComplete?: () => void }) {
  return (
    <ParticleEffects
      visible={visible}
      type="stars"
      duration={2200}
      particleCount={40}
      onComplete={onComplete}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  particle: {
    position: 'absolute',
  },
});
