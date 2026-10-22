#!/usr/bin/env bash
set -e

echo "🚀 Starting Jarvis..."

# Check dependencies
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org or via: brew install node"
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "❌ Docker not found. Install from https://docker.com"
  exit 1
fi

# Start Postgres
echo "📦 Starting PostgreSQL..."
docker compose up -d postgres

# Wait for postgres to be ready
echo "⏳ Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U jarvis &>/dev/null; do sleep 1; done
echo "✅ PostgreSQL ready."

# Install dependencies
echo "📦 Installing dependencies..."
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Push DB schema
echo "🗄️  Pushing database schema..."
cd backend && npm run db:push && cd ..

# Start both servers
echo "🟢 Starting backend + frontend..."
npm run dev
