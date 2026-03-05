# Contributing

## Setup
1. Install Node.js 20+.
2. Run `npm install` in repo root.
3. Run `npm run test:smoke`.

## Development
- Main server entry: `packages/or-research-hub-mcp/server.cjs`.
- Default journal sources: `packages/or-research-hub-mcp/subscriptions.json`.
- Keep tool I/O backward-compatible.

## Release
1. Bump version in `packages/or-research-hub-mcp/package.json`.
2. Tag `vX.Y.Z`.
3. Push tag and update release notes.
