'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FiPlus, FiEdit2, FiTrash2, FiBriefcase, FiX, FiCheck, FiCalendar, FiMapPin } from 'react-icons/fi';
import { createExperienceAction, updateExperienceAction, deleteExperienceAction } from '@/server/portfolio/actions';
import styles from '../portfolio.module.css';

interface Experience {
  id: string;
  title: string;
  company: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
  highlights: string[];
  order: number;
}

interface Props {
  initialExperience: Experience[];
}

export default function ExperienceList({ initialExperience }: Props) {
  const [experience, setExperience] = useState<Experience[]>(initialExperience);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Experience | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Experience | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    
    try {
      let result;
      if (editingItem) {
        result = await updateExperienceAction(editingItem.id, formData);
      } else {
        result = await createExperienceAction(formData);
      }

      if (result.success) {
        toast.success(editingItem ? 'Experience updated' : 'Experience added');
        setShowModal(false);
        setEditingItem(null);
        window.location.reload();
      } else {
        toast.error(result.error || 'Something went wrong');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setIsSubmitting(true);

    try {
      const result = await deleteExperienceAction(deleteConfirm.id);
      if (result.success) {
        toast.success('Experience deleted');
        setExperience(experience.filter(e => e.id !== deleteConfirm.id));
        setDeleteConfirm(null);
      } else {
        toast.error(result.error || 'Failed to delete');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEdit(item: Experience) {
    setEditingItem(item);
    setShowModal(true);
  }

  function openCreate() {
    setEditingItem(null);
    setShowModal(true);
  }

  return (
    <>
      <div className={styles.listHeader}>
        <div />
        <button className={styles.addBtn} onClick={openCreate}>
          <FiPlus /> Add Experience
        </button>
      </div>

      {experience.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><FiBriefcase /></div>
            <p className={styles.emptyText}>No experience entries yet</p>
            <button className={styles.addBtn} onClick={openCreate}>
              <FiPlus /> Add Your First Position
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.cardContent}>
            <div className={styles.list}>
              {experience.map((item) => (
                <div key={item.id} className={styles.listItem}>
                  <span className={styles.orderBadge}>{item.order}</span>
                  <div 
                    className={styles.listItemIcon}
                    style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
                  >
                    <FiBriefcase />
                  </div>
                  <div className={styles.listItemContent}>
                    <h3 className={styles.listItemTitle}>{item.title}</h3>
                    <div className={styles.listItemMeta}>
                      <span className={styles.listItemMetaItem}>{item.company}</span>
                      {item.location && (
                        <span className={styles.listItemMetaItem}>
                          <FiMapPin style={{ marginRight: '4px' }} />
                          {item.location}
                        </span>
                      )}
                      <span className={styles.listItemMetaItem}>
                        <FiCalendar style={{ marginRight: '4px' }} />
                        {item.startDate} – {item.endDate || 'Present'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.listItemActions}>
                    <button 
                      className={styles.actionBtn} 
                      onClick={() => openEdit(item)}
                      title="Edit"
                    >
                      <FiEdit2 />
                    </button>
                    <button 
                      className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                      onClick={() => setDeleteConfirm(item)}
                      title="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className={styles.modal} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingItem ? 'Edit Experience' : 'Add Experience'}
              </h2>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label htmlFor="title">Job Title</label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    defaultValue={editingItem?.title || ''}
                    className={styles.input}
                    placeholder="e.g., Senior Software Engineer"
                    required
                  />
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="company">Company</label>
                    <input
                      id="company"
                      name="company"
                      type="text"
                      defaultValue={editingItem?.company || ''}
                      className={styles.input}
                      placeholder="e.g., Example Corp"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="location">Location</label>
                    <input
                      id="location"
                      name="location"
                      type="text"
                      defaultValue={editingItem?.location || ''}
                      className={styles.input}
                      placeholder="e.g., Remote, New York, NY"
                    />
                  </div>
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="startDate">Start Date</label>
                    <input
                      id="startDate"
                      name="startDate"
                      type="text"
                      defaultValue={editingItem?.startDate || ''}
                      className={styles.input}
                      placeholder="e.g., Jan 2020"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="endDate">End Date</label>
                    <input
                      id="endDate"
                      name="endDate"
                      type="text"
                      defaultValue={editingItem?.endDate || ''}
                      className={styles.input}
                      placeholder="e.g., Present (leave empty if current)"
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="description">Description (Optional)</label>
                  <textarea
                    id="description"
                    name="description"
                    defaultValue={editingItem?.description || ''}
                    className={styles.textarea}
                    placeholder="Brief description of the role..."
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="highlights">Key Achievements</label>
                  <textarea
                    id="highlights"
                    name="highlights"
                    defaultValue={editingItem?.highlights.join('\n') || ''}
                    className={`${styles.textarea} ${styles.textareaLarge}`}
                    placeholder="Enter each achievement on a new line...&#10;• Led a team of 5 developers&#10;• Increased performance by 40%&#10;• Designed microservices architecture"
                  />
                  <span className={styles.hint}>Enter each bullet point on a new line. These will appear as a list on your resume.</span>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="order">Display Order</label>
                  <input
                    id="order"
                    name="order"
                    type="number"
                    defaultValue={editingItem?.order ?? 0}
                    className={styles.input}
                    min="0"
                  />
                  <span className={styles.hint}>Lower numbers appear first</span>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                  {isSubmitting ? <span className={styles.spinner} /> : <><FiCheck /> {editingItem ? 'Update' : 'Create'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className={styles.modal} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Delete Experience</h2>
              <button className={styles.modalClose} onClick={() => setDeleteConfirm(null)}>
                <FiX />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.deleteConfirmText}>
                Are you sure you want to delete <span className={styles.deleteConfirmName}>{deleteConfirm.title} at {deleteConfirm.company}</span>? 
                This action cannot be undone.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button className={styles.deleteBtn} onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? <span className={styles.spinner} /> : <><FiTrash2 /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
