'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { format, addDays, isToday, isSameDay, getHours, getMinutes, addMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { FiChevronLeft, FiChevronRight, FiFileText, FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import { toast } from 'sonner';
import { useTimeTrackingStore, getWeekRange, toTimeBlock } from '@/stores/timeTracking-store';
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

export default function TimeTrackingClient({ initialClients, initialProjects }: TimeTrackingClientProps) {
  const {
    clients,
    projects,
    currentWeek,
    timeBlocks,
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

  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingSlot, setCreatingSlot] = useState<{ day: number; startMinutes: number; endMinutes: number } | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragDay, setDragDay] = useState(0);
  
  const calendarRef = useRef<HTMLDivElement>(null);

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

  // Snap Y position to 15-minute increments
  const snapToQuarter = (y: number): number => {
    const minutesPerPixel = 60 / HOUR_HEIGHT;
    const minutes = y * minutesPerPixel;
    const snappedMinutes = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
    return snappedMinutes;
  };

  // Handle mouse down on calendar (start creating)
  const handleMouseDown = (e: React.MouseEvent, dayIndex: number) => {
    if (isDragging) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const startMinutes = snapToQuarter(y);
    
    setIsCreating(true);
    setDragStartY(y);
    setDragDay(dayIndex);
    setCreatingSlot({
      day: dayIndex,
      startMinutes,
      endMinutes: startMinutes + SNAP_MINUTES,
    });
  };

  // Handle mouse move while creating
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isCreating || !calendarRef.current) return;
    
    const dayColumns = calendarRef.current.querySelectorAll('[data-day-column]');
    const dayColumn = dayColumns[dragDay] as HTMLElement;
    if (!dayColumn) return;
    
    const rect = dayColumn.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const currentMinutes = snapToQuarter(y);
    
    if (creatingSlot) {
      const startMinutes = snapToQuarter(dragStartY / HOUR_HEIGHT * 60);
      if (currentMinutes > startMinutes) {
        setCreatingSlot({
          day: dragDay,
          startMinutes,
          endMinutes: currentMinutes,
        });
      } else {
        setCreatingSlot({
          day: dragDay,
          startMinutes: currentMinutes,
          endMinutes: startMinutes,
        });
      }
    }
  }, [isCreating, dragDay, dragStartY, creatingSlot]);

  // Handle mouse up (finish creating)
  const handleMouseUp = useCallback(async () => {
    if (!isCreating || !creatingSlot) {
      setIsCreating(false);
      setCreatingSlot(null);
      return;
    }
    
    setIsCreating(false);
    
    // Minimum 15 minutes
    if (creatingSlot.endMinutes - creatingSlot.startMinutes < SNAP_MINUTES) {
      setCreatingSlot(null);
      return;
    }
    
    // Calculate UTC times
    const dayDate = addDays(currentWeek.start, creatingSlot.day);
    const startHours = Math.floor(creatingSlot.startMinutes / 60);
    const startMins = creatingSlot.startMinutes % 60;
    const endHours = Math.floor(creatingSlot.endMinutes / 60);
    const endMins = creatingSlot.endMinutes % 60;
    
    // Create date in Eastern time, then convert to UTC
    const startLocal = new Date(dayDate);
    startLocal.setHours(startHours, startMins, 0, 0);
    const endLocal = new Date(dayDate);
    endLocal.setHours(endHours, endMins, 0, 0);
    
    const startUtc = fromZonedTime(startLocal, DISPLAY_TIMEZONE);
    const endUtc = fromZonedTime(endLocal, DISPLAY_TIMEZONE);
    
    try {
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
    } catch (error) {
      console.error('Failed to create time entry:', error);
      toast.error('Failed to create time block');
    }
    
    setCreatingSlot(null);
  }, [isCreating, creatingSlot, currentWeek.start, openEntryModal]);

  // Add global mouse listeners for creating
  useEffect(() => {
    if (isCreating) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isCreating, handleMouseMove, handleMouseUp]);

  // Handle time block click
  const handleBlockClick = (entry: TimeEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    openEntryModal(entry);
  };

  // Render time indicator for current time
  const renderCurrentTimeIndicator = () => {
    const now = toZonedTime(new Date(), DISPLAY_TIMEZONE);
    const jsDay = now.getDay();
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
    
    // Check if current day is in the current week
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

            return (
              <div 
                key={day}
                className={styles.dayColumn}
                data-day-column
                onMouseDown={(e) => handleMouseDown(e, dayIndex)}
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
                {dayEntries.map((entry) => {
                  const client = clients.find(c => c.id === entry.clientId);
                  const project = projects.find(p => p.id === entry.projectId);
                  const top = entry.startMinutes / 60 * HOUR_HEIGHT;
                  const height = Math.max(entry.durationMinutes / 60 * HOUR_HEIGHT, 20);
                  const bgColor = client?.color || 'var(--glass-3)';

                  return (
                    <div
                      key={entry.id}
                      className={`${styles.timeBlock} ${!client ? styles.timeBlockNoClient : ''}`}
                      style={{
                        top,
                        height,
                        backgroundColor: bgColor,
                        color: client ? 'white' : 'var(--text-secondary)',
                      }}
                      onClick={(e) => handleBlockClick(entry, e)}
                    >
                      <div className={styles.timeBlockTime}>
                        {format(entry.displayStartTime, 'h:mm a')} - {format(entry.displayEndTime, 'h:mm a')}
                      </div>
                      <div className={styles.timeBlockClient}>
                        {client?.name || 'No client assigned'}
                      </div>
                      {project && (
                        <div className={styles.timeBlockProject}>
                          {project.name}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Creating slot indicator */}
                {creatingSlot && creatingSlot.day === dayIndex && (
                  <div
                    className={styles.creatingSlot}
                    style={{
                      top: creatingSlot.startMinutes / 60 * HOUR_HEIGHT,
                      height: Math.max((creatingSlot.endMinutes - creatingSlot.startMinutes) / 60 * HOUR_HEIGHT, 20),
                    }}
                  >
                    {Math.floor((creatingSlot.endMinutes - creatingSlot.startMinutes) / 60)}h {(creatingSlot.endMinutes - creatingSlot.startMinutes) % 60}m
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
