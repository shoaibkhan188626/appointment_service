import Joi from 'joi';

// Joi schema for creating an appointment
export const createAppointmentSchema = Joi.object({
  patientId: Joi.string().required().messages({
    'string.empty': 'Patient ID is required',
    'any.required': 'Patient ID is required',
  }),
  doctorId: Joi.string().required().messages({
    'string.empty': 'Doctor ID is required',
    'any.required': 'Doctor ID is required',
  }),
  hospitalId: Joi.string().required().messages({
    'string.empty': 'Hospital ID is required',
    'any.required': 'Hospital ID is required',
  }),
  date: Joi.date().iso().min('now').required().messages({
    'date.base': 'Date must be a valid ISO date (e.g., 2025-07-04T10:00:00Z)',
    'date.min': 'Date must be in the future',
    'any.required': 'Date is required',
  }),
  duration: Joi.number().integer().min(15).max(120).default(30).messages({
    'number.base': 'Duration must be a number',
    'number.integer': 'Duration must be an integer',
    'number.min': 'Duration must be at least 15 minutes',
    'number.max': 'Duration cannot exceed 120 minutes',
  }),
  type: Joi.string()
    .valid('in-person', 'telemedicine')
    .default('in-person')
    .messages({
      'any.only': 'Type must be either in-person or telemedicine',
    }),
  notes: Joi.string().max(500).allow('').default('').messages({
    'string.max': 'Notes cannot exceed 500 characters',
  }),
  consent: Joi.object({
    given: Joi.boolean().default(false).messages({
      'boolean.base': 'Consent given must be a boolean',
    }),
    purpose: Joi.string()
      .valid('treatment', 'billing', 'research')
      .default('treatment')
      .messages({
        'any.only': 'Consent purpose must be treatment, billing, or research',
      }),
  })
    .default({ given: false, purpose: 'treatment' })
    .messages({
      'object.base': 'Consent must be an object',
    }),
});

// Joi schema for updating an appointment
export const updateAppointmentSchema = Joi.object({
  date: Joi.date().iso().min('now').optional().messages({
    'date.base': 'Date must be a valid ISO date (e.g., 2025-07-04T10:00:00Z)',
    'date.min': 'Date must be in the future',
  }),
  duration: Joi.number().integer().min(15).max(120).optional().messages({
    'number.base': 'Duration must be a number',
    'number.integer': 'Duration must be an integer',
    'number.min': 'Duration must be at least 15 minutes',
    'number.max': 'Duration cannot exceed 120 minutes',
  }),
  type: Joi.string().valid('in-person', 'telemedicine').optional().messages({
    'any.only': 'Type must be either in-person or telemedicine',
  }),
  status: Joi.string()
    .valid('scheduled', 'completed', 'cancelled')
    .optional()
    .messages({
      'any.only': 'Status must be scheduled, completed, or cancelled',
    }),
  notes: Joi.string().max(500).allow('').optional().messages({
    'string.max': 'Notes cannot exceed 500 characters',
  }),
  consent: Joi.object({
    given: Joi.boolean().optional().messages({
      'boolean.base': 'Consent given must be a boolean',
    }),
    purpose: Joi.string()
      .valid('treatment', 'billing', 'research')
      .optional()
      .messages({
        'any.only': 'Consent purpose must be treatment, billing, or research',
      }),
  })
    .optional()
    .messages({
      'object.base': 'Consent must be an object',
    }),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided for update',
  });

// Joi schema for querying appointments (filters)
export const queryAppointmentsSchema = Joi.object({
  patientId: Joi.string().optional().messages({
    'string.empty': 'Patient ID cannot be empty',
  }),
  doctorId: Joi.string().optional().messages({
    'string.empty': 'Doctor ID cannot be empty',
  }),
  hospitalId: Joi.string().optional().messages({
    'string.empty': 'Hospital ID cannot be empty',
  }),
  status: Joi.string()
    .valid('scheduled', 'completed', 'cancelled')
    .optional()
    .messages({
      'any.only': 'Status must be scheduled, completed, or cancelled',
    }),
  type: Joi.string().valid('in-person', 'telemedicine').optional().messages({
    'any.only': 'Type must be either in-person or telemedicine',
  }),
  startDate: Joi.date().iso().optional().messages({
    'date.base': 'Start date must be a valid ISO date',
  }),
  endDate: Joi.date()
    .iso()
    .optional()
    .when('startDate', {
      is: Joi.exist(),
      then: Joi.date().iso().min(Joi.ref('startDate')).messages({
        'date.min': 'End date must be after start date',
      }),
    }),
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be a number',
    'number.integer': 'Page must be an integer',
    'number.min': 'Page must be at least 1',
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'Limit must be a number',
    'number.integer': 'Limit must be an integer',
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100',
  }),
});
