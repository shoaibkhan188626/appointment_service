import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const appointmentSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: String,
      default: uuidv4,
      unique: true,
      required: [true, 'Appointment ID is required'],
      immutable: true,
    },

    patientId: {
      type: String,
      required: [true, 'Patient ID is required'],
      index: true,
      validate: {
        validator: async function (value) {
          return value && typeof value === 'string' && value.length > 0;
        },
        message: 'Invalid Patient ID',
      },
    },

    doctorId: {
      type: String,
      required: [true, 'Doctor ID is required'],
      index: true,
      validate: {
        validator: async function (value) {
          return value && typeof value === 'string' && value.length > 0;
        },
        message: 'Invalid doctor ID',
      },
    },

    hospitalId: {
      type: String,
      required: [true, 'Hospital ID is required'],
      index: true,
      validate: {
        validator: async function (value) {
          return value && typeof value === 'string' && value.length > 0;
        },
        message: 'Invalid hospital ID',
      },
    },

    date: {
      type: Date,
      required: [true, 'Appointment data is required'],
      index: true,
      validate: {
        validator: function (value) {
          return value > new Date();
        },
        message: 'Appointment date must be in the future',
      },
    },

    duration: {
      type: Number,
      default: 30,
      min: [15, 'Duration must be at least 15 minutes'],
      max: [120, 'Duration cannot exceed 120 minutes'],
    },

    type: {
      type: String,
      enum: ['in-person', 'telemedicine'],
      default: 'in-person',
      required: [true, 'Appointment type is required'],
    },

    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },

    content: {
      type: {
        given: { type: Boolean, default: false },
        purpose: {
          type: String,
          enum: ['treatment', 'billing', 'research'],
          default: 'treatment',
        },
        grantedAt: { type: Date },
      },
      default: { given: false, purpose: 'treatment' },
    },

    notes: {
      type: String,
      trim: true,
      maxLength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },

    createdBy: {
      type: String,
      required: [true, 'Creator ID is required'],
      default: 'system',
    },

    updatedBy: {
      type: String,
      required: [true, 'Update ID is required'],
      default: 'system',
    },

    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },

    deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
