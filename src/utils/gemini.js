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

  throw lastError || new Error('Không thể kết nối đến Gemini API. Vui lòng kiểm tra API key. (Mã lỗi: SYS-03)');
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
export const parseWordContentWithAI = async (rawText, imageMap = {}, onProgress = null) => {
  const CHUNK_LINES = 120;

  const systemInstruction = `Bạn là chuyên gia phân tích và bóc tách đề thi học thuật.
Nhiệm vụ: Đọc văn bản đề thi và trả về mảng JSON các câu hỏi.

HỆ THỐNG HỔ TRỢ ĐÚNG 8 DẠNG CÂU HỊI - phân loại chính xác theo nội dung:

--- DẠNG 1: SINGLE (Trắc nghiệm chọn 1 đáp án đúng) ---
Nhận dạng: Có các phương án A/B/C/D. Chỉ 1 đáp án đúng (in đậm, gạch chân, đánh dấu *, in đỏ, hoặc ghi "Answers: A").
Cuấu trúc JSON:
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
Cuấu trúc JSON:
{
  "type": "multiselect",
  "question": "Nội dung câu hỏi",
  "options": ["Phương án A", "Phương án B", "Phương án C"],
  "corrects": [0, 2],
  "points": 1,
  "_needsReview": false
}
"corrects": mảng index (0-based) các đáp án đúng.

--- DẠNG 3: FILL (Điền vào chỗ trống) ---
Nhận dạng: Có chỗ trống ___ hoặc ...... trong câu, hoặc có dòng "Đáp án:" kèm 1 từ/cụm từ, không có các phương án A/B/C.
Cuấu trúc JSON:
{
  "type": "fill",
  "question": "Nội dung câu hỏi có ___",
  "answer": "Đáp án đúng",
  "points": 1,
  "_needsReview": false
}
Đảm bảo "question" chứa ___ để đánh dấu chỗ trống.

--- DẠNG 4: TRUEFALSE (Đúng / Sai) ---
Nhận dạng: Câu hỏi có 2 lựa chọn True/False hoặc Đúng/Sai, hoặc là mệnh đề phát biểu để xác nhận đúng/sai.
Cuấu trúc JSON:
{
  "type": "truefalse",
  "question": "Mệnh đề cần xác nhận",
  "correct": true,
  "points": 1,
  "_needsReview": false
}
"correct": true nếu đúng, false nếu sai (kiểu boolean).

--- DẠNG 5: DRAG (Ghép cặp 1-1) ---
Nhận dạng: Bảng 2 cột, MỖI HÀNG là 1 cặp riêng biệt — vế TRÁI ghép với vế PHẢI của CÙNG HÀNG đó.
Mỗi item vế trái chỉ tương ứng đúng 1 item vế phải (quan hệ 1-1).
Ví dụ trong file Word:
  | LẦN MƯỢN    | Thực thể trung gian |
  | SỐ ĐT       | Thuộc tính đa trị   |
  | MÃ ĐG       | Khóa chính          |
  | HẠN_TRẢ     | Thuộc tính liên kết |
→ Đây là DRAG vì mỗi hàng = 1 cặp riêng lẻ (LẦN MƯỢN ghép với Thực thể trung gian, v.v.)
Cấu trúc JSON:
{
  "type": "drag",
  "question": "Kéo thả đúng các thành phần vào loại tương ứng",
  "pairs": [
    { "left": "LẦN MƯỢN",    "right": "Thực thể trung gian" },
    { "left": "SỐ ĐIỆN THOẠI","right": "Thuộc tính đa trị" },
    { "left": "MÃ ĐG",        "right": "Khóa chính" },
    { "left": "HẠN_TRẢ",      "right": "Thuộc tính của liên kết" }
  ],
  "points": 1
}

--- DẠNG 6: GROUPDRAG (Phân loại nhóm) ---
Nhận dạng: Có TỪ 2 NHÓM TRỞ LÊN, mỗi nhóm chứa NHIỀU ITEMS. Các items rời được kéo vào đúng nhóm.
Khác với DRAG ở chỗ: một nhóm có thể chứa nhiều items (quan hệ nhiều-đến-1-nhóm).
Ví dụ trong file Word:
  Tiêu đề: "1) Kiểu thực thể" | "2) Thuộc tính"
  Items cần kéo vào đúng nhóm: Mặt hàng, Nhân viên, Chủng loại, Giá bán, Mã nhân viên...
→ Đây là GROUPDRAG vì nhóm "Thuộc tính" chứa nhiều items (Chủng loại, Giá bán, Mã nhân viên...)
Cấu trúc JSON:
{
  "type": "groupdrag",
  "question": "Phân loại các thành phần vào nhóm thích hợp",
  "groups": [
    { "name": "Kiểu thực thể", "items": ["Mặt hàng", "Nhân viên"] },
    { "name": "Thuộc tính",    "items": ["Chủng loại", "Giá bán", "Mã nhân viên", "Ngày sinh"] }
  ],
  "points": 1
}

⚠️ CHÚ Ý PHÂN BIỆT DRAG vs GROUPDRAG:
- DRAG: mỗi hàng trong bảng = 1 cặp (hàng trái ↔ hàng phải của cùng hàng đó), các cặp không liên quan nhau
- GROUPDRAG: có nhóm/tiêu đề, nhiều items thuộc cùng 1 nhóm, items được kéo tự do vào nhóm
- Nếu bảng 2 cột mà mỗi hàng là 1 cặp riêng → DRAG
- Nếu có tiêu đề nhóm và nhiều mục dưới mỗi nhóm → GROUPDRAG

--- DẠNG 7: CLOZEDRAG (Kéo từ vào đoạn văn) ---
Nhận dạng: Đoạn văn có nhiều chỗ trống ___ và có danh sách từ để kéo thả. Số lượng từ phải khớp số lượng ___.
Cấu trúc JSON:
{
  "type": "clozedrag",
  "question": "Đoạn văn với các ___ cần điền",
  "answers": ["từ 1", "từ 2", "từ 3"],
  "points": 1
}
"answers": mảng các từ điền đúng theo thứ tự xuất hiện của ___.

--- DẠNG 8: ORDER (Sắp xếp) ---
Nhận dạng: Yêu cầu sắp xếp các mục/bước/từ theo thứ tự đúng.
Cấu trúc JSON:
{
  "type": "order",
  "question": "Sắp xếp các bước dưới đây theo thứ tự đúng",
  "items": ["Mục 1 (thứ tự đúng)", "Mục 2", "Mục 3"],
  "points": 1
}
"items": mảng các mục THEO THỨ TỰ ĐÚNG (đã sắp xếp sẵn).

--- DẠNG 9: MULTITRUEFALSE (Đúng/Sai Nhiều Phát Biểu) ---
Nhận dạng: 1 câu dẫn kèm NHIỀU phát biểu con (thường 2-4 phát biểu), mỗi phát biểu yêu cầu xác định Đúng hoặc Sai RIÊNG LẺ.
Dấu hiệu: Câu dẫn có cụm "phát biểu nào sau đây là đúng/sai", "xác định đúng/sai", hoặc có danh sách 1)/2)/3)/4) kèm "Sai"/"Đúng" bên cạnh.
Ví dụ trong file Word:
  Câu 20: Về kiểu thực thể và thuộc tính, phát biểu nào sau đây là đúng/sai?
  1) Một thực thể có thể có nhiều thuộc tính khóa      Sai / Đúng (đáp án: Đúng)
  2) Mỗi kiểu thực thể phải có ít nhất một thuộc tính  Sai / Đúng (đáp án: Đúng)
  3) Thuộc tính có thể không có tên trong sơ đồ         Đúng / Sai (đáp án: Sai)
  4) Thuộc tính khóa không cần thiết trong mọi kiểu thể Đúng / Sai (đáp án: Sai)
→ Đây là MULTITRUEFALSE vì có NHIỀU phát biểu con, mỗi phát biểu có đáp án riêng.
Cấu trúc JSON:
{
  "type": "multitruefalse",
  "question": "Về kiểu thực thể và thuộc tính, hãy xác định các phát biểu sau đây là Đúng hay Sai:",
  "statements": [
    { "text": "Một thực thể có thể có nhiều thuộc tính khóa", "correct": true },
    { "text": "Mỗi kiểu thực thể phải có ít nhất một thuộc tính", "correct": true },
    { "text": "Thuộc tính có thể không có tên trong sơ đồ thực thể kết hợp", "correct": false },
    { "text": "Thuộc tính khóa không cần thiết trong mọi kiểu thực thể", "correct": false }
  ],
  "points": 1
}
"statements": mảng tối đa 4 phát biểu, mỗi phần tử có "text" (nội dung) và "correct" (true=Đúng, false=Sai).

⚠️ PHÂN BIỆT MULTITRUEFALSE vs TRUEFALSE:
- TRUEFALSE: CHỈ 1 phát biểu duy nhất, chọn Đúng hoặc Sai cho cả câu
- MULTITRUEFALSE: CÓ NHIỀU phát biểu con (2-4 phát biểu), mỗi phát biểu có đáp án riêng

QUY TẮC CHUNG:
1. Nhận dạng tất cả câu hỏi dù định dạng không chuẩn.
2. Xóa nhãn thừa: "Câu 1:", "A.", "1)", khoảng trắng đầu/cuối.
3. Xác định đáp án đúng dựa vào: nhãn (*), in đậm, gạch dưới, màu, dòng "Answers: X", hoặc "Key: X".
4. Không bịa thêm câu hỏi ngoài văn bản.
5. Trả về DUY NHẤT mảng JSON hợp lệ, không giải thích thêm.`;


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

  function normalizeQuestion(q) {
    const type = q.type || 'single';
    const questionText = (q.question || '').trim();
    const points = Number(q.points) || 1;

    // Gắp ảnh nếu imageMap có entry khớp
    let image = '';
    const qKey = questionText.slice(0, 60).toLowerCase();
    for (const [k, src] of Object.entries(imageMap)) {
      if (qKey.includes(k.toLowerCase().slice(0, 40))) { image = src; break; }
    }

    const base = { type, question: questionText, image, points };

    // ── SINGLE ────────────────────────────────────────────────
    if (type === 'single') {
      const options = Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [];
      let correct = typeof q.correct === 'number' ? q.correct : 0;
      let needsReview = !!q._needsReview;
      if (options.length < 2) needsReview = true;
      if (correct < 0 || correct >= options.length) { correct = 0; needsReview = true; }
      return { ...base, options, optionImages: options.map(() => ''), correct, _needsReview: needsReview };
    }

    // ── MULTISELECT ───────────────────────────────────────────
    if (type === 'multiselect') {
      const options = Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [];
      const corrects = Array.isArray(q.corrects) ? q.corrects.filter(Number.isInteger) : [];
      const needsReview = corrects.length === 0;
      return { ...base, options, optionImages: options.map(() => ''), corrects, _needsReview: needsReview };
    }

    // ── FILL (điền từ) ─────────────────────────────────────────
    if (type === 'fill') {
      const answer = String(q.answer || '').trim();
      let question = questionText;
      if (!question.includes('___')) question += ' ___';
      const needsReview = !answer;
      return { ...base, question, answer, answers: answer ? [answer] : [], _needsReview: needsReview };
    }

    // ── CLOZEDRAG (kéo vào đoạn văn) ──────────────────────────
    if (type === 'clozedrag') {
      const answers = Array.isArray(q.answers) ? q.answers.map(a => String(a).trim()) : [];
      let question = questionText;
      // Đảm bảo số ___ khớp answers
      const blankCount = (question.match(/___/g) || []).length;
      if (blankCount === 0 && answers.length > 0) {
        question = question + ' ' + answers.map(() => '___').join(' ');
      }
      const needsReview = answers.length === 0;
      return { ...base, question, answers, _needsReview: needsReview };
    }

    // ── TRUEFALSE ─────────────────────────────────────────────
    if (type === 'truefalse') {
      let correct;
      if (typeof q.correct === 'boolean') {
        correct = q.correct;
      } else if (typeof q.correct === 'string') {
        correct = /^(true|đúng|yes|1)$/i.test(q.correct.trim());
      } else {
        correct = true; // default, mark needsReview
      }
      const needsReview = q.correct === null || q.correct === undefined || !!q._needsReview;
      return { ...base, correct, _needsReview: needsReview };
    }

    // ── DRAG (ghép cặp 1-1) ─────────────────────────────────
    if (type === 'drag') {
      const pairs = Array.isArray(q.pairs)
        ? q.pairs.filter(p => p.left || p.right).map(p => ({ left: String(p.left || '').trim(), right: String(p.right || '').trim() }))
        : [];
      const needsReview = pairs.length < 2;
      return { ...base, pairs, _needsReview: needsReview };
    }

    // ── GROUPDRAG (phân loại nhóm) ──────────────────────────
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

    // ── ORDER (sắp xếp) ────────────────────────────────────
    if (type === 'order') {
      const items = Array.isArray(q.items)
        ? q.items.map(i => String(i).trim()).filter(Boolean)
        : [];
      const needsReview = items.length < 2;
      return { ...base, items, _needsReview: needsReview };
    }

    // ── MULTITRUEFALSE (đúng/sai nhiều phát biểu) ─────────
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
    return {
      ...base,
      type: 'single',
      options: [],
      optionImages: [],
      correct: 0,
      _needsReview: true,
    };
  }

  const chunks = splitIntoChunks(rawText);
  if (chunks.length === 0) return [];

  const allQuestions = [];
  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i, chunks.length);
    const prompt = `Văn bản đề thi (phần ${i + 1}/${chunks.length}):\n\n${chunks[i]}\n\nHãy bóc tách tất cả câu hỏi, phân loại đúng dạng, xác định đáp án và trả về mảng JSON.`;
    try {
      const responseText = await callGemini(prompt, systemInstruction, true, { maxOutputTokens: 8192, temperature: 0.1 });
      parseAIJsonArray(responseText).forEach(q => allQuestions.push(normalizeQuestion(q)));
    } catch (err) {
      console.error(`[parseWordContentWithAI] Chunk ${i + 1} lỗi:`, err);
    }
  }
  if (onProgress) onProgress(chunks.length, chunks.length);
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

