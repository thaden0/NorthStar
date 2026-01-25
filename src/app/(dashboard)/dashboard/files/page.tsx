import { db } from '@/lib/db';
import { FiFolder, FiFile, FiImage, FiFileText, FiDownload, FiTrash2 } from 'react-icons/fi';
import styles from '../dashboard.module.css';

export const dynamic = 'force-dynamic';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <FiImage />;
  if (type.includes('pdf') || type.includes('document')) return <FiFileText />;
  return <FiFile />;
}

async function getFiles(): Promise<{
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  key: string;
  createdAt: Date;
  updatedAt: Date;
  uploadedBy: string | null;
}[]> {
  const files = await db.file.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return files;
}

export default async function FilesPage() {
  const files = await getFiles();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <FiFolder style={{ marginRight: '12px', color: 'var(--purple-violet)' }} />
            Files
          </h1>
          <p className={styles.subtitle}>
            Manage your uploaded files
          </p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiFolder /> Upload File
        </button>
      </div>

      {files.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.cardContent} style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
            <FiFolder style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }} />
            <h3 style={{ marginBottom: 'var(--space-2)' }}>No Files Yet</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Upload your first file to get started.
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Name</th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Type</th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Size</th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Uploaded</th>
                  <th style={{ padding: 'var(--space-4)', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <span style={{ color: 'var(--blue-ice)', fontSize: '1.25rem' }}>
                          {getFileIcon(file.type)}
                        </span>
                        <span>{file.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--text-muted)' }}>{file.type}</td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--text-muted)' }}>{formatBytes(file.size)}</td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--text-muted)' }}>
                      {new Date(file.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                        <a
                          href={file.url}
                          download
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            background: 'var(--glass-2)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <FiDownload />
                        </a>
                        <button
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            background: 'var(--glass-2)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--status-error)',
                            cursor: 'pointer',
                          }}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
