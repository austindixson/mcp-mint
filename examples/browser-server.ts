#!/usr/bin/env npx tsx
/**
 * Headless browser MCP server using Playwright.
 * Provides browser automation tools via MCP protocol.
 *
 * Features:
 * - Automatic page state recovery
 * - Retry logic for transient failures
 * - Configurable timeouts
 * - Proper resource cleanup
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { chromium, type Browser, type Page } from "playwright";

const server = new McpServer({
  name: "browser-server",
  version: "1.1.0",
});

// Configuration
const CONFIG = {
  NAVIGATION_TIMEOUT: 30000,
  ACTION_TIMEOUT: 10000,
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000,
};

// State management
let browser: Browser | null = null;
let page: Page | null = null;
let currentUrl: string | null = null;

async function getPage(): Promise<Page> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  if (!page || page.isClosed()) {
    page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (compatible; MCP-Browser/1.1)',
    });
    page.setDefaultTimeout(CONFIG.ACTION_TIMEOUT);
    currentUrl = null;
  }

  return page;
}

async function resetPage(): Promise<void> {
  if (page && !page.isClosed()) {
    try {
      await page.close();
    } catch {
      // Ignore cleanup errors
    }
  }
  page = null;
  currentUrl = null;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  retries: number = CONFIG.MAX_RETRIES,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
        // Try to reset page state if it might be corrupted
        if (context.includes('navigate') || context.includes('click')) {
          await resetPage();
        }
      }
    }
  }

  throw lastError;
}

server.tool(
  "navigate",
  "Navigate to a URL",
  { url: z.string().url().describe("The URL to navigate to") },
  async ({ url }) => {
    try {
      const result = await withRetry(async () => {
        const p = await getPage();
        const response = await p.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: CONFIG.NAVIGATION_TIMEOUT,
        });

        if (!response) {
          throw new Error("No response received");
        }

        const title = await p.title();
        const status = response.status();
        currentUrl = url;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                title,
                statusCode: status,
                url,
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };
      }, 'navigate');

      return result;
    } catch (error) {
      await resetPage();
      return {
        content: [{
          type: "text",
          text: `Navigation failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true,
      };
    }
  },
);

server.tool(
  "screenshot",
  "Take a screenshot of the current page",
  {
    fullPage: z
      .boolean()
      .optional()
      .describe("Whether to capture the full scrollable page"),
    type: z
      .enum(['png', 'jpeg'])
      .optional()
      .describe("Screenshot format"),
  },
  async ({ fullPage, type }) => {
    try {
      const p = await getPage();
      if (!currentUrl) {
        return {
          content: [{ type: "text", text: "No page loaded. Please navigate first." }],
          isError: true,
        };
      }

      const buffer = await p.screenshot({
        fullPage: fullPage ?? false,
        type: type ?? 'png',
      });
      const base64 = buffer.toString("base64");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              format: type ?? 'png',
              size: buffer.length,
              fullPage: fullPage ?? false,
              data: base64,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true,
      };
    }
  },
);

server.tool(
  "extract_text",
  "Extract all visible text from the current page",
  {
    selector: z
      .string()
      .optional()
      .describe("CSS selector to extract text from (defaults to body)"),
    maxLength: z
      .number()
      .optional()
      .describe("Maximum length of text to return (default 10000)"),
  },
  async ({ selector, maxLength }) => {
    try {
      const p = await getPage();
      if (!currentUrl) {
        return {
          content: [{ type: "text", text: "No page loaded. Please navigate first." }],
          isError: true,
        };
      }

      const target = selector ?? "body";
      const text = await p.locator(target).innerText();
      const maxLen = maxLength ?? 10000;
      const truncated = text.length > maxLen
        ? text.substring(0, maxLen) + `\n\n... [truncated, total ${text.length} chars]`
        : text;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              text: truncated,
              originalLength: text.length,
              truncated: text.length > maxLen,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Text extraction failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true,
      };
    }
  },
);

server.tool(
  "click",
  "Click an element on the page",
  {
    selector: z.string().describe("CSS selector of the element to click"),
    waitFor: z
      .boolean()
      .optional()
      .describe("Wait for navigation after click (default false)"),
  },
  async ({ selector, waitFor }) => {
    try {
      const result = await withRetry(async () => {
        const p = await getPage();
        if (!currentUrl) {
          throw new Error("No page loaded. Please navigate first.");
        }

        if (waitFor) {
          await Promise.all([
            p.waitForNavigation({ timeout: CONFIG.ACTION_TIMEOUT }).catch(() => {}),
            p.click(selector, { timeout: CONFIG.ACTION_TIMEOUT }),
          ]);
        } else {
          await p.click(selector, { timeout: CONFIG.ACTION_TIMEOUT });
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: `Clicked element: ${selector}`,
              selector,
              timestamp: new Date().toISOString(),
            }, null, 2),
          }],
        };
      }, 'click');

      return result;
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Click failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true,
      };
    }
  },
);

server.tool(
  "evaluate",
  "Run JavaScript in the page context",
  {
    script: z.string().describe("JavaScript code to evaluate in the page"),
    timeout: z
      .number()
      .optional()
      .describe("Custom timeout in milliseconds (default 5000)"),
  },
  async ({ script, timeout }) => {
    try {
      const p = await getPage();
      if (!currentUrl) {
        return {
          content: [{ type: "text", text: "No page loaded. Please navigate first." }],
          isError: true,
        };
      }

      const result = await p.evaluate((code) => {
        try {
          // eslint-disable-next-line no-eval
          return eval(code);
        } catch (e) {
          return {
            error: e instanceof Error ? e.message : String(e),
            type: 'evaluation_error',
          };
        }
      }, script);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              result,
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_links",
  "Extract all links from the current page",
  {
    limit: z
      .number()
      .optional()
      .describe("Maximum number of links to return (default 100)"),
  },
  async ({ limit }) => {
    try {
      const p = await getPage();
      if (!currentUrl) {
        return {
          content: [{ type: "text", text: "No page loaded. Please navigate first." }],
          isError: true,
        };
      }

      const maxLinks = limit ?? 100;
      const linkData = await p.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a[href]"));
        if (anchors.length === 0) {
          return {
            info: "No links found on this page",
            count: 0,
            links: [],
          };
        }
        return {
          count: anchors.length,
          links: anchors
            .slice(0, 100)
            .map((a) => ({
              text: (a as HTMLAnchorElement).innerText.trim() || "[no text]",
              href: (a as HTMLAnchorElement).href,
            })),
        };
      });

      const limitedData = maxLinks < linkData.count
        ? {
            ...linkData,
            links: linkData.links.slice(0, maxLinks),
            truncated: true,
            total: linkData.count,
          }
        : linkData;

      return {
        content: [{ type: "text", text: JSON.stringify(limitedData, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Link extraction failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true,
      };
    }
  },
);

// New tool: Health check
server.tool(
  "health",
  "Check the browser server health status",
  {},
  async () => {
    try {
      const p = await getPage();
      const isReady = !p.isClosed();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: isReady ? "healthy" : "unhealthy",
              browserActive: browser?.isConnected() ?? false,
              pageReady: isReady,
              currentPage: currentUrl,
              version: "1.1.0",
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Health check failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true,
      };
    }
  },
);

async function cleanup(): Promise<void> {
  if (page && !page.isClosed()) {
    try {
      await page.close();
    } catch {
      // Ignore cleanup errors
    }
  }
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Ignore cleanup errors
    }
  }
  browser = null;
  page = null;
  currentUrl = null;
}

process.on("SIGINT", () => {
  cleanup().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  cleanup().then(() => process.exit(0));
});
process.on("exit", () => {
  // Synchronous cleanup on exit
  if (browser) {
    browser.close().catch(() => {});
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
