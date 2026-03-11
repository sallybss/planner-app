import { startServer } from "./app";

try {
  startServer();
} catch (error) {
  console.error("Failed to start server:", error);
}
