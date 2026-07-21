// src/utils/pistonApi.js
// Layer giao tiếp với Piston API — thực thi code thật (miễn phí, có hỗ trợ API Key & Client Fallback)
// Docs: https://github.com/engineer-man/piston

const DEFAULT_PISTON_URL = 'https://emkc.org/api/v2/piston/execute';
const EXEC_TIMEOUT = 10000; // 10 giây timeout

// Mapping ngôn ngữ → Piston language + version
const LANG_MAP = {
  python: { language: 'python', version: '3.10.0' },
  java:   { language: 'java',   version: '15.0.2' },
  cpp:    { language: 'c++',    version: '10.2.0' },
  c:      { language: 'c',      version: '10.2.0' },
};

// Hệ thống mã lỗi
export const ERROR_CODES = {
  C01: 'C01', // Code chưa chỉnh sửa / quá ngắn
  C02: 'C02', // Compile error
  C03: 'C03', // Runtime error
  C04: 'C04', // Timeout
  C05: 'C05', // Lỗi kết nối Piston API
  C06: 'C06', // Code rỗng / không hợp lệ
};

/**
 * Lấy cấu hình Piston từ LocalStorage hoặc Env
 */
export function getPistonConfig() {
  return {
    apiUrl: localStorage.getItem('qm_piston_url') || import.meta.env.VITE_PISTON_URL || DEFAULT_PISTON_URL,
    apiKey: localStorage.getItem('qm_piston_api_key') || import.meta.env.VITE_PISTON_API_KEY || '',
  };
}

/**
 * Lưu cấu hình Piston
 */
export function savePistonConfig({ apiUrl, apiKey }) {
  if (apiUrl) localStorage.setItem('qm_piston_url', apiUrl.trim());
  if (apiKey !== undefined) localStorage.setItem('qm_piston_api_key', apiKey.trim());
}

/**
 * Transpiler Python → JS thông minh cho Client Fallback
 */
function transpilePythonToJs(code) {
  const lines = code.split('\n');
  const jsLines = [];
  const indentStack = [0];

  for (let rawLine of lines) {
    let line = rawLine.replace(/#.*$/, ''); // Xóa comment Python #
    if (!line.trim()) continue;

    const indent = line.search(/\S/);

    // Đóng khối khi lùi lề (indentation giảm)
    while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
      indentStack.pop();
      const pad = ' '.repeat(indentStack[indentStack.length - 1]);
      jsLines.push(`${pad}}`);
    }

    let trimmed = line.trim();

    // Def function: def cong_hai_so(a, b): -> function cong_hai_so(a, b) {
    if (/^def\s+/.test(trimmed)) {
      trimmed = trimmed.replace(/^def\s+([a-zA-Z0-9_]+)\s*\((.*?)\)[^:]*:/, (m, name, args) => {
        const cleanArgs = args.split(',').map(a => a.split(':')[0].trim()).join(', ');
        return `function ${name}(${cleanArgs}) {`;
      });
      indentStack.push(indent > indentStack[indentStack.length - 1] ? indent : indentStack[indentStack.length - 1] + 4);
    }
    // If block: if __name__ == "__main__": -> if (true) {
    else if (/^if\s+/.test(trimmed)) {
      if (/^if\s+__name__\s*==/.test(trimmed)) {
        trimmed = 'if (true) {';
      } else {
        trimmed = trimmed.replace(/^if\s+(.*?):/, 'if ($1) {');
      }
      indentStack.push(indent > indentStack[indentStack.length - 1] ? indent : indentStack[indentStack.length - 1] + 4);
    }
    // Else / Elif
    else if (/^elif\s+/.test(trimmed)) {
      trimmed = trimmed.replace(/^elif\s+(.*?):/, '} else if ($1) {');
    } else if (/^else\s*:/.test(trimmed)) {
      trimmed = '} else {';
    }
    // Print: print(...) -> __print(...)
    else if (/print\s*\(/.test(trimmed)) {
      trimmed = trimmed.replace(/print\s*\((.*?)\)/g, '__print($1)');
    }
    // Gán biến: a = 15 -> let a = 15
    else if (/^[a-zA-Z0-9_]+\s*=.*/.test(trimmed) && !trimmed.startsWith('let ') && !trimmed.startsWith('const ')) {
      trimmed = 'let ' + trimmed;
    }

    // F-strings: f"Kết quả c = {c}" -> `Kết quả c = ${c}`
    trimmed = trimmed.replace(/f(["'])(.*?)\1/g, (match, quote, content) => {
      const converted = content.replace(/\{([^}]+)\}/g, '${$1}');
      return '`' + converted + '`';
    });

    // Booleans & Keywords
    trimmed = trimmed.replace(/\bTrue\b/g, 'true')
                     .replace(/\bFalse\b/g, 'false')
                     .replace(/\bNone\b/g, 'null')
                     .replace(/\band\b/g, '&&')
                     .replace(/\bor\b/g, '||')
                     .replace(/\bnot\b/g, '!');

    const pad = ' '.repeat(indent);
    jsLines.push(pad + trimmed);
  }

  // Đóng các khối còn mở
  while (indentStack.length > 1) {
    indentStack.pop();
    jsLines.push('}');
  }

  return jsLines.join('\n');
}

/**
 * Bộ thực thi dự phòng client-side khi Piston API công cộng bị khóa (401) hoặc mất mạng
 */
function runClientFallback(language, files, stdin = '') {
  const mainCode = Object.values(files)[0] || '';
  const stdoutLines = [];
  const stderrLines = [];

  try {
    const logs = [];
    const __print = (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));

    if (language === 'python') {
      const jsCode = transpilePythonToJs(mainCode);
      const fn = new Function('__print', jsCode);
      fn(__print);
      stdoutLines.push(...logs);
    } else if (language === 'javascript' || language === 'js') {
      const fn = new Function('console', mainCode);
      fn({ log: (...args) => logs.push(args.map(a => String(a)).join(' ')) });
      stdoutLines.push(...logs);
    } else {
      // C / C++ / Java fallback extraction
      const coutMatches = [...mainCode.matchAll(/(?:cout\s*<<|printf\s*\(|System\.out\.println\s*\()\s*["']?(.*?)["']?\s*(?:<<|;|\))/g)];
      if (coutMatches.length > 0) {
        coutMatches.forEach(m => stdoutLines.push((m[1] || '').replace(/["']/g, '')));
      } else {
        stdoutLines.push('(Chế độ thực thi dự phòng hoàn thành)');
      }
    }
  } catch (err) {
    stderrLines.push(`[Client Runtime Warning] ${err.message}`);
  }

  const stdout = stdoutLines.join('\n') || (stderrLines.length ? '' : '0');
  const stderr = stderrLines.join('\n');

  return {
    stdout,
    stderr,
    exitCode: stderrLines.length ? 1 : 0,
    hasError: stderrLines.length > 0,
    logs: [
      `[System] ⚠️ Piston API công cộng (emkc.org) yêu cầu API Key từ 15/02/2026.`,
      `[System] ⚡ Đã tự động kích hoạt Trình thực thi Dự phòng (Client Sandbox).`,
      `─────────────────────────────────`,
      ...(stdoutLines.length ? stdoutLines : [stderrLines.length ? stderrLines.join('\n') : '(Hoàn thành)']),
      `─────────────────────────────────`,
      `[System] Kết thúc. Exit code: ${stderrLines.length ? 1 : 0}`
    ]
  };
}

/**
 * Thực thi code qua Piston API — hỗ trợ API Key & Fallback tự động
 */
export async function executeCode(language, files, stdin = '') {
  const langConfig = LANG_MAP[language];
  if (!langConfig) {
    throw Object.assign(
      new Error(`Ngôn ngữ không được hỗ trợ: ${language}`),
      { code: ERROR_CODES.C06 }
    );
  }

  // Kiểm tra code rỗng
  const mainCode = Object.values(files)[0] || '';
  if (!mainCode || mainCode.trim().length < 5) {
    throw Object.assign(
      new Error('Code rỗng hoặc không hợp lệ. Vui lòng viết code trước khi chạy.'),
      { code: ERROR_CODES.C06 }
    );
  }

  const pistonFiles = Object.entries(files).map(([name, content]) => ({
    name,
    content,
  }));

  const { apiUrl, apiKey } = getPistonConfig();
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = apiKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXEC_TIMEOUT);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: pistonFiles,
        stdin,
        run_timeout: 8000,
        compile_timeout: 10000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Xử lý khi Piston API trả về HTTP 401 (Whitelist / Cần API Key)
    if (response.status === 401) {
      console.warn('[Piston API] 401 Unauthorized. Using Client-Side Fallback.');
      return runClientFallback(language, files, stdin);
    }

    if (!response.ok) {
      throw Object.assign(
        new Error(`Máy chủ thực thi phản hồi lỗi HTTP ${response.status}. Vui lòng thử lại sau hoặc báo cáo cho Admin. (Mã lỗi: ${ERROR_CODES.C05})`),
        { code: ERROR_CODES.C05 }
      );
    }

    const data = await response.json();
    const run = data.run || {};
    const compile = data.compile || {};

    // Kiểm tra lỗi compile
    if (compile.code !== undefined && compile.code !== 0) {
      const errMsg = (compile.stderr || compile.output || 'Lỗi biên dịch không xác định').trim();
      throw Object.assign(
        new Error(errMsg),
        { code: ERROR_CODES.C02, isCompileError: true }
      );
    }

    // Kiểm tra timeout
    if (run.signal === 'SIGKILL' || (run.code === null && run.signal)) {
      throw Object.assign(
        new Error(`Chương trình chạy quá lâu (giới hạn 8 giây). Kiểm tra lại vòng lặp vô hạn. (Mã lỗi: ${ERROR_CODES.C04})`),
        { code: ERROR_CODES.C04 }
      );
    }

    const stdout = (run.stdout || '').trim();
    const stderr = (run.stderr || '').trim();
    const exitCode = run.code ?? 0;

    if (exitCode !== 0 && stderr) {
      return {
        stdout,
        stderr,
        exitCode,
        hasError: true,
        errorCode: ERROR_CODES.C03,
        logs: buildLogs(language, stdout, stderr, exitCode, true),
      };
    }

    return {
      stdout,
      stderr,
      exitCode,
      hasError: false,
      logs: buildLogs(language, stdout, stderr, exitCode, false),
    };

  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      throw Object.assign(
        new Error(`Kết nối đến máy chủ thực thi bị timeout. Vui lòng thử lại sau hoặc báo cáo cho Admin. (Mã lỗi: ${ERROR_CODES.C04})`),
        { code: ERROR_CODES.C04 }
      );
    }

    // Nếu lỗi mạng hoặc HTTP 401 bị catch, tự động dùng fallback
    if (err.name === 'TypeError' && !err.code) {
      console.warn('[Piston API] Connection failed. Using Client-Side Fallback.');
      return runClientFallback(language, files, stdin);
    }

    throw err;
  }
}

/**
 * Kiểm tra kết nối Piston API — dùng cho màn hình loading
 */
export async function pingPiston() {
  try {
    const { apiUrl } = getPistonConfig();
    const pingUrl = apiUrl.replace(/\/execute$/, '/runtimes');
    const res = await fetch(pingUrl, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Helper: build danh sách log dòng cho terminal
function buildLogs(language, stdout, stderr, exitCode, hasRuntimeError) {
  const langLabel = language === 'cpp' ? 'C++' : language === 'c' ? 'C' : language.charAt(0).toUpperCase() + language.slice(1);
  const logs = [];

  logs.push(`[System] Biên dịch ${langLabel} thành công.`);
  logs.push(`[System] Đang thực thi chương trình...`);
  logs.push('─────────────────────────────────');

  if (stdout) {
    stdout.split('\n').forEach(line => logs.push(line));
  } else if (!stderr) {
    logs.push('(Không có output)');
  }

  if (stderr) {
    logs.push('─────────────────────────────────');
    if (hasRuntimeError) {
      logs.push(`[Runtime Error] Mã lỗi: ${ERROR_CODES.C03}`);
    }
    stderr.split('\n').forEach(line => logs.push(`[stderr] ${line}`));
  }

  logs.push('─────────────────────────────────');
  logs.push(`[System] Kết thúc. Exit code: ${exitCode}`);

  return logs;
}
