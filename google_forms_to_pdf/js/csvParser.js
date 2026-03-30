/**
 * csvParser.js
 * Google Forms CSV → JSON 변환 클래스
 */

class CSVParser {
    /**
     * @param {string} csvText - Raw CSV string
     * @param {object} options
     * @param {string} options.emptyValue - Value to fill empty cells (default: "No answer")
     */
    constructor(options = {}) {
        this.emptyValue = options.emptyValue !== undefined ? options.emptyValue : 'No answer';
    }

    /**
     * Read a File object and return parsed result.
     * @param {File} file
     * @param {string} encoding  e.g. 'UTF-8', 'EUC-KR', 'auto'
     * @returns {Promise<{headers, records, rowCount}>}
     */
    static fromFile(file, encoding = 'auto', options = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            const resolvedEncoding = encoding === 'auto' ? 'UTF-8' : encoding;

            reader.onload = (e) => {
                try {
                    const parser = new CSVParser(options);
                    const result = parser.parse(e.target.result);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };

            reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));

            reader.readAsText(file, resolvedEncoding);
        });
    }

    /**
     * Parse a CSV string into an array of objects.
     * Handles:
     *  - Quoted fields (with commas or newlines inside)
     *  - Multiple encodings
     *  - Auto-strips leading BOM (UTF-8 BOM)
     *  - Trims whitespace from values
     *
     * @param {string} csvText
     * @returns {{ headers: string[], records: object[], rowCount: number }}
     */
    parse(csvText) {
        // Strip BOM if present
        if (csvText.charCodeAt(0) === 0xFEFF) {
            csvText = csvText.slice(1);
        }

        // Normalize line endings
        csvText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        const rows = this._splitRows(csvText);

        if (rows.length === 0) {
            throw new Error('CSV 파일이 비어 있습니다.');
        }

        // First row = headers
        const rawHeaders = this._parseRow(rows[0]);
        // Filter out empty headers (trailing commas)
        const headers = rawHeaders.filter(h => h.trim() !== '');

        if (headers.length === 0) {
            throw new Error('헤더 행이 없습니다. CSV 파일 형식을 확인해주세요.');
        }

        const records = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (row === '') continue; // skip blank rows

            const values = this._parseRow(row);

            // Skip rows where all values are empty
            const allEmpty = values.every(v => v.trim() === '');
            if (allEmpty) continue;

            const record = {};
            headers.forEach((header, idx) => {
                const raw = (values[idx] !== undefined ? values[idx] : '').trim();
                record[header] = raw === '' ? this.emptyValue : raw;
            });

            records.push(record);
        }

        return {
            headers,
            records,
            rowCount: records.length,
        };
    }

    /**
     * Parse a single CSV row, respecting quoted fields.
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
                    // Check for escaped quote ""
                    if (i + 1 < row.length && row[i + 1] === '"') {
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
     * Split CSV text into rows, handling multi-line quoted fields.
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

        if (current.trim() !== '') {
            rows.push(current);
        }

        return rows;
    }
}

// Export to global
window.CSVParser = CSVParser;
