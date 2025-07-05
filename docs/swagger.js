import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Appointment Service API',
      version: '1.0.0',
      description:
        'API for managing appointments in the Healthcare System, compliant with NDHM (audit logs, ABHA-ready), DPDP Act (soft deletes, consent), and Telemedicine Guidelines (KYC, secure workflows). Supports recurring appointments.',
      contact: {
        name: 'Shoaib',
        email: 'shoaib@example.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:8083',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Appointment: {
          type: 'object',
          required: [
            'patientId',
            'doctorId',
            'hospitalId',
            'date',
            'type',
            'consent',
            'createdBy',
            'updatedBy',
          ],
          properties: {
            appointmentId: {
              type: 'string',
              format: 'uuid',
              description: 'Unique identifier for the appointment',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            patientId: {
              type: 'string',
              format: 'uuid',
              description: 'UUID of the patient',
              example: 'patient-uuid-123',
            },
            doctorId: {
              type: 'string',
              format: 'uuid',
              description: 'UUID of the doctor',
              example: 'doctor-uuid-456',
            },
            hospitalId: {
              type: 'string',
              format: 'uuid',
              description: 'UUID of the hospital',
              example: 'hospital-uuid-789',
            },
            date: {
              type: 'string',
              format: 'date-time',
              description:
                'Appointment date and time (ISO 8601, must be in the future)',
              example: '2025-07-07T10:00:00Z',
            },
            duration: {
              type: 'integer',
              description: 'Duration of the appointment in minutes (15–120)',
              example: 30,
            },
            type: {
              type: 'string',
              enum: ['in-person', 'telemedicine'],
              description: 'Type of appointment',
              example: 'telemedicine',
            },
            status: {
              type: 'string',
              enum: ['scheduled', 'completed', 'cancelled'],
              description: 'Status of the appointment',
              example: 'scheduled',
            },
            consent: {
              type: 'object',
              properties: {
                given: {
                  type: 'boolean',
                  description: 'Whether consent is given',
                  example: true,
                },
                purpose: {
                  type: 'string',
                  enum: ['treatment', 'billing', 'research'],
                  description: 'Purpose of consent',
                  example: 'treatment',
                },
                grantedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Timestamp when consent was granted',
                  example: '2025-07-07T10:00:00Z',
                },
              },
            },
            recurrence: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['daily', 'weekly', 'monthly', null],
                  description: 'Recurrence type',
                  example: 'weekly',
                },
                interval: {
                  type: 'integer',
                  description: 'Recurrence interval (e.g., every 1 week)',
                  example: 1,
                },
                endDate: {
                  type: 'string',
                  format: 'date-time',
                  description:
                    'End date for recurrence (must be after appointment date)',
                  example: '2025-08-04T10:00:00Z',
                },
              },
            },
            notes: {
              type: 'string',
              description: 'Additional notes (max 500 characters)',
              example: 'Weekly checkup',
            },
            createdBy: {
              type: 'string',
              description: 'ID of the user who created the appointment',
              example: 'user-uuid-123',
            },
            updatedBy: {
              type: 'string',
              description: 'ID of the user who last updated the appointment',
              example: 'user-uuid-123',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
              example: '2025-07-06T01:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2025-07-06T01:00:00Z',
            },
            deleted: {
              type: 'boolean',
              description: 'Soft delete flag',
              example: false,
            },
            endTime: {
              type: 'string',
              format: 'date-time',
              description:
                'Virtual field: Appointment end time (date + duration)',
              example: '2025-07-07T10:30:00Z',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'fail',
            },
            message: {
              type: 'string',
              example: 'Validation failed',
            },
            errors: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['Patient ID is required'],
            },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: ['./controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
