# 🌟 North Star

A modern, full-featured Portfolio CMS built with Next.js, featuring a stunning glass-themed UI with blue/purple accents, complete authentication system, and role-based access control.

## ✨ Features

### Public Portfolio

- **Hero Section** - Animated gradient background with typing effect
- **About Section** - Personal info, skills categorized by type
- **Resume Section** - Education and experience timeline
- **Services Section** - Showcase of capabilities
- **Portfolio Section** - Featured projects with links
- **FAQ Section** - Common questions

### Dashboard (North Star CMS)

- **AI Insights** - Intelligent analytics and recommendations
- **Files** - File management system
- **Users** - User management (Super Admin only)
- **Portfolio** - Edit all portfolio content without code
- **Site Settings** - Configure global settings (Super Admin only)
- **Logs** - System activity logs (Admin+ only)

### Authentication & Authorization

- Custom session-based authentication
- Role-based access control (Super Admin, Admin, Editor, User)
- Profile management with avatar and password change

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Custom CSS with glass morphism theme
- **UI Components**: Material UI (MUI)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Custom session-based auth (bcryptjs)
- **Forms**: react-hook-form + Zod validation
- **Animations**: Framer Motion
- **Icons**: react-icons
- **Notifications**: Sonner
- **API**: tRPC + Server Actions
- **Content**: MDX support

## 📦 Installation

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

### Quick Start

1. **Clone and install dependencies**

   ```bash
   cd "North Star"
   npm install
   ```

2. **Start the database**

   ```bash
   npm run docker:dev
   ```

3. **Set up the database**

   ```bash
   npm run setup
   ```

   This runs: `prisma generate` → `prisma db push` → `seed`

4. **Start development server**

   ```bash
   npm run dev
   ```

5. **Open in browser**
   - Portfolio: http://localhost:3000
   - Login: http://localhost:3000/login

### Default Credentials

- **Email**: d333mon@gmail.com
- **Password**: Password1!
- **Role**: Super Admin

## 🐳 Docker Deployment

### Development with Docker

```bash
# Start development database
npm run docker:dev

# Run the app locally
npm run dev
```

### Production with Docker

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## 📁 Project Structure

```
North Star/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Initial data seeding
├── src/
│   ├── app/
│   │   ├── (auth)/        # Login/Register routes
│   │   ├── (dashboard)/   # Protected dashboard routes
│   │   ├── globals.css    # Global styles & design tokens
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Portfolio homepage
│   ├── components/
│   │   ├── layout/        # Header, Sidebar, DashboardLayout
│   │   ├── ui/            # Reusable UI components
│   │   └── forms/         # Form components
│   ├── lib/
│   │   ├── auth.ts        # Authentication utilities
│   │   └── db.ts          # Prisma client
│   ├── server/
│   │   ├── auth/          # Auth server actions
│   │   └── routers/       # tRPC routers
│   └── types/
│       └── index.ts       # TypeScript definitions
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## 🎨 Theme Colors

### Backgrounds

- Deep Space: `#050816`
- Night Indigo: `#070B1E`
- Glass Base: `#0B1028`

### Glass Surfaces

- Glass 1: `rgba(255,255,255,0.06)`
- Glass 2: `rgba(255,255,255,0.10)`
- Glass 3: `rgba(255,255,255,0.14)`
- Border: `rgba(255,255,255,0.16)`

### Primary Colors

- Electric Blue: `#3B82F6`
- Neon Blue: `#2563EB`
- Ice Blue: `#60A5FA`

### Accent Colors

- Violet: `#8B5CF6`
- Neon Purple: `#A855F7`
- Cyan Glow: `#22D3EE`
- Magenta Glow: `#F472B6`

## 📝 NPM Scripts

| Script                | Description                       |
| --------------------- | --------------------------------- |
| `npm run dev`         | Start development server          |
| `npm run build`       | Build for production              |
| `npm run start`       | Start production server           |
| `npm run setup`       | Generate, push, and seed database |
| `npm run db:generate` | Generate Prisma client            |
| `npm run db:push`     | Push schema to database           |
| `npm run db:seed`     | Seed the database                 |
| `npm run db:studio`   | Open Prisma Studio                |
| `npm run docker:dev`  | Start dev database                |
| `npm run docker:up`   | Start all Docker services         |
| `npm run docker:down` | Stop Docker services              |

## 🔐 Role Permissions

| Feature       | Super Admin | Admin | Editor | User |
| ------------- | ----------- | ----- | ------ | ---- |
| Dashboard     | ✅          | ✅    | ✅     | ✅   |
| AI Insights   | ✅          | ✅    | ✅     | ✅   |
| Files         | ✅          | ✅    | ✅     | ✅   |
| Users         | ✅          | ❌    | ❌     | ❌   |
| Portfolio     | ✅          | ❌    | ❌     | ❌   |
| Site Settings | ✅          | ❌    | ❌     | ❌   |
| Logs          | ✅          | ✅    | ❌     | ❌   |

## 📄 License

MIT License - Feel free to use this project for your own portfolio!

---

**Built with ❤️ by Leonard Waugh**
