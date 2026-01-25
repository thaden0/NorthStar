import { create } from 'zustand';

export type TrinketType = 'email-sending' | 'email-received' | 'calendar' | 'contacts';

interface BaseTrinket {
  id: string;
  type: TrinketType;
  createdAt: Date;
  expiresAt: Date;
  isInteracted: boolean;
}

export interface EmailSendingTrinket extends BaseTrinket {
  type: 'email-sending';
  to: string;
  subject: string;
  body: string;
  status: 'typing' | 'sending' | 'sent' | 'error';
  progress: number; // 0-100 for typing animation
}

export interface EmailReceivedTrinket extends BaseTrinket {
  type: 'email-received';
  messageId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

export interface CalendarTrinket extends BaseTrinket {
  type: 'calendar';
  eventId?: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  isNew: boolean; // true if just created, false if reminder
}

export interface ContactsTrinket extends BaseTrinket {
  type: 'contacts';
  contacts: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    photoUrl?: string;
  }>;
  query?: string; // search query that found these contacts
}

export type Trinket =
  | EmailSendingTrinket
  | EmailReceivedTrinket
  | CalendarTrinket
  | ContactsTrinket;

interface TrinketState {
  trinkets: Trinket[];
  activeTrinket: Trinket | null;
  isVisible: boolean;

  // Actions
  addTrinket: (trinket: Omit<Trinket, 'id' | 'createdAt' | 'expiresAt' | 'isInteracted'>) => string;
  removeTrinket: (id: string) => void;
  updateTrinket: (id: string, updates: Partial<Trinket>) => void;
  markInteracted: (id: string) => void;
  dismissActiveTrinket: () => void;
  clearAllTrinkets: () => void;
}

const TRINKET_DISPLAY_TIME = 8000; // 8 seconds

export const useTrinketStore = create<TrinketState>((set, get) => ({
  trinkets: [],
  activeTrinket: null,
  isVisible: false,

  addTrinket: (trinketData) => {
    const id = `trinket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TRINKET_DISPLAY_TIME);

    const trinket: Trinket = {
      ...trinketData,
      id,
      createdAt: now,
      expiresAt,
      isInteracted: false,
    } as Trinket;

    set((state) => {
      const newTrinkets = [...state.trinkets, trinket];
      
      // If no active trinket, make this one active
      if (!state.activeTrinket) {
        return {
          trinkets: newTrinkets,
          activeTrinket: trinket,
          isVisible: true,
        };
      }
      
      return { trinkets: newTrinkets };
    });

    // Auto-dismiss after expiry if not interacted
    setTimeout(() => {
      const state = get();
      const currentTrinket = state.trinkets.find((t) => t.id === id);
      if (currentTrinket && !currentTrinket.isInteracted) {
        get().removeTrinket(id);
      }
    }, TRINKET_DISPLAY_TIME);

    return id;
  },

  removeTrinket: (id) => {
    set((state) => {
      const newTrinkets = state.trinkets.filter((t) => t.id !== id);
      
      // If we removed the active trinket, show the next one
      if (state.activeTrinket?.id === id) {
        const nextTrinket = newTrinkets[0] || null;
        return {
          trinkets: newTrinkets,
          activeTrinket: nextTrinket,
          isVisible: nextTrinket !== null,
        };
      }
      
      return { trinkets: newTrinkets };
    });
  },

  updateTrinket: (id, updates) => {
    set((state) => {
      const newTrinkets = state.trinkets.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ) as Trinket[];
      
      // Also update active trinket if it's the one being updated
      const newActiveTrinket =
        state.activeTrinket?.id === id
          ? { ...state.activeTrinket, ...updates }
          : state.activeTrinket;

      return {
        trinkets: newTrinkets,
        activeTrinket: newActiveTrinket as Trinket | null,
      };
    });
  },

  markInteracted: (id) => {
    set((state) => ({
      trinkets: state.trinkets.map((t) =>
        t.id === id ? { ...t, isInteracted: true } : t
      ) as Trinket[],
      activeTrinket:
        state.activeTrinket?.id === id
          ? ({ ...state.activeTrinket, isInteracted: true } as Trinket)
          : state.activeTrinket,
    }));
  },

  dismissActiveTrinket: () => {
    const state = get();
    if (state.activeTrinket) {
      get().removeTrinket(state.activeTrinket.id);
    }
  },

  clearAllTrinkets: () => {
    set({ trinkets: [], activeTrinket: null, isVisible: false });
  },
}));
