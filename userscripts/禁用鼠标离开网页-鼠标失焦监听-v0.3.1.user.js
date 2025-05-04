// ==UserScript==
// @name         禁用鼠标离开网页/窗口失焦监听
// @namespace    http://tampermonkey.net/
// @version      0.4.2
// @description  通过多种方式阻止网页检测鼠标离开页面、窗口失去焦点或页面可见性变化，并包含活动模拟，旨在保护用户操作不被意外中断或记录。
// @author       Chuwu
// @match        *://*.chaoxing.com/*
// @match        *://*.icve.com.cn/*
// @match        *://*.edu.cn/*
// @match        *://*.icourse163.org/*
// @match        https://e.huawei.com/*
// @match        https://talent.shixizhi.huawei.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chaoxing.com
// @grant        unsafeWindow
// @run-at       document-start
// @license      AGPL3.0
// @downloadURL  https://update.greasyfork.org/scripts/531453/%E7%A6%81%E7%94%A8%E9%BC%A0%E6%A0%87%E7%A6%BB%E5%BC%80%E7%BD%91%E9%A1%B5%E9%BC%A0%E6%A0%87%E5%A4%B1%E7%84%A6%E7%9B%91%E5%90%AC.user.js
// @updateURL    https://update.greasyfork.org/scripts/531453/%E7%A6%81%E7%94%A8%E9%BC%A0%E6%A0%87%E7%A6%BB%E5%BC%80%E7%BD%91%E9%A1%B5%E9%BC%A0%E6%A0%87%E5%A4%B1%E7%84%A6%E7%9B%91%E5%90%AC.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_NAME = '禁用鼠标离开/失焦监听';
    const DEBUG = false; // 设置为 true 以启用详细日志记录

    // 使用 unsafeWindow 直接访问页面的全局 window 对象
    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    if (DEBUG) console.log(`[${SCRIPT_NAME}] 脚本在 document-start 阶段开始运行。`);

    // --- 1. 重写 EventTarget.prototype.addEventListener ---
    // 阻止特定的事件监听器被添加到 window 或 document 对象上
    const forbiddenEvents = new Set([
        'mouseout',     // 鼠标移出元素
        'mouseleave',   // 鼠标离开元素（不冒泡）
        'blur',         // 元素失去焦点
        'focusout',     // 元素失去焦点（冒泡）
        'visibilitychange' // 页面可见性改变
    ]);

    // 保存原始的 addEventListener 方法引用
    const originalAddEventListener = EventTarget.prototype.addEventListener;

    // 重写 EventTarget 原型上的 addEventListener 方法
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        // 检查：1. 事件类型是否在我们想要阻止的列表中
        //       2. 事件监听的目标 (`this`) 是否是页面的 window 或 document 对象
        if (forbiddenEvents.has(type) && (this === pageWindow || this === pageWindow.document)) {
            if (DEBUG) console.log(`[${SCRIPT_NAME}] 已阻止向`, this, `添加 "${type}" 事件监听器`);
            // 不调用原始的 addEventListener，从而阻止监听器被添加
            return;
        }
        // 如果不是要阻止的事件或目标，则正常调用原始的 addEventListener
        return originalAddEventListener.call(this, type, listener, options);
    };

    if (DEBUG) console.log(`[${SCRIPT_NAME}] EventTarget.prototype.addEventListener 已被重写。`);


    // --- 2. 重写与焦点和可见性相关的属性 ---
    try {
        // --- 2.1 页面可见性 API (Page Visibility API) ---
        // 强制页面始终处于可见状态
        Object.defineProperty(pageWindow.document, 'visibilityState', {
            value: 'visible',  // 状态值固定为 'visible'
            writable: false,   // 设置为不可写，防止页面脚本轻易修改
            configurable: true // 保持可配置，允许油猴脚本自身更新或禁用
        });
        Object.defineProperty(pageWindow.document, 'hidden', {
            value: false,      // hidden 属性固定为 false
            writable: false,
            configurable: true
        });
        // 处理一些旧浏览器或特定浏览器可能使用的前缀版本
        Object.defineProperty(pageWindow.document, 'webkitVisibilityState', {
            value: 'visible', writable: false, configurable: true
        });
        Object.defineProperty(pageWindow.document, 'mozVisibilityState', {
            value: 'visible', writable: false, configurable: true
        });
        Object.defineProperty(pageWindow.document, 'msVisibilityState', {
            value: 'visible', writable: false, configurable: true
        });
        Object.defineProperty(pageWindow.document, 'webkitHidden', {
            value: false, writable: false, configurable: true
        });
        Object.defineProperty(pageWindow.document, 'mozHidden', {
            value: false, writable: false, configurable: true
        });
        Object.defineProperty(pageWindow.document, 'msHidden', {
            value: false, writable: false, configurable: true
        });

        if (DEBUG) console.log(`[${SCRIPT_NAME}] 页面可见性 API (Visibility API) 相关属性已被重写。`);

        // --- 2.2 文档焦点 (Document Focus) ---
        // 重写 document.hasFocus() 方法，使其始终返回 true
        Object.defineProperty(pageWindow.document, 'hasFocus', {
            value: () => true, // 强制返回 true，表示页面始终拥有焦点
            writable: false,   // 不可写
            configurable: true // 可配置
        });

        if (DEBUG) console.log(`[${SCRIPT_NAME}] document.hasFocus 方法已被重写。`);

        // --- 2.3 窗口失焦/聚焦事件 (Window Blur/Focus - 旧版事件处理) ---
        // 通过定义属性来阻止直接赋值 `window.onblur` 或 `window.onfocus`
        Object.defineProperty(pageWindow, 'onblur', {
            value: null,       // 值设为 null
            writable: false,   // 阻止直接赋值，如 `window.onblur = function(){...}`
            configurable: true
        });
        Object.defineProperty(pageWindow, 'onfocus', {
            value: null,
            writable: false,
            configurable: true
        });
        // 同样处理 onfocusout 和 onfocusin
        Object.defineProperty(pageWindow, 'onfocusout', {
            value: null, writable: false, configurable: true
        });
        Object.defineProperty(pageWindow, 'onfocusin', {
            value: null, writable: false, configurable: true
        });

        if (DEBUG) console.log(`[${SCRIPT_NAME}] window.onblur / window.onfocus 等属性已被重写。`);

    } catch (e) {
        console.error(`[${SCRIPT_NAME}] 重写焦点/可见性相关属性时出错:`, e);
    }

    // --- 3. 定期模拟鼠标移动事件 (恢复原方法 5) ---
    // 目的：模拟用户活动，可能用于防止某些基于鼠标静止的检测或闲置超时机制。
    try {
        // 创建一个模拟的鼠标移动事件对象
        const fakeMouseEvent = new MouseEvent('mousemove', {
            bubbles: true,       // 事件应该冒泡
            cancelable: true,    // 事件可以被取消
            view: pageWindow,    // 关联的视图（窗口）
            clientX: 100,        // 模拟的 X 坐标 (可以考虑随机化)
            clientY: 100         // 模拟的 Y 坐标 (可以考虑随机化)
            // screenX, screenY, movementX, movementY 等也可以根据需要添加
        });

        // 设置定时器，定期在 document 上派发这个模拟事件
        const intervalId = pageWindow.setInterval(function() {
            // 在页面的 document 上触发 'mousemove' 事件
            pageWindow.document.dispatchEvent(fakeMouseEvent);
            if (DEBUG) console.log(`[${SCRIPT_NAME}] 已派发模拟的 mousemove 事件。`);
        }, 30000); // 每 30000 毫秒 (30 秒) 触发一次

        if (DEBUG) console.log(`[${SCRIPT_NAME}] 已启动模拟鼠标活动 (定时器 ID: ${intervalId})。`);

        pageWindow.addEventListener('unload', () => {
            pageWindow.clearInterval(intervalId);
            if (DEBUG) console.log(`[${SCRIPT_NAME}] 已清除模拟鼠标活动的定时器。`);
        });

    } catch (e) {
        console.error(`[${SCRIPT_NAME}] 启动模拟鼠标移动时出错:`, e);
    }

    // --- 初始化完成日志 ---
    console.log(`[${SCRIPT_NAME}] 初始化完成。`);

})();
