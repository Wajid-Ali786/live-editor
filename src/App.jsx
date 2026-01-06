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
 * We use dynamic loading to ensure this works on GitHub Pages/Localhost 
 * without complex Web Worker configuration for Monaco.
 */

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

const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

// Monaco Editor Loader (CDN based for maximum compatibility)
const loadMonaco = async () => {
  if (window.monaco) return window.monaco;
  
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
  <style>
    /* CSS is injected dynamically by the editor */
  </style>
</head>
<body>
  <div class="app">
    <h1>Hello, World!</h1>
    <p>Start editing to see magic happen.</p>
    <button id="btn">Click me</button>
    <div id="output"></div>
  </div>
</body>
</html>`
  },
  'style.css': {
    name: 'style.css',
    language: 'css',
    content: `body {
  font-family: sans-serif;
  background: #1e1e1e;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  margin: 0;
}
.app {
  text-align: center;
  background: #2d2d2d;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}
button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 10px;
}
button:hover { background: #2563eb; }`
  },
  'script.js': {
    name: 'script.js',
    language: 'javascript',
    content: `console.log('Script loaded!');

const btn = document.getElementById('btn');
const output = document.getElementById('output');

btn.addEventListener('click', () => {
  output.innerHTML = '<p>✨ Button Clicked! ✨</p>';
  btn.style.transform = 'scale(0.95)';
  setTimeout(() => btn.style.transform = 'scale(1)', 100);
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

  // Initialize Monaco
  useEffect(() => {
    let mounted = true;

    const initMonaco = async () => {
      try {
        const monaco = await loadMonaco();
        if (!mounted || !containerRef.current) return;

        if (editorRef.current) {
          editorRef.current.dispose();
        }

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
  }, []); 

  // Handle active file switching
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      const currentContent = editorRef.current.getValue();
      const newContent = files[activeFile].content;
      const newLang = files[activeFile].language;

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
          Loading VS Code Engine...
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

  const debouncedHtml = useDebounce(files['index.html'].content, 800);
  const debouncedCss = useDebounce(files['style.css'].content, 800);
  const debouncedJs = useDebounce(files['script.js'].content, 800);

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
      a.download = 'my-project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
      alert("Failed to create zip file.");
    }
  };

  const reloadPreview = () => setPreviewKey(prev => prev + 1);

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-gray-300 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="h-10 bg-[#333333] flex items-center justify-between px-4 border-b border-[#1e1e1e] select-none shadow-sm">
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center font-bold text-[#007acc]">
            <LayoutTemplate size={18} className="mr-2" />
            VS Code Clone
          </div>
          <nav className="hidden md:flex space-x-3 text-gray-400">
            <span className="hover:text-white cursor-pointer transition-colors">File</span>
            <span className="hover:text-white cursor-pointer transition-colors">Edit</span>
            <span className="hover:text-white cursor-pointer transition-colors">View</span>
          </nav>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={reloadPreview}
            className="p-1.5 hover:bg-[#444] rounded text-gray-300 hover:text-white transition-colors"
            title="Refresh Preview"
          >
            <RefreshCw size={14} />
          </button>
          <button 
            onClick={handleDownload}
            className="flex items-center px-3 py-1.5 bg-[#007acc] hover:bg-[#005a9e] text-white text-xs font-semibold rounded transition-colors shadow-sm"
          >
            <Download size={14} className="mr-1.5" />
            Export Project
          </button>
        </div>
      </header>

      {/* WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* SIDEBAR */}
        <div 
          className={`${isSidebarOpen ? 'w-64' : 'w-12'} bg-[#252526] flex flex-col border-r border-[#1e1e1e] transition-all duration-300`}
        >
          <div className="flex flex-row h-full">
            <div className="w-12 bg-[#333333] flex flex-col items-center py-4 space-y-6">
              <FileCode size={24} className={`cursor-pointer transition-colors ${isSidebarOpen ? 'text-white' : 'text-gray-500'}`} onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
              <Search size={24} className="text-gray-500 hover:text-white cursor-pointer transition-colors" />
              <div className="flex-1" />
              <Settings size={24} className="text-gray-500 hover:text-white cursor-pointer transition-colors mb-4" />
            </div>

            <div className={`${!isSidebarOpen && 'hidden'} flex-1 flex flex-col`}>
              <div className="h-9 px-4 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#252526]">
                <span>Explorer</span>
              </div>
              
              <div className="flex-1 overflow-y-auto pt-2">
                  <div className="flex items-center px-2 text-xs font-bold text-gray-300 cursor-pointer mb-1">
                    <ChevronDown size={14} className="mr-1" />
                    <span className="uppercase font-bold">Project Files</span>
                  </div>
                  
                  {Object.values(files).map((file) => (
                    <div
                      key={file.name}
                      onClick={() => setActiveFile(file.name)}
                      className={`
                        flex items-center px-6 py-1.5 cursor-pointer text-sm transition-colors
                        ${activeFile === file.name 
                          ? 'bg-[#37373d] text-white' 
                          : 'text-gray-400 hover:bg-[#2a2d2e] hover:text-gray-200'}
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

        {/* EDITOR & PREVIEW */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e] min-w-0">
          
          {/* TABS */}
          <div className="flex bg-[#252526] overflow-x-auto scrollbar-hide border-b border-[#1e1e1e]">
            {Object.values(files).map((file) => (
              <div
                key={file.name}
                onClick={() => setActiveFile(file.name)}
                className={`
                  flex items-center px-3 py-2 text-xs cursor-pointer border-r border-[#1e1e1e] group min-w-[100px]
                  ${activeFile === file.name 
                    ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]' 
                    : 'bg-[#2d2d2d] text-gray-500 hover:bg-[#2a2d2e] border-t-2 border-t-transparent'}
                `}
              >
                <span className="mr-2"><FileIcon fileName={file.name} /></span>
                <span className="flex-1 truncate">{file.name}</span>
                <span className="ml-2 opacity-0 group-hover:opacity-100"><X size={12} /></span>
              </div>
            ))}
          </div>

          <div className="flex-1 flex flex-col md:flex-row min-h-0">
            {/* MONACO */}
            <div className="flex-1 border-r border-[#333] relative">
              <MonacoEditor 
                activeFile={activeFile} 
                files={files} 
                onChange={handleEditorChange} 
              />
            </div>

            {/* PREVIEW */}
            <div className="flex-1 bg-white flex flex-col relative">
              <div className="h-8 bg-[#f0f0f0] border-b border-[#ddd] flex items-center px-4 justify-between">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center">
                  <Play size={12} className="mr-1.5 text-green-600" />
                  Live Preview
                </span>
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
      
      {/* STATUS BAR */}
      <footer className="h-6 bg-[#007acc] text-white flex items-center px-3 text-xs justify-between select-none z-10">
        <div className="flex items-center space-x-3">
          <div className="flex items-center hover:bg-[#1f8ad2] px-2 h-full cursor-pointer">
            <span className="mr-2 font-semibold">main*</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span>Ln 1, Col 1</span>
          <span>UTF-8</span>
          <span>{files[activeFile].language.toUpperCase()}</span>
        </div>
      </footer>
    </div>
  );
}