import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/job-search/jobs/[id]/cover-letter/pdf
 * Download cover letter as PDF
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const coverLetter = await db.coverLetter.findUnique({
      where: { jobId: id },
      include: {
        job: { select: { title: true, company: true } },
      },
    });

    if (!coverLetter) {
      return NextResponse.json({ error: 'No cover letter found' }, { status: 404 });
    }

    // Convert markdown to simple HTML for PDF rendering
    const htmlContent = markdownToHtml(coverLetter.content);
    const jobTitle = coverLetter.job.title.replace(/[^a-zA-Z0-9 ]/g, '');
    const company = coverLetter.job.company.replace(/[^a-zA-Z0-9 ]/g, '');

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11pt;
      line-height: 1.7;
      color: #1a1a2e;
      padding: 60px 70px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    p {
      margin-bottom: 16px;
      text-align: justify;
    }
    
    p:first-child {
      margin-top: 0;
    }
    
    strong { font-weight: 600; }
    em { font-style: italic; }
    
    ul, ol {
      margin: 12px 0;
      padding-left: 28px;
    }
    
    li {
      margin-bottom: 6px;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

    // Return HTML with download headers — client can use print-to-PDF or
    // we render server-side if Playwright is available
    const fileName = `Cover Letter - ${jobTitle} at ${company}.html`;

    return new NextResponse(fullHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Cover letter PDF error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}

/**
 * Simple markdown → HTML converter for cover letters
 */
function markdownToHtml(md: string): string {
  const html = md
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Line breaks → paragraphs
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => {
      // Check if it's a list
      if (p.match(/^[-•]\s/m)) {
        const items = p.split(/\n/).map(line =>
          `<li>${line.replace(/^[-•]\s*/, '')}</li>`
        ).join('\n');
        return `<ul>${items}</ul>`;
      }
      // Regular paragraph — replace single newlines with <br>
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return html;
}
