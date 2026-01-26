'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FiPlus, FiEdit2, FiTrash2, FiFolder, FiX, FiCheck, FiExternalLink, FiGithub, FiStar } from 'react-icons/fi';
import { createProjectAction, updateProjectAction, deleteProjectAction } from '@/server/portfolio/actions';
import styles from '../portfolio.module.css';

interface Project {
  id: string;
  title: string;
  description: string;
  image: string | null;
  technologies: string[];
  liveUrl: string | null;
  sourceUrl: string | null;
  featured: boolean;
  order: number;
}

interface Props {
  initialProjects: Project[];
}

export default function ProjectsList({ initialProjects }: Props) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  const filteredProjects = showFeaturedOnly 
    ? projects.filter(p => p.featured)
    : projects;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    
    try {
      let result;
      if (editingItem) {
        result = await updateProjectAction(editingItem.id, formData);
      } else {
        result = await createProjectAction(formData);
      }

      if (result.success) {
        toast.success(editingItem ? 'Project updated' : 'Project added');
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
      const result = await deleteProjectAction(deleteConfirm.id);
      if (result.success) {
        toast.success('Project deleted');
        setProjects(projects.filter(p => p.id !== deleteConfirm.id));
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

  function openEdit(item: Project) {
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
        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${!showFeaturedOnly ? styles.tabActive : ''}`}
            onClick={() => setShowFeaturedOnly(false)}
          >
            All ({projects.length})
          </button>
          <button 
            className={`${styles.tab} ${showFeaturedOnly ? styles.tabActive : ''}`}
            onClick={() => setShowFeaturedOnly(true)}
          >
            <FiStar style={{ marginRight: '4px' }} />
            Featured ({projects.filter(p => p.featured).length})
          </button>
        </div>
        <button className={styles.addBtn} onClick={openCreate}>
          <FiPlus /> Add Project
        </button>
      </div>

      {filteredProjects.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><FiFolder /></div>
            <p className={styles.emptyText}>
              {showFeaturedOnly ? 'No featured projects yet' : 'No projects yet'}
            </p>
            <button className={styles.addBtn} onClick={openCreate}>
              <FiPlus /> Add Your First Project
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.cardContent}>
            <div className={styles.list}>
              {filteredProjects.map((item) => (
                <div key={item.id} className={styles.listItem}>
                  <span className={styles.orderBadge}>{item.order}</span>
                  <div 
                    className={styles.listItemIcon}
                    style={{ background: 'linear-gradient(135deg, #F472B6, #DB2777)' }}
                  >
                    <FiFolder />
                  </div>
                  <div className={styles.listItemContent}>
                    <h3 className={styles.listItemTitle}>
                      {item.title}
                      {item.featured && (
                        <span className={styles.featuredBadge} style={{ marginLeft: '8px' }}>
                          <FiStar /> Featured
                        </span>
                      )}
                    </h3>
                    <div className={styles.listItemMeta}>
                      {item.technologies.slice(0, 3).map(tech => (
                        <span key={tech} className={styles.listItemBadge}>{tech}</span>
                      ))}
                      {item.technologies.length > 3 && (
                        <span className={styles.listItemMetaItem}>+{item.technologies.length - 3} more</span>
                      )}
                      {item.liveUrl && (
                        <a 
                          href={item.liveUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className={styles.listItemMetaItem}
                          style={{ color: 'var(--blue-ice)' }}
                          onClick={e => e.stopPropagation()}
                        >
                          <FiExternalLink style={{ marginRight: '4px' }} /> Live
                        </a>
                      )}
                      {item.sourceUrl && (
                        <a 
                          href={item.sourceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className={styles.listItemMetaItem}
                          onClick={e => e.stopPropagation()}
                        >
                          <FiGithub style={{ marginRight: '4px' }} /> Source
                        </a>
                      )}
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
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingItem ? 'Edit Project' : 'Add Project'}
              </h2>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label htmlFor="title">Project Title</label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    defaultValue={editingItem?.title || ''}
                    className={styles.input}
                    placeholder="e.g., E-Commerce Platform"
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
                    placeholder="Describe what the project does and your role..."
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="image">Image URL</label>
                  <input
                    id="image"
                    name="image"
                    type="text"
                    defaultValue={editingItem?.image || ''}
                    className={styles.input}
                    placeholder="https://example.com/project-screenshot.jpg"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="technologies">Technologies</label>
                  <input
                    id="technologies"
                    name="technologies"
                    type="text"
                    defaultValue={editingItem?.technologies.join(', ') || ''}
                    className={styles.input}
                    placeholder="e.g., React, Node.js, PostgreSQL"
                  />
                  <span className={styles.hint}>Comma-separated list of technologies used</span>
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="liveUrl">Live Demo URL</label>
                    <input
                      id="liveUrl"
                      name="liveUrl"
                      type="url"
                      defaultValue={editingItem?.liveUrl || ''}
                      className={styles.input}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="sourceUrl">Source Code URL</label>
                    <input
                      id="sourceUrl"
                      name="sourceUrl"
                      type="url"
                      defaultValue={editingItem?.sourceUrl || ''}
                      className={styles.input}
                      placeholder="https://github.com/..."
                    />
                  </div>
                </div>
                <div className={styles.formGrid}>
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
                  <div className={styles.formGroup}>
                    <label>&nbsp;</label>
                    <label className={styles.checkbox}>
                      <input
                        type="checkbox"
                        name="featured"
                        value="true"
                        defaultChecked={editingItem?.featured || false}
                      />
                      <span>Featured Project</span>
                    </label>
                    <span className={styles.hint}>Featured projects are shown on the homepage</span>
                  </div>
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
              <h2 className={styles.modalTitle}>Delete Project</h2>
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
