'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FiPlus, FiEdit2, FiTrash2, FiBook, FiX, FiCheck, FiCalendar } from 'react-icons/fi';
import { createEducationAction, updateEducationAction, deleteEducationAction } from '@/server/portfolio/actions';
import styles from '../portfolio.module.css';

interface Education {
  id: string;
  degree: string;
  institution: string;
  startYear: string;
  endYear: string | null;
  description: string | null;
  order: number;
}

interface Props {
  initialEducation: Education[];
}

export default function EducationList({ initialEducation }: Props) {
  const [education, setEducation] = useState<Education[]>(initialEducation);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Education | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Education | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    
    try {
      let result;
      if (editingItem) {
        result = await updateEducationAction(editingItem.id, formData);
      } else {
        result = await createEducationAction(formData);
      }

      if (result.success) {
        toast.success(editingItem ? 'Education updated' : 'Education added');
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
      const result = await deleteEducationAction(deleteConfirm.id);
      if (result.success) {
        toast.success('Education deleted');
        setEducation(education.filter(e => e.id !== deleteConfirm.id));
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

  function openEdit(item: Education) {
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
          <FiPlus /> Add Education
        </button>
      </div>

      {education.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><FiBook /></div>
            <p className={styles.emptyText}>No education entries yet</p>
            <button className={styles.addBtn} onClick={openCreate}>
              <FiPlus /> Add Your First Entry
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.cardContent}>
            <div className={styles.list}>
              {education.map((item) => (
                <div key={item.id} className={styles.listItem}>
                  <span className={styles.orderBadge}>{item.order}</span>
                  <div 
                    className={styles.listItemIcon}
                    style={{ background: 'linear-gradient(135deg, #22D3EE, #0891B2)' }}
                  >
                    <FiBook />
                  </div>
                  <div className={styles.listItemContent}>
                    <h3 className={styles.listItemTitle}>{item.degree}</h3>
                    <div className={styles.listItemMeta}>
                      <span className={styles.listItemMetaItem}>{item.institution}</span>
                      <span className={styles.listItemMetaItem}>
                        <FiCalendar style={{ marginRight: '4px' }} />
                        {item.startYear} – {item.endYear || 'Present'}
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
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingItem ? 'Edit Education' : 'Add Education'}
              </h2>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label htmlFor="degree">Degree / Certification</label>
                  <input
                    id="degree"
                    name="degree"
                    type="text"
                    defaultValue={editingItem?.degree || ''}
                    className={styles.input}
                    placeholder="e.g., Bachelor of Science in Computer Science"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="institution">Institution</label>
                  <input
                    id="institution"
                    name="institution"
                    type="text"
                    defaultValue={editingItem?.institution || ''}
                    className={styles.input}
                    placeholder="e.g., University of Example"
                    required
                  />
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="startYear">Start Year</label>
                    <input
                      id="startYear"
                      name="startYear"
                      type="text"
                      defaultValue={editingItem?.startYear || ''}
                      className={styles.input}
                      placeholder="e.g., 2018"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="endYear">End Year</label>
                    <input
                      id="endYear"
                      name="endYear"
                      type="text"
                      defaultValue={editingItem?.endYear || ''}
                      className={styles.input}
                      placeholder="e.g., 2022 (leave empty if ongoing)"
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
                    placeholder="Additional details about your education..."
                  />
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
              <h2 className={styles.modalTitle}>Delete Education</h2>
              <button className={styles.modalClose} onClick={() => setDeleteConfirm(null)}>
                <FiX />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.deleteConfirmText}>
                Are you sure you want to delete <span className={styles.deleteConfirmName}>{deleteConfirm.degree}</span>? 
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
