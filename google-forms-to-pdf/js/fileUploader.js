/**
 * fileUploader.js
 * 드래그 앤 드롭 + 클릭 업로드 처리 (v2)
 *
 * 개선 사항:
 *  - 파일 크기 사전 검사 (UI 레벨)
 *  - MIME 타입 + 확장자 이중 검증
 *  - 드래그 오버 시 파일 타입 사전 피드백
 *  - 전역 dragover 방어 (브라우저 파일 열기 차단)
 */

'use strict';

class FileUploader {
    /**
     * @param {object} options
     * @param {string}   options.dropZoneId  - 드롭 영역 요소 ID
     * @param {string}   options.inputId     - 숨김 파일 input ID
     * @param {string[]} options.accept      - 허용 확장자 목록 e.g. ['.csv']
     * @param {string[]} options.mimeTypes   - 허용 MIME 타입 목록
     * @param {number}   options.maxBytes    - 최대 파일 크기 (bytes), 기본 20MB
     * @param {Function} options.onFile      - (file: File) => void
     * @param {Function} options.onError     - (message: string) => void
     */
    constructor(options = {}) {
        this.dropZone = Utils.byId(options.dropZoneId);
        this.input = Utils.byId(options.inputId);
        this.accept = options.accept || ['.csv'];
        this.mimeTypes = options.mimeTypes || ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];
        this.maxBytes = options.maxBytes || 20 * 1024 * 1024;
        this.onFile = options.onFile || (() => {
        });
        this.onError = options.onError || console.error;

        this._init();
    }

    // ─── 초기화 ──────────────────────────────────────────────

    _init() {
        if (!this.dropZone || !this.input) {
            console.warn('[FileUploader] dropZone 또는 input 요소를 찾지 못했습니다.');
            return;
        }

        // 전역 드래그: 브라우저가 파일을 직접 열지 못하도록 방어
        document.addEventListener('dragover', e => e.preventDefault(), {passive: false});
        document.addEventListener('drop', e => e.preventDefault(), {passive: false});

        // 드롭존 클릭 → input 파일 다이얼로그
        this.dropZone.addEventListener('click', () => this.input.click());

        // input 변경 처리
        this.input.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) this._handle(file);
            this.input.value = ''; // 동일 파일 재선택 허용
        });

        // 드래그 이벤트
        this.dropZone.addEventListener('dragover', e => {
            e.preventDefault();
            e.stopPropagation();
            const ok = this._isDragTypeAccepted(e.dataTransfer);
            this.dropZone.classList.toggle('dragging', true);
            this.dropZone.classList.toggle('dragging-invalid', !ok);
            e.dataTransfer.dropEffect = ok ? 'copy' : 'none';
        });

        this.dropZone.addEventListener('dragleave', e => {
            if (!this.dropZone.contains(e.relatedTarget)) {
                this.dropZone.classList.remove('dragging', 'dragging-invalid');
            }
        });

        this.dropZone.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            this.dropZone.classList.remove('dragging', 'dragging-invalid');

            const files = e.dataTransfer.files;
            if (!files || files.length === 0) return;
            if (files.length > 1) {
                this.onError('파일을 한 번에 하나씩 업로드해주세요.');
                return;
            }
            this._handle(files[0]);
        });
    }

    // ─── 유효성 검사 + 처리 ──────────────────────────────────

    _handle(file) {
        // 1. 확장자 검사
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!this.accept.includes(ext)) {
            this.onError(
                `지원하지 않는 파일 형식입니다.\n` +
                `허용 형식: ${this.accept.join(', ')}\n` +
                `선택된 파일: ${file.name}`
            );
            return;
        }

        // 2. MIME 타입 검사 (파일 타입이 비어있으면 패스 — 일부 OS에서 빈 값 반환)
        if (file.type && !this.mimeTypes.includes(file.type)) {
            // CSV는 브라우저/OS마다 MIME이 다르므로 엄격하게 차단하지 않고 경고
            console.warn(`[FileUploader] MIME 타입 불일치: ${file.type}`);
        }

        // 3. 파일 크기 검사
        if (file.size === 0) {
            this.onError('빈 파일은 업로드할 수 없습니다.');
            return;
        }
        if (file.size > this.maxBytes) {
            this.onError(
                `파일이 너무 큽니다.\n` +
                `파일 크기: ${Utils.formatFileSize(file.size)}\n` +
                `허용 최대: ${Utils.formatFileSize(this.maxBytes)}`
            );
            return;
        }

        this.onFile(file);
    }

    /** 드래그 중 파일 타입이 허용 여부를 사전 확인 */
    _isDragTypeAccepted(dataTransfer) {
        if (!dataTransfer.items) return true; // 확인 불가 시 허용
        for (const item of dataTransfer.items) {
            if (item.kind !== 'file') return false;
            // MIME 타입이 text/csv 계열이거나 비어있으면 허용
            if (item.type && !this.mimeTypes.includes(item.type)) return false;
        }
        return true;
    }
}

window.FileUploader = FileUploader;
