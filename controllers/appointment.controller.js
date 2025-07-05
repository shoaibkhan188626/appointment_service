import {
  createAppointmentSchema,
  updateAppointmentSchema,
  queryAppointmentsSchema,
} from '../validations/appointment.validation.js';
import Appointment from '../models/appointment.js';
import {
  validateUser,
  validateHospital,
  createNotification,
} from '../services/appointment_service.js';
import CustomError from '../utils/error.js';
import logger from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

// Helper function to generate recurring appointments
const generateRecurringAppointments = async (baseAppointment, recurrence) => {
  const { type, interval, endDate } = recurrence;
  const appointments = [];
  let currentDate = new Date(baseAppointment.date);
  const end = new Date(endDate);

  while (currentDate <= end) {
    appointments.push({
      ...baseAppointment,
      appointmentId: uuidv4(),
      date: new Date(currentDate),
    });

    if (type === 'daily') {
      currentDate.setDate(currentDate.getDate() + interval);
    } else if (type === 'weekly') {
      currentDate.setDate(currentDate.getDate() + interval * 7);
    } else if (type === 'monthly') {
      currentDate.setMonth(currentDate.getMonth() + interval);
    }
  }

  return appointments;
};

// Create a new appointment
export const createAppointment = async (req, res, next) => {
  try {
    // Validate input
    const { error, value } = createAppointmentSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const details = error.details.map((detail) => detail.message);
      throw new CustomError('Validation failed', 400, { errors: details });
    }

    const {
      patientId,
      doctorId,
      hospitalId,
      date,
      duration,
      type,
      notes,
      consent,
      recurrence,
    } = value;

    // RBAC: Patients can only create appointments for themselves
    if (req.user.role === 'patient' && req.user.id !== patientId) {
      throw new CustomError(
        'Patients can only create appointments for themselves',
        403
      );
    }

    // Validate patient and doctor via User Service
    const patient = await validateUser(patientId, 'patient');
    const doctor = await validateUser(doctorId, 'doctor');
    if (!doctor.kycVerified) {
      throw new CustomError('Doctor KYC not verified', 403, { doctorId });
    }

    // Validate hospital via Hospital Service
    await validateHospital(hospitalId);

    // Base appointment
    const baseAppointment = {
      patientId,
      doctorId,
      hospitalId,
      date: new Date(date),
      duration,
      type,
      notes,
      consent: {
        given: consent.given,
        purpose: consent.purpose,
        grantedAt: consent.given ? new Date() : null,
      },
      recurrence: recurrence.type
        ? {
            type: recurrence.type,
            interval: recurrence.interval,
            endDate: new Date(recurrence.endDate),
          }
        : { type: null, interval: null, endDate: null },
      createdBy: req.user.id,
      updatedBy: req.user.id,
    };

    // Generate recurring appointments if applicable
    const appointmentsToSave = recurrence.type
      ? await generateRecurringAppointments(baseAppointment, recurrence)
      : [baseAppointment];

    // Save appointments and check conflicts
    const savedAppointments = [];
    for (const appt of appointmentsToSave) {
      const appointment = new Appointment(appt);
      await appointment.save();
      savedAppointments.push(appointment);

      // Send notifications (email and SMS)
      try {
        await createNotification({
          type: 'email',
          recipient: patient.email,
          subject: `Appointment Confirmation - ${type}`,
          message: `Your ${type} appointment with Dr. ${doctor.name} on ${appt.date} at ${hospitalId} is confirmed.`,
          externalId: appointment.appointmentId,
        });
        if (patient.phoneNumber) {
          await createNotification({
            type: 'sms',
            recipient: patient.email,
            phoneNumber: patient.phoneNumber,
            subject: `Appointment Confirmation`,
            message: `Your ${type} appt with Dr. ${doctor.name} on ${appt.date} is confirmed.`,
            externalId: appointment.appointmentId,
          });
        }
      } catch (notificationErr) {
        logger.warn(
          `Notification failed for appointment ${appointment.appointmentId}: ${notificationErr.message}`
        );
      }

      logger.info(`Appointment created: ${appointment.appointmentId}`, {
        patientId,
        doctorId,
        hospitalId,
        date: appt.date,
        type,
        user: req.user.id,
      });
    }

    // Set header for recurring appointment count
    if (recurrence.type) {
      res.set('X-Recurring-Count', savedAppointments.length);
    }

    res.status(201).json({
      status: 'success',
      data: savedAppointments,
    });
  } catch (err) {
    logger.error(`Failed to create appointment: ${err.message}`, {
      stack: err.stack,
      body: req.body,
      user: req.user,
    });
    next(err);
  }
};

// Get all appointments with filtering and pagination
export const getAppointments = async (req, res, next) => {
  try {
    // Validate query parameters
    const { error, value } = queryAppointmentsSchema.validate(req.query, {
      abortEarly: false,
    });
    if (error) {
      const details = error.details.map((detail) => detail.message);
      throw new CustomError('Query validation failed', 400, {
        errors: details,
      });
    }

    const {
      patientId,
      doctorId,
      hospitalId,
      status,
      type,
      startDate,
      endDate,
      page,
      limit,
    } = value;

    // RBAC: Restrict query based on role
    const query = { deleted: false };
    if (req.user.role === 'patient') {
      query.patientId = req.user.id;
    } else if (req.user.role === 'doctor') {
      query.doctorId = req.user.id;
    } else if (req.user.role !== 'admin') {
      throw new CustomError('Access denied: Invalid role', 403);
    }

    // Apply filters
    if (patientId && req.user.role === 'admin') query.patientId = patientId;
    if (doctorId && req.user.role === 'admin') query.doctorId = doctorId;
    if (hospitalId) query.hospitalId = hospitalId;
    if (status) query.status = status;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const appointments = await Appointment.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-__v');

    const total = await Appointment.countDocuments(query);

    logger.info(`Retrieved ${appointments.length} appointments`, {
      query,
      page,
      limit,
      total,
      user: req.user.id,
    });

    res.json({
      status: 'success',
      data: appointments,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error(`Failed to retrieve appointments: ${err.message}`, {
      stack: err.stack,
      query: req.query,
      user: req.user,
    });
    next(err);
  }
};

// Get a single appointment by ID
export const getAppointmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ID format (UUID)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new CustomError('Invalid appointment ID format', 400, { id });
    }

    const query = { appointmentId: id, deleted: false };
    // RBAC: Restrict access
    if (req.user.role === 'patient') {
      query.patientId = req.user.id;
    } else if (req.user.role === 'doctor') {
      query.doctorId = req.user.id;
    } else if (req.user.role !== 'admin') {
      throw new CustomError('Access denied: Invalid role', 403);
    }

    const appointment = await Appointment.findOne(query).select('-__v');
    if (!appointment) {
      throw new CustomError('Appointment not found or access denied', 404, {
        id,
      });
    }

    logger.info(`Retrieved appointment: ${id}`, { user: req.user.id });
    res.json({
      status: 'success',
      data: appointment,
    });
  } catch (err) {
    logger.error(
      `Failed to retrieve appointment ${req.params.id}: ${err.message}`,
      {
        stack: err.stack,
        user: req.user,
      }
    );
    next(err);
  }
};

// Update an appointment
export const updateAppointment = async (req, res, next) => {
  try {
    // Validate input
    const { error, value } = updateAppointmentSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const details = error.details.map((detail) => detail.message);
      throw new CustomError('Validation failed', 400, { errors: details });
    }

    const { id } = req.params;

    // Validate ID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new CustomError('Invalid appointment ID format', 400, { id });
    }

    const query = { appointmentId: id, deleted: false };
    // RBAC: Restrict access
    if (req.user.role === 'patient') {
      query.patientId = req.user.id;
    } else if (req.user.role !== 'admin') {
      throw new CustomError('Access denied: Invalid role', 403);
    }

    const appointment = await Appointment.findOne(query);
    if (!appointment) {
      throw new CustomError('Appointment not found or access denied', 404, {
        id,
      });
    }

    // Update fields
    const updates = {
      ...value,
      updatedBy: req.user.id,
      updatedAt: Date.now(),
    };
    if (value.consent) {
      updates.consent = {
        given: value.consent.given,
        purpose: value.consent.purpose,
        grantedAt: value.consent.given
          ? new Date()
          : appointment.consent.grantedAt,
      };
    }
    if (value.recurrence) {
      updates.recurrence = {
        type: value.recurrence.type,
        interval: value.recurrence.interval,
        endDate: value.recurrence.endDate
          ? new Date(value.recurrence.endDate)
          : null,
      };
    }
    Object.assign(appointment, updates);

    await appointment.save();

    // Send update notifications (email and SMS)
    try {
      const patient = await validateUser(appointment.patientId, 'patient');
      await createNotification({
        type: 'email',
        recipient: patient.email,
        subject: 'Appointment Updated',
        message: `Your appointment on ${appointment.date} has been updated.`,
        externalId: appointment.appointmentId,
      });
      if (patient.phoneNumber) {
        await createNotification({
          type: 'sms',
          recipient: patient.email,
          phoneNumber: patient.phoneNumber,
          subject: 'Appointment Updated',
          message: `Your appt on ${appointment.date} updated.`,
          externalId: appointment.appointmentId,
        });
      }
    } catch (notificationErr) {
      logger.warn(
        `Notification failed for appointment ${appointment.appointmentId}: ${notificationErr.message}`
      );
    }

    logger.info(`Appointment updated: ${id}`, { updates, user: req.user.id });
    res.json({
      status: 'success',
      data: appointment,
    });
  } catch (err) {
    logger.error(
      `Failed to update appointment ${req.params.id}: ${err.message}`,
      {
        stack: err.stack,
        body: req.body,
        user: req.user,
      }
    );
    next(err);
  }
};

// Cancel (soft delete) an appointment
export const cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new CustomError('Invalid appointment ID format', 400, { id });
    }

    const query = { appointmentId: id, deleted: false };
    // RBAC: Restrict access
    if (req.user.role === 'patient') {
      query.patientId = req.user.id;
    } else if (req.user.role !== 'admin') {
      throw new CustomError('Access denied: Invalid role', 403);
    }

    const appointment = await Appointment.findOne(query);
    if (!appointment) {
      throw new CustomError('Appointment not found or access denied', 404, {
        id,
      });
    }

    // Soft delete
    appointment.status = 'cancelled';
    appointment.deleted = true;
    appointment.updatedBy = req.user.id;
    appointment.updatedAt = Date.now();

    await appointment.save();

    // Send cancellation notifications (email and SMS)
    try {
      const patient = await validateUser(appointment.patientId, 'patient');
      await createNotification({
        type: 'email',
        recipient: patient.email,
        subject: 'Appointment Cancelled',
        message: `Your appointment on ${appointment.date} has been cancelled.`,
        externalId: appointment.appointmentId,
      });
      if (patient.phoneNumber) {
        await createNotification({
          type: 'sms',
          recipient: patient.email,
          phoneNumber: patient.phoneNumber,
          subject: 'Appointment Cancelled',
          message: `Your appt on ${appointment.date} cancelled.`,
          externalId: appointment.appointmentId,
        });
      }
    } catch (notificationErr) {
      logger.warn(
        `Notification failed for appointment ${appointment.appointmentId}: ${notificationErr.message}`
      );
    }

    logger.info(`Appointment cancelled: ${id}`, { user: req.user.id });
    res.json({
      status: 'success',
      message: 'Appointment cancelled successfully',
    });
  } catch (err) {
    logger.error(
      `Failed to cancel appointment ${req.params.id}: ${err.message}`,
      {
        stack: err.stack,
        user: req.user,
      }
    );
    next(err);
  }
};
