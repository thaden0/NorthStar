'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiExternalLink, FiHeart, FiMapPin,
  FiDollarSign, FiClock, FiFilter, FiX, FiBriefcase,
  FiFileText, FiDownload, FiRefreshCw, FiCheck, FiPlay,
  FiAlertCircle, FiImage
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
  searchMatchScore: number | null;
  candidateMatchScore: number | null;
  aiNotes: string | null;
  aiScoredAt: string | null;
  notes: string | null;
  isFavorite: boolean;
  createdAt: string;
  jobSearch: { name: string } | null;
  resume: { name: string } | null;
  coverLetter?: { id: string } | null;
  jobApplication?: { id: string; status: string } | null;
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
  { value: 'searchMatchScore', label: 'Search Match' },
  { value: 'candidateMatchScore', label: 'Candidate Match' },
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

  // Cover letter
  const [coverLetterJobId, setCoverLetterJobId] = useState<string | null>(null);
  const [coverLetterContent, setCoverLetterContent] = useState<string | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState<string | null>(null); // jobId being generated
  const [coverLetterError, setCoverLetterError] = useState<string | null>(null);
  const [jobsWithCoverLetters, setJobsWithCoverLetters] = useState<Set<string>>(new Set());

  // Application agent
  interface ApplicationStep {
    id: number;
    timestamp: string;
    action: string;
    description: string;
    screenshot?: string;
    success: boolean;
    details?: string;
  }
  const [applyJobId, setApplyJobId] = useState<string | null>(null);
  const [applySteps, setApplySteps] = useState<ApplicationStep[]>([]);
  const [applyStatus, setApplyStatus] = useState<'idle' | 'running' | 'submitted' | 'needs_review' | 'failed'>('idle');
  const [applyScreenshot, setApplyScreenshot] = useState<string | null>(null);

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
        // Populate cover letter indicators from API data
        const clSet = new Set<string>(
          data.jobs
            .filter((j: Job) => j.coverLetter?.id)
            .map((j: Job) => j.id)
        );
        setJobsWithCoverLetters(prev => {
          const merged = new Set(prev);
          clSet.forEach(id => merged.add(id));
          return merged;
        });
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

  // Cover letter functions
  const generateCoverLetter = async (jobId: string) => {
    setIsGeneratingCover(jobId);
    setCoverLetterError(null);
    try {
      const res = await fetch(`/api/job-search/jobs/${jobId}/cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setCoverLetterContent(data.content);
        setCoverLetterJobId(jobId);
        setJobsWithCoverLetters(prev => new Set([...prev, jobId]));
      } else {
        const err = await res.json();
        setCoverLetterError(err.error || 'Failed to generate');
      }
    } catch {
      setCoverLetterError('Network error');
    } finally {
      setIsGeneratingCover(null);
    }
  };

  const viewCoverLetter = async (jobId: string) => {
    try {
      const res = await fetch(`/api/job-search/jobs/${jobId}/cover-letter`);
      if (res.ok) {
        const data = await res.json();
        setCoverLetterContent(data.content);
        setCoverLetterJobId(jobId);
      } else {
        // No existing cover letter — generate one
        generateCoverLetter(jobId);
      }
    } catch {
      generateCoverLetter(jobId);
    }
  };

  const downloadCoverLetter = (jobId: string) => {
    window.open(`/api/job-search/jobs/${jobId}/cover-letter/pdf`, '_blank');
  };

  // Application agent functions
  const startApplication = async (jobId: string) => {
    setApplyJobId(jobId);
    setApplySteps([]);
    setApplyStatus('running');
    setApplyScreenshot(null);

    try {
      const res = await fetch(`/api/job-search/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const err = await res.json();
        setApplyStatus('failed');
        setApplySteps([{ id: 1, timestamp: new Date().toISOString(), action: 'error', description: err.error || 'Failed to start', success: false }]);
        return;
      }

      if (!res.body) {
        setApplyStatus('failed');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.type === 'step') {
                setApplySteps(prev => [...prev, data.step]);
                if (data.step.screenshot) {
                  setApplyScreenshot(data.step.screenshot);
                }
              } else if (data.type === 'complete') {
                setApplyStatus(data.result?.status === 'submitted' ? 'submitted' : data.result?.status === 'needs_review' ? 'needs_review' : 'failed');
                if (data.result?.lastScreenshot) {
                  setApplyScreenshot(data.result.lastScreenshot);
                }
                // Refresh job list if submitted
                if (data.result?.status === 'submitted') {
                  fetchJobs();
                  onUpdate();
                }
              } else if (data.type === 'error') {
                setApplyStatus('failed');
                setApplySteps(prev => [...prev, { id: prev.length + 1, timestamp: new Date().toISOString(), action: 'error', description: data.error, success: false }]);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err) {
      setApplyStatus('failed');
      setApplySteps(prev => [...prev, { id: prev.length + 1, timestamp: new Date().toISOString(), action: 'error', description: `Network error: ${err}`, success: false }]);
    }
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#84cc16';
    if (score >= 40) return '#f59e0b';
    if (score >= 20) return '#f97316';
    return '#ef4444';
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
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        className={styles.applyIconBtn}
                        onClick={e => { e.stopPropagation(); startApplication(job.id); }}
                        title={job.status === 'applied' ? 'Already applied' : 'Auto Apply'}
                        disabled={applyStatus === 'running' || job.status === 'applied'}
                        style={job.status === 'applied' ? { color: '#22c55e' } : {}}
                      >
                        {applyStatus === 'running' && applyJobId === job.id ? (
                          <FiRefreshCw className={styles.spinning} />
                        ) : job.status === 'applied' ? (
                          <FiCheck />
                        ) : (
                          <FiPlay />
                        )}
                      </button>
                      <button
                        className={`${styles.favoriteBtn} ${isGeneratingCover === job.id ? styles.coverGenerating : ''}`}
                        onClick={e => { e.stopPropagation(); viewCoverLetter(job.id); }}
                        title={jobsWithCoverLetters.has(job.id) || job.coverLetter ? 'View cover letter' : 'Generate cover letter'}
                        disabled={isGeneratingCover === job.id}
                        style={jobsWithCoverLetters.has(job.id) || job.coverLetter ? { color: '#22c55e' } : {}}
                      >
                        {isGeneratingCover === job.id ? (
                          <FiRefreshCw className={styles.spinning} />
                        ) : jobsWithCoverLetters.has(job.id) || job.coverLetter ? (
                          <FiCheck />
                        ) : (
                          <FiFileText />
                        )}
                      </button>
                      <button
                        className={`${styles.favoriteBtn} ${job.isFavorite ? styles.favorited : ''}`}
                        onClick={e => { e.stopPropagation(); toggleFavorite(job); }}
                      >
                        <FiHeart />
                      </button>
                    </div>
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
                    {job.searchMatchScore !== null && (
                      <span className={styles.aiScoreBadge} style={{ background: `${getScoreColor(job.searchMatchScore)}22`, color: getScoreColor(job.searchMatchScore), borderColor: getScoreColor(job.searchMatchScore) }}>
                        Search: {Math.round(job.searchMatchScore)}%
                      </span>
                    )}
                    {job.candidateMatchScore !== null && (
                      <span className={styles.aiScoreBadge} style={{ background: `${getScoreColor(job.candidateMatchScore)}22`, color: getScoreColor(job.candidateMatchScore), borderColor: getScoreColor(job.candidateMatchScore) }}>
                        Fit: {Math.round(job.candidateMatchScore)}%
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

                {/* AI Scores */}
                {(selectedJob.searchMatchScore !== null || selectedJob.candidateMatchScore !== null) && (
                  <div className={styles.aiScoreSection}>
                    {selectedJob.searchMatchScore !== null && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span className={styles.aiScoreText}>Search Match</span>
                          <span style={{ color: getScoreColor(selectedJob.searchMatchScore), fontWeight: 600 }}>{Math.round(selectedJob.searchMatchScore)}%</span>
                        </div>
                        <div className={styles.aiScoreBar}>
                          <div
                            className={styles.aiScoreFill}
                            style={{ width: `${selectedJob.searchMatchScore}%`, background: getScoreColor(selectedJob.searchMatchScore) }}
                          />
                        </div>
                      </div>
                    )}
                    {selectedJob.candidateMatchScore !== null && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span className={styles.aiScoreText}>Candidate Fit</span>
                          <span style={{ color: getScoreColor(selectedJob.candidateMatchScore), fontWeight: 600 }}>{Math.round(selectedJob.candidateMatchScore)}%</span>
                        </div>
                        <div className={styles.aiScoreBar}>
                          <div
                            className={styles.aiScoreFill}
                            style={{ width: `${selectedJob.candidateMatchScore}%`, background: getScoreColor(selectedJob.candidateMatchScore) }}
                          />
                        </div>
                      </div>
                    )}
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

                {/* Apply + Cover Letter Actions */}
                <div className={styles.applyActionRow}>
                  <button
                    className={styles.applyBtn}
                    onClick={() => startApplication(selectedJob.id)}
                    disabled={applyStatus === 'running' || selectedJob.status === 'applied'}
                  >
                    {selectedJob.status === 'applied' ? (
                      <><FiCheck /> Applied</>
                    ) : applyStatus === 'running' && applyJobId === selectedJob.id ? (
                      <><FiRefreshCw className={styles.spinning} /> Applying...</>
                    ) : (
                      <><FiPlay /> Auto Apply</>
                    )}
                  </button>
                  <button
                    className={styles.coverLetterSmallBtn}
                    onClick={() => viewCoverLetter(selectedJob.id)}
                    disabled={isGeneratingCover === selectedJob.id}
                  >
                    {isGeneratingCover === selectedJob.id ? (
                      <FiRefreshCw className={styles.spinning} />
                    ) : (
                      <FiFileText />
                    )}
                    Cover Letter
                  </button>
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

      {/* Cover Letter Modal */}
      <AnimatePresence>
        {(coverLetterContent || isGeneratingCover) && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setCoverLetterContent(null); setCoverLetterJobId(null); setCoverLetterError(null); }}
          >
            <motion.div
              className={styles.coverLetterModal}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.coverLetterHeader}>
                <h2>
                  <FiFileText style={{ marginRight: 8 }} />
                  Cover Letter
                  {coverLetterJobId && jobs.find(j => j.id === coverLetterJobId) && (
                    <span style={{ fontWeight: 400, fontSize: '0.85em', opacity: 0.7, marginLeft: 12 }}>
                      {jobs.find(j => j.id === coverLetterJobId)?.title} at {jobs.find(j => j.id === coverLetterJobId)?.company}
                    </span>
                  )}
                </h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  {coverLetterJobId && coverLetterContent && (
                    <>
                      <button
                        className={styles.coverLetterAction}
                        onClick={() => downloadCoverLetter(coverLetterJobId)}
                        title="Download"
                      >
                        <FiDownload /> Download
                      </button>
                      <button
                        className={styles.coverLetterAction}
                        onClick={() => generateCoverLetter(coverLetterJobId)}
                        disabled={!!isGeneratingCover}
                        title="Regenerate"
                      >
                        <FiRefreshCw className={isGeneratingCover ? styles.spinning : ''} /> Regenerate
                      </button>
                    </>
                  )}
                  <button
                    className={styles.coverLetterClose}
                    onClick={() => { setCoverLetterContent(null); setCoverLetterJobId(null); setCoverLetterError(null); }}
                  >
                    <FiX />
                  </button>
                </div>
              </div>

              <div className={styles.coverLetterBody}>
                {isGeneratingCover ? (
                  <div className={styles.coverLetterGenerating}>
                    <FiRefreshCw className={styles.spinning} style={{ fontSize: 32, marginBottom: 16 }} />
                    <p>Generating your cover letter...</p>
                    <p style={{ fontSize: '0.85em', opacity: 0.6 }}>This may take 30-60 seconds</p>
                  </div>
                ) : coverLetterError ? (
                  <div className={styles.coverLetterError}>
                    <p>❌ {coverLetterError}</p>
                    {coverLetterJobId && (
                      <button onClick={() => generateCoverLetter(coverLetterJobId)}>Try Again</button>
                    )}
                  </div>
                ) : coverLetterContent ? (
                  <div
                    className={styles.coverLetterContent}
                    dangerouslySetInnerHTML={{
                      __html: coverLetterContent
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.+?)\*/g, '<em>$1</em>')
                        .split(/\n\n+/)
                        .map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
                        .join('')
                    }}
                  />
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Application Progress Modal */}
      <AnimatePresence>
        {applyStatus !== 'idle' && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { if (applyStatus !== 'running') { setApplyStatus('idle'); setApplySteps([]); setApplyScreenshot(null); setApplyJobId(null); } }}
          >
            <motion.div
              className={styles.applyModal}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={styles.applyModalHeader}>
                <h2>
                  {applyStatus === 'running' && <><FiRefreshCw className={styles.spinning} /> Applying...</>}
                  {applyStatus === 'submitted' && <><FiCheck style={{ color: '#22c55e' }} /> Application Submitted!</>}
                  {applyStatus === 'needs_review' && <><FiAlertCircle style={{ color: '#f59e0b' }} /> Needs Review</>}
                  {applyStatus === 'failed' && <><FiAlertCircle style={{ color: '#ef4444' }} /> Application Failed</>}
                </h2>
                {applyStatus !== 'running' && (
                  <button
                    className={styles.coverLetterClose}
                    onClick={() => { setApplyStatus('idle'); setApplySteps([]); setApplyScreenshot(null); setApplyJobId(null); }}
                  >
                    <FiX />
                  </button>
                )}
              </div>

              <div className={styles.applyModalBody}>
                {/* Screenshot Preview */}
                {applyScreenshot && (
                  <div className={styles.applyScreenshot}>
                    <div className={styles.applyScreenshotLabel}>
                      <FiImage /> Live Preview
                    </div>
                    <img
                      src={`data:image/png;base64,${applyScreenshot}`}
                      alt="Application progress"
                      className={styles.applyScreenshotImg}
                    />
                  </div>
                )}

                {/* Steps List */}
                <div className={styles.applyStepsList}>
                  {applySteps.map(step => (
                    <div
                      key={step.id}
                      className={`${styles.applyStep} ${step.success ? styles.applyStepSuccess : styles.applyStepError}`}
                    >
                      <span className={styles.applyStepIcon}>
                        {step.action === 'error' || step.action === 'needs_review'
                          ? '❌'
                          : step.action === 'complete'
                          ? '✅'
                          : step.action === 'navigating'
                          ? '🌐'
                          : step.action === 'filling_field'
                          ? '✏️'
                          : step.action === 'clicking'
                          ? '👆'
                          : step.action === 'uploading'
                          ? '📎'
                          : step.action === 'screenshot'
                          ? '📸'
                          : '⏳'}
                      </span>
                      <span className={styles.applyStepText}>{step.description}</span>
                    </div>
                  ))}
                  {applyStatus === 'running' && (
                    <div className={styles.applyStep}>
                      <span className={styles.applyStepIcon}><FiRefreshCw className={styles.spinning} /></span>
                      <span className={styles.applyStepText} style={{ opacity: 0.6 }}>Working...</span>
                    </div>
                  )}
                </div>

                {/* Details for needs_review */}
                {applyStatus === 'needs_review' && applySteps.length > 0 && applySteps[applySteps.length - 1].details && (
                  <div className={styles.applyReviewNote}>
                    <p>{applySteps[applySteps.length - 1].details}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
