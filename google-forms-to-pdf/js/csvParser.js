/**
 * csvParser.js
 * Google Forms CSV → JSON 변환
 *
 * 개선 사항 (v2):
 *  - BOM 바이트 실제 감지 (ArrayBuffer 기반)
 *  - 깨진 텍스트 자동 감지 후 경고 플래그
 *  - 파일 크기 상한 (MAX_FILE_BYTES)
 *  - 멀티라인 인용 필드 처리 유지
 *  - 인코딩 UI 연동 가능한 resolvedEncoding 반환
 */

'use strict';

class CSVParser {
    /**
     * @param {object} options
     * @param {string} [options.emptyValue='No answer'] - 빈 셀 대체값
     */
    constructor(options = {}) {
        this.emptyValue = options.emptyValue !== undefined ? options.emptyValue : 'No answer';
    }

    // ─── 공개 정적 메서드 ────────────────────────────────────

    /**
     * File 객체를 받아 BOM 감지 후 파싱
     * @param {File} file
     * @param {'auto'|'UTF-8'|'EUC-KR'|'CP949'} encoding
     * @param {object} options
     * @returns {Promise<ParseResult>}
     *
     * @typedef {object} ParseResult
     * @property {string[]} headers
     * @property {object[]} records
     * @property {number} rowCount
     * @property {string} resolvedEncoding   - 실제 사용된 인코딩
     * @property {string|null} encodingWarning - 깨짐 감지 시 경고 메시지
     */
    static async fromFile(file, encoding = 'auto', options = {}) {
        CSVParser._validateFile(file);

        // BOM 4바이트 읽기 (ArrayBuffer)
        const bom = new Uint8Array(await file.slice(0, 4).arrayBuffer());
        let resolvedEncoding = CSVParser._resolveEncoding(encoding, bom);

        const text = await CSVParser._readAsText(file, resolvedEncoding);
        const parser = new CSVParser(options);
        const result = parser.parse(text);

        // 깨진 텍스트 감지
        const warn = CSVParser._detectGarbled(result.headers, result.records, resolvedEncoding);

        return {
            ...result,
            resolvedEncoding,
            encodingWarning: warn,
        };
    }

    // ─── 핵심 파싱 ───────────────────────────────────────────

    /** 파일 유효성 검사 */
    static _validateFile(file) {
        const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
        if (file.size === 0) throw new Error('빈 파일입니다.');
        if (file.size > MAX_FILE_BYTES) {
            throw new Error(
                `파일이 너무 큽니다. (${Utils.formatFileSize(file.size)} / 최대 20 MB)\n` +
                '행 수를 줄이거나 불필요한 열을 삭제 후 다시 시도하세요.'
            );
        }
    }

    // ─── 비공개 헬퍼 ─────────────────────────────────────────

    /** BOM 바이트로 인코딩 결정 */
    static _resolveEncoding(encoding, bom) {
        if (encoding !== 'auto') return encoding;
        if (bom[0] === 0xEF && bom[1] === 0xBB && bom[2] === 0xBF) return 'UTF-8';
        if (bom[0] === 0xFF && bom[1] === 0xFE) return 'UTF-16LE';
        if (bom[0] === 0xFE && bom[1] === 0xFF) return 'UTF-16BE';
        // BOM 없음 → UTF-8 시도 (이후 깨짐 감지)
        return 'UTF-8';
    }

    /** FileReader → Promise<string> */
    static _readAsText(file, encoding) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('파일 읽기에 실패했습니다.'));
            reader.readAsText(file, encoding);
        });
    }

    /**
     * 깨진 텍스트 감지
     * - Unicode 대체 문자(U+FFFD) 포함 여부
     * - C1 컨트롤 문자(EUC-KR을 UTF-8로 잘못 읽을 때 등장) 존재 여부
     */
    static _detectGarbled(headers, records, encoding) {
        if (encoding !== 'UTF-8') return null;

        const sample = [
            ...headers,
            ...records.slice(0, 5).flatMap(r => Object.values(r)),
        ].join('');

        const hasReplacement = sample.includes('\uFFFD');
        const hasC1 = /[\x80-\x9F]/.test(sample);
        const hasMojibake = /[ì-ï][¡-¿]/.test(sample); // EUC-KR 2바이트 → UTF-8 잘못 디코딩 패턴

        if (hasReplacement || hasC1 || hasMojibake) {
            return 'EUC-KR';
        }
        return null;
    }

    // ─── 정적 헬퍼 ───────────────────────────────────────────

    /**
     * CSV 문자열 → { headers, records, rowCount }
     * @param {string} csvText
     * @returns {{ headers: string[], records: object[], rowCount: number }}
     */
    parse(csvText) {
        // UTF-8 BOM 문자(U+FEFF) 제거
        if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);

        // 줄 끝 정규화
        csvText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        const rows = this._splitRows(csvText);
        if (rows.length === 0) throw new Error('CSV 파일이 비어 있습니다.');

        const rawHeaders = this._parseRow(rows[0]);
        const headers = rawHeaders.map(h => h.trim()).filter(h => h !== '');

        if (headers.length === 0) {
            throw new Error('헤더 행이 없습니다. CSV 파일 형식을 확인해주세요.');
        }
        if (headers.length > 500) {
            throw new Error(`열(column)이 너무 많습니다: ${headers.length}개. 최대 500열을 지원합니다.`);
        }

        const records = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (row === '') continue;

            const values = this._parseRow(row);
            if (values.every(v => v.trim() === '')) continue;

            const record = {};
            headers.forEach((header, idx) => {
                const raw = (values[idx] ?? '').trim();
                // CSV Injection 방어: 수식 시작 문자 앞에 탭 접두사 삽입
                record[header] = this._sanitizeCSVInjection(raw === '' ? this.emptyValue : raw);
            });

            records.push(record);
        }

        return {headers, records, rowCount: records.length};
    }

    /**
     * CSV Injection 방어
     * '=' '+' '-' '@' '\t' '\r' 로 시작하는 값을 무력화
     * (이 앱은 HTML 출력이므로 실질적 위험은 낮으나, 복사-붙여넣기 시 스프레드시트 연동 방지)
     */
    _sanitizeCSVInjection(value) {
        if (typeof value !== 'string') return value;
        if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
        return value;
    }

    /**
     * 인용 필드 포함 단일 CSV 행 파싱
     * @param {string} row
     * @returns {string[]}
     */
    _parseRow(row) {
        const fields = [];
        let current = '';
        let inQuotes = false;
        let i = 0;

        while (i < row.length) {
            const ch = row[i];

            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < row.length && row[i + 1] === '"') {
                        // "" → 이스케이프된 따옴표
                        current += '"';
                        i += 2;
                    } else {
                        inQuotes = false;
                        i++;
                    }
                } else {
                    current += ch;
                    i++;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                    i++;
                } else if (ch === ',') {
                    fields.push(current);
                    current = '';
                    i++;
                } else {
                    current += ch;
                    i++;
                }
            }
        }
        fields.push(current);
        return fields;
    }

    /**
     * 멀티라인 인용 필드를 고려한 행 분리
     * @param {string} text
     * @returns {string[]}
     */
    _splitRows(text) {
        const rows = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < text.length && text[i + 1] === '"') {
                        current += '""';
                        i++;
                    } else {
                        inQuotes = false;
                        current += ch;
                    }
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                    current += ch;
                } else if (ch === '\n') {
                    rows.push(current);
                    current = '';
                } else {
                    current += ch;
                }
            }
        }
        if (current.trim() !== '') rows.push(current);
        return rows;
    }
}

window.CSVParser = CSVParser;
