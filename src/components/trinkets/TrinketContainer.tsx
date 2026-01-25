'use client';

import { useEffect, useState } from 'react';
import { useTrinketStore } from '@/stores/trinket-store';
import { EmailSendingWidget } from './EmailSendingWidget';
import { EmailReceivedWidget } from './EmailReceivedWidget';
import { CalendarWidget } from './CalendarWidget';
import { ContactsWidget } from './ContactsWidget';
import styles from './trinkets.module.css';

export function TrinketContainer() {
  const { activeTrinket, isVisible, dismissActiveTrinket, markInteracted } = useTrinketStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle visibility animations
  useEffect(() => {
    if (isVisible && activeTrinket) {
      setShouldRender(true);
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      setIsAnimating(false);
      // Wait for exit animation before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 500); // Match CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [isVisible, activeTrinket]);

  const handleInteraction = () => {
    if (activeTrinket) {
      markInteracted(activeTrinket.id);
    }
  };

  const handleDismiss = () => {
    dismissActiveTrinket();
  };

  if (!shouldRender || !activeTrinket) {
    return null;
  }

  const renderWidget = () => {
    switch (activeTrinket.type) {
      case 'email-sending':
        return (
          <EmailSendingWidget
            trinket={activeTrinket}
            onDismiss={handleDismiss}
            onInteract={handleInteraction}
          />
        );
      case 'email-received':
        return (
          <EmailReceivedWidget
            trinket={activeTrinket}
            onDismiss={handleDismiss}
            onInteract={handleInteraction}
          />
        );
      case 'calendar':
        return (
          <CalendarWidget
            trinket={activeTrinket}
            onDismiss={handleDismiss}
            onInteract={handleInteraction}
          />
        );
      case 'contacts':
        return (
          <ContactsWidget
            trinket={activeTrinket}
            onDismiss={handleDismiss}
            onInteract={handleInteraction}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`${styles.container} ${isAnimating ? styles.visible : styles.hidden}`}>
      <div className={styles.trinketWrapper}>
        {renderWidget()}
      </div>
    </div>
  );
}
