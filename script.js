// Initialize Lucide Icons
lucide.createIcons();

// --- Default Data ---
const DEFAULT_FILES = {
    'index.html': {
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Preview</title>
  <style>
    /* Styles from style.css will be injected here */
  </style>
</head>
<body>
  <div class="container">
    <h1>Hello, World!</h1>
    <p>Welcome to your live editor.</p>
    <button id="btn">Test Console Log</button>
  </div>
</body>
</html>`
    },
    'style.css': {
        name: 'style.css',
        language: 'css',
        content: `body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: #f3f4f6;
  color: #333;
  display: flex;
  justify-content: center;
  padding-top: 50px;
}
.container {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  text-align: center;
}
button {
  background: #2563eb;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 1rem;
}
button:hover { background: #1d4ed8; }`
    },
    'script.js': {
        name: 'script.js',
        language: 'javascript',
        content: `console.log("System: JavaScript Loaded successfully.");

document.getElementById('btn').addEventListener('click', () => {
  console.log("Button clicked at " + new Date().toLocaleTimeString());
  alert("Check the Console tab below!");
});`
    }
};

// --- State Management (LocalStorage) ---
let files = JSON.parse(localStorage.getItem('my-editor-project')) || JSON.parse(JSON.stringify(DEFAULT_FILES));
let activeFile = 'index.html';
let editorInstance = null;

// --- Monaco Editor Setup ---
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});

require(['vs/editor/editor.main'], function () {
    // Hide loading spinner
    document.getElementById('editor-loading').style.display = 'none';

    // Create Editor
    editorInstance = monaco.editor.create(document.getElementById('monaco-editor-container'), {
        value: files[activeFile].content,
        language: files[activeFile].language,
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        wordWrap: 'off',
        padding: { top: 16 }
    });

    // Save & Preview on Change
    editorInstance.onDidChangeModelContent(() => {
        files[activeFile].content = editorInstance.getValue();
        saveToStorage();
        document.getElementById('save-status').innerText = "Saving...";
        debouncedUpdatePreview();
    });

    // Initial Preview
    updatePreview();
});

// --- Core Functions ---

function saveToStorage() {
    localStorage.setItem('my-editor-project', JSON.stringify(files));
    setTimeout(() => {
        document.getElementById('save-status').innerText = "All changes saved";
    }, 500);
}

function resetProject() {
    if(confirm("Are you sure? This will reset all your code to default.")) {
        localStorage.removeItem('my-editor-project');
        location.reload();
    }
}

function switchFile(fileName) {
    if (!editorInstance) return;
    
    // Sync current file before switching
    files[activeFile].content = editorInstance.getValue();
    saveToStorage();

    // UI Updates
    document.querySelectorAll('.file-item, .tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`file-${getExt(fileName)}`).classList.add('active');
    document.getElementById(`tab-${getExt(fileName)}`).classList.add('active');

    // Switch Logic
    activeFile = fileName;
    const file = files[fileName];
    
    // Update Editor
    const model = editorInstance.getModel();
    monaco.editor.setModelLanguage(model, file.language);
    editorInstance.setValue(file.content);
    document.getElementById('lang-display').innerText = file.language.toUpperCase();
}

function getExt(fileName) {
    if (fileName.includes('html')) return 'html';
    if (fileName.includes('css')) return 'css';
    if (fileName.includes('js')) return 'js';
    return '';
}

// --- Preview & Console Logic ---

function updatePreview() {
    const html = files['index.html'].content;
    const css = files['style.css'].content;
    const js = files['script.js'].content;

    // We inject a script to capture console.log from the iframe
    const source = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>${css}</style>
    </head>
    <body>
        ${html}
        <script>
            // Console Interceptor
            (function(){
                const oldLog = console.log;
                const oldError = console.error;
                const oldWarn = console.warn;
                
                console.log = function(...args){
                    window.parent.postMessage({type: 'log', level: 'info', args: args}, '*');
                    oldLog.apply(console, args);
                };
                console.error = function(...args){
                    window.parent.postMessage({type: 'log', level: 'error', args: args}, '*');
                    oldError.apply(console, args);
                };
                console.warn = function(...args){
                    window.parent.postMessage({type: 'log', level: 'warn', args: args}, '*');
                    oldWarn.apply(console, args);
                };
            })();
            
            // User Script
            try {
                ${js}
            } catch (err) {
                console.error(err.message);
            }
        </script>
    </body>
    </html>
    `;

    const iframe = document.getElementById('preview-frame');
    iframe.srcdoc = source;
}

// Listen for Console Messages from Iframe
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'log') {
        logToConsole(event.data.level, event.data.args);
    }
});

function logToConsole(level, args) {
    const output = document.getElementById('console-output');
    const line = document.createElement('div');
    line.className = `log-entry ${level}`;
    
    // Convert args to string
    const text = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    line.textContent = `> ${text}`;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight; // Auto scroll
}

// Debounce (800ms)
let timeout;
function debouncedUpdatePreview() {
    clearTimeout(timeout);
    timeout = setTimeout(updatePreview, 800);
}

// --- Editor Features ---

function formatCode() {
    if(editorInstance) {
        editorInstance.getAction('editor.action.formatDocument').run();
    }
}

function toggleWordWrap() {
    if(editorInstance) {
        const current = editorInstance.getOption(monaco.editor.EditorOption.wordWrap);
        const newState = current === 'on' ? 'off' : 'on';
        editorInstance.updateOptions({ wordWrap: newState });
    }
}

// --- UI Toggles ---

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function toggleConsole() {
    const panel = document.getElementById('console-panel');
    panel.classList.toggle('hidden');
}

function clearConsole() {
    document.getElementById('console-output').innerHTML = '';
}

function downloadProject() {
    const zip = new JSZip();
    zip.file("index.html", files['index.html'].content);
    zip.file("style.css", files['style.css'].content);
    zip.file("script.js", files['script.js'].content);

    zip.generateAsync({type:"blob"}).then(function(content) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = "my-project.zip";
        link.click();
    });
}