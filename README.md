Appointment Service
The Appointment Service is a microservice for managing healthcare appointments, supporting recurring appointments, RBAC, rate limiting, and monitoring. It integrates with the Hospital Service (https://github.com/shoaibkhan188626/hospital-service.git), Notification Service (https://github.com/shoaibkhan188626/notification-service.git), and User Service. Compliant with NDHM (audit logs, ABHA-ready), DPDP Act (soft deletes, consent), and Telemedicine Guidelines (KYC, secure workflows).

Repository: https://github.com/shoaibkhan188626/appointment-service.git
Default Port: 8083
Base URL: http://localhost:8083 (development)
License: MIT

Table of Contents

Features
Prerequisites
Installation
Configuration
Running the Service
API Endpoints
Swagger Documentation
Monitoring
Testing
Docker Support
Compliance
Contributing
License

Features

CRUD Operations: Create, read, update, and cancel (soft delete) appointments.
Recurring Appointments: Schedule daily, weekly, or monthly appointments with recurrence field (type, interval, endDate).
RBAC: Role-based access for patients, doctors, and admins.
Rate Limiting: 50 POSTs (25 for recurring), 200 GETs, 50 PUT/DELETEs, 1000 health checks per 15min.
Swagger UI: API documentation at http://localhost:8083/api-docs.
Monitoring: Prometheus metrics (http://localhost:8083/metrics) and Grafana visualization.
Integrations:
User Service for patient/doctor validation and KYC (Telemedicine Guidelines).
Hospital Service for hospital validation.
Notification Service for email/SMS notifications.


Security: JWT authentication, helmet headers, soft deletes, and consent management.
Logging: Audit trails via Winston for NDHM compliance.

Prerequisites

Node.js: v18.x or later
npm: v10.x or later
MongoDB: Local (Dockerized) or MongoDB Atlas
Docker: For containerized setup
Git: For cloning the repository
Prometheus: For metrics collection
Grafana: For metrics visualization
Dependent Services:
Hospital Service: http://hospital-service:8082
User Service: http://user-service:5000
Notification Service: http://notification-service:8081



Installation

Clone the repository:
git clone https://github.com/shoaibkhan188626/appointment-service.git
cd appointment-service


Install dependencies:
npm install



Configuration
Create a .env file in the root directory by copying .env.example:
cp .env.example .env

Update .env with:
NODE_ENV=development
PORT=8083
MONGO_URI_LOCAL=mongodb://mongo:27017/appointment-service
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/appointment-service?retryWrites=true&w=majority
JWT_SECRET=Xy9vA$23k!ZbLp@76JrQmEwTn$HsDfGuIoPaLzXcVbNmQwErTyUiOp1234567890
SERVICE_KEY=a7b9c2d8e4f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4
HOSPITAL_SERVICE_URL=http://hospital-service:8082
USER_SERVICE_URL=http://user-service:5000
NOTIFICATION_SERVICE_URL=http://notification-service:8081
LOG_LEVEL=info
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000


Replace <user>:<pass> with MongoDB Atlas credentials.
Ensure JWT_SECRET and SERVICE_KEY match other services for authentication.
Use localhost instead of Docker service names if not using Docker.

Running the Service
Local Development

Start MongoDB and dependent services (Hospital, Notification, User).
Run the service:npm run dev


Uses nodemon for auto-reload.
Logs to logs/combined.log and logs/error.log.



Production

Build the application:
npm run build


Start the service:
npm start



API Endpoints
All endpoints (except /health, /metrics, /readiness, /liveness) require Authorization: Bearer <JWT>. Generate JWT with:
node utils/generate-jwt.js generate

Health Check

Method: GET
URL: /health
Response: 200 OK{"status": "OK", "timestamp": "2025-07-07T01:00:00Z"}



Readiness Check (Optional)

Method: GET
URL: /readiness
Response: 200 OK (if MongoDB connected) or 503 Service Unavailable{"status": "ready", "timestamp": "2025-07-07T01:00:00Z"}



Liveness Check (Optional)

Method: GET
URL: /liveness
Response: 200 OK{"status": "alive", "timestamp": "2025-07-07T01:00:00Z"}



Metrics

Method: GET
URL: /metrics
Response: 200 OK (Prometheus format)http_requests_total{method="POST",route="/api/v1/appointments",status="201"} 5
recurring_appointments_created_total{type="weekly"} 5



Create Appointment

Method: POST
URL: /api/v1/appointments
Headers: Authorization: Bearer <JWT>, Content-Type: application/json
Body:{
  "patientId": "patient-uuid-123",
  "doctorId": "doctor-uuid-456",
  "hospitalId": "hospital-uuid-789",
  "date": "2025-07-07T10:00:00Z",
  "duration": 30,
  "type": "telemedicine",
  "notes": "Weekly checkup",
  "consent": { "given": true, "purpose": "treatment", "grantedAt": "2025-07-07T10:00:00Z" },
  "recurrence": { "type": "weekly", "interval": 1, "endDate": "2025-08-04T10:00:00Z" }
}


Response: 201 Created
Headers: X-Recurring-Count: 5
Body:{
  "status": "success",
  "data": [
    {
      "appointmentId": "<uuid>",
      "patientId": "patient-uuid-123",
      "doctorId": "doctor-uuid-456",
      "hospitalId": "hospital-uuid-789",
      "date": "2025-07-07T10:00:00Z",
      "duration": 30,
      "type": "telemedicine",
      "notes": "Weekly checkup",
      "consent": { "given": true, "purpose": "treatment", "grantedAt": "2025-07-07T10:00:00Z" },
      "recurrence": { "type": "weekly", "interval": 1, "endDate": "2025-08-04T10:00:00Z" },
      "status": "scheduled",
      "createdAt": "<timestamp>",
      "updatedAt": "<timestamp>",
      "deleted": false
    }
  ]
}







Get Appointments

Method: GET
URL: /api/v1/appointments?patientId=<id>&doctorId=<id>&page=1&limit=10
Headers: Authorization: Bearer <JWT>
Response: 200 OK{
  "status": "success",
  "data": [{ /* appointment objects */ }],
  "meta": { "total": 5, "page": 1, "limit": 10, "pages": 1 }
}



Get Appointment by ID

Method: GET
URL: /api/v1/appointments/:id
Headers: Authorization: Bearer <JWT>
Response: 200 OK{
  "status": "success",
  "data": { /* appointment object */ }
}



Update Appointment

Method: PUT
URL: /api/v1/appointments/:id
Headers: Authorization: Bearer <JWT>, Content-Type: application/json
Body:{
  "date": "2025-07-07T12:00:00Z",
  "notes": "Updated checkup"
}


Response: 200 OK{
  "status": "success",
  "data": { /* updated appointment */ }
}



Cancel Appointment

Method: DELETE
URL: /api/v1/appointments/:id
Headers: Authorization: Bearer <JWT>
Response: 200 OK{
  "status": "success",
  "message": "Appointment cancelled"
}



Swagger Documentation

URL: http://localhost:8083/api-docs
Features:
Interactive API explorer with endpoint details, schemas, and request/response examples.
Supports JWT authorization (Bearer <JWT>).


Usage:
Open http://localhost:8083/api-docs.
Authorize with Bearer <JWT> (generate via node utils/generate-jwt.js generate).
Test endpoints (e.g., POST /api/v1/appointments with recurrence).



Monitoring

Metrics Endpoint: http://localhost:8083/metrics
Metrics:
http_requests_total: Request count by method, route, status.
http_request_duration_seconds: Request duration.
http_errors_total: Error count.
recurring_appointments_created_total: Recurring appointment count by type.




Prometheus:
URL: http://localhost:9090
Query metrics (e.g., recurring_appointments_created_total{type="weekly"}).


Grafana:
URL: http://localhost:3000 (login: admin/admin)
Configure Prometheus data source (http://prometheus:9090).
Create dashboards for metrics visualization.



Testing

Unit Tests:
npm test


Uses Jest with MongoMemoryServer (in test/appointment.test.js).
Covers CRUD, recurring appointments, rate limiting, and /favicon.ico.


Manual Testing:

Use Swagger UI (http://localhost:8083/api-docs).
Generate JWT: node utils/generate-jwt.js generate.
Test POST /api/v1/appointments with:{
  "patientId": "patient-uuid-123",
  "doctorId": "doctor-uuid-456",
  "hospitalId": "hospital-uuid-789",
  "date": "2025-07-07T10:00:00Z",
  "duration": 30,
  "type": "telemedicine",
  "notes": "Weekly checkup",
  "consent": { "given": true, "purpose": "treatment", "grantedAt": "2025-07-07T10:00:00Z" },
  "recurrence": { "type": "weekly", "interval": 1, "endDate": "2025-08-04T10:00:00Z" }
}


Verify in MongoDB:docker exec -it <mongodb-container> mongosh
use appointment-service
db.appointments.find({ patientId: "patient-uuid-123" }).pretty()




Integration Tests (TBD):

Requires Hospital, Notification, and User Services running.



Docker Support

Build and run:docker-compose up -d


Verify:curl http://localhost:8083/health
docker-compose logs


Prometheus/Grafana:
Prometheus: http://localhost:9090
Grafana: http://localhost:3000



Compliance

NDHM:
Audit logs in logs/combined.log, logs/error.log via Winston.
ABHA-ready with patientId and doctorId.


DPDP Act:
Soft deletes (deleted: true).
Consent management (consent object).
Rate limiting and helmet headers.


Telemedicine Guidelines:
KYC via User Service (validateUser).
Secure workflows with JWT and HTTPS.



Contributing

Fork the repository.
Create a feature branch: git checkout -b feature-name.
Commit changes: git commit -m "Add feature-name".
Push to the branch: git push origin feature-name.
Open a Pull Request.

License
This project is licensed under the MIT License. See the LICENSE file for details.