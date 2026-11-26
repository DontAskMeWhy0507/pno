import React from "react";

import { Box, useColorModeValue } from "@chakra-ui/react";

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "ins",
  "small",
  "sub",
  "sup",
  "mark",
  "kbd",
  "code",
  "pre",
  "blockquote",
  "figure",
  "figcaption",
  "img",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "div",
  "span",
  "section",
  "article",
  "aside",
  "header",
  "footer",
  "main",
  "nav",
  "details",
  "summary",
]);

const DROP_SUBTREE_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "textarea",
  "button",
  "noscript",
]);

const ALLOWED_ATTRS = new Set([
  "id",
  "class",
  "href",
  "target",
  "rel",
  "src",
  "alt",
  "title",
  "width",
  "height",
  "loading",
  "colspan",
  "rowspan",
  "start",
]);

function sanitizeWithDOMParser(rawHtml: string): DocumentFragment {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");
  const frag = document.createDocumentFragment();

  const walk = (src: Node, dest: Node) => {
    for (const child of Array.from(src.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        dest.appendChild(document.createTextNode(child.textContent ?? ""));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const tag = el.tagName.toLowerCase();
        if (DROP_SUBTREE_TAGS.has(tag)) {
          continue;
        }
        if (!ALLOWED_TAGS.has(tag)) {
          // Unwrap unknown containers instead of dropping nested lesson content
          walk(el, dest);
          continue;
        }
        const clean = document.createElement(tag);
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          if (!ALLOWED_ATTRS.has(name)) continue;
          if (
            name === "href" &&
            attr.value.trim().toLowerCase().startsWith("javascript:")
          ) {
            continue;
          }
          if (
            name === "src" &&
            !attr.value.trim().startsWith("data:image/") &&
            !attr.value.trim().startsWith("http://") &&
            !attr.value.trim().startsWith("https://")
          ) {
            continue;
          }
          clean.setAttribute(attr.name, attr.value);
        }
        walk(el, clean);
        dest.appendChild(clean);
      }
    }
  };

  walk(doc.body, frag);
  return frag;
}

interface SanitizedHtmlProps {
  html: string;
  enableCopyButtons?: boolean;
  onAnchorClick?: (id: string) => void;
}

export const SanitizedHtml: React.FC<SanitizedHtmlProps> = ({
  html,
  enableCopyButtons = true,
  onAnchorClick,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const headingColor = useColorModeValue("gray.900", "white");
  const textColor = useColorModeValue("gray.700", "gray.200");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const codeBg = useColorModeValue("gray.50", "gray.900");
  const inlineCodeBg = useColorModeValue("blue.50", "rgba(75, 131, 255, 0.16)");
  const inlineCodeColor = useColorModeValue("blue.700", "blue.200");
  const thBg = useColorModeValue("gray.100", "gray.800");
  const zebraBg = useColorModeValue("gray.50", "rgba(255,255,255,0.03)");
  const linkColor = useColorModeValue("blue.600", "blue.300");

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const elWithSetHtml = el as HTMLElement & {
      setHTML?: (input: string, opts?: unknown) => void;
    };

    if (typeof elWithSetHtml.setHTML === "function") {
      try {
        elWithSetHtml.setHTML(html, {
          sanitizer: {
            elements: Array.from(ALLOWED_TAGS),
            attributes: Array.from(ALLOWED_ATTRS),
          },
        });
      } catch {
        el.replaceChildren(sanitizeWithDOMParser(html));
      }
    } else {
      el.replaceChildren(sanitizeWithDOMParser(html));
    }

    // Enhance scrollable <pre> blocks for keyboard accessibility + Copy action
    if (enableCopyButtons) {
      const pres = el.querySelectorAll("pre");
      pres.forEach((pre) => {
        if (!pre.hasAttribute("tabindex")) pre.setAttribute("tabindex", "0");
        if (!pre.hasAttribute("role")) pre.setAttribute("role", "region");
        if (!pre.hasAttribute("aria-label")) {
          pre.setAttribute("aria-label", "Code block");
        }
        const text = pre.textContent ?? "";
        if (text.trim().length < 6) return;

        const wrapper = document.createElement("div");
        wrapper.className = "pno-code-wrap";
        pre.parentNode?.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pno-copy-btn";
        btn.textContent = "Copy";
        btn.addEventListener("click", () => {
          void navigator.clipboard?.writeText(text).then(() => {
            btn.textContent = "Copied ✓";
            window.setTimeout(() => {
              btn.textContent = "Copy";
            }, 1500);
          });
        });
        wrapper.appendChild(btn);
      });
    }

    // Intercept internal #anchor links so they smoothly scroll inside view
    const handleLinkClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (href && href.startsWith("#")) {
        e.preventDefault();
        const targetId = href.slice(1);
        if (onAnchorClick) {
          onAnchorClick(targetId);
        } else {
          const dest = el.querySelector(`[id="${CSS.escape(targetId)}"]`);
          dest?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };

    el.addEventListener("click", handleLinkClick);
    return () => {
      el.removeEventListener("click", handleLinkClick);
    };
  }, [html, enableCopyButtons, onAnchorClick]);

  return (
    <Box
      ref={containerRef}
      color={textColor}
      fontSize="15px"
      lineHeight="1.75"
      sx={{
        "h1, h2, h3, h4": {
          color: headingColor,
          fontWeight: 700,
          lineHeight: 1.3,
          mt: 6,
          mb: 3,
          scrollMarginTop: "90px",
        },
        h1: { fontSize: "1.5rem" },
        h2: {
          fontSize: "1.25rem",
          pb: 1.5,
          borderBottomWidth: "1px",
          borderColor,
        },
        h3: { fontSize: "1.08rem" },
        "p, ul, ol": { mb: 3.5 },
        "ul, ol": { pl: 6 },
        ul: { listStyleType: "disc" },
        ol: { listStyleType: "decimal" },
        li: { mb: 1.5 },
        a: {
          color: linkColor,
          fontWeight: 600,
          textDecoration: "underline",
          textUnderlineOffset: "2px",
        },
        hr: {
          my: 6,
          borderColor,
        },
        blockquote: {
          borderLeftWidth: "4px",
          borderColor: "blue.400",
          pl: 4,
          py: 1,
          my: 4,
          bg: zebraBg,
          roundedRight: "lg",
        },
        code: {
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
          fontSize: "0.86em",
          bg: inlineCodeBg,
          color: inlineCodeColor,
          px: 1.5,
          py: 0.5,
          rounded: "md",
          fontWeight: 600,
        },
        ".pno-code-wrap": {
          position: "relative",
          my: 4,
        },
        ".pno-copy-btn": {
          position: "absolute",
          top: "8px",
          right: "8px",
          fontSize: "11px",
          fontWeight: 700,
          px: "8px",
          py: "3px",
          rounded: "md",
          borderWidth: "1px",
          borderColor,
          bg: thBg,
          color: headingColor,
          cursor: "pointer",
          opacity: 0.85,
          transition: "opacity 0.15s ease",
        },
        ".pno-copy-btn:hover": {
          opacity: 1,
        },
        pre: {
          bg: codeBg,
          borderWidth: "1px",
          borderColor,
          rounded: "xl",
          p: 4,
          pr: 14,
          overflowX: "auto",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
          fontSize: "13px",
          lineHeight: 1.6,
          my: 3,
          whiteSpace: "pre",
          color: headingColor,
        },
        "pre code": {
          bg: "transparent",
          color: "inherit",
          p: 0,
          fontWeight: 400,
          fontSize: "inherit",
        },
        table: {
          w: "full",
          borderCollapse: "collapse",
          my: 4,
          fontSize: "sm",
          display: "block",
          overflowX: "auto",
        },
        "th, td": {
          borderWidth: "1px",
          borderColor,
          px: 3,
          py: 2,
          textAlign: "left",
        },
        th: {
          bg: thBg,
          color: headingColor,
          fontWeight: 700,
        },
        "tr:nth-of-type(even) td": {
          bg: zebraBg,
        },
        img: {
          maxW: "full",
          h: "auto",
          rounded: "xl",
          my: 4,
          mx: "auto",
          display: "block",
          bg: "white",
          p: 2,
          borderWidth: "1px",
          borderColor,
          shadow: "sm",
        },
      }}
    />
  );
};
