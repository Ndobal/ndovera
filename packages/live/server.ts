import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Mediasoup Signaling Simulation ---
  // In a real implementation, you would initialize mediasoup workers and routers here.
  // For now, we provide the API structure for signaling.

  app.get("/api/meeting/config", (req, res) => {
    res.json({
      rtcCapabilities: {}, // Mocked router capabilities
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
  });

  app.post("/api/meeting/join", (req, res) => {
    const { roomId, userId } = req.body;
    res.json({
      success: true,
      transportOptions: {
        id: "mock-transport-id",
        iceParameters: {},
        iceCandidates: [],
        dtlsParameters: {}
      }
    });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Auralis Server running on http://localhost:${PORT}`);
  });
}

startServer();
