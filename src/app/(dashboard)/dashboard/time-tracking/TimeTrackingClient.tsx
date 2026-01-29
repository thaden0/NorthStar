'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { format, addDays, isToday, isSameDay, getHours, getMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { FiChevronLeft, FiChevronRight, FiFileText, FiX, FiTrash2 } from 'react-icons/fi';
import { toast } from 'sonner';
import { useTimeTrackingStore } from '@/stores/timeTracking-store';
import {
  getTimeEntriesAction,
  createTimeEntryAction,
  updateTimeEntryAction,
  deleteTimeEntryAction,
} from '@/server/timeTracking/actions';
import type { Client, ClientProject, TimeEntry, TimeBlock } from '@/types/timeTracking';
import { DAYS_OF_WEEK, DISPLAY_TIMEZONE, HOUR_HEIGHT, SNAP_MINUTES } from '@/types/timeTracking';
import InvoiceModal from './InvoiceModal';
import styles from './timeTracking.module.css';

interface TimeTrackingClientProps {
  initialClients: Client[];
  initialProjects: ClientProject[];
}

type DragMode = 'none' | 'create' | 'move' | 'resize-top' | 'resize-bottom';

interface DragState {
  mode: DragMode;
  entryId?: string;
  dayIndex: number;
  startY: number;
  startX: number;
  startMinutes: number;
  endMinutes: number;
  originalStart?: number;
  originalEnd?: number;
  originalDay?: number;
  hasMoved: boolean;
}

export default function TimeTrackingClient({ initialClients, initialProjects }: TimeTrackingClientProps) {
  const {
    clients,
    projects,
    currentWeek,
    selectedEntry,
    isEntryModalOpen,
    isInvoiceModalOpen,
    setClients,
    setProjects,
    setTimeEntries,
    goToNextWeek,
    goToPrevWeek,
    goToToday,
    openEntryModal,
    closeEntryModal,
    openInvoiceModal,
    closeInvoiceModal,
    getEntriesForWeek,
  } = useTimeTrackingStore();

  const [, setIsLoading] = useState(true);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewBlock, setPreviewBlock] = useState<{ day: number; startMinutes: number; endMinutes: number } | null>(null);
  
  const calendarRef = useRef<HTMLDivElement>(null);
  const dayColumnsRef = useRef<HTMLDivElement[]>([]);

  // Initialize data
  useEffect(() => {
    setClients(initialClients);
    setProjects(initialProjects);
  }, [initialClients, initialProjects, setClients, setProjects]);

  // Fetch time entries when week changes
  useEffect(() => {
    const fetchEntries = async () => {
      setIsLoading(true);
      try {
        const result = await getTimeEntriesAction(currentWeek.start, currentWeek.end);
        if (result.success && result.data) {
          setTimeEntries(result.data as TimeEntry[]);
        }
      } catch (error) {
        console.error('Failed to fetch time entries:', error);
        toast.error('Failed to load time entries');
      }
      setIsLoading(false);
    };
    fetchEntries();
  }, [currentWeek, setTimeEntries]);

  // Get current week entries
  const weekEntries = getEntriesForWeek();

  // Calculate week label
  const weekLabel = `${format(currentWeek.start, 'MMM d')} - ${format(currentWeek.end, 'MMM d, yyyy')}`;

  // Get entries for a specific day
  const getEntriesForDay = (dayIndex: number): TimeBlock[] => {
    return weekEntries.filter((entry) => entry.dayOfWeek === dayIndex);
  };

  // Calculate total hours for the week
  const totalHours = weekEntries.reduce((sum, entry) => sum + entry.durationMinutes / 60, 0);
  const billableHours = weekEntries.reduce((sum, entry) => 
    entry.billable ? sum + entry.durationMinutes / 60 : sum, 0
  );

  // Convert Y position to minutes, snapped to 15-minute increments
  const yToMinutes = (y: number): number => {
    const minutesPerPixel = 60 / HOUR_HEIGHT;
    const minutes = y * minutesPerPixel;
    const snappedMinutes = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
    return Math.max(0, Math.min(snappedMinutes, 24 * 60));
  };

  // Get current day index from mouse X position
  const getDayIndexFromX = (clientX: number): number => {
    for (let i = 0; i < dayColumnsRef.current.length; i++) {
      const col = dayColumnsRef.current[i];
      if (col) {
        const rect = col.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) {
          return i;
        }
      }
    }
    return dragState?.dayIndex ?? 0;
  };

  // Handle mouse down on empty calendar space (start creating)
  const handleColumnMouseDown = (e: React.MouseEvent, dayIndex: number) => {
    // Only create if clicking directly on the column, not on a time block
    if ((e.target as HTMLElement).closest(`.${styles.timeBlock}`)) {
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const startMinutes = yToMinutes(y);
    
    setDragState({
      mode: 'create',
      dayIndex,
      startY: y,
      startX: e.clientX,
      startMinutes,
      endMinutes: startMinutes + SNAP_MINUTES,
      hasMoved: false,
    });
    setPreviewBlock({
      day: dayIndex,
      startMinutes,
      endMinutes: startMinutes + SNAP_MINUTES,
    });
    
    e.preventDefault();
  };

  // Handle mouse down on a time block (start moving)
  const handleBlockMouseDown = (e: React.MouseEvent, entry: TimeBlock) => {
    e.stopPropagation();
    e.preventDefault();
    
    const target = e.target as HTMLElement;
    const blockElement = target.closest(`.${styles.timeBlock}`) as HTMLElement;
    if (!blockElement) return;
    
    const blockRect = blockElement.getBoundingClientRect();
    const clickY = e.clientY - blockRect.top;
    const blockHeight = blockRect.height;
    
    // Determine if clicking on resize handle (top/bottom 8px)
    const RESIZE_ZONE = 8;
    
    let mode: DragMode = 'move';
    if (clickY <= RESIZE_ZONE) {
      mode = 'resize-top';
    } else if (clickY >= blockHeight - RESIZE_ZONE) {
      mode = 'resize-bottom';
    }
    
    const colElement = dayColumnsRef.current[entry.dayOfWeek];
    const colRect = colElement?.getBoundingClientRect();
    const y = colRect ? e.clientY - colRect.top : 0;
    
    setDragState({
      mode,
      entryId: entry.id,
      dayIndex: entry.dayOfWeek,
      startY: y,
      startX: e.clientX,
      startMinutes: entry.startMinutes,
      endMinutes: entry.startMinutes + entry.durationMinutes,
      originalStart: entry.startMinutes,
      originalEnd: entry.startMinutes + entry.durationMinutes,
      originalDay: entry.dayOfWeek,
      hasMoved: false,
    });
    
    setPreviewBlock({
      day: entry.dayOfWeek,
      startMinutes: entry.startMinutes,
      endMinutes: entry.startMinutes + entry.durationMinutes,
    });
  };

  // Handle global mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState || !calendarRef.current) return;
    
    const { mode, dayIndex, startY, originalStart, originalEnd } = dragState;
    
    const colElement = dayColumnsRef.current[dayIndex];
    if (!colElement) return;
    
    const colRect = colElement.getBoundingClientRect();
    const currentY = e.clientY - colRect.top;
    const currentMinutes = yToMinutes(currentY);
    
    if (mode === 'create') {
      const dragStartMinutes = yToMinutes(startY);
      if (currentMinutes > dragStartMinutes) {
        setPreviewBlock({
          day: dayIndex,
          startMinutes: dragStartMinutes,
          endMinutes: currentMinutes,
        });
      } else {
        setPreviewBlock({
          day: dayIndex,
          startMinutes: currentMinutes,
          endMinutes: dragStartMinutes,
        });
      }
    } else if (mode === 'move' && originalStart !== undefined && originalEnd !== undefined) {
      const deltaMinutes = currentMinutes - yToMinutes(startY);
      const duration = originalEnd - originalStart;
      let newStart = originalStart + deltaMinutes;
      let newEnd = newStart + duration;
      
      // Clamp to day boundaries
      if (newStart < 0) {
        newStart = 0;
        newEnd = duration;
      }
      if (newEnd > 24 * 60) {
        newEnd = 24 * 60;
        newStart = newEnd - duration;
      }
      
      // Check if we moved to a different day
      const newDayIndex = getDayIndexFromX(e.clientX);
      
      setDragState(prev => prev ? { ...prev, dayIndex: newDayIndex } : null);
      setPreviewBlock({
        day: newDayIndex,
        startMinutes: newStart,
        endMinutes: newEnd,
      });
    } else if (mode === 'resize-top' && originalEnd !== undefined) {
      let newStart = currentMinutes;
      const minDuration = SNAP_MINUTES;
      
      // Don't allow resizing past end time
      if (newStart >= originalEnd - minDuration) {
        newStart = originalEnd - minDuration;
      }
      if (newStart < 0) newStart = 0;
      
      setPreviewBlock({
        day: dayIndex,
        startMinutes: newStart,
        endMinutes: originalEnd,
      });
    } else if (mode === 'resize-bottom' && originalStart !== undefined) {
      let newEnd = currentMinutes;
      const minDuration = SNAP_MINUTES;
      
      // Don't allow resizing past start time
      if (newEnd <= originalStart + minDuration) {
        newEnd = originalStart + minDuration;
      }
      if (newEnd > 24 * 60) newEnd = 24 * 60;
      
      setPreviewBlock({
        day: dayIndex,
        startMinutes: originalStart,
        endMinutes: newEnd,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, getDayIndexFromX]);

  // Handle global mouse up
  const handleMouseUp = useCallback(async () => {
    if (!dragState || !previewBlock) {
      setDragState(null);
      setPreviewBlock(null);
      return;
    }
    
    const { mode, entryId } = dragState;
    const { day, startMinutes, endMinutes } = previewBlock;
    
    // Minimum 15 minutes
    if (endMinutes - startMinutes < SNAP_MINUTES) {
      setDragState(null);
      setPreviewBlock(null);
      return;
    }
    
    // Calculate UTC times
    const dayDate = addDays(currentWeek.start, day);
    const startHours = Math.floor(startMinutes / 60);
    const startMins = startMinutes % 60;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    
    const startLocal = new Date(dayDate);
    startLocal.setHours(startHours, startMins, 0, 0);
    const endLocal = new Date(dayDate);
    endLocal.setHours(endHours, endMins, 0, 0);
    
    const startUtc = fromZonedTime(startLocal, DISPLAY_TIMEZONE);
    const endUtc = fromZonedTime(endLocal, DISPLAY_TIMEZONE);
    
    try {
      if (mode === 'create') {
        const result = await createTimeEntryAction({
          startTimeUtc: startUtc,
          endTimeUtc: endUtc,
          billable: true,
        });
        
        if (result.success && result.data) {
          const entry = result.data as TimeEntry;
          useTimeTrackingStore.getState().addTimeEntry(entry);
          openEntryModal(entry);
          toast.success('Time block created');
        } else {
          toast.error(result.error || 'Failed to create time block');
        }
      } else if ((mode === 'move' || mode === 'resize-top' || mode === 'resize-bottom') && entryId) {
        const result = await updateTimeEntryAction(entryId, {
          startTimeUtc: startUtc,
          endTimeUtc: endUtc,
        });
        
        if (result.success && result.data) {
          useTimeTrackingStore.getState().updateTimeEntry(entryId, result.data as Partial<TimeEntry>);
          toast.success('Time block updated');
        } else {
          toast.error(result.error || 'Failed to update time block');
        }
      }
    } catch (error) {
      console.error('Failed to save time entry:', error);
      toast.error('Failed to save time block');
    }
    
    setDragState(null);
    setPreviewBlock(null);
  }, [dragState, previewBlock, currentWeek.start, openEntryModal]);

  // Add global mouse listeners
  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = dragState.mode === 'move' ? 'grabbing' : 
        (dragState.mode === 'resize-top' || dragState.mode === 'resize-bottom') ? 'ns-resize' : 'crosshair';
      document.body.style.userSelect = 'none';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Handle time block double-click to open edit modal
  const handleBlockDoubleClick = (entry: TimeEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    openEntryModal(entry);
  };

  // Handle quick delete of a time block
  const handleQuickDelete = async (entry: TimeBlock, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!confirm('Delete this time entry?')) return;
    
    try {
      const result = await deleteTimeEntryAction(entry.id);
      if (result.success) {
        useTimeTrackingStore.getState().removeTimeEntry(entry.id);
        toast.success('Time entry deleted');
      } else {
        toast.error(result.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete');
    }
  };

  // Render time indicator for current time
  const renderCurrentTimeIndicator = () => {
    const now = toZonedTime(new Date(), DISPLAY_TIMEZONE);
    const jsDay = now.getDay();
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
    
    const dayDate = addDays(currentWeek.start, dayIndex);
    if (!isSameDay(dayDate, toZonedTime(new Date(), DISPLAY_TIMEZONE))) {
      return null;
    }
    
    const hours = getHours(now);
    const minutes = getMinutes(now);
    const top = (hours * 60 + minutes) / 60 * HOUR_HEIGHT;
    
    return (
      <div 
        className={styles.currentTimeIndicator}
        style={{ top }}
      />
    );
  };

  // Get cursor style for a time block based on mouse position
  const getBlockCursor = (e: React.MouseEvent, blockElement: HTMLElement): string => {
    const rect = blockElement.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const RESIZE_ZONE = 8;
    
    if (y <= RESIZE_ZONE || y >= rect.height - RESIZE_ZONE) {
      return 'ns-resize';
    }
    return 'grab';
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Time Tracking</h1>
          <div className={styles.weekNav}>
            <button 
              className={styles.weekNavBtn} 
              onClick={goToPrevWeek}
              title="Previous week"
            >
              <FiChevronLeft size={20} />
            </button>
            <span className={styles.weekLabel}>{weekLabel}</span>
            <button 
              className={styles.weekNavBtn} 
              onClick={goToNextWeek}
              title="Next week"
            >
              <FiChevronRight size={20} />
            </button>
          </div>
          <button className={styles.todayBtn} onClick={goToToday}>
            Today
          </button>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.invoiceBtn} onClick={openInvoiceModal}>
            <FiFileText size={18} />
            Create Invoice
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className={styles.calendarContainer} ref={calendarRef}>
        {/* Day Headers */}
        <div className={styles.calendarHeader}>
          <div className={styles.timeLabel} />
          {DAYS_OF_WEEK.map((day, index) => {
            const dayDate = addDays(currentWeek.start, index);
            const isTodayDate = isToday(dayDate);
            return (
              <div 
                key={day}
                className={`${styles.dayHeader} ${isTodayDate ? styles.dayHeaderToday : ''}`}
              >
                <span className={styles.dayName}>{day.slice(0, 3)}</span>
                <span className={styles.dayDate}>{format(dayDate, 'd')}</span>
              </div>
            );
          })}
        </div>

        {/* Calendar Body */}
        <div className={styles.calendarBody}>
          {/* Time Column */}
          <div className={styles.timeColumn}>
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className={styles.timeSlot}>
                {format(new Date().setHours(i, 0, 0, 0), 'h a')}
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {DAYS_OF_WEEK.map((day, dayIndex) => {
            const dayEntries = getEntriesForDay(dayIndex);
            const dayDate = addDays(currentWeek.start, dayIndex);
            const isTodayDate = isToday(dayDate);
            
            // Filter out the entry being dragged if in move mode
            const visibleEntries = dragState?.mode === 'move' || dragState?.mode === 'resize-top' || dragState?.mode === 'resize-bottom'
              ? dayEntries.filter(e => e.id !== dragState.entryId)
              : dayEntries;
            
            // Entries moved to different days handled by previewBlock

            return (
              <div 
                key={day}
                className={styles.dayColumn}
                data-day-column
                ref={el => { if (el) dayColumnsRef.current[dayIndex] = el; }}
                onMouseDown={(e) => handleColumnMouseDown(e, dayIndex)}
              >
                {/* Hour slots */}
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className={styles.hourSlot}>
                    <div className={`${styles.quarterLine} ${styles.quarterLine15}`} />
                    <div className={`${styles.quarterLine} ${styles.quarterLine30}`} />
                    <div className={`${styles.quarterLine} ${styles.quarterLine45}`} />
                  </div>
                ))}

                {/* Time blocks */}
                {visibleEntries.map((entry) => {
                  const client = clients.find(c => c.id === entry.clientId);
                  const project = projects.find(p => p.id === entry.projectId);
                  const top = entry.startMinutes / 60 * HOUR_HEIGHT;
                  const height = Math.max(entry.durationMinutes / 60 * HOUR_HEIGHT, 20);
                  const bgColor = client?.color || 'var(--glass-3)';
                  const isBeingDragged = dragState?.entryId === entry.id;

                  return (
                    <div
                      key={entry.id}
                      className={`${styles.timeBlock} ${!client ? styles.timeBlockNoClient : ''} ${isBeingDragged ? styles.timeBlockDragging : ''}`}
                      style={{
                        top,
                        height,
                        backgroundColor: bgColor,
                        color: client ? 'white' : 'var(--text-secondary)',
                        opacity: isBeingDragged ? 0.5 : 1,
                      }}
                      onMouseDown={(e) => handleBlockMouseDown(e, entry)}
                      onDoubleClick={(e) => handleBlockDoubleClick(entry, e)}
                      onMouseMove={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        target.style.cursor = getBlockCursor(e, target);
                      }}
                    >
                      {/* Resize handle top */}
                      <div className={styles.resizeHandleTop} />
                      
                      {/* Delete button */}
                      <button
                        className={styles.timeBlockDeleteBtn}
                        onClick={(e) => handleQuickDelete(entry, e)}
                        onMouseDown={(e) => e.stopPropagation()}
                        title="Delete"
                      >
                        <FiTrash2 size={12} />
                      </button>
                      
                      <div className={styles.timeBlockTime}>
                        {format(entry.displayStartTime, 'h:mm a')} - {format(entry.displayEndTime, 'h:mm a')}
                      </div>
                      <div className={styles.timeBlockClient}>
                        {client?.name || 'No client assigned'}
                      </div>
                      {project && height > 50 && (
                        <div className={styles.timeBlockProject}>
                          {project.name}
                        </div>
                      )}
                      
                      {/* Resize handle bottom */}
                      <div className={styles.resizeHandleBottom} />
                    </div>
                  );
                })}

                {/* Preview block (creating/moving/resizing) */}
                {previewBlock && previewBlock.day === dayIndex && dragState && (
                  <div
                    className={styles.previewBlock}
                    style={{
                      top: previewBlock.startMinutes / 60 * HOUR_HEIGHT,
                      height: Math.max((previewBlock.endMinutes - previewBlock.startMinutes) / 60 * HOUR_HEIGHT, 20),
                    }}
                  >
                    <div className={styles.previewBlockContent}>
                      {Math.floor((previewBlock.endMinutes - previewBlock.startMinutes) / 60)}h{' '}
                      {(previewBlock.endMinutes - previewBlock.startMinutes) % 60}m
                    </div>
                  </div>
                )}

                {/* Current time indicator */}
                {isTodayDate && renderCurrentTimeIndicator()}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Total:</span>
            <span className={`${styles.summaryValue} ${styles.summaryValueHighlight}`}>
              {totalHours.toFixed(1)} hours
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Billable:</span>
            <span className={styles.summaryValue}>
              {billableHours.toFixed(1)} hours
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Entries:</span>
            <span className={styles.summaryValue}>
              {weekEntries.length}
            </span>
          </div>
        </div>
      </div>

      {/* Entry Edit Modal */}
      {isEntryModalOpen && (
        <TimeEntryModal
          entry={selectedEntry}
          clients={clients}
          projects={projects}
          onClose={closeEntryModal}
        />
      )}

      {/* Invoice Modal */}
      {isInvoiceModalOpen && (
        <InvoiceModal
          clients={clients}
          onClose={closeInvoiceModal}
        />
      )}
    </div>
  );
}

// Time Entry Edit Modal Component
interface TimeEntryModalProps {
  entry: TimeEntry | null;
  clients: Client[];
  projects: ClientProject[];
  onClose: () => void;
}

function TimeEntryModal({ entry, clients, projects, onClose }: TimeEntryModalProps) {
  const [clientId, setClientId] = useState(entry?.clientId || '');
  const [projectId, setProjectId] = useState(entry?.projectId || '');
  const [description, setDescription] = useState(entry?.description || '');
  const [billable, setBillable] = useState(entry?.billable ?? true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Get available projects for selected client
  const availableProjects = projects.filter(p => p.clientId === clientId && p.isActive);

  // Initialize times
  useEffect(() => {
    if (entry) {
      const start = toZonedTime(entry.startTimeUtc, DISPLAY_TIMEZONE);
      const end = toZonedTime(entry.endTimeUtc, DISPLAY_TIMEZONE);
      setStartTime(format(start, 'HH:mm'));
      setEndTime(format(end, 'HH:mm'));
    }
  }, [entry]);

  // Clear project if client changes and project doesn't belong to new client
  useEffect(() => {
    if (projectId) {
      const project = projects.find(p => p.id === projectId);
      if (project && project.clientId !== clientId) {
        setProjectId('');
      }
    }
  }, [clientId, projectId, projects]);

  const handleSave = async () => {
    if (!entry) return;
    
    setIsSaving(true);
    try {
      // Parse times and convert to UTC
      const startDate = toZonedTime(entry.startTimeUtc, DISPLAY_TIMEZONE);
      const [startHours, startMins] = startTime.split(':').map(Number);
      const [endHours, endMins] = endTime.split(':').map(Number);
      
      const newStart = new Date(startDate);
      newStart.setHours(startHours, startMins, 0, 0);
      const newEnd = new Date(startDate);
      newEnd.setHours(endHours, endMins, 0, 0);
      
      // Handle overnight entries
      if (newEnd <= newStart) {
        newEnd.setDate(newEnd.getDate() + 1);
      }
      
      const startUtc = fromZonedTime(newStart, DISPLAY_TIMEZONE);
      const endUtc = fromZonedTime(newEnd, DISPLAY_TIMEZONE);
      
      const result = await updateTimeEntryAction(entry.id, {
        clientId: clientId || null,
        projectId: projectId || null,
        startTimeUtc: startUtc,
        endTimeUtc: endUtc,
        description: description || null,
        billable,
      });
      
      if (result.success && result.data) {
        useTimeTrackingStore.getState().updateTimeEntry(entry.id, result.data as Partial<TimeEntry>);
        toast.success('Time entry updated');
        onClose();
      } else {
        toast.error(result.error || 'Failed to update time entry');
      }
    } catch (error) {
      console.error('Failed to update time entry:', error);
      toast.error('Failed to update time entry');
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!entry || !confirm('Are you sure you want to delete this time entry?')) return;
    
    setIsSaving(true);
    try {
      const result = await deleteTimeEntryAction(entry.id);
      if (result.success) {
        useTimeTrackingStore.getState().removeTimeEntry(entry.id);
        toast.success('Time entry deleted');
        onClose();
      } else {
        toast.error(result.error || 'Failed to delete time entry');
      }
    } catch (error) {
      console.error('Failed to delete time entry:', error);
      toast.error('Failed to delete time entry');
    }
    setIsSaving(false);
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Edit Time Entry</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Start Time</label>
            <input
              type="time"
              className={styles.input}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>End Time</label>
            <input
              type="time"
              className={styles.input}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Client</label>
          <select
            className={styles.select}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">No client</option>
            {clients.filter(c => c.isActive).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        {availableProjects.length > 0 && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Project</label>
            <select
              className={styles.select}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">No project</option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.formGroup}>
          <label className={styles.label}>Description</label>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What were you working on?"
          />
        </div>

        <div className={styles.formGroup}>
          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="billable"
              className={styles.checkbox}
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
            />
            <label htmlFor="billable" className={styles.checkboxLabel}>
              Billable
            </label>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button
            className={styles.btnDanger}
            onClick={handleDelete}
            disabled={isSaving}
          >
            <FiTrash2 size={16} />
            Delete
          </button>
          <button
            className={styles.btnSecondary}
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
