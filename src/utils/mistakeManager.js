/**
 * mistakeManager.js
 * Quản lý "Sổ tay câu sai" — lưu và đọc các câu hỏi học sinh làm sai,
 * phân loại độc lập theo từng môn học (subjectId) và từng bài thi (examId).
 *
 * Cấu trúc localStorage:
 *   qm_mistakes_<userId> = {
 *     "<subjectId>": [
 *       { id, examId, type, text, options, correctAnswer, ... },
 *       ...
 *     ]
 *   }
 */

const STORAGE_PREFIX = 'qm_mistakes_';

/**
 * Đọc toàn bộ sổ tay câu sai của user.
 */
function _loadAll(userId) {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Ghi toàn bộ sổ tay câu sai của user.
 */
function _saveAll(userId, data) {
  if (!userId) return;
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(data));
  } catch (e) {
    console.error('[mistakeManager] Failed to save:', e);
  }
}

/**
 * Tạo key định danh duy nhất cho từng câu hỏi theo bài thi để tránh trùng ID (ví dụ q_1, q_2 giữa các bài)
 */
function _makeQuestionKey(examId, qId) {
  return `${examId || 'common'}_${qId}`;
}

/**
 * Lưu danh sách câu làm sai vào sổ tay theo môn và bài thi.
 * Định danh câu sai theo (examId + questionId) để các bài thi có cùng số thứ tự câu (1, 2, 3...)
 * không bao giờ ghi đè hoặc làm mất câu của nhau.
 *
 * @param {string} userId
 * @param {string} subjectId  — ID của môn học
 * @param {Array}  questions  — Danh sách câu hỏi (những câu isCorrect === false)
 * @param {string} [examId]   — ID của bài thi (tùy chọn)
 */
export function saveMistakes(userId, subjectId, questions, examId = null) {
  if (!userId || !subjectId || !questions?.length) return;

  const all = _loadAll(userId);
  const existing = all[subjectId] || [];

  // Dùng composite key (examId + q.id) để quản lý độc lập từng bài thi
  const existingMap = new Map(existing.map(q => [_makeQuestionKey(q.examId, q.id), q]));

  for (const q of questions) {
    if (!q.id && q.id !== 0) continue;
    const targetExamId = q.examId || examId || null;
    const key = _makeQuestionKey(targetExamId, q.id);

    existingMap.set(key, {
      id: q.id,
      examId: targetExamId,
      type: q.type,
      text: q.text || q.content || q.question,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      pairs: q.pairs,
      groups: q.groups,
      answers: q.answers,
      items: q.items,
      statements: q.statements,
    });
  }

  all[subjectId] = Array.from(existingMap.values());
  _saveAll(userId, all);
}

/**
 * Lấy toàn bộ danh sách câu sai của một môn cụ thể.
 *
 * @param {string} userId
 * @param {string} subjectId
 * @returns {Array}
 */
export function getMistakesBySubject(userId, subjectId) {
  if (!userId || !subjectId) return [];
  const all = _loadAll(userId);
  return all[subjectId] || [];
}

/**
 * Lấy danh sách câu sai của riêng một bài thi cụ thể (examId).
 *
 * @param {string} userId
 * @param {string} subjectId
 * @param {string} examId
 * @returns {Array}
 */
export function getMistakesByExam(userId, subjectId, examId) {
  if (!userId || !subjectId || !examId) return [];
  const list = getMistakesBySubject(userId, subjectId);
  return list.filter(q => q.examId === examId);
}

/**
 * Lấy số lượng câu sai của riêng một bài thi cụ thể (dùng để hiển thị badge).
 *
 * @param {string} userId
 * @param {string} subjectId
 * @param {string} examId
 * @returns {number}
 */
export function getMistakeCountByExam(userId, subjectId, examId) {
  return getMistakesByExam(userId, subjectId, examId).length;
}

/**
 * Lấy tổng số lượng câu sai của một môn học.
 *
 * @param {string} userId
 * @param {string} subjectId
 * @returns {number}
 */
export function getMistakeCountBySubject(userId, subjectId) {
  return getMistakesBySubject(userId, subjectId).length;
}

/**
 * Xóa danh sách các câu đã làm đúng khỏi môn học (hỗ trợ theo examId nếu có).
 *
 * @param {string} userId
 * @param {string} subjectId
 * @param {Array<string|number>} correctQuestionIds
 * @param {string} [examId]
 */
export function removeMistakesByIds(userId, subjectId, correctQuestionIds, examId = null) {
  if (!userId || !subjectId || !correctQuestionIds?.length) return;
  const all = _loadAll(userId);
  const existing = all[subjectId] || [];
  const idSet = new Set(correctQuestionIds);

  all[subjectId] = existing.filter(q => {
    if (examId && q.examId && q.examId !== examId) {
      return true; // Giữ lại câu của bài khác dù có trùng ID
    }
    return !idSet.has(q.id);
  });
  _saveAll(userId, all);
}

/**
 * Xóa toàn bộ câu sai của riêng một bài thi cụ thể.
 *
 * @param {string} userId
 * @param {string} subjectId
 * @param {string} examId
 */
export function clearExamMistakes(userId, subjectId, examId) {
  if (!userId || !subjectId || !examId) return;
  const all = _loadAll(userId);
  const existing = all[subjectId] || [];
  all[subjectId] = existing.filter(q => q.examId !== examId);
  _saveAll(userId, all);
}

/**
 * Xóa toàn bộ câu sai của một môn học cụ thể.
 *
 * @param {string} userId
 * @param {string} subjectId
 */
export function clearSubjectMistakes(userId, subjectId) {
  if (!userId || !subjectId) return;
  const all = _loadAll(userId);
  delete all[subjectId];
  _saveAll(userId, all);
}
