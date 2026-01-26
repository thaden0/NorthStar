'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FiPlus, FiEdit2, FiTrash2, FiHelpCircle, FiX, FiCheck } from 'react-icons/fi';
import { createFaqAction, updateFaqAction, deleteFaqAction } from '@/server/portfolio/actions';
import styles from '../portfolio.module.css';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  order: number;
}

interface Props {
  initialFaqs: FAQ[];
}

export default function FaqsList({ initialFaqs }: Props) {
  const [faqs, setFaqs] = useState<FAQ[]>(initialFaqs);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FAQ | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FAQ | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    
    try {
      let result;
      if (editingItem) {
        result = await updateFaqAction(editingItem.id, formData);
      } else {
        result = await createFaqAction(formData);
      }

      if (result.success) {
        toast.success(editingItem ? 'FAQ updated' : 'FAQ added');
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
      const result = await deleteFaqAction(deleteConfirm.id);
      if (result.success) {
        toast.success('FAQ deleted');
        setFaqs(faqs.filter(f => f.id !== deleteConfirm.id));
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

  function openEdit(item: FAQ) {
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
          <FiPlus /> Add FAQ
        </button>
      </div>

      {faqs.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><FiHelpCircle /></div>
            <p className={styles.emptyText}>No FAQs yet</p>
            <button className={styles.addBtn} onClick={openCreate}>
              <FiPlus /> Add Your First FAQ
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.cardContent}>
            <div className={styles.list}>
              {faqs.map((item) => (
                <div key={item.id} className={styles.listItem}>
                  <span className={styles.orderBadge}>{item.order}</span>
                  <div 
                    className={styles.listItemIcon}
                    style={{ background: 'linear-gradient(135deg, #A855F7, #9333EA)' }}
                  >
                    <FiHelpCircle />
                  </div>
                  <div className={styles.listItemContent}>
                    <h3 className={styles.listItemTitle}>{item.question}</h3>
                    <div className={styles.listItemMeta}>
                      <span className={styles.listItemMetaItem} style={{ 
                        maxWidth: '500px', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.answer.slice(0, 100)}{item.answer.length > 100 ? '...' : ''}
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
                {editingItem ? 'Edit FAQ' : 'Add FAQ'}
              </h2>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label htmlFor="question">Question</label>
                  <input
                    id="question"
                    name="question"
                    type="text"
                    defaultValue={editingItem?.question || ''}
                    className={styles.input}
                    placeholder="e.g., What is your availability?"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="answer">Answer</label>
                  <textarea
                    id="answer"
                    name="answer"
                    defaultValue={editingItem?.answer || ''}
                    className={`${styles.textarea} ${styles.textareaLarge}`}
                    placeholder="Provide a clear, helpful answer..."
                    required
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
              <h2 className={styles.modalTitle}>Delete FAQ</h2>
              <button className={styles.modalClose} onClick={() => setDeleteConfirm(null)}>
                <FiX />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.deleteConfirmText}>
                Are you sure you want to delete this FAQ? 
                This action cannot be undone.
              </p>
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 'var(--space-2)' }}>
                &quot;{deleteConfirm.question}&quot;
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
