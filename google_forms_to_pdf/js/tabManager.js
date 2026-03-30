/**
 * tabManager.js
 * 탭 전환 관리
 */

class TabManager {
    /**
     * @param {string} navId        - ID of the nav element containing tab buttons
     * @param {string} contentClass - Class name shared by all tab content panels
     */
    constructor(navId, contentClass = 'tab-content') {
        this.nav = document.getElementById(navId);
        this.contentClass = contentClass;
        this.activeTab = null;
        this.listeners = {};

        this._init();
    }

    _init() {
        if (!this.nav) return;

        this.nav.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                this.switchTo(tabId);
            });
        });

        // Activate first tab by default
        const firstBtn = this.nav.querySelector('.tab-btn');
        if (firstBtn) {
            this.switchTo(firstBtn.dataset.tab);
        }
    }

    /**
     * Switch to a given tab by ID.
     * @param {string} tabId
     */
    switchTo(tabId) {
        if (this.activeTab === tabId) return;

        // Update buttons
        this.nav.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update content panels
        document.querySelectorAll(`.${this.contentClass}`).forEach(panel => {
            const panelId = panel.id.replace('tab-', '');
            panel.classList.toggle('hidden', panelId !== tabId);
        });

        const prev = this.activeTab;
        this.activeTab = tabId;

        // Emit change event
        this._emit('change', {from: prev, to: tabId});
    }

    /**
     * Register a callback for tab events.
     * @param {string} event - 'change'
     * @param {function} fn
     */
    on(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }

    _emit(event, data) {
        (this.listeners[event] || []).forEach(fn => fn(data));
    }
}

window.TabManager = TabManager;
