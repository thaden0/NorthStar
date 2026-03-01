'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus, FiEdit2, FiTrash2, FiUpload, FiFile, FiStar,
  FiX, FiDownload, FiTarget, FiAward, FiFileText
} from 'react-icons/fi';
import styles from './jobSearch.module.css';

interface Resume {
  id: string;
  name: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  targetRole: string | null;
  targetIndustry: string | null;
  skills: string[];
  experienceYears: number | null;
  summary: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

interface ResumesTabProps {
  onUpdate: () => void;
}

export default function ResumesTab({ onUpdate }: ResumesTabProps) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    targetRole: '',
    targetIndustry: '',
    skills: '',
    experienceYears: '',
    summary: '',
    isDefault: false,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchResumes = useCallback(async () => {
    try {
      const res = await fetch('/api/job-search/resumes');
      if (res.ok) {
        const data = await res.json();
        setResumes(data);
      }
    } catch {
      console.error('Failed to fetch resumes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const resetForm = () => {
    setFormData({
      name: '',
      targetRole: '',
      targetIndustry: '',
      skills: '',
      experienceYears: '',
      summary: '',
      isDefault: false,
    });
    setSelectedFile(null);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (resume: Resume) => {
    setFormData({
      name: resume.name,
      targetRole: resume.targetRole || '',
      targetIndustry: resume.targetIndustry || '',
      skills: resume.skills.join(', '),
      experienceYears: resume.experienceYears?.toString() || '',
      summary: resume.summary || '',
      isDefault: resume.isDefault,
    });
    setEditingId(resume.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (editingId) {
        // Update metadata only
        const res = await fetch(`/api/job-search/resumes/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            targetRole: formData.targetRole || null,
            targetIndustry: formData.targetIndustry || null,
            skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
            experienceYears: formData.experienceYears ? parseInt(formData.experienceYears) : null,
            summary: formData.summary || null,
            isDefault: formData.isDefault,
          }),
        });
        if (res.ok) {
          resetForm();
          fetchResumes();
          onUpdate();
        }
      } else {
        // Create with file upload
        if (!selectedFile) return;

        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('name', formData.name);
        fd.append('targetRole', formData.targetRole);
        fd.append('targetIndustry', formData.targetIndustry);
        fd.append('skills', formData.skills);
        fd.append('experienceYears', formData.experienceYears);
        fd.append('summary', formData.summary);
        fd.append('isDefault', String(formData.isDefault));

        const res = await fetch('/api/job-search/resumes', {
          method: 'POST',
          body: fd,
        });
        if (res.ok) {
          resetForm();
          fetchResumes();
          onUpdate();
        }
      }
    } catch (error) {
      console.error('Failed to save resume:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this resume?')) return;
    try {
      const res = await fetch(`/api/job-search/resumes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchResumes();
        onUpdate();
      }
    } catch {
      console.error('Failed to delete resume');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/job-search/resumes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) fetchResumes();
    } catch {
      console.error('Failed to set default');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return '📄';
    if (type.includes('word')) return '📝';
    return '📎';
  };

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading resumes...</p>
      </div>
    );
  }

  return (
    <div className={styles.tabPanel}>
      <div className={styles.tabHeader}>
        <div>
          <h2 className={styles.tabTitle}>Resumes</h2>
          <p className={styles.tabDescription}>
            Upload and manage resumes with metadata for AI-powered job matching.
          </p>
        </div>
        <button className={styles.addButton} onClick={() => { resetForm(); setShowForm(true); }}>
          <FiPlus />
          <span>Upload Resume</span>
        </button>
      </div>

      {/* Upload Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className={styles.formCard}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className={styles.formHeader}>
              <h3>{editingId ? 'Edit Resume' : 'Upload Resume'}</h3>
              <button className={styles.formClose} onClick={resetForm}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit} className={styles.form}>
              {/* File Upload */}
              {!editingId && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Resume File *</label>
                  <div
                    className={styles.fileDropZone}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add(styles.dragOver); }}
                    onDragLeave={e => e.currentTarget.classList.remove(styles.dragOver)}
                    onDrop={e => {
                      e.preventDefault();
                      e.currentTarget.classList.remove(styles.dragOver);
                      const file = e.dataTransfer.files[0];
                      if (file) setSelectedFile(file);
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                      hidden
                    />
                    {selectedFile ? (
                      <div className={styles.selectedFile}>
                        <FiFile />
                        <span>{selectedFile.name}</span>
                        <span className={styles.fileSize}>{formatFileSize(selectedFile.size)}</span>
                      </div>
                    ) : (
                      <div className={styles.dropZoneContent}>
                        <FiUpload style={{ fontSize: '2rem' }} />
                        <p>Click or drag to upload</p>
                        <span>PDF, DOC, DOCX (Max 10MB)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Resume Name *</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Full-Stack Developer Resume 2026"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><FiTarget /> Target Role</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={formData.targetRole}
                    onChange={e => setFormData(prev => ({ ...prev, targetRole: e.target.value }))}
                    placeholder="e.g., Senior Full-Stack Developer"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Target Industry</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={formData.targetIndustry}
                    onChange={e => setFormData(prev => ({ ...prev, targetIndustry: e.target.value }))}
                    placeholder="e.g., Technology, SaaS"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><FiAward /> Key Skills (comma separated)</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={formData.skills}
                    onChange={e => setFormData(prev => ({ ...prev, skills: e.target.value }))}
                    placeholder="React, TypeScript, Node.js, AWS"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Years of Experience</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    value={formData.experienceYears}
                    onChange={e => setFormData(prev => ({ ...prev, experienceYears: e.target.value }))}
                    placeholder="e.g., 8"
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label className={styles.formLabel}>Summary</label>
                  <textarea
                    className={styles.formTextarea}
                    value={formData.summary}
                    onChange={e => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                    placeholder="Brief description of this resume's focus and strengths..."
                    rows={3}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={e => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                    />
                    <span>Set as default resume</span>
                  </label>
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.cancelButton} onClick={resetForm}>Cancel</button>
                <button type="submit" className={styles.submitButton} disabled={isSaving || (!editingId && !selectedFile)}>
                  {isSaving ? 'Saving...' : editingId ? 'Update Resume' : 'Upload Resume'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume Cards */}
      {resumes.length === 0 && !showForm ? (
        <div className={styles.emptyState}>
          <FiFileText style={{ fontSize: '3rem', opacity: 0.3 }} />
          <h3>No resumes uploaded</h3>
          <p>Upload your resumes to enable AI-powered job matching and auto-apply.</p>
          <button className={styles.addButton} onClick={() => setShowForm(true)}>
            <FiPlus /> Upload First Resume
          </button>
        </div>
      ) : (
        <div className={styles.resumeGrid}>
          {resumes.map((resume, index) => (
            <motion.div
              key={resume.id}
              className={`${styles.resumeCard} ${resume.isDefault ? styles.resumeDefault : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className={styles.resumeCardTop}>
                <div className={styles.resumeFileIcon}>
                  {getFileIcon(resume.fileType)}
                </div>
                {resume.isDefault && (
                  <div className={styles.defaultStar}>
                    <FiStar />
                    <span>Default</span>
                  </div>
                )}
              </div>

              <h3 className={styles.resumeName}>{resume.name}</h3>
              <p className={styles.resumeFileName}>{resume.fileName} ({formatFileSize(resume.fileSize)})</p>

              {resume.targetRole && (
                <div className={styles.resumeDetail}>
                  <FiTarget /> <span>{resume.targetRole}</span>
                </div>
              )}

              {resume.skills.length > 0 && (
                <div className={styles.resumeSkills}>
                  {resume.skills.slice(0, 5).map(skill => (
                    <span key={skill} className={styles.skillTag}>{skill}</span>
                  ))}
                  {resume.skills.length > 5 && (
                    <span className={styles.skillTag}>+{resume.skills.length - 5}</span>
                  )}
                </div>
              )}

              {resume.summary && (
                <p className={styles.resumeSummary}>{resume.summary}</p>
              )}

              <div className={styles.resumeActions}>
                <a
                  href={resume.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.resumeActionBtn}
                  title="Download"
                >
                  <FiDownload />
                </a>
                {!resume.isDefault && (
                  <button
                    className={styles.resumeActionBtn}
                    onClick={() => handleSetDefault(resume.id)}
                    title="Set as default"
                  >
                    <FiStar />
                  </button>
                )}
                <button className={styles.resumeActionBtn} onClick={() => handleEdit(resume)} title="Edit">
                  <FiEdit2 />
                </button>
                <button
                  className={`${styles.resumeActionBtn} ${styles.deleteBtn}`}
                  onClick={() => handleDelete(resume.id)}
                  title="Delete"
                >
                  <FiTrash2 />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
