import { useState, useRef, type FC } from 'react';
import { Trash2 } from 'lucide-react';
import { MediaEmbed } from './MediaEmbed';

interface PassageViewerProps {
  title: string;
  subtitle?: string;
  passage: string;
  footnotes?: string;
  imageUrl?: string;
  videoUrl?: string;
  fontSize: 'sm' | 'base' | 'lg';
}

interface FloatingMenuPosition {
  top: number;
  left: number;
  visible: boolean;
}

function renderMarkdownText(text: string) {
  if (!text) return null;
  let cleaned = text;
  if ((cleaned.match(/\*\*/g) || []).length % 2 !== 0) {
    cleaned = cleaned.replace(/\*\*+$/, '');
  }
  const parts = cleaned.split(/(\*\*.*?\*\*|\*[^*]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-black">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={idx} className="italic text-gray-900">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

export const PassageViewer: FC<PassageViewerProps> = ({
  title,
  subtitle,
  passage,
  footnotes,
  imageUrl,
  videoUrl,
  fontSize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [floatingMenu, setFloatingMenu] = useState<FloatingMenuPosition>({
    top: 0,
    left: 0,
    visible: false,
  });

  // Handle text selection for highlighting
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setFloatingMenu((prev) => ({ ...prev, visible: false }));
      return;
    }

    // Check if selection is within this passage container
    if (containerRef.current && containerRef.current.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      setFloatingMenu({
        top: rect.top - containerRect.top + containerRef.current.scrollTop - 42,
        left: Math.max(10, rect.left - containerRect.left + rect.width / 2 - 80),
        visible: true,
      });
    } else {
      setFloatingMenu((prev) => ({ ...prev, visible: false }));
    }
  };

  const applyHighlight = (colorClass: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    // Only highlight inside a single text/inline container to prevent breaking React paragraph nodes
    if (
      !containerRef.current ||
      !containerRef.current.contains(range.commonAncestorContainer)
    ) {
      return;
    }

    try {
      const span = document.createElement('mark');
      span.className = `${colorClass} cursor-pointer rounded-xs px-0.5`;
      range.surroundContents(span);
    } catch {
      // Cross-element selection fallback: wrap safely without removing block elements
      const selectedContent = range.extractContents();
      const span = document.createElement('mark');
      span.className = `${colorClass} cursor-pointer rounded-xs px-0.5`;
      span.appendChild(selectedContent);
      range.insertNode(span);
    }

    selection.removeAllRanges();
    setFloatingMenu((prev) => ({ ...prev, visible: false }));
  };

  const removeHighlight = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const anchor = selection.anchorNode;
    const markEl =
      anchor instanceof HTMLElement
        ? anchor.closest('mark')
        : anchor?.parentElement?.closest('mark');
    if (markEl && markEl.parentNode) {
      const text = document.createTextNode(markEl.textContent || '');
      markEl.parentNode.replaceChild(text, markEl);
      text.parentNode?.normalize();
    }
    selection.removeAllRanges();
    setFloatingMenu((prev) => ({ ...prev, visible: false }));
  };

  const fontClass = {
    sm: 'text-[15px] leading-[1.65]',
    base: 'text-[16px] leading-[1.65]',
    lg: 'text-[18px] leading-[1.75]',
  }[fontSize];

  const titleClass = {
    sm: 'text-xl',
    base: 'text-2xl',
    lg: 'text-[28px]',
  }[fontSize];

  const subtitleClass = {
    sm: 'text-[14px]',
    base: 'text-[15px]',
    lg: 'text-[17px]',
  }[fontSize];

  const footnoteClass = {
    sm: 'text-[13px]',
    base: 'text-[14px]',
    lg: 'text-[15px]',
  }[fontSize];

  // Split paragraphs
  const paragraphs = passage.split('\n\n').filter((p) => p.trim().length > 0);

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="relative h-full overflow-y-auto px-6 md:px-8 py-6 bg-white text-gray-900 select-text font-sans"
    >
      {/* Floating Highlight Toolbar */}
      {floatingMenu.visible && (
        <div
          style={{ top: `${floatingMenu.top}px`, left: `${floatingMenu.left}px` }}
          className="absolute z-30 flex items-center gap-2 bg-gray-900 text-white px-3 py-1.5 rounded-xl border border-gray-700 shadow-xl text-xs"
          onMouseDown={(e) => e.preventDefault()} // Keep selection
        >
          <button
            onClick={() => applyHighlight('highlight-yellow')}
            className="w-5 h-5 rounded-full bg-yellow-300 hover:scale-110 transition shadow-xs border border-yellow-400"
            title="Yellow highlight"
          />
          <button
            onClick={() => applyHighlight('highlight-green')}
            className="w-5 h-5 rounded-full bg-green-300 hover:scale-110 transition shadow-xs border border-green-400"
            title="Green highlight"
          />
          <button
            onClick={() => applyHighlight('highlight-pink')}
            className="w-5 h-5 rounded-full bg-pink-300 hover:scale-110 transition shadow-xs border border-pink-400"
            title="Pink highlight"
          />
          <button
            onClick={() => applyHighlight('highlight-blue')}
            className="w-5 h-5 rounded-full bg-sky-300 hover:scale-110 transition shadow-xs border border-sky-400"
            title="Blue highlight"
          />
          <button
            onClick={removeHighlight}
            className="p-1 text-gray-300 hover:text-red-400 transition"
            title="Remove highlight"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header section of Passage */}
      <div className="mb-6 md:mb-8 pb-4 border-b-2 border-gray-100 text-center w-full">
        <h2 className={`font-extrabold text-gray-900 tracking-tight mb-2 ${titleClass}`}>
          {renderMarkdownText(title)}
        </h2>
        {subtitle && (
          <p className={`italic text-gray-600 leading-relaxed max-w-4xl mx-auto ${subtitleClass}`}>
            {renderMarkdownText(subtitle)}
          </p>
        )}
      </div>

      {/* Main Passage Media (Image / Video) */}
      {(imageUrl || videoUrl) && (
        <MediaEmbed imageUrl={imageUrl} videoUrl={videoUrl} alt={title} className="mb-6" />
      )}

      {/* Main Passage Content */}
      <div className={`space-y-4 md:space-y-5 text-justify font-sans text-gray-900 w-full ${fontClass}`}>
        {paragraphs.map((p, idx) => (
          <p key={idx} className="indent-0">
            {renderMarkdownText(p)}
          </p>
        ))}
      </div>

      {/* Footnotes */}
      {footnotes && (
        <div className={`mt-8 pt-4 border-t border-gray-300 italic text-gray-700 w-full ${footnoteClass}`}>
          {renderMarkdownText(footnotes)}
        </div>
      )}
    </div>
  );
};
