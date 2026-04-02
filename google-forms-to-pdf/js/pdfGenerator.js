/**
 * pdfGenerator.js
 * window.print() 기반 PDF 생성 (v2)
 *
 * 개선 사항:
 *  - DOM 높이 측정으로 실제 페이지 수 추정 (batchPadding 정확도 향상)
 *  - 프리뷰 innerHTML → sanitizeHTML 적용
 *  - orientation 스타일 충돌 해결
 *  - 인쇄 전/후 상태 관리 명확화
 */

'use strict';

class PDFGenerator {
    /**
     * @param {object} options
     * @param {string} options.printAreaId
     * @param {string} options.pdfContainerId
     * @param {string} options.pdfEmptyId
     */
    constructor(options = {}) {
        this.printArea = Utils.byId(options.printAreaId || 'print-area');
        this.pdfContainer = Utils.byId(options.pdfContainerId || 'pdf-pages-container');
        this.pdfEmpty = Utils.byId(options.pdfEmptyId || 'pdf-preview-empty');
        this.statCount = Utils.byId('stat-count');
        this.statPages = Utils.byId('stat-pages');

        // 프린트 완료 후 클린업을 위한 타임아웃 ID
        this._printCleanupTimer = null;
    }

    // ─── 공개 메서드 ─────────────────────────────────────────

    /**
     * 렌더링된 HTML 배열로 인쇄 영역과 미리보기 구성
     * @param {string[]} renderedPages
     * @param {number}   batchSize   - 1|2|4
     * @param {string}   orientation - 'portrait'|'landscape'
     */
    build(renderedPages, batchSize = 1, orientation = 'portrait') {
        if (!renderedPages || renderedPages.length === 0) {
            this._showEmpty();
            return;
        }

        // 실제 페이지 수 추정 (DOM 측정)
        const pageGroups = this._estimatePageGroups(renderedPages);
        const padded = this._applyBatchPadding(pageGroups, batchSize);

        // 인쇄 영역 HTML 구성
        const printHTML = padded.map(p => p.blank
            ? `<div class="blank-page"></div>`
            : `<div class="page">${p.html}</div>`
        ).join('\n');

        if (this.printArea) {
            // sanitize 후 삽입 (이벤트 핸들러 제거, style 태그 보존)
            this.printArea.innerHTML = Utils.sanitizeHTML(printHTML, 'template');
        }

        this._buildPreview(padded);
        this._applyOrientationStyle(orientation);

        // 통계 업데이트
        const realCount = padded.filter(p => !p.blank).length;
        const blankCount = padded.length - realCount;
        if (this.statCount) this.statCount.textContent = `${renderedPages.length}명`;
        if (this.statPages) this.statPages.textContent =
            `총 ${padded.length}페이지 (빈 페이지 ${blankCount}개)`;
    }

    /** 브라우저 인쇄 대화상자 호출 */
    print() {
        if (!this.printArea) return;

        clearTimeout(this._printCleanupTimer);
        this.printArea.classList.remove('hidden');

        window.print();

        // 인쇄 완료(또는 취소) 후 숨김
        this._printCleanupTimer = setTimeout(() => {
            this.printArea.classList.add('hidden');
        }, 1500);
    }

    // ─── 페이지 추정 ─────────────────────────────────────────

    /**
     * 각 응답 HTML을 숨김 div에 삽입해 실제 높이를 측정,
     * A4 인쇄 영역(약 267mm ≈ 1009px @ 96dpi)으로 페이지 수 추정
     *
     * @param {string[]} htmlPages
     * @returns {Array<{html: string, estimatedPages: number}>}
     */
    _estimatePageGroups(htmlPages) {
        const A4_PRINT_HEIGHT_PX = 1009; // 297mm - 30mm 마진 @ 96dpi

        // 측정용 숨김 컨테이너 (한 번만 생성)
        let probe = Utils.byId('__pdf-probe__');
        if (!probe) {
            probe = Utils.createElement('div', {
                id: '__pdf-probe__',
                style: [
                    'position:fixed',
                    'visibility:hidden',
                    'pointer-events:none',
                    'top:-9999px',
                    'left:-9999px',
                    'width:794px',   // A4 @ 96dpi (210mm)
                    'overflow:hidden',
                ].join(';'),
            });
            document.body.appendChild(probe);
        }

        return htmlPages.map(html => {
            probe.innerHTML = Utils.sanitizeHTML(html, 'template');
            const h = probe.scrollHeight || A4_PRINT_HEIGHT_PX;
            probe.innerHTML = '';
            const pages = Math.max(1, Math.ceil(h / A4_PRINT_HEIGHT_PX));
            return {html, estimatedPages: pages};
        });
    }

    /**
     * batchSize 배수가 되도록 빈 페이지 삽입
     * @param {Array<{html:string, estimatedPages:number}>} groups
     * @param {number} batchSize
     * @returns {Array<{html?:string, blank:boolean}>}
     */
    _applyBatchPadding(groups, batchSize) {
        if (batchSize <= 1) {
            return groups.map(g => ({html: g.html, blank: false}));
        }

        const result = [];
        groups.forEach(({html, estimatedPages}) => {
            result.push({html, blank: false});
            const remainder = estimatedPages % batchSize;
            if (remainder !== 0) {
                const blanks = batchSize - remainder;
                for (let k = 0; k < blanks; k++) {
                    result.push({blank: true});
                }
            }
        });
        return result;
    }

    // ─── 미리보기 구성 ────────────────────────────────────────

    _buildPreview(pages) {
        if (!this.pdfContainer) return;

        this.pdfContainer.innerHTML = '';
        const frag = document.createDocumentFragment();

        pages.forEach((page, idx) => {
            const wrap = Utils.createElement('div', {class: 'pdf-page-preview'});

            if (page.blank) {
                // 빈 페이지 표시
                wrap.style.opacity = '0.4';
                const label = Utils.createElement('div', {class: 'page-label'});
                label.textContent = `페이지 ${idx + 1} · 빈 페이지`;
                const msg = Utils.createElement('div', {
                    class: 'flex items-center justify-center h-20 text-slate-300 text-xs',
                });
                msg.textContent = '빈 페이지 (인쇄 배율 조정용)';
                wrap.appendChild(label);
                wrap.appendChild(msg);
            } else {
                const label = Utils.createElement('div', {class: 'page-label'});
                label.textContent = `페이지 ${idx + 1}`;

                const scale = Utils.createElement('div', {
                    style: [
                        'font-size:8px',
                        'transform:scale(0.65)',
                        'transform-origin:top left',
                        'width:154%',
                        'pointer-events:none',
                        'overflow:hidden',
                    ].join(';'),
                });
                // 미리보기에도 sanitize 적용
                scale.innerHTML = Utils.sanitizeHTML(page.html, 'template');

                wrap.appendChild(label);
                wrap.appendChild(scale);
            }

            frag.appendChild(wrap);
        });

        this.pdfContainer.appendChild(frag);
        this.pdfContainer.classList.remove('hidden');
        if (this.pdfEmpty) this.pdfEmpty.classList.add('hidden');
    }

    _showEmpty() {
        if (this.pdfContainer) this.pdfContainer.classList.add('hidden');
        if (this.pdfEmpty) this.pdfEmpty.classList.remove('hidden');
        if (this.statCount) this.statCount.textContent = '-';
        if (this.statPages) this.statPages.textContent = '-';
    }

    /**
     * orientation 스타일을 동적 <style> 태그로 주입
     * print.css의 @page와 충돌하지 않도록 ID로 단일 관리
     */
    _applyOrientationStyle(orientation) {
        const id = 'print-orientation-override';
        let el = Utils.byId(id);
        if (!el) {
            el = Utils.createElement('style', {id});
            document.head.appendChild(el);
        }
        el.textContent = `@media print { @page { size: A4 ${orientation}; margin: 15mm 12mm; } }`;
    }
}

window.PDFGenerator = PDFGenerator;
