import React, { useCallback } from 'react';
import { Upload, FileText, X, FileCode, Trash2, FolderArchive } from 'lucide-react';
import { UploadedFile } from '../types';
import JSZip from 'jszip';

interface FileUploadProps {
  files: UploadedFile[];
  setFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  disabled: boolean;
  onClear?: () => void;
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'json', 'ts', 'js', 'tsx', 'jsx', 
  'cpp', 'c', 'h', 'hpp', 'py', 'sh', 'java', 
  'html', 'css', 'scss', 'xml', 'yaml', 'yml', 
  'sql', 'rs', 'go', 'rb', 'php'
]);

const isTextFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? TEXT_EXTENSIONS.has(ext) : false;
};

export const FileUpload: React.FC<FileUploadProps> = ({ files, setFiles, disabled, onClear }) => {

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles: UploadedFile[] = [];
      const fileList: File[] = Array.from(event.target.files);

      for (const file of fileList) {
        // Handle Zip Files
        if (file.name.endsWith('.zip') || file.type.includes('zip')) {
          try {
            const zip = await JSZip.loadAsync(file);
            const promises: Promise<UploadedFile | null>[] = [];
            
            zip.forEach((relativePath, zipEntry) => {
              // Skip directories and MacOS hidden files
              if (zipEntry.dir || zipEntry.name.includes('__MACOSX') || zipEntry.name.startsWith('.')) {
                return;
              }

              if (isTextFile(zipEntry.name)) {
                promises.push(zipEntry.async('string').then(content => ({
                    id: Math.random().toString(36).substr(2, 9),
                    name: zipEntry.name, // Keeps directory structure in name e.g. "src/main.cpp"
                    content: content,
                    size: content.length,
                    type: 'text/plain'
                })));
              }
            });

            const results = await Promise.all(promises);
            results.forEach(res => {
                if (res) newFiles.push(res);
            });
          } catch (error) {
            console.error("Error processing zip file:", error);
            alert(`Failed to process zip file: ${file.name}`);
          }
          continue; 
        }

        // Handle Single Text/Code Files
        if (isTextFile(file.name) || file.type.startsWith('text/')) {
           try {
              const text = await file.text();
              newFiles.push({
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                content: text,
                size: file.size,
                type: file.type || 'text/plain'
              });
           } catch (e) {
              console.warn("Could not read file", file.name);
           }
        } else {
            // Fallback: Try to read as text anyway (often useful for files without standard extensions)
            try {
                const text = await file.text();
                // Basic heuristic: check if it looks like binary (lots of null bytes)
                // This is a simple check, not perfect.
                if (!text.includes('\0')) {
                    newFiles.push({
                        id: Math.random().toString(36).substr(2, 9),
                        name: file.name,
                        content: text,
                        size: file.size,
                        type: file.type
                    });
                }
            } catch (e) {
                console.warn("Skipping likely binary file", file.name);
            }
        }
      }

      setFiles(prev => [...prev, ...newFiles]);
      // Reset input value to allow re-uploading same file if deleted
      event.target.value = '';
    }
  }, [setFiles]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <label 
          htmlFor="file-upload" 
          className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            disabled 
              ? 'bg-slate-100 border-slate-300 cursor-not-allowed opacity-60' 
              : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className={`w-8 h-8 mb-2 ${disabled ? 'text-slate-400' : 'text-blue-500'}`} />
            <p className="mb-1 text-sm text-slate-500 font-medium text-center">Click to upload files or .zip archives</p>
            <p className="text-xs text-slate-400 text-center px-4">Supported: .zip, .md, .txt, .json, .cpp, .py, .sh, .ts, etc.</p>
          </div>
          <input 
            id="file-upload" 
            type="file" 
            className="hidden" 
            multiple 
            accept=".zip,.txt,.md,.json,.js,.ts,.tsx,.jsx,.cpp,.c,.h,.hpp,.py,.sh,.java,.html,.css,.xml,.yaml,.yml,.sql,.rs,.go"
            onChange={handleFileChange}
            disabled={disabled}
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Knowledge Base ({files.length})</h3>
            {files.length > 0 && !disabled && onClear && (
                <button 
                    onClick={onClear}
                    className="text-xs text-slate-400 hover:text-red-500 flex items-center transition-colors px-1"
                    title="Clear all files"
                >
                    <Trash2 className="w-3 h-3 mr-1" /> Clear
                </button>
            )}
        </div>

        {files.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-4 italic">
                No documents uploaded yet.
            </div>
        ) : (
            <ul className="space-y-2">
            {files.map(file => (
                <li key={file.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md shadow-sm text-sm group">
                <div className="flex items-center truncate mr-2 w-full">
                    {file.name.includes('/') ? (
                         <FolderArchive className="w-4 h-4 text-amber-500 mr-2 flex-shrink-0" />
                    ) : (file.name.endsWith('.json') || file.name.endsWith('.ts') || file.name.endsWith('.cpp') || file.name.endsWith('.py')) ? (
                        <FileCode className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                    ) : (
                        <FileText className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                    )}
                    <div className="flex flex-col truncate">
                        <span className="truncate text-slate-700 font-medium" title={file.name}>
                            {file.name.split('/').pop()}
                        </span>
                        {file.name.includes('/') && (
                            <span className="text-[10px] text-slate-400 truncate">
                                {file.name}
                            </span>
                        )}
                    </div>
                </div>
                {!disabled && (
                    <button 
                        onClick={() => removeFile(file.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 ml-2"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
                </li>
            ))}
            </ul>
        )}
      </div>
    </div>
  );
};