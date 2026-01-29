'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './email.module.css';
import { 
  FiCalendar, FiClock, FiMapPin, FiUsers, FiPlus, FiChevronLeft, FiChevronRight,
  FiX, FiCheck, FiLoader, FiEdit2, FiTrash2
} from 'react-icons/fi';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay?: boolean;
  attendees?: string[];
  color?: string;
}

interface CalendarViewProps {
  accountEmail: string;
}

type ViewMode = 'month' | 'week' | 'day';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarView({ accountEmail }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    location: '',
    start: '',
    end: '',
    allDay: false,
  });
  const [isCreating, setIsCreating] = useState(false);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      // Add buffer days for week view
      startOfMonth.setDate(startOfMonth.getDate() - 7);
      endOfMonth.setDate(endOfMonth.getDate() + 7);

      const response = await fetch(
        `/api/google/calendar/events?timeMin=${startOfMonth.toISOString()}&timeMax=${endOfMonth.toISOString()}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    
    // Add days from previous month
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }
    
    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    // Add days from next month to complete the grid
    const remaining = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.start);
      return eventStart.toDateString() === date.toDateString();
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.start || !newEvent.end) return;
    
    setIsCreating(true);
    try {
      const response = await fetch('/api/google/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent),
      });
      
      if (response.ok) {
        setShowCreateModal(false);
        setNewEvent({ title: '', description: '', location: '', start: '', end: '', allDay: false });
        await fetchEvents();
      }
    } catch (error) {
      console.error('Failed to create event:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
      await fetch(`/api/google/calendar/events/${eventId}`, { method: 'DELETE' });
      setEvents(prev => prev.filter(e => e.id !== eventId));
      setSelectedEvent(null);
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const formatEventTime = (start: string, end: string, allDay?: boolean) => {
    if (allDay) return 'All day';
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const startTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return `${startTime} - ${endTime}`;
  };

  const openCreateModal = (date?: Date) => {
    const startDate = date || new Date();
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
    
    setNewEvent({
      title: '',
      description: '',
      location: '',
      start: startDate.toISOString().slice(0, 16),
      end: endDate.toISOString().slice(0, 16),
      allDay: false,
    });
    setShowCreateModal(true);
  };

  const calendarDays = getCalendarDays();
  const todayEvents = getEventsForDate(selectedDate || new Date());

  return (
    <div className={styles.calendarContainer}>
      {/* Calendar Header */}
      <div className={styles.calendarHeader}>
        <div className={styles.calendarNav}>
          <button className={styles.navButton} onClick={() => navigateMonth('prev')}>
            <FiChevronLeft />
          </button>
          <h2 className={styles.calendarTitle}>
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button className={styles.navButton} onClick={() => navigateMonth('next')}>
            <FiChevronRight />
          </button>
        </div>
        
        <div className={styles.calendarActions}>
          <button className={styles.todayButton} onClick={goToToday}>
            Today
          </button>
          <div className={styles.viewToggle}>
            {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                className={`${styles.viewButton} ${viewMode === mode ? styles.viewButtonActive : ''}`}
                onClick={() => setViewMode(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <button className={styles.createEventButton} onClick={() => openCreateModal()}>
            <FiPlus />
            <span>Create Event</span>
          </button>
        </div>
      </div>

      <div className={styles.calendarContent}>
        {/* Calendar Grid */}
        <div className={styles.calendarGrid}>
          {/* Day Headers */}
          <div className={styles.calendarDaysHeader}>
            {DAYS.map(day => (
              <div key={day} className={styles.dayHeader}>{day}</div>
            ))}
          </div>

          {/* Calendar Days */}
          {isLoading ? (
            <div className={styles.calendarLoading}>
              <div className={styles.spinner} />
              <span>Loading calendar...</span>
            </div>
          ) : (
            <div className={styles.calendarDaysGrid}>
              {calendarDays.map(({ date, isCurrentMonth }, index) => {
                const dayEvents = getEventsForDate(date);
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                
                return (
                  <div
                    key={index}
                    className={`${styles.calendarDay} ${!isCurrentMonth ? styles.otherMonth : ''} ${isToday(date) ? styles.today : ''} ${isSelected ? styles.selected : ''}`}
                    onClick={() => setSelectedDate(date)}
                    onDoubleClick={() => openCreateModal(date)}
                  >
                    <span className={styles.dayNumber}>{date.getDate()}</span>
                    <div className={styles.dayEvents}>
                      {dayEvents.slice(0, 3).map(event => (
                        <div
                          key={event.id}
                          className={styles.eventPill}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(event);
                          }}
                          style={{ 
                            background: event.color || 'var(--gradient-primary)' 
                          }}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className={styles.moreEvents}>+{dayEvents.length - 3} more</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Event Details Sidebar */}
        <div className={styles.eventsSidebar}>
          <div className={styles.sidebarHeader}>
            <h3>
              {selectedDate 
                ? selectedDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
                : "Today's Events"
              }
            </h3>
          </div>
          
          <div className={styles.eventsList}>
            {todayEvents.length === 0 ? (
              <div className={styles.noEvents}>
                <FiCalendar />
                <span>No events scheduled</span>
                <button 
                  className={styles.addEventLink}
                  onClick={() => openCreateModal(selectedDate || undefined)}
                >
                  Add an event
                </button>
              </div>
            ) : (
              todayEvents.map(event => (
                <div
                  key={event.id}
                  className={`${styles.eventCard} ${selectedEvent?.id === event.id ? styles.eventCardSelected : ''}`}
                  onClick={() => setSelectedEvent(event)}
                >
                  <div 
                    className={styles.eventColorBar} 
                    style={{ background: event.color || 'var(--blue-electric)' }}
                  />
                  <div className={styles.eventCardContent}>
                    <h4>{event.title}</h4>
                    <div className={styles.eventMeta}>
                      <span>
                        <FiClock />
                        {formatEventTime(event.start, event.end, event.allDay)}
                      </span>
                      {event.location && (
                        <span>
                          <FiMapPin />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className={styles.eventModal} onClick={() => setSelectedEvent(null)}>
          <div className={styles.eventModalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.eventModalHeader}>
              <h3>{selectedEvent.title}</h3>
              <div className={styles.eventModalActions}>
                <button className={styles.editEventButton}>
                  <FiEdit2 />
                </button>
                <button 
                  className={styles.deleteEventButton}
                  onClick={() => handleDeleteEvent(selectedEvent.id)}
                >
                  <FiTrash2 />
                </button>
                <button 
                  className={styles.closeEventButton}
                  onClick={() => setSelectedEvent(null)}
                >
                  <FiX />
                </button>
              </div>
            </div>
            
            <div className={styles.eventModalBody}>
              <div className={styles.eventModalRow}>
                <FiClock />
                <span>{formatEventTime(selectedEvent.start, selectedEvent.end, selectedEvent.allDay)}</span>
              </div>
              {selectedEvent.location && (
                <div className={styles.eventModalRow}>
                  <FiMapPin />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className={styles.eventModalRow}>
                  <FiUsers />
                  <span>{selectedEvent.attendees.join(', ')}</span>
                </div>
              )}
              {selectedEvent.description && (
                <div className={styles.eventDescription}>
                  <p>{selectedEvent.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className={styles.createEventModal}>
          <div className={styles.createEventContent}>
            <div className={styles.createEventHeader}>
              <h3>Create Event</h3>
              <button onClick={() => setShowCreateModal(false)}>
                <FiX />
              </button>
            </div>
            
            <div className={styles.createEventForm}>
              <div className={styles.formField}>
                <label>Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Event title"
                />
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label>Start</label>
                  <input
                    type="datetime-local"
                    value={newEvent.start}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className={styles.formField}>
                  <label>End</label>
                  <input
                    type="datetime-local"
                    value={newEvent.end}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className={styles.formField}>
                <label>
                  <input
                    type="checkbox"
                    checked={newEvent.allDay}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, allDay: e.target.checked }))}
                  />
                  All day event
                </label>
              </div>
              
              <div className={styles.formField}>
                <label>Location</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Add location"
                />
              </div>
              
              <div className={styles.formField}>
                <label>Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Add description"
                  rows={3}
                />
              </div>
            </div>
            
            <div className={styles.createEventFooter}>
              <button
                className={styles.saveEventButton}
                onClick={handleCreateEvent}
                disabled={isCreating || !newEvent.title}
              >
                {isCreating ? (
                  <>
                    <FiLoader className={styles.spinning} />
                    Creating...
                  </>
                ) : (
                  <>
                    <FiCheck />
                    Save Event
                  </>
                )}
              </button>
              <button
                className={styles.cancelEventButton}
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
