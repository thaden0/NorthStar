# Widget Drawer System Implementation Plan

## Overview

A slide-down widget drawer system for the Chat screen that allows users to preview and interact with operations before they complete. Widgets provide visual feedback for Google service operations (Gmail, Calendar, Contacts).

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Chat Screen                                     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                  Widget Drawer (Slide Down)                  │       │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │       │
│  │  │ Gmail Send   │ │ Email Read   │ │ Calendar     │        │       │
│  │  │    Widget    │ │    Widget    │ │   Widget     │        │       │
│  │  └──────────────┘ └──────────────┘ └──────────────┘        │       │
│  │  Max height: 50%; Auto-close: 5s; 3 widgets per row        │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                    Chat Messages Area                        │       │
│  │                                                              │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                      Input Area                              │       │
│  └─────────────────────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Widget Types

### 1. Email Send Widget (Gmail Compose)

- Displays like Gmail compose window
- Shows: To, Subject, Body (editable typewriter effect)
- Actions: Cancel, Edit, Send
- Source: `send_email` tool

### 2. Email Read Widget

- Beautiful email display card
- Shows: From, Subject, Date, Body preview
- Actions: Reply (placeholder), Mark Read, Close
- Source: `get_email` / `read_email` tool

### 3. Calendar Widget

- Mini calendar view with event markers
- Shows the new/edited event highlighted
- Shows surrounding events on that day/week
- Actions: Cancel, Confirm, Edit
- Source: `create_calendar_event`, `update_calendar_event`, `delete_calendar_event`

### 4. Contacts Widget

- Contact card display
- Shows: Name, Email, Phone, Organization
- Actions: Cancel, Confirm add, View details
- Source: `create_contact`, `update_contact`, `lookup_contact`

---

## SSE Event Extensions

New event types to support widgets:

```typescript
interface WidgetSSEEvent {
  type: "widget_open" | "widget_update" | "widget_close";
  widgetType: "email_send" | "email_read" | "calendar" | "contacts";
  widgetId: string;
  data:
    | EmailSendWidgetData
    | EmailReadWidgetData
    | CalendarWidgetData
    | ContactsWidgetData;
  canCancel?: boolean;
}

interface EmailSendWidgetData {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  isStreaming?: boolean; // If body is still being typed
}

interface EmailReadWidgetData {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  isHtml?: boolean;
}

interface CalendarWidgetData {
  operation: "create" | "update" | "delete";
  event: {
    id?: string;
    title: string;
    start: string;
    end: string;
    location?: string;
    description?: string;
  };
  surroundingEvents: CalendarEvent[];
}

interface ContactsWidgetData {
  operation: "create" | "update" | "lookup";
  contact: {
    resourceName?: string;
    name: string;
    email?: string;
    phone?: string;
    organization?: string;
  };
  existingContact?: boolean;
}
```

---

## File Structure

### Frontend (North Star)

```
src/
├── components/
│   └── widgets/
│       ├── WidgetDrawer.tsx         # Main drawer container
│       ├── WidgetContainer.tsx      # Individual widget wrapper
│       ├── EmailSendWidget.tsx      # Gmail-like compose
│       ├── EmailReadWidget.tsx      # Email display card
│       ├── CalendarWidget.tsx       # Mini calendar with event
│       ├── ContactsWidget.tsx       # Contact card
│       └── widgets.module.css       # Widget styles
└── app/(dashboard)/dashboard/ai-insights/
    └── ChatClient.tsx               # Updated to integrate drawer
```

### Backend (Agent Service)

```
src/
├── tools/
│   └── tool-executor.service.ts     # Updated tools with widget events
└── agent/
    └── agent.service.ts             # System prompt updates
```

---

## Implementation Steps

### Phase 1: Widget Components (Frontend) ✅

1. [x] Create `src/components/widgets/widgets.module.css`
   - Drawer slide animation
   - Widget card styles (glassmorphism)
   - 3-column grid layout
   - Max 50% height constraint
   - Auto-hide timer styles

2. [x] Create `WidgetDrawer.tsx`
   - Slide-down animation with transform
   - 5-second auto-close timer (starts on open)
   - Cancel timer on any user interaction
   - Close button (X)
   - Widget grid container

3. [x] Create individual widget components:
   - `EmailSendWidget.tsx` - Gmail-like compose
   - `EmailReadWidget.tsx` - Email card with reply button
   - `CalendarWidget.tsx` - Mini calendar view
   - `ContactsWidget.tsx` - Contact card

### Phase 2: SSE Integration (Frontend) ✅

4. [x] Update `ChatClient.tsx`
   - Add widget state management
   - Handle new SSE event types (widget_open, widget_update, widget_close)
   - Integrate WidgetDrawer component
   - Handle cancel action from widgets

### Phase 3: Tool Updates (Backend) ✅

5. [x] Update Agent Service tool context
   - Add widget event emission types to ToolExecutionContext
   - Add onWidgetOpen, onWidgetUpdate, onWidgetClose callbacks
   - Add SSE event schemas for widgets

6. [x] Update `agent.service.ts`
   - Check for Google connection availability
   - Add Google People lookup instructions to system prompt
   - Add polite contact suggestion behavior
   - Wire up widget event handlers

### Phase 4: Google Connection Status ✅

7. [x] Google connection check in system prompt
   - Conditionally enable Google tool instructions based on auth token
   - Include widget confirmation behavior in prompt

---

## CSS Specifications

### Drawer Behavior

- **Animation**: `transform: translateY(-100%)` to `translateY(0)`
- **Duration**: 300ms ease-out
- **Max height**: 50vh
- **Width**: 100%
- **Background**: Glassmorphism with backdrop blur
- **Z-index**: 50 (above messages, below modals)

### Widget Grid

- **PC (>1024px)**: 3 columns, `grid-template-columns: repeat(3, 1fr)`
- **Tablet (768-1024px)**: 2 columns
- **Mobile (<768px)**: 1 column
- **Gap**: var(--space-4)
- **Padding**: var(--space-4)

### Widget Cards

- **Min height**: 200px
- **Max height**: 300px
- **Background**: var(--glass-2) with border
- **Border radius**: var(--radius-lg)
- **Shadow**: var(--shadow-lg)

---

## Agent System Prompt Updates

```
=== GOOGLE INTEGRATION ===
You have access to Google services via OAuth: {GOOGLE_CONNECTED: true/false}

When Google tools are available:
- send_email: Compose and send emails (shows preview widget for confirmation)
- read_email: Read emails (displays in widget)
- create_calendar_event: Add calendar events (shows calendar widget with context)
- lookup_contact: Search Google Contacts

PEOPLE LOOKUP BEHAVIOR:
When users mention people by name:
1. Use google_contacts_lookup to find if they're in contacts
2. If found, use their contact info for context
3. If frequently mentioned positively and NOT a contact, politely offer:
   "I notice you mention [Name] often. Would you like me to add them to your contacts?"

WIDGET CONFIRMATION:
For emails and calendar events, the user can preview and CANCEL before the action completes.
If they cancel, acknowledge it and ask if they'd like to make changes.
```

---

## Cancel Flow

1. Agent calls `send_email` tool
2. Tool emits `widget_open` SSE event with email data
3. User sees widget with Cancel button
4. If user clicks Cancel:
   - Frontend sends `POST /api/agent/cancel/{toolCallId}`
   - Agent receives cancellation signal
   - Tool returns `{ cancelled: true }` result
   - Agent responds: "No problem, I've cancelled the email. Would you like to make any changes?"

---

## Testing Checklist

- [ ] Widget drawer slides down on widget_open event
- [ ] Auto-closes after 5 seconds of no interaction
- [ ] Stays open when user interacts
- [ ] Cancel button stops tool execution
- [ ] 3 widgets fit side-by-side on desktop
- [ ] Max height is 50% of viewport
- [ ] Email send shows typewriter effect
- [ ] Email read displays formatted content
- [ ] Calendar shows surrounding events
- [ ] Contact widget shows full details
- [ ] Reply button placeholder works
- [ ] Google connection status reflected in tools
- [ ] Agent uses people lookup appropriately
