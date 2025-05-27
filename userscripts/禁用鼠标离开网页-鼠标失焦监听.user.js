// ==UserScript==
// @name            禁用鼠标离开网页/窗口失焦监听
// @namespace       http://tampermonkey.net/
// @version         0.4.3
// @description     通过多种方式阻止网页检测鼠标离开页面、窗口失去焦点或页面可见性变化，并包含活动模拟，旨在保护用户操作不被意外中断或记录。
// @author          Chuwu
// @match           *://*.chaoxing.com/*
// @match           *://*.icve.com.cn/*
// @match           *://*.edu.cn/*
// @match           *://*.icourse163.org/*
// @match           *://*.linknl.com/*
// @match           https://*.huawei.com/*
// @match           https://talent.shixizhi.huawei.com/*
// @icon            https://www.google.com/s2/favicons?sz=64&domain=chaoxing.com
// @grant           unsafeWindow
// @run-at          document-start
// @license         AGPL3.0
// @downloadURL https://update.greasyfork.org/scripts/531453/%E7%A6%81%E7%94%A8%E9%BC%A0%E6%A0%87%E7%A6%BB%E5%BC%80%E7%BD%91%E9%A1%B5%E7%AA%97%E5%8F%A3%E5%A4%B1%E7%84%A6%E7%9B%91%E5%90%AC.user.js
// @updateURL https://update.greasyfork.org/scripts/531453/%E7%A6%81%E7%94%A8%E9%BC%A0%E6%A0%87%E7%A6%BB%E5%BC%80%E7%BD%91%E9%A1%B5%E7%AA%97%E5%8F%A3%E5%A4%B1%E7%84%A6%E7%9B%D1%E5%90%AC.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_NAME = '禁用鼠标离开/失焦监听'; // 脚本名称，用于日志输出
    const DEBUG = false; // 调试模式开关，设置为 true 以启用详细日志记录

    // 获取页面的全局 window 对象，优先使用 unsafeWindow
    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    if (DEBUG) console.log(`[${SCRIPT_NAME}] 脚本在 document-start 阶段开始运行。`);

    // --- 1. 重写 EventTarget.prototype.addEventListener ---
    // 功能1：重写 EventTarget.prototype.addEventListener 方法
    // 阻止特定的事件监听器被添加到 window 或 document 对象上
    const forbiddenEvents = new Set([
        'mouseout', // 鼠标指针移出元素或其子元素时触发
        'mouseleave', // 鼠标指针移出元素时触发 (不冒泡)
        'blur', // 元素失去焦点时触发
        'focusout', // 元素即将失去焦点时触发 (冒泡)
        'visibilitychange' // 页面的可见性状态发生改变时触发
    ]);

    // 保存原始的 addEventListener 方法引用
    const originalAddEventListener = EventTarget.prototype.addEventListener;

    // 重写 EventTarget 原型上的 addEventListener 方法
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        // 检查：
        // 1. 事件类型是否在禁止列表中
        // 2. 事件监听的目标 (`this`) 是否是页面的 window 或 document 对象
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
    // 功能2：重写与焦点和可见性相关的属性
    try {
        // --- 2.1 页面可见性 API (Page Visibility API) ---
        // 强制页面始终处于 'visible' (可见) 状态
        const visibilityProperties = {
            visibilityState: 'visible',
            hidden: false,
            webkitVisibilityState: 'visible', // Webkit 内核浏览器前缀
            mozVisibilityState: 'visible', // Mozilla 内核浏览器前缀
            msVisibilityState: 'visible', // IE/Edge 浏览器前缀
            webkitHidden: false,
            mozHidden: false,
            msHidden: false,
        };

        // 遍历并重写上述定义的各属性
        for (const propName in visibilityProperties) {
            if (Object.prototype.hasOwnProperty.call(visibilityProperties, propName)) {
                // 使用 Object.defineProperty 重写 document 的属性
                Object.defineProperty(pageWindow.document, propName, {
                    value: visibilityProperties[propName],
                    writable: false, // 设置为不可写，防止页面脚本轻易修改
                    configurable: true // 保持可配置，允许油猴脚本自身更新或禁用此重写
                });
            }
        }
        if (DEBUG) console.log(`[${SCRIPT_NAME}] 页面可见性 API 相关属性已被重写。`);

        // --- 2.2 文档焦点 (Document Focus) ---
        // 重写 document.hasFocus() 方法，使其始终返回 true
        Object.defineProperty(pageWindow.document, 'hasFocus', {
            value: () => true, // 使其固定返回 true，表明页面始终拥有焦点
            writable: false,
            configurable: true
        });
        if (DEBUG) console.log(`[${SCRIPT_NAME}] document.hasFocus 方法已被重写。`);

        // --- 2.3 窗口失焦/聚焦事件 (旧版事件处理方式) ---
        // 阻止直接赋值给 window.onblur, window.onfocus 等事件处理器属性
        const windowEventHandlersToNullify = ['onblur', 'onfocus', 'onfocusout', 'onfocusin'];
        // 遍历并重写上述定义的各事件处理器属性
        windowEventHandlersToNullify.forEach(handlerName => {
            // 使用 Object.defineProperty 重写 window 的事件处理器属性
            Object.defineProperty(pageWindow, handlerName, {
                value: null, // 将事件处理器赋值为 null
                writable: false, // 设置为不可写，以阻止如 `window.onblur = function(){...}` 这样的直接赋值
                configurable: true
            });
        });
        if (DEBUG) console.log(`[${SCRIPT_NAME}] window.onblur/onfocus 等属性已被重写。`);

    } catch (error) {
        // 捕获并报告在重写属性过程中发生的错误
        console.error(`[${SCRIPT_NAME}] 重写焦点/可见性相关属性时出错:`, error);
    }

    // --- 3. 定期模拟鼠标移动事件 ---
    // 功能3：定期模拟鼠标移动事件
    // 目的：模拟用户活动，以防止某些基于用户长时间无操作的检测。
    try {
        // 创建一个模拟的 'mousemove' (鼠标移动) 事件对象
        const fakeMouseEvent = new MouseEvent('mousemove', {
            bubbles: true, // 事件应冒泡
            cancelable: true, // 事件可被取消
            view: pageWindow, // 关联的视图 (通常是 window 对象)
            clientX: 100, // 模拟的鼠标事件在浏览器可视区域的X坐标
            clientY: 100 // 模拟的鼠标事件在浏览器可视区域的Y坐标
        });

        const activityInterval = 30000; // 模拟活动的间隔时间 (毫秒), 此处为30秒
        // 设置定时器，定期在 document 上派发模拟的鼠标移动事件
        const intervalId = pageWindow.setInterval(() => {
            // 在页面的 document 对象上触发 'mousemove' 事件
            pageWindow.document.dispatchEvent(fakeMouseEvent);
            if (DEBUG) console.log(`[${SCRIPT_NAME}] 已派发模拟的 mousemove 事件。`);
        }, activityInterval);

        if (DEBUG) console.log(`[${SCRIPT_NAME}] 已启动模拟鼠标活动 (定时器 ID: ${intervalId})。`);

        // 添加 'unload' 事件监听器，在页面卸载时清除定时器
        pageWindow.addEventListener('unload', () => {
            // 清除之前设置的定时器，防止内存泄漏或不必要的后台活动
            pageWindow.clearInterval(intervalId);
            if (DEBUG) console.log(`[${SCRIPT_NAME}] 已清除模拟鼠标活动的定时器。`);
        });

    } catch (error) {
        // 捕获并报告在启动模拟鼠标移动过程中发生的错误
        console.error(`[${SCRIPT_NAME}] 启动模拟鼠标移动时出错:`, error);
    }

    // --- 初始化完成日志 ---
    // 脚本初始化完成，相关监听器已被禁用，活动模拟已启动。
    console.log(`[${SCRIPT_NAME}] 初始化完成。`);

})();
