import React from 'react';
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
 */
export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();

  return (
    <div key={location.pathname} className="animate-pageEnter">
      {children}
    </div>
  );
};
