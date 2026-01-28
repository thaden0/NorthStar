import { create } from 'zustand';
import { 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  subWeeks, 
  getISOWeek, 
  getYear,
  differenceInMinutes,
  isSameWeek
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { 
  Client, 
  ClientProject, 
  TimeEntry, 
  TimeBlock, 
  WeekRange 
} from '@/types/timeTracking';
import { DISPLAY_TIMEZONE, SNAP_MINUTES } from '@/types/timeTracking';

// Utility: Snap time to nearest 15-minute increment
export function snapToGrid(date: Date): Date {
  const minutes = date.getMinutes();
  const snappedMinutes = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
  const newDate = new Date(date);
  newDate.setMinutes(snappedMinutes, 0, 0);
  return newDate;
}

// Utility: Convert TimeEntry to TimeBlock with display info
export function toTimeBlock(entry: TimeEntry): TimeBlock {
  const displayStart = toZonedTime(entry.startTimeUtc, DISPLAY_TIMEZONE);
  const displayEnd = toZonedTime(entry.endTimeUtc, DISPLAY_TIMEZONE);
  
  // Get day of week (0 = Monday, 6 = Sunday)
  const jsDay = displayStart.getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // Convert from Sunday = 0 to Monday = 0
  
  // Calculate minutes from midnight
  const startMinutes = displayStart.getHours() * 60 + displayStart.getMinutes();
  const durationMinutes = differenceInMinutes(displayEnd, displayStart);
  
  return {
    ...entry,
    displayStartTime: displayStart,
    displayEndTime: displayEnd,
    dayOfWeek,
    startMinutes,
    durationMinutes,
  };
}

// Utility: Get week range for a given date
export function getWeekRange(date: Date): WeekRange {
  // Week starts on Monday
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  
  return {
    start,
    end,
    weekNumber: getISOWeek(date),
    year: getYear(date),
  };
}

interface TimeTrackingState {
  // Data
  clients: Client[];
  projects: ClientProject[];
  timeEntries: TimeEntry[];
  timeBlocks: TimeBlock[];
  
  // Week navigation
  currentWeek: WeekRange;
  
  // Selection state
  selectedEntry: TimeEntry | null;
  selectedClient: Client | null;
  
  // UI state
  isLoading: boolean;
  isDragging: boolean;
  isCreating: boolean;
  creatingSlot: { day: number; startMinutes: number; endMinutes: number } | null;
  
  // Modal states
  isEntryModalOpen: boolean;
  isClientModalOpen: boolean;
  isProjectModalOpen: boolean;
  isInvoiceModalOpen: boolean;
  
  // Actions - Data
  setClients: (clients: Client[]) => void;
  setProjects: (projects: ClientProject[]) => void;
  setTimeEntries: (entries: TimeEntry[]) => void;
  addTimeEntry: (entry: TimeEntry) => void;
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => void;
  removeTimeEntry: (id: string) => void;
  
  // Actions - Week navigation
  goToNextWeek: () => void;
  goToPrevWeek: () => void;
  goToToday: () => void;
  goToWeek: (date: Date) => void;
  
  // Actions - Selection
  setSelectedEntry: (entry: TimeEntry | null) => void;
  setSelectedClient: (client: Client | null) => void;
  
  // Actions - UI state
  setIsLoading: (loading: boolean) => void;
  setIsDragging: (dragging: boolean) => void;
  setIsCreating: (creating: boolean) => void;
  setCreatingSlot: (slot: { day: number; startMinutes: number; endMinutes: number } | null) => void;
  
  // Actions - Modals
  openEntryModal: (entry?: TimeEntry) => void;
  closeEntryModal: () => void;
  openClientModal: (client?: Client) => void;
  closeClientModal: () => void;
  openProjectModal: () => void;
  closeProjectModal: () => void;
  openInvoiceModal: () => void;
  closeInvoiceModal: () => void;
  
  // Computed
  getEntriesForWeek: () => TimeBlock[];
  getClientById: (id: string) => Client | undefined;
  getProjectById: (id: string) => ClientProject | undefined;
  getProjectsForClient: (clientId: string) => ClientProject[];
}

export const useTimeTrackingStore = create<TimeTrackingState>((set, get) => ({
  // Initial state
  clients: [],
  projects: [],
  timeEntries: [],
  timeBlocks: [],
  currentWeek: getWeekRange(new Date()),
  selectedEntry: null,
  selectedClient: null,
  isLoading: false,
  isDragging: false,
  isCreating: false,
  creatingSlot: null,
  isEntryModalOpen: false,
  isClientModalOpen: false,
  isProjectModalOpen: false,
  isInvoiceModalOpen: false,
  
  // Actions - Data
  setClients: (clients) => set({ clients }),
  
  setProjects: (projects) => set({ projects }),
  
  setTimeEntries: (entries) => {
    const timeBlocks = entries.map(toTimeBlock);
    set({ timeEntries: entries, timeBlocks });
  },
  
  addTimeEntry: (entry) => {
    const block = toTimeBlock(entry);
    set((state) => ({
      timeEntries: [...state.timeEntries, entry],
      timeBlocks: [...state.timeBlocks, block],
    }));
  },
  
  updateTimeEntry: (id, updates) => {
    set((state) => {
      const updatedEntries = state.timeEntries.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      );
      const timeBlocks = updatedEntries.map(toTimeBlock);
      return { timeEntries: updatedEntries, timeBlocks };
    });
  },
  
  removeTimeEntry: (id) => {
    set((state) => ({
      timeEntries: state.timeEntries.filter((e) => e.id !== id),
      timeBlocks: state.timeBlocks.filter((b) => b.id !== id),
    }));
  },
  
  // Actions - Week navigation
  goToNextWeek: () => {
    const { currentWeek } = get();
    const nextWeekDate = addWeeks(currentWeek.start, 1);
    set({ currentWeek: getWeekRange(nextWeekDate) });
  },
  
  goToPrevWeek: () => {
    const { currentWeek } = get();
    const prevWeekDate = subWeeks(currentWeek.start, 1);
    set({ currentWeek: getWeekRange(prevWeekDate) });
  },
  
  goToToday: () => {
    set({ currentWeek: getWeekRange(new Date()) });
  },
  
  goToWeek: (date) => {
    set({ currentWeek: getWeekRange(date) });
  },
  
  // Actions - Selection
  setSelectedEntry: (entry) => set({ selectedEntry: entry }),
  setSelectedClient: (client) => set({ selectedClient: client }),
  
  // Actions - UI state
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsDragging: (dragging) => set({ isDragging: dragging }),
  setIsCreating: (creating) => set({ isCreating: creating }),
  setCreatingSlot: (slot) => set({ creatingSlot: slot }),
  
  // Actions - Modals
  openEntryModal: (entry) => set({ 
    isEntryModalOpen: true, 
    selectedEntry: entry || null 
  }),
  closeEntryModal: () => set({ 
    isEntryModalOpen: false, 
    selectedEntry: null 
  }),
  openClientModal: (client) => set({ 
    isClientModalOpen: true, 
    selectedClient: client || null 
  }),
  closeClientModal: () => set({ 
    isClientModalOpen: false, 
    selectedClient: null 
  }),
  openProjectModal: () => set({ isProjectModalOpen: true }),
  closeProjectModal: () => set({ isProjectModalOpen: false }),
  openInvoiceModal: () => set({ isInvoiceModalOpen: true }),
  closeInvoiceModal: () => set({ isInvoiceModalOpen: false }),
  
  // Computed
  getEntriesForWeek: () => {
    const { timeBlocks, currentWeek } = get();
    return timeBlocks.filter((block) => 
      isSameWeek(block.displayStartTime, currentWeek.start, { weekStartsOn: 1 })
    );
  },
  
  getClientById: (id) => {
    const { clients } = get();
    return clients.find((c) => c.id === id);
  },
  
  getProjectById: (id) => {
    const { projects } = get();
    return projects.find((p) => p.id === id);
  },
  
  getProjectsForClient: (clientId) => {
    const { projects } = get();
    return projects.filter((p) => p.clientId === clientId && p.isActive);
  },
}));
