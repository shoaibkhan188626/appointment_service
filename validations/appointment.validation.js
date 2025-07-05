import Joi from 'joi';

export const createAppointmentSchema = Joi.object({
  patientId: Joi.string().uuid().required().messages({
    'string.uuid': 'Patient ID must be a valid UUID',
    'any.required': 'Patient ID is required',
  }),
  doctorId: Joi.string().uuid().required().messages({
    'string.uuid': 'Doctor ID must be a valid UUID',
    'any.required': 'Doctor ID is required',
  }),
  hospitalId: Joi.string().uuid().required().messages({
    'string.uuid': 'Hospital ID must be a valid UUID',
    'any.required': 'Hospital ID is required',
  }),
  date: Joi.date().iso().greater('now').required().messages({
    'date.iso': 'Date must be a valid ISO 8601 date',
    'date.greater': 'Appointment date must be in the future',
    'any.required': 'Appointment date is required',
  }),
  duration: Joi.number().integer().min(15).max(120).default(30).messages({
    'number.min': 'Duration must be at least 15 minutes',
    'number.max': 'Duration cannot exceed 120 minutes',
  }),
  type: Joi.string()
    .valid('in-person', 'telemedicine')
    .default('in-person')
    .required()
    .messages({
      'any.only': 'Type must be either in-person or telemedicine',
      'any.required': 'Appointment type is required',
    }),
  notes: Joi.string().max(500).trim().allow('').default('').messages({
    'string.max': 'Notes cannot exceed 500 characters',
  }),
  consent: Joi.object({
    given: Joi.boolean().default(false).required().messages({
      'any.required': 'Consent status is required',
    }),
    purpose: Joi.string()
      .valid('treatment', 'billing', 'research')
      .default('treatment')
      .required()
      .messages({
        'any.only': 'Consent purpose must be treatment, billing, or research',
        'any.required': 'Consent purpose is required',
      }),
    grantedAt: Joi.date().iso().optional().allow(null),
  })
    .default({ given: false, purpose: 'treatment' })
    .required()
    .messages({
      'any.required': 'Consent is required',
    }),
  recurrence: Joi.object({
    type: Joi.string().valid('daily', 'weekly', 'monthly', null).default(null),
    interval: Joi.number()
      .integer()
      .min(1)
      .when('type', {
        is: Joi.exist().valid('daily', 'weekly', 'monthly'),
        then: Joi.required(),
        otherwise: Joi.allow(null).default(null),
      }),
    endDate: Joi.date()
      .iso()
      .greater(Joi.ref('...date'))
      .when('type', {
        is: Joi.exist().valid('daily', 'weekly', 'monthly'),
        then: Joi.required(),
        otherwise: Joi.allow(null).default(null),
      }),
  })
    .optional()
    .default({ type: null, interval: null, endDate: null }),
});

export const updateAppointmentSchema = Joi.object({
  date: Joi.date().iso().greater('now').optional().messages({
    'date.iso': 'Date must be a valid ISO 8601 date',
    'date.greater': 'Appointment date must be in the future',
  }),
  duration: Joi.number().integer().min(15).max(120).optional().messages({
    'number.min': 'Duration must be at least 15 minutes',
    'number.max': 'Duration cannot exceed 120 minutes',
  }),
  type: Joi.string().valid('in-person', 'telemedicine').optional().messages({
    'any.only': 'Type must be either in-person or telemedicine',
  }),
  notes: Joi.string().max(500).trim().allow('').optional().messages({
    'string.max': 'Notes cannot exceed 500 characters',
  }),
  consent: Joi.object({
    given: Joi.boolean().required().messages({
      'any.required': 'Consent status is required',
    }),
    purpose: Joi.string()
      .valid('treatment', 'billing', 'research')
      .required()
      .messages({
        'any.only': 'Consent purpose must be treatment, billing, or research',
        'any.required': 'Consent purpose is required',
      }),
    grantedAt: Joi.date().iso().optional().allow(null),
  }).optional(),
  recurrence: Joi.object({
    type: Joi.string().valid('daily', 'weekly', 'monthly', null).default(null),
    interval: Joi.number()
      .integer()
      .min(1)
      .when('type', {
        is: Joi.exist().valid('daily', 'weekly', 'monthly'),
        then: Joi.required(),
        otherwise: Joi.allow(null).default(null),
      }),
    endDate: Joi.date()
      .iso()
      .greater(Joi.ref('...date'))
      .when('type', {
        is: Joi.exist().valid('daily', 'weekly', 'monthly'),
        then: Joi.required(),
        otherwise: Joi.allow(null).default(null),
      }),
  }).optional(),
});

export const queryAppointmentsSchema = Joi.object({
  patientId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Patient ID must be a valid UUID',
  }),
  doctorId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Doctor ID must be a valid UUID',
  }),
  hospitalId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Hospital ID must be a valid UUID',
  }),
  status: Joi.string().valid('scheduled', 'completed', 'cancelled').optional(),
  type: Joi.string().valid('in-person', 'telemedicine').optional(),
  startDate: Joi.date().iso().optional().messages({
    'date.iso': 'Start date must be a valid ISO 8601 date',
  }),
  endDate: Joi.date().iso().optional().messages({
    'date.iso': 'End date must be a valid ISO 8601 date',
  }),
  page: Joi.number().integer().min(1).default(1).messages({
    'number.min': 'Page must be at least 1',
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100',
  }),
});
