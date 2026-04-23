import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'RentalApp API',
      version: '1.0.0',
      description: 'API REST para gestión de alquiler residencial — contratos, pagos, verificación y marketplace de servicios.',
    },
    servers: [
      { url: process.env.APP_URL || 'http://localhost:3000', description: 'Servidor actual' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            requestId: { type: 'string' },
          },
        },
        UserRole: {
          type: 'string',
          enum: ['landlord', 'tenant', 'pro', 'admin', 'agency', 'institution_viewer'],
        },
        Property: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            address: { type: 'string' },
            availableFrom: { type: 'string', format: 'date' },
            landlordId: { type: 'string' },
          },
        },
        Contract: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            propertyId: { type: 'string' },
            landlordId: { type: 'string' },
            tenantId: { type: 'string' },
            status: {
              type: 'string',
              enum: ['draft', 'pending_signature', 'active', 'terminated', 'cancelled'],
            },
            monthlyRent: { type: 'number' },
            deposit: { type: 'number' },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                role: { $ref: '#/components/schemas/UserRole' },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Autenticación y registro de usuarios' },
      { name: 'Properties', description: 'Gestión de propiedades en alquiler' },
      { name: 'Contracts', description: 'Contratos de alquiler y firma electrónica' },
      { name: 'Payments', description: 'Pagos, depósitos y gestión Stripe' },
      { name: 'Tenant PRO', description: 'Verificación y programa Tenant PRO' },
      { name: 'Tickets', description: 'Solicitudes de mantenimiento' },
      { name: 'Admin', description: 'Panel de administración y cumplimiento' },
      { name: 'Institution', description: 'Portal institucional (solo lectura)' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
