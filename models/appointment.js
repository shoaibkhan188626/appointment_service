import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';

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
      required: [true, 'Appointment date is required'],
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
    consent: {
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
    recurrence: {
      type: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', null],
        default: null,
      },
      interval: {
        type: Number,
        min: [1, 'Recurrence interval must be at least 1'],
        default: null,
      },
      endDate: {
        type: Date,
        default: null,
        validate: {
          validator: function (value) {
            return !this.recurrence?.type || (value && value > this.date);
          },
          message: 'Recurrence end date must be after the appointment date',
        },
      },
    },
    createdBy: {
      type: String,
      required: [true, 'Creator ID is required'],
      default: 'system',
    },
    updatedBy: {
      type: String,
      required: [true, 'Updater ID is required'],
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

appointmentSchema.virtual('endTime').get(function () {
  return new Date(this.date.getTime() + this.duration * 60 * 1000);
});

appointmentSchema.index({ doctorId: 1, date: 1, deleted: 1 });

appointmentSchema.pre('save', async function (next) {
  if (
    this.isNew ||
    this.isModified('date') ||
    this.isModified('doctorId') ||
    this.isModified('duration')
  ) {
    const startTime = this.date;
    const endTime = new Date(startTime.getTime() + this.duration * 60 * 1000);
    const conflicting = await this.constructor.findOne({
      doctorId: this.doctorId,
      deleted: false,
      status: { $ne: 'cancelled' },
      _id: { $ne: this._id },
      date: {
        $lte: endTime,
        $gte: new Date(startTime.getTime() - 120 * 60 * 1000),
      },
    });
    if (conflicting) {
      const error = new Error(
        `Doctor unavailable from ${startTime} to ${endTime}`
      );
      error.statusCode = 409;
      return next(error);
    }
  }
  next();
});

appointmentSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (update.deleted === true) {
    update.status = 'cancelled';
    update.updatedBy = update.updatedBy || 'system';
    update.updatedAt = Date.now();
  }
  next();
});

appointmentSchema.post('save', function (doc) {
  logger.info(`Appointment ${doc.appointmentId} saved by ${doc.createdBy}`);
});

appointmentSchema.pre('find', function () {
  this.where({ deleted: false });
});

appointmentSchema.pre('findOne', function () {
  this.where({ deleted: false });
});

export default mongoose.model('Appointment', appointmentSchema);
