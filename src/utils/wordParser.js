import mammoth from 'mammoth';

const ALPHABET_RE = /^([A-H])[\.\)\-\:]\s*/i;
const QUESTION_START_RE = /^(Câu|Bài)\s*\d+\s*[:\.\-]/i;
const ANSWER_LINE_RE = /^(=>\s*)?Đáp\s*án\s*[:\.\-]?\s*/i;
const CMD_LINE_RE = /^(Nhập lệnh|Lệnh)\s*[:\.\-]\s*(.+)/i;
const BLANK_RE = /(_{2,}|\.{3,})/; // "___" hoặc "..........."

export async function parseWordFile(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = function (loadEvent) {
      let arrayBuffer = loadEvent.target.result;
      let options = { styleMap: ['highlight => mark', 'b => strong', 'u => u'] };

      mammoth.convertToHtml({ arrayBuffer: arrayBuffer }, options)
        .then(result => {
          let parsedQuestions = extractQuestionsFromHtml(result.value);
          resolve(parsedQuestions);
        })
        .catch(err => reject(err));
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

export function extractQuestionsFromHtml(htmlString) {
  let tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;
  let parsedQuestions = [];
  let currentQ = null;
  // Đoạn văn ngữ cảnh / hướng dẫn đọc trước khi gặp "Câu X:" tiếp theo.
  // Sẽ được gắn vào đầu nội dung của câu hỏi MỚI (chưa tạo ra).
  let pendingContext = [];

  function newQuestionFromText(rawText) {
    return {
      qText: rawText,
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

    // 1) Câu dạng "sắp xếp từ" (order) — kiểm tra trước vì cú pháp
    //    "a / b / c" có thể bị nhánh khác bắt nhầm.
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

      // Nếu vẫn chưa xác định được đáp án đúng (ví dụ các đáp án chỉ có
      // ảnh, không có cách nào đánh dấu) -> để mặc định đáp án đầu tiên,
      // giáo viên tự chỉnh lại trong giao diện sau khi nhập.
      if (correctArr.length === 0) correctArr = [0];

      let baseWithImages = { ...baseObj, options: cleanOptions, optionImages };
      if (correctArr.length > 1) {
        parsedQuestions.push({ type: 'multiselect', ...baseWithImages, corrects: correctArr });
      } else {
        parsedQuestions.push({ type: 'single', ...baseWithImages, correct: correctArr[0] });
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
      el.querySelectorAll('li').forEach((li) => {
        let optText = li.textContent.trim();
        let liImg = li.querySelector('img');
        let imageSrc = liImg ? (liImg.getAttribute('src') || liImg.src || '') : '';
        if (!optText && !imageSrc) return;
        let isCorrect = isWholeLineBold(li.innerHTML);
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
        let { html: htmlNoImg, imageSrc } = splitImageFromHtml(htmlLine);
        let optTextClean = stripTags(htmlNoImg).replace(ALPHABET_RE, '').trim();
        let isCorrect = isWholeLineBold(htmlLine);
        currentQ.options.push({ text: optTextClean, image: imageSrc, isCorrect });
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
        // Câu hỏi hiện tại đã "đủ điều kiện" để kết luận (đã có >=2 đáp án,
        // hoặc >=2 pairs/groups, hoặc đã có đáp án fill) -> dòng lạ tiếp
        // theo (hướng dẫn đọc, tiêu đề đoạn văn, nội dung đoạn văn...)
        // thuộc về CÂU HỎI KẾ TIẾP, không phải nối vào câu đang xét.
        let isAlreadyComplete = currentQ.options.length >= 2 ||
          currentQ.pairs.length >= 2 ||
          currentQ.groups.length >= 2 ||
          (currentQ.type === 'fill' && currentQ.answerLine !== '');

        if (isAlreadyComplete) {
          pendingContext.push(textLine);
        } else {
          currentQ.qText += '\n' + textLine;
        }
      }
    }
  }

  pushCurrentQuestion();
  return parsedQuestions;
}
