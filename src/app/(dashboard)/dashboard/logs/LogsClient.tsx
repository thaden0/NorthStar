'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FiFileText, 
  FiRefreshCw, 
  FiSearch, 
  FiFilter,
  FiDownload,
  FiAlertCircle,
  FiAlertTriangle,
  FiInfo,
  FiTerminal,
  FiServer,
  FiCpu,
  FiTrash2,
  FiPause,
  FiPlay
} from 'react-icons/fi';
import styles from './logs.module.css';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'log';
  service: string;
  context?: string;
  message: string;
  raw: string;
}

type ServiceFilter = 'all' | 'northstar' | 'agent';
type LevelFilter = 'all' | 'error' | 'warn' | 'info' | 'debug';

export default function LogsClient() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [logCount, setLogCount] = useState(200);
  const [error, setError] = useState<string | null>(null);
  
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams({
        count: logCount.toString(),
        service: serviceFilter,
      });
      
      const response = await fetch(`/api/logs/docker?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }
      
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setIsLoading(false);
    }
  }, [logCount, serviceFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (isAutoRefresh) {
      autoRefreshRef.current = setInterval(fetchLogs, 5000);
    } else {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [isAutoRefresh, fetchLogs]);

  const filteredLogs = logs.filter(log => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(query) ||
        log.context?.toLowerCase().includes(query) ||
        log.raw.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <FiAlertCircle className={styles.iconError} />;
      case 'warn':
        return <FiAlertTriangle className={styles.iconWarn} />;
      case 'debug':
        return <FiTerminal className={styles.iconDebug} />;
      default:
        return <FiInfo className={styles.iconInfo} />;
    }
  };

  const getServiceIcon = (service: string) => {
    if (service.includes('agent')) {
      return <FiCpu className={styles.serviceIcon} />;
    }
    return <FiServer className={styles.serviceIcon} />;
  };

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  const formatDate = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const downloadLogs = () => {
    const content = filteredLogs.map(log => log.raw).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${serviceFilter}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    setLogs([]);
    setSelectedLog(null);
  };

  const levelCounts = {
    all: logs.length,
    error: logs.filter(l => l.level === 'error').length,
    warn: logs.filter(l => l.level === 'warn').length,
    info: logs.filter(l => l.level === 'info' || l.level === 'log').length,
    debug: logs.filter(l => l.level === 'debug').length,
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <FiFileText className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>System Logs</h1>
            <p className={styles.subtitle}>
              Real-time logs from North Star and Agent Service
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`${styles.actionBtn} ${isAutoRefresh ? styles.actionBtnActive : ''}`}
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            title={isAutoRefresh ? 'Pause auto-refresh' : 'Enable auto-refresh'}
          >
            {isAutoRefresh ? <FiPause /> : <FiPlay />}
            {isAutoRefresh ? 'Pause' : 'Auto'}
          </button>
          <button
            className={styles.actionBtn}
            onClick={fetchLogs}
            disabled={isLoading}
          >
            <FiRefreshCw className={isLoading ? styles.spinning : ''} />
            Refresh
          </button>
          <button
            className={styles.actionBtn}
            onClick={downloadLogs}
            disabled={filteredLogs.length === 0}
          >
            <FiDownload />
            Export
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={clearLogs}
            disabled={logs.length === 0}
          >
            <FiTrash2 />
            Clear
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className={styles.filtersRow}>
        {/* Service Tabs */}
        <div className={styles.serviceTabs}>
          <button
            className={`${styles.serviceTab} ${serviceFilter === 'all' ? styles.serviceTabActive : ''}`}
            onClick={() => setServiceFilter('all')}
          >
            <FiServer /> All Services
          </button>
          <button
            className={`${styles.serviceTab} ${serviceFilter === 'northstar' ? styles.serviceTabActive : ''}`}
            onClick={() => setServiceFilter('northstar')}
          >
            <FiServer /> North Star
          </button>
          <button
            className={`${styles.serviceTab} ${serviceFilter === 'agent' ? styles.serviceTabActive : ''}`}
            onClick={() => setServiceFilter('agent')}
          >
            <FiCpu /> Agent Service
          </button>
        </div>

        {/* Search */}
        <div className={styles.searchContainer}>
          <FiSearch className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Level Filter */}
        <div className={styles.levelFilters}>
          <FiFilter className={styles.filterIcon} />
          {(['all', 'error', 'warn', 'info', 'debug'] as LevelFilter[]).map(level => (
            <button
              key={level}
              className={`${styles.levelBtn} ${styles[`level_${level}`]} ${levelFilter === level ? styles.levelBtnActive : ''}`}
              onClick={() => setLevelFilter(level)}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
              {levelCounts[level] > 0 && (
                <span className={styles.levelCount}>{levelCounts[level]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Log Count */}
        <select
          className={styles.countSelect}
          value={logCount}
          onChange={(e) => setLogCount(Number(e.target.value))}
        >
          <option value={100}>100 lines</option>
          <option value={200}>200 lines</option>
          <option value={500}>500 lines</option>
          <option value={1000}>1000 lines</option>
        </select>
      </div>

      {/* Error Banner */}
      {error && (
        <div className={styles.errorBanner}>
          <FiAlertCircle />
          <span>{error}</span>
          <button onClick={fetchLogs}>Retry</button>
        </div>
      )}

      {/* Main Content */}
      <div className={styles.content}>
        {/* Logs List */}
        <div className={styles.logsPanel} ref={logsContainerRef}>
          {isLoading ? (
            <div className={styles.loading}>
              <div className={styles.loadingSpinner} />
              <p>Loading logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className={styles.empty}>
              <FiFileText className={styles.emptyIcon} />
              <h3>No logs found</h3>
              <p>
                {searchQuery 
                  ? 'No logs match your search criteria'
                  : 'Container logs will appear here'
                }
              </p>
            </div>
          ) : (
            <div className={styles.logsList}>
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`${styles.logEntry} ${styles[`logEntry_${log.level}`]} ${selectedLog?.id === log.id ? styles.logEntrySelected : ''}`}
                  onClick={() => setSelectedLog(log)}
                >
                  <div className={styles.logMeta}>
                    <span className={styles.logTime}>{formatTimestamp(log.timestamp)}</span>
                    <span className={styles.logDate}>{formatDate(log.timestamp)}</span>
                    {getLevelIcon(log.level)}
                    <span className={`${styles.logLevel} ${styles[`logLevel_${log.level}`]}`}>
                      {log.level.toUpperCase()}
                    </span>
                    {getServiceIcon(log.service)}
                    <span className={styles.logService}>{log.service}</span>
                    {log.context && (
                      <span className={styles.logContext}>[{log.context}]</span>
                    )}
                  </div>
                  <div className={styles.logMessage}>{log.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className={styles.detailPanel}>
          {selectedLog ? (
            <div className={styles.detail}>
              <div className={styles.detailHeader}>
                <h3>Log Details</h3>
                <span className={`${styles.detailLevel} ${styles[`logLevel_${selectedLog.level}`]}`}>
                  {selectedLog.level.toUpperCase()}
                </span>
              </div>
              
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <label>Timestamp</label>
                  <span>{new Date(selectedLog.timestamp).toLocaleString()}</span>
                </div>
                <div className={styles.detailItem}>
                  <label>Service</label>
                  <span>{selectedLog.service}</span>
                </div>
                {selectedLog.context && (
                  <div className={styles.detailItem}>
                    <label>Context</label>
                    <span>{selectedLog.context}</span>
                  </div>
                )}
              </div>

              <div className={styles.detailSection}>
                <label>Message</label>
                <div className={styles.detailMessage}>{selectedLog.message}</div>
              </div>

              <div className={styles.detailSection}>
                <label>Raw Log</label>
                <pre className={styles.detailRaw}>{selectedLog.raw}</pre>
              </div>
            </div>
          ) : (
            <div className={styles.detailEmpty}>
              <FiFileText className={styles.detailEmptyIcon} />
              <h3>Select a log entry</h3>
              <p>Click on a log to view full details</p>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className={styles.statusBar}>
        <span>
          Showing {filteredLogs.length} of {logs.length} logs
        </span>
        {isAutoRefresh && (
          <span className={styles.autoRefreshStatus}>
            <span className={styles.autoRefreshDot} />
            Auto-refreshing every 5s
          </span>
        )}
      </div>
    </div>
  );
}
