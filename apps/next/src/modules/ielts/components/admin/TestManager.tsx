import { useState, useRef, type FC } from 'react';
import { useToast } from '@chakra-ui/react';
import { outfit } from '@quenti/lib/chakra-theme';
import type { Exam } from '../../types/exam';
import {
  getAllExams,
  saveExam,
  deleteExam,
  exportExamAsJSON,
  importExamFromJSON,
  getAllCollections,
  createCollection,
  getExamCollection,
  setExamCollection,
  isListeningExam,
} from '../../utils/storage';
import {
  Plus,
  Play,
  Edit,
  Copy,
  Download,
  Upload,
  Trash2,
  Search,
  BookOpen,
  Clock,
  FileText,
  X,
  Folder,
  FolderPlus,
  Headphones,
} from 'lucide-react';

interface TestManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExam: (exam: Exam) => void;
  onOpenEditor: (exam?: Exam | null) => void;
  onOpenSmartImport?: () => void;
}

export const TestManager: FC<TestManagerProps> = ({
  isOpen,
  onClose,
  onSelectExam,
  onOpenEditor,
  onOpenSmartImport,
}) => {
  const toast = useToast();
  const [exams, setExams] = useState<Exam[]>(() => getAllExams());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const collections = getAllCollections();

  const refreshExams = () => {
    setExams(getAllExams());
  };

  const handleClone = (exam: Exam) => {
    const cloned: Exam = {
      ...JSON.parse(JSON.stringify(exam)),
      id: 'exam_' + Date.now(),
      title: `${exam.title} (Copy)`,
      isBuiltin: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveExam(cloned);
    refreshExams();
    toast({
      title: 'Test duplicated',
      description: `Created "${cloned.title}".`,
      status: 'success',
      duration: 2200,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleDelete = (id: string, title: string) => {
    deleteExam(id);
    refreshExams();
    toast({
      title: 'Test deleted',
      description: `Removed "${title}" from Test Bank.`,
      status: 'info',
      duration: 2200,
      isClosable: true,
      position: 'bottom-right',
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        importExamFromJSON(text);
        refreshExams();
        toast({
          title: 'Test imported successfully',
          status: 'success',
          duration: 2500,
          isClosable: true,
          position: 'bottom-right',
        });
      } catch (err: any) {
        toast({
          title: 'Error importing file',
          description: err.message || 'Invalid JSON file format.',
          status: 'error',
          duration: 3000,
          isClosable: true,
          position: 'bottom-right',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportJsonText = () => {
    try {
      setImportError('');
      if (!importJsonText.trim()) {
        setImportError('Please paste JSON content here.');
        return;
      }
      importExamFromJSON(importJsonText);
      refreshExams();
      setImportModalOpen(false);
      setImportJsonText('');
      toast({
        title: 'Test imported successfully',
        status: 'success',
        duration: 2500,
        isClosable: true,
        position: 'bottom-right',
      });
    } catch (err: any) {
      setImportError(err.message || 'Invalid JSON format.');
    }
  };

  const filteredExams = exams.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;

    if (selectedCollection !== 'all') {
      const col = getExamCollection(e);
      return col.toLowerCase() === selectedCollection.toLowerCase();
    }
    return true;
  });

  const handleCreateCollectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      createCollection(newCollectionName.trim(), newCollectionDesc.trim());
      setSelectedCollection(newCollectionName.trim());
      setNewCollectionName('');
      setNewCollectionDesc('');
      setShowNewCollectionModal(false);
      refreshExams();
      toast({
        title: 'Collection created',
        status: 'success',
        duration: 2200,
        isClosable: true,
        position: 'bottom-right',
      });
    } catch (err: any) {
      toast({
        title: 'Failed to create collection',
        description: err.message || 'Please check the collection name.',
        status: 'error',
        duration: 2800,
        isClosable: true,
        position: 'bottom-right',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-text font-sans">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[88vh] flex flex-col overflow-hidden border-2 border-gray-200 animate-in fade-in zoom-in-95">
        {/* Header — PNO Quiz Modal Header Style */}
        <div className="min-h-16 py-3 border-b-2 border-gray-200 px-6 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-lg font-extrabold text-gray-900 leading-tight"
                style={{ fontFamily: outfit.style.fontFamily }}
              >
                IELTS Test Bank &amp; Collection Manager
              </h2>
              <p className="text-xs font-medium text-gray-500">
                Manage practice tests, organize collections, edit content, and export JSON backups
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowNewCollectionModal(true)}
              className="px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border-2 border-gray-200 rounded-xl transition flex items-center gap-1.5"
              title="Create a new collection folder"
            >
              <FolderPlus className="w-4 h-4 text-blue-600" />
              <span>New Collection</span>
            </button>

            <button
              onClick={() => {
                if (onOpenSmartImport) {
                  onOpenSmartImport();
                } else {
                  onOpenEditor(null);
                }
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Test</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 rounded-xl border-2 border-gray-200 transition flex items-center gap-1.5"
              title="Import test from .json backup file"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
            </button>

            <button
              onClick={() => setImportModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 rounded-xl border-2 border-gray-200 transition flex items-center gap-1.5"
              title="Paste JSON string"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Paste JSON</span>
            </button>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="px-6 py-3.5 border-b-2 border-gray-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3 flex-1 max-w-2xl">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search practice tests..."
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold border-2 border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Collection Filter Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-blue-600" />
                <span>Collection:</span>
              </span>
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="text-xs border-2 border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-800 font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">All ({exams.length} tests)</option>
                {collections.map((c) => {
                  const count = exams.filter(
                    (ex) => getExamCollection(ex).toLowerCase() === c.name.toLowerCase()
                  ).length;
                  return (
                    <option key={c.id} value={c.name}>
                      {c.name} ({count} tests)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <span className="text-xs font-bold text-gray-500 bg-white px-3 py-1.5 rounded-xl border-2 border-gray-200">
            Showing {filteredExams.length} tests
          </span>
        </div>

        {/* List of Exams — PNO Quiz GenericCard Style */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3.5 bg-slate-50/50">
          {filteredExams.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs font-semibold">
              No practice tests found in this collection.
            </div>
          ) : (
            filteredExams.map((exam) => {
              const isListening = isListeningExam(exam);
              const totalQuestions = exam.parts.reduce(
                (sum, p) =>
                  sum + p.questionGroups.reduce((gSum, g) => gSum + g.questions.length, 0),
                0
              );
              const currentExamCol = getExamCollection(exam);

              return (
                <div
                  key={exam.id}
                  className="bg-white rounded-2xl border-2 border-gray-200 p-5 shadow-xs hover:border-blue-300 transition-all flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-[240px]">
                    <div className="flex flex-wrap items-center gap-2">
                      {isListening ? (
                        <span className="p-1.5 rounded-xl bg-purple-100 text-purple-700" title="IELTS Listening Test">
                          <Headphones className="w-4 h-4" />
                        </span>
                      ) : (
                        <span className="p-1.5 rounded-xl bg-blue-100 text-blue-700" title="IELTS Reading Test">
                          <BookOpen className="w-4 h-4" />
                        </span>
                      )}

                      <h3
                        className="font-extrabold text-sm text-gray-900 truncate"
                        style={{ fontFamily: outfit.style.fontFamily }}
                      >
                        {exam.title}
                      </h3>

                      {/* Collection Pill with quick changer */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                          <Folder className="w-3 h-3" />
                          <span>{currentExamCol}</span>
                        </span>
                        <select
                          value={currentExamCol}
                          onChange={(e) => {
                            setExamCollection(exam.id, e.target.value);
                            refreshExams();
                            toast({
                              title: 'Moved test to collection',
                              description: `${exam.title} → ${e.target.value}`,
                              status: 'info',
                              duration: 2000,
                              isClosable: true,
                              position: 'bottom-right',
                            });
                          }}
                          className="text-[11px] font-semibold bg-gray-100 border border-gray-200 rounded-lg px-2 py-0.5 text-gray-700 hover:bg-gray-200 transition cursor-pointer"
                          title="Move test to another collection"
                        >
                          {collections.map((c) => (
                            <option key={c.id} value={c.name}>
                              → Move to {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {exam.isBuiltin && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 shrink-0">
                          Official
                        </span>
                      )}
                    </div>

                    {exam.description && (
                      <p className="text-xs text-gray-600 truncate max-w-xl">
                        {exam.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-gray-500 pt-0.5 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        {exam.durationMinutes} mins
                      </span>
                      <span>•</span>
                      <span>{exam.parts.length} {isListening ? 'Sections' : 'Passages'}</span>
                      <span>•</span>
                      <span className="font-bold text-gray-700">
                        {totalQuestions} Questions
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Start Test */}
                    <button
                      onClick={() => {
                        onSelectExam(exam);
                        onClose();
                      }}
                      className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
                      title="Start this test"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Start Test</span>
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => onOpenEditor(exam)}
                      className="p-2 text-gray-600 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 border border-gray-200 rounded-xl transition"
                      title="Edit test"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {/* Clone */}
                    <button
                      onClick={() => handleClone(exam)}
                      className="p-2 text-gray-600 hover:text-emerald-600 bg-gray-100 hover:bg-emerald-50 border border-gray-200 rounded-xl transition"
                      title="Duplicate test"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {/* Export */}
                    <button
                      onClick={() => exportExamAsJSON(exam)}
                      className="p-2 text-gray-600 hover:text-indigo-600 bg-gray-100 hover:bg-indigo-50 border border-gray-200 rounded-xl transition"
                      title="Export as JSON backup"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(exam.id, exam.title)}
                      className="p-2 text-gray-500 hover:text-rose-600 bg-gray-100 hover:bg-rose-50 border border-gray-200 rounded-xl transition"
                      title="Delete test"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* JSON Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3
                className="text-base font-extrabold text-gray-900"
                style={{ fontFamily: outfit.style.fontFamily }}
              >
                Paste JSON Test Backup
              </h3>
              <button
                onClick={() => setImportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-xl hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Paste JSON content exported from PNO to immediately add it to your Test Bank.
            </p>

            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              rows={8}
              placeholder="Paste JSON content here..."
              className="w-full text-xs font-mono p-3 border-2 rounded-xl border-gray-200 focus:border-blue-500 outline-none"
            />

            {importError && (
              <p className="text-xs text-rose-600 font-bold">{importError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleImportJsonText}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                Import Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Collection Modal */}
      {showNewCollectionModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-blue-600" />
                <h3
                  className="text-base font-extrabold text-gray-900"
                  style={{ fontFamily: outfit.style.fontFamily }}
                >
                  Create New Collection
                </h3>
              </div>
              <button
                onClick={() => setShowNewCollectionModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-xl hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCollectionSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Collection Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="e.g. Cambridge 19, Intensive Mock Tests..."
                  className="w-full text-xs p-3 border-2 rounded-xl border-gray-200 focus:border-blue-500 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newCollectionDesc}
                  onChange={(e) => setNewCollectionDesc(e.target.value)}
                  placeholder="e.g. Authentic computer-delivered practice set..."
                  className="w-full text-xs p-3 border-2 rounded-xl border-gray-200 focus:border-blue-500 outline-none font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCollectionModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  Create Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestManager;
