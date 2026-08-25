import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

export interface ActiveViewingData {
  animeTitle?: string;
  animeSlug?: string;
  episodeNumber?: number | string;
  poster?: string;
}

// Global store for current viewing context that any player/page can update
let currentViewingData: ActiveViewingData | null = null;
let currentPresenceListeners: Set<() => void> = new Set();

export const setActiveAnimeViewing = (data: ActiveViewingData | null) => {
  currentViewingData = data;
  // Notify any active presence trigger
  currentPresenceListeners.forEach(listener => listener());
};

export const usePresenceTracker = () => {
  const location = useLocation();
  const { user } = useAuth();
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    // Get or create persistent session ID for guest/user
    let sid = sessionStorage.getItem('animem_presence_sid');
    if (!sid) {
      sid = 'sid_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      sessionStorage.setItem('animem_presence_sid', sid);
    }
    sessionIdRef.current = sid;
  }, []);

  useEffect(() => {
    const sendPing = async () => {
      const sid = sessionIdRef.current || sessionStorage.getItem('animem_presence_sid');
      if (!sid) return;

      const path = location.pathname;
      let pageLabel = 'Bosh sahifa';
      if (path === '/') pageLabel = 'Bosh sahifa';
      else if (path.startsWith('/anime/')) {
        pageLabel = currentViewingData?.animeTitle 
          ? `Anime: ${currentViewingData.animeTitle}`
          : 'Anime sahifasida';
      }
      else if (path === '/chat') pageLabel = 'Umumiy chatda';
      else if (path === '/top-100') pageLabel = 'Top 100 reytingida';
      else if (path === '/schedule') pageLabel = 'Jadval sahifasida';
      else if (path === '/manga') pageLabel = 'Mangalar bo\'limida';
      else if (path === '/favorites') pageLabel = 'Sevimli animelarida';
      else if (path === '/profile') pageLabel = 'Profil sahifasida';
      else if (path === '/admin') pageLabel = 'Admin panelda';
      else if (path === '/login') pageLabel = 'Kirish sahifasida';
      else if (path === '/register') pageLabel = 'Ro\'yxatdan o\'tishda';
      else pageLabel = path;

      const payload = {
        sessionId: sid,
        userId: user?.id ? String(user.id) : null,
        username: user?.name || (user as any)?.displayName || (user as any)?.username || 'Mehmon',
        avatar: user?.avatar_url || (user as any)?.photoURL || (user as any)?.avatar || null,
        role: user?.role || 'guest',
        email: user?.email || null,
        currentPath: path,
        pageLabel,
        animeTitle: currentViewingData?.animeTitle || null,
        animeSlug: currentViewingData?.animeSlug || null,
        episodeNumber: currentViewingData?.episodeNumber || null,
        poster: currentViewingData?.poster || null,
        isWatching: Boolean(path.startsWith('/anime/') && (currentViewingData?.animeTitle || currentViewingData?.episodeNumber)),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        lastSeen: Date.now(),
        updatedAt: serverTimestamp()
      };

      // 1. Broadcast via local BroadcastChannel
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('animem_presence_sync');
          channel.postMessage({ type: 'HEARTBEAT', payload });
          channel.close();
        }
      } catch {
        // ignore broadcast channel error
      }

      // 2. Sync to Firebase Firestore
      try {
        if (db) {
          const presenceDocRef = doc(db, 'presence', sid);
          await setDoc(presenceDocRef, payload, { merge: true });
        }
      } catch (err) {
        console.warn('Presence firestore ping warning:', err);
      }
    };

    // Register active viewing update listener
    const triggerInstantPing = () => {
      sendPing();
    };
    currentPresenceListeners.add(triggerInstantPing);

    // Send immediately on route change or auth change
    sendPing();

    // Regular interval heartbeat every 12 seconds
    const interval = setInterval(sendPing, 12000);

    // Cleanup on window unload
    const handleUnload = () => {
      const sid = sessionIdRef.current;
      if (sid && db) {
        try {
          deleteDoc(doc(db, 'presence', sid));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      currentPresenceListeners.delete(triggerInstantPing);
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [location.pathname, user]);
};
