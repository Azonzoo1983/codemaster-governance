import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { onQueueChange, processQueue } from '../lib/offlineQueue';

export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    return onQueueChange(setPendingCount);
  }, []);

  if (!isOffline && pendingCount === 0) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-sm font-medium transition-all ${
      isOffline
        ? 'bg-amber-50 dark:bg-amber-900/80 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200'
        : 'bg-blue-50 dark:bg-blue-900/80 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200'
    }`}>
      {isOffline ? (
        <>
          <WifiOff size={16} />
          <span>You're offline</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-800 rounded-full text-xs">
              {pendingCount} pending
            </span>
          )}
        </>
      ) : (
        <>
          <RefreshCw size={16} className="animate-spin" />
          <span>{pendingCount} operation{pendingCount !== 1 ? 's' : ''} syncing...</span>
          <button
            onClick={() => processQueue()}
            className="ml-1 underline text-xs text-amber-700 dark:text-amber-100 hover:no-underline"
          >
            Retry now
          </button>
        </>
      )}
    </div>
  );
};
