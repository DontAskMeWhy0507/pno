import { useState, type FC } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  X,
  Target,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export interface AiCoachPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillType: 'writing' | 'speaking';
  taskTitle: string;
  taskPrompt: string;
  userContent: string;
  sampleContent?: string;
  wordCount?: number;
  partInfo?: string;
}

export const AiCoachPromptModal: FC<AiCoachPromptModalProps> = ({
  isOpen,
  onClose,
  skillType,
  taskTitle,
  taskPrompt,
  userContent,
  sampleContent,
  wordCount,
  partInfo,
}) => {
  // Target Band state
  const [targetBand, setTargetBand] = useState<'6.5' | '7.0' | '7.5' | '8.0' | '8.5+'>('7.5');
  const [currentLevel, setCurrentLevel] = useState<'5.5' | '6.0' | '6.5' | '7.0'>('6.0');

  // Focus priorities
  const [focusVocab, setFocusVocab] = useState(true);
  const [focusGrammar, setFocusGrammar] = useState(true);
  const [focusCoherence, setFocusCoherence] = useState(true);
  const [focusTaskDepth, setFocusTaskDepth] = useState(true);

  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Focus areas text
  const selectedFocusList: string[] = [];
  if (focusVocab) selectedFocusList.push('Nâng cấp Từ vựng học thuật C1-C2, Collocations tự nhiên và Idiomatic expressions');
  if (focusGrammar) selectedFocusList.push('Sửa lỗi ngữ pháp và Đa dạng hóa cấu trúc câu (Mệnh đề quan hệ, đảo ngữ, câu điều kiện, bị động nâng cao)');
  if (focusCoherence) {
    selectedFocusList.push(
      skillType === 'writing'
        ? 'Tăng tính Mạch lạc & Liên kết (Coherence & Cohesion), cách dùng liên từ mượt mà không gượng ép'
        : 'Tăng Độ trôi chảy (Fluency), giảm ngập ngừng, sử dụng các từ nối tự nhiên và phát âm có ngữ điệu (Intonation)'
    );
  }
  if (focusTaskDepth) {
    selectedFocusList.push(
      skillType === 'writing'
        ? 'Chiều sâu Luận điểm & Dẫn chứng thuyết phục (Task Response/Achievement)'
        : 'Phát triển ý tưởng mở rộng, giải thích nguyên nhân và đưa ví dụ cá nhân sinh động'
    );
  }

  // Construct Pedagogical Prompt
  const buildPrompt = (): string => {
    const isWriting = skillType === 'writing';

    return `Bạn là một Giám khảo IELTS chính thức (Examiner) và Huấn luyện viên luyện thi IELTS 8.5+ hàng đầu.
Tôi vừa hoàn thành bài luyện tập IELTS ${isWriting ? 'Writing' : 'Speaking'}. Tôi KHÔNG dùng API, đây là văn bản tôi dán trực tiếp để nhờ bạn chấm điểm và hướng dẫn nâng band.

=== HỒ SƠ MỤC TIÊU CÁ NHÂN HÓA CỦA TÔI ===
- Trình độ ước tính hiện tại của tôi: Band ${currentLevel}
- MỤC TIÊU TÔI MUỐN ĐẠT ĐƯỢC: BAND ${targetBand} IELTS ${isWriting ? 'Writing' : 'Speaking'}
- Các trọng tâm tôi muốn được cải thiện triệt để:
${selectedFocusList.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}

=== THÔNG TIN ĐỀ BÀI ===
Chủ đề: ${taskTitle} ${partInfo ? `(${partInfo})` : ''}
Đề bài:
"${taskPrompt}"

=== BÀI LÀM CỦA TÔI ${wordCount ? `(Số từ: ${wordCount} từ)` : ''} ===
"""
${userContent.trim() || '(Thí sinh chưa nhập nội dung, hãy nhắc tôi cung cấp bài làm)'}
"""
${
  sampleContent
    ? `
=== BÀI MẪU THAM KHẢO BAND 8.5+ ===
"""
${sampleContent}
"""`
    : ''
}

=========================================
=== NHIỆM VỤ CHI TIẾT CỦA BẠN (XIN HÃY THỰC HIỆN ĐẦY ĐỦ 5 BƯỚC) ===
1. ĐÁNH GIÁ VÀ CHẤM ĐIỂM ƯỚC TÍNH:
   - Cho điểm tổng quan (Overall Band) và điểm chi tiết theo 4 tiêu chí chuẩn IELTS:
     ${
       isWriting
         ? '• Task Response/Achievement\n     • Coherence & Cohesion\n     • Lexical Resource\n     • Grammatical Range & Accuracy'
         : '• Fluency and Coherence\n     • Lexical Resource\n     • Grammatical Range and Accuracy\n     • Pronunciation'
     }

2. CHỈ RÕ LỖI SAI CỤ THỂ VÀ CÁCH SỬA (Detailed Corrections):
   - Lập bảng hoặc danh sách liệt kê từng câu văn/cụm từ bị sai ngữ pháp, dùng từ gượng gạo hoặc chưa chuẩn collocation.
   - Viết lại câu sửa chữa (Correction) và giải thích tại sao sửa như vậy.

3. NÂNG CẤP TỪ BAND ${currentLevel} LÊN BAND ${targetBand}:
   - Lấy ít nhất 3-4 câu trong bài của tôi và viết lại (Rewriting/Paraphrasing) theo phong cách văn phong Band ${targetBand}.
   - Chỉ ra các cụm từ vựng "đắt giá" (Topic-specific vocabulary, C1/C2 phrases) mà tôi nên đưa vào.

4. BÀI VIẾT/BÀI NÓI HOÀN CHỈNH ĐẠT CHUẨN BAND ${targetBand}:
   - Cung cấp một phiên bản bài mẫu hoàn chỉnh đạt Band ${targetBand} dựa trên chính các ý tưởng của tôi để tôi học thuộc và học hỏi tư duy tổ chức bài.

5. 3 LỜI KHUYÊN HÀNH ĐỘNG CỤ THỂ CHO LẦN LUYỆN TẬP TIẾP THEO:
   - Đưa ra 3 bài tập hoặc thói quen ngắn gọn giúp tôi khắc phục ngay điểm yếu lớn nhất.
`;
  };

  const handleCopy = () => {
    const text = buildPrompt();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Tạo Prompt AI Chấm & Nâng Trình IELTS
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cá nhân hóa theo mục tiêu điểm số để gửi ChatGPT, Claude, Gemini hoặc DeepSeek
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white text-slate-800">
          {/* Section 1: Target Band Selection */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-slate-800">Mục tiêu Band điểm mong muốn:</span>
              </div>
              <span className="text-xs text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Target Band: {targetBand}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {(['6.5', '7.0', '7.5', '8.0', '8.5+'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setTargetBand(b)}
                  className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                    targetBand === b
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Band {b}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Current Level & Focus Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Level */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
              <span className="text-xs font-semibold text-slate-800 block">Trình độ hiện tại ước tính:</span>
              <div className="grid grid-cols-4 gap-1.5">
                {(['5.5', '6.0', '6.5', '7.0'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setCurrentLevel(lvl)}
                    className={`py-1 text-xs font-semibold rounded-md border transition ${
                      currentLevel === lvl
                        ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Band {lvl}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                AI sẽ phân tích khoảng cách từ Band {currentLevel} lên Band {targetBand}.
              </p>
            </div>

            {/* Focus Priorities */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
              <span className="text-xs font-semibold text-slate-800 block">Trọng tâm muốn cải thiện:</span>
              <div className="space-y-1.5 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focusVocab}
                    onChange={(e) => setFocusVocab(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 border-slate-300"
                  />
                  <span>Từ vựng C1-C2 & Collocations</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focusGrammar}
                    onChange={(e) => setFocusGrammar(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 border-slate-300"
                  />
                  <span>Đa dạng cấu trúc & Sửa lỗi ngữ pháp</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focusCoherence}
                    onChange={(e) => setFocusCoherence(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 border-slate-300"
                  />
                  <span>{skillType === 'writing' ? 'Mạch lạc & Liên từ (Cohesion)' : 'Độ trôi chảy & Phát âm ngữ điệu'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focusTaskDepth}
                    onChange={(e) => setFocusTaskDepth(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 border-slate-300"
                  />
                  <span>{skillType === 'writing' ? 'Chiều sâu Luận điểm & Dẫn chứng' : 'Mở rộng ý & phản xạ tự nhiên'}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Live Prompt Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold">Nội dung Prompt tạo tự động:</span>
              <span className="text-[11px] font-mono font-semibold text-slate-600">
                {buildPrompt().length} ký tự
              </span>
            </div>

            <div className="p-3.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] max-h-44 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
              {buildPrompt()}
            </div>
          </div>

          {/* Section 4: AI Recommendations */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Dán vào các AI miễn phí:</span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://chatgpt.com"
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium rounded-md border border-slate-200 flex items-center gap-1 transition shadow-2xs"
              >
                <span>ChatGPT</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a
                href="https://claude.ai"
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium rounded-md border border-slate-200 flex items-center gap-1 transition shadow-2xs"
              >
                <span>Claude</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a
                href="https://chat.deepseek.com"
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium rounded-md border border-slate-200 flex items-center gap-1 transition shadow-2xs"
              >
                <span>DeepSeek</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Đóng
          </button>

          <button
            onClick={handleCopy}
            className={`px-5 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-2 shadow-xs transition-all ${
              copied
                ? 'bg-slate-800'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Đã sao chép vào bộ nhớ tạm!' : 'Sao Chép Prompt (1-Click Copy)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
