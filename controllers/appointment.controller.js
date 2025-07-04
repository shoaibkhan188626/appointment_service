import {
  createAppointmentSchema,
  updateAppointmentSchema,
  queryAppointmentsSchema,
} from '../validations/appointment.validation.js';
import Appointment from '../models/appointment.js';
import {
  validateHospital,
  validateUser,
  createNotification,
} from '../services/appointment_service.js';
import CustomError from '../utils/error.js';
import logger from '../config/logger.js';

export const createAppointment = async (req, res, next) => {
  try {
    const { error, value } = createAppointmentSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const details = error.details.map((detail) => detail.message);
      throw new CustomError('Validation Failed', 400, { errors: details });
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
    } = value;
    const patient = await validateUser(patientId, 'patient');
    const doctor = await validateUser(doctorId, 'doctor');
    if (!doctor.kycVerified) {
      throw new CustomError('Doctor KYC not verified', 403, { doctorId });
    }
    await validateHospital(hospitalId);

    const appointment = new Appointment({
      patientId,
      doctorId,
      hospitalId,
      date,
      duration,
      type,
      notes,
      consent,
      createdBy: req.user?.id || 'system',
      updatedBy: req.user?.id || 'system',
    });
    await appointment.save();

    try {
      await createNotification({
        type: 'email',
        recipient: patient.email,
        subject: `Appointment Confirmation- ${type}`,
        message: `Your ${type} appointment with Dr. ${doctor.name} on ${date} at ${hospitalId} is confirmed`,
        externalId: appointment.appointmentId,
      });
    } catch (notificationErr) {
      logger.warn(
        `Notification failed for appointment ${appointment.appointmentId} : ${notificationErr.message}`
      );
    }
    logger.info(`Appointment created :${appointment.appointmentId}`, {
      patientId,
      doctorId,
      hospitalId,
      date,
      type,
    });
    res.status(201).json({
      status: 'success',
      data: appointment,
    });
  } catch (err) {
    logger.error(`Failed to create appointment : ${err.message}`, {
      stack: err.stack,
      body: req.body,
    });
    next(err);
  }
};

export const getAppointments = async (req, res, next) => {
  try {
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

    const query = { deleted: false };
    if (patientId) query.patientId = patientId;
    if (doctorId) query.doctorId = doctorId;
    if (hospitalId) query.hospitalId = hospitalId;
    if (status) query.status = status;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

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
    });
    res.json({
      status: 'success',
      data: appointments,
      meta: {
        total,
        page,
        limit,
        page: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error(`Failed to retrieve appointments: ${err.message}`, {
      stack: err.stack,
      query: req.query,
    });
    next(err);
  }
};

export const getAppointmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new CustomError('invalid appointment ID format', 400, { id });
    }

    const appointment = await Appointment.findOne({
      appointmentId: id,
      deleted: false,
    }).select('-__v');
    if (!appointment) {
      throw new CustomError('Appointment not found ', 404, { id });
    }
    logger.info(`Retrieved appointment: ${id}`);
    res.json({
      status: 'success',
      data: appointment,
    });
  } catch (err) {
    logger.error(
      `Failed to retrieve appointment ${req.params.id}: ${err.message}`,
      {
        stack: err.stack,
      }
    );
    next(err);
  }
};

export const updateAppointment = async (req, res, next) => {
  try {
    const { error, value } = updateAppointmentSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const details = error.details.map((detail) => detail.message);
      throw new CustomError('Validation failed', 404, { errors: details });
    }
    const { id } = req.params;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(id)) {
      throw new CustomError('Invalid appointment ID format', 400, { id });
    }
    const appointment = await Appointment.findOne({
      appointmentId: id,
      deleted: false,
    });
    if (!appointment) {
      throw new CustomError('Appointment not found', 404, { id });
    }

    const updates = {
      ...value,
      updatedBy: req.user?.id || 'system',
      updatedAt: Date.now(),
    };
    Object.assign(appointment, updates);
    await appointment.save();

    try {
      const patient = await validateUser(appointment.patientId, 'patient');
      await createNotification({
        type: 'email',
        recipient: patient.email,
        subject: 'Appointment Updated',
        message: `Your appointment on ${appointment.date} has been updated.`,
        externalId: appointment.appointmentId,
      });
    } catch (notificationErr) {
      logger.warn(
        `Notification failed for appointment ${appointment.appointmentId} : ${notificationErr.message}`
      );
    }
    logger.info(`Appointment updated : ${id}`, { updates });
    res.json({
      status: 'success',
      data: appointment,
    });
  } catch (err) {
    logger.error(
      `Failed to update appointment ${req.params.id} : ${err.message}`,
      {
        stack: err.stack,
        body: req.body,
      }
    );
    next(err);
  }
};

export const cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(id)) {
      throw new CustomError('Invalid appointment ID format', 400, { id });
    }

    const appointment = await Appointment.findOne({
      appointmentId: id,
      deleted: false,
    });
    if (!appointment) {
      throw new CustomError(`Appointment not found `, 404, { id });
    }

    appointment.status = 'cancelled';
    appointment.deleted = true;
    appointment.updatedBy = req.user?.id || 'system';
    appointment.updatedAt = Date.now();

    await appointment.save();

    try {
      const patient = await validateUser(appointment.patientId, 'patient');
      await createNotification({
        type: 'email',
        recipient: patient.email,
        subject: 'Appointment Cancelled',
        message: `Your appointment on ${appointment.date} has been cancelled.`,
        externalId: appointment.appointmentId,
      });
    } catch (notificationErr) {
      logger.warn(
        `Notification failed for appointment ${appointment.appointmentId} : ${notificationErr.message}`
      );
    }
    logger.info(`Appointment cancelled :${id}`);
    res.json({
      status: 'success',
      message: 'appointment cancelled successfully',
    });
  } catch (err) {
    logger.error(
      `Failed to cancel appointment ${req.params.id} : ${err.message}`,
      {
        stack: err.stack,
      }
    );
    next(err);
  }
};
