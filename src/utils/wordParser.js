import mammoth from 'mammoth';
import JSZip from 'jszip';
import { parseWordContentWithAI } from './gemini.js';

// ─────────────────────────────────────────────────────────────
// OOXML COLOR EXTRACTION — đọc trực tiếp XML trong .docx
// để phát hiện đáp án đúng được đánh dấu bằng màu đỏ (EE0000)
// ─────────────────────────────────────────────────────────────
const RED_COLORS = new Set(['ee0000', 'ff0000', 'red']);

/**
 * Đọc raw XML từ ArrayBuffer của file .docx, trả về Set<string>
 * chứa các đoạn text (đã normalize) có font color = đỏ.
 */
async function extractRedTextSet(arrayBuffer) {
  const redSet = new Set();
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docFile = zip.file('word/document.xml');
    if (!docFile) return redSet;
    const docXml = await docFile.async('string');

    // Tách từng paragraph <w:p>...</w:p>
    const paragraphs = docXml.match(/<w:p[\s>].*?<\/w:p>/gs) || [];
    for (const para of paragraphs) {
      // Lấy text thuần từ paragraph
      const runs = para.match(/<w:r[\s>].*?<\/w:r>/gs) || [];
      let fullText = '';
      let hasRed = false;
      let hasNonRedText = false;
      for (const run of runs) {
        const runText = (run.match(/<w:t[^>]*>(.*?)<\/w:t>/gs) || [])
          .map(t => t.replace(/<[^>]+>/g, '')).join('');
        if (!runText) continue;
        fullText += runText;
        // Kiểm tra color trong run properties
        const colorMatch = run.match(/w:color\s+w:val="([^"]+)"/i);
        const color = colorMatch ? colorMatch[1].toLowerCase() : null;
        if (color && RED_COLORS.has(color)) {
          hasRed = true;
        } else if (runText.trim()) {
          hasNonRedText = true;
        }
      }
      // Chỉ đánh dấu red nếu phần lớn text là đỏ (cho phép 1-2 ký tự label)
      if (hasRed && fullText.trim()) {
        redSet.add(normalizeForColorMatch(fullText));
      }
    }
  } catch (e) {
    console.warn('[wordParser] Could not extract color info:', e);
  }
  return redSet;
}

function normalizeForColorMatch(text) {
  // Normalize whitespace + smart quotes/apostrophes
  return text
    .replace(/[\u2018\u2019\u201C\u201D]/g, c => c === '\u2018' || c === '\u2019' ? "'" : '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isRedText(text, redTextSet) {
  if (!redTextSet || redTextSet.size === 0) return false;
  const normalized = normalizeForColorMatch(text);
  if (redTextSet.has(normalized)) return true;
  // Cũng thử match với prefix A./B./C. bỏ đi — chỉ dùng exact match
  const withoutLabel = normalized.replace(/^[a-h][.)\-:]\s*/i, '');
  if (withoutLabel && withoutLabel !== normalized) {
    for (const entry of redTextSet) {
      const entryClean = entry.replace(/^[a-h][.)\-:]\s*/i, '');
      if (entryClean && entryClean === withoutLabel) return true;
    }
  }
  return false;
}

const ALPHABET_RE = /^([A-H])[\.\)\-\:]\s*/i;
const QUESTION_START_RE = /^(Câu|Bài)\s*\d+\s*[:\.\-]/i;
const ANSWER_LINE_RE = /^(=>\s*)?Đáp\s*án\s*[:\.\-]?\s*/i;
const CMD_LINE_RE = /^(Nhập lệnh|Lệnh)\s*[:\.\-]\s*(.+)/i;
const BLANK_RE = /(_{2,}|\.{3,})/; // "___" hoặc "..........."

// ─────────────────────────────────────────────────────────────
// NGOAI NGU 4 — CONSTANTS
// ─────────────────────────────────────────────────────────────
const NN4_BAI_RE     = /^BAI\s+\d+/i;
const NN4_PART_RE    = /^Part\s+(\d+)/i;
const NN4_QUESTION_RE = /^Question\s*[\d]*\s*[:\.\s]/i;
const NN4_VN_QUES_RE = /^C[aâ]u\s+h[oỏỗồ]i\s*[\d]*\s*[:\.]/i;
const NN4_OPT_RE     = /^([A-D])[\.\)]\s+/i;
const NN4_TF_RE      = /^(True|False)$/i;
const NN4_BLANK_RE   = /([.…_]{3,})/;
const VN_CHARS_RE    = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/u;

function isVietnamese(text) {
  return VN_CHARS_RE.test(text);
}

function isNgoaiNgu4Format(text) {
  // Dùng /m flag để ^ match đầu mỗi dòng trong toàn bộ plainText
  const hasQuestion = /^Question\s*\d*\s*[:. ]/im.test(text);
  const hasPart     = /^Part\s+\d/im.test(text);
  return hasQuestion && hasPart;
}


// ─────────────────────────────────────────────────────────────
// NGOAI NGU 4 — EXTRACTION ENGINE (v2)
// Returns { questions: Question[], sections: Section[] }
// ─────────────────────────────────────────────────────────────

// Đoán Part từ dòng hướng dẫn (cho file không có "Part X" header)
function inferPartFromInstruction(text) {
  if (/choose.*best.*english.*translation|best.*translation.*vietnamese/i.test(text)) return 1;
  if (/select.*best.*option|complete.*sentence.*option|best.*option.*complete/i.test(text)) return 2;
  if (/read.*passage.*choose|choose.*correct.*answer.*question|passage.*answer.*question/i.test(text)) return 3;
  if (/fill.*blank.*word.*text|complete.*summary|summary.*blank/i.test(text)) return 4;
  if (/true.*or.*false|decide.*true.*false|statement.*true.*false|true.*false.*information/i.test(text)) return 4;
  if (/complete.*conversation.*word|conversation.*prompt|following.*conversation/i.test(text)) return 5;
  if (/put.*word.*correct.*order|word.*order.*sentence|correct.*order.*make/i.test(text)) return 6;
  return 0;
}

// Phân tích nhiều option A/B/C/D trên cùng 1 dòng
// Ví dụ: "A. option1 B. option2 C. option3"
// Trả về null nếu không phải format inline
function parseInlineOptions(text, lineHtml) {
  const positions = [...text.matchAll(/\b([A-D])[.)]\s+/g)];
  // Cần >= 2 options VÀ option đầu phải ở gần đầu dòng
  if (positions.length < 2 || positions[0].index > 3) return null;

  const holder = document.createElement('div');
  holder.innerHTML = lineHtml;
  // Thu thập text trong <strong>/<b> để detect đáp án đúng
  const boldSnippets = Array.from(holder.querySelectorAll('strong, b'))
    .map(n => n.textContent.trim().toLowerCase());

  const opts = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index + positions[i][0].length;
    const end   = i + 1 < positions.length ? positions[i + 1].index : text.length;
    const optText = text.slice(start, end).trim();
    if (!optText) continue;

    // Kiểm tra xem option này có nằm trong bold không
    const optLower = optText.toLowerCase();
    const isCorrect = boldSnippets.some(b =>
      b.length > 4 && (b.includes(optLower.slice(0, Math.min(20, optLower.length)))
                     || optLower.includes(b.slice(0, Math.min(20, b.length))))
    );
    opts.push({ text: optText, isCorrect, _needsReview: !isCorrect && boldSnippets.length === 0 });
  }
  return opts.length >= 2 ? opts : null;
}

function extractNgoaiNgu4QuestionsFromHtml(htmlString, redTextSet = new Set()) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;

  const questions   = [];
  let currentBai    = 'Bài 1';      // default khi không có BAI marker
  let currentPart   = 0;
  let currentQ      = null;
  let awaitingAns   = false;

  // ── helpers ──────────────────────────────────────────────
  function createQ(rawText, part) {
    const qText = rawText.replace(NN4_QUESTION_RE, '').trim();
    let type = 'single';
    if (part === 4) {
      type = NN4_BLANK_RE.test(qText) || /Summary/i.test(qText) ? 'fill' : 'truefalse';
    } else if (part === 5) {
      type = 'fill';
    } else if (part === 6) {
      type = 'order';
    }
    return { text: qText, part, bai: currentBai, type, options: [], answerLine: '' };
  }

  function pushQ() {
    if (!currentQ) return;
    const q = buildNN4Question(currentQ);
    if (q) questions.push(q);
    currentQ = null;
  }

  function buildNN4Question(q) {
    const base = { question: q.text, image: '', points: 1, _bai: q.bai, _part: q.part };

    if (q.type === 'order') {
      const items = q.text.split('/').map(s => s.trim()).filter(Boolean);
      if (items.length < 2 || !q.answerLine) return null;
      const ans = q.answerLine.toLowerCase();
      const sorted = [...items].sort((a, b) => {
        const pa = ans.indexOf(a.toLowerCase()), pb = ans.indexOf(b.toLowerCase());
        if (pa === -1 && pb === -1) return 0;
        if (pa === -1) return 1; if (pb === -1) return -1;
        return pa - pb;
      });
      return { type: 'order', ...base, items: sorted };
    }

    if (q.type === 'fill') {
      if (!q.answerLine) return null;
      let qText = q.text;
      if (!NN4_BLANK_RE.test(qText)) qText += ' ___';
      return { type: 'fill', ...base, question: qText, answer: q.answerLine, answers: [q.answerLine] };
    }

    if (q.type === 'truefalse') {
      const trueOpt  = q.options.find(o => /^true$/i.test(o.text));
      const falseOpt = q.options.find(o => /^false$/i.test(o.text));
      if (!trueOpt && !falseOpt) return { type: 'truefalse', ...base, correct: false, _needsReview: true };
      const correct = !!(trueOpt?.isCorrect);
      return { type: 'truefalse', ...base, correct };
    }

    // single / multiselect
    if (q.options.length < 2) return null;
    const options      = q.options.map(o => o.text);
    const optionImages = options.map(() => '');
    let correctArr   = q.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
    let needsReview  = correctArr.length === 0 || q.options.some(o => o._needsReview);
    // Nếu không detect được đáp án đúng, default = 0 nhưng flag review
    if (correctArr.length === 0) correctArr = [0];
    if (correctArr.length > 1) {
      return { type: 'multiselect', ...base, options, optionImages, corrects: correctArr, _needsReview: needsReview };
    }
    return { type: 'single', ...base, options, optionImages, correct: correctArr[0] ?? 0, _needsReview: needsReview };
  }

  // ── process each paragraph element ───────────────────────
  for (const el of Array.from(tempDiv.children)) {
    const rawText = el.textContent.trim();
    if (!rawText) continue;

    // Split paragraph into lines (by <br>)
    const linesText = rawText.split('\n').map(s => s.trim()).filter(Boolean);
    const linesHtml = el.innerHTML
      .replace(/<br\s*\/?>/gi, '\n')
      .split('\n');

    for (let li = 0; li < linesText.length; li++) {
      const text     = linesText[li];
      const lineHtml = linesHtml[li] || text;
      // Kiểm tra red color từ OOXML
      const isRed    = isRedText(text, redTextSet);
      const bold     = isWholeLineBold(lineHtml);

      // ── BAI marker ──────────────────────────────────────
      if (NN4_BAI_RE.test(text) && text.length < 30) {
        pushQ();
        currentBai = text.trim();
        currentPart = 0;
        awaitingAns = false;
        continue;
      }

      // ── PART marker (short line) ─────────────────────────
      const partM = text.match(NN4_PART_RE);
      if (partM && text.length < 80) {
        pushQ();
        currentPart = parseInt(partM[1]);
        awaitingAns = false;
        continue;
      }

      // ── Instruction lines (khi không có "Part X" header) ─
      // Vừa skip vừa infer Part từ nội dung hướng dẫn
      if (!currentQ && text.length < 160 && !NN4_QUESTION_RE.test(text)) {
        const inferred = inferPartFromInstruction(text);
        if (inferred > 0) currentPart = inferred;
        continue;
      }

      // ── Vietnamese question line (Câu hỏi N:) → skip ────
      // KHÔNG set awaitingAns ở đây nữa — đã được set khi tạo question
      if (NN4_VN_QUES_RE.test(text)) continue;

      // ── NEW QUESTION ─────────────────────────────────────
      if (NN4_QUESTION_RE.test(text)) {
        pushQ();
        currentQ = createQ(text, currentPart);
        // Set awaitingAns NGAY cho fill/order (không cần chờ "Câu hỏi" line)
        awaitingAns = (currentQ.type === 'fill' || currentQ.type === 'order');
        continue;
      }

      // No open question → skip (passage / intro text)
      if (!currentQ) continue;

      // ── ANSWER line (fill / order) ───────────────────────
      if (awaitingAns) {
        // Bỏ qua dòng tiếng Việt (trừ Part 6 cũng có VN)
        if (isVietnamese(text) && currentQ.part !== 6) continue;
        // Bỏ qua dòng quá ngắn (< 2 từ) — tránh nhầm metadata
        if (text.split(/\s+/).length < 2 && currentQ.type !== 'fill') continue;
        currentQ.answerLine = text;
        awaitingAns = false;
        continue;
      }

      // ── INLINE OPTIONS (A. opt1 B. opt2 C. opt3 trên 1 dòng) ──
      const inlineOpts = parseInlineOptions(text, lineHtml);
      if (inlineOpts) {
        for (const opt of inlineOpts) {
          if (/^(True|False)$/i.test(opt.text)) currentQ.type = 'truefalse';
          currentQ.options.push(opt);
        }
        continue;
      }

      // ── SINGLE OPTION line: A. / B. / C. / D. ───────────
      const optM = text.match(NN4_OPT_RE);
      if (optM) {
        const optText = text.replace(NN4_OPT_RE, '').trim();
        if (/^(True|False)$/i.test(optText)) currentQ.type = 'truefalse';
        currentQ.options.push({ text: optText, isCorrect: bold || isRed });
        continue;
      }

      // ── Standalone True / False ──────────────────────────
      if (NN4_TF_RE.test(text)) {
        currentQ.type = 'truefalse';
        currentQ.options.push({ text, isCorrect: bold || isRed });
        continue;
      }

      // Other: passage / context text — skip Vietnamese, ignore the rest
    }
  }

  pushQ();

  // Build sections map
  const sectionMap = new Map();
  for (const q of questions) {
    const key = `${q._bai}|||${q._part}`;
    if (!sectionMap.has(key)) {
      sectionMap.set(key, {
        key,
        bai: q._bai,
        part: q._part,
        label: `${q._bai} — Part ${q._part}`,
        questions: [],
      });
    }
    sectionMap.get(key).questions.push(q);
  }

  return {
    questions,
    sections: Array.from(sectionMap.values()),
  };
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: analyzeWordFile — used by WordImportModal

// Returns { format, questions, sections }
// ─────────────────────────────────────────────────────────────
export async function analyzeWordFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const arrayBuffer = ev.target.result;
        // Bước 1: Trích xuất thông tin màu đỏ từ raw OOXML
        const redTextSet = await extractRedTextSet(arrayBuffer);
        // Bước 2: Chuyển đổi sang HTML bằng mammoth
        const options = { styleMap: ['highlight => mark', 'b => strong', 'u => u'] };
        const result = await mammoth.convertToHtml({ arrayBuffer }, options);
        const html = result.value;
        // Giữ newline từ block elements để regex ^multiline hoạt động
        const plainText = html
          .replace(/<\/p>|<br\s*\/?>|<\/li>|<\/div>/gi, '\n')
          .replace(/<[^>]+>/g, '');

        if (isNgoaiNgu4Format(plainText)) {
          const { questions, sections } = extractNgoaiNgu4QuestionsFromHtml(html, redTextSet);
          resolve({ format: 'ngoaingu4', questions, sections });
        } else {
          const questions = extractQuestionsFromHtml(html, redTextSet);
          resolve({ format: 'classic', questions, sections: [] });
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: analyzeWordFileWithAI — AI-powered parsing bridge
// Trích xuất text + ảnh bằng mammoth, sau đó gửi cho Gemini AI
// để bóc tách câu hỏi thông minh hơn parser truyền thống.
//
// Returns { format: 'ai', questions, sections: [] }
// ─────────────────────────────────────────────────────────────
export async function analyzeWordFileWithAI(file, onProgress = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const arrayBuffer = ev.target.result;

        // Chuyển đổi sang HTML bằng mammoth (để lấy ảnh base64)
        const mammothOptions = {
          styleMap: ['highlight => mark', 'b => strong', 'u => u'],
          convertImage: mammoth.images.imgElement(async (image) => {
            const base64 = await image.read('base64');
            const src = `data:${image.contentType};base64,${base64}`;
            return { src };
          }),
        };
        const result = await mammoth.convertToHtml({ arrayBuffer }, mammothOptions);
        const html = result.value;

        // Trích xuất plain text (giữ newline block elements)
        const plainText = html
          .replace(/<\/p>|<br\s*\/?>|<\/li>|<\/div>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        console.log('[analyzeWordFileWithAI] plainText length:', plainText.length);
        console.log('[analyzeWordFileWithAI] plainText preview:', plainText.slice(0, 500));

        if (!plainText || plainText.length < 20) {
          resolve({ format: 'ai', questions: [], sections: [] });
          return;
        }

        // Trích xuất map ảnh: { questionPrefix -> base64Src }
        const imageMap = {};
        const imgMatches = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/gi)];
        imgMatches.forEach((m) => {
          const src = m[1];
          const afterImg = html.slice(m.index + m[0].length, m.index + m[0].length + 200)
            .replace(/<[^>]+>/g, '').trim().slice(0, 60).toLowerCase();
          if (afterImg) imageMap[afterImg] = src;
        });

        // Gọi AI bóc tách
        const questions = await parseWordContentWithAI(plainText, imageMap, onProgress);
        console.log('[analyzeWordFileWithAI] AI returned questions:', questions.length);

        resolve({ format: 'ai', questions, sections: [] });
      } catch (err) {
        console.error('[analyzeWordFileWithAI] error:', err);
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}


export async function parseWordFile(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = async function (loadEvent) {
      try {
        let arrayBuffer = loadEvent.target.result;
        // Bước 1: Trích xuất thông tin màu đỏ từ raw OOXML
        const redTextSet = await extractRedTextSet(arrayBuffer);
        // Bước 2: Chuyển đổi sang HTML bằng mammoth
        let options = { styleMap: ['highlight => mark', 'b => strong', 'u => u'] };
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer }, options);
        let parsedQuestions = extractQuestionsFromHtml(result.value, redTextSet);
        resolve(parsedQuestions);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ============================================================
// Tiện ích kiểm tra "đáp án đúng": phải bold (<strong>/<b>) TOÀN BỘ
// nội dung sau nhãn (A./B./C...). KHÔNG tính <mark>/highlight, vì nó
// xuất hiện ở mọi dòng (kể cả đáp án sai) do style mặc định của Word.
// ============================================================
function isWholeLineBold(htmlLine) {
  let holder = document.createElement('div');
  holder.innerHTML = htmlLine;

  let fullText = holder.textContent || '';
  let label = fullText.match(ALPHABET_RE);
  let contentText = label ? fullText.slice(label[0].length) : fullText;
  contentText = contentText.trim();
  if (!contentText) return false; // không có nội dung text để xét bold

  let sawLabel = !!label;
  let labelConsumed = '';
  let allContentBold = true;
  let hasAnyContent = false;

  // CHỈ <strong>/<b> mới được coi là dấu hiệu "đáp án đúng".
  // <mark> (highlight) KHÔNG được tính, vì Word áp style highlight mặc
  // định (thường là "white") lên hầu như mọi dòng văn bản, kể cả các
  // đáp án sai — nếu coi <mark> là bold thì mọi đáp án đều bị nhận
  // nhầm thành đúng (xem: mọi A/B/C/D đều có <mark> nhưng chỉ đáp án
  // đúng mới có thêm <strong> bên trong).
  function isInsideStrong(node) {
    let p = node.parentElement;
    while (p && p !== holder) {
      let tag = p.tagName ? p.tagName.toLowerCase() : '';
      if (tag === 'strong' || tag === 'b') return true;
      p = p.parentElement;
    }
    return false;
  }

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      let t = node.textContent;
      if (!t) return;
      let remaining = t;
      if (sawLabel && labelConsumed.length < label[0].length) {
        let need = label[0].length - labelConsumed.length;
        let consume = remaining.slice(0, need);
        labelConsumed += consume;
        remaining = remaining.slice(need);
      }
      if (remaining.trim()) {
        hasAnyContent = true;
        if (!isInsideStrong(node)) allContentBold = false;
      }
    } else {
      node.childNodes.forEach(walk);
    }
  }
  holder.childNodes.forEach(walk);

  return hasAnyContent && allContentBold;
}

// ============================================================
// Bóc nội dung <img> ra khỏi 1 dòng HTML, trả về { html, imageSrc }
// ============================================================
function splitImageFromHtml(htmlLine) {
  let holder = document.createElement('div');
  holder.innerHTML = htmlLine;
  let img = holder.querySelector('img');
  let imageSrc = '';
  if (img) {
    imageSrc = img.getAttribute('src') || '';
    img.remove();
  }
  return { html: holder.innerHTML, imageSrc };
}

function stripTags(html) {
  let d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').trim();
}

export function extractQuestionsFromHtml(htmlString, redTextSet = new Set()) {
  let tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;
  let parsedQuestions = [];
  let currentQ = null;
  // Đoạn văn ngữ cảnh / hướng dẫn đọc trước khi gặp "Câu X:" tiếp theo.
  // Sẽ được gắn vào đầu nội dung của câu hỏi MỚI (chưa tạo ra).
  let pendingContext = [];

  const MULTISELECT_TAG_RE = /\[?\s*(sinh\s*viên|học\s*sinh|người\s*học)?\s*chọn\s*(\d+)?\s*(phương\s*án|đáp\s*án|câu)\s*(đúng|đúng\s*nhất)?\s*\]?/i;
  const STANDALONE_LETTER_KEY_RE = /^[A-H]$/i;

  function newQuestionFromText(rawText) {
    const cleanHead = stripTags(rawText).replace(QUESTION_START_RE, '').trim();
    return {
      qText: rawText,
      promptSet: cleanHead.length > 0, // true nếu nội dung câu hỏi nằm cùng dòng với "Câu 1:"
      type: 'single',
      image: '',
      options: [],       // { text, image, isCorrect }
      pairs: [],
      groups: [],
      answerLine: '',
      orderRawItems: [],  // các mảnh tách theo "/"
      isOrderCandidate: false,
    };
  }

  function buildOrderQuestion(baseObj, currentQRef) {
    let rawItems = currentQRef.orderRawItems.map(s => s.trim()).filter(s => s !== '');
    let answerSentence = currentQRef.answerLine.trim();
    if (rawItems.length < 2 || !answerSentence) return null;

    let normalizedAnswer = answerSentence.toLowerCase();
    let ordered = rawItems
      .map(item => ({ item, pos: normalizedAnswer.indexOf(item.toLowerCase()) }))
      .sort((a, b) => {
        if (a.pos === -1 && b.pos === -1) return 0;
        if (a.pos === -1) return 1;
        if (b.pos === -1) return -1;
        return a.pos - b.pos;
      })
      .map(x => x.item);

    return { type: 'order', ...baseObj, items: ordered };
  }

  function pushCurrentQuestion() {
    if (!currentQ) return;

    let cleanQText = stripTags(currentQ.qText);
    let baseObj = { question: cleanQText, image: currentQ.image, points: 1 };

    // 1) Câu dạng "sắp xếp từ" (order)
    if (currentQ.isOrderCandidate && currentQ.orderRawItems.length >= 2 && currentQ.answerLine) {
      let orderQ = buildOrderQuestion(baseObj, currentQ);
      if (orderQ) {
        parsedQuestions.push(orderQ);
        currentQ = null;
        return;
      }
    }

    if (currentQ.pairs.length >= 2) {
      parsedQuestions.push({ type: 'drag', ...baseObj, pairs: currentQ.pairs });
    }
    else if (currentQ.groups.length >= 2) {
      parsedQuestions.push({ type: 'groupdrag', ...baseObj, groups: currentQ.groups });
    }
    else if (currentQ.type === 'fill' && currentQ.answerLine !== '') {
      let q = cleanQText;
      if (!BLANK_RE.test(q) && !q.includes('___')) q += ' ___';
      parsedQuestions.push({ type: 'fill', ...baseObj, question: q, answer: currentQ.answerLine });
    }
    else if (currentQ.options.length >= 2) {
      let cleanOptions = currentQ.options.map(o => stripTags(o.text).replace(ALPHABET_RE, '').trim());
      let optionImages = currentQ.options.map(o => o.image || '');
      let correctArr = [];
      currentQ.options.forEach((o, idx) => { if (o.isCorrect) correctArr.push(idx); });

      if (correctArr.length === 0 && currentQ.answerLine !== '') {
        const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        let letters = currentQ.answerLine.toUpperCase().match(/[A-H]/g) || [];
        letters.forEach(l => {
          let idx = alphabet.indexOf(l);
          if (idx !== -1 && !correctArr.includes(idx)) correctArr.push(idx);
        });
      }

      let needsReview = correctArr.length === 0;
      if (correctArr.length === 0) correctArr = [0];

      const isMultiSelectHint = MULTISELECT_TAG_RE.test(cleanQText);
      let baseWithImages = { ...baseObj, options: cleanOptions, optionImages };
      if (correctArr.length > 1 || isMultiSelectHint) {
        parsedQuestions.push({ type: 'multiselect', ...baseWithImages, corrects: correctArr, _needsReview: needsReview });
      } else {
        parsedQuestions.push({ type: 'single', ...baseWithImages, correct: correctArr[0], _needsReview: needsReview });
      }
    }
    currentQ = null;
  }

  let elements = Array.from(tempDiv.children);

  for (let el of elements) {
    let tagName = el.tagName.toUpperCase();
    let rawText = el.textContent.trim();

    // ---- Bắt đầu một câu hỏi mới ----
    if (rawText.match(QUESTION_START_RE)) {
      pushCurrentQuestion();
      currentQ = newQuestionFromText(rawText);
      if (pendingContext.length > 0) {
        currentQ.qText = pendingContext.join('\n') + '\n' + currentQ.qText;
        pendingContext = [];
      }
      let slashCount = (rawText.match(/\//g) || []).length;
      if (slashCount >= 2) currentQ.isOrderCandidate = true;
      continue;
    }

    // ---- Chưa có câu hỏi nào đang mở -> đây là context / hướng dẫn ----
    if (!currentQ) {
      if (rawText) pendingContext.push(rawText);
      continue;
    }

    let imgs = el.querySelectorAll('img');
    let isOptionLine = rawText.match(ALPHABET_RE);
    let isAnswerLine = rawText.match(ANSWER_LINE_RE);

    // Ảnh minh hoạ đề bài: xuất hiện ở 1 dòng KHÔNG phải option/đáp án,
    // và câu hỏi này chưa có ảnh đề bài, chưa có option nào được thêm.
    if (imgs.length > 0 && !isOptionLine && !isAnswerLine && !currentQ.image && currentQ.options.length === 0) {
      currentQ.image = imgs[0].getAttribute('src') || imgs[0].src || '';
      if (!rawText) continue;
    }

    // ---- Bảng (drag / groupdrag) ----
    if (tagName === 'TABLE') {
      let rows = el.querySelectorAll('tr');
      if (rows.length === 0) continue;
      let colCount = rows[0].querySelectorAll('td, th').length;
      if (colCount >= 3) continue;

      if (rows.length === 2) {
        currentQ.type = 'groupdrag';
        let tempGroups = [];
        rows[0].querySelectorAll('td, th').forEach(cell => tempGroups.push({ name: cell.textContent.trim(), items: [] }));

        rows[1].querySelectorAll('td, th').forEach((cell, colIndex) => {
          if (colIndex < tempGroups.length) {
            let cloneCell = cell.cloneNode(true);
            cloneCell.querySelectorAll('br, p').forEach(t => t.replaceWith('\n' + t.textContent));
            let items = cloneCell.textContent.split('\n').map(s => s.trim()).filter(s => s !== '');
            tempGroups[colIndex].items.push(...items);
          }
        });
        if (tempGroups.some(g => g.items.length > 0)) currentQ.groups = tempGroups;
      }
      else if (colCount === 2 && rows.length > 2) {
        currentQ.type = 'drag';
        rows.forEach((row, index) => {
          let cells = row.querySelectorAll('td, th');
          if (cells.length === 2) {
            let leftText = cells[0].textContent.replace(/<[^>]+>/g, '').trim();
            let rightText = cells[1].textContent.replace(/<[^>]+>/g, '').trim();
            let isHeader = (index === 0 && row.querySelector('mark, strong') === null && row.querySelector('th') !== null);
            if (leftText && rightText && !isHeader) currentQ.pairs.push({ left: leftText, right: rightText });
          }
        });
      }
      continue;
    }

    // ---- Danh sách (OL/UL) dùng làm đáp án ----
    if (tagName === 'OL' || tagName === 'UL') {
      currentQ.promptSet = true;
      el.querySelectorAll('li').forEach((li) => {
        let optText = li.textContent.trim();
        let liImg = li.querySelector('img');
        let imageSrc = liImg ? (liImg.getAttribute('src') || liImg.src || '') : '';
        if (!optText && !imageSrc) return;
        let isCorrect = isWholeLineBold(li.innerHTML) || isRedText(optText, redTextSet);
        currentQ.options.push({ text: optText, image: imageSrc, isCorrect });
      });
      continue;
    }

    // ---- Các dòng văn bản thường (paragraph) ----
    let clone = el.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    let linesHTML = el.innerHTML.replace(/<br\s*\/?>/ig, '\n').replace(/<\/p>\s*<p[^>]*>/ig, '\n').split('\n');
    let linesText = clone.textContent.trim().split('\n').map(l => l.trim()).filter(l => l !== '');

    for (let i = 0; i < linesText.length; i++) {
      let textLine = linesText[i];
      let htmlLine = linesHTML[i] || textLine;

      let cmdMatch = textLine.match(CMD_LINE_RE);
      if (cmdMatch) {
        currentQ.type = 'fill';
        let markTag = htmlLine.match(/<(mark|strong|b)[^>]*>(.*?)<\/\1>/i);
        currentQ.answerLine = markTag ? stripTags(markTag[2]) : cmdMatch[2].trim();
      }
      else if (textLine.match(ANSWER_LINE_RE)) {
        let answerText = textLine.replace(ANSWER_LINE_RE, '').trim();
        currentQ.answerLine = answerText;
        if (currentQ.isOrderCandidate) {
          let qBody = currentQ.qText.replace(QUESTION_START_RE, '');
          let lastLine = qBody.split('\n').pop();
          currentQ.orderRawItems = lastLine.split('/');
        }
        if (currentQ.options.length === 0 && !currentQ.isOrderCandidate) {
          let qPlain = stripTags(currentQ.qText);
          if (BLANK_RE.test(qPlain)) currentQ.type = 'fill';
        }
      }
      else if (textLine.match(ALPHABET_RE) || /<img/i.test(htmlLine)) {
        currentQ.promptSet = true;
        let { html: htmlNoImg, imageSrc } = splitImageFromHtml(htmlLine);
        let optTextClean = stripTags(htmlNoImg).replace(ALPHABET_RE, '').trim();
        let isCorrect = isWholeLineBold(htmlLine) || isRedText(textLine, redTextSet);
        currentQ.options.push({ text: optTextClean, image: imageSrc, isCorrect });
      }
      // Đáp án là 1 ký tự A, B, C, D nằm đơn lẻ ở 1 dòng (Answer Key)
      else if (STANDALONE_LETTER_KEY_RE.test(textLine) && currentQ.options.length > 0) {
        const letterIdx = 'ABCDEFGH'.indexOf(textLine.toUpperCase());
        if (letterIdx !== -1 && currentQ.options[letterIdx]) {
          currentQ.options[letterIdx].isCorrect = true;
        }
      }
      else if (textLine.includes('/') && (textLine.match(/\//g) || []).length >= 2 && !textLine.match(QUESTION_START_RE)) {
        currentQ.qText += '\n' + textLine;
        currentQ.isOrderCandidate = true;
      }
      else if (textLine.includes('==') && !textLine.match(/^Câu/i)) {
        currentQ.type = 'drag';
        let p = textLine.split('==');
        if (p.length === 2) currentQ.pairs.push({ left: p[0].trim(), right: p[1].trim() });
      }
      else {
        // Dòng văn bản không có nhãn A./B./C./D.
        if (!currentQ.promptSet) {
          // Chưa có đề bài -> Dòng này nối tiếp vào đề bài
          currentQ.qText += '\n' + textLine;
          currentQ.promptSet = true;
        } else {
          // Đã có đề bài -> Dòng này là 1 PHƯƠNG ÁN LỰA CHỌN (Option) không nhãn!
          let { html: htmlNoImg, imageSrc } = splitImageFromHtml(htmlLine);
          let isCorrect = isWholeLineBold(htmlLine) || isRedText(textLine, redTextSet);
          currentQ.options.push({ text: textLine, image: imageSrc, isCorrect });
        }
      }
    }
  }

  pushCurrentQuestion();
  return parsedQuestions;
}
