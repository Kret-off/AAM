# Assist after meeting (AAM)

Internal web app for processing video meetings with STT and LLM.

## Tech Stack

- **Frontend/Backend**: Next.js 15 (TypeScript) with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Redis + BullMQ
- **Storage**: MinIO (S3-compatible)
- **STT**: Deepgram API
- **LLM**: OpenAI GPT-4o

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose

### Setup

1. Install dependencies:
```bash
npm install
```

2. Start infrastructure services:
```bash
docker-compose up -d
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

### API Keys Setup

#### Deepgram API Key (Required for transcription)

1. Sign up at [Deepgram Console](https://console.deepgram.com/)
2. Create a new API key in your project settings
3. Copy the key
4. Add it to your `.env` file:
   ```
   DEEPGRAM_API_KEY="your_key_here"
   ```

**Troubleshooting**: If you see `INVALID_AUTH` errors:
- Verify the key is correct and hasn't expired
- Ensure there are no extra spaces or quotes in `.env`
- Check that the key is properly copied (no missing characters)
- Run `npx tsx scripts/check-services.ts` to validate the key

#### OpenAI API Key (Required for LLM processing)

1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add it to your `.env` file:
   ```
   OPENAI_API_KEY="sk-your_key_here"
   ```

4. Initialize database:
```bash
npm run db:push
npm run db:generate
```

5. Run development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/              # Next.js App Router pages
├── components/       # React components
├── lib/              # Utility functions
├── prisma/           # Prisma schema and migrations
├── types/            # TypeScript type definitions
└── docker-compose.yml # Infrastructure services
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run worker:log` - Show worker processing log (table format)






