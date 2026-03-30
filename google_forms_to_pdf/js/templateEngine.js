/**
 * templateEngine.js
 * {{field_name}} → 데이터 치환 엔진
 */

class TemplateEngine {
    /**
     * @param {string} templateHTML - HTML template string with {{placeholders}}
     */
    constructor(templateHTML = '') {
        this.template = templateHTML;
    }

    /**
     * Set the template string.
     * @param {string} html
     */
    setTemplate(html) {
        this.template = html;
    }

    /**
     * Render the template with a single data record.
     * - Replaces all {{key}} occurrences with the corresponding value.
     * - Unknown keys are replaced with an empty string.
     * - Values are HTML-escaped for safety.
     *
     * @param {object} record - key/value data object
     * @param {object} meta - extra metadata (e.g., { _index: 1, _total: 50 })
     * @returns {string} rendered HTML
     */
    render(record, meta = {}) {
        const data = Object.assign({}, record, meta);
        return this.template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const trimmedKey = key.trim();
            if (trimmedKey in data) {
                return this._escapeHTML(String(data[trimmedKey]));
            }
            return '';
        });
    }

    /**
     * Render the template for multiple records.
     * Returns array of rendered HTML strings.
     *
     * @param {object[]} records
     * @returns {string[]}
     */
    renderAll(records) {
        return records.map((record, i) =>
            this.render(record, {
                _index: i + 1,
                _total: records.length,
            })
        );
    }

    /**
     * Extract all placeholder keys used in the template.
     * @returns {string[]}
     */
    getPlaceholders() {
        const matches = this.template.matchAll(/\{\{([^}]+)\}\}/g);
        const keys = new Set();
        for (const match of matches) {
            keys.add(match[1].trim());
        }
        return [...keys];
    }

    /**
     * Escape HTML special characters to prevent XSS.
     * @param {string} str
     * @returns {string}
     */
    _escapeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Validate that all required fields exist in the first record.
     * Returns an object with missing/unused keys.
     *
     * @param {object} record
     * @returns {{ missing: string[], unused: string[] }}
     */
    validate(record) {
        const placeholders = this.getPlaceholders();
        const recordKeys = Object.keys(record);

        const systemKeys = new Set(['_index', '_total']);
        const missing = placeholders.filter(p => !systemKeys.has(p) && !(p in record));
        const unused = recordKeys.filter(k => !placeholders.includes(k));

        return {missing, unused};
    }
}

/* ==============================
   DEFAULT TEMPLATES
   ============================== */

const DEFAULT_TEMPLATES = {
    classic: {
        name: '기본형 (클래식)',
        icon: '📋',
        description: '깔끔한 필드-값 목록 형태',
        generate: (headers = []) => {
            const rows = headers
                .map(h => `
    <tr>
      <th style="width:35%; background:#f8f9fa; padding:8px 12px; text-align:left; font-weight:600; font-size:10pt; color:#333; border:1px solid #dee2e6; vertical-align:top; white-space:nowrap;">${h}</th>
      <td style="padding:8px 12px; font-size:10pt; color:#1a1a1a; border:1px solid #dee2e6; word-break:break-word;">{{${h}}}</td>
    </tr>`)
                .join('');

            return `<div class="page print-content" style="font-family:'DM Sans','Apple SD Gothic Neo',sans-serif; padding:0;">
  <div class="response-header" style="border-bottom:2px solid #1a1a1a; margin-bottom:16px; padding-bottom:8px; display:flex; justify-content:space-between; align-items:baseline;">
    <h2 style="margin:0; font-size:14pt; font-weight:700;">응답 #{{_index}}</h2>
    <span class="response-number" style="font-size:8pt; color:#666;">{{_index}} / {{_total}}</span>
  </div>
  <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">${rows}
  </table>
</div>`;
        }
    },

    card: {
        name: '카드형',
        icon: '🗂',
        description: '카드 레이아웃, 항목별 구분선',
        generate: (headers = []) => {
            const fields = headers
                .map(h => `
  <div class="print-field-row" style="display:flex; gap:12px; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #eee;">
    <div class="print-field-label" style="min-width:90px; font-size:8.5pt; font-weight:700; color:#555; flex-shrink:0;">${h}</div>
    <div class="print-field-value" style="font-size:10pt; color:#111; flex:1; word-break:break-word;">{{${h}}}</div>
  </div>`)
                .join('');

            return `<div class="page print-content" style="font-family:'DM Sans','Apple SD Gothic Neo',sans-serif; padding:0;">
  <div style="border:1.5px solid #1a1a1a; border-radius:4px; padding:16px; page-break-inside:avoid;">
    <div style="background:#1a1a1a; color:white; margin:-16px -16px 16px -16px; padding:10px 16px; border-radius:2px 2px 0 0; display:flex; justify-content:space-between;">
      <span style="font-size:12pt; font-weight:700;">응답 #{{_index}}</span>
      <span style="font-size:8pt; opacity:0.7;">{{_index}} / {{_total}}</span>
    </div>${fields}
  </div>
</div>`;
        }
    },

    compact: {
        name: '컴팩트형',
        icon: '📝',
        description: '밀도 높은 2열 그리드',
        generate: (headers = []) => {
            const fields = headers
                .map(h => `
    <div style="padding:6px; border:1px solid #e5e7eb; border-radius:4px; break-inside:avoid; page-break-inside:avoid;">
      <div style="font-size:7.5pt; font-weight:700; color:#6b7280; margin-bottom:2px;">${h}</div>
      <div style="font-size:9.5pt; color:#111; word-break:break-word;">{{${h}}}</div>
    </div>`)
                .join('');

            return `<div class="page print-content" style="font-family:'DM Sans','Apple SD Gothic Neo',sans-serif; padding:0;">
  <div style="border-bottom:2px solid #111; margin-bottom:10px; padding-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
    <span style="font-size:12pt; font-weight:700;">응답 #{{_index}}</span>
    <span style="font-size:8pt; color:#888;">{{_index}} / {{_total}}</span>
  </div>
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">${fields}
  </div>
</div>`;
        }
    },

    custom: {
        name: '사용자 정의',
        icon: '✏️',
        description: '직접 HTML 편집',
        generate: () => `<div class="page print-content" style="font-family:'DM Sans','Apple SD Gothic Neo',sans-serif; padding:0;">
  <h2>응답 #{{_index}} / {{_total}}</h2>
  <!-- 여기에 원하는 HTML을 작성하세요 -->
  <!-- CSV 헤더 이름을 {{헤더이름}} 형태로 사용하세요 -->
</div>`
    }
};

window.TemplateEngine = TemplateEngine;
window.DEFAULT_TEMPLATES = DEFAULT_TEMPLATES;
