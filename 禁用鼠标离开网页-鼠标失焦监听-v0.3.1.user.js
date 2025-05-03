// ==UserScript==
// @name         禁用鼠标离开网页/鼠标失焦监听
// @namespace    http://tampermonkey.net/
// @version      v0.3.1
// @description  禁止网页通过多种方式检测鼠标是否离开页面或窗口失去焦点，旨在保护用户操作不被意外中断或记录。
// @author       Chuwu@https://github.com/HatsuChuwu
// @match        https://mooc2-ans.chaoxing.com/*
// @match        https://zjy2.icve.com.cn/*
// @match        https://mooc1.chaoxing.com/*
// @match        https://e.huawei.com/*
// @match        https://talent.shixizhi.huawei.com/*
// @match        *://*.chaoxing.com/*
// @match        *://*.edu.cn/*
// @match        *://*.icve.com.cn/*
// @match        *://*.course.icve.com.cn/*
// @match        *://*.zjy2.icve.com.cn/*
// @match        *://*.zyk.icve.com.cn/*
// @match        *://*.icourse163.org/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chaoxing.com
// @grant        none
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/531453/%E7%A6%81%E7%94%A8%E9%BC%A0%E6%A0%87%E7%A6%BB%E5%BC%80%E7%BD%91%E9%A1%B5%E9%BC%A0%E6%A0%87%E5%A4%B1%E7%84%A6%E7%9B%91%E5%90%AC.user.js
// @updateURL https://update.greasyfork.org/scripts/531453/%E7%A6%81%E7%94%A8%E9%BC%A0%E6%A0%87%E7%A6%BB%E5%BC%80%E7%BD%91%E9%A1%B5%E9%BC%A0%E6%A0%87%E5%A4%B1%E7%84%A6%E7%9B%91%E5%90%AC.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_NAME = '鼠标离开/鼠标失焦监听禁用';

    // 1. 阻止 mouseout 和 mouseleave 事件监听器
    ['mouseout', 'mouseleave'].forEach(eventName => {
        document.addEventListener(eventName, function(event) {
            event.stopPropagation();
            event.preventDefault();
        }, { capture: true, passive: false });
    });

    // 2. 阻止 window 上的 blur 和 focusout 事件监听器
    ['blur', 'focusout'].forEach(eventName => {
        window.addEventListener(eventName, function(event) {
            event.stopPropagation();
            event.preventDefault();
        }, { capture: true, passive: false });
    });

    // 3. 伪造页面可见性状态 (Page Visibility API)
    try {
        Object.defineProperty(document, 'visibilityState', {
            get: function() { return 'visible'; },
            configurable: true
        });
        Object.defineProperty(document, 'hidden', {
            get: function() { return false; },
            configurable: true
        });
    } catch (e) {
        console.error(`${SCRIPT_NAME}: Failed to redefine visibilityState/hidden properties.`, e);
    }

    // 4. 拦截 visibilitychange 事件
    document.addEventListener('visibilitychange', function(event) {
        event.stopPropagation();
        event.preventDefault();
    }, { capture: true, passive: false });

// 5. 阻止页面检测鼠标坐标超出窗口
    const fakeMouseEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
        cancelable: true
    });
    setInterval(function() {
        document.dispatchEvent(fakeMouseEvent); // 定期模拟鼠标移动
    }, 30000); // 每30秒触发一次，模拟用户活跃

    // 6. 重写旧式的 window.onblur 事件处理
    try {
        window.onblur = null;
    } catch (e) {
        console.error(`${SCRIPT_NAME}: Failed to override window.onblur/onfocus.`, e);
    }

    // 7. 防止通过 document.hasFocus() 方法检测页面焦点
    try {
        Document.prototype.hasFocus = function() {
            return true;
        };
    } catch (e) {
        console.error(`${SCRIPT_NAME}: Failed to redefine document.hasFocus.`, e);
    }

    console.log(`${SCRIPT_NAME}: Initialized. Mouse leave/blur detection prevention active.`);
})();