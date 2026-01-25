# Google Service

Google Integration Microservice for North Star - provides Gmail, Calendar, and Contacts integration.

## Features

- **OAuth2 Authentication**: Securely bind Google accounts to North Star accounts
- **Gmail Integration**:
  - List, search, and read emails
  - Send emails and replies
  - Mark as read/unread, star, trash
- **Calendar Integration**:
  - List calendar events
  - Create, update, delete events
  - Support for multiple calendars
- **Contacts Integration**:
  - List and search contacts
  - Get frequent contacts

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your Google OAuth credentials

# Start PostgreSQL
docker-compose up postgres -d

# Push database schema
npm run db:push

# Start development server
npm run start:dev
```

### Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f google-service
```

## API Endpoints

### OAuth (`/oauth`)

- `GET /oauth/authorize` - Get Google authorization URL
- `GET /oauth/callback` - OAuth callback handler
- `GET /oauth/status` - Check connection status
- `DELETE /oauth/disconnect` - Disconnect Google account

### Gmail (`/gmail`)

- `GET /gmail/messages` - List emails
- `GET /gmail/messages/:id` - Get single email
- `POST /gmail/messages` - Send email
- `GET /gmail/search?q=` - Search emails
- `PATCH /gmail/messages/:id/read` - Mark as read
- `PATCH /gmail/messages/:id/unread` - Mark as unread
- `DELETE /gmail/messages/:id` - Trash email
- `GET /gmail/unread-count` - Get unread count

### Calendar (`/calendar`)

- `GET /calendar/events` - List events
- `GET /calendar/events/today` - Today's events
- `GET /calendar/events/week` - This week's events
- `GET /calendar/events/:id` - Get single event
- `POST /calendar/events` - Create event
- `PUT /calendar/events/:id` - Update event
- `DELETE /calendar/events/:id` - Delete event
- `GET /calendar/list` - List calendars

### Contacts (`/contacts`)

- `GET /contacts` - List contacts
- `GET /contacts/search?q=` - Search contacts
- `GET /contacts/frequent` - Frequent contacts
- `GET /contacts/:resourceName` - Get single contact

## Environment Variables

| Variable               | Description                                | Default                                     |
| ---------------------- | ------------------------------------------ | ------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string               | Required                                    |
| `JWT_SECRET`           | JWT signing secret (same as Agent Service) | Required                                    |
| `JWT_ISSUER`           | JWT issuer                                 | `north-star`                                |
| `JWT_AUDIENCE`         | JWT audience                               | `google-service`                            |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                     | Required                                    |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                 | Required                                    |
| `GOOGLE_REDIRECT_URI`  | OAuth callback URL                         | `http://localhost:3000/api/google/callback` |
| `GOOGLE_SCOPES`        | Space-separated OAuth scopes               | Gmail + Calendar + Contacts                 |
| `PORT`                 | Service port                               | `3003`                                      |

## API Documentation

Swagger documentation is available at `http://localhost:3003/api` when the service is running.
