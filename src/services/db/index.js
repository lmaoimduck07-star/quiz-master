/**
 * index.js — Export facade tổng hợp cho toàn bộ DB Service Layer
 * Import từ đây thay vì import trực tiếp từng file service.
 */

// Base utilities
export * from './baseService';

// User operations (Atomic CRUD)
export {
  getUser,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  setUserStatus,
  updateUserPermissions,
  subscribeUsers,
} from './userService';

// Exam / Subject / Questions
export {
  generateSubjectCode,
  generateExamId,
  loadSubjects,
  saveSubject,
  deleteSubject,
  subscribeSubjects,
  loadExams,
  saveExam,
  deleteExam,
  getExam,
  updateExamField,
  subscribeExams,
  loadQuestions,
  saveBulkQuestions,
  normalizeAllExamIds,
} from './examService';

// Audit Logs
export {
  addAuditLog,
  subscribeAuditLogs,
  loadAuditLogsPaginated,
  cleanOldAuditLogs,
} from './auditService';

// Database Cleanup Tool
export { runDatabaseCleanup } from './cleanupService';
