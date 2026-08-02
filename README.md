# Rocdwels Construction ERP

> 🏗️ A comprehensive construction enterprise resource planning system for project budgeting, cost-code-linked job costing, requisitions, and site operations management.

![TypeScript](https://img.shields.io/badge/TypeScript-89.1%25-3178C6?logo=typescript&logoColor=white)
![PLpgSQL](https://img.shields.io/badge/PLpgSQL-9.8%25-336791?logo=postgresql&logoColor=white)
![TanStack Start](https://img.shields.io/badge/TanStack%20Start-1.168-005A9E?logo=react&logoColor=white)
![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.2-06B6D4?logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

**Status**: Active Development | **Version**: 1.0.0 | **Repository**: Public

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development](#development)
  - [Build](#build)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Database](#database)
- [Component Library](#component-library)
- [Development Workflow](#development-workflow)
- [Built with Lovable](#built-with-lovable)
- [Contributing](#contributing)

---

## 🎯 Features

- **Project Budgeting**: Create and manage detailed project budgets
- **Cost Code Tracking**: Link costs to specific cost codes for accurate job costing
- **Job Costing**: Track expenses against projects with cost-code integration
- **Requisitions Management**: Submit and manage material/service requisitions
- **Site Operations**: Manage day-to-day site operations and workflows
- **Real-time Data Sync**: Built on Supabase for real-time database synchronization
- **Responsive UI**: Modern, accessible interface built with Radix UI components
- **Type-Safe**: Full TypeScript support for robust development

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [TanStack Start](https://tanstack.com/start) — full-stack React framework
- **UI Library**: [React 19.2](https://react.dev)
- **Component System**: [Radix UI](https://www.radix-ui.com/) — unstyled, accessible components
- **Styling**: [Tailwind CSS 4.2](https://tailwindcss.com/) with custom animations
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) with [Zod](https://zod.dev) validation
- **Charts**: [Recharts](https://recharts.org/) for data visualization
- **Data Fetching**: [@tanstack/react-query](https://tanstack.com/query) — powerful async state management
- **Routing**: [@tanstack/react-router](https://tanstack.com/router) — type-safe routing
- **PDF Export**: [jsPDF](https://github.com/parallax/jsPDF) with [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable)
- **Icons**: [Lucide React](https://lucide.dev/) — beautiful icon library
- **Utilities**: Clsx, class-variance-authority, tailwind-merge

### Backend & Database
- **Backend**: [Nitro](https://nitro.unjs.io/) (via TanStack Start)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL-based)
- **Database Query**: [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)
- **Database Schema**: PostgreSQL with PLpgSQL stored procedures (9.8% of codebase)

### Development Tools
- **Build Tool**: [Vite 8.0](https://vitejs.dev)
- **Language**: [TypeScript 5.8](https://www.typescriptlang.org/)
- **Linting**: [ESLint 9.32](https://eslint.org/)
- **Code Formatting**: [Prettier 3.7](https://prettier.io/)
- **Package Manager**: [Bun](https://bun.sh/) or npm
- **Configuration**: [Lovable Vite Config](https://lovable.dev)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 22.x or higher
- **npm** 10.x or higher (or Bun as package manager)
- **Git** for version control

We recommend using [nvm](https://github.com/nvm-sh/nvm) to manage Node.js versions.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/krssroot/erp-rocdwels-ng.git
   cd erp-rocdwels-ng
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or with Bun
   bun install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase credentials and other required variables in `.env.local`.

### Development

Run the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` by default.

### Build

Create an optimized production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

### Linting & Formatting

Lint the codebase:
```bash
npm run lint
```

Format code with Prettier:
```bash
npm run format
```

---

## 📁 Project Structure

```
erp-rocdwels-ng/
├── src/
│   ├── routes/              # File-based routing (TanStack Start)
│   │   ├── __root.tsx      # App shell & root layout
│   │   ├── index.tsx       # Home page
│   │   └── [feature]/      # Feature routes
│   ├── components/          # Reusable React components
│   │   └── ui/             # Radix UI wrapper components
│   ├── lib/                # Utility functions
│   ├── hooks/              # Custom React hooks
│   └── server.ts           # Server entry point (SSR wrapper)
├── supabase/
│   ├── migrations/         # PostgreSQL migration files
│   └── functions/          # Edge functions & stored procedures
├── public/                 # Static assets
├── components.json         # Shadcn component registry
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── eslint.config.js       # ESLint configuration
├── .prettierrc             # Prettier configuration
└── package.json           # Dependencies & scripts
```

### Key Directories

- **`src/routes`**: TanStack Start file-based routing. Each `.tsx` file auto-generates a route.
- **`src/components`**: React components, including a `ui/` folder with Radix UI components.
- **`supabase/migrations`**: SQL migration files for schema changes.
- **`.lovable/`**: Lovable platform configuration (auto-managed).

---

## 🏗️ Architecture

### Frontend Architecture

The application follows a **component-driven architecture** with file-based routing:

1. **Route Layer** (`src/routes`): File-based routes with automatic code-splitting
2. **Component Layer** (`src/components`): Reusable UI and feature components
3. **Hook Layer** (`src/hooks`): Custom React hooks for business logic
4. **Utility Layer** (`src/lib`): Helper functions and data transformations

### Data Flow

```
Component (React) → Hook (TanStack Query) → Supabase Client → PostgreSQL
                                    ↓
                            Real-time Subscriptions
```

### State Management

- **Server State**: [@tanstack/react-query](https://tanstack.com/query) for caching and synchronization
- **Client State**: React hooks and local state
- **Real-time**: Supabase real-time subscriptions for live updates

---

## 🗄️ Database

### Technology
- **Platform**: [Supabase](https://supabase.com/) (PostgreSQL 15+)
- **Language**: SQL with PLpgSQL stored procedures
- **Client**: `@supabase/supabase-js` v2.110.7

### Key Features

- Row-level security (RLS) policies for access control
- Real-time change feeds for live data synchronization
- Edge functions for serverless backend logic
- Automated backups and disaster recovery

### Migrations

Database migrations are stored in `supabase/migrations/` and track schema changes over time.

---

## 🎨 Component Library

The project uses **Radix UI** for accessible, unstyled components, styled with **Tailwind CSS**.

### Available Components

- Accordion, Alert Dialog, Avatar, Checkbox
- Collapsible, Context Menu, Dialog, Dropdown Menu
- Hover Card, Label, Menubar, Navigation Menu
- Popover, Progress, Radio Group, Scroll Area
- Select, Separator, Slider, Switch, Tabs
- Toggle, Toggle Group, Tooltip

All components are typed and configured in `components.json`.

---

## 🔄 Development Workflow

### Getting Started with Development

```bash
# 1. Create a feature branch
git checkout -b feature/your-feature-name

# 2. Start development server
npm run dev

# 3. Make your changes
# Edit files in src/ — changes hot-reload

# 4. Lint and format
npm run lint
npm run format

# 5. Commit changes
git add .
git commit -m "feat: description of changes"

# 6. Push to GitHub
git push origin feature/your-feature-name

# 7. Open a Pull Request
```

### File-Based Routing Examples

| File | Route | Notes |
|------|-------|-------|
| `index.tsx` | `/` | Home page |
| `about.tsx` | `/about` | About page |
| `projects/index.tsx` | `/projects` | Projects listing |
| `projects/$id.tsx` | `/projects/:id` | Dynamic project detail |
| `sites/$.tsx` | `/sites/*` | Splat route for nested paths |
| `_layout.tsx` | (layout wrapper) | Wraps children with layout |
| `__root.tsx` | (app shell) | Root layout for entire app |

---

## 🚀 Built with Lovable

This project is built with [Lovable](https://lovable.dev), a platform for building web applications with AI assistance.

### Lovable Integration

- **AI-Powered Development**: Describe features in natural language; Lovable generates code
- **GitHub Sync**: Every change made in Lovable commits straight to this repository
- **Two-Way Sync**: Push changes from your local repo, they sync back to Lovable
- **Full Ownership**: You own all the code — fork, modify, and deploy as needed

### Workflow with Lovable

1. **In Lovable Editor**: Describe features, generate code, see live previews
2. **Push to GitHub**: Commits sync automatically to this repository
3. **Local Development**: Work in your editor, push to GitHub
4. **Back to Lovable**: Changes sync back into the Lovable editor

> **⚠️ Important**: Avoid rewriting published git history (force pushing, rebasing, squashing) to maintain sync with Lovable.

---

## 📦 Dependencies Summary

### Core Dependencies
- React 19.2 with TypeScript
- TanStack Start (full-stack framework)
- TanStack Query & Router
- Supabase JS Client
- Radix UI + Tailwind CSS
- React Hook Form + Zod validation
- Recharts for data visualization
- jsPDF for PDF export

### Dev Dependencies
- Vite (build tool)
- TypeScript (type checking)
- ESLint (code quality)
- Prettier (code formatting)
- Lovable Vite Config

Full dependency list available in [`package.json`](./package.json).

---

## 🔐 Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Application
VITE_APP_NAME=Rocdwels ERP
VITE_APP_URL=https://erp.rocdwels.org
```

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository** and create a feature branch
2. **Make your changes** with clear, descriptive commits
3. **Run tests and linting**: `npm run lint && npm run format`
4. **Submit a Pull Request** with a clear description of changes

### Code Standards

- Use TypeScript for all new code
- Follow the existing code style (enforced by ESLint & Prettier)
- Write descriptive commit messages
- Keep PRs focused on a single feature or fix

---

## 📝 License

This project is MIT licensed. See LICENSE file for details.

---

## 🔗 Links

- **Live Application**: [erp.rocdwels.org](https://erp.rocdwels.org)
- **GitHub Repository**: [github.com/krssroot/erp-rocdwels-ng](https://github.com/krssroot/erp-rocdwels-ng)
- **Lovable Platform**: [lovable.dev](https://lovable.dev)
- **Documentation**: See inline code comments and component documentation

---

## 📞 Support

For questions or issues:

1. Check existing [GitHub Issues](https://github.com/krssroot/erp-rocdwels-ng/issues)
2. Review the [TanStack documentation](https://tanstack.com)
3. Consult [Radix UI docs](https://www.radix-ui.com/)
4. Check [Supabase documentation](https://supabase.com/docs)

---

**Built with ❤️ for Rocdwels Nigeria Ltd** | Maintained by [@krssroot](https://github.com/krssroot)
