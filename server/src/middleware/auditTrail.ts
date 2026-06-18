import PatientChange from '../models/PatientChange';

/**
 * Audit log helper that compares old and new state, logging differences.
 * Runs inside Express routes before a write operation is finalized.
 */
export async function logPatientChange(
  patientId: string,
  entityType: 'PROFILE' | 'CONDITION' | 'CONSULTATION' | 'MEDICATION',
  entityId: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  changedById: string,
  changedByRole: 'PATIENT' | 'DOCTOR' | 'ADMIN'
): Promise<void> {
  const changes = [];

  // Iterate over keys of the new data payload
  for (const key of Object.keys(newData)) {
    // Ignore metadata fields
    if (['_id', 'id', 'createdAt', 'updatedAt', '__v', 'isDeleted', 'deletedAt'].includes(key)) {
      continue;
    }

    const oldVal = oldData[key];
    const newVal = newData[key];

    // Convert values to comparable formats
    const oldStr = oldVal instanceof Date 
      ? oldVal.toISOString() 
      : typeof oldVal === 'object' && oldVal !== null 
        ? JSON.stringify(oldVal) 
        : oldVal !== undefined && oldVal !== null ? String(oldVal) : '';

    const newStr = newVal instanceof Date 
      ? newVal.toISOString() 
      : typeof newVal === 'object' && newVal !== null 
        ? JSON.stringify(newVal) 
        : newVal !== undefined && newVal !== null ? String(newVal) : '';

    // If a field is modified, record the transaction in the audit trail
    if (oldStr !== newStr) {
      changes.push({
        patientId,
        entityType,
        entityId,
        fieldChanged: key,
        oldValue: oldStr,
        newValue: newStr,
        changedBy: changedById,
        changedByRole,
      });
    }
  }

  if (changes.length > 0) {
    // Immutable write to PatientChange
    await PatientChange.insertMany(changes);
  }
}
export default logPatientChange;
