import swaggerJsdoc from "swagger-jsdoc";

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
  },
  apis: ["./src/controllers/*"],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
