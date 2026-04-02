/**
 * app.js
 * 메인 애플리케이션 조율 (v2)
 *
 * 개선 사항:
 *  - window.* 전역 노출 제거 (insertIntoEditor 포함)
 *  - 모든 동적 이벤트 → addEventListener (onclick 인라인 제거)
 *  - handleCSVFile: 로딩 상태 + 인코딩 경고 UI
 *  - refreshAvailableFields: textContent + addEventListener → XSS 차단
 *  - 비동기 렌더링 완료 대기 후 PDF 빌드
 */

(function () {
    'use strict';

    // ────────────────────────────────────────────────
    //  상태 (State)
    // ────────────────────────────────────────────────

    const state = {
        csvData: null,      // { headers, records, rowCount, resolvedEncoding }
        templateEngine: new TemplateEngine(),
        renderedPages: [],        // string[] — pdfGenerator와 공유
        activeTemplateKey: 'classic',
        isRendering: false,
    };

    // ────────────────────────────────────────────────
    //  모듈 인스턴스
    // ────────────────────────────────────────────────

    const tabManager = new TabManager('tab-nav');

    const previewRenderer = new PreviewRenderer({
        containerId: 'preview-container',
        emptyId: 'preview-empty',
        subtitleId: 'preview-subtitle',
        counterElId: 'page-counter',
        prevBtnId: 'prev-page-btn',
        nextBtnId: 'next-page-btn',
        progressBarId: 'preview-progress',
    });

    const pdfGenerator = new PDFGenerator({
        printAreaId: 'print-area',
        pdfContainerId: 'pdf-pages-container',
        pdfEmptyId: 'pdf-preview-empty',
    });

    // ────────────────────────────────────────────────
    //  탭 전환 핸들러
    // ────────────────────────────────────────────────

    tabManager.on('change', ({to}) => {
        if (to === 'template') {
            _refreshAvailableFields();
            _refreshTemplatePresets();
            _triggerTemplatePreview();
        }
        if (to === 'pdf') {
            _buildPDFPreview();
        }
    });

    // ────────────────────────────────────────────────
    //  파일 업로드
    // ────────────────────────────────────────────────

    new FileUploader({
        dropZoneId: 'drop-zone',
        inputId: 'csv-input',
        accept: ['.csv'],
        onFile: _handleCSVFile,
        onError: msg => _showToast(msg, 'error'),
    });

    Utils.byId('clear-file-btn')?.addEventListener('click', () => {
        state.csvData = null;
        state.renderedPages = [];
        _hideFileInfo();
        _updateStatusBadge();
        _showToast('파일이 초기화되었습니다.');
    });

    // ────────────────────────────────────────────────
    //  CSV 파싱 핸들러
    // ────────────────────────────────────────────────

    async function _handleCSVFile(file) {
        const encoding = Utils.byId('encoding-select')?.value || 'auto';
        const emptyValue = Utils.byId('empty-val-select')?.value ?? 'No answer';

        _setDropZoneLoading(true);

        try {
            // 마이크로태스크 양보 → 로딩 상태 화면 적용 후 파싱 시작
            await new Promise(r => setTimeout(r, 30));

            const result = await CSVParser.fromFile(file, encoding, {emptyValue});
            state.csvData = result;

            // 인코딩 경고 표시
            if (result.encodingWarning) {
                _showToast(
                    `텍스트가 깨져 보이면 인코딩을 "${result.encodingWarning}"으로 변경하세요.`,
                    'error',
                    6000
                );
            } else {
                _showToast(`✓ ${result.rowCount}개 응답 파싱 완료 (${result.resolvedEncoding})`, 'success');
            }

            _showFileInfo(file, result);
            _showDataPreview(result);
            _updateStatusBadge();

            // CSV 로드 후 프리셋 템플릿 자동 재생성
            if (state.activeTemplateKey !== 'custom') {
                _applyPresetTemplate(state.activeTemplateKey);
            }

        } catch (err) {
            _showToast(`파싱 오류: ${err.message}`, 'error', 8000);
        } finally {
            _setDropZoneLoading(false);
        }
    }

    function _setDropZoneLoading(loading) {
        const dz = Utils.byId('drop-zone');
        const spinner = Utils.byId('drop-zone-spinner');
        if (!dz) return;
        dz.classList.toggle('opacity-60', loading);
        dz.classList.toggle('pointer-events-none', loading);
        if (spinner) spinner.classList.toggle('hidden', !loading);
    }

    // ────────────────────────────────────────────────
    //  파일 정보 UI
    // ────────────────────────────────────────────────

    function _showFileInfo(file, result) {
        const infoEl = Utils.byId('file-info');
        const nameEl = Utils.byId('file-name-display');
        const metaEl = Utils.byId('file-meta-display');
        const tagsEl = Utils.byId('header-tags');
        if (!infoEl) return;

        infoEl.classList.remove('hidden');

        // textContent로 XSS 차단
        if (nameEl) nameEl.textContent = file.name;
        if (metaEl) metaEl.textContent =
            `${result.rowCount}행 · ${result.headers.length}열 · ${Utils.formatFileSize(file.size)}`;

        // 헤더 태그: addEventListener로 삽입 (onclick 인라인 없음)
        if (tagsEl) {
            tagsEl.innerHTML = '';
            const frag = document.createDocumentFragment();
            result.headers.forEach(h => {
                const tag = Utils.createElement('span', {class: 'field-tag mr-1 mb-1'});
                tag.textContent = `{{${h}}}`;
                tag.title = '클릭하여 템플릿 에디터에 삽입';
                tag.addEventListener('click', () => _insertIntoEditor(`{{${h}}}`));
                frag.appendChild(tag);
            });
            tagsEl.appendChild(frag);
        }
    }

    function _hideFileInfo() {
        const infoEl = Utils.byId('file-info');
        const preview = Utils.byId('data-preview');
        if (infoEl) infoEl.classList.add('hidden');
        if (preview) {
            preview.innerHTML = '';
            const msg = Utils.createElement('div', {class: 'text-slate-400 text-sm text-center py-8'});
            msg.textContent = 'CSV 파일을 업로드하면 여기에 데이터가 표시됩니다.';
            preview.appendChild(msg);
        }
    }

    function _showDataPreview(result) {
        const el = Utils.byId('data-preview');
        if (!el) return;

        const maxCols = Math.min(result.headers.length, 5);
        const maxRows = Math.min(result.records.length, 5);
        const headers = result.headers.slice(0, maxCols);

        // 테이블 생성 (createElement 사용, textContent로 데이터 삽입)
        const table = Utils.createElement('div', {class: 'overflow-x-auto'});
        const tbl = Utils.createElement('table', {class: 'preview-table'});
        const thead = Utils.createElement('thead');
        const hRow = Utils.createElement('tr');

        headers.forEach(h => {
            const th = Utils.createElement('th');
            th.textContent = h;
            hRow.appendChild(th);
        });
        thead.appendChild(hRow);

        const tbody = Utils.createElement('tbody');
        result.records.slice(0, maxRows).forEach(rec => {
            const tr = Utils.createElement('tr');
            headers.forEach(h => {
                const td = Utils.createElement('td');
                const val = String(rec[h] || '');
                td.textContent = val.length > 25 ? val.slice(0, 25) + '…' : val;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        tbl.appendChild(thead);
        tbl.appendChild(tbody);
        table.appendChild(tbl);

        el.innerHTML = '';
        el.appendChild(table);

        if (result.headers.length > maxCols) {
            const more = Utils.createElement('p', {class: 'text-xs text-slate-400 mt-2'});
            more.textContent = `+${result.headers.length - maxCols}개 열 더 있음`;
            el.appendChild(more);
        }
        if (result.rowCount > maxRows) {
            const moreR = Utils.createElement('p', {class: 'text-xs text-slate-400 mt-1'});
            moreR.textContent = `+${result.rowCount - maxRows}개 행 더 있음`;
            el.appendChild(moreR);
        }
    }

    // ────────────────────────────────────────────────
    //  템플릿 프리셋 UI
    // ────────────────────────────────────────────────

    function _refreshTemplatePresets() {
        const container = Utils.byId('template-presets');
        if (!container) return;
        container.innerHTML = '';

        const frag = document.createDocumentFragment();
        Object.entries(DEFAULT_TEMPLATES).forEach(([key, tpl]) => {
            const card = Utils.createElement('button', {
                class: `preset-card ${state.activeTemplateKey === key ? 'selected' : ''}`,
                type: 'button',
            });
            card.dataset.key = key;

            const icon = Utils.createElement('div', {class: 'preset-icon bg-slate-100'});
            icon.textContent = tpl.icon;

            const info = Utils.createElement('div');
            const name = Utils.createElement('div', {class: 'font-600 text-sm'});
            name.textContent = tpl.name;
            const desc = Utils.createElement('div', {class: 'text-xs text-slate-400 font-400'});
            desc.textContent = tpl.description;
            info.appendChild(name);
            info.appendChild(desc);

            card.appendChild(icon);
            card.appendChild(info);

            card.addEventListener('click', () => {
                state.activeTemplateKey = key;
                _applyPresetTemplate(key);
                _refreshTemplatePresets();
                _triggerTemplatePreview();
            });

            frag.appendChild(card);
        });
        container.appendChild(frag);
    }

    function _applyPresetTemplate(key) {
        const tpl = DEFAULT_TEMPLATES[key];
        if (!tpl) return;

        const headers = state.csvData?.headers || [];
        const html = tpl.generate(headers);
        const editor = Utils.byId('template-editor');
        if (editor) editor.value = html;
        state.templateEngine.setTemplate(html);
    }

    // ────────────────────────────────────────────────
    //  템플릿 에디터
    // ────────────────────────────────────────────────

    /**
     * 사용 가능 필드 목록 (XSS 안전: textContent + addEventListener)
     */
    function _refreshAvailableFields() {
        const el = Utils.byId('available-fields');
        if (!el) return;
        el.innerHTML = '';

        if (!state.csvData) {
            const msg = Utils.createElement('p', {class: 'text-slate-400 text-sm'});
            msg.textContent = 'CSV를 먼저 업로드하면 사용 가능한 필드 목록이 표시됩니다.';
            el.appendChild(msg);
            return;
        }

        const frag = document.createDocumentFragment();
        const wrap = Utils.createElement('div', {class: 'flex flex-wrap gap-1'});

        // 데이터 필드
        state.csvData.headers.forEach(h => {
            const tag = Utils.createElement('span', {class: 'field-tag'});
            tag.textContent = `{{${h}}}`;
            tag.title = '클릭하여 에디터에 삽입';
            tag.addEventListener('click', () => _insertIntoEditor(`{{${h}}}`));
            wrap.appendChild(tag);
        });

        frag.appendChild(wrap);

        // 시스템 변수
        const sysWrap = Utils.createElement('div', {class: 'mt-3 pt-3 border-t border-slate-100'});
        const sysLabel = Utils.createElement('p', {class: 'text-xs text-slate-400 mb-2'});
        sysLabel.textContent = '시스템 변수';
        sysWrap.appendChild(sysLabel);

        [
            {key: '_index', label: '현재 응답 번호'},
            {key: '_total', label: '전체 응답 수'},
        ].forEach(({key, label}) => {
            const tag = Utils.createElement('span', {class: 'field-tag mr-1'});
            tag.textContent = `{{${key}}}`;
            tag.title = label;
            tag.addEventListener('click', () => _insertIntoEditor(`{{${key}}}`));
            sysWrap.appendChild(tag);
        });

        frag.appendChild(sysWrap);
        el.appendChild(frag);
    }

    /** 에디터 커서 위치에 텍스트 삽입 (전역 노출 없음) */
    function _insertIntoEditor(text) {
        const editor = Utils.byId('template-editor');
        if (!editor) return;

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.slice(0, start) + text + editor.value.slice(end);
        editor.selectionStart = editor.selectionEnd = start + text.length;
        editor.focus();
        _syncTemplateFromEditor();
    }

    function _syncTemplateFromEditor() {
        const editor = Utils.byId('template-editor');
        if (!editor) return;
        state.templateEngine.setTemplate(editor.value);
        state.activeTemplateKey = 'custom';
        // 선택 표시만 업데이트 (전체 재생성 없이)
        _updatePresetSelection('custom');
    }

    function _updatePresetSelection(key) {
        Utils.byId('template-presets')
            ?.querySelectorAll('.preset-card')
            .forEach(card => card.classList.toggle('selected', card.dataset.key === key));
    }

    // 에디터 입력 → 디바운스 동기화
    Utils.byId('template-editor')?.addEventListener(
        'input',
        Utils.debounce(_syncTemplateFromEditor, 300)
    );

    // 템플릿 파일 업로드
    Utils.byId('upload-template-btn')?.addEventListener('click', () => {
        Utils.byId('template-file-input')?.click();
    });

    Utils.byId('template-file-input')?.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 500_000) {
            _showToast('템플릿 파일이 너무 큽니다 (500KB 초과).', 'error');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const html = ev.target.result;
                const editor = Utils.byId('template-editor');
                if (editor) editor.value = html;
                state.templateEngine.setTemplate(html);
                state.activeTemplateKey = 'custom';
                _refreshTemplatePresets();
                _triggerTemplatePreview();
                _showToast('템플릿 파일 로드 완료', 'success');
            } catch (err) {
                _showToast(`템플릿 로드 오류: ${err.message}`, 'error');
            }
        };
        reader.onerror = () => _showToast('템플릿 파일을 읽을 수 없습니다.', 'error');
        reader.readAsText(file, 'UTF-8');
        e.target.value = '';
    });

    // 미리보기 새로고침 버튼
    Utils.byId('refresh-template-preview')?.addEventListener('click', _triggerTemplatePreview);

    function _triggerTemplatePreview() {
        const frameEl = Utils.byId('template-preview-frame');
        if (!frameEl) return;

        const template = state.templateEngine.template;
        if (!template?.trim()) {
            frameEl.innerHTML = '';
            const msg = Utils.createElement('p', {class: 'text-slate-400 text-center py-8'});
            msg.textContent = '템플릿을 입력하세요.';
            frameEl.appendChild(msg);
            return;
        }

        const sampleRecord = state.csvData?.records?.[0] || {};
        const sampleMeta = {_index: 1, _total: state.csvData?.rowCount || 'N'};

        try {
            const rendered = state.templateEngine.render(sampleRecord, sampleMeta);
            // 미리보기도 sanitize 적용
            frameEl.innerHTML = Utils.sanitizeHTML(rendered, 'template');
        } catch (err) {
            frameEl.innerHTML = '';
            const errMsg = Utils.createElement('p', {class: 'text-red-400 text-xs'});
            errMsg.textContent = `렌더링 오류: ${err.message}`;
            frameEl.appendChild(errMsg);
        }
    }

    // ────────────────────────────────────────────────
    //  미리보기 탭
    // ────────────────────────────────────────────────

    Utils.byId('render-preview-btn')?.addEventListener('click', async () => {
        if (!state.csvData) {
            _showToast('먼저 CSV 파일을 업로드하세요.', 'error');
            tabManager.switchTo('upload');
            return;
        }

        const templateHtml = Utils.byId('template-editor')?.value || '';
        if (!templateHtml.trim()) {
            _showToast('템플릿을 설정하세요.', 'error');
            tabManager.switchTo('template');
            return;
        }

        if (state.isRendering) return;
        state.isRendering = true;

        const btn = Utils.byId('render-preview-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '렌더링 중...';
        }

        try {
            state.templateEngine.setTemplate(templateHtml);
            const pages = await previewRenderer.render(state.csvData.records, state.templateEngine);
            state.renderedPages = pages;
            _showToast(`✓ ${state.csvData.rowCount}개 응답 렌더링 완료`, 'success');
        } catch (err) {
            _showToast(`렌더링 오류: ${err.message}`, 'error');
        } finally {
            state.isRendering = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = '렌더링';
            }
        }
    });

    // ────────────────────────────────────────────────
    //  PDF 탭
    // ────────────────────────────────────────────────

    function _buildPDFPreview() {
        if (state.renderedPages.length === 0) return;
        const batchSize = parseInt(
            document.querySelector('input[name="batch-size"]:checked')?.value || '1', 10
        );
        const orientation = Utils.byId('page-orientation')?.value || 'portrait';
        pdfGenerator.build(state.renderedPages, batchSize, orientation);
    }

    Utils.byId('print-btn')?.addEventListener('click', () => {
        if (state.renderedPages.length === 0) {
            _showToast('미리보기 탭에서 먼저 렌더링을 실행하세요.', 'error');
            tabManager.switchTo('preview');
            return;
        }
        _buildPDFPreview();
        pdfGenerator.print();
    });

    document.querySelectorAll('input[name="batch-size"]').forEach(r => {
        r.addEventListener('change', _buildPDFPreview);
    });
    Utils.byId('page-orientation')?.addEventListener('change', _buildPDFPreview);

    // ────────────────────────────────────────────────
    //  상태 배지
    // ────────────────────────────────────────────────

    function _updateStatusBadge() {
        const badge = Utils.byId('status-badge');
        const text = Utils.byId('status-text');
        if (!badge || !text) return;

        if (state.csvData) {
            badge.classList.remove('hidden');
            badge.classList.add('flex');
            text.textContent = `${state.csvData.rowCount}개 응답 로드됨`;
        } else {
            badge.classList.add('hidden');
            badge.classList.remove('flex');
        }
    }

    // ────────────────────────────────────────────────
    //  토스트
    // ────────────────────────────────────────────────

    let _toastTimer = null;

    function _showToast(msg, type = 'success', duration = 3500) {
        const el = Utils.byId('toast');
        const msgEl = Utils.byId('toast-message');
        const iconEl = Utils.byId('toast-icon');
        if (!el || !msgEl) return;

        const ICONS = {success: '✓', error: '✕', info: 'ℹ'};
        const COLORS = {success: 'bg-slate-800', error: 'bg-red-600', info: 'bg-indigo-600'};

        el.className = el.className
                .replace(/bg-\S+/g, '')
                .trim()
            + ` ${COLORS[type] || COLORS.success}`;

        if (iconEl) iconEl.textContent = ICONS[type] || '✓';
        // textContent로 삽입 → 메시지 XSS 차단
        msgEl.textContent = msg;

        el.classList.add('show');
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
    }

    // ────────────────────────────────────────────────
    //  초기화
    // ────────────────────────────────────────────────

    function _init() {
        _applyPresetTemplate('classic');
        _refreshTemplatePresets();
        _triggerTemplatePreview();
    }

    _init();

})();
