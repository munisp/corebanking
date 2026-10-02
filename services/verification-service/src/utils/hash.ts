import bcrypt from "bcryptjs";

// TS-70: async hashing — hashSync blocked the event loop (~80ms+ per call).
// No live callers existed at the time of the change; the export is now async.
export const hashString = async (str: string, rounds?: number): Promise<string> => {
  return bcrypt.hash(str, rounds || 10);
};
