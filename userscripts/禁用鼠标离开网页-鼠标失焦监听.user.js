// ==UserScript==
// @name            禁用鼠标离开网页/窗口失焦监听
// @namespace       http://tampermonkey.net/
// @version         0.6.1
// @description     通过多种方式阻止网页检测鼠标离开页面、窗口失去焦点或页面可见性变化，并包含活动模拟，旨在保护用户操作不被意外中断或记录。新增禁用网页自动全屏功能。
// @author          Chuwu
// @match           *://*.chaoxing.com/*
// @match           *://*.icve.com.cn/*
// @match           *://*.edu.cn/*
// @match           *://*.icourse163.org/*
// @match           *://*.linknl.com/*
// @match           *://*.huawei.com/*
// @icon            https://www.google.com/s2/favicons?sz=64&domain=chaoxing.com
// @grant           unsafeWindow
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_addStyle
// @grant           GM_openInTab
// @grant           GM_registerMenuCommand
// @grant           GM_notification
// @grant           GM_setClipboard
// @run-at          document-start
// @license         AGPL3.0
// @downloadURL https://update.greasyfork.org/scripts/531453/%E7%A6%81%E7%94%A8%E9%BC%A0%E6%A0%87%E7%A6%BB%E5%BC%80%E7%BD%91%E9%A1%B5%E7%AA%97%E5%8F%A3%E5%A4%B1%E7%84%A6%E7%9B%91%E5%90%AC.user.js
// @updateURL https://update.greasyfork.org/scripts/531453/%E7%A6%81%E7%94%A8%E9%BC%A0%E6%A0%87%E7%A6%BB%E5%BC%80%E7%BD%91%E9%A1%B5%E7%AA%97%E5%8F%A3%E5%A4%B1%E7%84%A6%E7%9B%91%E5%90%AC.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_NAME = '禁用鼠标离开/失焦监听'; // 脚本名称，用于日志输出
    const DEBUG = false; // 调试模式开关，设置为 true 以启用详细日志记录

    // 获取页面的全局 window 对象，优先使用 unsafeWindow
    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    if (DEBUG) console.log(`[${SCRIPT_NAME}] 脚本在 document-start 阶段开始运行。`);

    // --- 通用工具：安全地定义属性，单个失败不中断后续逻辑 ---
    const safeDefine = (obj, prop, descriptor) => {
        try {
            Object.defineProperty(obj, prop, descriptor);
            return true;
        } catch (error) {
            if (DEBUG) console.warn(`[${SCRIPT_NAME}] 重写属性 "${prop}" 失败:`, error);
            return false;
        }
    };

    // --- 0. Function.prototype.toString 代理（反检测） ---
    // 对已劫持的函数返回伪造的 "[native code]" 字符串，规避基于 toString 的特征检测
    const nativeFnToString = Function.prototype.toString;
    const toStringSpoofs = new WeakMap();
    const spoofNative = (fn, name) => {
        try {
            toStringSpoofs.set(fn, `function ${name}() { [native code] }`);
        } catch (_) { /* 忽略非对象目标 */ }
    };
    const spoofedToString = function toString() {
        if (toStringSpoofs.has(this)) return toStringSpoofs.get(this);
        return nativeFnToString.call(this);
    };
    try {
        toStringSpoofs.set(spoofedToString, nativeFnToString.call(nativeFnToString));
        Function.prototype.toString = spoofedToString;
        if (DEBUG) console.log(`[${SCRIPT_NAME}] Function.prototype.toString 代理已安装。`);
    } catch (error) {
        console.error(`[${SCRIPT_NAME}] 安装 toString 代理失败:`, error);
    }

    // --- 共享常量 ---
    const forbiddenEvents = new Set([
        'mouseout',
        'mouseleave',
        'blur',
        'focus',
        'focusin',
        'focusout',
        'visibilitychange',
        'webkitvisibilitychange',
        'mozvisibilitychange',
        'msvisibilitychange',
        'fullscreenchange',
        'webkitfullscreenchange',
        'mozfullscreenchange',
        'msfullscreenchange',
        'beforeunload',
        'pagehide'
    ]);

    const eventHandlersToNullify = [
        'onblur',
        'onfocus',
        'onfocusout',
        'onfocusin',
        'onmouseleave',
        'onmouseout',
        'onbeforeunload',
        'onpagehide',
        'onvisibilitychange',
        'onwebkitvisibilitychange',
        'onmozvisibilitychange',
        'onmsvisibilitychange',
        'onfullscreenchange',
        'onwebkitfullscreenchange',
        'onmozfullscreenchange',
        'onmsfullscreenchange'
    ];

    const visibilityProperties = {
        visibilityState: 'visible',
        hidden: false,
        webkitVisibilityState: 'visible',
        mozVisibilityState: 'visible',
        msVisibilityState: 'visible',
        webkitHidden: false,
        mozHidden: false,
        msHidden: false,
    };

    // --- 核心防护逻辑，抽成函数以便应用到主窗口 + 所有同源 iframe ---
    // 返回该 realm 原始的 addEventListener 引用，调用方可用它绕过自己的过滤器
    const applyCoreProtections = (win) => {
        const doc = win.document;
        if (!doc) return null;

        // 1. 劫持该 realm 的 EventTarget.prototype.addEventListener
        let origAel = null;
        try {
            origAel = win.EventTarget.prototype.addEventListener;
            win.EventTarget.prototype.addEventListener = function(type, listener, options) {
                const typeName = typeof type === 'string' ? type.toLowerCase() : '';
                const isMainTarget = this === win || this === doc || this === doc.documentElement || this === doc.body;
                if (typeName && forbiddenEvents.has(typeName) && isMainTarget) {
                    if (DEBUG) console.log(`[${SCRIPT_NAME}] 已阻止向`, this, `添加 "${type}" 事件监听器`);
                    return;
                }
                return origAel.call(this, type, listener, options);
            };
            spoofNative(win.EventTarget.prototype.addEventListener, 'addEventListener');
        } catch (error) {
            if (DEBUG) console.warn(`[${SCRIPT_NAME}] addEventListener 劫持失败:`, error);
        }

        // 2. 页面可见性 API —— 强制 visible
        // 实例层：直接读 document.hidden / visibilityState 走这里
        for (const [propName, propValue] of Object.entries(visibilityProperties)) {
            safeDefine(doc, propName, { value: propValue, writable: false, configurable: true });
        }
        // 原型层：防止 Object.getOwnPropertyDescriptor(Document.prototype, 'hidden').get.call(document) 之类直查绕过
        // 原生 getter 在部分浏览器不可配置，失败时静默跳过，仍保留实例层保护
        try {
            const docProto = win.Document && win.Document.prototype;
            if (docProto) {
                for (const [propName, propValue] of Object.entries(visibilityProperties)) {
                    safeDefine(docProto, propName, { get: () => propValue, configurable: true });
                }
            }
        } catch (error) {
            if (DEBUG) console.warn(`[${SCRIPT_NAME}] Document.prototype 可见性 getter 劫持失败:`, error);
        }

        // 3. document.hasFocus 固定返回 true（实例层 + 原型层）
        const fakeHasFocus = function hasFocus() { return true; };
        spoofNative(fakeHasFocus, 'hasFocus');
        safeDefine(doc, 'hasFocus', { value: fakeHasFocus, writable: false, configurable: true });
        try {
            const docProto = win.Document && win.Document.prototype;
            if (docProto) {
                safeDefine(docProto, 'hasFocus', { value: fakeHasFocus, writable: false, configurable: true });
            }
        } catch (error) {
            if (DEBUG) console.warn(`[${SCRIPT_NAME}] Document.prototype.hasFocus 劫持失败:`, error);
        }

        // 4. window/document 事件处理器属性清零
        eventHandlersToNullify.forEach(handlerName => {
            safeDefine(win, handlerName, { value: null, writable: false, configurable: true });
            safeDefine(doc, handlerName, { value: null, writable: false, configurable: true });
        });

        // 5. navigator.userActivation 伪造
        try {
            const fakeActivation = Object.freeze({ hasBeenActive: true, isActive: true });
            safeDefine(win.navigator, 'userActivation', {
                get: () => fakeActivation,
                configurable: true
            });
        } catch (error) {
            if (DEBUG) console.warn(`[${SCRIPT_NAME}] userActivation 伪造失败:`, error);
        }

        // 6. 全屏 API
        try {
            const fakeFullscreenElement = doc.createElement('div');
            fakeFullscreenElement.style.display = 'none';
            if (doc.documentElement) doc.documentElement.appendChild(fakeFullscreenElement);

            const fullscreenProperties = {
                fullscreenElement: fakeFullscreenElement,
                webkitFullscreenElement: fakeFullscreenElement,
                mozFullScreenElement: fakeFullscreenElement,
                msFullscreenElement: fakeFullscreenElement,
                fullscreenEnabled: true,
                webkitFullscreenEnabled: true,
                mozFullScreenEnabled: true,
                msFullscreenEnabled: true
            };
            for (const [propName, propValue] of Object.entries(fullscreenProperties)) {
                safeDefine(doc, propName, { get: () => propValue, configurable: true });
            }

            const noopFullscreen = function requestFullscreen() {
                if (DEBUG) console.log(`[${SCRIPT_NAME}] 已阻止全屏相关调用`);
                return Promise.resolve();
            };
            spoofNative(noopFullscreen, 'requestFullscreen');

            ['requestFullscreen', 'webkitRequestFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'].forEach(name => {
                try { if (name in win.Element.prototype) win.Element.prototype[name] = noopFullscreen; } catch (_) {}
            });
            ['exitFullscreen', 'webkitExitFullscreen', 'mozCancelFullScreen', 'msExitFullscreen'].forEach(name => {
                try { if (name in doc) doc[name] = noopFullscreen; } catch (_) {}
            });
        } catch (error) {
            if (DEBUG) console.warn(`[${SCRIPT_NAME}] 全屏 API 劫持失败:`, error);
        }

        return origAel;
    };

    // --- 应用到主窗口 ---
    const originalAddEventListener = applyCoreProtections(pageWindow);
    if (DEBUG) console.log(`[${SCRIPT_NAME}] 主窗口防护已应用。`);

    // --- #3 关键原型锁定：addEventListener 不可再被页面覆盖 ---
    // 重新用不可写、不可配置的描述符固定当前劫持版本
    try {
        const lockedAel = pageWindow.EventTarget.prototype.addEventListener;
        Object.defineProperty(pageWindow.EventTarget.prototype, 'addEventListener', {
            value: lockedAel,
            writable: false,
            configurable: false,
            enumerable: false
        });
        if (DEBUG) console.log(`[${SCRIPT_NAME}] EventTarget.prototype.addEventListener 描述符已锁定。`);
    } catch (error) {
        console.error(`[${SCRIPT_NAME}] 锁定 addEventListener 描述符失败:`, error);
    }

    // --- #1 iframe 覆盖：对同源 iframe 注入相同防护 ---
    try {
        const patchIframe = (iframe) => {
            try {
                const win = iframe.contentWindow;
                if (!win || win === pageWindow) return;
                // 跨域 iframe 访问 contentWindow.document 会抛 SecurityError，由外层 catch 处理
                if (!win.document) return;
                applyCoreProtections(win);
                if (DEBUG) console.log(`[${SCRIPT_NAME}] 已对 iframe 注入防护:`, iframe.src || '(no src)');
            } catch (_) {
                // 跨域 iframe 无权限访问，静默跳过
            }
        };

        const patchAllExistingIframes = () => {
            try {
                pageWindow.document.querySelectorAll('iframe').forEach(patchIframe);
            } catch (_) {}
        };

        const scheduleIframePatch = (iframe) => {
            // iframe src 异步加载，load 后再补一次；about:blank / srcdoc 可立刻生效
            patchIframe(iframe);
            try {
                // 必须绕过自己的过滤器（load 不在黑名单，但直接用原始引用更稳）
                originalAddEventListener.call(iframe, 'load', () => patchIframe(iframe));
            } catch (_) {}
        };

        const observer = new MutationObserver(records => {
            for (const record of records) {
                for (const node of record.addedNodes) {
                    if (!node || node.nodeType !== 1) continue;
                    if (node.tagName === 'IFRAME') {
                        scheduleIframePatch(node);
                    } else if (typeof node.querySelectorAll === 'function') {
                        node.querySelectorAll('iframe').forEach(scheduleIframePatch);
                    }
                }
            }
        });

        const startObserve = () => {
            if (pageWindow.document.documentElement) {
                observer.observe(pageWindow.document.documentElement, { childList: true, subtree: true });
            }
        };
        startObserve();

        // DOMContentLoaded 时扫一次已存在的 iframe（document-start 阶段多数 iframe 还未出现）
        if (pageWindow.document.readyState === 'loading') {
            originalAddEventListener.call(pageWindow.document, 'DOMContentLoaded', patchAllExistingIframes);
        } else {
            patchAllExistingIframes();
        }

        if (DEBUG) console.log(`[${SCRIPT_NAME}] iframe 观察器已启动。`);
    } catch (error) {
        console.error(`[${SCRIPT_NAME}] 启动 iframe 观察器时出错:`, error);
    }

    // --- #2 Web Worker 驱动的活动模拟（绕过后台标签页节流） ---
    // Worker 中的定时器不受主线程后台节流影响，保证切 tab 后鼠标移动事件仍按原间隔派发
    let workerInstance = null;
    let fallbackTimerId = null;

    const dispatchFakeMouseMove = () => {
        try {
            const w = pageWindow.innerWidth || 800;
            const h = pageWindow.innerHeight || 600;
            const x = Math.floor(Math.random() * w);
            const y = Math.floor(Math.random() * h);
            const fakeMouseEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                view: pageWindow,
                clientX: x,
                clientY: y
            });
            pageWindow.document.dispatchEvent(fakeMouseEvent);
            if (DEBUG) console.log(`[${SCRIPT_NAME}] 已派发模拟 mousemove (${x}, ${y})。`);
        } catch (error) {
            if (DEBUG) console.warn(`[${SCRIPT_NAME}] 派发模拟事件失败:`, error);
        }
    };

    try {
        const workerSrc = `
            let tid = null;
            const schedule = () => {
                const delay = 12000 + Math.floor(Math.random() * 6000);
                tid = setTimeout(() => { self.postMessage('tick'); schedule(); }, delay);
            };
            self.addEventListener('message', (e) => {
                if (e.data === 'start') schedule();
                else if (e.data === 'stop') { clearTimeout(tid); tid = null; }
            });
        `;
        const blob = new Blob([workerSrc], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        workerInstance = new Worker(workerUrl);
        workerInstance.addEventListener('message', (e) => {
            if (e.data === 'tick') dispatchFakeMouseMove();
        });
        workerInstance.postMessage('start');
        if (DEBUG) console.log(`[${SCRIPT_NAME}] Worker 活动模拟已启动（不受后台节流）。`);
    } catch (error) {
        // CSP 严格或环境不支持 Blob Worker，回退到主线程 setTimeout
        console.warn(`[${SCRIPT_NAME}] Worker 启动失败，回退到主线程定时器:`, error);
        workerInstance = null;
        const scheduleFallback = () => {
            const delay = 12000 + Math.floor(Math.random() * 6000);
            fallbackTimerId = pageWindow.setTimeout(() => {
                dispatchFakeMouseMove();
                scheduleFallback();
            }, delay);
        };
        scheduleFallback();
    }

    // cleanup：通过原始 addEventListener 绕过自己的 pagehide 过滤器
    try {
        originalAddEventListener.call(pageWindow, 'pagehide', () => {
            if (workerInstance) {
                try { workerInstance.postMessage('stop'); workerInstance.terminate(); } catch (_) {}
                workerInstance = null;
            }
            if (fallbackTimerId !== null) {
                pageWindow.clearTimeout(fallbackTimerId);
                fallbackTimerId = null;
            }
            if (DEBUG) console.log(`[${SCRIPT_NAME}] 已清除活动模拟资源。`);
        });
    } catch (error) {
        console.error(`[${SCRIPT_NAME}] 注册 pagehide cleanup 失败:`, error);
    }

    // --- 4. 添加禁用列表菜单命令 ---
    try {
        GM_registerMenuCommand('将当前网站添加到禁用列表', addToBlockList);

        function showNotification(message, onclick) {
            const opts = {
                text: message,
                title: SCRIPT_NAME,
                highlight: true,
                timeout: 3000
            };
            if (typeof onclick === 'function') opts.onclick = onclick;
            GM_notification(opts);
        }

        function addToBlockList() {
            try {
                const url = new URL(pageWindow.location.href);
                const pattern = `*://*.${url.hostname}/*`;
                const fullMatchText = `// @match           ${pattern}`;

                GM_setClipboard(fullMatchText, 'text');
                console.log(`[${SCRIPT_NAME}] 已复制到剪贴板: ${fullMatchText}`);

                showNotification(
                    `已复制完整 @match 规则到剪贴板，点击此通知查看后续指引`,
                    () => showNotification(`请打开油猴管理面板 > 本脚本 > 将剪贴板内容粘贴到 @match 区域`)
                );
            } catch (error) {
                console.error(`[${SCRIPT_NAME}] 添加到禁用列表时出错:`, error);
                showNotification(`操作失败: ${error.message}`);
            }
        }

        if (DEBUG) console.log(`[${SCRIPT_NAME}] 禁用列表菜单命令已添加。`);
    } catch (error) {
        console.error(`[${SCRIPT_NAME}] 添加禁用列表选项时出错:`, error);
    }

    console.log(`[${SCRIPT_NAME}] 初始化完成。`);

})();
