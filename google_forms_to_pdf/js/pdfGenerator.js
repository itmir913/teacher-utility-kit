/**
 * pdfGenerator.js
 * window.print() 기반 PDF 생성
 * 빈 페이지 삽입(batch-size) 지원
 */

class PDFGenerator {
    /**
     * @param {string} printAreaId     - Hidden print area div ID
     * @param {string} pdfContainerId  - Visible PDF preview container ID
     * @param {string} pdfEmptyId      - Empty state div ID
     */
    constructor(options = {}) {
        this.printArea = document.getElementById(options.printAreaId || 'print-area');
        this.pdfContainer = document.getElementById(options.pdfContainerId || 'pdf-pages-container');
        this.pdfEmpty = document.getElementById(options.pdfEmptyId || 'pdf-preview-empty');

        this.statCount = document.getElementById('stat-count');
        this.statPages = document.getElementById('stat-pages');
    }

    /**
     * Build the print/PDF structure from rendered HTML pages.
     *
     * @param {string[]} renderedPages  - Array of per-response HTML strings
     * @param {number}   batchSize      - 1 = no padding, 2 = pad to multiple of 2, 4 = multiple of 4
     * @param {string}   orientation    - 'portrait' | 'landscape'
     */
    build(renderedPages, batchSize = 1, orientation = 'portrait') {
        if (!renderedPages || renderedPages.length === 0) {
            this._showEmpty();
            return;
        }

        const pages = this._applyBatchPadding(renderedPages, batchSize);

        // Build print area HTML
        const printHTML = pages.map(p => {
            if (p.blank) {
                return `<div class="blank-page"></div>`;
            }
            return `<div class="page">${p.html}</div>`;
        }).join('\n');

        if (this.printArea) {
            this.printArea.innerHTML = printHTML;
        }

        // Build visual preview
        this._buildPreview(pages, batchSize);

        // Update stats
        const realPages = pages.filter(p => !p.blank).length;
        const totalPages = pages.length;
        if (this.statCount) this.statCount.textContent = `${renderedPages.length}명`;
        if (this.statPages) this.statPages.textContent = `${totalPages}페이지 (빈 페이지 ${totalPages - realPages}개)`;

        // Set orientation CSS
        this._applyOrientation(orientation);
    }

    /**
     * Pad each response so that page groups are multiples of batchSize.
     * @param {string[]} pages
     * @param {number} batchSize
     * @returns {Array<{html?: string, blank: boolean}>}
     */
    _applyBatchPadding(pages, batchSize) {
        if (batchSize <= 1) {
            return pages.map(html => ({html, blank: false}));
        }

        const result = [];
        pages.forEach(html => {
            result.push({html, blank: false});
            // For this web implementation, we estimate 1 page per response.
            // Real page count would require rendering to DOM — approximate:
            const pageCount = 1;
            const remainder = pageCount % batchSize;
            if (remainder !== 0) {
                const blanksNeeded = batchSize - remainder;
                for (let i = 0; i < blanksNeeded; i++) {
                    result.push({blank: true});
                }
            }
        });

        return result;
    }

    _buildPreview(pages, batchSize) {
        if (!this.pdfContainer) return;

        this.pdfContainer.innerHTML = '';

        pages.forEach((page, idx) => {
            const wrap = document.createElement('div');
            wrap.className = 'pdf-page-preview';

            if (page.blank) {
                wrap.innerHTML = `
          <div class="page-label">페이지 ${idx + 1} · 빈 페이지</div>
          <div class="flex items-center justify-center h-24 text-slate-300 text-xs">빈 페이지 (인쇄 배율 조정)</div>
        `;
                wrap.style.opacity = '0.5';
            } else {
                const div = document.createElement('div');
                div.innerHTML = `<div class="page-label">페이지 ${idx + 1}</div>`;

                const content = document.createElement('div');
                content.style.fontSize = '8px';
                content.style.transform = 'scale(0.7)';
                content.style.transformOrigin = 'top left';
                content.style.width = '143%';
                content.style.pointerEvents = 'none';
                content.innerHTML = this._stripScripts(page.html);

                wrap.appendChild(div);
                wrap.appendChild(content);
            }

            this.pdfContainer.appendChild(wrap);
        });

        this.pdfContainer.classList.remove('hidden');
        if (this.pdfEmpty) this.pdfEmpty.classList.add('hidden');
    }

    _showEmpty() {
        if (this.pdfContainer) this.pdfContainer.classList.add('hidden');
        if (this.pdfEmpty) this.pdfEmpty.classList.remove('hidden');
    }

    _applyOrientation(orientation) {
        let styleEl = document.getElementById('print-orientation-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'print-orientation-style';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = `@media print { @page { size: A4 ${orientation}; margin: 15mm 12mm; } }`;
    }

    /**
     * Trigger the browser print dialog.
     */
    print() {
        if (this.printArea) {
            this.printArea.classList.remove('hidden');
        }
        window.print();
        if (this.printArea) {
            // Delay re-hiding so print dialog can read the DOM
            setTimeout(() => {
                this.printArea.classList.add('hidden');
            }, 1000);
        }
    }

    _stripScripts(html) {
        return (html || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
}

window.PDFGenerator = PDFGenerator;
