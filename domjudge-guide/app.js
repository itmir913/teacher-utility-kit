// app.js

document.addEventListener("DOMContentLoaded", () => {
    // 💡 브라우저의 해시(#)가 변경될 때마다 라우터 실행 (뒤로가기/앞으로가기, 클릭 모두 대응)
    window.addEventListener("hashchange", router);

    // 초기 로딩 시 첫 화면 렌더링
    router();
});

const router = async () => {
    // 1. URL에서 해시 추출 (예: "#server" -> "server")
    // 해시가 아예 없으면 기본값인 "overview"를 사용
    let hash = window.location.hash.replace("#", "") || "overview";

    // 2. 무조건 ./pages/ 폴더 안의 해당 해시이름.html을 찾도록 고정
    const fetchUrl = `pages/${hash}.html`;

    const appElement = document.getElementById("app");

    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");
        const section = doc.querySelector("section");

        if (section) {
            appElement.innerHTML = section.outerHTML;
            updateActiveLinks(hash);
            window.scrollTo(0, 0); // 페이지 전환 시 최상단으로 스크롤
        } else {
            appElement.innerHTML = `<p class='text-base text-red-500'>섹션 콘텐츠를 찾을 수 없습니다.</p>`;
        }
    } catch (error) {
        appElement.innerHTML = `
            <div class="p-10 bg-white rounded-xl border border-red-200 shadow-sm">
                <p class='text-base text-red-500 font-bold'>페이지를 로드할 수 없습니다.</p>
                <p class="text-slate-500 mt-2">요청 경로: ${fetchUrl}</p>
                <p class="text-sm text-slate-400 mt-1">네트워크 상태나 파일이 존재하는지 확인해 주세요.</p>
            </div>
        `;
        console.error("Routing Error:", error);
    }
};

// 활성화된 메뉴 하이라이트 처리
const updateActiveLinks = (currentHash) => {
    document.querySelectorAll("a[data-link]").forEach(link => {
        // 링크의 href 속성에서 '#'을 제거하여 순수 이름만 비교
        const linkHash = link.getAttribute("href").replace("#", "");

        if (linkHash === currentHash) {
            link.classList.add("text-blue-600", "bg-blue-50", "font-semibold");
            link.classList.remove("text-slate-600");
        } else {
            link.classList.remove("text-blue-600", "bg-blue-50", "font-semibold");
            link.classList.add("text-slate-600");
        }
    });
};