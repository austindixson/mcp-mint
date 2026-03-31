# mcp-mint Launch Posts

---

## 1. Hacker News (Show HN)

**Title:** Show HN: mcp-mint -- A CLI that tests MCP servers for compliance, security, and correctness

**Body:**

I've been building MCP (Model Context Protocol) servers for a while and kept running into the same problems: malformed schemas, tools that silently accept garbage input, secrets leaking through tool descriptions, SSRF-vulnerable URL parameters. There was no standard way to check any of this before shipping.

So I built mcp-mint. It's a CLI that tests live MCP servers the way Lighthouse tests websites -- runs a suite of checks and gives you an A-F grade.

What it checks:

- Protocol compliance (does your server actually follow the MCP spec?)
- Schema validation (are your tool definitions well-formed?)
- Security scanning (26 secret patterns -- AWS keys, Stripe tokens, JWTs, Supabase keys, etc.)
- Vulnerability detection (SSRF, path traversal, command injection)

Basic usage:

```bash
npm install -g mcp-mint

# Test a live server
mcp-mint test "node my-server.js"

# Validate a manifest without running anything
mcp-mint validate manifest.json

# Scaffold a new MCP server
mcp-mint init my-api --template rest-api

# Inject GitHub Actions CI into your project
mcp-mint ci

# Debug a broken server
mcp-mint doctor
```

Output looks something like:

```
  Schema Compliance    ████████████████████  A
  Protocol Correctness ████████████████████  A
  Security             ██████████████░░░░░░  C

  WARN: Possible AWS key detected in tool "fetch_data" description
  FAIL: Path traversal not blocked on "read_file" path parameter

  Overall Grade: B
```

The test suite has 91+ tests at 99% coverage. It's not trying to be a framework or a platform -- just a focused testing tool you run before you ship.

GitHub: https://github.com/austindixson/mcp-mint

Happy to answer questions about the implementation or MCP testing in general.

---

## 2. X/Twitter Thread

**Tweet 1 (Hook):**

I got mass off shipping MCP servers with no way to know if they were actually correct or secure.

So I built mcp-mint -- a CLI that grades your MCP server A-F like Lighthouse does for websites.

It catches real bugs. Here's what it found in servers I thought were production-ready:

**Tweet 2:**

One command to test any MCP server:

```
mcp-mint test "node my-server.js"
```

[image: Terminal output showing mcp-mint running against a server, with colored grade bars for Schema Compliance (A), Protocol Correctness (A), and Security (C), plus specific WARN and FAIL lines]

It checks schema compliance, protocol correctness, and security -- 91+ tests in seconds.

**Tweet 3:**

The security scanner detects 26 secret patterns:
- AWS access keys
- Stripe API keys
- Supabase tokens
- JWTs
- Private keys
- ...and 21 more

It also catches SSRF, path traversal, and command injection vulnerabilities in your tool parameters.

[image: Terminal showing security scan results with detected secret patterns highlighted in red and vulnerability findings listed]

**Tweet 4:**

You don't even need a running server to start:

```
mcp-mint validate manifest.json
```

Offline validation catches schema issues before you waste time debugging at runtime.

And `mcp-mint doctor` diagnoses common server issues when things aren't working.

**Tweet 5:**

Want CI for your MCP server? One command:

```
mcp-mint ci
```

Injects a GitHub Actions workflow into your project. Every push gets graded.

[image: GitHub Actions check passing with mcp-mint grade summary in the PR comment]

**Tweet 6:**

Starting a new MCP server from scratch?

```
mcp-mint init my-api --template rest-api
```

Templates for rest-api, database, and filesystem servers. Scaffolded with best practices so you start at an A, not a D.

**Tweet 7:**

It's free, it's open source, it's on npm:

```
npm install -g mcp-mint
```

GitHub: github.com/austindixson/mcp-mint

If you're building MCP servers, give it a run and let me know what it catches. PRs welcome.

---

## 3. Reddit r/LocalLLaMA

**Title:** I built a testing CLI for MCP servers -- grades them A-F for compliance and security

**Body:**

For anyone not familiar: MCP (Model Context Protocol) is the open standard that lets LLMs call external tools -- read files, query databases, hit APIs, etc. If you've used Claude's tool use or built integrations for local models, you've probably touched MCP or something like it.

The problem I kept hitting: there's no good way to test whether your MCP server is actually correct. Does it follow the spec? Are the schemas valid? Is it accidentally leaking your AWS keys in tool descriptions? Is the file-reading tool vulnerable to path traversal?

So I built **mcp-mint**. It's a CLI that runs your MCP server through a battery of tests and gives you a letter grade (A-F), similar to how Lighthouse grades websites.

What it does:

- **`mcp-mint test "node my-server.js"`** -- tests a live server for schema compliance, protocol correctness, and security issues
- **`mcp-mint validate manifest.json`** -- offline validation without running anything
- **`mcp-mint init <name> --template rest-api|database|filesystem`** -- scaffolds a new server with best practices
- **`mcp-mint ci`** -- adds GitHub Actions to your project
- **`mcp-mint doctor`** -- diagnoses common issues

On the security side, it detects 26 secret patterns (AWS, Stripe, Supabase, JWT, etc.) and checks for SSRF, path traversal, and command injection.

This is relevant for the local LLM crowd because as more people build tool-calling pipelines with local models (via LiteLLM, Ollama, vLLM, etc.), the MCP servers you connect are a real attack surface. A bad tool definition can let a model exfiltrate data or execute arbitrary commands. Testing that stuff before deployment matters.

Install: `npm install -g mcp-mint`

GitHub: https://github.com/austindixson/mcp-mint

91+ tests, 99% coverage on the tool itself. Would appreciate feedback from anyone building MCP integrations for local setups.

---

## 4. Reddit r/ClaudeAI

**Title:** Built a CLI to test and grade custom MCP servers before connecting them to Claude

**Body:**

If you're building custom MCP servers for Claude Code or Claude Desktop, you've probably had that moment where a tool just... doesn't work, and you have no idea if the problem is your schema, your server, or something else entirely.

I built **mcp-mint** to fix that. It's a testing CLI that runs your MCP server through compliance, correctness, and security checks, then gives you an A-F grade.

Quick example:

```bash
npm install -g mcp-mint
mcp-mint test "node my-server.js"
```

It'll tell you exactly what's wrong:

- Schema issues (missing descriptions, wrong types, malformed JSON Schema)
- Protocol violations (bad response formats, missing required fields)
- Security problems (secrets in tool descriptions, SSRF-vulnerable parameters, path traversal, command injection)

The security scanner checks for 26 secret patterns -- if you accidentally put an AWS key or Stripe token in a tool description, Claude can see it, and so can anyone with access to the MCP manifest.

Other useful commands:

- **`mcp-mint validate manifest.json`** -- check your config without running the server
- **`mcp-mint doctor`** -- figure out why your server won't connect
- **`mcp-mint init my-tool --template rest-api`** -- scaffold a new server that starts at grade A
- **`mcp-mint ci`** -- add GitHub Actions so every push gets tested

I've been using this on my own MCP servers for Claude Code and it's caught issues I would have spent hours debugging otherwise. The `doctor` command alone has saved me a lot of headaches with connection problems.

GitHub: https://github.com/austindixson/mcp-mint
npm: `npm install -g mcp-mint`

Would love feedback from anyone else building MCP tools for Claude.

---

## 5. Anthropic Discord / MCP Discord

**Title:** mcp-mint -- CLI for testing MCP servers

**Message:**

Hey all -- I built a CLI tool called **mcp-mint** that might be useful if you're building MCP servers.

It basically runs your server through a set of compliance, correctness, and security checks and gives you an A-F grade. Think Lighthouse but for MCP.

```bash
npm install -g mcp-mint
mcp-mint test "node my-server.js"
```

It catches stuff like:
- Schema issues that cause tools to silently break
- Protocol violations
- Secrets accidentally exposed in tool descriptions (checks 26 patterns)
- SSRF, path traversal, command injection vulnerabilities

There's also `mcp-mint doctor` for debugging connection issues, `mcp-mint validate` for offline manifest checking, and `mcp-mint init` to scaffold new servers from templates.

GitHub: https://github.com/austindixson/mcp-mint

Still actively working on it -- happy to hear what checks would be most useful to add. If you run into issues, feel free to open an issue or ping me here.

---

## 6. awesome-mcp-servers PR Description

**Category:** Testing / Developer Tools

**List entry:**

```markdown
- [mcp-mint](https://github.com/austindixson/mcp-mint) - CLI testing tool that grades MCP servers A-F for schema compliance, protocol correctness, and security. Detects 26 secret patterns, SSRF, path traversal, and command injection. Includes server scaffolding, CI injection, and offline manifest validation.
```

**PR Title:** Add mcp-mint to Testing/Developer Tools

**PR Body:**

Adding mcp-mint, a CLI for testing MCP servers.

- Tests live servers for schema compliance, protocol correctness, and security vulnerabilities
- Grades servers A-F (similar to Lighthouse)
- Detects 26 secret patterns (AWS, Stripe, Supabase, JWT, etc.) and common vulnerabilities (SSRF, path traversal, command injection)
- Offline manifest validation, server scaffolding with templates, GitHub Actions CI injection, and a diagnostic `doctor` command
- 91+ tests, 99% coverage
- Available on npm: `npm install -g mcp-mint`
