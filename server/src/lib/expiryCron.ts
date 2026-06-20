import { PatientDoctorLink } from '../models/PatientDoctorLink';

/**
 * Expires all PENDING connection requests older than 7 days.
 * Called on server start and then every 24 hours.
 * Does NOT require node-cron — uses setInterval for zero extra dependencies.
 */
export const startExpiryCron = (): void => {
  const run = async () => {
    try {
      const result = await PatientDoctorLink.updateMany(
        {
          status: 'PENDING',
          expiresAt: { $lt: new Date() },
        },
        { $set: { status: 'EXPIRED' } }
      );
      if (result.modifiedCount > 0) {
        console.log(`🕐 Expired ${result.modifiedCount} stale connection request(s)`);
      }
    } catch (err) {
      console.error('Expiry cron error:', err);
    }
  };

  // Run once on startup
  run();

  // Then every 24 hours
  setInterval(run, 24 * 60 * 60 * 1000);
};
