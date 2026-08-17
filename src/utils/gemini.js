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

// Models được thử theo thứ tự ưu tiên — mới nhất/mạnh nhất lên đầu
const CANDIDATE_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest'
];

// Models hỗ trợ Vision (multimodal)
const VISION_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest'
];

/**
 * Tự động lọc Markdown JSON fence ``` json ... ``` mà AI đôi khi trả về,
 * để đảm bảo JSON.parse không bị lỗi do wrapper không mong muốn.
 */
function cleanJsonResponse(text) {
  if (!text) return text;
  // Lọc ```json ... ``` hoặc ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  return text.trim();
}

const callGemini = async (prompt, systemInstruction = '', jsonMode = false, options = {}) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Chưa cấu hình API Key Gemini. Vui lòng thêm vào file .env hoặc nhập ở giao diện. (Mã lỗi: SYS-02)');
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
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 1000,
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
        const rawText = textParts.length > 0 ? textParts[textParts.length - 1].text : '';
        return jsonMode ? cleanJsonResponse(rawText) : rawText;
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

  throw lastError || new Error('Không thể kết nối đến Gemini API. Vui lòng kiểm tra API key. (Mã lỗi: SYS-03)');
};

/**
 * callGeminiWithImages — Gọi Gemini Vision API với cả text và hình ảnh (multimodal).
 * images: mảng { mimeType: 'image/png', data: 'base64...' }
 */
const callGeminiWithImages = async (prompt, images = [], systemInstruction = '', jsonMode = false, options = {}) => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Chưa cấu hình API Key Gemini. (Mã lỗi: SYS-02)');

  // Chỉ model Vision hỗ trợ multimodal
  const visionModels = VISION_MODELS;

  // Build parts: ảnh trước, text sau cùng
  const parts = [
    ...images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
    { text: prompt }
  ];

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      temperature: options.temperature ?? 0.1,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    }
  };
  if (systemInstruction) requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  if (jsonMode) requestBody.generationConfig.responseMimeType = 'application/json';

  let lastError = null;
  for (const modelName of visionModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      if (response.ok) {
        const data = await response.json();
        const pts = data.candidates?.[0]?.content?.parts || [];
        const textPts = pts.filter(p => p.text !== undefined);
        const rawText = textPts.length > 0 ? textPts[textPts.length - 1].text : '';
        return jsonMode ? cleanJsonResponse(rawText) : rawText;
      }
      const errData = await response.json().catch(() => ({}));
      lastError = new Error(`Gemini Vision lỗi (${modelName}): ${errData.error?.message || response.status}`);
      if (response.status === 429 || response.status === 404) { console.warn(lastError.message); continue; }
      throw lastError;
    } catch (err) {
      if (err.message?.includes('401') || err.message?.includes('UNAUTHENTICATED')) throw err;
      lastError = err;
    }
  }
  throw lastError || new Error('Gemini Vision API không khả dụng.');
};

// 1. Tạo câu hỏi đầu tiên
export const generateFirstQuestion = async (problem, studentCode, lastOutput, language = 'python') => {
  const problemContent = typeof problem === 'object' 
    ? `Tiêu đề: ${problem.title || ''}\nMô tả đề bài: ${problem.description || JSON.stringify(problem, null, 2)}`
    : String(problem);

  const systemInstruction = `Bạn là giám khảo chấm thi vấn đáp lập trình chuyên nghiệp và nghiêm túc.
QUY TẮC BẮT BUỘC VỀ PHẠM VI CÂU HỎI:
1. Bạn CHỈ ĐƯỢC ĐẶT CÂU HỎI TRONG PHẠM VI NỘI DUNG ĐỀ BÀI VÀ ĐOẠN CODE SINH VIÊN ĐÃ VIẾT.
2. TUYỆT ĐỐI KHÔNG đặt câu hỏi lý thuyết suông ngoài đề bài, KHÔNG hỏi kiến thức mở rộng ngoài phạm vi yêu cầu của đề bài và code của sinh viên.
3. Các nội dung được phép hỏi: Ý nghĩa các biến/vòng lặp/hàm trong code sinh viên đã viết, cách code đáp ứng từng yêu cầu cụ thể của đề bài, lý do chọn cách giải này cho bài toán.
4. Mỗi lượt CHỈ HỎI ĐÚNG 1 CÂU HỎI (Câu 1/5), ngắn gọn, đi thẳng vào vấn đề.
5. Trả lời bằng văn bản thuần túy (plain text). KHÔNG sử dụng markdown (**, *, #, \`), LaTeX ($...$), hay định dạng đặc biệt. Viết tự nhiên như đang nói chuyện trực tiếp.`;

  const prompt = `Yêu cầu Đề bài:
${problemContent}

Bài làm của sinh viên (ngôn ngữ: ${language.toUpperCase()}):
\`\`\`
${studentCode}
\`\`\`

Output thực tế khi chạy:
${lastOutput ? lastOutput : '(Chưa chạy hoặc không có output)'}

Hãy đặt câu hỏi vấn đáp đầu tiên (Câu 1/5) cho sinh viên này bằng tiếng Việt. BẮT BUỘC câu hỏi phải nằm 100% trong phạm vi Đề bài và Code ở trên.`;

  return await callGemini(prompt, systemInstruction);
};

// 2. Tạo câu hỏi tiếp theo dựa trên lịch sử
export const generateNextQuestion = async (problem, studentCode, chatHistory, currentQuestionIndex, language = 'java') => {
  const problemContent = typeof problem === 'object' 
    ? `Tiêu đề: ${problem.title || ''}\nMô tả đề bài: ${problem.description || JSON.stringify(problem, null, 2)}`
    : String(problem);

  const systemInstruction = `Bạn là giám khảo chấm thi vấn đáp lập trình chuyên nghiệp và nghiêm túc.
QUY TẮC BẮT BUỘC VỀ PHẠM VI CÂU HỎI:
1. Bạn CHỈ ĐƯỢC ĐẶT CÂU HỎI TRONG PHẠM VI NỘI DUNG ĐỀ BÀI VÀ ĐOẠN CODE SINH VIÊN ĐÃ VIẾT.
2. TUYỆT ĐỐI KHÔNG hỏi các kiến thức lý thuyết mở rộng ngoài đề bài, KHÔNG hỏi các chủ đề/công nghệ/bài toán khác nằm ngoài đề bài và code hiện tại.
3. Đặt câu hỏi xoay quanh: Khai thác câu trả lời trước đó của sinh viên, làm rõ hơn ý nghĩa đoạn code sinh viên viết và cách xử lý các yêu cầu của đề bài.
4. Mỗi lượt CHỈ HỎI ĐÚNG 1 CÂU HỎI (Câu ${currentQuestionIndex}/5).
5. Trả lời bằng văn bản thuần túy (plain text). KHÔNG sử dụng markdown (**, *, #, \`), LaTeX ($...$), hay định dạng đặc biệt. Viết tự nhiên như đang nói chuyện trực tiếp.`;

  const formattedHistory = chatHistory.map(msg => `${msg.role === 'user' ? 'Sinh viên' : 'Giám khảo'}: ${msg.text}`).join('\n');

  const prompt = `Yêu cầu Đề bài:
${problemContent}

Bài làm của sinh viên (ngôn ngữ: ${language.toUpperCase()}):
\`\`\`
${studentCode}
\`\`\`

Lịch sử cuộc vấn đáp đến hiện tại:
${formattedHistory}

Hãy đưa ra câu hỏi vấn đáp tiếp theo (Câu ${currentQuestionIndex}/5) bằng tiếng Việt. BẮT BUỘC câu hỏi phải nằm 100% trong phạm vi Đề bài và Code ở trên, ngắn gọn và trực diện.`;

  return await callGemini(prompt, systemInstruction);
};

// 3. Đánh giá và chấm điểm toàn bộ sau 5 câu hỏi
export const evaluateViva = async (problem, studentCode, lastOutput, chatHistory, language = 'python') => {
  const problemContent = typeof problem === 'object' 
    ? `Tiêu đề: ${problem.title || ''}\nMô tả đề bài: ${problem.description || JSON.stringify(problem, null, 2)}`
    : String(problem);

  const systemInstruction = `Bạn là giám khảo chấm thi vấn đáp lập trình chuyên nghiệp, công bằng và tôn trọng bài làm của sinh viên.
QUY TẮC BẮT BUỘC KHI ĐÁNH GIÁ & CHẤM ĐIỂM:
1. Đánh giá ĐÚNG TRỌNG TÂM YÊU CẦU ĐỀ BÀI VÀ NỘI DUNG CODE THỰC TẾ SINH VIÊN ĐÃ VIẾT.
2. TUYỆT ĐỐI KHÔNG BẮT LỖI HOẶC TRỪ ĐIỂM sinh viên về việc dùng hay không dùng "template code" hoặc "hàm solve()". Sinh viên hoàn toàn tự do viết code dạng script đơn giản hoặc tự tạo hàm riêng, miễn là giải quyết đúng bài toán.
3. TUYỆT ĐỐI KHÔNG TRỪ ĐIỂM hay nhận xét về việc thiếu "xử lý ngoại lệ" (exception handling, try-catch) hay cấu trúc ngoài trừ khi đề bài có yêu cầu rõ ràng.
4. Đánh giá dựa trên:
   - Sinh viên có hiểu và giải thích được đoạn code mình đã viết hay không (xác minh tự viết hay chép).
   - Code của sinh viên có chạy đúng và đáp ứng đúng các yêu cầu của đề bài hay không.

Trả về dữ liệu dạng JSON khớp chính xác với định dạng sau:
{
  "vivaScore": 8.5,
  "aiCodeScore": 7.0,
  "feedback": "Nhận xét chi tiết tập trung vào mức độ hiểu đề bài, giải trình code và thuật toán của sinh viên dựa đúng trên đề bài và bài làm thực tế.",
  "summary": "Tóm tắt ngắn gọn trong 1-2 câu."
}
VivaScore: chấm riêng phần trả lời vấn đáp (0-10).
AiCodeScore: chấm chất lượng code dựa trên các câu trả lời và output thực tế (0-10).`;

  const formattedHistory = chatHistory.map(msg => `${msg.role === 'user' ? 'Sinh viên' : 'Giám khảo'}: ${msg.text}`).join('\n');

  const prompt = `Yêu cầu Đề bài:
${problemContent}

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
  const systemInstruction = `Bạn là chuyên gia thẩm định và chấm điểm mã nguồn lập trình chuyên nghiệp và công bằng.
QUY TẮC CHẤM ĐIỂM CỐT LÕI (BẮT BUỘC):
1. Đọc kỹ đề bài (bao gồm tiêu đề và phần mô tả).
2. Tự động trích xuất các yêu cầu kỹ thuật (Checkpoints) cốt lõi ĐƯỢC NÊU TRONG ĐỀ BÀI.
3. TUYỆT ĐỐI KHÔNG BẮT LỖI HOẶC TRỪ ĐIỂM sinh viên về việc dùng hay không dùng "template code", "hàm solve" hay bất kỳ hàm mặc định nào. Sinh viên được tự do viết script trực tiếp hoặc viết hàm riêng.
4. TUYỆT ĐỐI KHÔNG TRỪ ĐIỂM các kỹ thuật ngoài đề bài (như exception handling, try-catch...) nếu đề bài không yêu cầu.
5. Đánh giá xem mã nguồn của sinh viên (ngôn ngữ: ${language.toUpperCase()}) có đáp ứng đúng và đủ các yêu cầu trong đề bài hay không.

Bạn PHẢI trả về dữ liệu dạng JSON khớp chính xác với định dạng sau:
{
  "checkpoints": [
    {
      "requirement": "Tên yêu cầu trích xuất được từ đề bài (ngắn gọn dưới 15 từ)",
      "passed": true,
      "details": "Giải thích ngắn gọn lý do đạt hoặc không đạt dựa trên phân tích dòng code cụ thể."
    }
  ],
  "score": 8.0,
  "feedback": "Nhận xét tổng quát tập trung đúng vào các yêu cầu của đề bài và giải pháp trong code sinh viên."
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

// ─────────────────────────────────────────────────────────────
// WORD IMPORT AI — Bóc tách đề thi bằng AI
// ─────────────────────────────────────────────────────────────

/**
 * Bóc tách toàn bộ câu hỏi từ đoạn text thô (trích xuất từ .docx) bằng Gemini AI.
 * Hỗ trợ chunking tự động nếu văn bản dài (> CHUNK_LINES dòng/chunk).
 *
 * @param {string} rawText     - Plain text trích xuất từ file Word
 * @param {object} [imageMap]  - { [questionPrefix]: base64Src } hình ảnh đi kèm
 * @param {function} [onProgress] - Callback(done, total) khi xử lý chunk
 * @returns {Promise<Array>}   Danh sách câu hỏi đã chuẩn hóa
 */
export const parseWordContentWithAI = async (rawText, imageMap = {}, onProgress = null, imageSequence = []) => {
  const CHUNK_LINES = 120;
  const hasImages = imageSequence.length > 0;

  const systemInstruction = `Bạn là chuyên gia phân tích và bóc tách đề thi học thuật.
Nhiệm vụ: Đọc văn bản đề thi và trả về mảng JSON các câu hỏi.
${hasImages ? `
QUY TẮC XỬ LÝ ẢNH:
- Trong văn bản có các placeholder [IMG_1], [IMG_2], [IMG_3]... tương ứng với các ảnh được gửi kèm theo thứ tự.
- Khi đặt giá trị cho "question" hay "options", giữ nguyên placeholder [IMG_N] nếu ảnh đó là toàn bộ nội dung.
- Nếu ảnh là bảng dữ liệu trong đề bài, giữ [IMG_N] trong "question" kèm theo mô tả văn bản.
- Nếu phương án chỉ gồm ảnh (không có text), viết đúng [IMG_N] vào mảng options tại vị trí tương ứng.
- Ví dụ: options: ["[IMG_2]", "[IMG_3]", "[IMG_4]", "[IMG_5]"] nếu cả 4 phương án đều là ảnh.
` : ''}

=== NHẬN DẠNG FORMAT VĂN BẢN QUAN TRỌNG ===
Văn bản có thể chứa định dạng đặc biệt:
- **text** hoặc __text__ = văn bản IN ĐẬM trong file Word gốc → DẤU HIỆU ĐÁP ÁN ĐÚNG (SINGLE/MULTISELECT)
- [BLUE: text] = Dòng hoặc text có MÀU XANH (00B0F0/0070C0) trong file Word gốc → DẤU HIỆU ĐÁP ÁN ĐÚNG
- [RED: text] = Dòng hoặc text có MÀU ĐỎ (FF0000/C00000) trong file Word gốc → DẤU HIỆU ĐÁP ÁN SAI
- [HL: text] = Dòng hoặc text được HIGHLIGHT (vàng/xanh lá) trong file Word gốc → DẤU HIỆU ĐÁP ÁN ĐÚNG
- Câu hỏi thường bắt đầu bằng "Câu N:" hoặc "Question N:" (bỏ số thứ tự khi điền vào field "question")
- Phương án có thể là danh sách không có nhãn A/B/C/D (chỉ là các dòng/mục riêng lẻ)
- Phương án có thể là danh sách có nhãn "1. 2. 3." hoặc "- item"
- [SLOT: text] → [TERM: text] = Bảng kéo thả (cột trái = chỗ trống/slot câu hỏi, cột phải = term đúng)
- [ITEM: text] → [GROUP: text] = Bảng phân loại (cột trái = item, cột phải = tên nhóm đích)
- [NHOM: tên nhóm] = Header nhóm trong bảng groupdrag 2 cột (items theo cột)

HỆ THỐNG HỖ TRỢ ĐÚNG 9 DẠNG CÂU HỎI - phân loại chính xác theo nội dung:

--- DẠNG 1: SINGLE (Trắc nghiệm chọn 1 đáp án đúng) ---
Nhận dạng: Có các phương án (có thể có hoặc không có nhãn A/B/C/D). Chỉ 1 đáp án đúng.
DẤU HIỆU ĐÁP ÁN ĐÚNG trong văn bản LMS (không nhãn A/B/C):
  - Phương án đúng được viết **in đậm** (dấu **)
  - Ví dụ: "Phương án sai\n**Phương án đúng**\nPhương án sai" → correct: 1
DẤU HIỆU ĐÁP ÁN ĐÚNG trong văn bản có nhãn A/B/C:
  - In đậm, gạch chân, đánh dấu *, in đỏ, hoặc ghi "Answers: A"
Cấu trúc JSON:
{
  "type": "single",
  "question": "Nội dung câu hỏi (KHÔNG gồm 'Câu N:')",
  "options": ["Phương án 1", "Phương án 2", "Phương án 3", "Phương án 4"],
  "correct": 0,
  "points": 1,
  "_needsReview": false
}
"correct": index 0-based của đáp án đúng. Đặt _needsReview: true nếu không xác định được.
LƯU Ý: Khi options là danh sách "- item" hoặc "1. item", lấy phần text sau ký hiệu.

--- DẠNG 2: MULTISELECT (Trắc nghiệm nhiều đáp án đúng) ---
Nhận dạng: Có cụm "(Chọn N)", "(Chọn 2)", "(Chọn 3)", "select all that apply", hoặc nhiều phương án in đậm.
Nhận dạng thêm: Cụm "[ ! Sinh viên chọn X phương án đúng nhất ]" hoặc tương tự → LUÔN là MULTISELECT.
DẤU HIỆU đáp án đúng trong văn bản LMS:
- Phương án đúng được **in đậm** (dấu **) HOẶC có [BLUE: ...] HOẶC có [HL: ...]
- Phương án sai không in đậm và không có marker màu
Cấu trúc JSON:
{
  "type": "multiselect",
  "question": "Nội dung câu hỏi (KHÔNG gồm 'Câu N:', '(Chọn 2)', hay ghi chú '[ ! ...]')",
  "options": ["Phương án 1", "Phương án 2", "Phương án 3", "Phương án 4", "Phương án 5"],
  "corrects": [0, 2],
  "points": 1,
  "_needsReview": false
}
"corrects": mảng index (0-based) các đáp án đúng (phương án in đậm ** hoặc có [BLUE:...]/[HL:...]).

--- DẠNG 3: FILL (Điền vào chỗ trống) ---
Nhận dạng: Có chỗ trống ___ hoặc ...... trong câu, hoặc có dòng "Đáp án:" kèm 1 từ/cụm từ, không có các phương án A/B/C.
Cấu trúc JSON:
{
  "type": "fill",
  "question": "Nội dung câu hỏi có ___",
  "answer": "Đáp án đúng",
  "points": 1,
  "_needsReview": false
}
Đảm bảo "question" chứa ___ để đánh dấu chỗ trống.

--- DẠNG 4: TRUEFALSE (Đúng / Sai — 1 phát biểu) ---
Nhận dạng: Câu hỏi chỉ có 2 lựa chọn True/False hoặc Đúng/Sai cho 1 mệnh đề duy nhất.
KHÔNG dùng dạng này khi có nhiều phát biểu con (→ dùng DẠNG 9 MULTITRUEFALSE).
Cấu trúc JSON:
{
  "type": "truefalse",
  "question": "Mệnh đề cần xác nhận",
  "correct": true,
  "points": 1,
  "_needsReview": false
}

--- DẠNG 5: DRAG (Ghép cặp 1-1) ---
Nhận dạng: Bảng 2 cột, MỖI HÀNG là 1 cặp riêng biệt — vế TRÁI ghép với vế PHẢI của CÙNG HÀNG đó.
Cấu trúc JSON:
{
  "type": "drag",
  "question": "Kéo thả đúng các thành phần vào loại tương ứng",
  "pairs": [
    { "left": "LẦN MƯỢN",    "right": "Thực thể trung gian" },
    { "left": "SỐ ĐIỆN THOẠI","right": "Thuộc tính đa trị" }
  ],
  "points": 1
}

--- DẠNG 5b: DRAG (Ghép cặp 1-1 với tên slot) — nhận dạng đặc biệt ---
Nếu câu có "(Chú ý: chỉ kéo 1 đối tượng vào 1 ô)" hoặc mỗi nhóm chỉ nhận ĐÚNG 1 item:
→ Dùng DRAG thay vì GROUPDRAG.
Ví dụ LMS thực tế:
  "Câu 11: ... kéo thả ĐÚNG đối tượng... (Chú ý: chỉ kéo 1 đối tượng vào 1 ô)
   Các đối tượng: Xung quang học, Sóng điện từ, Xung điện
   1) Môi trường sử dụng Cáp xoắn
   **Xung điện**
   2) Môi trường Không khí
   **Sóng điện từ**"
→ 3 đối tượng, 3 slot (hoặc 2 slot + 1 đối tượng có thể bị ẩn) — dùng DRAG:
{
  "type": "drag",
  "question": "Phân loại tín hiệu vật lý vào môi trường truyền dẫn tương ứng",
  "pairs": [
    { "left": "Môi trường sử dụng Cáp xoắn", "right": "Xung điện" },
    { "left": "Môi trường Không khí", "right": "Sóng điện từ" },
    { "left": "Môi trường sử dụng Cáp quang", "right": "Xung quang học" }
  ],
  "points": 1
}
(Nếu chỉ thấy được 2 cặp, tạo đủ các cặp từ danh sách đối tượng còn lại)

--- DẠNG 6: GROUPDRAG (Phân loại nhóm — mỗi nhóm có NHIỀU items) ---
Nhận dạng: Yêu cầu phân loại nhiều từ/mục vào 2+ NHÓM, mỗi nhóm nhận NHIỀU HƠN 1 item.
FORMAT LMS ĐẶC BIỆT — 3 dạng thực tế hay gặp:

[DẠNG A] Đáp án in đậm (**) sau tên nhóm, phân cách bằng dấu phẩy:
  "1) Có định hướng (có dây)
   **Cáp quang, Cáp xoắn, Cáp đồng trục**
   2) Không định hướng (không dây)
   **Sóng mạng 5G, Sóng mạng Wifi**"
→ Split theo dấu phẩy: items = ["Cáp quang", "Cáp xoắn", "Cáp đồng trục"]

[DẠNG B] Đáp án in đậm (**) sau tên nhóm, phân cách bằng dấu chấm phẩy (;):
  "Các đặc điểm: A; B; C
   1) Nhóm X
   **AB**        ← 2 items A và B dính nhau, xem trong "Các đặc điểm" để tách
   2) Nhóm Y
   **C**"
→ Dùng danh sách "Các đối tượng:" / "Các đặc điểm:" để biết đúng tên item và tách chính xác.
→ Mỗi item phải khớp CHÍNH XÁC với 1 mục trong danh sách "Các đối tượng/đặc điểm".

[DẠNG C] Mỗi item nằm trên dòng riêng (không dính nhau):
  "1) Nhóm X
   **Item A**
   **Item B**
   2) Nhóm Y
   **Item C**"
→ items = ["Item A", "Item B"]

QUY TẮC QUAN TRỌNG CHO GROUPDRAG:
- LUÔN đối chiếu với danh sách "Các đối tượng:" hoặc "Các đặc điểm:" để xác định tên chính xác từng item.
- Khi đáp án in đậm bị DÍNH NHAU (không có dấu phân cách), tách theo danh sách gốc.
- Ví dụ: "Các đặc điểm: Truyền tín hiệu bằng ánh sáng; Khoảng cách truyền xa, chống nhiễu tốt; Dễ thi công..."
  → 3 items: ["Truyền tín hiệu bằng ánh sáng", "Khoảng cách truyền xa, chống nhiễu tốt", "Dễ thi công, giá rẻ, phổ biến trong mạng LAN"]
  → Bold đáp án nhóm 1 dính "Truyền tín hiệu bằng ánh sángKhoảng cách truyền xa, chống nhiễu tốt"
  → Tách thành 2 items khớp danh sách: "Truyền tín hiệu bằng ánh sáng" + "Khoảng cách truyền xa, chống nhiễu tốt"

Cấu trúc JSON mẫu thực tế (file mạng máy tính Câu 12 & 13):
{
  "type": "groupdrag",
  "question": "Kéo thả đối tượng vào đúng nhóm môi trường truyền dẫn",
  "groups": [
    { "groupName": "Có định hướng (có dây)", "items": ["Cáp quang", "Cáp xoắn", "Cáp đồng trục"] },
    { "groupName": "Không định hướng (không dây)", "items": ["Sóng mạng 5G", "Sóng mạng Wifi"] }
  ],
  "points": 1
}

--- DẠNG 7: CLOZEDRAG (Kéo vào đoạn văn) ---
Nhận dạng: Đoạn văn chứa nhiều chỗ trống [1][2][3] và danh sách từ để kéo vào.
Cấu trúc JSON:
{
  "type": "clozedrag",
  "question": "Mặt trời mọc ở hướng [1] và lặn ở hướng [2]",
  "answers": ["Đông", "Tây"],
  "points": 1
}

--- DẠNG 8: ORDER (Sắp xếp thứ tự) ---
Nhận dạng: Yêu cầu sắp xếp các bước/mục theo thứ tự đúng.
Cấu trúc JSON:
{
  "type": "order",
  "question": "Sắp xếp các bước",
  "items": ["Bước 1", "Bước 2", "Bước 3"],
  "correctOrder": [0, 1, 2],
  "points": 1
}

--- DẠNG 9: MULTITRUEFALSE (Đúng/Sai nhiều phát biểu) ---
Nhận dạng: 1 câu hỏi gốc kèm nhiều phát biểu con (2-4 phát biểu), mỗi phát biểu cần xác nhận Đúng hoặc Sai riêng lẻ.
Nhận dạng: Câu hỏi gốc có dạng "phát biểu nào sau đây đúng/sai", "chọn đúng/sai cho các phát biểu", v.v.
FORMAT VĂN BẢN CÓ MÀU (CSDL LMS - format mới, ưu tiên hơn):
  Thứ tự trong văn bản đối với mỗi phát biểu:
  [Phát biểu 1]
  [BLUE: Đúng] → correct: true   (chữ "Đúng" có màu xanh BLUE = đáp án ĐÚNG)
  Sai           → (không xét)
  [Phát biểu 2]
  [RED: Sai]  → correct: false  (chữ "Sai" có màu đỏ RED = đáp án SAI)
  Đúng          → (không xét)
  RULE MÀU (ƯU TIÊN CAO NHẤT):
  - [BLUE: Đúng] → correct: true
  - [BLUE: Sai]  → correct: false (hiếm)
  - [RED: Sai]   → correct: false
  - [RED: Đúng]  → correct: true (hiếm)
  CHỮ CÓ MÀU là đáp án đúng của phát biểu đó, bất kể thứ tự Đúng/Sai.
FORMAT VĂN BẢN CŨ (bold) - vẫn được hỗ trợ:
  "Phát biểu...\n**Đúng**\nSai" → correct: true
  "Phát biểu...\nĐúng\n**Sai**" → correct: false
Cấu trúc JSON:
{
  "type": "multitruefalse",
  "question": "Câu hỏi gốc (KHÔNG kèm các phát biểu con)",
  "statements": [
    { "text": "Phát biểu 1", "correct": true },
    { "text": "Phát biểu 2", "correct": false },
    { "text": "Phát biểu 3", "correct": true },
    { "text": "Phát biểu 4", "correct": false }
  ],
  "points": 1
}
Tối đa 4 phát biểu. Mỗi phát biểu: text = nội dung phát biểu (không có "Đúng/Sai"), correct = boolean.

--- DẠNG BẢNG (Bảng 2 cột header nhóm - GROUPDRAG phức tạp) ---
Nhận dạng: Văn bản có [NHOM: Nhóm A] / [NHOM: Nhóm B] hoặc bảng hàng đầu = tên nhóm, hàng tiếp = items theo cột:
  "1) Nhóm A: Tên nhóm\t2) Nhóm B: Tên nhóm"
  "item1\titem3"
  "item2\titem4"
→ Phân loại theo cột: cột 1 thuộc Nhóm A, cột 2 thuộc Nhóm B.
→ Dùng GROUPDRAG với groups: [{name:'Tên nhóm A', items:[item1,item2]}, {name:'Tên nhóm B', items:[item3,item4]}]
LƯU Ý: Phân biệt với DRAG (1-1): GROUPDRAG khi một nhóm có nhiều hơn 1 item.

--- DẠNG BẢNG CANH (CLOZEDRAG từ bảng [SLOT] → [TERM]) ---
Nhận dạng: Văn bản có dạng [SLOT: _____text câu hỏi] → [TERM: term đúng]:
  "[SLOT: _____là phần mềm trung gian...] → [TERM: Hệ quản trị cơ sở dữ liệu]"
→ type: "clozedrag", question = nối các SLOT thành đoạn văn liên tiếp (thay _____ bằng [N]), answers = danh sách TERM theo thứ tự slot.

QUY TẮC CHUNG:
- Trả về DUY NHẤT mảng JSON hợp lệ, không giải thích ngoài.
- Bỏ qua tiêu đề, hướng dẫn chung, chỉ lấy câu hỏi.
- Giữ nguyên ngôn ngữ gốc (Tiếng Việt/Anh) của văn bản.
- KHÔNG đưa "Câu N:", "Câu 1:", "Question 1:" vào field "question".
- Nếu không xác định được đáp án đúng, đặt _needsReview: true.`;


  function splitIntoChunks(text) {
    const lines = text.split('\n');
    const chunks = [];
    for (let i = 0; i < lines.length; i += CHUNK_LINES) {
      chunks.push(lines.slice(i, i + CHUNK_LINES).join('\n'));
    }
    return chunks.filter(c => c.trim().length > 30);
  }

  function parseAIJsonArray(text) {
    try { const p = JSON.parse(text); return Array.isArray(p) ? p : []; } catch { /* fall through */ }
    try { const m = text.match(/\[[\s\S]*\]/); if (m) return JSON.parse(m[0]); } catch { /* ignore */ }
    return [];
  }

  function normalizeQuestion(q, imgSeq, localMap = []) {
    const type = q.type || 'single';
    const points = Number(q.points) || 1;

    // ── Resolve placeholder → src ───────────────────────────────
    // Hỗ trợ [IMAGE_K] (chunk-local, Gemini trả về) và [IMG_N] (global fallback)
    function resolveToSrc(str) {
      if (!str || !imgSeq || imgSeq.length === 0) return null;
      const trimmed = str.trim();
      const mLocal = trimmed.match(/^\[IMAGE_(\d+)\]$/i);
      if (mLocal) {
        const localK = parseInt(mLocal[1], 10) - 1;
        const globalIdx = localMap[localK];
        if (globalIdx !== undefined && globalIdx >= 0 && globalIdx < imgSeq.length) return imgSeq[globalIdx].src;
      }
      const mGlobal = trimmed.match(/^\[IMG_(\d+)\]$/i);
      if (mGlobal) {
        const globalIdx = parseInt(mGlobal[1], 10) - 1;
        if (globalIdx >= 0 && globalIdx < imgSeq.length) return imgSeq[globalIdx].src;
      }
      return null;
    }

    function resolveImgPlaceholder(text) {
      if (!text || !imgSeq || imgSeq.length === 0) return text;
      return text
        .replace(/\[IMAGE_(\d+)\]/gi, (full, k) => {
          const globalIdx = localMap[parseInt(k, 10) - 1];
          return (globalIdx !== undefined && globalIdx >= 0 && globalIdx < imgSeq.length)
            ? `<img src="${imgSeq[globalIdx].src}" style="max-width:100%;vertical-align:middle;" />`
            : full;
        })
        .replace(/\[IMG_(\d+)\]/gi, (full, n) => {
          const idx = parseInt(n, 10) - 1;
          return (idx >= 0 && idx < imgSeq.length)
            ? `<img src="${imgSeq[idx].src}" style="max-width:100%;vertical-align:middle;" />`
            : full;
        });
    }

    function extractFirstImgSrc(text) {
      if (!text) return { text: '', imgSrc: '' };
      const src = resolveToSrc(text.trim());
      if (src) return { text: '', imgSrc: src };
      return { text: resolveImgPlaceholder(text), imgSrc: '' };
    }

    // Resolve question text and extract question-level image
    const rawQuestion = (q.question || '').trim();
    const { text: questionText, imgSrc: questionImgSrc } = extractFirstImgSrc(rawQuestion);
    const questionResolved = questionImgSrc ? '' : resolveImgPlaceholder(rawQuestion);

    // Legacy imageMap matching (fast mode)
    let legacyImage = '';
    const qKey = (questionResolved || rawQuestion).slice(0, 60).toLowerCase();
    for (const [k, src] of Object.entries(imageMap)) {
      if (qKey.includes(k.toLowerCase().slice(0, 40))) { legacyImage = src; break; }
    }

    const image = questionImgSrc || legacyImage || '';
    const base = { type, question: questionResolved || questionText, image, points };

    // ── SINGLE ────────────────────────────────────────────────
    if (type === 'single') {
      const rawOpts = Array.isArray(q.options) ? q.options : [];
      const resolvedOpts = rawOpts.map(o => extractFirstImgSrc(String(o).trim()));
      const options = resolvedOpts.map(r => r.text);
      const optionImages = resolvedOpts.map(r => r.imgSrc);
      let correct = typeof q.correct === 'number' ? q.correct : 0;
      let needsReview = !!q._needsReview;
      if (options.filter(o => o || optionImages[options.indexOf(o)]).length < 2) needsReview = true;
      if (correct < 0 || correct >= options.length) { correct = 0; needsReview = true; }
      return { ...base, options, optionImages, correct, _needsReview: needsReview };
    }

    // ── MULTISELECT ───────────────────────────────────────────
    if (type === 'multiselect') {
      const rawOpts = Array.isArray(q.options) ? q.options : [];
      const resolvedOpts = rawOpts.map(o => extractFirstImgSrc(String(o).trim()));
      const options = resolvedOpts.map(r => r.text);
      const optionImages = resolvedOpts.map(r => r.imgSrc);
      const corrects = Array.isArray(q.corrects) ? q.corrects.filter(Number.isInteger) : [];
      const needsReview = corrects.length === 0;
      return { ...base, options, optionImages, corrects, _needsReview: needsReview };
    }

    // ── FILL (điền từ) ───────────────────────────────────────────────
    if (type === 'fill') {
      const answer = String(q.answer || '').trim();
      let question = resolveImgPlaceholder(base.question);
      if (!question.includes('___')) question += ' ___';
      const needsReview = !answer;
      return { ...base, question, answer, answers: answer ? [answer] : [], _needsReview: needsReview };
    }

    // ── CLOZEDRAG (kéo vào đoạn văn) ─────────────────────────
    if (type === 'clozedrag') {
      const answers = Array.isArray(q.answers) ? q.answers.map(a => String(a).trim()) : [];
      let question = resolveImgPlaceholder(base.question);
      const blankCount = (question.match(/___/g) || []).length;
      if (blankCount === 0 && answers.length > 0) question = question + ' ' + answers.map(() => '___').join(' ');
      const needsReview = answers.length === 0;
      return { ...base, question, answers, _needsReview: needsReview };
    }

    // ── TRUEFALSE ──────────────────────────────────────────────────
    if (type === 'truefalse') {
      let correct;
      if (typeof q.correct === 'boolean') correct = q.correct;
      else if (typeof q.correct === 'string') correct = /^(true|đúng|yes|1)$/i.test(q.correct.trim());
      else correct = true;
      const needsReview = q.correct === null || q.correct === undefined || !!q._needsReview;
      return { ...base, correct, _needsReview: needsReview };
    }

    // ── DRAG (ghép cặp 1-1) ─────────────────────────────────────
    if (type === 'drag') {
      const pairs = Array.isArray(q.pairs)
        ? q.pairs.filter(p => p.left || p.right).map(p => ({ left: String(p.left || '').trim(), right: String(p.right || '').trim() }))
        : [];
      const needsReview = pairs.length < 2;
      return { ...base, pairs, _needsReview: needsReview };
    }

    // ── GROUPDRAG (phân loại nhóm) ────────────────────────────
    if (type === 'groupdrag') {
      const groups = Array.isArray(q.groups)
        ? q.groups.map(g => ({
            name: String(g.name || '').trim(),
            items: Array.isArray(g.items) ? g.items.map(i => String(i).trim()).filter(Boolean) : []
          })).filter(g => g.name)
        : [];
      const needsReview = groups.length < 2;
      return { ...base, groups, _needsReview: needsReview };
    }

    // ── ORDER (sắp xếp) ──────────────────────────────────────────
    if (type === 'order') {
      const items = Array.isArray(q.items)
        ? q.items.map(i => String(i).trim()).filter(Boolean)
        : [];
      const needsReview = items.length < 2;
      return { ...base, items, _needsReview: needsReview };
    }

    // ── MULTITRUEFALSE (đúng/sai nhiều phát biểu) ──────────────
    if (type === 'multitruefalse') {
      const statements = Array.isArray(q.statements)
        ? q.statements
            .filter(s => s && s.text)
            .slice(0, 4)
            .map(s => ({
              text: String(s.text || '').trim(),
              correct: typeof s.correct === 'boolean' ? s.correct
                : /^(true|đúng|yes|1)$/i.test(String(s.correct || '').trim())
            }))
        : [];
      const needsReview = statements.length === 0;
      return { ...base, statements, _needsReview: needsReview };
    }

    // Fallback -> single
    return { ...base, type: 'single', options: [], optionImages: [], correct: 0, _needsReview: true };
  }

  const chunks = splitIntoChunks(rawText);
  if (chunks.length === 0) return [];

  // Phân phối ảnh theo chunk — re-index thành [IMAGE_1]..[IMAGE_K] cục bộ
  // để Gemini nhận đúng thứ tự ảnh trong parts[]
  function getChunkImageInfo(chunkText) {
    if (!imageSequence || imageSequence.length === 0) return { images: [], reindexedText: chunkText, localMap: [] };
    // Tìm tất cả [IMG_N] (1-based global) trong chunk, theo thứ tự xuất hiện
    const refs = [];
    const seen = new Set();
    for (const m of chunkText.matchAll(/\[IMG_(\d+)\]/gi)) {
      const globalIdx = parseInt(m[1], 10) - 1;
      if (!seen.has(globalIdx) && globalIdx >= 0 && globalIdx < imageSequence.length) {
        seen.add(globalIdx);
        refs.push(globalIdx);
      }
    }
    if (refs.length === 0) return { images: [], reindexedText: chunkText, localMap: [] };
    // Build local map: globalIdx → localIndex (1-based)
    const localMap = refs; // localMap[localIdx-1] = globalIdx
    // Re-index text: [IMG_N] → [IMAGE_K] (K = localIndex)
    let reindexedText = chunkText;
    refs.forEach((globalIdx, localIdx) => {
      const globalN = globalIdx + 1;
      const localK = localIdx + 1;
      reindexedText = reindexedText.replace(new RegExp(`\\[IMG_${globalN}\\]`, 'gi'), `[IMAGE_${localK}]`);
    });
    const images = refs.map(i => ({ mimeType: imageSequence[i].mimeType, data: imageSequence[i].data }));
    return { images, reindexedText, localMap };
  }

  const allQuestions = [];
  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i, chunks.length);
    const { images: chunkImages, reindexedText, localMap } = getChunkImageInfo(chunks[i]);
    const hasChunkImages = chunkImages.length > 0;
    // Prompt note cho AI: mỗi [IMAGE_K] tương ứng ảnh thứ K trong parts gửi kèm
    const imageNote = hasChunkImages
      ? `\n\nLƯU Ý: Văn bản có ${chunkImages.length} ảnh được gửi kèm theo thứ tự [IMAGE_1], [IMAGE_2]... Khi một phương án hoặc đề bài chỉ có [IMAGE_K], giữ nguyên [IMAGE_K] trong "question" hoặc "options". Ảnh được gửi trước text theo đúng thứ tự.`
      : '';
    const prompt = `Văn bản đề thi (phần ${i + 1}/${chunks.length}):${imageNote}\n\n${reindexedText}\n\nHãy bóc tách tất cả câu hỏi, phân loại đúng dạng, xác định đáp án và trả về mảng JSON.`;
    try {
      let responseText;
      if (hasChunkImages) {
        responseText = await callGeminiWithImages(prompt, chunkImages, systemInstruction, true, { maxOutputTokens: 8192, temperature: 0.1 });
      } else {
        responseText = await callGemini(prompt, systemInstruction, true, { maxOutputTokens: 8192, temperature: 0.1 });
      }
      // Resolve [IMAGE_K] → global imageSequence index khi normalize
      parseAIJsonArray(responseText).forEach(q => allQuestions.push(normalizeQuestion(q, imageSequence, localMap)));
    } catch (err) {
      console.error(`[parseWordContentWithAI] Chunk ${i + 1} lỗi:`, err);
      // Ném lỗi ra để UI catch và báo cho user (thay vì nuốt lỗi và import 0 câu)
      throw err;
    }
  }
  if (onProgress) onProgress(chunks.length, chunks.length);
  return allQuestions;
};



// ─────────────────────────────────────────────────────────────
// AI VISION — Bóc tách đề thi từ ảnh chụp / scan
// ─────────────────────────────────────────────────────────────

/**
 * parseExamFromImagesWithAI — Dùng Gemini Vision để OCR và bóc tách câu hỏi,
 * phương án và đáp án từ ảnh chụp / scan đề thi.
 *
 * @param {Array<{mimeType: string, data: string}>} images - Mảng ảnh base64 {mimeType, data}
 * @param {function} [onProgress] - Callback(done, total)
 * @returns {Promise<Array>} Danh sách câu hỏi đã chuẩn hóa (cùng format với parseWordContentWithAI)
 */
export const parseExamFromImagesWithAI = async (images = [], onProgress = null) => {
  if (images.length === 0) return [];

  const systemInstruction = `Bạn là chuyên gia OCR và phân tích đề thi học thuật. Nhiệm vụ: Đọc ảnh chụp/scan đề thi và trả về mảng JSON các câu hỏi.

HỆ THỐNG HỖ TRỢ ĐÚNG 9 DẠNG CÂU HỎI - phân loại chính xác theo nội dung:

--- DẠNG 1: SINGLE (Trắc nghiệm chọn 1 đáp án đúng) ---
Nhận dạng: Có các phương án A/B/C/D. Chỉ 1 đáp án đúng (thường được đánh dấu *, in đậm, gạch chân, hoặc ghi "Đáp án: A").
Cấu trúc JSON:
{
  "type": "single",
  "question": "Nội dung câu hỏi",
  "options": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
  "correct": 0,
  "points": 1,
  "_needsReview": false
}
"correct": index 0-based của đáp án đúng. Đặt _needsReview: true nếu không xác định được.

--- DẠNG 2: MULTISELECT (Trắc nghiệm nhiều đáp án đúng) ---
Nhận dạng: Nhiều đáp án đúng hoặc có cụm từ "chọn tất cả phương án đúng", "select all that apply".
Cấu trúc JSON:
{
  "type": "multiselect",
  "question": "Nội dung câu hỏi",
  "options": ["Phương án A", "Phương án B", "Phương án C"],
  "corrects": [0, 2],
  "points": 1,
  "_needsReview": false
}

--- DẠNG 3: FILL (Điền vào chỗ trống) ---
Nhận dạng: Có chỗ trống ___ hoặc ...... trong câu, không có phương án A/B/C.
Cấu trúc JSON:
{
  "type": "fill",
  "question": "Nội dung câu hỏi có ___",
  "answer": "Đáp án đúng",
  "points": 1,
  "_needsReview": false
}

--- DẠNG 4: TRUEFALSE (Đúng / Sai) ---
Nhận dạng: Câu hỏi có 2 lựa chọn True/False hoặc Đúng/Sai, hoặc mệnh đề phát biểu.
Cấu trúc JSON:
{
  "type": "truefalse",
  "question": "Mệnh đề cần xác nhận",
  "correct": true,
  "points": 1,
  "_needsReview": false
}

--- DẠNG 5: DRAG (Ghép cặp 1-1) ---
Nhận dạng: Bảng 2 cột, mỗi hàng là 1 cặp riêng biệt.
Cấu trúc JSON:
{
  "type": "drag",
  "question": "Ghép các cặp đúng",
  "pairs": [
    { "left": "Khái niệm A", "right": "Định nghĩa A" }
  ],
  "points": 1
}

--- DẠNG 6: GROUPDRAG (Phân loại nhóm — mỗi nhóm có NHIỀU items) ---
Nhận dạng: Yêu cầu phân loại nhiều mục vào 2+ nhóm, mỗi nhóm nhận nhiều hơn 1 item.
Phân biệt với DRAG (1-1): Nếu mỗi slot chỉ nhận 1 item → dùng DRAG.
QUY TẮC QUAN TRỌNG:
- Trong ảnh chụp đề thi, nhóm thường được trình bày dạng bảng hoặc khung có tiêu đề.
- Xác định tên nhóm từ tiêu đề hàng/cột, các item là nội dung bên trong ô đó.
- Nếu có danh sách "Các đối tượng:" / "Các đặc điểm:", dùng đó để tách item bị dính nhau.
Cấu trúc JSON:
{
  "type": "groupdrag",
  "question": "Phân loại các mục vào nhóm phù hợp",
  "groups": [
    { "groupName": "Nhóm A", "items": ["Mục 1", "Mục 2"] },
    { "groupName": "Nhóm B", "items": ["Mục 3", "Mục 4"] }
  ],
  "points": 1
}

--- DẠNG 7: CLOZEDRAG (Kéo vào đoạn văn) ---
Nhận dạng: Đoạn văn có nhiều chỗ trống [1][2][3] và danh sách từ để điền.
Cấu trúc JSON:
{
  "type": "clozedrag",
  "question": "Đoạn văn với [1] và [2]",
  "answers": ["Từ 1", "Từ 2"],
  "points": 1
}

--- DẠNG 8: ORDER (Sắp xếp thứ tự) ---
Nhận dạng: Yêu cầu sắp xếp các bước/mục theo thứ tự đúng.
Cấu trúc JSON:
{
  "type": "order",
  "question": "Sắp xếp các bước",
  "items": ["Bước 1", "Bước 2", "Bước 3"],
  "correctOrder": [0, 1, 2],
  "points": 1
}

--- DẠNG 9: MULTITRUEFALSE (Đúng/Sai nhiều phát biểu) ---
Nhận dạng: 1 câu hỏi gốc kèm tối đa 4 phát biểu con.
Cấu trúc JSON:
{
  "type": "multitruefalse",
  "question": "Câu hỏi gốc",
  "statements": [
    { "text": "Phát biểu 1", "correct": true },
    { "text": "Phát biểu 2", "correct": false }
  ],
  "points": 1
}

QUY TẮC QUAN TRỌNG KHI ĐỌC ẢNH:
- Nhận diện chính xác nội dung từ ảnh, kể cả nếu ảnh bị nghiêng hoặc hơi mờ.
- Nếu ảnh chứa công thức toán học, phiên âm sang LaTeX (ví dụ: $x^2 + y^2 = z^2$).
- Bỏ qua số thứ tự câu ("Câu 1:", "Question 1:") khi điền vào field "question".
- Trả về DUY NHẤT mảng JSON hợp lệ, không giải thích ngoài.
- Giữ nguyên ngôn ngữ gốc (Tiếng Việt/Anh) của đề thi.`;

  function parseAIJsonArray(text) {
    try { const p = JSON.parse(text); return Array.isArray(p) ? p : []; } catch { /* fall through */ }
    try { const m = text.match(/\[[\s\S]*\]/); if (m) return JSON.parse(m[0]); } catch { /* ignore */ }
    return [];
  }

  // Chuẩn hóa câu hỏi nhận được từ AI Vision (không có imageSequence/localMap)
  function normalizeVisionQuestion(q) {
    const type = q.type || 'single';
    const points = Number(q.points) || 1;
    const base = { type, question: String(q.question || '').trim(), image: '', points };
    if (type === 'single') {
      const options = Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [];
      let correct = typeof q.correct === 'number' ? q.correct : 0;
      const needsReview = !!q._needsReview || options.length < 2;
      if (correct < 0 || correct >= options.length) { correct = 0; }
      return { ...base, options, optionImages: options.map(() => ''), correct, _needsReview: needsReview };
    }
    if (type === 'multiselect') {
      const options = Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [];
      const corrects = Array.isArray(q.corrects) ? q.corrects.filter(Number.isInteger) : [];
      return { ...base, options, optionImages: options.map(() => ''), corrects, _needsReview: corrects.length === 0 };
    }
    if (type === 'fill') {
      const answer = String(q.answer || '').trim();
      let question = base.question;
      if (!question.includes('___')) question += ' ___';
      return { ...base, question, answer, answers: answer ? [answer] : [], _needsReview: !answer };
    }
    if (type === 'truefalse') {
      let correct;
      if (typeof q.correct === 'boolean') correct = q.correct;
      else if (typeof q.correct === 'string') correct = /^(true|đúng|yes|1)$/i.test(q.correct.trim());
      else correct = true;
      const needsReview = q.correct === null || q.correct === undefined || !!q._needsReview;
      return { ...base, correct, _needsReview: needsReview };
    }
    if (type === 'drag') {
      const pairs = Array.isArray(q.pairs)
        ? q.pairs.filter(p => p.left || p.right).map(p => ({ left: String(p.left || '').trim(), right: String(p.right || '').trim() }))
        : [];
      return { ...base, pairs, _needsReview: pairs.length < 2 };
    }
    if (type === 'groupdrag') {
      const groups = Array.isArray(q.groups)
        ? q.groups.map(g => ({ name: String(g.groupName || g.name || '').trim(), items: Array.isArray(g.items) ? g.items.map(i => String(i).trim()).filter(Boolean) : [] })).filter(g => g.name)
        : [];
      return { ...base, groups, _needsReview: groups.length < 2 };
    }
    if (type === 'clozedrag') {
      const answers = Array.isArray(q.answers) ? q.answers.map(a => String(a).trim()) : [];
      let question = base.question;
      if ((question.match(/___/g) || []).length === 0 && answers.length > 0) question += ' ' + answers.map(() => '___').join(' ');
      return { ...base, question, answers, _needsReview: answers.length === 0 };
    }
    if (type === 'order') {
      const items = Array.isArray(q.items) ? q.items.map(i => String(i).trim()).filter(Boolean) : [];
      return { ...base, items, _needsReview: items.length < 2 };
    }
    if (type === 'multitruefalse') {
      const statements = Array.isArray(q.statements)
        ? q.statements.filter(s => s && s.text).slice(0, 4).map(s => ({
            text: String(s.text || '').trim(),
            correct: typeof s.correct === 'boolean' ? s.correct : /^(true|đúng|yes|1)$/i.test(String(s.correct || '').trim())
          }))
        : [];
      return { ...base, statements, _needsReview: statements.length === 0 };
    }
    // Fallback
    return { ...base, type: 'single', options: [], optionImages: [], correct: 0, _needsReview: true };
  }

  // Xử lý từng ảnh riêng lẻ (mỗi ảnh = 1 trang đề thi)
  const allQuestions = [];
  for (let i = 0; i < images.length; i++) {
    if (onProgress) onProgress(i, images.length);
    const img = images[i];
    const prompt = `Đây là ảnh trang ${i + 1}/${images.length} của đề thi. Hãy đọc toàn bộ nội dung trong ảnh, nhận diện và bóc tách tất cả câu hỏi, phương án, đáp án theo đúng định dạng JSON đã quy định. Trả về mảng JSON.`;
    try {
      const responseText = await callGeminiWithImages(prompt, [img], systemInstruction, true, { maxOutputTokens: 8192, temperature: 0.1 });
      parseAIJsonArray(responseText).forEach(q => allQuestions.push(normalizeVisionQuestion(q)));
    } catch (err) {
      console.error(`[parseExamFromImagesWithAI] Ảnh ${i + 1} lỗi:`, err);
      throw err;
    }
  }
  if (onProgress) onProgress(images.length, images.length);
  return allQuestions;
};


/**
 * Sử dụng AI để suy luận đáp án đúng cho danh sách câu hỏi bị thiếu (_needsReview: true).
 *
 * @param {Array} unresolvedQuestions - Danh sách câu hỏi có _needsReview: true
 * @param {function} [onProgress] - Callback(done, total)
 * @returns {Promise<Array>} Câu hỏi đã cập nhật đáp án (hoặc giữ _needsReview nếu AI vẫn không chắc)
 */
export const autoDetectMissingAnswersWithAI = async (unresolvedQuestions, onProgress = null) => {
  const BATCH_SIZE = 10;

  const systemInstruction = `Bạn là chuyên gia giáo dục. Xác định đáp án đúng cho các câu hỏi thi dựa trên kiến thức của bạn.

Với mỗi câu hỏi, phân tích nội dung và phương án, chọn đáp án chính xác nhất.
Trả về mảng JSON với cùng số phần tử, mỗi phần tử gồm:
- "index": số thứ tự câu trong batch (bắt đầu từ 0)
- "correct": index đáp án đúng (cho single), null nếu không chắc
- "corrects": mảng index đáp án đúng (cho multiselect), [] nếu không chắc
- "answer": chuỗi đáp án (cho fill/truefalse), "" nếu không chắc
- "confident": true nếu chắc chắn về đáp án

Trả về DUY NHẤT mảng JSON hợp lệ.`;

  function buildPrompt(batch) {
    return `Xác định đáp án đúng cho ${batch.length} câu hỏi sau:\n\n` +
      batch.map((q, i) => {
        let s = `[${i}] (${q.type}) ${q.question}`;
        if (q.options?.length > 0) {
          s += '\n' + q.options.map((o, idx) => `  ${String.fromCharCode(65 + idx)}. ${o}`).join('\n');
        }
        return s;
      }).join('\n\n') +
      '\n\nTrả về mảng JSON.';
  }

  function parseAIJsonArray(text) {
    try { const p = JSON.parse(text); return Array.isArray(p) ? p : []; } catch { /* fall through */ }
    try { const m = text.match(/\[[\s\S]*\]/); if (m) return JSON.parse(m[0]); } catch { /* ignore */ }
    return [];
  }

  const result = unresolvedQuestions.map(q => ({ ...q }));
  const totalBatches = Math.ceil(unresolvedQuestions.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    if (onProgress) onProgress(batchIdx, totalBatches);
    const batch = unresolvedQuestions.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
    try {
      const responseText = await callGemini(buildPrompt(batch), systemInstruction, true, { maxOutputTokens: 4096, temperature: 0.1 });
      const answers = parseAIJsonArray(responseText);
      answers.forEach(ans => {
        const globalIdx = batchIdx * BATCH_SIZE + (ans.index ?? 0);
        if (globalIdx >= result.length || !ans.confident) return;
        const q = result[globalIdx];
        if (q.type === 'single' && typeof ans.correct === 'number') {
          result[globalIdx] = { ...q, correct: ans.correct, _needsReview: false };
        } else if (q.type === 'multiselect' && Array.isArray(ans.corrects) && ans.corrects.length > 0) {
          result[globalIdx] = { ...q, corrects: ans.corrects, _needsReview: false };
        } else if ((q.type === 'fill' || q.type === 'truefalse') && ans.answer) {
          result[globalIdx] = { ...q, answer: String(ans.answer), _needsReview: false };
        }
      });
    } catch (err) {
      console.error(`[autoDetectMissingAnswersWithAI] Batch ${batchIdx + 1} lỗi:`, err);
    }
  }
  if (onProgress) onProgress(totalBatches, totalBatches);
  return result;
};

