'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus, FiEdit2, FiTrash2, FiMapPin, FiDollarSign,
  FiTag, FiGlobe, FiClock, FiChevronDown, FiChevronUp,
  FiCheck, FiX, FiSearch, FiToggleLeft, FiToggleRight
} from 'react-icons/fi';
import styles from './jobSearch.module.css';

interface JobSearch {
  id: string;
  name: string;
  keywords: string[];
  location: string | null;
  remote: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string;
  experienceLevel: string | null;
  jobType: string;
  industry: string | null;
  companySize: string | null;
  excludeKeywords: string[];
  sources: string[];
  isActive: boolean;
  lastScrapedAt: string | null;
  createdAt: string;
  _count: { jobs: number };
}

interface SearchesTabProps {
  onUpdate: () => void;
}

const REMOTE_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

const JOB_TYPE_OPTIONS = [
  { value: 'fulltime', label: 'Full-time' },
  { value: 'parttime', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];

const EXPERIENCE_OPTIONS = [
  { value: '', label: 'Any Level' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'executive', label: 'Executive' },
];

const SALARY_PERIOD_OPTIONS = [
  { value: 'yearly', label: 'Per Year' },
  { value: 'monthly', label: 'Per Month' },
  { value: 'hourly', label: 'Per Hour' },
];

export default function SearchesTab({ onUpdate }: SearchesTabProps) {
  const [searches, setSearches] = useState<JobSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    keywords: '',
    location: '',
    remote: 'any',
    salaryMin: '',
    salaryMax: '',
    salaryPeriod: 'yearly',
    experienceLevel: '',
    jobType: 'fulltime',
    industry: '',
    companySize: '',
    excludeKeywords: '',
    sources: ['indeed', 'linkedin'],
  });

  const fetchSearches = useCallback(async () => {
    try {
      const res = await fetch('/api/job-search/searches');
      if (res.ok) {
        const data = await res.json();
        setSearches(data);
      }
    } catch {
      console.error('Failed to fetch searches');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  const resetForm = () => {
    setFormData({
      name: '',
      keywords: '',
      location: '',
      remote: 'any',
      salaryMin: '',
      salaryMax: '',
      salaryPeriod: 'yearly',
      experienceLevel: '',
      jobType: 'fulltime',
      industry: '',
      companySize: '',
      excludeKeywords: '',
      sources: ['indeed', 'linkedin'],
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (search: JobSearch) => {
    setFormData({
      name: search.name,
      keywords: search.keywords.join(', '),
      location: search.location || '',
      remote: search.remote,
      salaryMin: search.salaryMin?.toString() || '',
      salaryMax: search.salaryMax?.toString() || '',
      salaryPeriod: search.salaryPeriod,
      experienceLevel: search.experienceLevel || '',
      jobType: search.jobType,
      industry: search.industry || '',
      companySize: search.companySize || '',
      excludeKeywords: search.excludeKeywords.join(', '),
      sources: search.sources,
    });
    setEditingId(search.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const payload = {
      name: formData.name,
      keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
      location: formData.location || null,
      remote: formData.remote,
      salaryMin: formData.salaryMin || null,
      salaryMax: formData.salaryMax || null,
      salaryPeriod: formData.salaryPeriod,
      experienceLevel: formData.experienceLevel || null,
      jobType: formData.jobType,
      industry: formData.industry || null,
      companySize: formData.companySize || null,
      excludeKeywords: formData.excludeKeywords.split(',').map(k => k.trim()).filter(Boolean),
      sources: formData.sources,
    };

    try {
      const url = editingId 
        ? `/api/job-search/searches/${editingId}`
        : '/api/job-search/searches';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        resetForm();
        fetchSearches();
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to save search:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this job search and all associated jobs?')) return;
    
    try {
      const res = await fetch(`/api/job-search/searches/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSearches();
        onUpdate();
      }
    } catch {
      console.error('Failed to delete search');
    }
  };

  const handleToggleActive = async (search: JobSearch) => {
    try {
      const res = await fetch(`/api/job-search/searches/${search.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !search.isActive }),
      });
      if (res.ok) fetchSearches();
    } catch {
      console.error('Failed to toggle search');
    }
  };

  const toggleSource = (source: string) => {
    setFormData(prev => ({
      ...prev,
      sources: prev.sources.includes(source)
        ? prev.sources.filter(s => s !== source)
        : [...prev.sources, source],
    }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading searches...</p>
      </div>
    );
  }

  return (
    <div className={styles.tabPanel}>
      {/* Add Search Button */}
      <div className={styles.tabHeader}>
        <div>
          <h2 className={styles.tabTitle}>Job Searches</h2>
          <p className={styles.tabDescription}>
            Create search criteria to automatically find relevant jobs from Indeed and LinkedIn.
          </p>
        </div>
        <button className={styles.addButton} onClick={() => { resetForm(); setShowForm(true); }}>
          <FiPlus />
          <span>New Search</span>
        </button>
      </div>

      {/* Search Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className={styles.formCard}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className={styles.formHeader}>
              <h3>{editingId ? 'Edit Search' : 'New Job Search'}</h3>
              <button className={styles.formClose} onClick={resetForm}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Search Name *</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Senior React Developer Remote"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Keywords * (comma separated)</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={formData.keywords}
                    onChange={e => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                    placeholder="React, TypeScript, Senior, Full-Stack"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><FiMapPin /> Location</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Toronto, ON or Remote"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><FiGlobe /> Remote Preference</label>
                  <select
                    className={styles.formSelect}
                    value={formData.remote}
                    onChange={e => setFormData(prev => ({ ...prev, remote: e.target.value }))}
                  >
                    {REMOTE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Job Type</label>
                  <select
                    className={styles.formSelect}
                    value={formData.jobType}
                    onChange={e => setFormData(prev => ({ ...prev, jobType: e.target.value }))}
                  >
                    {JOB_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Experience Level</label>
                  <select
                    className={styles.formSelect}
                    value={formData.experienceLevel}
                    onChange={e => setFormData(prev => ({ ...prev, experienceLevel: e.target.value }))}
                  >
                    {EXPERIENCE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><FiDollarSign /> Salary Range</label>
                  <div className={styles.salaryRow}>
                    <input
                      className={styles.formInput}
                      type="number"
                      value={formData.salaryMin}
                      onChange={e => setFormData(prev => ({ ...prev, salaryMin: e.target.value }))}
                      placeholder="Min"
                    />
                    <span className={styles.salaryDivider}>to</span>
                    <input
                      className={styles.formInput}
                      type="number"
                      value={formData.salaryMax}
                      onChange={e => setFormData(prev => ({ ...prev, salaryMax: e.target.value }))}
                      placeholder="Max"
                    />
                    <select
                      className={styles.formSelect}
                      value={formData.salaryPeriod}
                      onChange={e => setFormData(prev => ({ ...prev, salaryPeriod: e.target.value }))}
                    >
                      {SALARY_PERIOD_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Industry</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={formData.industry}
                    onChange={e => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                    placeholder="e.g., Technology, Finance"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><FiTag /> Exclude Keywords (comma separated)</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={formData.excludeKeywords}
                    onChange={e => setFormData(prev => ({ ...prev, excludeKeywords: e.target.value }))}
                    placeholder="e.g., Junior, Intern"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Sources</label>
                  <div className={styles.sourceToggles}>
                    {['indeed', 'linkedin'].map(source => (
                      <button
                        key={source}
                        type="button"
                        className={`${styles.sourceToggle} ${formData.sources.includes(source) ? styles.sourceActive : ''}`}
                        onClick={() => toggleSource(source)}
                      >
                        {formData.sources.includes(source) ? <FiCheck /> : <FiX />}
                        <span>{source.charAt(0).toUpperCase() + source.slice(1)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.cancelButton} onClick={resetForm}>Cancel</button>
                <button type="submit" className={styles.submitButton} disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingId ? 'Update Search' : 'Create Search'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Cards */}
      {searches.length === 0 && !showForm ? (
        <div className={styles.emptyState}>
          <FiSearch style={{ fontSize: '3rem', opacity: 0.3 }} />
          <h3>No job searches yet</h3>
          <p>Create your first job search to start finding opportunities automatically.</p>
          <button className={styles.addButton} onClick={() => setShowForm(true)}>
            <FiPlus /> Create First Search
          </button>
        </div>
      ) : (
        <div className={styles.cardList}>
          {searches.map((search, index) => (
            <motion.div
              key={search.id}
              className={`${styles.searchCard} ${!search.isActive ? styles.searchInactive : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className={styles.searchCardHeader}>
                <div className={styles.searchCardInfo}>
                  <div className={styles.searchNameRow}>
                    <h3 className={styles.searchName}>{search.name}</h3>
                    {!search.isActive && <span className={styles.inactiveBadge}>Paused</span>}
                  </div>
                  <div className={styles.searchMeta}>
                    <span className={styles.searchMetaItem}>
                      <FiTag /> {search.keywords.join(', ')}
                    </span>
                    {search.location && (
                      <span className={styles.searchMetaItem}>
                        <FiMapPin /> {search.location}
                      </span>
                    )}
                    <span className={styles.searchMetaItem}>
                      <FiClock /> Last scraped: {formatDate(search.lastScrapedAt)}
                    </span>
                  </div>
                </div>

                <div className={styles.searchCardActions}>
                  <span className={styles.jobCountBadge}>{search._count.jobs} jobs</span>
                  <button
                    className={styles.iconButton}
                    onClick={() => handleToggleActive(search)}
                    title={search.isActive ? 'Pause' : 'Activate'}
                  >
                    {search.isActive ? <FiToggleRight style={{ color: 'var(--status-success)' }} /> : <FiToggleLeft />}
                  </button>
                  <button
                    className={styles.iconButton}
                    onClick={() => setExpandedId(expandedId === search.id ? null : search.id)}
                  >
                    {expandedId === search.id ? <FiChevronUp /> : <FiChevronDown />}
                  </button>
                  <button className={styles.iconButton} onClick={() => handleEdit(search)}>
                    <FiEdit2 />
                  </button>
                  <button className={`${styles.iconButton} ${styles.deleteBtn}`} onClick={() => handleDelete(search.id)}>
                    <FiTrash2 />
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {expandedId === search.id && (
                  <motion.div
                    className={styles.searchDetails}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className={styles.detailsGrid}>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Remote</span>
                        <span className={styles.detailValue}>{REMOTE_OPTIONS.find(o => o.value === search.remote)?.label}</span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Job Type</span>
                        <span className={styles.detailValue}>{JOB_TYPE_OPTIONS.find(o => o.value === search.jobType)?.label}</span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Experience</span>
                        <span className={styles.detailValue}>{EXPERIENCE_OPTIONS.find(o => o.value === (search.experienceLevel || ''))?.label || 'Any'}</span>
                      </div>
                      {(search.salaryMin || search.salaryMax) && (
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Salary</span>
                          <span className={styles.detailValue}>
                            {search.salaryMin && `$${search.salaryMin.toLocaleString()}`}
                            {search.salaryMin && search.salaryMax && ' - '}
                            {search.salaryMax && `$${search.salaryMax.toLocaleString()}`}
                            {` (${SALARY_PERIOD_OPTIONS.find(o => o.value === search.salaryPeriod)?.label})`}
                          </span>
                        </div>
                      )}
                      {search.industry && (
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Industry</span>
                          <span className={styles.detailValue}>{search.industry}</span>
                        </div>
                      )}
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Sources</span>
                        <span className={styles.detailValue}>{search.sources.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}</span>
                      </div>
                      {search.excludeKeywords.length > 0 && (
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Excluded</span>
                          <span className={styles.detailValue}>{search.excludeKeywords.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
