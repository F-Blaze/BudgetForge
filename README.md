# BudgetForge

AI-powered budget/BOM audit tool for hobbyist hardware projects. Paste a parts
list, get each item classified (critical/important/nice-to-have/redundant),
flagged for overpricing, and given category-level cheaper alternatives with
explicit pros/cons.

## Setup

```bash
npm install
cp .env.local.example .env.local   # then fill in GROQ_API_KEY
npm run dev
```

## Deploy

Deploy to Vercel and set `GROQ_API_KEY` as an environment variable in
the project settings (never commit it).
