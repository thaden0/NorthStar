'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FiPlus, FiEdit2, FiTrash2, FiTool, FiX, FiCheck } from 'react-icons/fi';
import { createServiceAction, updateServiceAction, deleteServiceAction } from '@/server/portfolio/actions';
import styles from '../portfolio.module.css';

interface Service {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  order: number;
}

interface Props {
  initialServices: Service[];
}

export default function ServicesList({ initialServices }: Props) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Service | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Service | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    
    try {
      let result;
      if (editingItem) {
        result = await updateServiceAction(editingItem.id, formData);
      } else {
        result = await createServiceAction(formData);
      }

      if (result.success) {
        toast.success(editingItem ? 'Service updated' : 'Service added');
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
      const result = await deleteServiceAction(deleteConfirm.id);
      if (result.success) {
        toast.success('Service deleted');
        setServices(services.filter(s => s.id !== deleteConfirm.id));
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

  function openEdit(item: Service) {
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
          <FiPlus /> Add Service
        </button>
      </div>

      {services.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><FiTool /></div>
            <p className={styles.emptyText}>No services yet</p>
            <button className={styles.addBtn} onClick={openCreate}>
              <FiPlus /> Add Your First Service
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.cardContent}>
            <div className={styles.list}>
              {services.map((item) => (
                <div key={item.id} className={styles.listItem}>
                  <span className={styles.orderBadge}>{item.order}</span>
                  <div 
                    className={styles.listItemIcon}
                    style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
                  >
                    <FiTool />
                  </div>
                  <div className={styles.listItemContent}>
                    <h3 className={styles.listItemTitle}>{item.title}</h3>
                    <div className={styles.listItemMeta}>
                      <span className={styles.listItemMetaItem} style={{ 
                        maxWidth: '400px', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.description.slice(0, 80)}{item.description.length > 80 ? '...' : ''}
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
                {editingItem ? 'Edit Service' : 'Add Service'}
              </h2>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label htmlFor="title">Service Title</label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    defaultValue={editingItem?.title || ''}
                    className={styles.input}
                    placeholder="e.g., Full-Stack Development"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    defaultValue={editingItem?.description || ''}
                    className={`${styles.textarea} ${styles.textareaLarge}`}
                    placeholder="Describe what this service includes..."
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="icon">Icon (Optional)</label>
                  <input
                    id="icon"
                    name="icon"
                    type="text"
                    defaultValue={editingItem?.icon || ''}
                    className={styles.input}
                    placeholder="e.g., ⚡ or FiCode"
                  />
                  <span className={styles.hint}>Use an emoji or react-icons name</span>
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
              <h2 className={styles.modalTitle}>Delete Service</h2>
              <button className={styles.modalClose} onClick={() => setDeleteConfirm(null)}>
                <FiX />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.deleteConfirmText}>
                Are you sure you want to delete <span className={styles.deleteConfirmName}>{deleteConfirm.title}</span>? 
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
