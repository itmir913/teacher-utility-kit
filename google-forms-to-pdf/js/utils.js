/**
 * utils.js
 * 공유 유틸리티 함수 모음
 * - HTML 이스케이프 / DOMPurify 래핑 / debounce / 파일 크기 포맷
 */

'use strict';

const Utils = (() => {

    /**
     * HTML 특수문자 이스케이프 (XSS 방어 기본층)
     * @param {unknown} value
     * @returns {string}
     */
    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * HTML 새니타이즈 — DOMPurify 우선, 미로드 시 스크립트 제거 폴백
     * 템플릿 미리보기/인쇄 영역 등 innerHTML 삽입 전 반드시 통과
     * @param {string} html
     * @param {'template'|'data'} context
     *   'template' → style 태그 허용 (인쇄용 CSS 보존)
     *   'data'     → 텍스트 노드만 허용 (엄격)
     * @returns {string}
     */
    function sanitizeHTML(html, context = 'template') {
        if (typeof DOMPurify === 'undefined') {
            // DOMPurify 없으면 스크립트·이벤트 핸들러 속성만 제거 (폴백)
            return html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
                .replace(/javascript\s*:/gi, 'void:');
        }

        if (context === 'data') {
            // 완전 엄격: 텍스트 노드만
            return DOMPurify.sanitize(html, {ALLOWED_TAGS: [], ALLOWED_ATTR: []});
        }

        // template 컨텍스트: 인쇄 레이아웃 유지, 이벤트 핸들러만 제거
        return DOMPurify.sanitize(html, {
            FORCE_BODY: true,
            ADD_TAGS: ['style'],
            ADD_ATTR: [
                'style', 'class', 'id', 'colspan', 'rowspan',
                'width', 'height', 'align', 'valign',
                'border', 'cellpadding', 'cellspacing',
            ],
            // on* 이벤트 속성은 DOMPurify 기본 설정으로 제거됨
            // javascript: URI 도 기본 제거됨
        });
    }

    /**
     * 함수 호출 빈도 제한 (debounce)
     * @param {Function} fn
     * @param {number} delayMs
     * @returns {Function}
     */
    function debounce(fn, delayMs) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delayMs);
        };
    }

    /**
     * 바이트를 사람이 읽기 쉬운 크기 문자열로 변환
     * @param {number} bytes
     * @returns {string}
     */
    function formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    /**
     * DOM 요소 생성 헬퍼
     * @param {string} tag
     * @param {object} attrs   - 속성 객체 (class, id 등)
     * @param {string} [text]  - textContent (설정 시 XSS 안전)
     * @returns {HTMLElement}
     */
    function createElement(tag, attrs = {}, text = null) {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => {
            if (k === 'className') el.className = v;
            else el.setAttribute(k, v);
        });
        if (text !== null) el.textContent = text;
        return el;
    }

    /**
     * ID로 요소 조회 (null-safe)
     * @param {string} id
     * @returns {HTMLElement|null}
     */
    function byId(id) {
        return document.getElementById(id);
    }

    /**
     * 비동기 청크 처리 — UI 스레드 블로킹 방지
     * @param {Array} items
     * @param {Function} processFn  - (item, index) => void
     * @param {number} chunkSize
     * @param {Function} [onProgress] - (processed, total) => void
     */
    async function processChunked(items, processFn, chunkSize = 30, onProgress = null) {
        for (let i = 0; i < items.length; i += chunkSize) {
            const slice = items.slice(i, i + chunkSize);
            slice.forEach((item, j) => processFn(item, i + j));
            if (onProgress) onProgress(Math.min(i + chunkSize, items.length), items.length);
            // 다음 프레임에서 UI 업데이트 가능하도록 양보
            await new Promise(r => requestAnimationFrame(r));
        }
    }

    return {
        escapeHTML,
        sanitizeHTML,
        debounce,
        formatFileSize,
        createElement,
        byId,
        processChunked,
    };
})();

window.Utils = Utils;
