# OR Research Hub MCP

A publish-ready MCP server project for operations research journal intelligence.

This repository follows a lightweight n8n-style monorepo layout:
- root-level docs/CI/metadata
- package implementation under `packages/`

## Features
- RSS journal subscription management
- search across subscribed feeds
- intelligence workflow (`daily_push`, `intelligence_search`)
- Non-Abstract SAR structured output

## Repository structure
- `.github/workflows/ci.yml`
- `docs/client-configs.md`
- `docs/usage-examples.md`
- `docs/sample-output.md`
- `docs/customization.md`
- `packages/or-research-hub-mcp/server.cjs`
- `packages/or-research-hub-mcp/subscriptions.json`

## Quick start
```bash
npm install
npm run test:smoke
npm run start
```

## Tools
- `list_subscriptions`
- `subscribe_journal`
- `unsubscribe_journal`
- `refresh_subscriptions`
- `query_subscribed_papers`
- `intelligence_search`
- `daily_push`
- `save_brief_markdown`
- `list_paper_index`

## Configuration docs
See `docs/client-configs.md`.

## License
MIT
