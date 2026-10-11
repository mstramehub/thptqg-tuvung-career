/**
 * ============================================================================
 * Teacher Vocab Studio - Logic Controller
 * Ms Trâm English Hub
 * ============================================================================
 * Bộ chuyển đổi thông minh bảng Google Sheets / Excel thành dữ liệu Markdown/JS.
 * Hỗ trợ nhận diện cột tự động (Fuzzy Auto-detection) & Ánh xạ cột linh hoạt.
 */

(function () {
  'use strict';

  // Dữ liệu mẫu từ ảnh Google Sheets của cô Trâm để kiểm thử 1 chạm
  const SAMPLE_SHEETS_DATA = `ENGLISH MASTER 2027 - READING COMPREHENSION - PEOPLE AND PERSONAL LIFE - TEST 01 - BẢNG TỪ VỰNG CHI TIẾT B2-C1
No.\tWords\tIPA\tPoS\tDetailed English Meaning\tSynonyms B1-B2\tVietnamese Meaning
1\ttech industry\t/tek ˈɪndəstri/\tn.\tthe area of business concerned with developing, producing, and selling technological products and services\ttechnology sector, IT business\tngành công nghệ
2\tbe enamored with\t/ɪˈnæmərd wɪð/\tadj. phrase\tto admire or be strongly interested in someone or something\tbe fascinated by, be attracted to, admire\tsay mê, mê mẩn
3\tarchetype\t/ˈɑːrkɪtaɪp/\tn.\ta person or thing that is considered a perfect or typical example of a particular type\tmodel, typical example, perfect example\thình mẫu điển hình
4\tcollege dropout\t/ˈkɑːlɪdʒ ˈdrɑːpaʊt/\tn.\ta person who leaves college or university before completing their course or degree\tuniversity leaver, former student\tngười bỏ học đại học
5\tfounder\t/ˈfaʊndər/\tn.\ta person who starts or establishes a company, organization, or institution\tcreator, starter, organizer\tngười sáng lập
6\tfit the mold\t/fɪt ðə moʊld/\tv. phrase\tto match a familiar or expected type of person or pattern\tfit the pattern, match the type, conform\tphù hợp với khuôn mẫu
7\ttrajectory\t/trəˈdʒektəri/\tn.\tthe direction in which a person's career, development, or progress moves over time\tpath, direction, course\tquỹ đạo, hướng phát triển
8\tstark contrast\t/stɑːrk ˈkɑːntræst/\tn.\ta very clear and noticeable difference between two people, things, or situations\tclear difference, sharp contrast, big difference\tsự tương phản rõ rệt
9\tdistinguish\t/dɪˈstɪŋɡwɪʃ/\tv.\tto make someone or something different from or more noticeable than others\tdifferentiate, separate, identify\tphân biệt; làm nổi bật
10\tnet worth\t/ˌnet ˈwɜːrθ/\tn.\tthe total value of everything a person or company owns after subtracting all debts\ttotal wealth, financial value, fortune\tgiá trị tài sản ròng
11\trelentless\t/rɪˈlentləs/\tadj.\tcontinuing for a long time with strong determination and without stopping\tpersistent, determined, tireless\tkhông ngừng nghỉ, bền bỉ
12\tpursuit\t/pərˈsuːt/\tn.\tthe act of trying continuously to achieve or obtain something\teffort, search, attempt\tsự theo đuổi
13\tsustainable manufacturing\t/səˈsteɪnəbl ˌmænjuˈfæktʃərɪŋ/\tn.\tthe production of goods in ways that reduce environmental damage and preserve resources\tgreen production, eco-friendly production\tsản xuất bền vững
14\tdominated by\t/ˈdɑːmɪneɪtɪd baɪ/\tadj. phrase\tmainly controlled or strongly influenced by a particular person, force, or trend\tcontrolled by, influenced by, ruled by\tbị chi phối bởi
15\trapid consumption\t/ˈræpɪd kənˈsʌmpʃn/\tn.\tthe fast purchase, use, and disposal of products or resources\tfast consumption, quick use, heavy consumption\ttiêu dùng nhanh
16\tskeptical\t/ˈskeptɪkl/\tadj.\thaving doubts about whether something is true, useful, or likely to succeed\tdoubtful, unsure, unconvinced\thoài nghi
17\tvision\t/ˈvɪʒn/\tn.\ta clear idea of what someone wants to achieve or what the future should be like\tgoal, idea, plan, ambition\ttầm nhìn
18\tprofoundly\t/prəˈfaʊndli/\tadv.\tto a very great or serious degree\tdeeply, greatly, extremely\tsâu sắc, vô cùng
19\tnascent\t/ˈnæsnt/\tadj.\trecently formed and only beginning to develop\tnew, emerging, developing\tmới hình thành, non trẻ
20\tbarrage\t/bəˈrɑːʒ/\tn.\ta large number of questions, criticisms, or attacks arriving continuously\tflood, series, stream\thàng loạt, dồn dập`;

  const $ = id => document.getElementById(id);

  // Danh sách các trường mục tiêu hỗ trợ
  const FIELD_OPTIONS = [
    { id: 'skip', name: '— Bỏ qua cột này —' },
    { id: 'word', name: 'Từ vựng (Word) *' },
    { id: 'ipa', name: 'Phiên âm (IPA)' },
    { id: 'pos', name: 'Từ loại (PoS)' },
    { id: 'vi', name: 'Nghĩa tiếng Việt *' },
    { id: 'def', name: 'Định nghĩa / Nghĩa Anh' },
    { id: 'syn', name: 'Từ đồng nghĩa (Synonyms)' },
    { id: 'ant', name: 'Từ trái nghĩa (Antonyms)' },
    { id: 'passage', name: 'Số bài đọc (1, 2, 3...)' },
    { id: 'example', name: 'Câu ví dụ (Example)' },
    { id: 'form', name: 'Dạng chia đúng (Form)' }
  ];

  let parsedRawRows = [];
  let detectedHeaders = [];
  let columnMappings = [];
  let generatedData = null;

  /**
   * Phát hiện dấu phân cách cột (Tab hoặc Phẩy/Chấm phẩy)
   */
  function splitRow(line) {
    if (line.includes('\t')) return line.split('\t').map(c => c.trim());
    if (line.includes('|')) {
      const parts = line.split('|').map(c => c.trim());
      if (parts[0] === '') parts.shift();
      if (parts[parts.length - 1] === '') parts.pop();
      return parts;
    }
    // Fallback: CSV
    return line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  }

  /**
   * Thuật toán Heuristic đoán loại trường cho một cột
   */
  function guessColumnField(headerText, sampleValues) {
    const h = (headerText || '').toLowerCase().trim();

    // 1. Dựa vào tên tiêu đề nếu có
    if (h.includes('word') || h === 'từ' || h === 'từ vựng' || h === 'vocab') return 'word';
    if (h.includes('ipa') || h.includes('phiên âm') || h.includes('pronunciation')) return 'ipa';
    if (h === 'pos' || h.includes('part of speech') || h.includes('từ loại') || h === 'loại') return 'pos';
    if (h.includes('vietnamese') || h.includes('tiếng việt') || (h.includes('nghĩa') && !h.includes('anh') && !h.includes('english'))) return 'vi';
    if (h.includes('english meaning') || h.includes('definition') || h.includes('định nghĩa') || h.includes('detailed')) return 'def';
    if (h.includes('synonym') || h.includes('đồng nghĩa') || h === 'syn') return 'syn';
    if (h.includes('antonym') || h.includes('trái nghĩa') || h === 'ant') return 'ant';
    if (h.includes('passage') || h.includes('bài đọc') || h === 'bài') return 'passage';
    if (h.includes('example') || h.includes('ví dụ') || h.includes('câu')) return 'example';
    if (h === 'form' || h.includes('dạng')) return 'form';
    if (h === 'no.' || h === 'stt' || h === 'no' || h === '#') return 'skip';

    // 2. Dựa vào nội dung mẫu nếu không có tiêu đề rõ ràng
    const samples = sampleValues.filter(Boolean);
    if (!samples.length) return 'skip';

    // Nếu chứa /.../ -> IPA
    if (samples.some(s => /^\/.*\/$/.test(s) || s.startsWith('/') || s.includes('ˈ') || s.includes('ˌ'))) return 'ipa';

    // Nếu là từ loại n., v., adj., adv., phr v
    if (samples.every(s => /^(n|v|adj|adv|prep|conj|phr)(\.|\b)/i.test(s) || s.toLowerCase().includes('phrase'))) return 'pos';

    // Nếu chứa tiếng Việt có dấu -> Nghĩa Việt
    const vnPattern = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
    if (samples.some(s => vnPattern.test(s))) return 'vi';

    // Nếu toàn số nguyên liên tiếp -> STT / Bỏ qua
    if (samples.every(s => /^\d+$/.test(s))) return 'skip';

    // Nếu là chuỗi tiếng Anh có nhiều từ ngăn cách bằng dấu phẩy -> Từ đồng nghĩa
    if (samples.some(s => s.includes(',') && !vnPattern.test(s))) return 'syn';

    // Nếu là câu dài tiếng Anh -> Định nghĩa hoặc ví dụ
    if (samples.some(s => s.length > 40 && !vnPattern.test(s))) return 'def';

    // Nếu là từ/cụm từ tiếng Anh ngắn không dấu -> Word
    if (samples.every(s => s.length < 35 && !vnPattern.test(s))) return 'word';

    return 'skip';
  }

  /**
   * Phân tích văn bản dán vào
   */
  function parseInputText() {
    const raw = $('rawInput').value.trim();
    if (!raw) {
      alert('Cô ơi, vui lòng dán bảng từ vựng vào ô nhập trước nhé!');
      return;
    }

    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    let rows = lines.map(splitRow);

    // Bỏ qua dòng tiêu đề banner đầu tiên nếu chỉ có 1 cột gộp (ví dụ "ENGLISH MASTER 2027...")
    if (rows.length > 1 && rows[0].length === 1 && rows[1].length > 1) {
      rows.shift();
    }

    // Kiểm tra xem dòng đầu tiên có phải là Header không
    const firstRow = rows[0];
    const isHeaderRow = firstRow.some(cell => {
      const c = cell.toLowerCase();
      return c.includes('word') || c.includes('từ') || c.includes('ipa') || c.includes('pos') || c.includes('meaning') || c.includes('nghĩa') || c === 'no.';
    });

    let headerRow = [];
    let dataRows = [];

    if (isHeaderRow) {
      headerRow = rows[0];
      dataRows = rows.slice(1);
    } else {
      headerRow = rows[0].map((_, i) => `Cột ${i + 1}`);
      dataRows = rows;
    }

    parsedRawRows = dataRows;
    detectedHeaders = headerRow;

    // Tự động đoán các cột
    const colCount = Math.max(headerRow.length, ...dataRows.slice(0, 5).map(r => r.length));
    columnMappings = [];

    for (let c = 0; c < colCount; c++) {
      const hName = headerRow[c] || `Cột ${c + 1}`;
      const sampleVals = dataRows.slice(0, 5).map(r => r[c] || '');
      const guessedField = guessColumnField(hName, sampleVals);
      columnMappings.push(guessedField);
    }

    // Đảm bảo có ít nhất 1 cột 'word' và 1 cột 'vi'
    if (!columnMappings.includes('word')) {
      for (let c = 0; c < colCount; c++) {
        if (columnMappings[c] === 'skip') { columnMappings[c] = 'word'; break; }
      }
    }
    if (!columnMappings.includes('vi')) {
      for (let c = colCount - 1; c >= 0; c--) {
        if (columnMappings[c] === 'skip') { columnMappings[c] = 'vi'; break; }
      }
    }

    renderMappingTable();
    $('step3Box').scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Hiển thị bảng Xem trước & Ánh xạ cột
   */
  function renderMappingTable() {
    $('step3Box').style.display = 'flex';
    $('rowCountBadge').textContent = `${parsedRawRows.length} dòng dữ liệu`;

    const table = $('mappingTable');
    let html = '<thead><tr>';

    // Header với Dropdown chọn cột
    columnMappings.forEach((selectedField, colIdx) => {
      const origHeader = detectedHeaders[colIdx] || `Cột ${colIdx + 1}`;
      html += `<th>
        <div style="margin-bottom:6px;color:var(--muted)">${origHeader}</div>
        <select class="col-select" data-col="${colIdx}">
          ${FIELD_OPTIONS.map(opt => `<option value="${opt.id}" ${opt.id === selectedField ? 'selected' : ''}>${opt.name}</option>`).join('')}
        </select>
      </th>`;
    });
    html += '</tr></thead><tbody>';

    // Dữ liệu mẫu 8 dòng đầu tiên
    const previewRows = parsedRawRows.slice(0, 8);
    previewRows.forEach(row => {
      html += '<tr>';
      columnMappings.forEach((_, colIdx) => {
        const val = row[colIdx] || '';
        html += `<td>${val || '<span style="color:var(--muted);font-style:italic">—</span>'}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody>';
    table.innerHTML = html;

    // Gán sự kiện khi đổi dropdown
    table.querySelectorAll('.col-select').forEach(sel => {
      sel.onchange = e => {
        const c = parseInt(e.target.dataset.col, 10);
        columnMappings[c] = e.target.value;
      };
    });
  }

  /**
   * Tạo cấu trúc dữ liệu cuối cùng từ bảng ánh xạ
   */
  function generateOutput() {
    const topicId = ($('topicId').value.trim() || 'chu-de-moi').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const topicTitle = $('topicTitle').value.trim() || 'Chuyên Đề Từ Vựng Mới';
    const topicEyebrow = $('topicEyebrow').value.trim() || 'Reading Comprehension · B2 – C1';
    const topicDesc = $('topicDesc').value.trim() || 'Ôn luyện từ vựng trọng tâm theo bài đọc.';
    const defaultPassagesCount = parseInt($('passagesCount').value, 10) || 4;

    const wordIdx = columnMappings.indexOf('word');
    const viIdx = columnMappings.indexOf('vi');
    const ipaIdx = columnMappings.indexOf('ipa');
    const posIdx = columnMappings.indexOf('pos');
    const defIdx = columnMappings.indexOf('def');
    const synIdx = columnMappings.indexOf('syn');
    const antIdx = columnMappings.indexOf('ant');
    const pIdx = columnMappings.indexOf('passage');
    const exIdx = columnMappings.indexOf('example');
    const formIdx = columnMappings.indexOf('form');

    if (wordIdx === -1 || viIdx === -1) {
      alert('Cô ơi, cần chỉ định ít nhất 1 cột "Từ vựng (Word)" và 1 cột "Nghĩa tiếng Việt" nhé!');
      return;
    }

    const words = [];
    const detectedPassagesSet = new Set();

    parsedRawRows.forEach((row, i) => {
      const w = (row[wordIdx] || '').trim();
      const vi = (row[viIdx] || '').trim();
      if (!w || !vi) return;

      const ipa = ipaIdx !== -1 ? (row[ipaIdx] || '').trim() : '';
      let pos = posIdx !== -1 ? (row[posIdx] || '').trim().replace(/\.$/, '') : 'n';
      // Chuẩn hóa pos phrase
      if (pos.includes('phrase') || pos.includes('phr')) {
        if (pos.startsWith('v')) pos = 'phr v';
        else if (pos.startsWith('adj')) pos = 'adj';
      }

      // Xác định bài đọc: Nếu có cột passage thì lấy, nếu không tự động chia đều
      let p = 1;
      if (pIdx !== -1 && row[pIdx]) {
        p = parseInt(row[pIdx], 10) || 1;
      } else {
        // Tự động chia đều theo passagesCount
        const wordsPerPassage = Math.ceil(parsedRawRows.length / defaultPassagesCount);
        p = Math.min(defaultPassagesCount, Math.floor(i / wordsPerPassage) + 1);
      }
      detectedPassagesSet.add(p);

      // Câu ví dụ: Nếu có cột example thì dùng, nếu không tạo câu mặc định từ Detailed Meaning hoặc mẫu
      let ex = exIdx !== -1 ? (row[exIdx] || '').trim() : '';
      if (!ex) {
        const def = defIdx !== -1 ? (row[defIdx] || '').trim() : '';
        if (def) {
          ex = `Meaning: ${def} (Word: ___).`;
        } else {
          ex = `The key concept '___' plays an essential role in this reading passage.`;
        }
      } else if (!ex.includes('___')) {
        // Nếu câu ví dụ chưa có chỗ trống ___, tự động thay thế từ vựng bằng ___
        const reg = new RegExp(`\\b${w}\\b`, 'i');
        if (reg.test(ex)) {
          ex = ex.replace(reg, '___');
        } else {
          ex = `${ex} (Key word: ___).`;
        }
      }

      const form = formIdx !== -1 && row[formIdx] ? row[formIdx].trim() : w;
      const syn = synIdx !== -1 ? (row[synIdx] || '').trim() : '';
      const ant = antIdx !== -1 ? (row[antIdx] || '').trim() : '';

      words.push({
        w,
        ipa: ipa || '/.../',
        pos: pos || 'n',
        vi,
        p,
        ex,
        form,
        ...(syn ? { syn } : {}),
        ...(ant ? { ant } : {})
      });
    });

    if (!words.length) {
      alert('Không tìm thấy dòng từ vựng hợp lệ nào! Cô kiểm tra lại bảng dán nhé.');
      return;
    }

    // Tạo danh sách passages
    const passagesList = {};
    const pKeys = Array.from(detectedPassagesSet).sort((a, b) => a - b);
    pKeys.forEach(k => {
      passagesList[k] = `Reading Passage ${k}`;
    });

    // 1. Tạo chuỗi Markdown thuần
    let mdOutput = `---\nid: ${topicId}\ntitle: ${topicTitle}\neyebrow: ${topicEyebrow}\ndesc: ${topicDesc}\npassages:\n`;
    Object.keys(passagesList).forEach(k => {
      mdOutput += `  ${k}: ${passagesList[k]}\n`;
    });
    mdOutput += `---\n\n| Word | IPA | POS | Meaning | Passage | Example | Form | Syn | Ant | Distractors |\n`;

    words.forEach(x => {
      const synVal = x.syn || '';
      const antVal = x.ant || '';
      mdOutput += `| ${x.w} | ${x.ipa} | ${x.pos} | ${x.vi} | ${x.p} | ${x.ex} | ${x.form} | ${synVal} | ${antVal} | |\n`;
    });

    // 2. Tạo chuỗi JS để nhúng vào data/topics/
    const jsOutput = `/**
 * Chuyên đề: ${topicTitle}
 * Tạo tự động bằng Teacher Vocab Studio · Ms Trâm English Hub
 */

window.registerTopic(\`
${mdOutput}
\`);
`;

    generatedData = {
      id: topicId,
      md: mdOutput,
      js: jsOutput,
      count: words.length
    };

    $('step4Box').style.display = 'flex';
    $('outCode').textContent = jsOutput;
    $('genCountBadge').textContent = `Đã tạo thành công ${words.length} từ vựng`;
    $('step4Box').scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Tải file về máy tính
   */
  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Khởi tạo các sự kiện giao diện
  function init() {
    $('parseBtn').onclick = parseInputText;
    $('generateBtn').onclick = generateOutput;

    // Dán mẫu kiểm thử nhanh từ Google Sheets của cô Trâm
    $('loadSampleBtn').onclick = () => {
      $('topicId').value = 'people-life';
      $('topicTitle').value = 'People and Personal Life - Inspiring Stories';
      $('topicEyebrow').value = 'Biographies & Life Stories · B2 – C1 · Test 01';
      $('topicDesc').value = 'Từ vựng đọc hiểu nâng cao về tiểu sử, câu chuyện truyền cảm hứng, sự nghiệp và bài học cuộc sống.';
      $('rawInput').value = SAMPLE_SHEETS_DATA;
      parseInputText();
    };

    // Tải file JS
    $('downloadJsBtn').onclick = () => {
      if (!generatedData) return;
      downloadFile(`${generatedData.id}.js`, generatedData.js);
    };

    // Tải file MD
    $('downloadMdBtn').onclick = () => {
      if (!generatedData) return;
      downloadFile(`${generatedData.id}.md`, generatedData.md);
    };

    // Sao chép mã
    $('copyCodeBtn').onclick = () => {
      if (!generatedData) return;
      navigator.clipboard.writeText(generatedData.js).then(() => {
        alert('Đã sao chép toàn bộ mã vào bộ nhớ tạm!');
      }).catch(() => {
        alert('Không thể sao chép tự động, cô chọn bôi đen mã và bấm Ctrl+C nhé!');
      });
    };

    // Khởi tạo Theme
    initTheme();
  }

  function initTheme() {
    let currentTheme = 'dark';
    try {
      const stored = localStorage.getItem('cpv-theme');
      if (stored) currentTheme = JSON.parse(stored);
    } catch (e) {}

    const applyTheme = (theme) => {
      currentTheme = theme === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', currentTheme);
      try {
        localStorage.setItem('cpv-theme', JSON.stringify(currentTheme));
      } catch (e) {}
      const btn = $('themeToggle');
      if (btn) {
        btn.textContent = currentTheme === 'dark' ? '🌙' : '☀️';
        btn.title = currentTheme === 'dark' ? 'Giao diện tối (Bấm để chuyển sang sáng)' : 'Giao diện sáng (Bấm để chuyển sang tối)';
      }
    };

    applyTheme(currentTheme);

    const btn = $('themeToggle');
    if (btn) {
      btn.onclick = () => {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
