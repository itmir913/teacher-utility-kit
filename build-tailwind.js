const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const isWatch = process.argv.includes("--watch");

// 제외 폴더
const EXCLUDE = new Set([
    ".git",
    ".github",
    "node_modules"
]);

// 공통 input.css (루트)
const COMMON_INPUT = path.join(ROOT, "input.css");

if (!fs.existsSync(COMMON_INPUT)) {
    console.error("Missing root input.css");
    process.exit(1);
}

// .tw 마커 기준으로 앱 탐색
const apps = fs.readdirSync(ROOT).filter((dir) => {
    const fullPath = path.join(ROOT, dir);

    if (EXCLUDE.has(dir) || dir.startsWith(".")) return false;
    if (!fs.statSync(fullPath).isDirectory()) return false;

    return fs.existsSync(path.join(fullPath, ".tw"));
});

if (apps.length === 0) {
    console.log("No Tailwind apps found (.tw marker missing)");
    process.exit(0);
}

// 각 앱 빌드
apps.forEach((app) => {
    const appPath = path.join(ROOT, app);
    const output = `./${app}/dist/tailwind.css`;
    const content = `./${app}/**/*.{html,js}`;

    // lib 폴더 생성
    const libDir = path.join(appPath, "dist");
    if (!fs.existsSync(libDir)) {
        fs.mkdirSync(libDir);
    }

    const command = [
        "npx tailwindcss",
        `-i ./input.css`, // 공통 input
        `-o ${output}`,
        `--content "${content}"`,
        isWatch ? "--watch" : "--minify"
    ].join(" ");

    console.log(`\n[${app}] building...`);
    execSync(command, { stdio: "inherit" });
});