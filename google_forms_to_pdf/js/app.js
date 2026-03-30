/**
 * app.js
 * 메인 애플리케이션 조율
 * CSV Parser + Template Engine + Preview + PDF Generator 연결
 */

(function () {
    'use strict';

    /* ==============================
       STATE
       ============================== */
    const state = {
        csvData: null,        // { headers, records, rowCount }
        templateEngine: new TemplateEngine(),
        renderedPages: [],    // string[]
        activeTemplateKey: 'classic',
    };

    /* ==============================
       MODULE INSTANCES
       ============================== */
    const tabManager = new TabManager('tab-nav');

    const previewRenderer = new PreviewRenderer({
        containerId: 'preview-container',
        emptyId: 'preview-empty',
        subtitleId: 'preview-subtitle',
        counterElId: 'page-counter',
        prevBtnId: 'prev-page-btn',
        nextBtnId: 'next-page-btn',
    });

    const pdfGenerator = new PDFGenerator({
        printAreaId: 'print-area',
        pdfContainerId: 'pdf-pages-container',
        pdfEmptyId: 'pdf-preview-empty',
    });

    /* ==============================
       TAB CHANGE HANDLER
       ============================== */
    tabManager.on('change', ({to}) => {
        if (to === 'template') {
            refreshAvailableFields();
            refreshTemplatePresets();
            triggerTemplatePreview();
        }
        if (to === 'pdf') {
            buildPDFPreview();
        }
    });

    /* ==============================
       FILE UPLOADER (CSV)
       ============================== */
    new FileUploader({
        dropZoneId: 'drop-zone',
        inputId: 'csv-input',
        accept: ['.csv'],
        onFile: handleCSVFile,
        onError: (msg) => showToast(msg, 'error'),
    });

    document.getElementById('clear-file-btn')?.addEventListener('click', () => {
        state.csvData = null;
        state.renderedPages = [];
        hideFileInfo();
        updateStatusBadge();
        showToast('파일이 초기화되었습니다.');
    });

    async function handleCSVFile(file) {
        const encoding = document.getElementById('encoding-select')?.value || 'auto';
        const emptyValue = document.getElementById('empty-val-select')?.value ?? 'No answer';

        try {
            showToast('CSV 파싱 중...', 'info');
            const result = await CSVParser.fromFile(file, encoding, {emptyValue});
            state.csvData = result;

            showFileInfo(file, result);
            showDataPreview(result);
            updateStatusBadge();
            showToast(`✓ ${result.rowCount}개 응답 파싱 완료`, 'success');

            // Auto-generate template if using a preset
            if (state.activeTemplateKey !== 'custom') {
                applyPresetTemplate(state.activeTemplateKey);
            }

        } catch (err) {
            showToast(`파싱 오류: ${err.message}`, 'error');
        }
    }

    /* ==============================
       FILE INFO UI
       ============================== */
    function showFileInfo(file, result) {
        const infoEl = document.getElementById('file-info');
        const nameEl = document.getElementById('file-name-display');
        const metaEl = document.getElementById('file-meta-display');
        const tagsEl = document.getElementById('header-tags');

        if (!infoEl) return;
        infoEl.classList.remove('hidden');
        nameEl.textContent = file.name;
        metaEl.textContent = `${result.rowCount}행 · ${result.headers.length}열`;

        tagsEl.innerHTML = '';
        result.headers.forEach(h => {
            const tag = document.createElement('span');
            tag.className = 'field-tag mr-1 mb-1';
            tag.textContent = `{{${h}}}`;
            tag.title = '클릭하여 템플릿 에디터에 삽입';
            tag.addEventListener('click', () => insertIntoEditor(`{{${h}}}`));
            tagsEl.appendChild(tag);
        });
    }

    function hideFileInfo() {
        const infoEl = document.getElementById('file-info');
        const previewEl = document.getElementById('data-preview');
        if (infoEl) infoEl.classList.add('hidden');
        if (previewEl) previewEl.innerHTML = '<div class="text-slate-400 text-sm text-center py-8">CSV 파일을 업로드하면<br/>여기에 데이터가 표시됩니다.</div>';
    }

    function showDataPreview(result) {
        const el = document.getElementById('data-preview');
        if (!el) return;

        const maxCols = Math.min(result.headers.length, 4);
        const maxRows = Math.min(result.records.length, 5);

        const headers = result.headers.slice(0, maxCols);
        const ths = headers.map(h => `<th>${esc(h)}</th>`).join('');
        const rows = result.records.slice(0, maxRows).map(rec => {
            const tds = headers.map(h => `<td>${esc(String(rec[h] || '').slice(0, 20))}</td>`).join('');
            return `<tr>${tds}</tr>`;
        }).join('');

        const extra = result.headers.length > maxCols ? `<p class="text-xs text-slate-400 mt-2">+${result.headers.length - maxCols}개 열 더 있음</p>` : '';
        const extraRows = result.rowCount > maxRows ? `<p class="text-xs text-slate-400 mt-1">+${result.rowCount - maxRows}개 행 더 있음</p>` : '';

        el.innerHTML = `<div class="overflow-x-auto"><table class="preview-table"><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table></div>${extra}${extraRows}`;
    }

    /* ==============================
       TEMPLATE PRESETS UI
       ============================== */
    function refreshTemplatePresets() {
        const container = document.getElementById('template-presets');
        if (!container) return;
        container.innerHTML = '';

        Object.entries(DEFAULT_TEMPLATES).forEach(([key, tpl]) => {
            const card = document.createElement('button');
            card.className = `preset-card ${state.activeTemplateKey === key ? 'selected' : ''}`;
            card.dataset.key = key;

            card.innerHTML = `
        <div class="preset-icon bg-slate-100">${tpl.icon}</div>
        <div>
          <div class="font-600 text-sm">${tpl.name}</div>
          <div class="text-xs text-slate-400 font-400">${tpl.description}</div>
        </div>
      `;

            card.addEventListener('click', () => {
                state.activeTemplateKey = key;
                applyPresetTemplate(key);
                refreshTemplatePresets();
                triggerTemplatePreview();
            });

            container.appendChild(card);
        });
    }

    function applyPresetTemplate(key) {
        const tpl = DEFAULT_TEMPLATES[key];
        if (!tpl) return;

        const headers = state.csvData?.headers || [];
        const html = tpl.generate(headers);

        const editor = document.getElementById('template-editor');
        if (editor) editor.value = html;

        state.templateEngine.setTemplate(html);
    }

    /* ==============================
       TEMPLATE EDITOR
       ============================== */
    function refreshAvailableFields() {
        const el = document.getElementById('available-fields');
        if (!el) return;

        if (!state.csvData) {
            el.innerHTML = '<p class="text-slate-400 text-sm">CSV를 먼저 업로드하면 사용 가능한 필드 목록이 표시됩니다.</p>';
            return;
        }

        const tags = state.csvData.headers.map(h => `
      <span class="field-tag mr-1 mb-1 cursor-pointer" onclick="insertIntoEditor('{{${h}}}')" title="클릭하여 에디터에 삽입">{{${esc(h)}}}</span>
    `).join('');

        const system = `
      <div class="mt-3 pt-3 border-t border-slate-100">
        <p class="text-xs text-slate-400 mb-2">시스템 변수</p>
        <span class="field-tag mr-1 mb-1" onclick="insertIntoEditor('{{_index}}')" title="현재 응답 번호">{{_index}}</span>
        <span class="field-tag mr-1 mb-1" onclick="insertIntoEditor('{{_total}}')" title="전체 응답 수">{{_total}}</span>
      </div>
    `;

        el.innerHTML = `<div class="flex flex-wrap">${tags}</div>${system}`;
    }

    function insertIntoEditor(text) {
        const editor = document.getElementById('template-editor');
        if (!editor) return;

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const before = editor.value.slice(0, start);
        const after = editor.value.slice(end);
        editor.value = before + text + after;
        editor.selectionStart = editor.selectionEnd = start + text.length;
        editor.focus();

        syncTemplateFromEditor();
    }

    window.insertIntoEditor = insertIntoEditor;

    function syncTemplateFromEditor() {
        const editor = document.getElementById('template-editor');
        if (editor) {
            state.templateEngine.setTemplate(editor.value);
            state.activeTemplateKey = 'custom';
            refreshTemplatePresets();
        }
    }

    // Live sync editor → engine
    document.getElementById('template-editor')?.addEventListener('input', syncTemplateFromEditor);

    // Upload custom HTML template
    document.getElementById('upload-template-btn')?.addEventListener('click', () => {
        document.getElementById('template-file-input')?.click();
    });

    document.getElementById('template-file-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const html = ev.target.result;
            const editor = document.getElementById('template-editor');
            if (editor) editor.value = html;
            state.templateEngine.setTemplate(html);
            state.activeTemplateKey = 'custom';
            refreshTemplatePresets();
            triggerTemplatePreview();
            showToast('템플릿 파일 로드 완료', 'success');
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = '';
    });

    // Refresh preview button
    document.getElementById('refresh-template-preview')?.addEventListener('click', triggerTemplatePreview);

    function triggerTemplatePreview() {
        const frameEl = document.getElementById('template-preview-frame');
        if (!frameEl) return;

        const template = state.templateEngine.template;
        if (!template) {
            frameEl.innerHTML = '<p class="text-slate-400 text-center py-8">템플릿을 입력하세요.</p>';
            return;
        }

        // Use first record as sample, or dummy data
        const sampleRecord = state.csvData?.records?.[0] || {};
        const sampleMeta = {_index: 1, _total: state.csvData?.rowCount || 'N'};

        try {
            const rendered = state.templateEngine.render(sampleRecord, sampleMeta);
            frameEl.innerHTML = rendered;
        } catch (e) {
            frameEl.innerHTML = `<p class="text-red-400 text-xs">렌더링 오류: ${esc(e.message)}</p>`;
        }
    }

    /* ==============================
       PREVIEW TAB
       ============================== */
    document.getElementById('render-preview-btn')?.addEventListener('click', () => {
        if (!state.csvData) {
            showToast('먼저 CSV 파일을 업로드하세요.', 'error');
            tabManager.switchTo('upload');
            return;
        }

        const templateHtml = document.getElementById('template-editor')?.value || '';
        if (!templateHtml.trim()) {
            showToast('템플릿을 설정하세요.', 'error');
            tabManager.switchTo('template');
            return;
        }

        state.templateEngine.setTemplate(templateHtml);
        state.renderedPages = state.templateEngine.renderAll(state.csvData.records);
        previewRenderer.render(state.csvData.records, state.templateEngine);
        showToast(`✓ ${state.csvData.rowCount}개 응답 렌더링 완료`, 'success');
    });

    /* ==============================
       PDF TAB
       ============================== */
    function buildPDFPreview() {
        if (state.renderedPages.length === 0) return;

        const batchSize = parseInt(document.querySelector('input[name="batch-size"]:checked')?.value || '2', 10);
        const orientation = document.getElementById('page-orientation')?.value || 'portrait';
        pdfGenerator.build(state.renderedPages, batchSize, orientation);
    }

    document.getElementById('print-btn')?.addEventListener('click', () => {
        if (state.renderedPages.length === 0) {
            showToast('미리보기 탭에서 먼저 렌더링을 실행하세요.', 'error');
            tabManager.switchTo('preview');
            return;
        }

        const batchSize = parseInt(document.querySelector('input[name="batch-size"]:checked')?.value || '2', 10);
        const orientation = document.getElementById('page-orientation')?.value || 'portrait';
        pdfGenerator.build(state.renderedPages, batchSize, orientation);
        pdfGenerator.print();
    });

    // Rebuild preview when options change
    document.querySelectorAll('input[name="batch-size"]').forEach(radio => {
        radio.addEventListener('change', buildPDFPreview);
    });
    document.getElementById('page-orientation')?.addEventListener('change', buildPDFPreview);

    /* ==============================
       STATUS BADGE
       ============================== */
    function updateStatusBadge() {
        const badge = document.getElementById('status-badge');
        const text = document.getElementById('status-text');
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

    /* ==============================
       TOAST NOTIFICATION
       ============================== */
    let toastTimeout;

    function showToast(msg, type = 'success') {
        const el = document.getElementById('toast');
        const msgEl = document.getElementById('toast-message');
        const iconEl = document.getElementById('toast-icon');
        if (!el || !msgEl) return;

        const icons = {success: '✓', error: '✕', info: 'ℹ'};
        const colors = {
            success: 'bg-slate-900',
            error: 'bg-red-600',
            info: 'bg-indigo-600',
        };

        // Reset color classes
        el.classList.remove('bg-slate-900', 'bg-red-600', 'bg-indigo-600');
        el.classList.add(colors[type] || 'bg-slate-900');

        if (iconEl) iconEl.textContent = icons[type] || '✓';
        msgEl.textContent = msg;

        el.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => el.classList.remove('show'), 3000);
    }

    /* ==============================
       UTILS
       ============================== */
    function esc(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /* ==============================
       INIT
       ============================== */
    function init() {
        // Default template (classic) loaded but no CSV yet
        applyPresetTemplate('classic');
        refreshTemplatePresets();
        triggerTemplatePreview();
    }

    init();
})();
