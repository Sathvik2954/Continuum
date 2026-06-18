import { assertPatientAccess } from '../middleware/patientAccess';
import PatientDoctorLink from '../models/PatientDoctorLink';

// Mock PatientDoctorLink.findOne
jest.mock('../models/PatientDoctorLink', () => ({
  findOne: jest.fn(),
}));

describe('Patient Access Validation Tests (Relationship Safeguard)', () => {
  const patientId = 'patient_user_id_123';
  const doctorId = 'doctor_user_id_456';
  const strangerDoctorId = 'doctor_stranger_789';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Patient should always be allowed access to their own clinical timeline', async () => {
    const isAuthorized = await assertPatientAccess(patientId, patientId, 'PATIENT');
    expect(isAuthorized).toBe(true);
  });

  test('Patient should be blocked from accessing another patient\'s records', async () => {
    const isAuthorized = await assertPatientAccess(patientId, 'another_patient_id', 'PATIENT');
    expect(isAuthorized).toBe(false);
  });

  test('Doctor should be allowed access if an ACTIVE relationship link exists', async () => {
    // Mock active link found
    (PatientDoctorLink.findOne as jest.Mock).mockResolvedValueOnce({
      patientId,
      doctorId,
      status: 'ACTIVE',
    });

    const isAuthorized = await assertPatientAccess(doctorId, patientId, 'DOCTOR');
    expect(isAuthorized).toBe(true);
    expect(PatientDoctorLink.findOne).toHaveBeenCalledWith({
      patientId,
      doctorId,
      status: 'ACTIVE',
    });
  });

  test('Doctor should be denied access if relationship is PENDING, REVOKED, or absent', async () => {
    // Mock no active link found (e.g. status is PENDING or revoked)
    (PatientDoctorLink.findOne as jest.Mock).mockResolvedValueOnce(null);

    const isAuthorized = await assertPatientAccess(strangerDoctorId, patientId, 'DOCTOR');
    expect(isAuthorized).toBe(false);
  });

  test('Admin accounts should be denied direct access to patient clinical timeline files', async () => {
    const isAuthorized = await assertPatientAccess('admin_user_id_999', patientId, 'ADMIN');
    expect(isAuthorized).toBe(false);
  });
});
