import express from "express";
import cors from "cors";
import { checkStatusMiddleware } from "./middleware/checkStatus";
import googleMapsRouter from "./api/routes/googleMapsScraper";
import enrichmentRouter from "./api/routes/enrichment.routes";
import exportRouter from "./api/routes/export.routes";
import authRouter from "./api/routes/auth.routes";
import apiKeyRouter from "./api/routes/apiKey.routes";

const app = express();


app.use(
  cors({
    origin: ["http://localhost:3000"],
  })
);
app.use(express.json());

// --- SECTION 1: Routes WITHOUT the status check middleware (Public Section) ---
const publicRouter = express.Router();

publicRouter.get("/health", (_, res) => {
    res.json({
        success: true,
        message: "Public route: API is healthy and reachable.",
    });
});

publicRouter.get("/info", (_, res) => {
    res.json({
        success: true,
        message: "This endpoint is public and bypasses the check middleware.",
    });
});

// Register public routes under the /public namespace
app.use("/public", publicRouter);

// --- SECTION 2: Global Middleware (Applied to all routes defined after this line) ---
app.use(checkStatusMiddleware);

// --- SECTION 3: Protected Routes (Require validation endpoint to assess to true) ---
app.use("/auth", authRouter);
app.use("/api-keys", apiKeyRouter);
app.use("/", googleMapsRouter);
app.use("/", enrichmentRouter);
app.use("/export", exportRouter);


app.get("/", (_, res) => {
    res.json({
        success: true,
        message: "API Running (Access allowed by status check middleware)",
    });
});

app.get("/users", (_, res) => {
    res.json({
        success: true,
        users: [
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
        ],
    });
});

import { searchQueue } from "./queue/search.queue";
import { enrichmentQueue } from "./queue/enrichment.queue";
import { redisConnection } from "./queue/redis";

const server = app.listen(3000, () => {
    console.log("Server running on port 3000");
});

// --- Graceful Shutdown Handler ---
async function shutdown() {
  console.log("\nShutting down Express server gracefully...");
  server.close(async () => {
    try {
      await searchQueue.close();
      await enrichmentQueue.close();
      await redisConnection.disconnect();
      console.log("Express server, Queues, and Redis connections closed successfully.");
      process.exit(0);
    } catch (error) {
      console.error("Error during graceful shutdown:", error);
      process.exit(1);
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);