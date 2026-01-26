import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { FiArrowLeft, FiHelpCircle } from 'react-icons/fi';
import FaqsList from './FaqsList';
import styles from '../portfolio.module.css';

export const dynamic = 'force-dynamic';

async function getFaqs() {
  const faqs = await db.fAQ.findMany({
    orderBy: { order: 'asc' },
  });
  return faqs;
}

export default async function FaqsPage() {
  const session = await getSession();
  
  if (!session || !isSuperAdmin(session)) {
    redirect('/dashboard');
  }

  const faqs = await getFaqs();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <Link href="/dashboard/portfolio" className={styles.backLink}>
            <FiArrowLeft /> Back to Portfolio
          </Link>
          <h1 className={styles.title}>
            <FiHelpCircle style={{ marginRight: '12px', color: 'var(--purple-bright)' }} />
            FAQs
          </h1>
          <p className={styles.subtitle}>
            Manage frequently asked questions about your work
          </p>
        </div>
      </div>

      <FaqsList initialFaqs={faqs} />
    </div>
  );
}
