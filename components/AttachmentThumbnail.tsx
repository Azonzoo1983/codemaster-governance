import React, { useState } from 'react';
import { FileText, Image, File, Eye } from 'lucide-react';
import { formatFileSize } from '../lib/fileUpload';
import { AttachmentPreview } from './AttachmentPreview';

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

interface AttachmentThumbnailProps {
  attachment: Attachment;
  onRemove?: () => void;
  showRemove?: boolean;
}

export const AttachmentThumbnail: React.FC<AttachmentThumbnailProps> = ({
  attachment,
  onRemove,
  showRemove = false,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const isImage = attachment.type.startsWith('image/');
  const isPdf = attachment.type === 'application/pdf' || attachment.name.toLowerCase().endsWith('.pdf');
  const canPreview = isImage || isPdf;

  const getIcon = () => {
    if (isImage) return <Image size={20} className="text-blue-500 dark:text-blue-400" />;
    if (isPdf) return <FileText size={20} className="text-red-500 dark:text-red-400" />;
    return <File size={20} className="text-slate-400 dark:text-slate-500" />;
  };

  return (
    <>
      <div className="group relative flex items-center gap-3 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200/60 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 transition">
        {/* Thumbnail or icon */}
        <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          {isImage ? (
            <img
              src={attachment.url}
              alt={attachment.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            getIcon()
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{attachment.name}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{formatFileSize(attachment.size)}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canPreview && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowPreview(true); }}
              className="p-1.5 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg transition"
              aria-label={`Preview ${attachment.name}`}
            >
              <Eye size={14} />
            </button>
          )}
          {showRemove && onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1.5 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 rounded-lg transition"
              aria-label={`Remove ${attachment.name}`}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {showPreview && (
        <AttachmentPreview
          url={attachment.url}
          name={attachment.name}
          type={attachment.type}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
};
