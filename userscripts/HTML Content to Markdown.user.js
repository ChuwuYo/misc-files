// ==UserScript==
// @name         HTML Content to Markdown
// @name:zh      网页内容转Markdown
// @namespace    https://github.com/ChuwuYo
// @version      0.1.0
// @description  Convert selected HTML Content to Markdown with filtering
// @description:zh 将选定的HTML内容转换为Markdown（带过滤规则）
// @author       ChuwuYo
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://unpkg.com/turndown/dist/turndown.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.0/marked.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require      https://unpkg.com/@guyplusplus/turndown-plugin-gfm/dist/turndown-plugin-gfm.js
// @license      AGPL-3.0
// ==/UserScript==

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
            'tabindex',
            // Keep 'aria-*' and 'data-*' for now, can be added back if causing issues
            // 'aria-\\w+', 'data-\\w+'
        ],
        keepAttributesOnTags: {
            'img': ['src', 'alt', 'title'], // Ensure src, alt, title are kept for images
            'a': ['href', 'title']         // Ensure href, title are kept for anchors
        },
        removeElementsWithClasses: [],
        removeElementsWithIds: [],
    };

    // --- User-Provided Config (can be empty) ---
    const shortCutUserConfig = { /* Example: "Key": "s" */ };
    const filterUserConfig = { /* Example: removeTags: ['script', 'style', 'header'] */ };

    // --- Global Variables ---
    let isSelecting = false;
    let selectedElement = null;
    let shortCutConfig;
    let filterConfig;

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
        filterConfig = loadConfig('filterConfig', DEFAULT_FILTER_CONFIG, filterUserConfig);
    } catch (e) {
        console.error("[HTML to MD] Critical error loading configuration:", e);
        shortCutConfig = { ...DEFAULT_SHORTCUT_CONFIG }; // Fallback to defaults
        filterConfig = { ...DEFAULT_FILTER_CONFIG };   // Fallback to defaults
        alert("Error loading script configuration. Using default settings. Please check console for details.");
    }

    // --- Turndown Service Setup ---
    const turndownService = new TurndownService({
        codeBlockStyle: 'fenced', headingStyle: 'atx', hr: '---',
        bulletListMarker: '-', emDelimiter: '*', strongDelimiter: '**',
    });
    TurndownPluginGfmService.gfm(turndownService); // Apply GFM plugin (handles tables, strikethrough, task lists, and better link/image handling)

    if (filterConfig && filterConfig.removeTags && Array.isArray(filterConfig.removeTags)) {
        turndownService.remove(filterConfig.removeTags);
    }
    turndownService.remove((node) => node.nodeType === Node.COMMENT_NODE); // Remove comment nodes

    // Removed custom 'cleanAnchors' rule. GFM plugin's anchor handling is generally preferred.
    // Specific cleanup will be done in post-processing regex.

    // --- Core Functions ---
    function convertToMarkdown(element) {
        if (!element) return '';
        const clonedElement = element.cloneNode(true);

        if (filterConfig) {
            clonedElement.querySelectorAll('*').forEach(el => {
                const tagName = el.tagName.toLowerCase();
                const attributesToKeep = (filterConfig.keepAttributesOnTags && filterConfig.keepAttributesOnTags[tagName]) || [];

                if (filterConfig.removeAttributes && Array.isArray(filterConfig.removeAttributes)) {
                    Array.from(el.attributes).forEach(attr => {
                        if (attributesToKeep.includes(attr.name.toLowerCase())) { // Ensure case-insensitivity for attr name check
                            return;
                        }
                        let shouldRemove = false;
                        for (const pattern of filterConfig.removeAttributes) {
                            if (pattern.includes('\\w+')) {
                                const prefix = pattern.replace('\\w+', '');
                                if (attr.name.startsWith(prefix)) {
                                    shouldRemove = true;
                                    break;
                                }
                            } else if (attr.name === pattern) {
                                shouldRemove = true;
                                break;
                            }
                        }
                        if (shouldRemove) {
                            el.removeAttribute(attr.name);
                        }
                    });
                }
            });

            if (filterConfig.removeElementsWithClasses && Array.isArray(filterConfig.removeElementsWithClasses)) {
                filterConfig.removeElementsWithClasses.forEach(className => {
                    clonedElement.querySelectorAll('.' + className.replace(/\./g, '\\.')).forEach(elToRemove => elToRemove.remove());
                });
            }
            if (filterConfig.removeElementsWithIds && Array.isArray(filterConfig.removeElementsWithIds)) {
                filterConfig.removeElementsWithIds.forEach(idName => {
                    const elToRemove = clonedElement.querySelector('#' + idName.replace(/#/g, '\\#'));
                    if (elToRemove) elToRemove.remove();
                });
            }
        }

        const html = clonedElement.outerHTML;
        let turndownMd = turndownService.turndown(html);

        // Post-processing Markdown cleanup
        turndownMd = turndownMd.replace(/\[\s*]\(\s*\)/g, ''); // Remove completely empty links: []() or [ ]( )
        turndownMd = turndownMd.replace(/\[\s*]\((#|javascript:[^)]*)\)/g, ''); // Remove empty links with junk hrefs: [](#) or [](javascript:...)
        turndownMd = turndownMd.replace(/\[([^\]]+)]\(\s*\)/g, '$1'); // Remove links with text but no href: [text]() -> text
        turndownMd = turndownMd.replace(/\n{3,}/g, '\n\n'); // Consolidate multiple blank lines

        return turndownMd.trim();
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
                        <button class="h2m-copy">Copy to clipboard</button>
                        <button class="h2m-download">Download as MD</button>
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

        $markdownArea.val(markdown); // Set initial value
        $previewArea.html(marked.parse(markdown));

        $markdownArea.on('input', function () { $previewArea.html(marked.parse($(this).val())); });
        const closeModal = () => { $modal.remove(); $(document).off('keydown.h2mModalGlobal'); };
        $modal.on('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
        $(document).on('keydown.h2mModalGlobal', function (e) { if (e.key === 'Escape' && $('.h2m-modal-overlay').length > 0) closeModal(); });
        $copyButton.on('click', function () { GM_setClipboard($markdownArea.val()); $(this).text('Copied!'); setTimeout(() => $(this).text('Copy to clipboard'), 1000); });
        $downloadButton.on('click', function () {
            const md = $markdownArea.val(); const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob); const a = document.createElement('a');
            a.href = url; const safeTitle = (document.title.replace(/[\\/:*?"<>|]/g, '_') || 'untitled');
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

    function startSelecting() { if (isSelecting) return; $('body').addClass('h2m-no-scroll'); isSelecting = true; selectedElement = document.body.firstElementChild || document.body; $(selectedElement).addClass('h2m-selection-box'); tip('Selecting element... Use Arrows to navigate, Mouse Wheel to expand/collapse, Click to confirm, Esc to cancel.'); }
    function endSelecting() { if (!isSelecting) return; isSelecting = false; $('.h2m-selection-box').removeClass('h2m-selection-box'); $('body').removeClass('h2m-no-scroll'); $('.h2m-tip').remove(); selectedElement = null; }
    function tip(message, timeout = null) { $('.h2m-tip').remove(); const $t = $('<div>').addClass('h2m-tip').html(message).appendTo('body').hide().fadeIn(200); if (timeout !== null) { setTimeout(() => { $t.fadeOut(200, () => $t.remove()); }, timeout); } }
    function handleKeyboardNavigation(e) {
        if (!isSelecting || !selectedElement) return; e.preventDefault(); let newEl = selectedElement;
        switch (e.key) {
            case 'Escape': endSelecting(); return;
            case 'ArrowUp': newEl = selectedElement.parentElement || selectedElement; if (['HTML', 'BODY'].includes(newEl.tagName)) newEl = newEl.firstElementChild || newEl; break;
            case 'ArrowDown': newEl = selectedElement.firstElementChild || selectedElement; break;
            case 'ArrowLeft': { let p = selectedElement.previousElementSibling; if (p) { newEl = p; while (newEl.lastElementChild) newEl = newEl.lastElementChild; } else if (selectedElement.parentElement && !['BODY', 'HTML'].includes(selectedElement.parentElement.tagName)) newEl = selectedElement.parentElement; break; }
            case 'ArrowRight': { let n = selectedElement.nextElementSibling; if (n) { newEl = n; while (newEl.firstElementChild) newEl = newEl.firstElementChild; } else if (selectedElement.parentElement && !['BODY', 'HTML'].includes(selectedElement.parentElement.tagName)) newEl = selectedElement.parentElement; break; }
            default: return;
        }
        if (newEl && newEl !== selectedElement) { $(selectedElement).removeClass('h2m-selection-box'); selectedElement = newEl; $(selectedElement).addClass('h2m-selection-box'); }
    }
    function handleMouseWheelNavigation(e) {
        if (!isSelecting || !selectedElement) return; e.preventDefault(); let newEl = selectedElement;
        if (e.originalEvent.deltaY < 0) { newEl = selectedElement.parentElement || selectedElement; if (['HTML', 'BODY'].includes(newEl.tagName)) newEl = newEl.firstElementChild || newEl; }
        else { newEl = selectedElement.firstElementChild || selectedElement; }
        if (newEl && newEl !== selectedElement) { $(selectedElement).removeClass('h2m-selection-box'); selectedElement = newEl; $(selectedElement).addClass('h2m-selection-box'); }
    }
    $(document).on('keydown.h2m', function (e) { if (shortCutConfig && e.ctrlKey === shortCutConfig.Ctrl && e.altKey === shortCutConfig.Alt && e.shiftKey === shortCutConfig.Shift && e.key.toUpperCase() === shortCutConfig.Key.toUpperCase()) { e.preventDefault(); if (isSelecting) endSelecting(); else startSelecting(); return; } if (isSelecting) handleKeyboardNavigation(e); });
    $(document).on('mouseover.h2m', function (e) { if (isSelecting && selectedElement !== e.target && !$(e.target).closest('.h2m-tip, .h2m-modal-overlay').length) { $(selectedElement).removeClass('h2m-selection-box'); selectedElement = e.target; $(selectedElement).addClass('h2m-selection-box'); } }).on('wheel.h2m', function (e) { if (isSelecting) handleMouseWheelNavigation(e); }).on('mousedown.h2m', function (e) { if (isSelecting && selectedElement && $(e.target).closest('.h2m-tip, .h2m-modal-overlay').length === 0) { e.preventDefault(); e.stopPropagation(); try { const markdown = convertToMarkdown(selectedElement); showMarkdownModal(markdown); } catch (err) { console.error("[HTML to MD] Error during conversion or showing modal:", err); alert("Error processing selection. Check console for details."); } endSelecting(); } });
    GM_registerMenuCommand('开始选择 / Start Selection', startSelecting);
    GM_registerMenuCommand('配置过滤规则 / Configure Filters', () => {
        const currentFilters = JSON.stringify(filterConfig || DEFAULT_FILTER_CONFIG, null, 2);
        const newFiltersStr = prompt("编辑过滤规则 (JSON):\n(removeTags, removeAttributes, keepAttributesOnTags, removeElementsWithClasses, removeElementsWithIds)", currentFilters);
        if (newFiltersStr) { try { const newFilters = JSON.parse(newFiltersStr); filterConfig = { ...DEFAULT_FILTER_CONFIG, ...newFilters }; GM_setValue('filterConfig', JSON.stringify(filterConfig)); alert("过滤规则已更新！"); } catch (err) { alert("无效的JSON格式！规则未更新。\n" + err); } }
    });

    // --- CSS Styles ---
    GM_addStyle(`
        .h2m-selection-box { outline: 2px dashed #0B57D0 !important; background-color: rgba(11, 87, 208, 0.1) !important; box-shadow: 0 0 0 9999px rgba(0,0,0,0.05); position: relative; z-index: 9999998; }
        .h2m-no-scroll { overflow: hidden !important; }
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
            position: relative; /* Added for stacking context, though not strictly necessary for this fix */
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
        .h2m-modal-footer button.h2m-copy, /* Increased specificity */
        .h2m-modal-footer button.h2m-download { /* Increased specificity */
            position: static !important; /* CRITICAL FIX for button positioning */
            display: inline-flex !important; /* Ensure it behaves as a flex item */
            background-color: #0B57D0 !important; color: #FFFFFF !important; border: none;
            border-radius: 20px; padding: 0 24px; font-size: 14px; font-weight: 500;
            line-height: 1; text-align: center; text-decoration: none;
            align-items: center; justify-content: center;
            height: 40px; min-width: 80px; box-sizing: border-box; cursor: pointer;
            box-shadow: 0 1px 2px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1);
            transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
            margin: 0; /* Reset any conflicting margins */
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
        .h2m-tip { position: fixed; top: 20px; right: 20px; background-color: rgba(255,255,255,0.95); border: 1px solid #DCDCDC; padding: 10px 15px; z-index: 10000000; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); max-width: 300px; font-family: sans-serif; font-size: 14px; }
        .h2m-tip h1, .h2m-tip h2, .h2m-tip h3 { margin-top: 0.5em; margin-bottom: 0.2em; font-weight: 600; } .h2m-tip ul { margin-left: 20px; padding-left: 0; } .h2m-tip li { margin-bottom: 0.3em; }
    `);

    console.log('[HTML Content to Markdown] Script loaded. Version 0.1.1. Shortcut:', shortCutConfig, "Filters:", filterConfig);
    if (!TurndownPluginGfmService || typeof TurndownPluginGfmService.gfm !== 'function') {
        console.error("[HTML to MD] Turndown GFM plugin not loaded correctly!");
        alert("[HTML to MD] Error: GFM plugin failed to load. Some Markdown features might not work correctly.");
    }
    if (typeof marked === 'undefined' || typeof marked.parse !== 'function') {
        console.error("[HTML to MD] Marked library not loaded correctly!");
        alert("[HTML to MD] Error: Markdown preview library (Marked) failed to load.");
    }


})();
