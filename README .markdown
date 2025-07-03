# Appointment Service

The **Appointment Service** is a microservice designed to manage appointment-related operations for the healthcare ecosystem, integrating with the **Hospital Service** (`https://github.com/shoaibkhan188626/hospital-service.git`), **Notification Service** (`https://github.com/shoaibkhan188626/notification-service.git`), and **User Service**. It provides a RESTful API to create, retrieve, update, and cancel appointments, ensuring compliance with NDHM (National Digital Health Mission), DPDP Act (Digital Personal Data Protection Act), and Telemedicine Guidelines.

- **Repository**: [https://github.com/shoaibkhan188626/appointment-service.git](https://github.com/shoaibkhan188626/appointment-service.git)
- **Default Port**: `8083`
- **Base URL**: `http://localhost:8083` (for local development)
- **License**: MIT

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Service](#running-the-service)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Docker Support](#docker-support)
- [Compliance](#compliance)
- [Contributing](#contributing)
- [License](#license)

## Features

- Create, retrieve, update, and cancel appointments for patients and doctors.
- Integrates with User Service for patient/doctor validation and KYC checks.
- Integrates with Hospital Service for hospital validation.
- Triggers notifications (e.g., email, SMS) via Notification Service for appointment events.
- Secure API with JWT authentication.
- Logger integration for audit trails (NDHM compliance).
- Dockerized for easy deployment.
- Supports soft deletes for data protection (DPDP Act).

## Prerequisites

- **Node.js**: v22.x or later
- **npm**: v9.x or later
- **MongoDB**: Local instance or MongoDB Atlas
- **Docker**: For containerized setup (optional)
- **Git**: For cloning the repository
- **Dependent Services**:
  - Hospital Service running at `http://localhost:8082`
  - Notification Service running at `http://localhost:8081`
  - User Service running at `http://localhost:8080`

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/shoaibkhan188626/appointment-service.git
   cd appointment-service
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

Create a `.env` file in the root directory with the following variables:

```
NODE_ENV=development
PORT=8083
MONGO_URI_LOCAL=mongodb://mongodb:27017/appointment-service
MONGO_URI_ATLAS=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/appointment-service?retryWrites=true&w=majority
JWT_SECRET=Xy9vA$23k!ZbLp@76JrQmEwTn$HsDfGuIoPaLzXcVbNmQwErTyUiOp1234567890
SERVICE_KEY=a7b9c2d8e4f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4
HOSPITAL_SERVICE_URL=http://localhost:8082
USER_SERVICE_URL=http://localhost:8080
NOTIFICATION_SERVICE_URL=http://localhost:8081
LOG_LEVEL=info
```

- Replace `<user>:<pass>` with your MongoDB Atlas credentials.
- `JWT_SECRET` and `SERVICE_KEY` must match other services (Hospital, Notification, User) for inter-service authentication.
- `HOSPITAL_SERVICE_URL`, `USER_SERVICE_URL`, and `NOTIFICATION_SERVICE_URL` point to respective service instances.

## Running the Service

### Local Development

1. Ensure MongoDB and dependent services (Hospital, Notification, User) are running.
2. Start the service:
   ```bash
   npm run dev
   ```

   - Uses `nodemon` to watch for file changes.
   - Expected output: `Server running on port 8083` in `logs/combined.log`.

### Production

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the service:
   ```bash
   npm start
   ```

## API Endpoints

All endpoints require an `Authorization: Bearer <SERVICE_KEY_JWT>` header. Use the `generate-jwt.js` script to create the JWT (see `utils/generate-jwt.js`).

### Health Check

- **Method**: GET
- **URL**: `/health`
- **Headers**: None
- **Response**:
  - `200 OK`
  - Body: `{"status": "OK"}`

### Create Appointment

- **Method**: POST
- **URL**: `/api/appointments`
- **Headers**:
  - `Authorization: Bearer <SERVICE_KEY_JWT>`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "patientId": "patient-uuid-123",
    "doctorId": "doctor-uuid-456",
    "hospitalId": "hospital-uuid-789",
    "date": "2025-07-04T10:00:00Z"
  }
  ```
- **Response**:
  - `201 Created`
  - Body:
    ```json
    {
      "status": "success",
      "data": {
        "appointmentId": "<uuid>",
        "patientId": "patient-uuid-123",
        "doctorId": "doctor-uuid-456",
        "hospitalId": "hospital-uuid-789",
        "date": "2025-07-04T10:00:00Z",
        "status": "scheduled",
        "createdAt": "<timestamp>",
        "updatedAt": "<timestamp>",
        "deleted": false
      }
    }
    ```
- **Notes**: Triggers a notification via Notification Service. Validates patient, doctor, and hospital via User and Hospital Services.

### Get Appointments

- **Method**: GET
- **URL**: `/api/appointments`
- **Headers**:
  - `Authorization: Bearer <SERVICE_KEY_JWT>`
- **Response**:
  - `200 OK`
  - Body:
    ```json
    {
      "status": "success",
      "data": [
        {
          "appointmentId": "<uuid>",
          "patientId": "patient-uuid-123",
          "doctorId": "doctor-uuid-456",
          "hospitalId": "hospital-uuid-789",
          "date": "2025-07-04T10:00:00Z",
          "status": "scheduled",
          "createdAt": "<timestamp>",
          "updatedAt": "<timestamp>",
          "deleted": false
        }
      ]
    }
    ```

### Update Appointment

- **Method**: PUT
- **URL**: `/api/appointments/:id`
- **Headers**:
  - `Authorization: Bearer <SERVICE_KEY_JWT>`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "date": "2025-07-04T12:00:00Z",
    "status": "scheduled"
  }
  ```
- **Response**:
  - `200 OK`
  - Body:
    ```json
    {
      "status": "success",
      "data": {
        "appointmentId": "<uuid>",
        "patientId": "patient-uuid-123",
        "doctorId": "doctor-uuid-456",
        "hospitalId": "hospital-uuid-789",
        "date": "2025-07-04T12:00:00Z",
        "status": "scheduled",
        "createdAt": "<timestamp>",
        "updatedAt": "<new-timestamp>",
        "deleted": false
      }
    }
    ```

### Cancel Appointment

- **Method**: DELETE
- **URL**: `/api/appointments/:id`
- **Headers**:
  - `Authorization: Bearer <SERVICE_KEY_JWT>`
- **Response**:
  - `200 OK`
  - Body:
    ```json
    {
      "status": "success",
      "message": "Appointment cancelled"
    }
    ```
- **Notes**: Implements soft delete (sets `deleted: true`, `status: cancelled`). Triggers cancellation notification.

## Testing

1. Run unit tests (once implemented):
   ```bash
   npm test
   ```

   - Uses Jest with MongoMemoryServer for in-memory MongoDB (to be added).

2. Run integration tests:
   ```bash
   node test-integration.js
   ```

   - Requires Hospital, Notification, and User Services running.

3. Manual testing with Postman:
   - Generate JWT: `node utils/generate-jwt.js`
   - Test endpoints with `Authorization: Bearer <JWT>`.
   - Example POST request:
     ```json
     {
       "patientId": "patient-uuid-123",
       "doctorId": "doctor-uuid-456",
       "hospitalId": "hospital-uuid-789",
       "date": "2025-07-04T10:00:00Z"
     }
     ```
   - Verify logs in `logs/combined.log` and email delivery via Notification Service.

## Docker Support

1. Build and run with Docker Compose:
   ```bash
   docker-compose up -d
   ```

2. Verify the service:
   ```bash
   curl http://localhost:8083/health
   ```

3. Check logs:
   ```bash
   docker-compose logs
   ```

## Compliance

- **NDHM**: 
  - Audit logs via Winston for traceability (`logs/combined.log`).
  - `patientId` supports future ABHA integration.
- **DPDP Act**: 
  - Soft deletion of appointment records (`deleted: true`).
  - Secure JWT authentication and encrypted inter-service communication.
  - Minimal data retention (only necessary fields stored).
- **Telemedicine Guidelines**: 
  - Validates doctor KYC status via User Service.
  - Ensures secure appointment workflows.

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature-name`.
3. Commit changes: `git commit -m "Add feature-name"`.
4. Push to the branch: `git push origin feature-name`.
5. Open a Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.