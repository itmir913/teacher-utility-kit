/**
 * templateEngine.js
 * {{field_name}} → 데이터 치환 엔진 (v2)
 *
 * 개선 사항:
 *  - 값 치환 시 escapeHTML 적용 → 데이터 레벨 XSS 차단
 *  - validate() 결과에 시스템 키 제외 로직 분리
 *  - DEFAULT_TEMPLATES: headers 배열 없이도 기본 동작
 */

'use strict';

class TemplateEngine {
    /**
     * @param {string} templateHTML - {{placeholder}} 포함 HTML 문자열
     */
    constructor(templateHTML = '') {
        this.template = templateHTML;
    }

    setTemplate(html) {
        this.template = html;
    }

    // ─── 렌더링 ──────────────────────────────────────────────

    /**
     * 단일 레코드 렌더링
     * - 데이터 값은 HTML 이스케이프 처리 (XSS 방어)
     * - 알 수 없는 키는 빈 문자열로 치환
     *
     * @param {object} record
     * @param {object} [meta] - { _index, _total } 등 시스템 변수
     * @returns {string}
     */
    render(record, meta = {}) {
        const data = {...record, ...meta};

        return this.template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const trimmed = key.trim();
            if (trimmed in data) {
                return Utils.escapeHTML(data[trimmed]);
            }
            return '';
        });
    }

    /**
     * 여러 레코드 일괄 렌더링
     * @param {object[]} records
     * @returns {string[]}
     */
    renderAll(records) {
        return records.map((record, i) =>
            this.render(record, {_index: i + 1, _total: records.length})
        );
    }

    // ─── 분석 ────────────────────────────────────────────────

    /**
     * 템플릿에서 사용 중인 placeholder 키 추출
     * @returns {string[]}
     */
    getPlaceholders() {
        const keys = new Set();
        for (const [, key] of this.template.matchAll(/\{\{([^}]+)\}\}/g)) {
            keys.add(key.trim());
        }
        return [...keys];
    }

    /**
     * 첫 번째 레코드 기준으로 누락/미사용 키 검증
     * @param {object} record
     * @returns {{ missing: string[], unused: string[] }}
     */
    validate(record) {
        const SYSTEM_KEYS = new Set(['_index', '_total']);
        const placeholders = this.getPlaceholders();
        const recordKeys = Object.keys(record);

        const missing = placeholders.filter(p => !SYSTEM_KEYS.has(p) && !(p in record));
        const unused = recordKeys.filter(k => !placeholders.includes(k));

        return {missing, unused};
    }
}

// ─── 기본 템플릿 정의 ─────────────────────────────────────────

const DEFAULT_TEMPLATES = {
    classic: {
        name: '기본형 (클래식)',
        icon: '📋',
        description: '깔끔한 필드-값 테이블',
        generate(headers = []) {
            const rows = headers.map(h => `
    <tr>
      <th style="width:38%;background:#f8f9fa;padding:7pt 10pt;text-align:left;font-weight:700;font-size:9pt;color:#333;border:0.5pt solid #ccc;vertical-align:top;white-space:nowrap;">${Utils.escapeHTML(h)}</th>
      <td style="padding:7pt 10pt;font-size:10pt;color:#111;border:0.5pt solid #ccc;word-break:break-word;vertical-align:top;">{{${h}}}</td>
    </tr>`).join('');

            return `<div class="page print-content" style="font-family:'Apple SD Gothic Neo','Malgun Gothic','DM Sans',sans-serif;padding:0;">
  <div style="border-bottom:2pt solid #111;margin-bottom:14pt;padding-bottom:6pt;display:flex;justify-content:space-between;align-items:baseline;">
    <h2 style="margin:0;font-size:14pt;font-weight:700;">응답 #{{_index}}</h2>
    <span style="font-size:8pt;color:#666;">{{_index}} / {{_total}}</span>
  </div>
  <table style="width:100%;border-collapse:collapse;">${rows}
  </table>
</div>`;
        },
    },

    card: {
        name: '카드형',
        icon: '🗂',
        description: '항목별 카드 레이아웃',
        generate(headers = []) {
            const fields = headers.map(h => `
  <div style="display:flex;gap:10pt;margin-bottom:9pt;padding-bottom:7pt;border-bottom:0.5pt solid #eee;page-break-inside:avoid;">
    <div style="min-width:80pt;font-size:8.5pt;font-weight:700;color:#555;flex-shrink:0;">${Utils.escapeHTML(h)}</div>
    <div style="font-size:10pt;color:#111;flex:1;word-break:break-word;">{{${h}}}</div>
  </div>`).join('');

            return `<div class="page print-content" style="font-family:'Apple SD Gothic Neo','Malgun Gothic','DM Sans',sans-serif;padding:0;">
  <div style="background:#1a1a1a;color:white;margin-bottom:14pt;padding:10pt 14pt;border-radius:3pt;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:12pt;font-weight:700;">응답 #{{_index}}</span>
    <span style="font-size:8pt;opacity:0.7;">{{_index}} / {{_total}}</span>
  </div>
  <div style="border:1pt solid #ddd;border-radius:4pt;padding:14pt;">${fields}
  </div>
</div>`;
        },
    },

    compact: {
        name: '컴팩트형',
        icon: '📝',
        description: '밀도 높은 2열 그리드',
        generate(headers = []) {
            const fields = headers.map(h => `
    <div style="padding:6pt;border:0.5pt solid #e0e0e0;border-radius:3pt;break-inside:avoid;">
      <div style="font-size:7.5pt;font-weight:700;color:#777;margin-bottom:2pt;">${Utils.escapeHTML(h)}</div>
      <div style="font-size:9.5pt;color:#111;word-break:break-word;">{{${h}}}</div>
    </div>`).join('');

            return `<div class="page print-content" style="font-family:'Apple SD Gothic Neo','Malgun Gothic','DM Sans',sans-serif;padding:0;">
  <div style="border-bottom:2pt solid #111;margin-bottom:10pt;padding-bottom:5pt;display:flex;justify-content:space-between;">
    <span style="font-size:12pt;font-weight:700;">응답 #{{_index}}</span>
    <span style="font-size:8pt;color:#888;">{{_index}} / {{_total}}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5pt;">${fields}
  </div>
</div>`;
        },
    },

    custom: {
        name: '사용자 정의',
        icon: '✏️',
        description: 'HTML 직접 편집',
        generate: () =>
            `<div class="page print-content" style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;padding:0;">\n` +
            `  <h2>응답 #{{_index}} / {{_total}}</h2>\n` +
            `  <!-- {{헤더이름}} 형태로 CSV 필드를 삽입하세요 -->\n` +
            `</div>`,
    },
};

window.TemplateEngine = TemplateEngine;
window.DEFAULT_TEMPLATES = DEFAULT_TEMPLATES;
