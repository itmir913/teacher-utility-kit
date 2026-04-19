// app.js

// 현재 진행 중인 fetch 요청을 취소하기 위한 컨트롤러
let abortController = null;

document.addEventListener("DOMContentLoaded", () => {
    // 💡 브라우저의 해시(#)가 변경될 때마다 라우터 실행 (뒤로가기/앞으로가기, 클릭 모두 대응)
    window.addEventListener("hashchange", router);

    // 초기 로딩 시 첫 화면 렌더링
    router();
});

const router = async () => {
    // 이전 요청이 있다면 즉시 취소
    if (abortController) {
        abortController.abort();
    }
    abortController = new AbortController();
    const signal = abortController.signal;

    let hash = window.location.hash.replace("#", "") || "overview";

    // 유효하지 않은 hash 방어 (빈 문자열, 공백 등)
    if (!hash.trim()) hash = "overview";

    const fetchUrl = `pages/${hash}.html`;
    const appElement = document.getElementById("app");

    try {
        const response = await fetch(fetchUrl, {signal}); // ✅ signal 전달
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");
        const section = doc.querySelector("section");

        if (section) {
            appElement.innerHTML = section.outerHTML;
            updateActiveLinks(hash);
            initCopyButtons();
            // ✅ scrollTo는 렌더링 이후 다음 프레임에 실행 (layout flicker 방지)
            requestAnimationFrame(() => window.scrollTo({top: 0, behavior: "instant"}));
        } else {
            appElement.innerHTML = `<p class='text-base text-red-500'>섹션 콘텐츠를 찾을 수 없습니다.</p>`;
        }
    } catch (error) {
        // ✅ 취소된 요청은 오류로 처리하지 않음
        if (error.name === "AbortError") return;

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

// 코드 블록 복사 버튼 기능 초기화
const initCopyButtons = () => {
    // 현재 렌더링된 화면(#app) 안의 모든 pre 태그를 찾음
    const preTags = document.querySelectorAll("#app pre");

    preTags.forEach(pre => {
        // 이미 버튼이 있다면 중복 생성 방지
        if (pre.querySelector(".copy-btn")) return;

        // 버튼이 pre 영역 안에서 절대 좌표(우측 상단)를 가질 수 있도록 relative 설정
        // group 클래스는 마우스 호버 효과를 위해 추가
        pre.classList.add("relative", "group");

        // 복사 버튼 엘리먼트 생성
        const btn = document.createElement("button");
        btn.innerText = "복사";

        // Tailwind 클래스 적용: 우측 상단 고정, 평소엔 투명(opacity-0)하다가 마우스 올리면 나타남(group-hover:opacity-100)
        btn.className = "copy-btn absolute top-3 right-3 px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-600 hover:text-white";

        // 클릭 이벤트 설정
        btn.addEventListener("click", () => {
            const code = pre.querySelector("code");
            if (!code) return;

            // 클립보드에 코드 텍스트 복사
            navigator.clipboard.writeText(code.innerText).then(() => {
                // 복사 성공 시 시각적 피드백 (디자인/텍스트 변경)
                btn.innerText = "복사 완료!";
                btn.classList.replace("bg-slate-700", "bg-emerald-600");
                btn.classList.replace("hover:bg-slate-600", "hover:bg-emerald-500");
                btn.classList.replace("text-slate-300", "text-white");

                // 2초 뒤 원래 상태로 복구
                setTimeout(() => {
                    btn.innerText = "복사";
                    btn.classList.replace("bg-emerald-600", "bg-slate-700");
                    btn.classList.replace("hover:bg-emerald-500", "hover:bg-slate-600");
                    btn.classList.replace("text-white", "text-slate-300");
                }, 2000);
            }).catch(err => {
                console.error("복사 실패:", err);
                btn.innerText = "실패";
            });
        });

        // pre 태그 내부 요소로 버튼 추가
        pre.appendChild(btn);
    });
};