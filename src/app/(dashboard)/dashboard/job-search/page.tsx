'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiFileText, FiBriefcase, FiRefreshCw,
  FiTrendingUp, FiZap, FiCpu
} from 'react-icons/fi';
import SearchesTab from './SearchesTab';
import ResumesTab from './ResumesTab';
import JobsTab from './JobsTab';
import styles from './jobSearch.module.css';

export const dynamic = 'force-dynamic';

type TabType = 'searches' | 'resumes' | 'jobs';

interface StatusCounts {
  [key: string]: number;
}

export default function JobSearchPage() {
  const [activeTab, setActiveTab] = useState<TabType>('searches');
  const [isScraping, setIsScraping] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);
  const [jobCounts, setJobCounts] = useState<StatusCounts>({});
  const [totalJobs, setTotalJobs] = useState(0);
  const [searchCount, setSearchCount] = useState(0);
  const [resumeCount, setResumeCount] = useState(0);

  const fetchCounts = useCallback(async () => {
    try {
      const [jobsRes, searchesRes, resumesRes] = await Promise.all([
        fetch('/api/job-search/jobs?limit=1'),
        fetch('/api/job-search/searches'),
        fetch('/api/job-search/resumes'),
      ]);
      
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setTotalJobs(data.total || 0);
        setJobCounts(data.statusCounts || {});
      }
      if (searchesRes.ok) {
        const data = await searchesRes.json();
        setSearchCount(data.length || 0);
      }
      if (resumesRes.ok) {
        const data = await resumesRes.json();
        setResumeCount(data.length || 0);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const handleScrape = async () => {
    setIsScraping(true);
    setScrapeResult(null);
    try {
      const res = await fetch('/api/job-search/scrape', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        let message = data.message;
        
        // After scraping, score any unscored jobs
        try {
          const scoreRes = await fetch('/api/job-search/jobs/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          if (scoreRes.ok) {
            const scoreData = await scoreRes.json();
            if (scoreData.scored > 0) {
              message += ` | AI scored ${scoreData.scored} jobs`;
            }
          }
        } catch {
          // Scoring is best-effort, don't fail the refresh
        }
        
        setScrapeResult(message);
        fetchCounts();
      } else {
        setScrapeResult(data.error || 'Scraping failed');
      }
    } catch {
      setScrapeResult('Network error during scraping');
    } finally {
      setIsScraping(false);
      setTimeout(() => setScrapeResult(null), 8000);
    }
  };

  const handleScore = async () => {
    setIsScoring(true);
    setScrapeResult(null);
    try {
      const res = await fetch('/api/job-search/jobs/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setScrapeResult(data.scored > 0 ? `AI scored ${data.scored} jobs` : 'All jobs already scored');
      } else {
        setScrapeResult(data.error || 'Scoring failed');
      }
    } catch {
      setScrapeResult('Network error during scoring');
    } finally {
      setIsScoring(false);
      setTimeout(() => setScrapeResult(null), 8000);
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'searches', label: 'Job Searches', icon: <FiSearch />, count: searchCount },
    { id: 'resumes', label: 'Resumes', icon: <FiFileText />, count: resumeCount },
    { id: 'jobs', label: 'Jobs', icon: <FiBriefcase />, count: totalJobs },
  ];

  const newCount = jobCounts['new'] || 0;
  const appliedCount = jobCounts['applied'] || 0;
  const interviewingCount = jobCounts['interviewing'] || 0;

  return (
    <div className={styles.pageContainer}>
      {/* Hero Header */}
      <div className={styles.heroHeader}>
        <div className={styles.heroContent}>
          <div className={styles.heroTitleRow}>
            <div className={styles.heroIcon}>
              <FiZap />
            </div>
            <div>
              <h1 className={styles.heroTitle}>AI Job Search</h1>
              <p className={styles.heroSubtitle}>Smart job hunting powered by automation</p>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className={styles.quickStats}>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>{totalJobs}</span>
              <span className={styles.statLabel}>Total Jobs</span>
            </div>
            <div className={styles.statCard}>
              <span className={`${styles.statNumber} ${styles.statNew}`}>{newCount}</span>
              <span className={styles.statLabel}>New</span>
            </div>
            <div className={styles.statCard}>
              <span className={`${styles.statNumber} ${styles.statApplied}`}>{appliedCount}</span>
              <span className={styles.statLabel}>Applied</span>
            </div>
            <div className={styles.statCard}>
              <span className={`${styles.statNumber} ${styles.statInterview}`}>{interviewingCount}</span>
              <span className={styles.statLabel}>Interviewing</span>
            </div>
          </div>
        </div>

        <div className={styles.heroActions}>
          <button
            className={`${styles.scrapeButton} ${isScraping ? styles.scraping : ''}`}
            onClick={handleScrape}
            disabled={isScraping || isScoring}
          >
            <FiRefreshCw className={isScraping ? styles.spinIcon : ''} />
            {isScraping ? 'Scraping...' : 'Refresh Jobs'}
          </button>
          <button
            className={`${styles.scrapeButton} ${isScoring ? styles.scraping : ''}`}
            onClick={handleScore}
            disabled={isScraping || isScoring}
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
          >
            <FiCpu className={isScoring ? styles.spinIcon : ''} />
            {isScoring ? 'Scoring...' : 'Score Jobs'}
          </button>
        </div>
      </div>

      {/* Scrape Result Toast */}
      <AnimatePresence>
        {scrapeResult && (
          <motion.div
            className={styles.scrapeToast}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <FiTrendingUp />
            <span>{scrapeResult}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigation */}
      <div className={styles.tabBar}>
        <div className={styles.tabNav}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={styles.tabBadge}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        <AnimatePresence mode="wait">
          {activeTab === 'searches' && (
            <motion.div
              key="searches"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <SearchesTab onUpdate={fetchCounts} />
            </motion.div>
          )}
          {activeTab === 'resumes' && (
            <motion.div
              key="resumes"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <ResumesTab onUpdate={fetchCounts} />
            </motion.div>
          )}
          {activeTab === 'jobs' && (
            <motion.div
              key="jobs"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <JobsTab onUpdate={fetchCounts} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
