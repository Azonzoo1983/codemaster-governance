import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface Shortcut {
  key: string;
  description: string;
  ctrl?: boolean;
  shift?: boolean;
}

export const SHORTCUTS: Shortcut[] = [
  { key: 'n', description: 'New Request' },
  { key: '/', description: 'Focus Search' },
  { key: 'Escape', description: 'Go Back / Close' },
  { key: '?', description: 'Show Keyboard Shortcuts', shift: true },
  { key: 'k', description: 'Open Global Search', ctrl: true },
  { key: 'h', description: 'Go to Dashboard' },
  { key: 'r', description: 'Go to Reports' },
  { key: 's', description: 'Save Draft (in form)', ctrl: true },
  { key: 'Enter', description: 'Submit Request (in form)', ctrl: true },
];

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        // Allow Escape in inputs
        if (e.key === 'Escape') {
          (target as HTMLInputElement).blur();
          return;
        }
        // Allow Ctrl+S and Ctrl+Enter through to registered handlers
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'Enter')) {
          // Don't block — let it fall through to handlers below
        } else {
          return;
        }
      }

      // Ctrl+K or Cmd+K — open global search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((prev) => !prev);
        return;
      }

      // Shift+? — show help
      if (e.shiftKey && e.key === '?') {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      // Don't trigger single-key shortcuts with modifier keys (except above)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      switch (e.key) {
        case 'n':
          e.preventDefault();
          navigate('/requests/new');
          break;
        case '/':
          e.preventDefault();
          // Focus the search input on the dashboard
          const searchInput = document.querySelector<HTMLInputElement>(
            'input[placeholder*="Search"], input[aria-label*="Search"]'
          );
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
          break;
        case 'Escape':
          setShowHelp(false);
          break;
        case 'h':
          navigate('/');
          break;
        case 'r':
          navigate('/reports');
          break;
      }
    },
    [navigate]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp, showSearch, setShowSearch };
}
