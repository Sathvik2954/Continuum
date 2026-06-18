import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User';
import DoctorProfile from '../models/DoctorProfile';
import PatientProfile from '../models/PatientProfile';
import PatientDoctorLink from '../models/PatientDoctorLink';
import Consultation from '../models/Consultation';
import Vital from '../models/Vital';
import FollowUp from '../models/FollowUp';

// Load environment configuration
dotenv.config();

const seed = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI is not set in backend environment config.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB database cluster...');
  await mongoose.connect(mongoUri);
  console.log('Database connection successful.');

  console.log('Wiping existing database collections for a fresh state...');
  await User.deleteMany({});
  await DoctorProfile.deleteMany({});
  await PatientProfile.deleteMany({});
  await PatientDoctorLink.deleteMany({});
  await Consultation.deleteMany({});
  await Vital.deleteMany({});
  await FollowUp.deleteMany({});
  console.log('Wipe complete.');

  const passwordHash = await bcrypt.hash('Password123', 12);

  console.log('Seeding Platform Admin...');
  const admin = new User({
    email: 'admin@continuum.com',
    passwordHash,
    role: 'ADMIN',
    name: 'Continuum Administrator',
    phone: '+15550000000',
  });
  await admin.save();

  console.log('Seeding Patient...');
  const patient = new User({
    email: 'patient@continuum.com',
    passwordHash,
    role: 'PATIENT',
    name: 'John Doe',
    phone: '+15551111111',
  });
  await patient.save();

  const patientProfile = new PatientProfile({
    userId: patient._id,
    dateOfBirth: new Date('1990-06-15'),
    gender: 'MALE',
    bloodGroup: 'O+',
    knownAllergies: 'Peanuts, Penicillin antibiotics',
    emergencyContactName: 'Jane Doe',
    emergencyContactPhone: '+15559999999',
  });
  await patientProfile.save();

  console.log('Seeding Verified Physician...');
  const verifiedDoctor = new User({
    email: 'doctor.verified@continuum.com',
    passwordHash,
    role: 'DOCTOR',
    name: 'Dr. Sarah Carter',
    phone: '+15552222222',
  });
  await verifiedDoctor.save();

  const verifiedProfile = new DoctorProfile({
    userId: verifiedDoctor._id,
    specialization: 'Cardiology',
    clinicName: 'Metro Heart Institute',
    city: 'New York',
    registrationNumber: 'MED-12345',
    verified: true,
  });
  await verifiedProfile.save();

  console.log('Seeding Pending Approval Physician...');
  const pendingDoctor = new User({
    email: 'doctor.pending@continuum.com',
    passwordHash,
    role: 'DOCTOR',
    name: 'Dr. Alex Mercer',
    phone: '+15553333333',
  });
  await pendingDoctor.save();

  const pendingProfile = new DoctorProfile({
    userId: pendingDoctor._id,
    specialization: 'Pediatrics',
    clinicName: 'Downtown Pediatrics Group',
    city: 'Chicago',
    registrationNumber: 'MED-98765',
    verified: false,
  });
  await pendingProfile.save();

  console.log('Creating ACTIVE link linkage between Patient and Dr. Sarah Carter...');
  const link = new PatientDoctorLink({
    patientId: patient._id,
    doctorId: verifiedDoctor._id,
    status: 'ACTIVE',
    requestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    respondedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
  });
  await link.save();

  console.log('Seeding Consultation records...');
  const consult1 = new Consultation({
    patientId: patient._id,
    doctorId: verifiedDoctor._id,
    type: 'ASYNC',
    initiatedBy: 'PATIENT',
    priority: 'URGENT',
    status: 'DOCTOR_RESPONDED',
    symptomsChecklist: {
      fever: false,
      cough: false,
      breathlessness: true,
      chestPain: true,
      headache: true,
      fatigue: true,
      nausea: false,
      dizziness: true,
      swelling: false,
      other: 'Palpitations',
    },
    patientNotes: 'Experiencing heart palpitations and mild chest tightness since this morning.',
    doctorNotes: 'Prescribed a low-dose beta blocker (Metoprolol 25mg daily). Please log your blood pressure and heart rate daily.',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  });
  await consult1.save();

  console.log('Seeding patient timeline vitals log...');
  const vital1 = new Vital({
    patientId: patient._id,
    recordedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    bpSystolic: 138,
    bpDiastolic: 89,
    bloodGlucoseFasting: 96,
    weightKg: 78.5,
    heartRate: 88,
    notes: 'Logged during palpitations episode.',
  });
  await vital1.save();

  const vital2 = new Vital({
    patientId: patient._id,
    recordedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    bpSystolic: 121,
    bpDiastolic: 78,
    bloodGlucoseFasting: 94,
    weightKg: 78.4,
    heartRate: 70,
    notes: 'Resting vitals post-medication.',
  });
  await vital2.save();

  console.log('Seeding care follow-ups...');
  const followUp1 = new FollowUp({
    consultationId: consult1._id,
    patientId: patient._id,
    doctorId: verifiedDoctor._id,
    scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    type: 'VITALS_CHECK',
    notes: 'Please record blood pressure and heart rate post-medication.',
    completed: false,
  });
  await followUp1.save();

  const followUp2 = new FollowUp({
    consultationId: consult1._id,
    patientId: patient._id,
    doctorId: verifiedDoctor._id,
    scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    type: 'LIVE_CALL',
    notes: 'Live audio call check-in to discuss dose efficacy.',
    completed: false,
  });
  await followUp2.save();

  console.log('Database seeding successfully completed.');
  console.log('\n=================================================');
  console.log('  Continuum V3 Seed Accounts (Password: Password123)');
  console.log('=================================================');
  console.log('  Admin User      : admin@continuum.com');
  console.log('  Verified Doctor : doctor.verified@continuum.com');
  console.log('  Pending Doctor  : doctor.pending@continuum.com');
  console.log('  Patient User    : patient@continuum.com');
  console.log('=================================================\n');

  await mongoose.connection.close();
};

seed().catch((err) => {
  console.error('Database seeding failed with error:', err);
  mongoose.connection.close();
});
