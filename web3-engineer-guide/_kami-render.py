#!/usr/bin/env python3
"""Render a module README.md to a Kami long-doc PDF.

Usage: python3 _kami-render.py <module-dir>
Example: python3 _kami-render.py 14-去中心化存储

Pipeline:
  1. Read <module-dir>/README.md
  2. Extract Mermaid blocks → render to SVG via mmdc
  3. Convert markdown → HTML (with code highlighting)
  4. Detect ## chapter headings → wrap as sections, generate TOC
  5. Build cover page from frontmatter / first H1
  6. Combine head + style + body, write <module-dir>/_kami.html
  7. Run weasyprint → <module-dir>/<module-name>.pdf
"""
from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

import markdown


GUIDE_ROOT = Path(__file__).parent.resolve()
TEMPLATE = GUIDE_ROOT / "_kami-long-doc.html"


# ---------- Mermaid prerender ----------

def extract_and_render_mermaid(md_text: str, work_dir: Path) -> str:
    """Replace ```mermaid ... ``` blocks with <img src="…svg"> tags."""
    work_dir.mkdir(exist_ok=True)
    pattern = re.compile(r"```mermaid\s*\n(.*?)\n```", re.DOTALL)

    def repl(match):
        code = match.group(1)
        # Stable hash so re-runs don't re-render unchanged diagrams
        digest = hashlib.sha1(code.encode("utf-8")).hexdigest()[:10]
        mmd_file = work_dir / f"diagram-{digest}.mmd"
        png_file = work_dir / f"diagram-{digest}.png"
        if not png_file.exists():
            mmd_file.write_text(code, encoding="utf-8")
            # PNG output bypasses WeasyPrint's lack of <foreignObject> support.
            # scale=2 gives ~2x resolution for crisp print rendering.
            cmd = ["mmdc", "-i", str(mmd_file), "-o", str(png_file),
                   "-b", "transparent", "-s", "2"]
            cfg = work_dir / "mmdc-config.json"
            if cfg.exists():
                cmd.extend(["-c", str(cfg)])
            try:
                subprocess.run(cmd, check=True, capture_output=True, timeout=120)
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                stderr = (e.stderr or b"").decode("utf-8", errors="replace") if hasattr(e, "stderr") else ""
                escaped = code.replace("&", "&amp;").replace("<", "&lt;")
                return (
                    f'<figure><pre><code class="language-mermaid">{escaped}</code></pre>'
                    f'<figcaption>diagram render failed: {stderr[:200]}</figcaption></figure>'
                )

        return f'<figure><img src="{png_file.name}" alt="mermaid diagram"></figure>'

    return pattern.sub(repl, md_text)


# ---------- Markdown → HTML ----------

def md_to_html(md_text: str) -> str:
    md = markdown.Markdown(
        extensions=[
            "extra",            # tables, fenced code, footnotes, etc.
            "toc",
            "sane_lists",
            "pymdownx.superfences",
            "pymdownx.highlight",
            "pymdownx.tilde",
            "pymdownx.tasklist",
        ],
        extension_configs={
            "pymdownx.highlight": {
                "use_pygments": True,
                "noclasses": True,
                "pygments_style": "tango",
                "linenums": False,
            },
        },
    )
    return md.convert(md_text)


# ---------- Section wrapping & TOC ----------

def wrap_chapters(html: str) -> tuple[str, list[tuple[str, str, str]]]:
    """Wrap each top-level <h2> block in <section class="chapter">.

    Returns (wrapped_html, toc_entries) where each entry is (num, title, slug).
    """
    # Split body on <h2 ...>...</h2>; everything before first h2 is preamble
    parts = re.split(r"(<h2[^>]*>.*?</h2>)", html, flags=re.DOTALL)
    out = []
    toc = []
    current = []
    chapter_index = 0

    if parts:
        out.append(parts[0])  # preamble (anything before first h2)

    i = 1
    while i < len(parts):
        h2 = parts[i]
        body = parts[i + 1] if i + 1 < len(parts) else ""
        chapter_index += 1
        # Extract title text
        m = re.search(r"<h2[^>]*>(.*?)</h2>", h2, re.DOTALL)
        title_html = m.group(1) if m else f"第 {chapter_index} 章"
        title_text = re.sub(r"<[^>]+>", "", title_html).strip()
        # Slug for anchor
        slug = f"ch{chapter_index:02d}"
        # Add anchor id to h2 + chapter-num eyebrow
        new_h2 = re.sub(
            r"<h2([^>]*)>",
            f'<h2\\1 id="{slug}"><span class="chapter-num">Chapter {chapter_index:02d}</span><br>',
            h2,
            count=1,
        )
        out.append(f'<section class="chapter">\n{new_h2}\n{body}\n</section>')
        toc.append((f"{chapter_index:02d}", title_text, slug))
        i += 2

    return "".join(out), toc


def build_toc_html(toc: list[tuple[str, str, str]]) -> str:
    items = []
    for num, title, slug in toc:
        title_safe = (
            title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )
        items.append(
            f'  <div class="toc-item">\n'
            f'    <span class="toc-num">{num}</span>\n'
            f'    <span class="toc-title"><a href="#{slug}" style="color:inherit;text-decoration:none">{title_safe}</a></span>\n'
            f'    <span class="toc-page">·</span>\n'
            f'  </div>'
        )
    body = "\n".join(items)
    return f'<section class="toc">\n  <h2>目录</h2>\n{body}\n</section>'


# ---------- Cover page ----------

def build_cover_html(title: str, subtitle: str, eyebrow: str = "Web3 工程师学习指南") -> str:
    today = date.today().strftime("%Y.%m")
    return f'''<section class="cover">
  <div>
    <div class="cover-eyebrow">{eyebrow}</div>
    <div class="cover-title">{title}</div>
    <div class="cover-sub">{subtitle}</div>
  </div>
  <div class="cover-meta">
    <strong>Web3 Engineer Guide</strong><br>
    版本 V1.0  ·  {today}<br>
    供个人学习使用 · MIT License
  </div>
</section>'''


# ---------- Module name → title/subtitle ----------

MODULE_TITLES = {
    "00-导论与学习路径": ("导论与学习路径", "Web3 工程师从零到资深的全景图"),
    "01-密码学基础": ("密码学基础", "哈希、签名、Merkle、KZG、PQC、FHE"),
    "02-区块链原理与共识": ("区块链原理与共识", "19 种共识协议的工程视角"),
    "03-以太坊与EVM": ("以太坊与 EVM", "执行引擎、字节码、Pectra 与 Fusaka"),
    "04-Solidity开发": ("Solidity 开发", "类型系统、Storage、汇编、Foundry"),
    "05-智能合约安全": ("智能合约安全", "12 类漏洞、审计工具、真实事故复盘"),
    "06-DeFi协议工程": ("DeFi 协议工程", "AMM、借贷、稳定币、MEV、LST/LRT"),
    "07-L2与扩容": ("L2 与扩容", "Rollup、DA、桥、Stage 评级"),
    "08-零知识证明": ("零知识证明", "SNARK、STARK、zkVM、zkML"),
    "09-替代生态": ("替代生态", "Solana、Cosmos、Move、Bitcoin、20+ 链"),
    "10-前端与账户抽象": ("前端与账户抽象", "viem、wagmi、ERC-4337、EIP-7702"),
    "11-基础设施与工具": ("基础设施与工具", "节点运维、Validator、MEV-Boost、CI/CD"),
    "12-AI×Web3": ("AI × Web3", "Agent、zkML、AI Token、MCP、链上推理"),
    "13-NFT身份与社交": ("NFT、身份与社交", "ERC-721/1155/6551、ENS、EAS、Farcaster"),
    "14-去中心化存储": ("去中心化存储", "IPFS、Filecoin、Arweave、Walrus、0G"),
    "15-DAO治理与Tokenomics": ("DAO 治理与 Tokenomics", "Governor、ve-token、QF、RWA"),
}


# ---------- Main ----------

def render(module_dir: Path) -> Path:
    readme = module_dir / "README.md"
    if not readme.exists():
        raise SystemExit(f"README.md not found in {module_dir}")

    md_text = readme.read_text(encoding="utf-8")

    # Strip the very first line if it's a single H1 (we use cover instead)
    md_text = re.sub(r"\A#\s+.+\n", "", md_text, count=1)

    # Render mermaid → SVG, replace blocks
    work_dir = module_dir / "_kami-build"
    work_dir.mkdir(exist_ok=True)
    md_text = extract_and_render_mermaid(md_text, work_dir)

    # Markdown → HTML
    body_html = md_to_html(md_text)

    # Wrap chapters + build TOC
    wrapped_html, toc = wrap_chapters(body_html)
    toc_html = build_toc_html(toc) if toc else ""

    # Build cover from module name
    module_name = module_dir.name
    title, subtitle = MODULE_TITLES.get(module_name, (module_name, ""))
    cover_html = build_cover_html(title, subtitle)

    # Read template, extract head + style only
    template = TEMPLATE.read_text(encoding="utf-8")
    head_match = re.match(r"(.*?<body>)", template, re.DOTALL)
    if not head_match:
        raise SystemExit("Template missing <body>")
    head = head_match.group(1)

    # Substitute placeholders in head
    head = head.replace("{{文档标题}}", title)
    head = re.sub(r"\{\{[^{}]*\}\}", "", head)  # blank any leftover placeholder

    # Compose final HTML
    final_html = (
        head
        + "\n"
        + cover_html
        + "\n"
        + toc_html
        + "\n"
        + wrapped_html
        + "\n</body>\n</html>\n"
    )

    out_html = work_dir / "out.html"
    out_html.write_text(final_html, encoding="utf-8")

    # Run weasyprint
    pdf_path = module_dir / f"{module_name}.pdf"
    print(f"[{module_name}] weasyprint → {pdf_path.name}", flush=True)
    res = subprocess.run(
        ["weasyprint", str(out_html), str(pdf_path)],
        capture_output=True,
        text=True,
        timeout=600,
    )
    if res.returncode != 0:
        sys.stderr.write(res.stderr)
        raise SystemExit(f"weasyprint failed for {module_name}")

    # Print summary
    pages = "?"
    try:
        # Quick page count via pdfinfo if available
        info = subprocess.run(
            ["pdfinfo", str(pdf_path)], capture_output=True, text=True, timeout=10
        )
        if info.returncode == 0:
            for line in info.stdout.splitlines():
                if line.startswith("Pages:"):
                    pages = line.split(":", 1)[1].strip()
                    break
    except FileNotFoundError:
        pass

    size_mb = pdf_path.stat().st_size / 1024 / 1024
    print(f"[{module_name}] OK · {pages} pages · {size_mb:.1f} MB", flush=True)
    return pdf_path


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    module_dir = Path(sys.argv[1]).resolve()
    if not module_dir.is_dir():
        # Try relative to guide root
        candidate = GUIDE_ROOT / sys.argv[1]
        if candidate.is_dir():
            module_dir = candidate
        else:
            raise SystemExit(f"Module dir not found: {sys.argv[1]}")
    render(module_dir)


if __name__ == "__main__":
    main()
