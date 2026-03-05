# OR Research Hub MCP

A publish-ready MCP server for operations research literature intelligence, with RSS subscription management, retrieval workflows, and structured SAR-style brief generation.

## Features
- Journal RSS subscription management (`list_subscriptions`, `subscribe_journal`, `unsubscribe_journal`)
- Incremental feed refresh and cache query (`refresh_subscriptions`, `query_subscribed_papers`)
- Intelligence workflows (`intelligence_search`, `daily_push`)
- Structured Non-Abstract SAR output and markdown export (`save_brief_markdown`)
- Local paper indexing (`list_paper_index`)

## Current Subscribed Journals (23)

### Elsevier
1. Transportation Research Part B  
   Feed: `https://rss.sciencedirect.com/publication/science/01912615`
2. Transportation Research Part E  
   Feed: `https://rss.sciencedirect.com/publication/science/13665545`
3. European Journal of Operational Research (EJOR)  
   Feed: `https://rss.sciencedirect.com/publication/science/03772217`
4. Omega  
   Feed: `https://rss.sciencedirect.com/publication/science/03050483`
5. Reliability Engineering and System Safety (RESS)  
   Feed: `https://rss.sciencedirect.com/publication/science/09518320`
6. Computers and Industrial Engineering (CAIE)  
   Feed: `https://rss.sciencedirect.com/publication/science/03608352`
7. Computers and Operations Research (C&OR)  
   Feed: `https://rss.sciencedirect.com/publication/science/03050548`
8. International Journal of Production Economics (IJPE)  
   Feed: `https://rss.sciencedirect.com/publication/science/09255273`

### Springer
9. OR Spectrum  
   Feed: `https://link.springer.com/search.rss?facet-journal-id=291`
10. Journal of Heuristics  
    Feed: `https://link.springer.com/search.rss?facet-journal-id=10732`
11. Journal of Optimization Theory and Applications  
    Feed: `https://link.springer.com/search.rss?facet-journal-id=10957`

### INFORMS
12. Management Science  
    Feed: `https://pubsonline.informs.org/action/showFeed?jc=mnsc&type=etoc`
13. Operations Research  
    Feed: `https://pubsonline.informs.org/action/showFeed?jc=opre&type=etoc`
14. Transportation Science  
    Feed: `https://pubsonline.informs.org/action/showFeed?jc=trsc&type=etoc`
15. Manufacturing and Service Operations Management (M&SOM)  
    Feed: `https://pubsonline.informs.org/action/showFeed?jc=msom&type=etoc`
16. Organization Science  
    Feed: `https://pubsonline.informs.org/action/showFeed?jc=orsc&type=etoc`
17. INFORMS Journal on Optimization  
    Feed: `https://pubsonline.informs.org/action/showFeed?jc=ijoo&type=etoc`

### arXiv
18. arXiv Robotics (cs.RO)  
    Feed: `https://rss.arxiv.org/rss/cs.RO`
19. arXiv Artificial Intelligence (cs.AI)  
    Feed: `https://rss.arxiv.org/rss/cs.AI`
20. arXiv Mathematical Optimization (math.OC)  
    Feed: `https://rss.arxiv.org/rss/math.OC`

### Taylor & Francis
21. International Journal of Production Research (IJPR)  
    Feed: `https://www.tandfonline.com/action/showFeed?jc=tprs20&type=etoc`
22. IISE Transactions  
    Feed: `https://www.tandfonline.com/action/showFeed?jc=uiie21&type=etoc`
23. Transport Reviews  
    Feed: `https://www.tandfonline.com/action/showFeed?jc=ttrv20&type=etoc`

## Quick Start
```bash
npm install
npm run test:smoke
npm run start
```

Main implementation:
- `packages/or-research-hub-mcp/server.cjs`
- `packages/or-research-hub-mcp/subscriptions.json`

---

## Configuration (Client Configs)
Use the local absolute path of your server file:
`your_path\or-research-hub-mcp\packages\or-research-hub-mcp\server.cjs`

### Codex
```json
{
  "mcpServers": {
    "or-research-hub": {
      "command": "node",
      "args": [
        "your_path/or-research-hub-mcp/packages/or-research-hub-mcp/server.cjs"
      ]
    }
  }
}
```

### Claude Code
CLI:
```bash
claude mcp add or-research-hub -- node "your_path/or-research-hub-mcp/packages/or-research-hub-mcp/server.cjs"
```

JSON:
```json
{
  "mcpServers": {
    "or-research-hub": {
      "command": "node",
      "args": [
        "your_path/or-research-hub-mcp/packages/or-research-hub-mcp/server.cjs"
      ]
    }
  }
}
```

### Cherry Studio
```json
{
  "mcpServers": {
    "or-research-hub": {
      "command": "node",
      "args": [
        "your_path/or-research-hub-mcp/packages/or-research-hub-mcp/server.cjs"
      ]
    }
  }
}
```

### Trae
```json
{
  "mcpServers": {
    "or-research-hub": {
      "command": "node",
      "args": [
        "your_path/or-research-hub-mcp/packages/or-research-hub-mcp/server.cjs"
      ]
    }
  }
}
```

### Cursor
```json
{
  "mcpServers": {
    "or-research-hub": {
      "command": "node",
      "args": [
        "your_path/or-research-hub-mcp/packages/or-research-hub-mcp/server.cjs"
      ]
    }
  }
}
```

Reference files are also provided under:
- `docs/config-examples/`

---

## Usage Examples

### Example 1: Daily push for port/AGV/terminal papers
```json
{
  "name": "daily_push",
  "arguments": {
    "query": "港口 AGV 码头 调度",
    "keywords": ["港口", "码头", "AGV", "调度", "port", "terminal", "quay", "yard", "scheduling"],
    "limit": 5,
    "includeFulltext": true,
    "refresh": true
  }
}
```

### Example 2: Query year 2025 and generate structured SAR
```json
{
  "name": "intelligence_search",
  "arguments": {
    "yearFrom": 2025,
    "yearTo": 2025,
    "keywords": ["港口", "码头", "AGV", "调度", "port", "terminal", "quay", "yard", "scheduling"],
    "limit": 8,
    "includeSAR": true,
    "includeFulltext": true,
    "refresh": false
  }
}
```

### Example 3: Quick cache query
```json
{
  "name": "query_subscribed_papers",
  "arguments": {
    "query": "quay crane scheduling",
    "limit": 10,
    "sinceDays": 365,
    "refresh": false
  }
}
```

---

## Sample Output

### `refresh_subscriptions`
```json
{
  "total": 23,
  "success": 23,
  "failed": 0,
  "updatedCount": 23
}
```

### `daily_push` (strict query may return no hit)
```json
{
  "today": "2026-03-05",
  "scanned": 0,
  "pushed": 0,
  "filePath": "your_path/Daily_Pulse_OR_2026-03-05.md"
}
```

### `intelligence_search` (with structured SAR)
```json
{
  "total": 3,
  "results": [
    {
      "title": "Electric vehicle scheduling problem considering time-of-use electricity price",
      "evidenceSource": "openalex",
      "sar": {
        "structured": {
          "researchProblem": "...",
          "researchMotivation": "...",
          "method": {
            "framework": "...",
            "components": []
          },
          "experimentDesign": {
            "researchQuestionAndMotivation": "..."
          },
          "experimentResults": {
            "positiveFindings": "..."
          },
          "insights": {
            "futureWork": "..."
          }
        }
      }
    }
  ]
}
```

---

## Customization

### 1) Edit journal subscriptions directly
File: `packages/or-research-hub-mcp/subscriptions.json`

Entry format:
```json
{
  "id": "transportation-science",
  "name": "Transportation Science",
  "group": "INFORMS",
  "enabled": true,
  "url": "https://pubsonline.informs.org/action/showFeed?jc=trsc&type=etoc"
}
```

Rules:
- `id` must be unique and stable.
- `url` should be reachable and valid RSS.
- after editing, call `refresh_subscriptions` with `force: true`.

### 2) Add/remove journals dynamically via tools
- Add: `subscribe_journal`
- Remove: `unsubscribe_journal`
- Check list: `list_subscriptions`

### 3) Tune performance and coverage
Adjust arguments in workflow calls:
- `maxFeeds`
- `limitPerFeed`
- `concurrency`
- `limit`
- `includeFulltext`
- `includeSAR`

### 4) Change markdown output path
Use `outputDir` in `daily_push` and `save_brief_markdown`.

### 5) Common troubleshooting
- Empty results: often query is too strict or no new paper in time window.
- Refresh errors: usually source timeout/anti-bot; lower concurrency and retry.

## Repository Structure
- `.github/workflows/ci.yml`
- `docs/client-configs.md`
- `docs/usage-examples.md`
- `docs/sample-output.md`
- `docs/customization.md`
- `packages/or-research-hub-mcp/server.cjs`
- `packages/or-research-hub-mcp/subscriptions.json`

## License
MIT
