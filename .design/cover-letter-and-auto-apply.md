# AI Cover Letter Generation & Automated Job Application

## Design Document — v1.0

---

## Overview

Two major features to add to the North Star Job Search system:

1. **AI Cover Letter Generation** — Generate tailored cover letters for specific jobs using all of the user's resume data and the job's requirements, powered by Mistral-Nemo via Ollama.
2. **Automated Job Application Agent** — A browser-based agent that navigates job application pages, fills in forms, uploads resumes/cover letters, and submits applications semi-autonomously, reporting each step in real-time.

---

## Phase 1: AI Cover Letter Generation

### 1.1 Architecture

```
[Jobs Tab UI] → [Next.js API Route] → [Agent Service: /cover-letter/generate] → [Ollama: mistral-nemo]
      ↓                  ↓                              ↓
  Show preview     Save to DB              Build prompt from all resumes + job
      ↓
  Download PDF
```

### 1.2 Schema Changes (Prisma)

```prisma
model CoverLetter {
  id          String    @id @default(cuid())
  userId      String
  jobId       String

  content     String    @db.Text    // Generated cover letter text (Markdown)
  htmlContent String?   @db.Text    // Rendered HTML version
  pdfData     String?   @db.Text    // Base64-encoded PDF

  model       String    // LLM model used (e.g., "mistral-nemo:latest")
  version     Int       @default(1) // Regeneration count

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  job         Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@unique([jobId, userId])
  @@index([userId])
}
```

Update `Job` model:

```prisma
model Job {
  // ... existing fields ...
  coverLetter   CoverLetter?
}
```

Update `User` model:

```prisma
model User {
  // ... existing fields ...
  coverLetters  CoverLetter[]
}
```

### 1.3 Agent Service: CoverLetterModule

**New files:**

- `src/cover-letter/cover-letter.module.ts`
- `src/cover-letter/cover-letter.controller.ts`
- `src/cover-letter/cover-letter.service.ts`

**Endpoint:** `POST /cover-letter/generate`

**Request body:**

```typescript
interface CoverLetterRequest {
  job: {
    title: string;
    company: string;
    location: string | null;
    description: string | null;
    jobType: string | null;
    remote: string | null;
    experienceLevel: string | null;
  };
  resumes: Array<{
    name: string;
    targetRole: string | null;
    skills: string[];
    experienceYears: number | null;
    summary: string | null;
    content: string | null; // Truncated text from fileData
  }>;
  userName: string;
  model?: string; // Default: "mistral-nemo:latest"
}
```

**Response:**

```typescript
interface CoverLetterResponse {
  success: boolean;
  data: {
    content: string; // Markdown cover letter
    model: string;
    generatedAt: string;
  };
}
```

**Prompt Strategy:**

- System prompt defines the role as a professional cover letter writer
- Includes ALL resumes (summary + skills) so the LLM has the full picture of the candidate
- Includes the full job description
- Asks for a professional, tailored, 3-4 paragraph cover letter
- Uses `mistral-nemo:latest` (needs to be pulled on server)
- Temperature: 0.7 (allow creative writing)
- `/no_think` for qwen-style models; strip `<think>` tags in parser

### 1.4 North Star API Routes

**New route:** `POST /api/job-search/jobs/[id]/cover-letter`

- Fetches the job by ID
- Fetches ALL user resumes (not just default)
- Calls Agent Service `/cover-letter/generate`
- Saves the generated cover letter to DB
- Returns the cover letter content

**New route:** `GET /api/job-search/jobs/[id]/cover-letter`

- Returns the existing cover letter for a job (if any)

**New route:** `GET /api/job-search/jobs/[id]/cover-letter/pdf`

- Generates a PDF from the cover letter content using Playwright (headless Chrome)
- Returns downloadable PDF with proper headers

### 1.5 UI Changes (JobsTab.tsx)

**New button per job card:** 📝 icon (or `FiFileText`) next to the ❤️ favorite icon

- Click → calls the cover letter API
- Shows a loading spinner on the button while generating
- Once generated, shows a modal/drawer with:
  - Cover letter text preview (rendered Markdown)
  - "Download PDF" button
  - "Regenerate" button
  - "Close" button
- If cover letter already exists, click shows it immediately with option to regenerate

**Visual indicator:** Small ✅ badge on the icon if a cover letter already exists for that job.

### 1.6 PDF Generation

Use Playwright's existing headless Chrome to render HTML → PDF:

- Create an HTML template with professional styling (letterhead, typography)
- Load the cover letter content into the template
- Use `page.pdf()` to generate
- Return as base64 or direct download

---

## Phase 2: Automated Job Application Agent

### 2.1 Architecture

```
[Jobs Tab UI] → [Next.js API Route] → [Agent Service: /job-apply/start]
      ↑ SSE                                    ↓
  Real-time status                     [ApplicationAgentService]
  display per step                              ↓
                                        [PlaywrightService] → Job site
                                               ↓
                                        [OllamaService] → Decision making
                                               ↓
                                        Step-by-step DB updates
```

### 2.2 Schema Changes

```prisma
model JobApplication {
  id            String    @id @default(cuid())
  userId        String
  jobId         String    @unique

  // Application status
  status        String    @default("pending")
  // "pending" | "in_progress" | "submitting" | "submitted" | "failed" | "needs_review"

  // Resume + cover letter used
  resumeId      String?
  coverLetterId String?

  // Step tracking (JSON array of steps)
  steps         String    @db.Text  // JSON: ApplicationStep[]
  currentStep   String?             // Current step description

  // Result
  confirmationId  String?           // Application confirmation number if provided
  screenshotUrl   String?  @db.Text // Final screenshot (base64)
  errorMessage    String?  @db.Text

  // Timing
  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  job           Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)
  resume        Resume?   @relation(fields: [resumeId], references: [id], onDelete: SetNull)
  coverLetter   CoverLetter? @relation(fields: [coverLetterId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([status])
}
```

**ApplicationStep type (stored as JSON):**

```typescript
interface ApplicationStep {
  id: number;
  timestamp: string;
  action: string; // "navigating" | "analyzing" | "filling_field" | "uploading" | "clicking" | "waiting" | "error" | "complete"
  description: string; // Human-readable: "Navigating to application page..."
  screenshot?: string; // Base64 screenshot at this step (periodic, not every step)
  success: boolean;
  details?: string; // Additional context
}
```

### 2.3 Agent Service: JobApplyModule

**New files:**

- `src/job-apply/job-apply.module.ts`
- `src/job-apply/job-apply.controller.ts`
- `src/job-apply/job-apply.service.ts`
- `src/job-apply/application-agent.service.ts` — The core browser agent

**Endpoints:**

1. `POST /job-apply/start` — Start application process (returns SSE stream)
2. `GET /job-apply/:jobId/status` — Get current application status
3. `POST /job-apply/:jobId/cancel` — Cancel in-progress application

### 2.4 Application Agent Logic (application-agent.service.ts)

The agent operates in a loop:

```
1. Navigate to job's sourceUrl
2. Find "Apply" button → click it
3. LOOP:
   a. Take screenshot
   b. Extract page content (forms, fields, buttons)
   c. Send to LLM: "Given this form and the user's info, what should I do?"
   d. LLM responds with structured actions: fill_field, click_button, upload_file, etc.
   e. Execute each action
   f. Report step via SSE/callback
   g. Check if we're on a confirmation page → done
   h. If error or stuck → report and pause for human review
```

**LLM Integration:**

- Uses `qwen3:latest` (or configurable) for decision-making
- Each step sends the page's visible form fields + labels + button text
- LLM returns JSON instructions:

```json
{
  "action": "fill_field",
  "selector": "#firstName",
  "value": "Leonard",
  "reasoning": "First name field detected, filling from resume"
}
```

**File Uploads:**

- Resume: Use the actual stored `fileData` (base64 → temp file → upload via file input)
- Cover Letter: Generate PDF first, then upload

**User Data Sources (for form filling):**

- All resumes: name, skills, experience, contact info
- User profile: name, email
- Cover letter: already generated content
- Job details: for context-aware answers

**Safety Features:**

- Maximum 30 steps before pausing
- Screenshot every 5 steps (stored in `steps` JSON)
- If the LLM is uncertain (confidence < 0.7), mark as `needs_review`
- Never submit payment info
- Never create accounts without explicit user consent
- Human-in-the-loop: agent pauses on "tricky" questions and asks the user

### 2.5 North Star API Routes

**New route:** `POST /api/job-search/jobs/[id]/apply`

- Validates job exists and has a cover letter
- Calls Agent Service `/job-apply/start`
- Returns SSE stream of application steps

**New route:** `GET /api/job-search/jobs/[id]/apply/status`

- Returns current `JobApplication` with all steps

### 2.6 UI Changes (JobsTab.tsx)

**New "Apply" button per job card:**

- Only enabled if a cover letter exists for the job
- Disabled if application is already in progress or submitted
- Click → opens an "Application Status" panel/modal

**Application Status Panel:**

- Real-time feed of agent steps (like a chat log)
- Each step shows:
  - Timestamp
  - Action icon (🔍 analyzing, ✍️ filling, 📎 uploading, ✅ done, ❌ error)
  - Description text
  - Periodic screenshots (expandable)
- Status badge: "In Progress" / "Submitted" / "Failed" / "Needs Review"
- "Cancel" button during in-progress
- Final confirmation screenshot if submitted

**Job Card Updates:**

- Status automatically changes to "applied" on successful submission
- Shows application status indicator (colored dot) on the card

---

## Implementation Plan

### Phase 1: Cover Letter Generation (Priority: HIGH)

| Step | Task                                             | Files                                                        | Effort |
| ---- | ------------------------------------------------ | ------------------------------------------------------------ | ------ |
| 1.1  | Pull `mistral-nemo` on server                    | Server command                                               | 5 min  |
| 1.2  | Add `CoverLetter` model to Prisma schema         | `prisma/schema.prisma`                                       | 10 min |
| 1.3  | Run `prisma migrate`                             | Migration                                                    | 5 min  |
| 1.4  | Create `CoverLetterModule` in Agent Service      | `src/cover-letter/*` (3 files)                               | 45 min |
| 1.5  | Register module in `AppModule`                   | `src/app.module.ts`                                          | 2 min  |
| 1.6  | Create NS API routes for cover letter            | `src/app/api/job-search/jobs/[id]/cover-letter/route.ts`     | 30 min |
| 1.7  | Create PDF generation route                      | `src/app/api/job-search/jobs/[id]/cover-letter/pdf/route.ts` | 20 min |
| 1.8  | Add cover letter button + modal to JobsTab       | `JobsTab.tsx`, `jobSearch.module.css`                        | 40 min |
| 1.9  | Add `scoreJobs` method to `AgentServiceClient`   | `src/lib/agent-service.ts`                                   | 10 min |
| 1.10 | Deploy Agent Service + North Star + test         | Deploy                                                       | 15 min |
| 1.11 | Test end-to-end: generate, preview, download PDF | Manual test                                                  | 10 min |

**Estimated total: ~3 hours**

### Phase 2: Automated Application Agent (Priority: MEDIUM)

| Step | Task                                                            | Files                                        | Effort    |
| ---- | --------------------------------------------------------------- | -------------------------------------------- | --------- |
| 2.1  | Add `JobApplication` model to Prisma schema                     | `prisma/schema.prisma`                       | 10 min    |
| 2.2  | Run `prisma migrate`                                            | Migration                                    | 5 min     |
| 2.3  | Create `JobApplyModule` in Agent Service                        | `src/job-apply/*` (3 files)                  | 30 min    |
| 2.4  | Build `ApplicationAgentService` with Playwright                 | `src/job-apply/application-agent.service.ts` | 2 hours   |
| 2.5  | Add SSE streaming support for application steps                 | Controller + Service                         | 45 min    |
| 2.6  | Register module in `AppModule`                                  | `src/app.module.ts`                          | 2 min     |
| 2.7  | Create NS API routes for apply                                  | `src/app/api/job-search/jobs/[id]/apply/*`   | 30 min    |
| 2.8  | Add `JobApplication` type + apply methods to AgentServiceClient | `src/lib/agent-service.ts`                   | 15 min    |
| 2.9  | Add Apply button + status panel to JobsTab                      | `JobsTab.tsx`, `jobSearch.module.css`        | 1.5 hours |
| 2.10 | Deploy and test with a real job application                     | Deploy + test                                | 30 min    |
| 2.11 | Iterate on agent reliability                                    | Agent improvements                           | Ongoing   |

**Estimated total: ~6 hours**

---

## Model Requirements

| Model                 | Purpose                                    | Size  | Status        |
| --------------------- | ------------------------------------------ | ----- | ------------- |
| `qwen3:latest`        | Job scoring, application agent decisions   | 5 GB  | ✅ Installed  |
| `mistral-nemo:latest` | Cover letter generation (creative writing) | ~7 GB | 🔲 Needs pull |

---

## Risk Assessment

| Risk                                                 | Mitigation                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| Mistral-Nemo not available on Ollama                 | Fall back to qwen3 for cover letter generation                      |
| LLM generates poor cover letters                     | Include regeneration option, allow manual editing                   |
| Application agent gets stuck on complex forms        | Limit to 30 steps, pause for human review                           |
| Different job sites have different application flows | Agent uses LLM for dynamic decision-making, not hardcoded selectors |
| CAPTCHAs block automated applications                | Detect and report as `needs_review`, let user complete manually     |
| Account creation required                            | Agent pauses and notifies user, does NOT auto-create accounts       |
| File upload formats vary                             | Support PDF resume upload by default, cover letter as PDF           |

---

## Notes

- **Cover letter model:** User requested Mistral-Nemo specifically. If not available, we fall back to qwen3.
- **Application agent model:** qwen3 is best for structured reasoning/decision-making.
- **PDF generation:** Leverage existing Playwright headless Chrome rather than adding PDF libraries.
- **Security:** The application agent operates within the Agent Service Docker container's headless browser. No user credentials for job sites are stored — the agent navigates as a guest applicant.
