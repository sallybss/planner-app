import type { Application } from "express";
import path from "path";

export async function setupDocs(app: Application) {
  const [{ default: swaggerUi }, { default: swaggerJSDoc }] = await Promise.all([
    import("swagger-ui-express"),
    import("swagger-jsdoc")
  ]);

  const isProd = process.env.NODE_ENV === "production";

  const swaggerDefinition = {
    openapi: "3.0.0",
    info: {
      title: "Planner Events API",
      version: "1.0.0",
      description:
        "MongoDB + Express + TypeScript REST API for managing planner events",
    },
    servers: [
      {
        url: "http://localhost:4000/api",
        description: isProd ? "Production server" : "Local development server",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "auth-token",
        },
      },
      schemas: {
        Event: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            date: { type: "string", format: "date-time" },
            startTime: { type: "string" },
            endTime: { type: "string" },
            color: { type: "string" },
            category: { type: "string" },
            owner: { type: "string" },
          },
        },
        User: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            password: { type: "string" },
          },
        },
      },
    },
  };

  const options = {
    swaggerDefinition,
    apis: [
      isProd
        ? path.join(process.cwd(), "dist", "**", "*.js")
        : path.join(process.cwd(), "src", "**", "*.ts"),
    ],
  };

  const swaggerSpec = swaggerJSDoc(options);

  app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
