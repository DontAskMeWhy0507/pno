# PNO

All-in-one learning workspace built on a Turborepo monorepo: Flashcards & Study Sets, Anki V3 Spaced Repetition, IELTS Practice, and Interactive Data Courses.

## Features

- **Flashcards & Study Sets** — Create, organize, and study sets with folders, classes, share links, and Cortex-assisted grading.
- **Anki SRS (V3)** — Full Anki V3 scheduler (4 AM day cutoff, Relearning, Leech detection, Days Late, Fuzz, daily limits), Deck Options, `AnkiReviewLog`, 10-chart Statistics, and `.apkg` deck import.
- **IELTS & Quiz** — Cambridge 15–21 practice tests across Listening, Reading, Writing, and Speaking, with Manage CRUD studio, Smart Add Test, local cache, optimistic UI, and cross-device sync.
- **Interactive Data Courses (`/courses`)** — 16 built-in courses across 6 tracks (**Python**, **SQL**, **R**, **Git**, **JavaScript**, **Excel**) with theory, interactive practice workbench (including in-browser SQLite via `sql.js`), quizzes, custom course editor, Smart Import, and cloud progress sync.

## The Stack

- [Next.js 14](https://nextjs.org) (Pages Router) & [React 18](https://react.dev)
- [tRPC](https://trpc.io) & [TanStack Query](https://tanstack.com/query)
- [NextAuth.js](https://next-auth.js.org) (Google OAuth)
- [Prisma](https://prisma.io) & [MySQL](https://www.mysql.com/)
- [Chakra UI](https://chakra-ui.com) & [Zustand](https://github.com/pmndrs/zustand)
- [Turborepo](https://turbo.build/repo) & [Bun](https://bun.sh)

## Running Locally

### Prerequisites

- Node.js 18+ (see `.nvmrc`)
- Bun
- MySQL (or Docker / `docker-compose`)

### Setup

1. Clone the repository and enter the project directory:

   ```sh
   git clone https://github.com/DontAskMeWhy0507/pno.git
   cd pno
   ```

2. Install dependencies:

   ```sh
   bun i
   ```

3. Configure environment variables:

   - Copy `.env.example` to `.env`.
   - Set `DATABASE_URL` (matches `docker-compose.mysql.yml` by default: `mysql://user:password@localhost:3306/db`).
   - Generate secrets for `NEXTAUTH_SECRET` and `PNO_ENCRYPTION_KEY`:
     ```sh
     openssl rand -base64 32
     openssl rand -base64 24
     ```
   - Create a Google OAuth Web Application client in Google Cloud Console with:
     - Authorized JavaScript origin: `http://localhost:3000`
     - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` (plus any optional keys such as `RESEND_API_KEY` or `MEDIA_S3_*` if needed).

4. Start local MySQL (optional, via Docker):

   ```sh
   docker-compose -f docker-compose.mysql.yml up -d
   ```

5. Push the Prisma schema and generate the client:

   ```sh
   bun run db:push
   ```

### Running

Start the development server:

```sh
bun dev
```

Or build and run in production mode:

```sh
bun run build
bun start
```

Open [http://localhost:3000](http://localhost:3000) to use PNO.
