'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiPlus, FiEdit2, FiTrash2, FiPlay, FiClock, 
  FiCalendar, FiRepeat, FiToggleLeft, FiToggleRight,
  FiX, FiCheck, FiChevronDown, FiCpu
} from 'react-icons/fi';
import { formatDistanceToNow, format } from 'date-fns';
import { 
  createScheduledTask, 
  updateScheduledTask, 
  deleteScheduledTask,
  toggleScheduledTask,
  triggerScheduledTask,
  type CreateScheduledTaskInput,
  type ScheduleType,
  type RecurringPattern
} from '@/server/notifications/actions';
import styles from './ScheduledTasksList.module.css';

// Types
interface ScheduledTask {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  scheduleType: string;
  cronExpression: string | null;
  scheduledAt: Date | null;
  recurringPattern: string | null;
  recurringDay: number | null;
  recurringTime: string | null;
  timezone: string;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  runCount: number;
  createdAt: Date;
  source: 'local' | 'agent';
}

interface ScheduledTasksListProps {
  initialTasks: ScheduledTask[];
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const RECURRING_PATTERNS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekdays', label: 'Weekdays Only' },
  { value: 'weekends', label: 'Weekends Only' },
];

export default function ScheduledTasksList({ initialTasks }: ScheduledTasksListProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>(initialTasks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [formData, setFormData] = useState<CreateScheduledTaskInput>({
    name: '',
    description: '',
    prompt: '',
    scheduleType: 'recurring',
    cronExpression: '',
    scheduledAt: '',
    recurringPattern: 'weekly',
    recurringDay: 5, // Friday
    recurringTime: '09:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    enabled: true,
  });

  const openModal = (task?: ScheduledTask) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        name: task.name,
        description: task.description || '',
        prompt: task.prompt,
        scheduleType: task.scheduleType as ScheduleType,
        cronExpression: task.cronExpression || '',
        scheduledAt: task.scheduledAt?.toISOString().slice(0, 16) || '',
        recurringPattern: (task.recurringPattern as RecurringPattern) || 'weekly',
        recurringDay: task.recurringDay ?? 5,
        recurringTime: task.recurringTime || '09:00',
        timezone: task.timezone,
        enabled: task.enabled,
      });
    } else {
      setEditingTask(null);
      setFormData({
        name: '',
        description: '',
        prompt: '',
        scheduleType: 'recurring',
        cronExpression: '',
        scheduledAt: '',
        recurringPattern: 'weekly',
        recurringDay: 5,
        recurringTime: '09:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        enabled: true,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    startTransition(async () => {
      try {
        if (editingTask) {
          const updated = await updateScheduledTask(editingTask.id, formData, editingTask.source);
          setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...updated, source: editingTask.source } as ScheduledTask : t));
        } else {
          const created = await createScheduledTask(formData);
          setTasks(prev => [{ ...created, source: 'local' as const }, ...prev]);
        }
        closeModal();
      } catch (error) {
        console.error('Error saving task:', error);
        alert('Failed to save task');
      }
    });
  };

  const handleDelete = async (id: string, source: 'local' | 'agent') => {
    if (!confirm('Are you sure you want to delete this scheduled task?')) return;
    
    startTransition(async () => {
      try {
        await deleteScheduledTask(id, source);
        setTasks(prev => prev.filter(t => t.id !== id));
      } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task');
      }
    });
  };

  const handleToggle = async (id: string, enabled: boolean, source: 'local' | 'agent') => {
    startTransition(async () => {
      try {
        const updated = await toggleScheduledTask(id, !enabled, source);
        setTasks(prev => prev.map(t => t.id === id ? { ...updated, source } as ScheduledTask : t));
      } catch (error) {
        console.error('Error toggling task:', error);
        alert('Failed to toggle task');
      }
    });
  };

  const handleTrigger = async (id: string, source: 'local' | 'agent') => {
    startTransition(async () => {
      try {
        await triggerScheduledTask(id, source);
        alert('Task triggered! Check notifications for results.');
      } catch (error) {
        console.error('Error triggering task:', error);
        alert('Failed to trigger task');
      }
    });
  };

  const getScheduleDescription = (task: ScheduledTask) => {
    switch (task.scheduleType) {
      case 'once':
        return task.scheduledAt 
          ? `Once on ${format(new Date(task.scheduledAt), 'MMM d, yyyy h:mm a')}`
          : 'One-time (date not set)';
      case 'cron':
        return `Cron: ${task.cronExpression}`;
      case 'recurring':
        const pattern = RECURRING_PATTERNS.find(p => p.value === task.recurringPattern)?.label || task.recurringPattern;
        const day = task.recurringDay !== null 
          ? DAYS_OF_WEEK.find(d => d.value === task.recurringDay)?.label 
          : '';
        return `${pattern}${day ? ` on ${day}` : ''} at ${task.recurringTime}`;
      default:
        return 'Unknown schedule';
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Scheduled Tasks</h1>
          <p className={styles.subtitle}>
            Automate AI agent prompts on a schedule
          </p>
        </div>
        <button className={styles.addButton} onClick={() => openModal()}>
          <FiPlus />
          New Task
        </button>
      </div>

      {/* Task List */}
      <div className={styles.list}>
        {tasks.length === 0 ? (
          <div className={styles.empty}>
            <FiClock className={styles.emptyIcon} />
            <h3>No scheduled tasks yet</h3>
            <p>Create your first scheduled task to automate AI prompts</p>
            <button className={styles.emptyButton} onClick={() => openModal()}>
              <FiPlus />
              Create Task
            </button>
          </div>
        ) : (
          tasks.map((task) => (
            <motion.div
              key={task.id}
              className={`${styles.taskCard} ${!task.enabled ? styles.disabled : ''}`}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className={styles.taskHeader}>
                <div className={styles.taskInfo}>
                  <h3>
                    {task.name}
                    {task.source === 'agent' && (
                      <span className={styles.aiBadge} title="Created by AI">
                        <FiCpu /> AI
                      </span>
                    )}
                  </h3>
                  {task.description && <p className={styles.taskDesc}>{task.description}</p>}
                </div>
                <div className={styles.taskActions}>
                  <button
                    className={styles.toggleBtn}
                    onClick={() => handleToggle(task.id, task.enabled, task.source)}
                    disabled={isPending}
                    title={task.enabled ? 'Disable' : 'Enable'}
                  >
                    {task.enabled ? <FiToggleRight className={styles.toggleOn} /> : <FiToggleLeft />}
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleTrigger(task.id, task.source)}
                    disabled={isPending}
                    title="Run Now"
                  >
                    <FiPlay />
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => openModal(task)}
                    disabled={isPending}
                    title="Edit"
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    onClick={() => handleDelete(task.id, task.source)}
                    disabled={isPending}
                    title="Delete"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>

              <div className={styles.taskPrompt}>
                <span className={styles.promptLabel}>Prompt:</span>
                <p>{task.prompt}</p>
              </div>

              <div className={styles.taskMeta}>
                <div className={styles.metaItem}>
                  <FiRepeat />
                  <span>{getScheduleDescription(task)}</span>
                </div>
                {task.nextRunAt && task.enabled && (
                  <div className={styles.metaItem}>
                    <FiCalendar />
                    <span>Next: {formatDistanceToNow(new Date(task.nextRunAt), { addSuffix: true })}</span>
                  </div>
                )}
                {task.lastRunAt && (
                  <div className={styles.metaItem}>
                    <FiClock />
                    <span>Last: {formatDistanceToNow(new Date(task.lastRunAt), { addSuffix: true })}</span>
                  </div>
                )}
                <div className={styles.metaItem}>
                  <span className={styles.runCount}>{task.runCount} runs</span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2>{editingTask ? 'Edit Task' : 'Create Scheduled Task'}</h2>
                <button className={styles.closeBtn} onClick={closeModal}>
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="name">Task Name</label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Weekly Gaming News Report"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="description">Description (optional)</label>
                  <input
                    type="text"
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Searches for latest gaming news"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="prompt">AI Prompt</label>
                  <textarea
                    id="prompt"
                    value={formData.prompt}
                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                    placeholder="Search the internet for news about Shooting Games and send me a detailed report on current news."
                    rows={4}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Schedule Type</label>
                  <div className={styles.scheduleTypeButtons}>
                    {(['once', 'recurring', 'cron'] as ScheduleType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`${styles.typeBtn} ${formData.scheduleType === type ? styles.active : ''}`}
                        onClick={() => setFormData({ ...formData, scheduleType: type })}
                      >
                        {type === 'once' && <FiCalendar />}
                        {type === 'recurring' && <FiRepeat />}
                        {type === 'cron' && <FiClock />}
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* One-time options */}
                {formData.scheduleType === 'once' && (
                  <div className={styles.formGroup}>
                    <label htmlFor="scheduledAt">Date & Time</label>
                    <input
                      type="datetime-local"
                      id="scheduledAt"
                      value={formData.scheduledAt}
                      onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                      required
                    />
                  </div>
                )}

                {/* Recurring options */}
                {formData.scheduleType === 'recurring' && (
                  <>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label htmlFor="recurringPattern">Repeat</label>
                        <div className={styles.selectWrapper}>
                          <select
                            id="recurringPattern"
                            value={formData.recurringPattern}
                            onChange={(e) => setFormData({ ...formData, recurringPattern: e.target.value as RecurringPattern })}
                          >
                            {RECURRING_PATTERNS.map((p) => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>
                          <FiChevronDown className={styles.selectIcon} />
                        </div>
                      </div>

                      {(formData.recurringPattern === 'weekly' || formData.recurringPattern === 'biweekly') && (
                        <div className={styles.formGroup}>
                          <label htmlFor="recurringDay">Day</label>
                          <div className={styles.selectWrapper}>
                            <select
                              id="recurringDay"
                              value={formData.recurringDay}
                              onChange={(e) => setFormData({ ...formData, recurringDay: parseInt(e.target.value) })}
                            >
                              {DAYS_OF_WEEK.map((d) => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                              ))}
                            </select>
                            <FiChevronDown className={styles.selectIcon} />
                          </div>
                        </div>
                      )}

                      {formData.recurringPattern === 'monthly' && (
                        <div className={styles.formGroup}>
                          <label htmlFor="recurringDay">Day of Month</label>
                          <input
                            type="number"
                            id="recurringDay"
                            min={1}
                            max={31}
                            value={formData.recurringDay}
                            onChange={(e) => setFormData({ ...formData, recurringDay: parseInt(e.target.value) })}
                          />
                        </div>
                      )}
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="recurringTime">Time</label>
                      <input
                        type="time"
                        id="recurringTime"
                        value={formData.recurringTime}
                        onChange={(e) => setFormData({ ...formData, recurringTime: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}

                {/* Cron options */}
                {formData.scheduleType === 'cron' && (
                  <div className={styles.formGroup}>
                    <label htmlFor="cronExpression">Cron Expression</label>
                    <input
                      type="text"
                      id="cronExpression"
                      value={formData.cronExpression}
                      onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                      placeholder="0 9 * * 5 (Every Friday at 9 AM)"
                      required
                    />
                    <span className={styles.hint}>
                      Format: minute hour day-of-month month day-of-week
                    </span>
                  </div>
                )}

                <div className={styles.formActions}>
                  <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.submitBtn} disabled={isPending}>
                    {isPending ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
                    {!isPending && <FiCheck />}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
