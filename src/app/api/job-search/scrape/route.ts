import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { scrapeAllForUser, scrapeForSearch } from '@/lib/job-scraper';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only super admins can trigger manual scrapes
    if (!isSuperAdmin(session)) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { searchId } = body;

    let result;
    if (searchId) {
      // Scrape for a specific search
      const searchResult = await scrapeForSearch(searchId);
      result = {
        totalAdded: searchResult.added,
        totalSkipped: searchResult.skipped,
        searchResults: [{ searchId, ...searchResult }],
      };
    } else {
      // Scrape all active searches for the user
      result = await scrapeAllForUser(session.userId);
    }

    return NextResponse.json({
      success: true,
      message: `Scraping complete. Added ${result.totalAdded} new jobs, skipped ${result.totalSkipped} duplicates.`,
      ...result,
    });
  } catch (error) {
    console.error('Scrape trigger failed:', error);
    return NextResponse.json({ error: 'Scraping failed' }, { status: 500 });
  }
}
