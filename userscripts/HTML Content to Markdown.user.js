// ==UserScript==
// @name         HTML Content to Markdown
// @name:zh      网页内容转Markdown
// @namespace    https://github.com/ChuwuYo
// @homepageURL  https://github.com/ChuwuYo/misc-files/blob/main/userscripts/HTML%20Content%20to%20Markdown.user.js
// @supportURL   https://github.com/ChuwuYo/misc-files/issues
// @version      0.2.2
// @description  Convert selected HTML Content to Markdown
// @description:zh 将选定的HTML内容转换为Markdown
// @author       ChuwuYo
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @icon         https://litera-reader.com/favicon.png?v=2
// @require      https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/turndown@7.2.0/dist/turndown.js
// @require      https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js
// @require      https://cdn.jsdelivr.net/npm/jquery-ui@1.12.1/jquery-ui.min.js
// @require      https://cdn.jsdelivr.net/npm/@guyplusplus/turndown-plugin-gfm@1.0.7/dist/turndown-plugin-gfm.js
// @license      AGPL-3.0
// @downloadURL  https://raw.githubusercontent.com/ChuwuYo/misc-files/main/userscripts/HTML%20Content%20to%20Markdown.user.js
// @updateURL    https://raw.githubusercontent.com/ChuwuYo/misc-files/main/userscripts/HTML%20Content%20to%20Markdown.user.js
// ==/UserScript==

/* global TurndownService, TurndownPluginGfmService, marked, $, jQuery,
   GM_addStyle, GM_registerMenuCommand, GM_setClipboard, GM_setValue, GM_getValue */
(function () {
    'use strict';

    // --- User Config Defaults ---
    const DEFAULT_SHORTCUT_CONFIG = {
        "Shift": false,
        "Ctrl": true,
        "Alt": false,
        "Key": "m"
    };
    const DEFAULT_FILTER_CONFIG = {
        removeTags: ['script', 'style', 'link', 'meta', 'iframe', 'noscript', 'object', 'embed', 'button', 'input', 'textarea', 'select', 'option', 'form', 'video', 'audio', 'canvas', 'map', 'area', 'track', 'applet', 'bgsound', 'blink', 'isindex', 'keygen', 'marquee', 'menuitem', 'nextid', 'noembed', 'param', 'source'],
        removeAttributes: [
            'style', 'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout',
            'onfocus', 'onblur', 'target', 'contenteditable', 'draggable',
            'tabindex', 'spellcheck', 'translate', 'dir', 'lang',
            'aria-\\w+', 'data-\\w+'
        ],
        keepAttributesOnTags: {
            'img': ['src', 'alt', 'title', 'width', 'height'],
            'a': ['href', 'title', 'rel'],
            'code': ['class'],
            'pre': ['class'],
            'table': ['class'],
            'th': ['scope', 'colspan', 'rowspan'],
            'td': ['colspan', 'rowspan']
        },
        removeElementsWithClasses: ['advertisement', 'ads', 'sidebar', 'footer', 'header', 'nav', 'menu'],
        removeElementsWithIds: ['advertisement', 'ads', 'sidebar', 'footer', 'header', 'nav', 'menu'],
        smartContentDetection: true,
        preserveCodeBlocks: true
    };

    // --- User-Provided Config (can be empty) ---
    const shortCutUserConfig = {};

    // --- Global Variables ---
    let isSelecting = false;
    let isMultiSelectMode = false;
    let hoveredElement = null;
    let selectedElements = [];
    let shortCutConfig;
    let filterConfig;
    const _langs = (Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language]).map(l => (l || '').toLowerCase());
    const lang = _langs.some(l => l.includes('zh')) ? 'zh' : 'en';
    const I18N = {
        en: {
            singleTip: '<b>Single-Select</b><br>Use mouse/arrows. <b>Click</b> to convert.<br>Press <b>Shift</b> to Multi-Select.<br><b>Esc</b> cancel, <b>Enter</b> convert.',
            multiTip: () => `<b>Multi-Select (${selectedElements.length} selected)</b><br><b>Click</b> adds/removes.<br>Press <b>Shift</b> to toggle mode.<br><b>Enter</b> convert, <b>Esc</b> cancel.`,
            noElement: 'No element selected.',
            noContent: 'Selected elements have no valid content',
            copy: 'Copy to clipboard',
            copied: 'Copied!',
            download: 'Download as MD',
            startSelection: 'Start Selection',
            reset: 'Reset to Default',
            resetConfirm: 'Reset settings to default?',
            resetDone: 'Settings reset. The page will refresh.',
            gfmError: '[HTML to MD] Error: GFM plugin failed to load. Some Markdown features might not work correctly.',
            markedError: '[HTML to MD] Error: Markdown preview library (Marked) failed to load.',
            configErrorAlert: 'Error loading script configuration. Using default settings. Please check console for details.',
            processError: 'Error processing selection. Check console for details.'
        },
        zh: {
            singleTip: '<b>单选模式</b><br>使用鼠标/方向键导航。<b>点击</b>直接转换。<br>按 <b>Shift</b> 开启多选。<br><b>Esc</b> 取消，<b>Enter</b> 转换。',
            multiTip: () => `<b>多选模式（已选 ${selectedElements.length}）</b><br><b>点击</b>添加/移除。<br>按 <b>Shift</b> 切换模式。<br><b>Enter</b> 转换，<b>Esc</b> 取消。`,
            noElement: '未选择任何元素。',
            noContent: '所选元素没有有效内容',
            copy: '复制到剪贴板',
            copied: '已复制！',
            download: '下载为 MD',
            startSelection: '开始选择',
            reset: '重置为默认',
            resetConfirm: '确定要重置为默认设置吗？',
            resetDone: '配置已重置！页面将刷新。',
            gfmError: '[HTML to MD] 错误：GFM 插件加载失败，部分 Markdown 功能可能不可用。',
            markedError: '[HTML to MD] 错误：Marked 预览库加载失败。',
            configErrorAlert: '加载配置出错，已使用默认设置。详情请查看控制台。',
            processError: '处理选择内容时出错，请查看控制台。'
        }
    };

    const closeButtonSvgIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M2.343 13.657A8 8 0 1 1 13.658 2.343 8 8 0 0 1 2.343 13.657M6.03 4.97a.75.75 0 0 0-1.042.018.75.75 0 0 0-.018 1.042L6.94 8 4.97 9.97a.749.749 0 0 0 .326 1.275.75.75 0 0 0 .734-.215L8 9.06l1.97 1.97a.749.749 0 0 0 1.275-.326.75.75 0 0 0-.215-.734L9.06 8l1.97-1.97a.749.749 0 0 0-.326-1.275.75.75 0 0 0-.734.215L8 6.94Z"/></svg>';

    // --- Helper Functions ---
    function loadConfig(storageKey, defaultConfig, userProvidedConfig) {
        let mergedConfig = { ...defaultConfig };
        const storedConfigStr = GM_getValue(storageKey);

        if (storedConfigStr) {
            try {
                const storedConfig = storedConfigStr ? JSON.parse(storedConfigStr) : {};
                mergedConfig = { ...defaultConfig, ...storedConfig };
            } catch (e) {
                console.error(`[HTML to MD] Error parsing stored config for ${storageKey}:`, e, "\nStored string was:", storedConfigStr);
                GM_setValue(storageKey, JSON.stringify(defaultConfig)); // Reset to default if parsing fails
                mergedConfig = { ...defaultConfig };
            }
        } else {
            GM_setValue(storageKey, JSON.stringify(defaultConfig));
        }

        if (userProvidedConfig && Object.keys(userProvidedConfig).length > 0) {
            mergedConfig = { ...mergedConfig, ...userProvidedConfig };
            GM_setValue(storageKey, JSON.stringify(mergedConfig));
        }
        return mergedConfig;
    }

    // --- Initialize Configurations ---
    try {
        shortCutConfig = loadConfig('shortCutConfig', DEFAULT_SHORTCUT_CONFIG, shortCutUserConfig);
        filterConfig = { ...DEFAULT_FILTER_CONFIG };
    } catch (e) {
        console.error("[HTML to MD] Critical error loading configuration:", e);
        shortCutConfig = { ...DEFAULT_SHORTCUT_CONFIG };
        filterConfig = { ...DEFAULT_FILTER_CONFIG };
        alert(I18N[lang].configErrorAlert);
    }

    // --- Turndown Service Setup ---
    const turndownService = new TurndownService({
        codeBlockStyle: 'fenced', headingStyle: 'atx', hr: '---',
        bulletListMarker: '-', emDelimiter: '*', strongDelimiter: '**',
        linkStyle: 'inlined', linkReferenceStyle: 'full'
    });
    TurndownPluginGfmService.gfm(turndownService);

    if (filterConfig && filterConfig.removeTags && Array.isArray(filterConfig.removeTags)) {
        turndownService.remove(filterConfig.removeTags);
    }
    turndownService.remove((node) => node.nodeType === Node.COMMENT_NODE);

    // Enhanced image handling
    turndownService.addRule('enhancedImages', {
        filter: 'img',
        replacement: function (content, node) {
            const alt = node.getAttribute('alt') || '';
            const src = node.getAttribute('src') || '';
            const title = node.getAttribute('title');
            if (!src) return alt;
            return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
        }
    });

    // Enhanced link handling
    turndownService.addRule('enhancedLinks', {
        filter: function (node) {
            return node.nodeName === 'A' && node.getAttribute('href');
        },
        replacement: function (content, node) {
            const href = node.getAttribute('href');
            const title = node.getAttribute('title');
            if (!href || href.startsWith('javascript:') || href === '#') return content;
            return title ? `[${content}](${href} "${title}")` : `[${content}](${href})`;
        }
    });
    turndownService.addRule('mermaidBlocks', {
        filter: function (node) {
            const cls = node.classList ? Array.from(node.classList).map(c => c.toLowerCase()) : [];
            const hasMermaidClass = cls.some(c => c.includes('mermaid'));
            const isCodeMermaid = node.nodeName === 'CODE' && hasMermaidClass;
            const isDivMermaid = node.nodeName === 'DIV' && hasMermaidClass;
            const isPreMermaid = node.nodeName === 'PRE' && node.querySelector('code') && Array.from(node.querySelector('code').classList || []).some(c => c.toLowerCase().includes('mermaid'));
            const hasAttr = (node.getAttribute && ((node.getAttribute('data-mermaid') !== null) || (node.getAttribute('data-graph-type') || '').toLowerCase() === 'mermaid'));
            return isCodeMermaid || isDivMermaid || isPreMermaid || hasAttr;
        },
        replacement: function (content, node) {
            let text = '';
            if (node.nodeName === 'PRE') {
                const code = node.querySelector('code');
                text = (code ? code.textContent : node.textContent) || '';
            } else {
                text = node.textContent || '';
            }
            text = text.trim();
            if (!text) return `\n[Mermaid diagram]\n`;
            return `\n\`\`\`mermaid\n${text}\n\`\`\`\n`;
        }
    });

    // --- Core Functions ---
    function normalizeMarkdown(md) {
        let text = md.replace(/\r\n/g, '\n');
        text = text.replace(/(^|\n)(```[\s\S]*?```)(?=\n|$)/g, (m, lead, block) => {
            const prefix = lead === '' ? '' : lead + '\n';
            return `${prefix}\n${block.trim()}\n\n`;
        });
        text = text.replace(/(^|\n)(\|.+\|\n\|[ :\-\|]+\|\n(?:\|.*\|\n?)*)/g, (m, lead, table) => {
            const prefix = lead === '' ? '' : lead + '\n';
            return `${prefix}\n${table.trim()}\n\n`;
        });
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/^\s*\n+|\n+\s*$/g, '');
        return text;
    }

    function convertToMarkdown(element) {
        if (!element) return '';
        const clonedElement = element.cloneNode(true);

        if (filterConfig) {
            // 1. 合并类名/ID 选择器，一次性删除噪声元素
            // 只转义类/ID 名称本身，保留前导 "." / "#" 作为 CSS 选择器语法
            const escapeIdent = (name) => name.replace(/([.#\[\](){}*+?^$|\\])/g, '\\$1');
            const noiseSelectors = [];
            if (Array.isArray(filterConfig.removeElementsWithClasses)) {
                filterConfig.removeElementsWithClasses.forEach(raw => {
                    const name = String(raw).replace(/^\./, '');
                    if (!name) return;
                    // ".foo" 精确类匹配 + "[class~=\"foo\"]" 词边界匹配，
                    // 避免 [class*="ads"] 误杀 "loads" / "header-ads-placeholder-empty"
                    noiseSelectors.push(`.${escapeIdent(name)}`, `[class~="${name.replace(/"/g, '\\"')}"]`);
                });
            }
            if (Array.isArray(filterConfig.removeElementsWithIds)) {
                filterConfig.removeElementsWithIds.forEach(raw => {
                    const name = String(raw).replace(/^#/, '');
                    if (!name) return;
                    noiseSelectors.push(`#${escapeIdent(name)}`);
                });
            }
            if (noiseSelectors.length > 0) {
                try {
                    clonedElement.querySelectorAll(noiseSelectors.join(',')).forEach(el => el.remove());
                } catch (e) {
                    // 某个选择器非法时降级逐个执行，避免整批失败
                    console.warn('[HTML to MD] 合并选择器失败，降级逐个执行:', e);
                    noiseSelectors.forEach(sel => {
                        try { clonedElement.querySelectorAll(sel).forEach(el => el.remove()); } catch (_) {}
                    });
                }
            }

            // 2. 单次遍历合并「属性清洗 + 智能噪声检测」
            const removeAttrsList = Array.isArray(filterConfig.removeAttributes) ? filterConfig.removeAttributes : [];
            const smartNoise = /\b(ad|ads|advertisement|banner|popup|modal|overlay|sidebar|footer|header|nav|menu|social|share|comment|related|recommend)\b/;
            const allNodes = Array.from(clonedElement.querySelectorAll('*'));
            allNodes.forEach(el => {
                // 祖先在早期已被移除则整棵子树都不在 cloneRoot 内，跳过
                if (!clonedElement.contains(el)) return;

                if (filterConfig.smartContentDetection) {
                    const classList = el.classList ? Array.from(el.classList).join(' ').toLowerCase() : '';
                    const id = (el.id || '').toLowerCase();
                    if (smartNoise.test(classList) || smartNoise.test(id)) {
                        el.remove();
                        return;
                    }
                }

                if (removeAttrsList.length > 0) {
                    const tagName = el.tagName.toLowerCase();
                    const attributesToKeep = (filterConfig.keepAttributesOnTags && filterConfig.keepAttributesOnTags[tagName]) || [];
                    Array.from(el.attributes).forEach(attr => {
                        const attrName = attr.name.toLowerCase();
                        if (attributesToKeep.includes(attrName)) return;
                        for (const pattern of removeAttrsList) {
                            if (pattern.includes('\\w+')) {
                                const regex = new RegExp('^' + pattern + '$', 'i');
                                if (regex.test(attrName)) { el.removeAttribute(attr.name); return; }
                            } else if (attrName === pattern.toLowerCase()) {
                                el.removeAttribute(attr.name);
                                return;
                            }
                        }
                    });
                }
            });
        }

        const html = clonedElement.outerHTML;
        let turndownMd = turndownService.turndown(html);

        // Enhanced post-processing Markdown cleanup
        turndownMd = turndownMd.replace(/\[\s*]\(\s*\)/g, ''); // Remove completely empty links
        turndownMd = turndownMd.replace(/\[\s*]\((#|javascript:[^)]*|mailto:|tel:)\)/g, ''); // Remove empty/junk links
        turndownMd = turndownMd.replace(/\[([^\]]+)]\(\s*\)/g, '$1'); // Remove links with text but no href
        turndownMd = turndownMd.replace(/\[([^\]]+)]\(\1\)/g, '$1'); // Remove redundant links where text equals URL
        turndownMd = turndownMd.replace(/!\[\s*]\(\s*\)/g, ''); // Remove empty images
        turndownMd = turndownMd.replace(/\n{3,}/g, '\n\n'); // Consolidate multiple blank lines
        turndownMd = turndownMd.replace(/^\s*\n+|\n+\s*$/g, ''); // Trim leading/trailing whitespace
        turndownMd = turndownMd.replace(/(\*\*|__)\s*\1/g, ''); // Remove empty bold/italic markers
        turndownMd = turndownMd.replace(/`\s*`/g, ''); // Remove empty code spans

        return normalizeMarkdown(turndownMd.trim());
    }

    // 轻量 XSS 兜底：去掉 marked 输出里的危险标签 / 事件属性 / javascript: 协议
    // 未引入 DOMPurify（+25KB），适用于私人使用场景；正式环境建议接 DOMPurify
    function sanitizePreviewHtml(html) {
        const container = document.createElement('div');
        container.innerHTML = html;
        container.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach(n => n.remove());
        container.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                const value = (attr.value || '').trim().toLowerCase();
                if (name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                } else if ((name === 'href' || name === 'src' || name === 'xlink:href') && value.startsWith('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return container.innerHTML;
    }

    function showMarkdownModal(markdown) {
        const $modal = $(`
            <div class="h2m-modal-overlay">
                <div class="h2m-modal">
                    <div class="h2m-modal-body">
                        <textarea class="h2m-markdown-area" spellcheck="false"></textarea>
                        <div class="h2m-preview"></div>
                    </div>
                    <div class="h2m-modal-footer">
                        <button class="h2m-copy"></button>
                        <button class="h2m-download"></button>
                    </div>
                    <button class="h2m-close">${closeButtonSvgIcon}</button>
                </div>
            </div>
        `);

        const $markdownArea = $modal.find('.h2m-markdown-area');
        const $previewArea = $modal.find('.h2m-preview');
        const $copyButton = $modal.find('.h2m-copy');
        const $downloadButton = $modal.find('.h2m-download');
        const $closeButton = $modal.find('.h2m-close');

        $copyButton.text(I18N[lang].copy);
        $downloadButton.text(I18N[lang].download);
        $markdownArea.val(markdown); // Set initial value
        $previewArea.html(sanitizePreviewHtml(marked.parse(markdown)));

        $markdownArea.on('input', function () { $previewArea.html(sanitizePreviewHtml(marked.parse($(this).val()))); });
        // 打开时锁定背景滚动，关闭时恢复用户原值（不覆盖网站自有的 overflow 设置）
        const previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const closeModal = () => {
            $modal.remove();
            $(document).off('keydown.h2mModalGlobal');
            document.body.style.overflow = previousBodyOverflow;
        };
        $modal.on('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
        $(document).on('keydown.h2mModalGlobal', function (e) { if (e.key === 'Escape' && $('.h2m-modal-overlay').length > 0) closeModal(); });
        $copyButton.on('click', function () { GM_setClipboard($markdownArea.val()); $(this).text(I18N[lang].copied); setTimeout(() => $(this).text(I18N[lang].copy), 1000); });
        $downloadButton.on('click', function () {
            const md = $markdownArea.val(); const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob); const a = document.createElement('a');
            a.href = url; const safeTitle = (document.title.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || 'untitled');
            a.download = `${safeTitle}-${new Date().toISOString().replace(/:/g, '-')}.md`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        });
        $closeButton.on('click', closeModal);

        let isScrolling = false;
        function syncScroll(source, target) {
            if (isScrolling) { isScrolling = false; return; } isScrolling = true;
            const sh = source.scrollHeight - source.offsetHeight; if (sh <= 0) { isScrolling = false; return; }
            const scrollPercentage = source.scrollTop / sh;
            target.scrollTop = scrollPercentage * (target.scrollHeight - target.offsetHeight);
            setTimeout(() => isScrolling = false, 50);
        }
        $markdownArea.on('scroll', () => syncScroll($markdownArea[0], $previewArea[0]));
        $previewArea.on('scroll', () => syncScroll($previewArea[0], $markdownArea[0]));
        $('body').append($modal); $markdownArea.trigger('input'); // Trigger input to ensure preview is initially synced if markdown is complex
    }

    function updateTip() {
        const message = isMultiSelectMode ? I18N[lang].multiTip() : I18N[lang].singleTip;
        tip(message);
    }

    function processSelection() {
        try {
            let finalElements = isMultiSelectMode ? selectedElements : [hoveredElement];
            if (finalElements.length === 0 || (finalElements.length === 1 && !finalElements[0])) {
                tip(I18N[lang].noElement, 2000);
                return;
            }

            // Sort elements by their document order (top-to-bottom)
            // a.compareDocumentPosition(b) 返回的 FOLLOWING 位表示 b 在 a 之后，即 a 在前 → 返回 -1 让 a 排前
            finalElements.sort((a, b) => {
                const position = a.compareDocumentPosition(b);
                if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
                return 0;
            });

            const markdown = finalElements.map(el => convertToMarkdown(el)).join('\n\n---\n\n');

            if (markdown.trim()) {
                showMarkdownModal(markdown);
            } else {
                tip(I18N[lang].noContent, 2000);
            }
        } catch (err) {
            console.error("[HTML to MD] Error during conversion or showing modal:", err);
            alert(I18N[lang].processError);
        } finally {
            endSelecting();
        }
    }

    function _interactionBlocker(e) {
        if (!isSelecting) return;
        if ($(e.target).closest('#h2m-tip-instance, .h2m-modal-overlay').length) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }
    const BLOCKED_EVENTS = ['click','dblclick','mouseup','pointerup','contextmenu','dragstart','touchstart','touchend'];
    let blockersActive = false;
    function enableInteractionBlockers() {
        if (blockersActive) return;
        blockersActive = true;
        BLOCKED_EVENTS.forEach(type => document.addEventListener(type, _interactionBlocker, true));
    }
    function disableInteractionBlockers() {
        if (!blockersActive) return;
        BLOCKED_EVENTS.forEach(type => document.removeEventListener(type, _interactionBlocker, true));
        blockersActive = false;
    }

    function startSelecting() {
        if (isSelecting) return;
        isSelecting = true;
        isMultiSelectMode = false;
        selectedElements = [];
        hoveredElement = document.body.firstElementChild || document.body;
        applyHoverMark(hoveredElement);
        updateTip();
        enableInteractionBlockers();
    }
    function endSelecting() { if (!isSelecting) return; isSelecting = false; isMultiSelectMode = false; clearAllHoverMarks(); $('.h2m-selected-item').removeClass('h2m-selected-item'); $('#h2m-tip-instance').remove(); hoveredElement = null; selectedElements = []; disableInteractionBlockers(); }
    function isContentElement(el) {
        const contentTags = ['P', 'DIV', 'ARTICLE', 'SECTION', 'MAIN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'TABLE'];
        return contentTags.includes(el.tagName) || el.textContent.trim().length > 20;
    }

    function getSelectableElement(el) {
        if (!el) return el;
        const tableRoot = el.closest ? el.closest('table') : null;
        if (tableRoot) return tableRoot;
        const codeMermaid = el.closest ? el.closest('pre, code') : null;
        if (codeMermaid) {
            const classes = codeMermaid.classList ? Array.from(codeMermaid.classList).map(c => c.toLowerCase()) : [];
            const childCode = codeMermaid.querySelector && codeMermaid.querySelector('code');
            const childClasses = childCode && childCode.classList ? Array.from(childCode.classList).map(c => c.toLowerCase()) : [];
            if (classes.some(c => c.includes('mermaid')) || childClasses.some(c => c.includes('mermaid'))) {
                return codeMermaid.nodeName === 'PRE' ? codeMermaid : (codeMermaid.closest('pre') || codeMermaid);
            }
        }
        const divMermaid = el.closest ? el.closest('.mermaid,[data-mermaid],[data-graph-type="mermaid"]') : null;
        if (divMermaid) return divMermaid;
        return el;
    }

    function isValidElement(el) {
        if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    // CSS 的 attr() 只能读 HTML 属性；把 tag + class 合成到单一 data-h2m-label，避免类名为空时出现 "div - " 的尾巴
    function applyHoverMark(el) {
        if (!el) return;
        $(el).addClass('h2m-selection-box');
        try {
            const tag = (el.tagName || '').toLowerCase();
            const classes = (el.getAttribute('class') || '')
                .split(/\s+/)
                .filter(c => c && c !== 'h2m-selection-box' && c !== 'h2m-selected-item')
                .join(' ');
            el.setAttribute('data-h2m-label', classes ? `${tag} - ${classes}` : tag);
        } catch (_) {}
    }
    function clearHoverMark(el) {
        if (!el) return;
        $(el).removeClass('h2m-selection-box');
        try { el.removeAttribute('data-h2m-label'); } catch (_) {}
    }
    function clearAllHoverMarks() {
        $('.h2m-selection-box').each(function () {
            try { this.removeAttribute('data-h2m-label'); } catch (_) {}
        }).removeClass('h2m-selection-box');
    }

    // Use an ID for the tip element to increase specificity without !important.
    function tip(message, timeout = null) {
        $('#h2m-tip-instance').remove(); // Remove any existing tip by its unique ID
        const $t = $('<div>')
            .attr('id', 'h2m-tip-instance') // Assign a unique ID for high-specificity styling
            .html(message)
            .appendTo('body')
            .hide()
            .fadeIn(200);
        if (timeout !== null) {
            setTimeout(() => { $t.fadeOut(200, () => $t.remove()); }, timeout);
        }
    }

    function handleKeyboardNavigation(e) {
        if (!isSelecting || !hoveredElement) return;
        e.preventDefault();
        let newEl = hoveredElement;

        switch (e.key) {
            case 'Escape': endSelecting(); return;
            case 'Enter':
                processSelection();
                return;
            case 'ArrowUp':
                newEl = hoveredElement.parentElement || hoveredElement;
                if (['HTML', 'BODY'].includes(newEl.tagName)) {
                    newEl = newEl.firstElementChild || newEl;
                }
                break;
            case 'ArrowDown':
                newEl = hoveredElement.firstElementChild || hoveredElement;
                break;
            case 'ArrowLeft': {
                let p = hoveredElement.previousElementSibling;
                if (p) {
                    newEl = p;
                    while (newEl.lastElementChild && !isContentElement(newEl)) {
                        newEl = newEl.lastElementChild;
                    }
                } else if (hoveredElement.parentElement && !['BODY', 'HTML'].includes(hoveredElement.parentElement.tagName)) {
                    newEl = hoveredElement.parentElement;
                }
                break;
            }
            case 'ArrowRight': {
                let n = hoveredElement.nextElementSibling;
                if (n) {
                    newEl = n;
                    while (newEl.firstElementChild && !isContentElement(newEl)) {
                        newEl = newEl.firstElementChild;
                    }
                } else if (hoveredElement.parentElement && !['BODY', 'HTML'].includes(hoveredElement.parentElement.tagName)) {
                    newEl = hoveredElement.parentElement;
                }
                break;
            }
            default: return;
        }

        if (newEl && newEl !== hoveredElement && isValidElement(newEl)) {
            clearHoverMark(hoveredElement);
            hoveredElement = newEl;
            applyHoverMark(hoveredElement);
        }
    }
    $(document).on('keydown.h2m', function (e) {
        if (e.key.toUpperCase() === shortCutConfig.Key.toUpperCase() &&
            e.ctrlKey === shortCutConfig.Ctrl &&
            e.altKey === shortCutConfig.Alt &&
            e.shiftKey === shortCutConfig.Shift) {
            e.preventDefault();
            if (isSelecting) {
                endSelecting();
            } else {
                startSelecting();
            }
            return;
        }

        if (isSelecting) {
            if (e.key === 'Shift' && !e.repeat) { isMultiSelectMode = !isMultiSelectMode; updateTip(); }
            handleKeyboardNavigation(e);
        }
    }).on('mouseover.h2m', function (e) {
        if (isSelecting && !$(e.target).closest('#h2m-tip-instance, .h2m-modal-overlay').length) {
            const target = getSelectableElement(e.target);
            if (target && hoveredElement !== target && isValidElement(target)) {
                clearHoverMark(hoveredElement);
                hoveredElement = target;
                applyHoverMark(hoveredElement);
            }
        }
    }).on('mousedown.h2m', function (e) {
        if (isSelecting && hoveredElement && $(e.target).closest('#h2m-tip-instance, .h2m-modal-overlay').length === 0) {
            e.preventDefault();
            e.stopPropagation();

            const selectable = getSelectableElement(hoveredElement);
            if (selectable && selectable !== hoveredElement) {
                clearHoverMark(hoveredElement);
                hoveredElement = selectable;
                applyHoverMark(hoveredElement);
            }

            if (isMultiSelectMode) {
                const index = selectedElements.indexOf(hoveredElement);
                if (index > -1) {
                    selectedElements.splice(index, 1);
                    $(hoveredElement).removeClass('h2m-selected-item');
                } else {
                    selectedElements.push(hoveredElement);
                    $(hoveredElement).addClass('h2m-selected-item');
                }
                updateTip();
            } else {
                processSelection();
            }
        }
    });
    GM_registerMenuCommand(I18N[lang].startSelection, startSelecting);

    GM_registerMenuCommand(I18N[lang].reset, () => {
        if (confirm(I18N[lang].resetConfirm)) {
            GM_setValue('shortCutConfig', JSON.stringify(DEFAULT_SHORTCUT_CONFIG));
            alert(I18N[lang].resetDone);
            location.reload();
        }
    });

    // --- CSS Styles ---
    GM_addStyle(`
        .h2m-selection-box {
            outline: 2px dashed #0B57D0 !important;
            background-color: rgba(11, 87, 208, 0.1) !important;
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(11, 87, 208, 0.3) !important;
            position: relative;
            z-index: 9999998;
            /* 只过渡颜色相关属性，避免 transition: all 在快速鼠标移动时造成重绘抖动 */
            transition: outline-color 0.15s ease-in-out, background-color 0.15s ease-in-out !important;
        }
        .h2m-selected-item {
            outline: 2px solid #D00B0B !important;
            background-color: rgba(208, 11, 11, 0.15) !important;
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(208, 11, 11, 0.4) !important;
        }
        .h2m-selection-box::before {
            content: attr(data-h2m-label);
            position: absolute;
            /* top:-25px 会在元素紧贴视口顶部时被裁切；用 bottom:100% 让浏览器以元素边为基准，margin-bottom 留空 */
            top: auto;
            bottom: 100%;
            left: 0;
            margin-bottom: 4px;
            background: #0B57D0;
            color: white;
            padding: 2px 8px;
            font-size: 12px;
            border-radius: 3px;
            z-index: 10000000;
            font-family: monospace;
            white-space: nowrap;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .h2m-modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); z-index: 9999999; display: flex; align-items: center; justify-content: center; }
        .h2m-modal {
            width: 90%; height: 85%; max-width: 1600px; max-height: 95vh;
            background: #FFFFFF; border-radius: 16px;
            box-shadow: 0 8px 12px rgba(0,0,0,0.15), 0 4px 8px rgba(0,0,0,0.1);
            display: flex; flex-direction: column; padding: 0; position: relative; overflow: hidden;
        }
        .h2m-modal-body { flex-grow: 1; display: flex; flex-direction: row; overflow: hidden; border-top-left-radius: 16px; border-top-right-radius: 16px; }
        .h2m-modal-footer {
            flex-shrink: 0; padding: 12px 24px;
            background-color: #F8F9FA; border-top: 1px solid #DEE2E6;
            display: flex; justify-content: flex-end; align-items: center; gap: 12px; /* Ensure vertical alignment and gap */
            border-bottom-left-radius: 16px; border-bottom-right-radius: 16px;
            position: relative;
        }
        .h2m-modal textarea.h2m-markdown-area, .h2m-modal .h2m-preview {
            flex: 1; height: 100%; padding: 20px 24px; box-sizing: border-box;
            overflow-y: auto; border: none; font-size: 14px; line-height: 1.6; margin: 0;
        }
        .h2m-modal textarea.h2m-markdown-area { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; border-right: 1px solid #DCDCDC; resize: none; color: #333; background-color: #FAFAFA; }
        .h2m-modal textarea.h2m-markdown-area:focus { outline: none; box-shadow: none; }
        .h2m-modal .h2m-preview { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; background-color: #FFFFFF !important; color: #1C1B1F !important; }
        .h2m-modal .h2m-preview * { color: inherit !important; background-color: transparent !important; font-family: inherit !important; font-size: inherit !important; line-height: inherit !important; margin: 0; padding: 0; border: 0; }
        .h2m-modal .h2m-preview p { margin-bottom: 1em; }
        .h2m-modal .h2m-preview h1, .h2m-modal .h2m-preview h2, .h2m-modal .h2m-preview h3, .h2m-modal .h2m-preview h4, .h2m-modal .h2m-preview h5, .h2m-modal .h2m-preview h6 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; line-height: 1.2; }
        .h2m-modal .h2m-preview h1 { font-size: 2em; } .h2m-modal .h2m-preview h2 { font-size: 1.75em; } .h2m-modal .h2m-preview h3 { font-size: 1.5em; } .h2m-modal .h2m-preview h4 { font-size: 1.25em; } .h2m-modal .h2m-preview h5 { font-size: 1.125em; } .h2m-modal .h2m-preview h6 { font-size: 1em; }
        .h2m-modal .h2m-preview a, .h2m-modal .h2m-preview a:visited { color: #0B57D0 !important; text-decoration: none !important; }
        .h2m-modal .h2m-preview a:hover, .h2m-modal .h2m-preview a:focus { text-decoration: underline !important; }
        .h2m-modal .h2m-preview ul, .h2m-modal .h2m-preview ol { margin-bottom: 1em; padding-left: 2em; }
        .h2m-modal .h2m-preview li { margin-bottom: 0.25em; }
        .h2m-modal .h2m-preview ul li::marker, .h2m-modal .h2m-preview ol li::marker { color: #1C1B1F; }
        .h2m-modal .h2m-preview blockquote { border-left: 4px solid #CAC4D0; padding: 0.5em 1em; margin: 1em 0; color: #49454F !important; background-color: #F5F3F7 !important; }
        .h2m-modal .h2m-preview blockquote p { margin-bottom: 0.5em; } .h2m-modal .h2m-preview blockquote p:last-child { margin-bottom: 0; }
        .h2m-modal .h2m-preview code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; background-color: #E8DEF8 !important; color: #1D192B !important; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; }
        .h2m-modal .h2m-preview pre { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; background-color: #202124 !important; color: #E8EAED !important; padding: 1em; margin: 1em 0; border-radius: 8px; overflow-x: auto; font-size: 0.9em; line-height: 1.45; }
        .h2m-modal .h2m-preview pre code { background-color: transparent !important; color: inherit !important; padding: 0; border-radius: 0; font-size: inherit; }
        .h2m-modal .h2m-preview table { width: auto; max-width: 100%; border-collapse: collapse; margin: 1em 0; border: 1px solid #CAC4D0; }
        .h2m-modal .h2m-preview th, .h2m-modal .h2m-preview td { border: 1px solid #CAC4D0; padding: 0.5em 0.75em; text-align: left; }
        .h2m-modal .h2m-preview th { background-color: #F5F3F7 !important; font-weight: 600; }
        .h2m-modal .h2m-preview hr { border: none; border-top: 1px solid #CAC4D0; margin: 2em 0; }
        .h2m-modal .h2m-preview img { max-width: 100%; height: auto; border-radius: 8px; margin: 1em 0; display: block; }

        .h2m-modal-footer button,
        .h2m-modal-footer button.h2m-copy,
        .h2m-modal-footer button.h2m-download {
            position: static !important;
            display: inline-flex !important;
            background-color: #0B57D0 !important; color: #FFFFFF !important; border: none;
            border-radius: 20px; padding: 0 24px; font-size: 14px; font-weight: 500;
            line-height: 1; text-align: center; text-decoration: none;
            align-items: center; justify-content: center;
            height: 40px; min-width: 80px; box-sizing: border-box; cursor: pointer;
            box-shadow: 0 1px 2px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1);
            transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
            margin: 0;
        }
        .h2m-modal-footer button:hover,
        .h2m-modal-footer button.h2m-copy:hover,
        .h2m-modal-footer button.h2m-download:hover {
            background-color: #0A50BF !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1);
        }

        .h2m-modal .h2m-close { position: absolute; top: 12px; right: 12px; width: 40px; height: 40px; background-color: transparent !important; border-radius: 50%; border: none; display: flex; justify-content: center; align-items: center; cursor: pointer; padding: 0; box-shadow: none !important; z-index: 20; transition: opacity 0.2s ease-in-out; }
        .h2m-modal .h2m-close svg { width: 24px; height: 24px; display: block; }
        .h2m-modal .h2m-close svg path { fill: #B3261E !important; transition: fill 0.2s ease-in-out; }
        .h2m-modal .h2m-close:hover svg path { fill: #9E221A !important; }
        .h2m-modal .h2m-close:hover { opacity: 0.85; }

        #h2m-tip-instance {
            position: fixed;
            /* 挪到右下角，避开 B 站弹幕栏、掘金回到顶部按钮等常见的右上角浮动 UI */
            top: auto;
            right: 20px;
            bottom: 20px;
            background-color: rgba(32,33,36,0.95);
            color: #FFFFFF;
            border: 1px solid rgba(255,255,255,0.25);
            padding: 10px 15px;
            z-index: 10000000;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            max-width: 300px;
            font-family: sans-serif;
            font-size: 14px;
            backdrop-filter: saturate(120%) blur(2px);
        }
        #h2m-tip-instance h1, #h2m-tip-instance h2, #h2m-tip-instance h3 { margin-top: 0.5em; margin-bottom: 0.2em; font-weight: 600; }
        #h2m-tip-instance ul { margin-left: 20px; padding-left: 0; }
        #h2m-tip-instance li { margin-bottom: 0.3em; }

        /* 手机竖屏：编辑区与预览区改为上下布局，避免两列各挤一半宽度 */
        @media (max-width: 700px) {
            .h2m-modal { width: 96%; height: 92%; }
            .h2m-modal-body { flex-direction: column; }
            .h2m-modal textarea.h2m-markdown-area,
            .h2m-modal .h2m-preview { height: auto; min-height: 0; }
            .h2m-modal textarea.h2m-markdown-area {
                border-right: none;
                border-bottom: 1px solid #DCDCDC;
            }
            .h2m-modal-footer { padding: 10px 16px; }
            .h2m-modal-footer button { min-width: 64px; padding: 0 16px; height: 36px; }
            #h2m-tip-instance { left: 10px; right: 10px; max-width: none; }
        }
    `);

    console.log('[HTML Content to Markdown] Script loaded. Version 0.2.2. Shortcut:', shortCutConfig, "Filters:", filterConfig);
    // 依赖未加载时仅 console 告警，不再每页 alert 打扰；处理失败时 processSelection 会走 processError 提示
    if (!TurndownPluginGfmService || typeof TurndownPluginGfmService.gfm !== 'function') {
        console.error("[HTML to MD]", I18N[lang].gfmError);
    }
    if (typeof marked === 'undefined' || typeof marked.parse !== 'function') {
        console.error("[HTML to MD]", I18N[lang].markedError);
    }

})();
