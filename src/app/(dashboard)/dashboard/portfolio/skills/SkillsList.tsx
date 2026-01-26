'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FiPlus, FiEdit2, FiTrash2, FiCode, FiBox, FiTool, FiX, FiCheck } from 'react-icons/fi';
import { createSkillAction, updateSkillAction, deleteSkillAction } from '@/server/portfolio/actions';
import styles from '../portfolio.module.css';

interface Skill {
  id: string;
  name: string;
  category: string;
  icon: string | null;
  order: number;
}

interface Props {
  initialSkills: Skill[];
}

const categoryIcons: Record<string, React.ReactNode> = {
  languages: <FiCode />,
  frameworks: <FiBox />,
  tools: <FiTool />,
};

const categoryColors: Record<string, string> = {
  languages: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
  frameworks: 'linear-gradient(135deg, #3B82F6, #2563EB)',
  tools: 'linear-gradient(135deg, #22C55E, #16A34A)',
};

export default function SkillsList({ initialSkills }: Props) {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [showModal, setShowModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Skill | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredSkills = activeCategory 
    ? skills.filter(s => s.category === activeCategory)
    : skills;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    
    try {
      let result;
      if (editingSkill) {
        result = await updateSkillAction(editingSkill.id, formData);
      } else {
        result = await createSkillAction(formData);
      }

      if (result.success) {
        toast.success(editingSkill ? 'Skill updated' : 'Skill created');
        setShowModal(false);
        setEditingSkill(null);
        // Refresh the page data
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
      const result = await deleteSkillAction(deleteConfirm.id);
      if (result.success) {
        toast.success('Skill deleted');
        setSkills(skills.filter(s => s.id !== deleteConfirm.id));
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

  function openEdit(skill: Skill) {
    setEditingSkill(skill);
    setShowModal(true);
  }

  function openCreate() {
    setEditingSkill(null);
    setShowModal(true);
  }

  const categories = ['languages', 'frameworks', 'tools'];

  return (
    <>
      <div className={styles.listHeader}>
        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeCategory === null ? styles.tabActive : ''}`}
            onClick={() => setActiveCategory(null)}
          >
            All ({skills.length})
          </button>
          {categories.map(cat => (
            <button 
              key={cat}
              className={`${styles.tab} ${activeCategory === cat ? styles.tabActive : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)} ({skills.filter(s => s.category === cat).length})
            </button>
          ))}
        </div>
        <button className={styles.addBtn} onClick={openCreate}>
          <FiPlus /> Add Skill
        </button>
      </div>

      {filteredSkills.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><FiCode /></div>
            <p className={styles.emptyText}>No skills yet</p>
            <button className={styles.addBtn} onClick={openCreate}>
              <FiPlus /> Add Your First Skill
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.cardContent}>
            <div className={styles.list}>
              {filteredSkills.map((skill) => (
                <div key={skill.id} className={styles.listItem}>
                  <span className={styles.orderBadge}>{skill.order}</span>
                  <div 
                    className={styles.listItemIcon}
                    style={{ background: categoryColors[skill.category] }}
                  >
                    {categoryIcons[skill.category]}
                  </div>
                  <div className={styles.listItemContent}>
                    <h3 className={styles.listItemTitle}>{skill.name}</h3>
                    <div className={styles.listItemMeta}>
                      <span className={styles.listItemBadge}>{skill.category}</span>
                      {skill.icon && (
                        <span className={styles.listItemMetaItem}>Icon: {skill.icon}</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.listItemActions}>
                    <button 
                      className={styles.actionBtn} 
                      onClick={() => openEdit(skill)}
                      title="Edit"
                    >
                      <FiEdit2 />
                    </button>
                    <button 
                      className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                      onClick={() => setDeleteConfirm(skill)}
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
                {editingSkill ? 'Edit Skill' : 'Add Skill'}
              </h2>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label htmlFor="name">Skill Name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    defaultValue={editingSkill?.name || ''}
                    className={styles.input}
                    placeholder="e.g., TypeScript"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="category">Category</label>
                  <select
                    id="category"
                    name="category"
                    defaultValue={editingSkill?.category || 'languages'}
                    className={styles.select}
                    required
                  >
                    <option value="languages">Languages</option>
                    <option value="frameworks">Frameworks</option>
                    <option value="tools">Tools</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="icon">Icon Name</label>
                  <input
                    id="icon"
                    name="icon"
                    type="text"
                    defaultValue={editingSkill?.icon || ''}
                    className={styles.input}
                    placeholder="e.g., SiTypescript"
                  />
                  <span className={styles.hint}>
                    Use react-icons/si names like SiTypescript, SiReact, SiDocker
                  </span>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="order">Display Order</label>
                  <input
                    id="order"
                    name="order"
                    type="number"
                    defaultValue={editingSkill?.order ?? 0}
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
                  {isSubmitting ? <span className={styles.spinner} /> : <><FiCheck /> {editingSkill ? 'Update' : 'Create'}</>}
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
              <h2 className={styles.modalTitle}>Delete Skill</h2>
              <button className={styles.modalClose} onClick={() => setDeleteConfirm(null)}>
                <FiX />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.deleteConfirmText}>
                Are you sure you want to delete <span className={styles.deleteConfirmName}>{deleteConfirm.name}</span>? 
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
