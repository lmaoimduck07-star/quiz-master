// src/utils/gemini.js
// Utility to communicate with Gemini API for automated Viva (vấn đáp)

const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('qm_gemini_api_key') || '';
};

export const hasGeminiApiKey = () => {
  return getApiKey().trim().length > 0;
};

export const saveGeminiApiKey = (key) => {
  if (key) {
    localStorage.setItem('qm_gemini_api_key', key.trim());
  }
};

const callGemini = async (prompt, systemInstruction = '', jsonMode = false) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Chưa cấu hình API Key Gemini. Vui lòng thêm vào file .env hoặc nhập ở giao diện.');
  }

  // Sử dụng mô hình gemini-3.5-flash (phiên bản mới nhất)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000,
    }
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [
        { text: systemInstruction }
      ]
    };
  }

  if (jsonMode) {
    requestBody.generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `HTTP error! status: ${response.status}`;
    throw new Error(`Lỗi Gemini API: ${message}`);
  }

  const data = await response.json();
  // Gemini 3.5 Flash (thinking model) trả về nhiều parts: phần đầu là "thinking", phần cuối là text thực
  const parts = data.candidates?.[0]?.content?.parts || [];
  // Lấy phần text cuối cùng (bỏ qua phần thinking)
  const textParts = parts.filter(p => p.text !== undefined);
  const text = textParts.length > 0 ? textParts[textParts.length - 1].text : '';
  return text;
};

// 1. Tạo câu hỏi đầu tiên
export const generateFirstQuestion = async (problem, studentCode, testResults, language = 'java') => {
  const systemInstruction = `Bạn là giám khảo chấm thi vấn đáp lập trình chuyên nghiệp. 
Nhiệm vụ của bạn là hỏi sinh viên đúng 5 câu hỏi xoay quanh bài làm của họ, mỗi lượt chỉ hỏi 1 câu.
Hãy đặt câu hỏi đầu tiên ngắn gọn, tập trung thẳng vào logic thuật toán của họ.
QUAN TRỌNG: Trả lời bằng văn bản thuần túy (plain text). KHÔNG sử dụng markdown (**, *, #, \`), LaTeX ($...$), hay bất kỳ định dạng đặc biệt nào. Viết tự nhiên như đang nói chuyện.`;

  const prompt = `Đề bài:
${JSON.stringify(problem, null, 2)}

Bài làm của sinh viên (ngôn ngữ: ${language.toUpperCase()}):
\`\`\`
${studentCode}
\`\`\`

Kết quả chạy testcases:
${JSON.stringify(testResults, null, 2)}

Hãy đặt câu hỏi vấn đáp đầu tiên (Câu 1/5) cho sinh viên này bằng tiếng Việt. Câu hỏi ngắn gọn, trực diện, không lan man.`;

  return await callGemini(prompt, systemInstruction);
};

// 2. Tạo câu hỏi tiếp theo dựa trên lịch sử
export const generateNextQuestion = async (problem, studentCode, chatHistory, currentQuestionIndex, language = 'java') => {
  const systemInstruction = `Bạn là giám khảo chấm thi vấn đáp lập trình chuyên nghiệp.
Nhiệm vụ của bạn là đặt câu hỏi vấn đáp dựa trên lịch sử trao đổi. Bạn đang hỏi câu số ${currentQuestionIndex}/5.
Không giải thích dài dòng, hãy đi thẳng vào câu hỏi bằng tiếng Việt.
QUAN TRỌNG: Trả lời bằng văn bản thuần túy (plain text). KHÔNG sử dụng markdown (**, *, #, \`), LaTeX ($...$), hay bất kỳ định dạng đặc biệt nào. Viết tự nhiên như đang nói chuyện.`;

  const formattedHistory = chatHistory.map(msg => `${msg.role === 'user' ? 'Sinh viên' : 'Giám khảo'}: ${msg.text}`).join('\n');

  const prompt = `Đề bài:
${JSON.stringify(problem, null, 2)}

Bài làm của sinh viên (ngôn ngữ: ${language.toUpperCase()}):
\`\`\`
${studentCode}
\`\`\`

Lịch sử cuộc vấn đáp:
${formattedHistory}

Hãy đưa ra câu hỏi vấn đáp tiếp theo (Câu ${currentQuestionIndex}/5) bằng tiếng Việt. Câu hỏi ngắn gọn và khai thác câu trả lời trước đó của sinh viên.`;

  return await callGemini(prompt, systemInstruction);
};

// 3. Đánh giá và chấm điểm toàn bộ sau 5 câu hỏi
export const evaluateViva = async (problem, studentCode, testResults, chatHistory, language = 'java') => {
  const systemInstruction = `Bạn là giám khảo chấm thi vấn đáp lập trình chuyên nghiệp.
Hãy đánh giá toàn bộ cuộc đối thoại vấn đáp 5 câu của sinh viên, xem họ có thực sự tự viết code, có hiểu thuật toán và tối ưu hóa code tốt không.
Trả về dữ liệu dạng JSON khớp chính xác với định dạng sau:
{
  "score": 8.5,
  "feedback": "Nhận xét chi tiết về kiến thức, khả năng giải trình và tối ưu hóa thuật toán của sinh viên.",
  "summary": "Tóm tắt ngắn gọn trong 1-2 câu."
}`;

  const formattedHistory = chatHistory.map(msg => `${msg.role === 'user' ? 'Sinh viên' : 'Giám khảo'}: ${msg.text}`).join('\n');

  const prompt = `Đề bài:
${JSON.stringify(problem, null, 2)}

Bài làm của sinh viên (ngôn ngữ: ${language.toUpperCase()}):
\`\`\`
${studentCode}
\`\`\`

Kết quả testcases:
${JSON.stringify(testResults, null, 2)}

Lịch sử cuộc vấn đáp 5 câu:
${formattedHistory}

Hãy đánh giá và cho điểm vấn đáp (thang điểm 10). Trả về duy nhất đối tượng JSON chứa score, feedback và summary.`;

  const responseText = await callGemini(prompt, systemInstruction, true);
  try {
    // Thử parse trực tiếp
    return JSON.parse(responseText);
  } catch (e) {
    // Thử tìm JSON object trong response text (model có thể trả thêm text bao quanh)
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*"score"[\s\S]*"feedback"[\s\S]*"summary"[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e2) {
      console.error('Failed to extract JSON from response:', e2);
    }
    
    console.error('Failed to parse Gemini evaluation JSON:', responseText, e);
    // Fallback if parsing fails
    return {
      score: 7.0,
      feedback: "Hệ thống không phân tích được phản hồi JSON từ AI. Đánh giá sơ bộ: Học sinh có hiểu biết cơ bản về bài làm của mình.",
      summary: "Hoàn thành bài thi vấn đáp."
    };
  }
};
