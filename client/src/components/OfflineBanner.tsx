import React, { useState, useEffect } from 'react';
import { WifiOff, Loader2 } from 'lucide-react';
import { getQueueCount } from '../api/indexedDB';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);

  const updateStatus = async () => {
    setIsOnline(navigator.onLine);
    const count = await getQueueCount();
    setQueueCount(count);
  };

  useEffect(() => {
    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    window.addEventListener('offline-queue-updated', updateStatus);

    // Poll for queue count regularly to see it drain when online
    const interval = setInterval(updateStatus, 2000);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      window.removeEventListener('offline-queue-updated', updateStatus);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && queueCount === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '1.5rem',
      right: '1.5rem',
      background: !isOnline ? '#f43f5e' : '#f59e0b',
      color: 'white',
      padding: '1rem 1.5rem',
      borderRadius: '16px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      zIndex: 9999,
      animation: 'slideUp 0.3s ease-out'
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      
      {!isOnline ? (
        <WifiOff size={24} />
      ) : (
        <Loader2 className="animate-spin" size={24} />
      )}
      
      <div>
        <p style={{ fontWeight: 900, margin: 0, fontSize: '0.95rem' }}>
          {!isOnline ? 'You are offline' : 'Syncing data...'}
        </p>
        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, opacity: 0.9 }}>
          {queueCount} {queueCount === 1 ? 'transaction' : 'transactions'} pending sync
        </p>
      </div>
    </div>
  );
};
