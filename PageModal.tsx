import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, useWindowDimensions } from 'react-native';

export function PageModal({ visible, onRequestClose, children }: {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const offset = useRef(new Animated.Value(width)).current;
  const [presented, setPresented] = useState(visible);

  useEffect(() => {
    let active = true;
    if (visible) {
      setPresented(true);
      offset.setValue(width);
    }
    const animate = (reduceMotion: boolean) => {
      if (!active) return;
      Animated.timing(offset, {
        toValue: visible ? 0 : width,
        duration: reduceMotion ? 0 : 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (active && finished && !visible) setPresented(false);
      });
    };
    AccessibilityInfo.isReduceMotionEnabled().then(animate).catch(() => animate(false));
    return () => { active = false; offset.stopAnimation(); };
  }, [visible, width, offset]);

  return <Modal visible={visible || presented} transparent animationType="none" onRequestClose={onRequestClose}>
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={{ flex: 1, transform: [{ translateX: offset }] }}>
      {children}
    </Animated.View>
  </Modal>;
}
