import express, { Application } from "express";
import dotenvFlow from "dotenv-flow";
import cors from "cors";

import routes from "./routes";
import { setupDocs } from "./util/doc";

dotenvFlow.config();

const app: Application = express();

const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "https://planix-265e.onrender.com",
  ...configuredOrigins,
]);

function isAllowedOrigin(origin: string) {
  if (allowedOrigins.has(origin)) return true;

  return /^https:\/\/planix-[a-z0-9-]+\.onrender\.com$/i.test(origin);
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (isAllowedOrigin(origin)) return callback(null, true);

    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "auth-token", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());

app.use("/api", routes);

export function startServer() {
  const PORT: number = parseInt(process.env.PORT as string) || 4000;
 
  app.listen(PORT, () => {
    console.log("Server is running on port: " + PORT);

    void setupDocs(app).catch((error) => {
      console.error("Failed to setup Swagger docs:", error);
    });
  });
}

export default app;
