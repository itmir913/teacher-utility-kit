/**
 * previewRenderer.js
 * 미리보기 탭: 응답 카드 렌더링
 */

class PreviewRenderer {
    /**
     * @param {string} containerId   - ID of the preview container
     * @param {string} emptyId       - ID of the empty state element
     * @param {string} subtitleId    - ID of subtitle text
     * @param {string} counterElId  - ID of page counter text
     * @param {string} prevBtnId
     * @param {string} nextBtnId
     */
    constructor(options = {}) {
        this.container = document.getElementById(options.containerId || 'preview-container');
        this.emptyEl = document.getElementById(options.emptyId || 'preview-empty');
        this.subtitleEl = document.getElementById(options.subtitleId || 'preview-subtitle');
        this.counterEl = document.getElementById(options.counterElId || 'page-counter');
        this.prevBtn = document.getElementById(options.prevBtnId || 'prev-page-btn');
        this.nextBtn = document.getElementById(options.nextBtnId || 'next-page-btn');

        this.currentPage = 0;
        this.totalPages = 0;
        this.renderedPages = [];

        this._bindNavigation();
    }

    /**
     * Render all records using a template engine.
     * @param {object[]} records
     * @param {TemplateEngine} engine
     */
    render(records, engine) {
        if (!records || records.length === 0) {
            this._showEmpty('데이터가 없습니다.');
            return;
        }

        const rendered = engine.renderAll(records);
        this.renderedPages = rendered;
        this.totalPages = rendered.length;
        this.currentPage = 0;

        this._buildCards(records, rendered);
        this._updateNav();

        if (this.subtitleEl) {
            this.subtitleEl.textContent = `총 ${records.length}개 응답이 렌더링되었습니다.`;
        }

        this._showContent();
        this._scrollToPage(0);
    }

    _buildCards(records, rendered) {
        if (!this.container) return;
        this.container.innerHTML = '';

        rendered.forEach((html, idx) => {
            const card = document.createElement('div');
            card.className = 'response-card';
            card.dataset.pageIndex = idx;

            // Header
            const header = document.createElement('div');
            header.className = 'response-card-header';
            header.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="font-600 text-slate-700 text-sm">응답 #${idx + 1}</span>
          <span class="page-badge start">페이지 시작</span>
        </div>
        <span class="text-xs text-slate-400">${idx + 1} / ${rendered.length}</span>
      `;

            // Body — render inside a sandboxed div (no iframes needed for preview)
            const body = document.createElement('div');
            body.className = 'response-card-body';

            const preview = document.createElement('div');
            preview.className = 'border border-slate-100 rounded-xl p-4 bg-slate-50 text-sm overflow-auto max-h-96';

            // Render HTML preview (safe: no script execution in innerHTML for content,
            // but we do want to show the user's styled template)
            preview.innerHTML = this._stripScripts(html);

            body.appendChild(preview);

            // Quick field summary
            const summary = this._buildFieldSummary(records[idx]);
            body.appendChild(summary);

            card.appendChild(header);
            card.appendChild(body);
            this.container.appendChild(card);
        });
    }

    _buildFieldSummary(record) {
        const wrap = document.createElement('div');
        wrap.className = 'mt-3 pt-3 border-t border-slate-100';

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 gap-x-4 gap-y-1';

        const entries = Object.entries(record).slice(0, 6);
        entries.forEach(([key, val]) => {
            const item = document.createElement('div');
            item.className = 'text-xs';
            item.innerHTML = `<span class="text-slate-400">${this._esc(key)}: </span><span class="text-slate-600 font-500">${this._esc(String(val).slice(0, 40))}${String(val).length > 40 ? '…' : ''}</span>`;
            grid.appendChild(item);
        });

        if (Object.keys(record).length > 6) {
            const more = document.createElement('div');
            more.className = 'text-xs text-slate-300 col-span-2 mt-1';
            more.textContent = `+${Object.keys(record).length - 6}개 필드 더 있음`;
            grid.appendChild(more);
        }

        wrap.appendChild(grid);
        return wrap;
    }

    _stripScripts(html) {
        return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }

    _esc(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
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

    _bindNavigation() {
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => {
                if (this.currentPage > 0) {
                    this.currentPage--;
                    this._scrollToPage(this.currentPage);
                    this._updateNav();
                }
            });
        }

        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => {
                if (this.currentPage < this.totalPages - 1) {
                    this.currentPage++;
                    this._scrollToPage(this.currentPage);
                    this._updateNav();
                }
            });
        }
    }

    _scrollToPage(idx) {
        const cards = this.container ? this.container.querySelectorAll('.response-card') : [];
        if (cards[idx]) {
            cards[idx].scrollIntoView({behavior: 'smooth', block: 'start'});
        }
    }

    _updateNav() {
        if (this.counterEl) {
            this.counterEl.textContent = `${this.currentPage + 1} / ${this.totalPages}`;
        }
        if (this.prevBtn) this.prevBtn.disabled = this.currentPage <= 0;
        if (this.nextBtn) this.nextBtn.disabled = this.currentPage >= this.totalPages - 1;
    }
}

window.PreviewRenderer = PreviewRenderer;
