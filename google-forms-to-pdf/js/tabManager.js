/**
 * tabManager.js
 * 탭 전환 관리 (v2)
 *
 * 개선 사항:
 *  - ARIA role="tab" / aria-selected / aria-controls 완전 지원
 *  - tabpanel role="tabpanel" + aria-labelledby 연결
 *  - keyboard 네비게이션 (← → Home End)
 */

'use strict';

class TabManager {
    /**
     * @param {string} navId          - 탭 버튼을 담은 nav 요소 ID
     * @param {string} contentClass   - 탭 콘텐츠 패널 공유 class명
     */
    constructor(navId, contentClass = 'tab-content') {
        this.nav = Utils.byId(navId);
        this.contentClass = contentClass;
        this.activeTab = null;
        this._listeners = {};

        this._init();
    }

    // ─── 초기화 ──────────────────────────────────────────────

    _init() {
        if (!this.nav) {
            console.warn('[TabManager] nav 요소를 찾지 못했습니다.');
            return;
        }

        const buttons = [...this.nav.querySelectorAll('.tab-btn')];

        buttons.forEach((btn, idx) => {
            const tabId = btn.dataset.tab;

            // ARIA 속성 설정
            btn.setAttribute('role', 'tab');
            btn.setAttribute('id', `tab-btn-${tabId}`);
            btn.setAttribute('aria-controls', `tab-${tabId}`);
            btn.setAttribute('aria-selected', 'false');
            btn.setAttribute('tabindex', '-1');

            // 대응하는 콘텐츠 패널에도 ARIA 설정
            const panel = Utils.byId(`tab-${tabId}`);
            if (panel) {
                panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('aria-labelledby', `tab-btn-${tabId}`);
                panel.setAttribute('tabindex', '0');
            }

            btn.addEventListener('click', () => this.switchTo(tabId));
        });

        // 키보드 네비게이션 (← →)
        this.nav.addEventListener('keydown', e => {
            const buttons = [...this.nav.querySelectorAll('.tab-btn')];
            const current = document.activeElement;
            const idx = buttons.indexOf(current);
            if (idx === -1) return;

            let next = -1;
            if (e.key === 'ArrowRight') next = (idx + 1) % buttons.length;
            if (e.key === 'ArrowLeft') next = (idx - 1 + buttons.length) % buttons.length;
            if (e.key === 'Home') next = 0;
            if (e.key === 'End') next = buttons.length - 1;

            if (next !== -1) {
                e.preventDefault();
                buttons[next].focus();
                this.switchTo(buttons[next].dataset.tab);
            }
        });

        // 첫 번째 탭 활성화
        const first = buttons[0];
        if (first) this.switchTo(first.dataset.tab);
    }

    // ─── 공개 메서드 ─────────────────────────────────────────

    /**
     * 지정 탭으로 전환
     * @param {string} tabId
     */
    switchTo(tabId) {
        if (this.activeTab === tabId) return;

        const buttons = [...this.nav.querySelectorAll('.tab-btn')];

        buttons.forEach(btn => {
            const isActive = btn.dataset.tab === tabId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', String(isActive));
            btn.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        document.querySelectorAll(`.${this.contentClass}`).forEach(panel => {
            const panelId = panel.id.replace(/^tab-/, '');
            const visible = panelId === tabId;
            panel.classList.toggle('hidden', !visible);
            panel.setAttribute('aria-hidden', String(!visible));
        });

        const prev = this.activeTab;
        this.activeTab = tabId;
        this._emit('change', {from: prev, to: tabId});
    }

    /**
     * 탭 이벤트 리스너 등록
     * @param {'change'} event
     * @param {Function} fn
     * @returns {Function} 해제 함수
     */
    on(event, fn) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(fn);
        return () => {
            this._listeners[event] = this._listeners[event].filter(f => f !== fn);
        };
    }

    // ─── 비공개 ──────────────────────────────────────────────

    _emit(event, data) {
        (this._listeners[event] || []).forEach(fn => fn(data));
    }
}

window.TabManager = TabManager;
