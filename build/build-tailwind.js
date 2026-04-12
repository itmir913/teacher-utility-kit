const {execSync} = require("child_process");
const fs = require("fs");
const path = require("path");

// tools/build 폴더 기준
const TOOLS = __dirname;
const ROOT = path.resolve(TOOLS, ".."); // 루트 프로젝트
const isWatch = process.argv.includes("--watch");

// 제외 폴더
const EXCLUDE = new Set([
    ".git",
    ".github",
    "node_modules"
]);

// 공통 input.css
const COMMON_INPUT = path.join(TOOLS, "input.css"); // build 폴더 안

if (!fs.existsSync(COMMON_INPUT)) {
    console.error("Missing input.css in build folder");
    process.exit(1);
}

// 빌드 함수
function build(targetName, inputPath, outputPath, contentGlob) {
    const distDir = path.dirname(outputPath);
    if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, {recursive: true});

    const command = [
        "npx tailwindcss",
        `-i ${inputPath}`,
        `-o ${outputPath}`,
        `--content "${contentGlob}"`,
        isWatch ? "--watch" : "--minify"
    ].join(" ");

    console.log(`\n[${targetName}] building...`);
    execSync(command, {stdio: "inherit"});
}

//
// 1) 루트 index.html 빌드
//
const rootIndex = path.join(ROOT, "index.html");
if (fs.existsSync(rootIndex)) {
    build(
        "root",
        COMMON_INPUT,
        path.join(ROOT, "tailwind.css"), // 루트용 output
        path.join(ROOT, "*.{html,js}")
    );
}

//
// 2) .tw 마커 앱들 빌드
//
function getTwApps(dir, allApps = []) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const fullPath = path.join(dir, file);
        if (EXCLUDE.has(file) || file.startsWith(".")) return;

        if (fs.statSync(fullPath).isDirectory()) {
            // 1. .tw 파일이 있으면 앱 목록에 추가 (추가만 하고 멈추지 않음)
            if (fs.existsSync(path.join(fullPath, ".tw"))) {
                allApps.push(fullPath);
            }

            // 2. .tw 유무와 상관없이 하위 폴더를 계속 탐색
            getTwApps(fullPath, allApps);
        }
    });
    return allApps;
}

// 2) .tw 마커 앱들 빌드
const apps = getTwApps(ROOT);

const targetFilter = process.argv.slice(2).find(a => a !== '--watch');

const filteredApps = targetFilter
    ? apps.filter(app => path.relative(ROOT, app).includes(targetFilter))
    : apps;

if (targetFilter && filteredApps.length === 0) {
    console.error(`[ERROR] No app matched: "${targetFilter}"`);
    console.error(`Available: ${apps.map(a => path.relative(ROOT, a)).join(', ')}`);
    process.exit(1);
}

filteredApps.forEach((app) => {
    const relativePath = path.relative(ROOT, app);
    build(
        relativePath,
        COMMON_INPUT,
        path.join(app, "dist", "tailwind.css"),
        path.join(app, "**/*.{html,js}")
    );
});