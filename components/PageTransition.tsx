import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * Wraps page content with a subtle fade + upward slide animation.
 * Uses `location.pathname` as the React key so the entrance animation
 * re-triggers on every route change. The animation is purely
 * transform/opacity based, so it won't cause layout shifts and is
 * fully dark-mode compatible.
 *
 * Also scrolls the main content area to the top on every navigation.
 */
export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    // Try the main scrollable container first, then window
    const main = document.getElementById('main-content');
    if (main) {
      main.scrollTo({ top: 0 });
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [location.pathname]);

  return (
    <div key={location.pathname} className="animate-pageEnter">
      {children}
    </div>
  );
};
