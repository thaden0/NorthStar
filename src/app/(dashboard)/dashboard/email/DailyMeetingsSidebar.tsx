'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './email.module.css';
import { FiVideo, FiClock, FiExternalLink, FiMapPin, FiCalendar } from 'react-icons/fi';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay?: boolean;
  meetingLink?: string;
  htmlLink?: string;
  attendees?: Array<{ email: string; name?: string }>;
  color?: string;
}

interface DailyMeetingsSidebarProps {
  accountEmail: string;
}

// accountEmail is reserved for future multi-account calendar support
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function DailyMeetingsSidebar({ accountEmail: _accountEmail }: DailyMeetingsSidebarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute for the "now" line
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Fetch today's events
  const fetchTodayEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const response = await fetch(
        `/api/google/calendar/events?timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch today events:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayEvents();
  }, [fetchTodayEvents]);

  // Calculate the position of events and current time line
  const timelineHours = useMemo(() => {
    // Show hours from 6 AM to 10 PM (or adjust based on events)
    const hours: number[] = [];
    for (let i = 6; i <= 22; i++) {
      hours.push(i);
    }
    return hours;
  }, []);

  const hourHeight = 60; // pixels per hour
  const startHour = 6;
  const endHour = 22;
  const totalHeight = (endHour - startHour) * hourHeight;

  // Calculate position for an event
  const getEventPosition = (event: CalendarEvent) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    
    const startOffset = Math.max(0, startMinutes - startHour * 60);
    const duration = endMinutes - startMinutes;
    
    const top = (startOffset / 60) * hourHeight;
    const height = Math.max(20, (duration / 60) * hourHeight);
    
    return { top, height };
  };

  // Calculate position for current time line
  const nowLinePosition = useMemo(() => {
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const offset = minutes - startHour * 60;
    if (offset < 0 || offset > (endHour - startHour) * 60) return null;
    return (offset / 60) * hourHeight;
  }, [currentTime]);

  // Format time for display
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format hour label
  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour} ${period}`;
  };

  // Non-allday events for timeline
  const timelineEvents = events.filter(e => !e.allDay);
  const allDayEvents = events.filter(e => e.allDay);

  // Handle click on event to show details
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  // Handle join meeting
  const handleJoinMeeting = (link: string) => {
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={styles.dailyMeetingsSidebar}>
      <div className={styles.dailyMeetingsHeader}>
        <FiCalendar />
        <span>Today&apos;s Schedule</span>
      </div>

      {isLoading ? (
        <div className={styles.dailyMeetingsLoading}>
          <div className={styles.spinner} />
          <span>Loading calendar...</span>
        </div>
      ) : events.length === 0 ? (
        <div className={styles.dailyMeetingsEmpty}>
          <FiCalendar />
          <span>No meetings today</span>
        </div>
      ) : (
        <>
          {/* All-day events */}
          {allDayEvents.length > 0 && (
            <div className={styles.allDayEvents}>
              {allDayEvents.map(event => (
                <div
                  key={event.id}
                  className={styles.allDayEvent}
                  onClick={() => handleEventClick(event)}
                  style={{ borderLeftColor: event.color || 'var(--blue-electric)' }}
                >
                  <span className={styles.allDayLabel}>All Day</span>
                  <span className={styles.allDayTitle}>{event.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Timeline view */}
          <div className={styles.timelineContainer}>
            <div className={styles.timeline} style={{ height: totalHeight }}>
              {/* Hour markers */}
              {timelineHours.map(hour => (
                <div
                  key={hour}
                  className={styles.timelineHour}
                  style={{ top: (hour - startHour) * hourHeight }}
                >
                  <span className={styles.hourLabel}>{formatHour(hour)}</span>
                  <div className={styles.hourLine} />
                </div>
              ))}

              {/* Current time indicator (red line) */}
              {nowLinePosition !== null && (
                <div
                  className={styles.nowLine}
                  style={{ top: nowLinePosition }}
                >
                  <div className={styles.nowDot} />
                  <div className={styles.nowLineBar} />
                </div>
              )}

              {/* Events */}
              <div className={styles.timelineEvents}>
                {timelineEvents.map(event => {
                  const { top, height } = getEventPosition(event);
                  return (
                    <div
                      key={event.id}
                      className={`${styles.timelineEvent} ${selectedEvent?.id === event.id ? styles.timelineEventSelected : ''}`}
                      style={{
                        top,
                        height,
                        backgroundColor: event.color || 'var(--blue-electric)',
                      }}
                      onClick={() => handleEventClick(event)}
                    >
                      <div className={styles.timelineEventContent}>
                        <span className={styles.timelineEventTitle}>{event.title}</span>
                        <span className={styles.timelineEventTime}>
                          {formatTime(event.start)} - {formatTime(event.end)}
                        </span>
                        {event.meetingLink && (
                          <FiVideo className={styles.meetingIcon} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Event Details Popup */}
      {selectedEvent && (
        <div className={styles.eventDetailPopup}>
          <div className={styles.eventDetailPopupHeader}>
            <h4>{selectedEvent.title}</h4>
            <button onClick={() => setSelectedEvent(null)} className={styles.closePopupButton}>
              ×
            </button>
          </div>
          
          <div className={styles.eventDetailPopupContent}>
            <div className={styles.eventDetailRow}>
              <FiClock />
              <span>
                {selectedEvent.allDay
                  ? 'All day'
                  : `${formatTime(selectedEvent.start)} - ${formatTime(selectedEvent.end)}`}
              </span>
            </div>
            
            {selectedEvent.location && (
              <div className={styles.eventDetailRow}>
                <FiMapPin />
                <span>{selectedEvent.location}</span>
              </div>
            )}

            {selectedEvent.description && (
              <div className={styles.eventDescription}>
                <p>{selectedEvent.description}</p>
              </div>
            )}

            {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
              <div className={styles.eventAttendees}>
                <span className={styles.attendeesLabel}>Attendees:</span>
                <div className={styles.attendeesList}>
                  {selectedEvent.attendees.slice(0, 5).map((a, i) => (
                    <span key={i} className={styles.attendee}>
                      {a.name || a.email}
                    </span>
                  ))}
                  {selectedEvent.attendees.length > 5 && (
                    <span className={styles.moreAttendees}>
                      +{selectedEvent.attendees.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={styles.eventDetailPopupActions}>
            {selectedEvent.meetingLink && (
              <button
                className={styles.joinMeetingButton}
                onClick={() => handleJoinMeeting(selectedEvent.meetingLink!)}
              >
                <FiVideo />
                Join Meeting
              </button>
            )}
            {selectedEvent.htmlLink && (
              <button
                className={styles.openCalendarButton}
                onClick={() => window.open(selectedEvent.htmlLink, '_blank', 'noopener,noreferrer')}
              >
                <FiExternalLink />
                Open in Calendar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
