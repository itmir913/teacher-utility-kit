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
        path.join(ROOT, "main", "dist", "tailwind.css"), // 루트용 output
        path.join(ROOT, "*.{html,js}")
    );
}

//
// 2) .tw 마커 앱들 빌드
//
const apps = fs.readdirSync(ROOT).filter((dir) => {
    const fullPath = path.join(ROOT, dir);
    if (EXCLUDE.has(dir) || dir.startsWith(".")) return false;
    if (!fs.statSync(fullPath).isDirectory()) return false;
    return fs.existsSync(path.join(fullPath, ".tw"));
});

apps.forEach((app) => {
    build(
        app,
        COMMON_INPUT,
        path.join(ROOT, app, "dist", "tailwind.css"),
        path.join(ROOT, app, "**/*.{html,js}")
    );
});