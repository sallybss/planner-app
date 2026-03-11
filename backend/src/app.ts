import express, { Application } from "express";
import dotenvFlow from "dotenv-flow";
import cors from "cors";

import routes from "./routes";
import { setupDocs } from "./util/doc";

dotenvFlow.config();

const app: Application = express();

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:3000",
]);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.has(origin)) return callback(null, true);

    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "auth-token", "Authorization"],
};

app.use(cors(corsOptions));

app.use(express.json());

app.use("/api", routes);
setupDocs(app);

export function startServer() {
  const PORT: number = parseInt(process.env.PORT as string) || 4000;

  app.listen(PORT, () => {
    console.log("Server is running on port: " + PORT);
  });
}

export default app;
