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
      title: "Planix API",
      version: "1.0.0",
      description:
        "MongoDB + Express + TypeScript REST API for managing calendar events and workspace modules.",
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
        Task: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["todo", "in-progress", "done"] },
            priority: { type: "string", enum: ["low", "medium", "high"] },
            owner: { type: "string" },
          },
        },
        Note: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            tone: { type: "string", enum: ["charcoal", "amber", "mint", "violet"] },
            owner: { type: "string" },
          },
        },
        BudgetEntry: {
          type: "object",
          properties: {
            month: { type: "string", example: "2026-05" },
            type: { type: "string", enum: ["income", "fixed", "variable", "savings"] },
            category: { type: "string" },
            label: { type: "string" },
            amount: { type: "number" },
            owner: { type: "string" },
          },
        },
        BudgetRowDef: {
          type: "object",
          properties: {
            label: { type: "string", example: "Main salary" },
            type: { type: "string", enum: ["income", "fixed", "variable", "savings"] },
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
