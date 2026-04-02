/**
 * previewRenderer.js
 * 미리보기 탭: 응답 카드 렌더링 (v2)
 *
 * 개선 사항:
 *  - 청크 비동기 렌더링 → 대용량 CSV에서 UI 블로킹 없음
 *  - 사용자 데이터는 전부 textContent 또는 sanitizeHTML
 *  - 렌더링 진행률 표시
 *  - 가상 스크롤 준비 구조 (현재는 전체 렌더, 향후 교체 가능)
 */

'use strict';

class PreviewRenderer {
    /**
     * @param {object} options
     * @param {string} options.containerId
     * @param {string} options.emptyId
     * @param {string} options.subtitleId
     * @param {string} options.counterElId
     * @param {string} options.prevBtnId
     * @param {string} options.nextBtnId
     * @param {string} options.progressBarId - 진행률 바 요소 ID
     */
    constructor(options = {}) {
        this.container = Utils.byId(options.containerId || 'preview-container');
        this.emptyEl = Utils.byId(options.emptyId || 'preview-empty');
        this.subtitleEl = Utils.byId(options.subtitleId || 'preview-subtitle');
        this.counterEl = Utils.byId(options.counterElId || 'page-counter');
        this.prevBtn = Utils.byId(options.prevBtnId || 'prev-page-btn');
        this.nextBtn = Utils.byId(options.nextBtnId || 'next-page-btn');
        this.progressBar = Utils.byId(options.progressBarId || 'preview-progress');

        this.currentPage = 0;
        this.totalPages = 0;
        this.renderedPages = [];
        this._rendering = false;

        this._bindNavigation();
    }

    // ─── 공개 메서드 ─────────────────────────────────────────

    /**
     * 전체 레코드 렌더링 (비동기 청크)
     * @param {object[]} records
     * @param {TemplateEngine} engine
     * @returns {Promise<string[]>} - 렌더링된 HTML 배열 반환 (pdfGenerator에서 재사용)
     */
    async render(records, engine) {
        if (this._rendering) return;
        if (!records || records.length === 0) {
            this._showEmpty('표시할 데이터가 없습니다.');
            return [];
        }

        this._rendering = true;
        this._setProgress(0);
        this._showContent();

        if (this.container) this.container.innerHTML = '';
        if (this.subtitleEl) this.subtitleEl.textContent = '렌더링 중...';

        const rendered = [];

        try {
            const CHUNK = 25; // 한 프레임당 처리 카드 수

            for (let i = 0; i < records.length; i += CHUNK) {
                const slice = records.slice(i, i + CHUNK);
                const frag = document.createDocumentFragment();

                slice.forEach((record, j) => {
                    const globalIdx = i + j;
                    const html = engine.render(record, {
                        _index: globalIdx + 1,
                        _total: records.length,
                    });
                    rendered.push(html);
                    frag.appendChild(this._createCard(html, record, globalIdx, records.length));
                });

                if (this.container) this.container.appendChild(frag);

                const done = Math.min(i + CHUNK, records.length);
                this._setProgress(Math.round((done / records.length) * 100));

                // UI 업데이트 양보 (60fps 유지)
                await new Promise(r => requestAnimationFrame(r));
            }

            this.renderedPages = rendered;
            this.totalPages = rendered.length;
            this.currentPage = 0;

            this._setProgress(100);
            this._updateNav();

            if (this.subtitleEl) {
                this.subtitleEl.textContent = `총 ${records.length}개 응답 렌더링 완료`;
            }
            setTimeout(() => this._setProgress(-1), 800); // 완료 후 바 숨김

            return rendered;

        } finally {
            this._rendering = false;
        }
    }

    // ─── 카드 생성 ────────────────────────────────────────────

    /**
     * 응답 카드 DOM 생성 (innerHTML 최소화)
     * 사용자 데이터는 textContent, 템플릿 렌더 결과는 sanitizeHTML
     */
    _createCard(html, record, idx, total) {
        const card = Utils.createElement('div', {class: 'response-card'});
        card.dataset.pageIndex = idx;

        // ── 헤더 ──
        const header = Utils.createElement('div', {class: 'response-card-header'});

        const left = Utils.createElement('div', {class: 'flex items-center gap-2'});
        left.appendChild(Utils.createElement('span', {class: 'font-600 text-slate-700 text-sm'}, `응답 #${idx + 1}`));

        const badge = Utils.createElement('span', {class: 'page-badge start'}, '페이지 시작');
        left.appendChild(badge);
        header.appendChild(left);

        const counter = Utils.createElement('span', {class: 'text-xs text-slate-400'}, `${idx + 1} / ${total}`);
        header.appendChild(counter);

        // ── 본문 ──
        const body = Utils.createElement('div', {class: 'response-card-body'});

        const preview = Utils.createElement('div', {
            class: 'border border-slate-100 rounded-xl p-4 bg-slate-50 text-sm overflow-auto max-h-80',
        });
        // 템플릿 렌더 결과는 sanitizeHTML로 안전하게 삽입
        preview.innerHTML = Utils.sanitizeHTML(html, 'template');
        body.appendChild(preview);

        // 필드 요약 (textContent만 사용)
        body.appendChild(this._createFieldSummary(record));

        card.appendChild(header);
        card.appendChild(body);
        return card;
    }

    /** 레코드 필드 요약 DOM (최대 6개, textContent 전용) */
    _createFieldSummary(record) {
        const wrap = Utils.createElement('div', {class: 'mt-3 pt-3 border-t border-slate-100'});
        const grid = Utils.createElement('div', {class: 'grid grid-cols-2 gap-x-4 gap-y-1'});

        const entries = Object.entries(record).slice(0, 6);
        entries.forEach(([key, val]) => {
            const item = Utils.createElement('div', {class: 'text-xs'});

            const label = Utils.createElement('span', {class: 'text-slate-400'});
            label.textContent = `${key}: `;

            const valStr = String(val);
            const value = Utils.createElement('span', {class: 'text-slate-600 font-500'});
            value.textContent = valStr.length > 40 ? valStr.slice(0, 40) + '…' : valStr;

            item.appendChild(label);
            item.appendChild(value);
            grid.appendChild(item);
        });

        const extra = Object.keys(record).length - 6;
        if (extra > 0) {
            const more = Utils.createElement('div', {class: 'text-xs text-slate-300 col-span-2 mt-1'});
            more.textContent = `+${extra}개 필드 더 있음`;
            grid.appendChild(more);
        }

        wrap.appendChild(grid);
        return wrap;
    }

    // ─── UI 상태 ─────────────────────────────────────────────

    _setProgress(pct) {
        if (!this.progressBar) return;
        if (pct < 0) {
            this.progressBar.classList.add('hidden');
            return;
        }
        this.progressBar.classList.remove('hidden');
        const bar = this.progressBar.querySelector('[data-progress-fill]');
        if (bar) bar.style.width = `${pct}%`;
        const label = this.progressBar.querySelector('[data-progress-label]');
        if (label) label.textContent = pct < 100 ? `${pct}%` : '완료';
    }

    _showEmpty(msg = '') {
        if (this.emptyEl) this.emptyEl.classList.remove('hidden');
        if (this.container) this.container.classList.add('hidden');
        if (msg && this.subtitleEl) this.subtitleEl.textContent = msg;
    }

    _showContent() {
        if (this.emptyEl) this.emptyEl.classList.add('hidden');
        if (this.container) this.container.classList.remove('hidden');
    }

    // ─── 페이지 내비게이션 ────────────────────────────────────

    _bindNavigation() {
        this.prevBtn?.addEventListener('click', () => {
            if (this.currentPage > 0) {
                this.currentPage--;
                this._scrollToPage(this.currentPage);
                this._updateNav();
            }
        });

        this.nextBtn?.addEventListener('click', () => {
            if (this.currentPage < this.totalPages - 1) {
                this.currentPage++;
                this._scrollToPage(this.currentPage);
                this._updateNav();
            }
        });
    }

    _scrollToPage(idx) {
        const cards = this.container?.querySelectorAll('.response-card') || [];
        if (cards[idx]) {
            cards[idx].scrollIntoView({behavior: 'smooth', block: 'start'});
        }
    }

    _updateNav() {
        if (this.counterEl) {
            this.counterEl.textContent = this.totalPages > 0
                ? `${this.currentPage + 1} / ${this.totalPages}`
                : '0 / 0';
        }
        if (this.prevBtn) this.prevBtn.disabled = this.currentPage <= 0;
        if (this.nextBtn) this.nextBtn.disabled = this.currentPage >= this.totalPages - 1;
    }
}

window.PreviewRenderer = PreviewRenderer;
