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
            executeScripts(appElement);
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

// innerHTML로 삽입된 <script> 태그는 실행되지 않으므로 수동으로 재실행
const executeScripts = (container) => {
    container.querySelectorAll("script").forEach(oldScript => {
        const newScript = document.createElement("script");
        [...oldScript.attributes].forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.textContent = oldScript.textContent;
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });
};

// 코드 블록 복사 버튼 기능 초기화
const initCopyButtons = () => {
    // 현재 렌더링된 화면(#app) 안의 모든 pre 태그를 찾음
    const preTags = document.querySelectorAll("#app pre");

    preTags.forEach(pre => {
        // 이미 래퍼가 씌워진 경우 중복 생성 방지
        if (pre.parentElement.classList.contains("copy-wrapper")) return;

        // pre를 감싸는 래퍼 div 생성
        // 버튼을 pre 바깥(래퍼 안)에 두어야 pre 스크롤 시에도 버튼이 고정됨
        const wrapper = document.createElement("div");
        wrapper.className = "copy-wrapper relative group";
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        // 복사 버튼 생성 후 래퍼에 추가 (pre 내부가 아님)
        const btn = document.createElement("button");
        btn.innerText = "복사";
        btn.className = "copy-btn absolute top-3 right-3 px-2 py-1 bg-slate-700 text-slate-300 text-base rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-600 hover:text-white";
        wrapper.appendChild(btn);

        // 클릭 이벤트 설정
        btn.addEventListener("click", () => {
            const code = pre.querySelector("code");
            if (!code) return;

            navigator.clipboard.writeText(code.innerText).then(() => {
                btn.innerText = "복사 완료!";
                btn.classList.replace("bg-slate-700", "bg-emerald-600");
                btn.classList.replace("hover:bg-slate-600", "hover:bg-emerald-500");
                btn.classList.replace("text-slate-300", "text-white");

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
    });
};