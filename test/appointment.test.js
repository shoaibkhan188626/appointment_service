// In test/appointment.test.js, update mockJwt and tests
const mockJwt = jwt.sign(
  { sub: 'patient-uuid-123', role: 'patient', key: process.env.SERVICE_KEY },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

// Add RBAC test for POST /api/v1/appointments
it('should deny POST for doctor role', async () => {
  const doctorJwt = jwt.sign(
    { sub: 'doctor-uuid-456', role: 'doctor', key: process.env.SERVICE_KEY },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const response = await request
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${doctorJwt}`)
    .send(validPayload)
    .expect(403);
  expect(response.body.message).toBe(
    'Access denied: doctor role not authorized'
  );
});

// Add SMS test
it('should send SMS notification if phoneNumber exists', async () => {
  validateUser.mockImplementation(async (id, role) => {
    if (id === 'patient-uuid-123' && role === 'patient')
      return { ...mockPatient, phoneNumber: '+1234567890' };
    if (id === 'doctor-uuid-456' && role === 'doctor') return mockDoctor;
    throw new Error('User not found');
  });
  const response = await request
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${mockJwt}`)
    .send(validPayload)
    .expect(201);
  expect(createNotification).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'sms', phoneNumber: '+1234567890' })
  );
});
