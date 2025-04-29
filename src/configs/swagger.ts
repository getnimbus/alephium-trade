import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Alephium Token Price API",
      version: "1.0.0",
      description: "API for fetching Alephium token prices and information",
    },
    servers: [
      {
        url: `https://price-alph.getnimbus.io`,
        description: "Production server",
      },
      {
        url: `http://localhost:3000`,
        description: "Local server",
      },
    ],
    paths: {
      "/api/prices": {
        get: {
          summary: "Get token price and information",
          description:
            "Returns the latest price and information for a specific Alephium token",
          parameters: [
            {
              in: "query",
              name: "address",
              required: false,
              schema: {
                type: "string",
              },
              description: "The contract address of the token",
            },
            {
              in: "query",
              name: "contractId",
              required: false,
              schema: {
                type: "string",
              },
              description: "The contract id of the token",
            },
          ],
          responses: {
            "200": {
              description: "Token price and information",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        description: "Contract ID in hex format",
                      },
                      address: {
                        type: "string",
                        description: "Token contract address",
                      },
                      name: {
                        type: "string",
                        description: "Token name",
                      },
                      symbol: {
                        type: "string",
                        description: "Token symbol",
                      },
                      decimals: {
                        type: "number",
                        description: "Token decimals",
                      },
                      logo: {
                        type: "string",
                        description: "Token logo URL",
                      },
                      price: {
                        type: "number",
                        description: "Latest token price",
                      },
                      timestamp: {
                        type: "number",
                        description: "Price timestamp",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Bad request - contract address is required",
            },
            "500": {
              description: "Internal server error",
            },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);

export const setupSwagger = (app: Express): void => {
  // Swagger UI setup
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Swagger JSON endpoint
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
};
