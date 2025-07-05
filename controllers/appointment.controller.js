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

/**
 * Generates recurring appointments based on recurrence settings
 * @param {Object} baseAppointment - Base appointment object
 * @param {Object} recurrence - Recurrence settings (type, interval, endDate)
 * @returns {Array} Array of appointment objects
 */
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

/**
 * @swagger
 * /api/v1/appointments:
 *   post:
 *     summary: Create a new appointment
 *     description: Creates one or more appointments (for recurring schedules). Patients can only create for themselves. Doctors must be KYC-verified (Telemedicine Guidelines). Rate limited to 50 requests/15min (25 for recurring). Returns X-Recurring-Count header for recurring appointments.
 *     tags: [Appointments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Appointment'
 *     responses:
 *       201:
 *         description: Appointment(s) created successfully
 *         headers:
 *           X-Recurring-Count:
 *             description: Number of recurring appointments created
 *             schema:
 *               type: integer
 *               example: 5
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden (RBAC or KYC failure)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Doctor unavailable (conflict)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/v1/appointments:
 *   get:
 *     summary: Get all appointments
 *     description: Retrieves appointments with filtering and pagination. Patients see only their appointments, doctors see their own, admins see all. Rate limited to 200 requests/15min.
 *     tags: [Appointments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by patient ID (admin only)
 *       - in: query
 *         name: doctorId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by doctor ID (admin only)
 *       - in: query
 *         name: hospitalId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by hospital ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, completed, cancelled]
 *         description: Filter by status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [in-person, telemedicine]
 *         description: Filter by appointment type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: List of appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appointment'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 50
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     pages:
 *                       type: integer
 *                       example: 5
 *       400:
 *         description: Query validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden (RBAC)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/v1/appointments/{id}:
 *   get:
 *     summary: Get an appointment by ID
 *     description: Retrieves a single appointment by UUID. Patients and doctors see only their own appointments, admins see all. Rate limited to 200 requests/15min.
 *     tags: [Appointments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: Appointment UUID
 *     responses:
 *       200:
 *         description: Appointment details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Invalid ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Appointment not found or access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden (RBAC)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/v1/appointments/{id}:
 *   put:
 *     summary: Update an appointment
 *     description: Updates an appointment by UUID. Patients can only update their own appointments, admins can update any. Rate limited to 50 requests/15min.
 *     tags: [Appointments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: Appointment UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: '2025-07-07T10:00:00Z'
 *               duration:
 *                 type: integer
 *                 example: 30
 *               type:
 *                 type: string
 *                 enum: [in-person, telemedicine]
 *                 example: telemedicine
 *               notes:
 *                 type: string
 *                 example: Updated notes
 *               consent:
 *                 type: object
 *                 properties:
 *                   given:
 *                     type: boolean
 *                     example: true
 *                   purpose:
 *                     type: string
 *                     enum: [treatment, billing, research]
 *                     example: treatment
 *                   grantedAt:
 *                     type: string
 *                     format: date-time
 *                     example: '2025-07-07T10:00:00Z'
 *               recurrence:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [daily, weekly, monthly, null]
 *                     example: weekly
 *                   interval:
 *                     type: integer
 *                     example: 1
 *                   endDate:
 *                     type: string
 *                     format: date-time
 *                     example: '2025-08-04T10:00:00Z'
 *     responses:
 *       200:
 *         description: Appointment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Appointment not found or access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden (RBAC)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/v1/appointments/{id}:
 *   delete:
 *     summary: Cancel an appointment
 *     description: Soft deletes an appointment by UUID (sets status to cancelled, deleted to true). Patients can only cancel their own appointments, admins can cancel any. Rate limited to 50 requests/15min.
 *     tags: [Appointments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: Appointment UUID
 *     responses:
 *       200:
 *         description: Appointment cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Appointment cancelled successfully
 *       400:
 *         description: Invalid ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Appointment not found or access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden (RBAC)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Checks the health of the Appointment Service. Rate limited to 1000 requests/15min.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: '2025-07-06T01:00:00Z'
 */
export const healthCheck = async (req, res) => {
  logger.info('Health check endpoint accessed');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
};

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Prometheus metrics
 *     description: Exposes Prometheus metrics for monitoring (http_requests_total, http_request_duration_seconds, http_errors_total, recurring_appointments_created_total).
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Metrics data
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: |
 *                 http_requests_total{method="POST",route="/api/v1/appointments",status="201"} 5
 *                 recurring_appointments_created_total{type="weekly"} 3
 *       500:
 *         description: Error retrieving metrics
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Error retrieving metrics
 */
export const metricsEndpoint = (req, res) => {
  res.set('Content-Type', client.register.contentType);
  client.register
    .metrics()
    .then((metrics) => res.send(metrics))
    .catch((err) => {
      logger.error(`Failed to serve metrics: ${err.message}`, {
        stack: err.stack,
      });
      res.status(500).send('Error retrieving metrics');
    });
};
