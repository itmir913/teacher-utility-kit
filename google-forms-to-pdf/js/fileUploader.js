/**
 * fileUploader.js
 * 드래그 앤 드롭 + 클릭 업로드 처리
 */

class FileUploader {
    /**
     * @param {object} options
     * @param {string} options.dropZoneId - Drop zone element ID
     * @param {string} options.inputId    - Hidden file input ID
     * @param {string[]} options.accept   - Allowed extensions e.g. ['.csv']
     * @param {function} options.onFile   - Callback(file: File)
     * @param {function} options.onError  - Callback(message: string)
     */
    constructor(options) {
        this.dropZone = document.getElementById(options.dropZoneId);
        this.input = document.getElementById(options.inputId);
        this.accept = options.accept || ['.csv'];
        this.onFile = options.onFile || (() => {
        });
        this.onError = options.onError || console.error;

        this._init();
    }

    _init() {
        if (!this.dropZone || !this.input) return;

        // Click to open file dialog
        this.dropZone.addEventListener('click', () => this.input.click());

        // Input change
        this.input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this._handleFile(file);
            // Reset so same file can be re-selected
            this.input.value = '';
        });

        // Drag events
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragging');
        });

        this.dropZone.addEventListener('dragleave', (e) => {
            if (!this.dropZone.contains(e.relatedTarget)) {
                this.dropZone.classList.remove('dragging');
            }
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragging');

            const files = e.dataTransfer.files;
            if (files.length === 0) return;
            if (files.length > 1) {
                this.onError('파일을 하나씩 업로드해주세요.');
                return;
            }

            this._handleFile(files[0]);
        });
    }

    _handleFile(file) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();

        if (!this.accept.includes(ext)) {
            this.onError(`${this.accept.join(', ')} 파일만 허용됩니다. 선택된 파일: ${file.name}`);
            return;
        }

        this.onFile(file);
    }
}

window.FileUploader = FileUploader;
