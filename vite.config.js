// 사이트 빌드 설정. `npm run build`가 dist/에 GitHub Pages로 올릴 사이트 전체를 만든다.
//
// 이 저장소는 앱 폴더마다 index.html을 하나씩 가진 정적 멀티 페이지 사이트다.
// Vite는 Tailwind를 쓰는 페이지만 맡아서 각 페이지의 tailwind.css를 빌드하고,
// 나머지 파일(다른 HTML, 스크립트, 이미지, 내려받기용 zip 등)은 손대지 않고 같은 경로로 옮긴다.

import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const ROOT = import.meta.dirname;
const OUT_DIR = path.join(ROOT, "dist");

// 사이트에 올리지 않는 것들. 저장소 뿌리의 빌드 도구·저장소 설정·빌드 결과와, 어디에 있든 node_modules.
// 앱 폴더 안의 package.json(school-call/backend) 같은 것은 예전처럼 그대로 올린다.
const EXCLUDE_AT_ROOT = new Set([
    ".git", ".github", ".githooks", ".gitattributes", ".gitignore", ".claude", ".idea",
    "dist", "tailwind",
    "package.json", "package-lock.json", "vite.config.js", "teacher-utility-kit.iml",
]);

function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || (dir === ROOT && EXCLUDE_AT_ROOT.has(entry.name))) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else yield full;
    }
}

const files = [...walk(ROOT)];

// 같은 폴더의 tailwind.css를 불러오는 HTML이 빌드 입력이다. 새 앱도 이 링크만 넣으면 저절로 잡힌다.
// 입력 이름을 폴더 경로로 두어 결과물도 /앱이름/index.html에 그대로 놓이게 한다.
const pages = Object.fromEntries(
    files
        .filter(f => f.endsWith(".html") && fs.readFileSync(f, "utf8").includes('href="./tailwind.css"'))
        .map(f => [path.relative(ROOT, f).replaceAll("\\", "/").replace(/\.html$/, ""), f]),
);

// Vite가 맡지 않은 파일을 dist/에 같은 경로로 복사한다. 빌드한 HTML은 덮어쓰지 않고,
// Tailwind 진입점(tailwind.css)은 빌드된 CSS로 대체되었으므로 옮기지 않는다.
function copyStaticFiles() {
    return {
        name: "copy-static-files",
        apply: "build",
        closeBundle() {
            for (const src of files) {
                const rel = path.relative(ROOT, src);
                if (path.basename(src) === "tailwind.css") continue;
                const dest = path.join(OUT_DIR, rel);
                if (fs.existsSync(dest)) continue;
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                fs.copyFileSync(src, dest);
            }
        },
    };
}

// Vite는 빌드한 CSS의 <link>를 원래 자리에서 빼서 </head> 바로 앞에 다시 넣는다.
// 이 사이트의 페이지들은 인라인 <style>에서 Tailwind 클래스를 같은 명시도로 덮어쓰기도 하므로
// CSS가 놓이는 순서가 곧 화면이다. 그래서 HTML에 적은 tailwind.css 링크의 자리로 되돌린다.
const MARKER = "<!--tailwind.css-->";
function keepCssLinkPosition() {
    return [
        {
            name: "keep-css-link-position:mark",
            apply: "build",
            transformIndexHtml: {
                order: "pre",
                handler: html => html.replace(/<link rel="stylesheet" href="\.\/tailwind\.css">/, m => MARKER + m),
            },
        },
        {
            name: "keep-css-link-position:move",
            apply: "build",
            transformIndexHtml: {
                order: "post",
                handler(html) {
                    if (!html.includes(MARKER)) return html;
                    const injected = html.match(/[ \t]*<link rel="stylesheet" crossorigin href="[^"]+\.css">\r?\n/);
                    if (!injected) throw new Error("빌드한 CSS 링크를 찾지 못했다");
                    return html.replace(injected[0], "").replace(MARKER, injected[0].trim());
                },
            },
        },
    ];
}

// Tailwind 4의 space-x/y-*는 마지막 자식을 뺀 모든 자식에 아래(오른쪽) 여백을 준다.
// 3은 첫 자식을 뺀 모든 자식에 위(왼쪽) 여백을 줬다. 자식이 자기 여백을 갖거나 여백이
// 부모 밖으로 겹치는 곳에서 높이가 달라지므로, 만들어진 규칙을 3의 모양으로 되돌린다.
// 여백의 양을 셈하는 식은 그대로 두고 선택자와 붙는 쪽만 바꾼다.
const SPACE_RULE = /:where\(([^{}]+?)\s*>\s*:not\(:last-child\)\)\s*\{([^{}]*--tw-space-([xy])-reverse[^{}]*)\}/g;
const V3_SIDES = {
    y: { "margin-block-start": "margin-bottom", "margin-block-end": "margin-top" },
    x: { "margin-inline-start": "margin-right", "margin-inline-end": "margin-left" },
};
const toV3Spacing = css => css.replace(SPACE_RULE, (_, selector, body, axis) =>
    `${selector}>:not([hidden])~:not([hidden]){${body.replace(/margin-(block|inline)-(start|end)/g, p => V3_SIDES[axis][p])}}`);
function restoreV3Spacing() {
    return {
        name: "restore-v3-spacing",
        enforce: "post",
        // 개발 서버: Tailwind가 CSS 모듈을 변환할 때 만든다.
        transform(code, id) {
            if (/\.css($|\?)/.test(id) && code.includes("--tw-space-")) return toV3Spacing(code);
        },
        // 빌드: Tailwind가 번들을 쓸 때에야 최종 CSS를 만든다.
        generateBundle(_, bundle) {
            for (const file of Object.values(bundle)) {
                if (file.type !== "asset" || !file.fileName.endsWith(".css")) continue;
                const css = String(file.source);
                file.source = toV3Spacing(css);
                if (/:not\(:last-child\)\)\{--tw-space-/.test(file.source)) throw new Error(`space-x/y 규칙을 3의 모양으로 바꾸지 못했다: ${file.fileName}`);
            }
        },
    };
}

export default defineConfig({
    // 상대 경로로 둔다. 사이트는 luminousky.com/teacher-utility-kit/ 아래에 놓이지만
    // (사용자 사이트 itmir913.github.io의 커스텀 도메인을 프로젝트 페이지가 물려받는다)
    // 상대 경로면 저장소 이름이나 도메인이 바뀌어도, 로컬 정적 서버에서도 그대로 열린다.
    base: "./",
    plugins: [tailwindcss({ optimize: { minify: true } }), keepCssLinkPosition(), restoreV3Spacing(), copyStaticFiles()],
    build: {
        outDir: OUT_DIR,
        emptyOutDir: true,
        // CSS 압축기는 페이지의 인라인 <style>까지 다시 쓴다(color-scheme을 변수 묶음으로 바꾸는 등).
        // 손으로 쓴 스타일은 그대로 두고, Tailwind가 만든 CSS는 Tailwind 플러그인이 따로 최적화한다.
        cssMinify: false,
        rollupOptions: { input: pages },
    },
});
