# Client Config Examples

以下示例都以本仓库本地路径为例：
`your_path/or-research-hub-mcp/packages/or-research-hub-mcp/server.cjs`

## 1) Codex
配置文件（示例）：
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

## 2) Claude Code
命令方式：
```bash
claude mcp add or-research-hub -- node "your_path/or-research-hub-mcp/packages/or-research-hub-mcp/server.cjs"
```

JSON 方式（`mcpServers`）：
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

## 3) Cherry Studio
在 Cherry Studio 的 MCP 配置中新增：
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

## 4) Trae
项目级配置（常见为 `.trae/mcp.json`）：
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

## 5) Cursor
在 Cursor 的 MCP Servers 配置中新增：
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

## 说明
- 各客户端 UI 名称与配置文件路径会随版本变化，但 `mcpServers` 的结构一致。
- 建议先用 `node --check server.cjs` 和 `npm run test:smoke` 验证本地可运行。
- 可直接复制 `docs/config-examples/` 下对应 JSON：
  - `codex.mcp.json`
  - `claude-code.mcp.json`
  - `cherry-studio.mcp.json`
  - `trae.mcp.json`
  - `cursor.mcp.json`
