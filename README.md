# Centa

A personal budget planner built with ratio-based budgeting. Track income, categorize expenses, and monitor spending against your budget plan.

## Features

- **Ratio-based budgeting** — split income into categories by percentage (e.g. 50/30/20)
- **Preset and custom plans** — start with a popular template or define your own categories
- **Editable plans** — rename categories, adjust percentages, or restructure plans at any time
- **Income and expense tracking** — log transactions and see spending per category
- **Dashboard** — monthly overview with income, expenses, remaining balance, and per-category progress

## Tech Stack

- [Next.js](https://nextjs.org) 16 (App Router, Server Actions)
- [React](https://react.dev) 19
- [Prisma](https://www.prisma.io) 7 with PostgreSQL
- [Tailwind CSS](https://tailwindcss.com) 4
- [shadcn/ui](https://ui.shadcn.com) components

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL

### Setup

1. Clone the repository and install dependencies:

```bash
pnpm install
```

2. Create a `.env` file with your database connection:

```
DATABASE_URL="postgresql://user:password@localhost:5432/centa"
```

3. Push the database schema:

```bash
pnpm db:push
```

4. Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be guided through the setup flow on first visit.

## License

Copyright (c) 2026 Pan. All rights reserved. See [LICENSE](LICENSE) for details.
