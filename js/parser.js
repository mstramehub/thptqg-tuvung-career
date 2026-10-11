/**
 * ============================================================================
 * Markdown Topic Parser for Vocabulary App
 * Ms Trâm English Hub
 * ============================================================================
 * Bộ chuyển đổi cú pháp Markdown thành cấu trúc dữ liệu từ vựng hoàn chỉnh.
 * Hỗ trợ Frontmatter (Metadata, Passages) và Markdown Table (Danh sách từ vựng).
 */

(function () {
  'use strict';

  // Kho lưu trữ tất cả các chủ đề đã đăng ký
  const TOPICS = {};

  const isDelimiterRow = str => {
    const parts = str.split('|').map(s => s.trim()).filter(Boolean);
    return parts.length > 0 && parts.every(p => /^:?-+:?$/.test(p));
  };

  /**
   * Phân tích nội dung Markdown của một chủ đề
   * @param {string} mdText - Chuỗi văn bản Markdown
   * @returns {object} Đối tượng chủ đề hoàn chỉnh
   */
  function parseTopicMarkdown(mdText) {
    if (!mdText || typeof mdText !== 'string') return null;

    const lines = mdText.trim().split(/\r?\n/);
    let inFrontmatter = false;
    let frontmatterLines = [];
    let tableLines = [];
    let readingTable = false;

    // 1. Tách phần Frontmatter (giữa 2 dấu ---) và phần bảng dữ liệu
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
          continue;
        } else {
          inFrontmatter = false;
          continue;
        }
      }

      if (inFrontmatter) {
        frontmatterLines.push(line);
      } else {
        if (line.startsWith('|') && line.endsWith('|')) {
          readingTable = true;
          tableLines.push(line);
        } else if (readingTable && line === '') {
          // Bỏ qua dòng trống giữa bảng nếu có
          continue;
        }
      }
    }

    // 2. Phân tích Frontmatter
    const meta = {
      id: '',
      title: '',
      eyebrow: '',
      desc: '',
      passages: {}
    };

    let readingPassages = false;
    frontmatterLines.forEach(line => {
      if (!line || line.startsWith('#')) return;

      if (line.startsWith('passages:')) {
        readingPassages = true;
        return;
      }

      if (readingPassages) {
        const pMatch = line.match(/^(\d+)\s*:\s*(.+)$/);
        if (pMatch) {
          meta.passages[parseInt(pMatch[1], 10)] = pMatch[2].trim().replace(/^['"]|['"]$/g, '');
        } else if (!line.startsWith(' ') && !line.startsWith('\t')) {
          readingPassages = false;
        }
      }

      if (!readingPassages) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const key = line.slice(0, colonIdx).trim();
          const val = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (key === 'id') meta.id = val;
          else if (key === 'title') meta.title = val;
          else if (key === 'eyebrow') meta.eyebrow = val;
          else if (key === 'desc' || key === 'description') meta.desc = val;
        }
      }
    });

    if (!meta.id) {
      meta.id = (meta.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    // 3. Phân tích Bảng từ vựng Markdown Table
    // Định dạng cột: | Word | IPA | POS | Meaning | Passage | Example | Form | Syn | Ant | Distractors |
    const words = [];
    if (tableLines.length >= 2) {
      // Dòng 0 luôn là Header (chứa 'word' hoặc 'từ')
      const startIdx = isDelimiterRow(tableLines[1]) ? 2 : 1;

      for (let i = startIdx; i < tableLines.length; i++) {
        const row = tableLines[i];
        if (isDelimiterRow(row)) continue; // Bỏ qua nếu là dòng phân cách |---|---|

        const rawCells = row.split('|');
        if (rawCells.length < 3) continue;

        // Cắt bỏ phần tử rỗng ở đầu và đuôi do ký tự | ở 2 viền
        const cells = rawCells.slice(1, rawCells.length - 1).map(c => c.trim());
        if (!cells[0] || cells[0].toLowerCase() === 'word') continue; // Bỏ qua header trùng lặp hoặc dòng trống

        const w = cells[0] || '';
        const ipa = cells[1] || '';
        const pos = cells[2] || '';
        const vi = cells[3] || '';
        const p = parseInt(cells[4], 10) || 1;
        const ex = cells[5] || '';
        const form = cells[6] || w;
        const syn = cells[7] || '';
        const ant = cells[8] || '';
        const distRaw = cells[9] || '';
        const dist = distRaw ? distRaw.split(',').map(s => s.trim()).filter(Boolean) : undefined;

        const wordObj = {
          w,
          ipa,
          pos,
          vi,
          p,
          ex,
          form,
          ...(syn ? { syn } : {}),
          ...(ant ? { ant } : {}),
          ...(dist && dist.length ? { dist } : {})
        };

        words.push(wordObj);
      }
    }

    // 4. Tự động sinh danh sách CLUSTERS (các cặp từ đồng nghĩa/họ hàng tránh xuất hiện cùng nhau trong trắc nghiệm)
    const clustersMap = [];
    words.forEach(x => {
      if (x.syn) {
        clustersMap.push([x.w, x.syn]);
      }
    });

    return {
      id: meta.id,
      title: meta.title,
      eyebrow: meta.eyebrow,
      desc: meta.desc,
      passages: meta.passages,
      words: words,
      clusters: clustersMap
    };
  }

  /**
   * Đăng ký một chủ đề mới từ chuỗi Markdown
   * @param {string} mdContent 
   */
  function registerTopic(mdContent) {
    const topic = parseTopicMarkdown(mdContent);
    if (topic && topic.id) {
      TOPICS[topic.id] = topic;
    }
    return topic;
  }

  // Xuất API ra window
  window.TOPICS = TOPICS;
  window.registerTopic = registerTopic;
  window.parseTopicMarkdown = parseTopicMarkdown;
})();
