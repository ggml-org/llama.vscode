import React from 'react';
import { CloseIcon, FileIcon, ImageIcon } from '../common/Icons';

interface ContextChipsProps {
  contextFiles: Map<string, string>;
  imagePath: string;
  onOpenFile: (fileLongName: string) => void;
  onRemoveFile: (fileLongName: string) => void;
  onRemoveImage: (imagePath: string) => void;
}

const IMAGE_NAME_REGEX = /[\\/]([^\\/]+)$/;

const imageName = (imagePath: string): string => {
  const match = IMAGE_NAME_REGEX.exec(imagePath);
  return match ? match[1] : imagePath;
};

// One chip style for every kind of context (file / image). The label is the
// short name, the full path is only exposed through `title`.
const ContextChips: React.FC<ContextChipsProps> = ({
  contextFiles,
  imagePath,
  onOpenFile,
  onRemoveFile,
  onRemoveImage
}) => {
  if (contextFiles.size === 0 && !imagePath) return null;

  return (
    <div className="context-chips">
      {Array.from(contextFiles.entries()).map(([longName, shortName]) => (
        <div className="context-chip" key={longName}>
          <FileIcon />
          <button
            type="button"
            className="chip-label"
            onClick={() => onOpenFile(longName)}
            title={`Open ${longName}`}
            aria-label={`Open ${shortName}`}
          >
            {shortName}
          </button>
          <button
            type="button"
            className="chip-remove"
            onClick={() => onRemoveFile(longName)}
            title={`Remove ${shortName} from context`}
            aria-label={`Remove ${shortName} from context`}
          >
            <CloseIcon />
          </button>
        </div>
      ))}

      {imagePath && (
        <div className="context-chip image" key={imagePath}>
          <ImageIcon />
          <span className="chip-label" title={imagePath}>{imageName(imagePath)}</span>
          <button
            type="button"
            className="chip-remove"
            onClick={() => onRemoveImage(imagePath)}
            title="Remove image from context"
            aria-label="Remove image from context"
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  );
};

export default ContextChips;
