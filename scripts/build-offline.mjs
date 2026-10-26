// 인터넷 없이 더블클릭으로 여는 오프라인 번들을 만든다.
//
// 사이트 빌드(vite build)와 따로 돈다. 원본 HTML을 읽어 `<script type="module">`의
// 패키지 import를 그 패키지의 UMD 파일로 바꿔 넣는다. file://로 연 페이지에서는
// 모듈 스크립트가 막히고, 빌드 결과물은 다른 도구와 함께 쓰는 assets/에 기대기 때문이다.
//
// 결과: offline/<name>/ 폴더. zip으로 묶는 일은 워크플로가 한다.
// 새 도구를 추가하려면 TARGETS에 한 항목을 더한다.
//   entry - 한 파일로 묶을 HTML (없어도 된다)
//   files - 그대로 넣을 파일. .bat/.cmd는 CRLF로 바꾼다(저장소는 LF로 둔다).

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "offline");

const TARGETS = [
    {
        name: "register-qrcode",
        entry: "register-qrcode/index.html",
        // import 이름 → 전역을 만드는 UMD 파일
        inline: {jsqr: "node_modules/jsqr/dist/jsQR.js"},
        // 빌드에서만 뜻이 있는 링크. 지우면 시스템 글꼴로 보인다.
        drop: ["./fonts.css"],
    },
    {
        name: "auto-restart-daegyohyeop",
        files: ["auto-restart-daegyohyeop/auto_restart_batch_daegyohyeop.bat"],
    },
];

const MODULE_BLOCK = /<script type="module">([\s\S]*?)<\/script>/g;
const IMPORT_LINE = /^\s*import\s+(\w+)\s+from\s+["']([^"']+)["'];?\s*$/;
const GLOBAL_LINE = /^\s*window\.(\w+)\s*=\s*\1;?\s*$/;
const COMMENT_LINE = /^\s*(\/\/.*)?$/;

// cmd.exe는 LF만 있는 배치 파일에서 레이블·goto를 잘못 읽을 수 있다
const CRLF_EXT = new Set([".bat", ".cmd"]);

function readRoot(file) {
    return fs.readFileSync(path.join(ROOT, file), "utf8");
}

// 모듈 블록이 "import X from 'pkg'; window.X = X;" 뿐일 때만 UMD로 바꾼다.
// 그 밖의 코드가 있으면 조용히 버리지 않고 멈춘다.
function inlineModuleBlock(target, body) {
    const scripts = [];
    for (const line of body.split("\n")) {
        const imp = line.match(IMPORT_LINE);
        if (imp) {
            const file = target.inline[imp[2]];
            if (!file) throw new Error(`${target.name}: inline에 "${imp[2]}"이 없다`);
            const code = readRoot(file).replace(/<\/script/gi, "<\\/script");
            scripts.push(`<script>\n${code}\n</script>`);
        } else if (!GLOBAL_LINE.test(line) && !COMMENT_LINE.test(line)) {
            throw new Error(`${target.name}: 모듈 블록에 옮길 수 없는 코드가 있다: ${line.trim()}`);
        }
    }
    return scripts.join("\n");
}

function bundleHtml(target) {
    let html = readRoot(target.entry);
    html = html.replace(MODULE_BLOCK, (_, body) => inlineModuleBlock(target, body));
    for (const href of target.drop ?? []) {
        const link = new RegExp(`\\s*<link[^>]*href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`, "g");
        if (!link.test(html)) throw new Error(`${target.name}: drop 대상 ${href}를 찾지 못했다`);
        html = html.replace(link, "");
    }
    // 온라인에서만 뜻이 있는 요소(오프라인 받기 버튼 등)는 data-offline-drop으로 표시한다
    html = html.replace(/\s*<(\w+)[^>]*\sdata-offline-drop[\s>][\s\S]*?<\/\1>/g, "");
    // 남은 상대 경로는 zip에 들어가지 않으므로 빠뜨린 것이다
    const local = html.match(/(?:src|href)="\.\/[^"]+"/g);
    if (local) throw new Error(`${target.name}: 묶이지 않은 상대 경로가 남았다: ${local.join(", ")}`);
    return html;
}

function copyFiles(target, dir) {
    for (const file of target.files ?? []) {
        const out = path.join(dir, path.basename(file));
        if (CRLF_EXT.has(path.extname(file).toLowerCase())) {
            fs.writeFileSync(out, readRoot(file).replace(/\r?\n/g, "\r\n"));
        } else {
            fs.copyFileSync(path.join(ROOT, file), out);
        }
        console.log(`offline/${target.name}/${path.basename(file)}`);
    }
}

function build(target) {
    if (!target.entry && !target.files?.length) throw new Error(`${target.name}: entry도 files도 없다`);
    const dir = path.join(OUT_DIR, target.name);
    fs.rmSync(dir, {recursive: true, force: true});
    fs.mkdirSync(dir, {recursive: true});
    if (target.entry) {
        const html = bundleHtml(target);
        fs.writeFileSync(path.join(dir, "index.html"), html);
        console.log(`offline/${target.name}/index.html (${(html.length / 1024).toFixed(0)} KB)`);
    }
    copyFiles(target, dir);
}

const only = process.argv.slice(2);
const targets = only.length ? TARGETS.filter((t) => only.includes(t.name)) : TARGETS;
if (only.length && targets.length !== only.length) {
    throw new Error(`알 수 없는 대상: ${only.filter((n) => !TARGETS.some((t) => t.name === n)).join(", ")}`);
}
targets.forEach(build);
