import express from "express";
import path from "path";
import { execSync } from "child_process";
import { createProxyMiddleware } from "http-proxy-middleware";

async function startServer() {
  // Ensure Redis, MongoDB, and Go/Gin backend are started
  try {
    console.log("[server] Bootstrapping background services (Redis, MongoDB, Go/Gin)...");
    execSync("bash ./start-services.sh", { stdio: "inherit" });
  } catch (err: any) {
    console.error("[server] Warning during start-services.sh:", err?.message || err);
  }

  const app = express();
  const PORT = 3000;
  const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8081";

  // Reverse proxy for /api and /ws directly to Go/Gin backend
  const backendProxy = createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
    ws: true,
    on: {
      error: (err, req, res: any) => {
        console.error("[proxy error]", err.message, req.url);
        if (res && res.writeHead && !res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Go/Gin backend unreachable on port 8081",
              details: err.message,
            })
          );
        }
      },
    },
  });

  // Proxy /api/* and /ws/* preserving the full URL path
  app.use("/api", (req, res, next) => {
    req.url = "/api" + req.url;
    backendProxy(req, res, next);
  });

  app.use("/ws", (req, res, next) => {
    req.url = "/ws" + req.url;
    backendProxy(req, res, next);
  });

  // In development, mount Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built static assets from dist/
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] Running on http://0.0.0.0:${PORT} (proxying /api and /ws to ${BACKEND_URL})`);
  });

  // Forward WebSocket upgrade requests to Go/Gin
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/ws") || req.url?.startsWith("/api")) {
      backendProxy.upgrade(req, socket as any, head);
    }
  });
}

startServer().catch((err) => {
  console.error("[server] Fatal startup error:", err);
  process.exit(1);
});
