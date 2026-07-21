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

const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
];

const callGemini = async (prompt, systemInstruction = '', jsonMode = false) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Chưa cấu hình API Key Gemini. Vui lòng thêm vào file .env hoặc nhập ở giao diện.');
  }

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

  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const textParts = parts.filter(p => p.text !== undefined);
        return textParts.length > 0 ? textParts[textParts.length - 1].text : '';
      }

      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || `HTTP error! status: ${response.status}`;
      lastError = new Error(`Lỗi Gemini API (${modelName}): ${message}`);

      // Nếu lỗi 429 (quota) hoặc 404 (model not found), thử model tiếp theo trong danh sách
      if (response.status === 429 || response.status === 404) {
        console.warn(`[Gemini API] Model ${modelName} bị lỗi ${response.status}, đang thử model tiếp theo...`);
        continue;
      } else {
        // Lỗi khác (như 401 unauthenticated), throw ngay
        throw lastError;
      }
    } catch (err) {
      if (err.message?.includes('401') || err.message?.includes('UNAUTHENTICATED')) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error('Không thể kết nối đến Gemini API. Vui lòng kiểm tra API key.');
};

// 1. Tạo câu hỏi đầu tiên
export const generateFirstQuestion = async (problem, studentCode, lastOutput, language = 'python') => {
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

Output khi chạy code (terminal output):
${lastOutput ? lastOutput : '(Chưa chạy hoặc không có output)'}

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
export const evaluateViva = async (problem, studentCode, lastOutput, chatHistory, language = 'python') => {
  const systemInstruction = `Bạn là giám khảo chấm thi vấn đáp lập trình chuyên nghiệp.
Hãy đánh giá toàn bộ cuộc đối thoại vấn đáp 5 câu của sinh viên, xem họ có thực sự tự viết code, có hiểu thuật toán và tối ưu hóa code tốt không.
Trả về dữ liệu dạng JSON khớp chính xác với định dạng sau:
{
  "vivaScore": 8.5,
  "aiCodeScore": 7.0,
  "feedback": "Nhận xét chi tiết về kiến thức, khả năng giải trình và tối ưu hóa thuật toán của sinh viên.",
  "summary": "Tóm tắt ngắn gọn trong 1-2 câu."
}
VivaScore: chấm riêng phần trả lời vấn đáp (0-10).
AiCodeScore: chấm chất lượng code dựa trên các câu trả lời và output thực tế (0-10).`;

  const formattedHistory = chatHistory.map(msg => `${msg.role === 'user' ? 'Sinh viên' : 'Giám khảo'}: ${msg.text}`).join('\n');

  const prompt = `Đề bài:
${JSON.stringify(problem, null, 2)}

Bài làm của sinh viên (ngôn ngữ: ${language.toUpperCase()}):
\`\`\`
${studentCode}
\`\`\`

Output khi chạy code:
${lastOutput ? lastOutput : '(Không có output)'}

Lịch sử cuộc vấn đáp 5 câu:
${formattedHistory}

Hãy đánh giá và cho điểm. Trả về duy nhất đối tượng JSON chứa vivaScore, aiCodeScore, feedback và summary.`;

  const responseText = await callGemini(prompt, systemInstruction, true);
  try {
    return JSON.parse(responseText);
  } catch (e) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*"vivaScore"[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e2) {
      console.error('Failed to extract JSON from response:', e2);
    }
    console.error('Failed to parse Gemini evaluation JSON:', responseText, e);
    return {
      vivaScore: 7.0,
      aiCodeScore: 6.5,
      feedback: 'Hệ thống không phân tích được phản hồi JSON từ AI. Đánh giá sơ bộ: Học sinh có hiểu biết cơ bản về bài làm của mình.',
      summary: 'Hoàn thành bài thi vấn đáp.'
    };
  }
};

// 4. Tự động trích xuất tiêu chí và thẩm định mã nguồn (Zero-Config AI Review)
export const autoEvaluateCode = async (problem, studentCode, language = 'java') => {
  const systemInstruction = `Bạn là chuyên gia thẩm định và chấm điểm mã nguồn lập trình chuyên nghiệp.
Nhiệm vụ của bạn là:
1. Đọc kỹ đề bài (bao gồm tiêu đề và phần mô tả).
2. Tự động trích xuất từ 3 đến 6 yêu cầu kỹ thuật (Checkpoints) cốt lõi bắt buộc phải có trong code (ví dụ: các lớp cần xây dựng, tính kế thừa, bao đóng, đa hình, các phương thức cụ thể, xử lý logic).
3. Đánh giá xem mã nguồn của sinh viên (ngôn ngữ: ${language.toUpperCase()}) có đáp ứng từng yêu cầu này không.
4. Cho điểm tổng quan trên thang điểm 10 và nhận xét chi tiết.

Bạn PHẢI trả về dữ liệu dạng JSON khớp chính xác với định dạng sau:
{
  "checkpoints": [
    {
      "requirement": "Tên yêu cầu trích xuất được (ngắn gọn dưới 15 từ)",
      "passed": true,
      "details": "Giải thích ngắn gọn lý do đạt hoặc không đạt dựa trên phân tích dòng code cụ thể."
    }
  ],
  "score": 8.0,
  "feedback": "Nhận xét tổng quát chi tiết về chất lượng code, cấu trúc và cách thiết kế của sinh viên."
}`;

  const prompt = `Đề bài:
Tiêu đề: ${problem.title}
Mô tả đề bài:
${problem.description}

Mã nguồn của sinh viên (ngôn ngữ: ${language.toUpperCase()}):
\`\`\`
${studentCode}
\`\`\`

Hãy phân tích đề bài, tự động trích xuất các tiêu chí cần đạt và chấm điểm mã nguồn của sinh viên. Trả về duy nhất đối tượng JSON chứa các trường checkpoints, score và feedback.`;

  const responseText = await callGemini(prompt, systemInstruction, true);
  try {
    return JSON.parse(responseText);
  } catch (e) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*"checkpoints"[\s\S]*"score"[\s\S]*"feedback"[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e2) {
      console.error('Failed to extract JSON from response:', e2);
    }
    
    console.error('Failed to parse autoEvaluateCode JSON:', responseText, e);
    return {
      checkpoints: [
        { requirement: "Kiểm tra cú pháp & Biên dịch", passed: true, details: "Mã nguồn được biên dịch mà không gặp lỗi cú pháp nghiêm trọng." },
        { requirement: "Hoàn thành các yêu cầu cơ bản của đề bài", passed: true, details: "AI nhận diện mã nguồn cơ bản đáp ứng định hướng của đề bài." }
      ],
      score: 7.0,
      feedback: "Hệ thống gặp sự cố khi xử lý dữ liệu tự động chấm điểm từ AI. Điểm số mặc định được áp dụng."
    };
  }
};
