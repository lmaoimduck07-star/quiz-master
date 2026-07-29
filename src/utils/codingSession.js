// src/utils/codingSession.js
// Quản lý session thi lập trình - Mỗi user chỉ có 1 session tại một thời điểm

const SESSION_KEY = 'qm_coding_session';

/**
 * Các stage trong session thi:
 * - 'workspace': Đang làm bài code
 * - 'viva': Đang thi vấn đáp
 * - 'review': Đang xem kết quả
 */

function getDefaultTemplate(lang) {
  if (lang === 'python') return '# Viết code Python ở đây\n\n';
  if (lang === 'java') return 'public class Solution {\n    public static void main(String[] args) {\n        // Viết code Java ở đây\n    }\n}\n';
  if (lang === 'cpp') return '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Viết code C++ ở đây\n    return 0;\n}\n';
  if (lang === 'c') return '#include <stdio.h>\n\nint main() {\n    // Viết code C ở đây\n    return 0;\n}\n';
  return '';
}

// Lấy session hiện tại của user
export const getSession = (userId) => {
  try {
    if (userId) {
      const raw = localStorage.getItem(`${SESSION_KEY}_${userId}`);
      if (raw) return JSON.parse(raw);
    }
    // Fallback: Tìm session thi lập trình mới nhất trong localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SESSION_KEY)) {
        const item = localStorage.getItem(key);
        if (item) return JSON.parse(item);
      }
    }
    return null;
  } catch {
    return null;
  }
};

// Tạo session mới (khi bắt đầu làm bài)
export const createSession = (userId, { problem, selectedLang, subjectId }) => {
  const defaultCode = getDefaultTemplate(selectedLang);
  const initCode = (problem && problem.templates?.[selectedLang]) ? problem.templates[selectedLang] : defaultCode;
  const mainFileName = selectedLang === 'java' ? 'Solution.java' : selectedLang === 'cpp' ? 'Solution.cpp' : selectedLang === 'c' ? 'solution.c' : 'solution.py';
  const session = {
    userId: userId || 'guest',
    problemId: problem?.id || 'prob_1',
    problem: problem || {},
    selectedLang: selectedLang || 'python',
    subjectId: subjectId || null,
    code: initCode,
    files: { [mainFileName]: initCode },
    lastOutput: '',       // Output terminal khi nộp bài (AI dùng để hỏi vấn đáp)
    stage: 'workspace',   // workspace → viva → review
    chatHistory: [],
    vivaQuestionIndex: 1,
    vivaScore: null,
    aiCodeScore: null,    // Điểm code do AI chấm (0-10)
    feedback: null,
    summary: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const keyUserId = userId || 'guest';
  localStorage.setItem(`${SESSION_KEY}_${keyUserId}`, JSON.stringify(session));
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
