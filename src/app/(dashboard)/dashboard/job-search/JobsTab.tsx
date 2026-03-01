'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiExternalLink, FiHeart, FiMapPin,
  FiDollarSign, FiClock, FiFilter, FiX, FiBriefcase
} from 'react-icons/fi';
import styles from './jobSearch.module.css';

interface Job {
  id: string;
  jobSearchId: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string | null;
  jobType: string | null;
  remote: string | null;
  experienceLevel: string | null;
  postedAt: string | null;
  source: string;
  sourceUrl: string;
  status: string;
  appliedAt: string | null;
  resumeId: string | null;
  aiScore: number | null;
  aiNotes: string | null;
  notes: string | null;
  isFavorite: boolean;
  createdAt: string;
  jobSearch: { name: string } | null;
  resume: { name: string } | null;
}

interface JobsTabProps {
  onUpdate: () => void;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All', color: '' },
  { value: 'new', label: 'New', color: '#3b82f6' },
  { value: 'reviewed', label: 'Reviewed', color: '#8b5cf6' },
  { value: 'saved', label: 'Saved', color: '#22d3ee' },
  { value: 'applied', label: 'Applied', color: '#22c55e' },
  { value: 'interviewing', label: 'Interviewing', color: '#f59e0b' },
  { value: 'offered', label: 'Offered', color: '#10b981' },
  { value: 'rejected', label: 'Rejected', color: '#ef4444' },
  { value: 'withdrawn', label: 'Withdrawn', color: '#6b7280' },
  { value: 'hidden', label: 'Hidden', color: '#374151' },
];

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Date Found' },
  { value: 'postedAt', label: 'Date Posted' },
  { value: 'aiScore', label: 'AI Score' },
  { value: 'title', label: 'Title' },
  { value: 'company', label: 'Company' },
];

export default function JobsTab({ onUpdate }: JobsTabProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Detail view
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '30',
        sortBy,
        sortDir,
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (searchQuery) params.set('search', searchQuery);
      if (favoriteOnly) params.set('favorite', 'true');

      const res = await fetch(`/api/job-search/jobs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setStatusCounts(data.statusCounts || {});
      }
    } catch {
      console.error('Failed to fetch jobs');
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, sourceFilter, searchQuery, sortBy, sortDir, favoriteOnly]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const updateJob = async (id: string, data: Partial<Job>) => {
    try {
      const res = await fetch(`/api/job-search/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setJobs(prev => prev.map(j => j.id === id ? updated : j));
        if (selectedJob?.id === id) setSelectedJob(updated);
        onUpdate();
      }
    } catch {
      console.error('Failed to update job');
    }
  };

  const toggleFavorite = (job: Job) => {
    updateJob(job.id, { isFavorite: !job.isFavorite } as Partial<Job>);
  };

  const updateStatus = (job: Job, status: string) => {
    updateJob(job.id, { status } as Partial<Job>);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatSalary = (job: Job) => {
    if (!job.salaryMin && !job.salaryMax) return null;
    const min = job.salaryMin ? `$${job.salaryMin.toLocaleString()}` : '';
    const max = job.salaryMax ? `$${job.salaryMax.toLocaleString()}` : '';
    const period = job.salaryPeriod === 'yearly' ? '/yr' : job.salaryPeriod === 'hourly' ? '/hr' : '/mo';
    if (min && max) return `${min} - ${max}${period}`;
    return `${min || max}${period}`;
  };

  const getStatusColor = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.color || '#6b7280';
  };

  const getSourceBadge = (source: string) => {
    if (source === 'indeed') return { label: 'Indeed', color: '#2164f3' };
    if (source === 'linkedin') return { label: 'LinkedIn', color: '#0a66c2' };
    return { label: source, color: '#6b7280' };
  };

  return (
    <div className={styles.tabPanel}>
      <div className={styles.tabHeader}>
        <div>
          <h2 className={styles.tabTitle}>Jobs ({total})</h2>
          <p className={styles.tabDescription}>
            Browse, filter, and manage all scraped job listings.
          </p>
        </div>
        <button 
          className={`${styles.filterToggleBtn} ${showFilters ? styles.filterActive : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <FiFilter />
          <span>Filters</span>
        </button>
      </div>

      {/* Status Filter Pills */}
      <div className={styles.statusPills}>
        {STATUS_OPTIONS.map(status => {
          const count = status.value === 'all' 
            ? total 
            : statusCounts[status.value] || 0;
          return (
            <button
              key={status.value}
              className={`${styles.statusPill} ${statusFilter === status.value ? styles.statusPillActive : ''}`}
              onClick={() => { setStatusFilter(status.value); setPage(1); }}
              style={statusFilter === status.value && status.color ? { borderColor: status.color, background: `${status.color}22` } : {}}
            >
              {status.color && (
                <span className={styles.statusDot} style={{ background: status.color }} />
              )}
              <span>{status.label}</span>
              <span className={styles.pillCount}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className={styles.jobsToolbar}>
        <div className={styles.jobSearchBox}>
          <FiSearch />
          <input
            type="text"
            placeholder="Search by title, company, or location..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            className={styles.jobSearchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={styles.clearSearch}><FiX /></button>
          )}
        </div>

        <div className={styles.toolbarActions}>
          <button
            className={`${styles.iconButton} ${favoriteOnly ? styles.favoriteActive : ''}`}
            onClick={() => { setFavoriteOnly(!favoriteOnly); setPage(1); }}
            title="Show favorites only"
          >
            <FiHeart />
          </button>
          
          <select
            className={styles.sortSelect}
            value={`${sortBy}-${sortDir}`}
            onChange={e => {
              const [field, dir] = e.target.value.split('-');
              setSortBy(field);
              setSortDir(dir);
              setPage(1);
            }}
          >
            {SORT_OPTIONS.map(opt => (
              <>
                <option key={`${opt.value}-desc`} value={`${opt.value}-desc`}>{opt.label} (Newest)</option>
                <option key={`${opt.value}-asc`} value={`${opt.value}-asc`}>{opt.label} (Oldest)</option>
              </>
            ))}
          </select>

          <select
            className={styles.sortSelect}
            value={sourceFilter}
            onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Sources</option>
            <option value="indeed">Indeed</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </div>
      </div>

      {/* Jobs List + Detail Split View */}
      <div className={styles.jobsSplitView}>
        {/* Job List */}
        <div className={`${styles.jobsList} ${selectedJob ? styles.jobsListNarrow : ''}`}>
          {isLoading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>Loading jobs...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className={styles.emptyState}>
              <FiBriefcase style={{ fontSize: '3rem', opacity: 0.3 }} />
              <h3>No jobs found</h3>
              <p>Try adjusting your filters or create a job search to start scraping.</p>
            </div>
          ) : (
            <>
              {jobs.map((job, index) => (
                <motion.div
                  key={job.id}
                  className={`${styles.jobCard} ${selectedJob?.id === job.id ? styles.jobCardSelected : ''} ${job.status === 'hidden' ? styles.jobHidden : ''}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => setSelectedJob(job)}
                >
                  <div className={styles.jobCardHeader}>
                    <div className={styles.jobCardMainInfo}>
                      <h3 className={styles.jobTitle}>{job.title}</h3>
                      <p className={styles.jobCompany}>{job.company}</p>
                    </div>
                    <button
                      className={`${styles.favoriteBtn} ${job.isFavorite ? styles.favorited : ''}`}
                      onClick={e => { e.stopPropagation(); toggleFavorite(job); }}
                    >
                      <FiHeart />
                    </button>
                  </div>
                  
                  <div className={styles.jobCardMeta}>
                    {job.location && (
                      <span className={styles.jobMetaItem}>
                        <FiMapPin /> {job.location}
                      </span>
                    )}
                    {formatSalary(job) && (
                      <span className={styles.jobMetaItem}>
                        <FiDollarSign /> {formatSalary(job)}
                      </span>
                    )}
                    <span className={styles.jobMetaItem}>
                      <FiClock /> {formatDate(job.postedAt || job.createdAt)}
                    </span>
                  </div>

                  <div className={styles.jobCardFooter}>
                    <span
                      className={styles.jobStatusBadge}
                      style={{ borderColor: getStatusColor(job.status), color: getStatusColor(job.status) }}
                    >
                      {job.status}
                    </span>
                    <span
                      className={styles.jobSourceBadge}
                      style={{ background: getSourceBadge(job.source).color }}
                    >
                      {getSourceBadge(job.source).label}
                    </span>
                    {job.remote && (
                      <span className={styles.remoteBadge}>{job.remote}</span>
                    )}
                    {job.aiScore !== null && (
                      <span className={styles.aiScoreBadge}>
                        AI: {Math.round(job.aiScore)}%
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageButton}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </button>
                  <span className={styles.pageInfo}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    className={styles.pageButton}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Job Detail Panel */}
        <AnimatePresence>
          {selectedJob && (
            <motion.div
              className={styles.jobDetailPanel}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
            >
              <div className={styles.detailPanelHeader}>
                <button className={styles.closeDetail} onClick={() => setSelectedJob(null)}>
                  <FiX />
                </button>
                <a
                  href={selectedJob.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.openExternal}
                >
                  <FiExternalLink /> View Original
                </a>
              </div>

              <div className={styles.detailContent}>
                <h2 className={styles.detailTitle}>{selectedJob.title}</h2>
                <p className={styles.detailCompany}>{selectedJob.company}</p>

                <div className={styles.detailMetaRow}>
                  {selectedJob.location && (
                    <span className={styles.detailMeta}><FiMapPin /> {selectedJob.location}</span>
                  )}
                  {formatSalary(selectedJob) && (
                    <span className={styles.detailMeta}><FiDollarSign /> {formatSalary(selectedJob)}</span>
                  )}
                  {selectedJob.remote && (
                    <span className={styles.detailMeta}>{selectedJob.remote}</span>
                  )}
                  {selectedJob.jobType && (
                    <span className={styles.detailMeta}><FiBriefcase /> {selectedJob.jobType}</span>
                  )}
                </div>

                {/* AI Score */}
                {selectedJob.aiScore !== null && (
                  <div className={styles.aiScoreSection}>
                    <div className={styles.aiScoreBar}>
                      <div
                        className={styles.aiScoreFill}
                        style={{ width: `${selectedJob.aiScore}%` }}
                      />
                    </div>
                    <span className={styles.aiScoreText}>AI Match: {Math.round(selectedJob.aiScore)}%</span>
                    {selectedJob.aiNotes && (
                      <p className={styles.aiNotesText}>{selectedJob.aiNotes}</p>
                    )}
                  </div>
                )}

                {/* Status Selector */}
                <div className={styles.statusSelector}>
                  <label className={styles.statusSelectorLabel}>Status</label>
                  <div className={styles.statusGrid}>
                    {STATUS_OPTIONS.filter(s => s.value !== 'all').map(status => (
                      <button
                        key={status.value}
                        className={`${styles.statusOption} ${selectedJob.status === status.value ? styles.statusOptionActive : ''}`}
                        style={selectedJob.status === status.value ? { borderColor: status.color, background: `${status.color}22`, color: status.color } : {}}
                        onClick={() => updateStatus(selectedJob, status.value)}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                {selectedJob.description && (
                  <div className={styles.descriptionSection}>
                    <h3>Description</h3>
                    <div className={styles.descriptionText}>
                      {selectedJob.description}
                    </div>
                  </div>
                )}

                {/* Search Origin & Timestamps */}
                <div className={styles.detailFooter}>
                  {selectedJob.jobSearch && (
                    <span className={styles.detailFooterItem}>
                      Search: {selectedJob.jobSearch.name}
                    </span>
                  )}
                  <span className={styles.detailFooterItem}>
                    Posted: {formatDate(selectedJob.postedAt)}
                  </span>
                  <span className={styles.detailFooterItem}>
                    Found: {formatDate(selectedJob.createdAt)}
                  </span>
                  {selectedJob.appliedAt && (
                    <span className={styles.detailFooterItem}>
                      Applied: {formatDate(selectedJob.appliedAt)}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
