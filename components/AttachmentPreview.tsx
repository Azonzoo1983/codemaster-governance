import React, { useEffect } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface AttachmentPreviewProps {
  url: string;
  name: string;
  type: string;
  onClose: () => void;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ url, name, type, onClose }) => {
  const isImage = type.startsWith('image/');
  const isPdf = type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={`Preview: ${name}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/60 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{name}</h3>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition"
              title="Open in new tab"
            >
              <ExternalLink size={16} />
            </a>
            <a
              href={url}
              download={name}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition"
              title="Download"
            >
              <Download size={16} />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition"
              aria-label="Close preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          {isImage && (
            <img
              src={url}
              alt={name}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
            />
          )}
          {isPdf && (
            <iframe
              src={url}
              title={name}
              className="w-full h-[70vh] rounded-lg border border-slate-200 dark:border-slate-700"
            />
          )}
          {!isImage && !isPdf && (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400 mb-3">Preview not available for this file type.</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
              >
                <ExternalLink size={14} />
                Open in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
