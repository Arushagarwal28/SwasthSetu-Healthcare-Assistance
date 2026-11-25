import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SwasthSetu API',
      version: '1.0.0',
      description: 'Rural healthcare symptom triage & referral platform API',
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/app.ts', './src/routes/**/*.ts', './src/modules/**/*.ts'], // where it looks for JSDoc @swagger comments
};

export const swaggerSpec = swaggerJsdoc(options);