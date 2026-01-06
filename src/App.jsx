import React, { useState, useEffect, useRef } from 'react';
import { 
  FileCode, 
  FileType, 
  FileJson, 
  Play, 
  Download, 
  Settings, 
  Search, 
  X,
  ChevronDown,
  LayoutTemplate,
  RefreshCw,
  Loader2
} from 'lucide-react';

/**
 * UTILITIES & LOADERS
 */

// Simple debounce
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

// Dynamic Script Loader for external libs
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

// Monaco Editor Loader
const loadMonaco = async () => {
  if (window.monaco) return window.monaco;
  
  // Load loader.js first
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js');
  
  return new Promise((resolve) => {
    window.require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
    window.require(['vs/editor/editor.main'], () => {
      resolve(window.monaco);
    });
  });
};

// JSZip Loader
const loadJSZip = async () => {
  if (window.JSZip) return window.JSZip;
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  return window.JSZip;
};

/**
 * INITIAL DATA
 */
const INITIAL_FILES = {
  'index.html': {
    name: 'index.html',
    language: 'html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Awesome App</title>
</head>
<body>
  <div class="container">
    <h1>Hello, World!</h1>
    <p>Welcome to your live editor.</p>
    <button id="clickBtn">Click Me</button>
    <div id="output"></div>
  </div>
</body>
</html>`
  },
  'style.css': {
    name: 'style.css',
    language: 'css',
    content: `body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #f0f2f5;
  color: #333;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  margin: 0;
}

.container {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  text-align: center;
  max-width: 400px;
  width: 100%;
}

h1 {
  color: #2563eb;
  margin-bottom: 1rem;
}

button {
  background-color: #2563eb;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #1d4ed8;
}`
  },
  'script.js': {
    name: 'script.js',
    language: 'javascript',
    content: `document.getElementById('clickBtn').addEventListener('click', () => {
  const output = document.getElementById('output');
  output.innerHTML = '<p style="color: green; margin-top: 1rem;">Button clicked! Javascript is working.</p>';
  console.log('Interaction successful');
});`
  }
};

/**
 * COMPONENTS
 */

const FileIcon = ({ fileName }) => {
  if (fileName.endsWith('.html')) return <FileCode size={16} className="text-orange-500" />;
  if (fileName.endsWith('.css')) return <FileType size={16} className="text-blue-400" />;
  if (fileName.endsWith('.js')) return <FileJson size={16} className="text-yellow-400" />;
  return <FileCode size={16} className="text-gray-400" />;
};

const MonacoEditor = ({ activeFile, files, onChange }) => {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const monacoRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initMonaco = async () => {
      try {
        const monaco = await loadMonaco();
        if (!mounted || !containerRef.current) return;

        // Dispose existing editor if any
        if (editorRef.current) {
          editorRef.current.dispose();
        }

        // Create new editor
        editorRef.current = monaco.editor.create(containerRef.current, {
          value: files[activeFile].content,
          language: files[activeFile].language,
          theme: 'vs-dark',
          minimap: { enabled: true },
          fontSize: 14,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
          padding: { top: 16 }
        });

        monacoRef.current = monaco;
        setLoading(false);

        // Listen for changes
        editorRef.current.onDidChangeModelContent(() => {
          onChange(editorRef.current.getValue());
        });

      } catch (err) {
        console.error("Failed to load Monaco", err);
      }
    };

    initMonaco();

    return () => {
      mounted = false;
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, []); // Run once on mount to load libs

  // Handle active file changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      const currentContent = editorRef.current.getValue();
      const newContent = files[activeFile].content;
      const newLang = files[activeFile].language;

      // Only update if content/language is different to avoid cursor jumping
      // Ideally we would manage models per file, but simple setValue works for now
      if (model) {
        monacoRef.current.editor.setModelLanguage(model, newLang);
        if (currentContent !== newContent) {
           editorRef.current.setValue(newContent);
        }
      }
    }
  }, [activeFile, files]);

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e] text-gray-400 z-10">
          <Loader2 className="animate-spin mr-2" size={20} />
          Loading Editor...
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default function App() {
  const [files, setFiles] = useState(INITIAL_FILES);
  const [activeFile, setActiveFile] = useState('index.html');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [generatedSrc, setGeneratedSrc] = useState('');
  const [previewKey, setPreviewKey] = useState(0);

  // Debounce the file content so the preview doesn't refresh on every keystroke
  const debouncedHtml = useDebounce(files['index.html'].content, 800);
  const debouncedCss = useDebounce(files['style.css'].content, 800);
  const debouncedJs = useDebounce(files['script.js'].content, 800);

  // Generate the preview iframe content
  useEffect(() => {
    const html = debouncedHtml;
    const css = debouncedCss;
    const js = debouncedJs;

    const source = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            ${css}
          </style>
        </head>
        <body>
          ${html}
          <script>
            window.onerror = function(msg, url, lineNo, columnNo, error) {
              console.error("Error in preview:", msg, "Line:", lineNo);
              return false;
            };
            try {
              ${js}
            } catch (err) {
              console.error(err);
            }
          </script>
        </body>
      </html>
    `;
    setGeneratedSrc(source);
  }, [debouncedHtml, debouncedCss, debouncedJs]);

  const handleEditorChange = (value) => {
    setFiles((prev) => ({
      ...prev,
      [activeFile]: {
        ...prev[activeFile],
        content: value,
      },
    }));
  };

  const handleDownload = async () => {
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      Object.values(files).forEach((file) => {
        zip.file(file.name, file.content);
      });
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
      alert("Failed to load zip library.");
    }
  };

  const reloadPreview = () => {
    setPreviewKey(prev => prev + 1);
  };

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-gray-300 font-sans overflow-hidden">
      
      {/* HEADER / ACTIVITY BAR */}
      <header className="h-10 bg-[#2d2d2d] flex items-center justify-between px-4 border-b border-[#1e1e1e] select-none">
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center font-bold text-blue-400">
            <LayoutTemplate size={16} className="mr-2" />
            VS Code Clone
          </div>
          <nav className="hidden md:flex space-x-3 text-gray-400">
            <span className="hover:text-white cursor-pointer">File</span>
            <span className="hover:text-white cursor-pointer">Edit</span>
            <span className="hover:text-white cursor-pointer">Selection</span>
            <span className="hover:text-white cursor-pointer">View</span>
            <span className="hover:text-white cursor-pointer">Go</span>
            <span className="hover:text-white cursor-pointer">Run</span>
          </nav>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={reloadPreview}
            className="p-1.5 hover:bg-[#3e3e3e] rounded text-green-400 transition-colors"
            title="Refresh Preview"
          >
            <RefreshCw size={14} />
          </button>
          <button 
            onClick={handleDownload}
            className="flex items-center px-3 py-1 bg-[#007acc] hover:bg-[#0062a3] text-white text-xs rounded transition-colors"
          >
            <Download size={14} className="mr-1.5" />
            Export ZIP
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* SIDEBAR */}
        <div 
          className={`${isSidebarOpen ? 'w-64' : 'w-12'} bg-[#252526] flex flex-col border-r border-[#1e1e1e] transition-all duration-300 ease-in-out`}
        >
          {/* Sidebar Activity Icons */}
          <div className="flex flex-row h-full">
            <div className="w-12 bg-[#333333] flex flex-col items-center py-4 space-y-6 border-r border-[#1e1e1e]">
              <FileCode size={24} className="text-white cursor-pointer" onClick={() => setIsSidebarOpen(true)} />
              <Search size={24} className="text-gray-500 hover:text-white cursor-pointer transition-colors" />
              <div className="flex-1" />
              <Settings size={24} className="text-gray-500 hover:text-white cursor-pointer transition-colors mb-4" />
            </div>

            {/* File Explorer Tree */}
            <div className={`${!isSidebarOpen && 'hidden'} flex-1 flex flex-col`}>
              <div className="h-9 px-4 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#252526]">
                <span>Explorer</span>
                <span className="cursor-pointer hover:text-white">...</span>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <div className="px-2 py-1">
                  <div className="flex items-center text-xs font-bold text-gray-300 cursor-pointer mb-1 group">
                    <ChevronDown size={14} className="mr-1" />
                    <span className="uppercase">Project</span>
                  </div>
                  
                  {Object.values(files).map((file) => (
                    <div
                      key={file.name}
                      onClick={() => setActiveFile(file.name)}
                      className={`
                        flex items-center px-4 py-1.5 cursor-pointer text-sm
                        ${activeFile === file.name 
                          ? 'bg-[#37373d] text-white border-l-2 border-[#007acc]' 
                          : 'text-gray-400 hover:bg-[#2a2d2e] hover:text-gray-200 border-l-2 border-transparent'}
                      `}
                    >
                      <span className="mr-2"><FileIcon fileName={file.name} /></span>
                      {file.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* EDITOR AREA */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e] min-w-0">
          
          {/* TABS */}
          <div className="flex bg-[#252526] overflow-x-auto scrollbar-hide">
            {Object.values(files).map((file) => (
              <div
                key={file.name}
                onClick={() => setActiveFile(file.name)}
                className={`
                  flex items-center px-3 py-2.5 text-xs cursor-pointer min-w-[120px] max-w-[200px] border-r border-[#1e1e1e] group
                  ${activeFile === file.name 
                    ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]' 
                    : 'bg-[#2d2d2d] text-gray-400 hover:bg-[#2a2d2e] border-t-2 border-t-transparent'}
                `}
              >
                <span className="mr-2"><FileIcon fileName={file.name} /></span>
                <span className="flex-1 truncate">{file.name}</span>
                <span className={`ml-2 opacity-0 group-hover:opacity-100 hover:bg-gray-600 rounded p-0.5 ${activeFile === file.name ? 'opacity-100' : ''}`}>
                  <X size={12} />
                </span>
              </div>
            ))}
          </div>

          {/* SPLIT VIEW: EDITOR & PREVIEW */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0">
            {/* MONACO EDITOR */}
            <div className="flex-1 border-r border-[#333] relative group">
              <MonacoEditor 
                activeFile={activeFile} 
                files={files} 
                onChange={handleEditorChange} 
              />
            </div>

            {/* PREVIEW PANEL */}
            <div className="flex-1 bg-white flex flex-col min-h-[300px] md:min-h-0 relative">
              <div className="h-8 bg-[#f0f0f0] border-b border-[#ddd] flex items-center px-4 justify-between">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center">
                  <Play size={12} className="mr-1.5 text-green-600" />
                  Live Preview
                </span>
                <div className="text-[10px] text-gray-400">
                  Auto-refresh
                </div>
              </div>
              <iframe
                key={previewKey}
                title="Preview"
                srcDoc={generatedSrc}
                className="flex-1 w-full h-full border-none bg-white"
                sandbox="allow-scripts"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* FOOTER / STATUS BAR */}
      <footer className="h-6 bg-[#007acc] text-white flex items-center px-3 text-xs justify-between select-none z-10">
        <div className="flex items-center space-x-4">
          <div className="flex items-center hover:bg-[#1f8ad2] px-1 cursor-pointer">
            <span className="mr-2 font-bold">main*</span>
          </div>
          <div className="flex items-center hover:bg-[#1f8ad2] px-1 cursor-pointer">
            <span className="mr-1">0</span>
            <span className="mr-2">Errors</span>
            <span className="mr-1">0</span>
            <span>Warnings</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="hover:bg-[#1f8ad2] px-1 cursor-pointer">
            Ln 1, Col 1
          </div>
          <div className="hover:bg-[#1f8ad2] px-1 cursor-pointer">
            UTF-8
          </div>
          <div className="hover:bg-[#1f8ad2] px-1 cursor-pointer">
            {files[activeFile].language.toUpperCase()}
          </div>
          <div className="hover:bg-[#1f8ad2] px-1 cursor-pointer">
            Prettier
          </div>
        </div>
      </footer>
    </div>
  );
}