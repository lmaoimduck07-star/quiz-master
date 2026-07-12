// src/utils/codingSession.js
// Quản lý session thi lập trình - Mỗi user chỉ có 1 session tại một thời điểm

const SESSION_KEY = 'qm_coding_session';

/**
 * Các stage trong session thi:
 * - 'workspace': Đang làm bài code
 * - 'viva': Đang thi vấn đáp
 * - 'review': Đang xem kết quả
 */

// Lấy session hiện tại của user
export const getSession = (userId) => {
  try {
    const raw = localStorage.getItem(`${SESSION_KEY}_${userId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// Tạo session mới (khi bắt đầu làm bài)
export const createSession = (userId, { problem, selectedLang }) => {
  const session = {
    userId,
    problemId: problem.id,
    problem,
    selectedLang,
    code: problem.templates?.[selectedLang] || '',
    testResults: null,
    stage: 'workspace', // workspace → viva → review
    chatHistory: [],
    vivaQuestionIndex: 1,
    vivaScore: null,
    feedback: null,
    summary: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  localStorage.setItem(`${SESSION_KEY}_${userId}`, JSON.stringify(session));
  return session;
};

// Cập nhật session
export const updateSession = (userId, updates) => {
  const session = getSession(userId);
  if (!session) return null;
  
  const updated = {
    ...session,
    ...updates,
    updatedAt: Date.now()
  };
  localStorage.setItem(`${SESSION_KEY}_${userId}`, JSON.stringify(updated));
  return updated;
};

// Xóa session (khi hoàn tất thi hoặc hủy bài)
export const clearSession = (userId) => {
  localStorage.removeItem(`${SESSION_KEY}_${userId}`);
};

// Kiểm tra user có session đang hoạt động không
export const hasActiveSession = (userId) => {
  const session = getSession(userId);
  return session !== null;
};

// Lấy stage hiện tại
export const getSessionStage = (userId) => {
  const session = getSession(userId);
  return session?.stage || null;
};

// Lấy URL redirect dựa trên stage
export const getSessionRedirectPath = (userId) => {
  const stage = getSessionStage(userId);
  switch (stage) {
    case 'workspace': return '/coding/workspace';
    case 'viva': return '/coding/viva';
    case 'review': return '/coding/review';
    default: return null;
  }
};
