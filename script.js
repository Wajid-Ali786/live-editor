// Initialize Lucide Icons
lucide.createIcons();

// Virtual File System
const files = {
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
    /* Styles are injected dynamically */
  </style>
</head>
<body>
  <div class="container">
    <h1>Hello, World!</h1>
    <p>Edit the HTML, CSS, and JS files to see changes instantly.</p>
    <button id="btn">Click Me</button>
    <div id="output"></div>
  </div>
</body>
</html>`
    },
    'style.css': {
        name: 'style.css',
        language: 'css',
        content: `body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: #ffffff;
  color: #333;
  padding: 2rem;
  display: flex;
  justify-content: center;
}

.container {
  text-align: center;
  max-width: 600px;
  border: 1px solid #eee;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

h1 { color: #007acc; }

button {
  background: #007acc;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 1rem;
}

button:hover { background: #005fa3; }`
    },
    'script.js': {
        name: 'script.js',
        language: 'javascript',
        content: `console.log("Javascript loaded!");

const btn = document.getElementById('btn');
const output = document.getElementById('output');

btn.addEventListener('click', () => {
  output.innerHTML = "<p style='color: green; margin-top: 10px;'>✨ JavaScript is working! ✨</p>";
});`
    }
};

let activeFile = 'index.html';
let editorInstance = null;

// Monaco Editor Configuration
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});

require(['vs/editor/editor.main'], function () {
    // Create Editor
    editorInstance = monaco.editor.create(document.getElementById('monaco-editor-container'), {
        value: files[activeFile].content,
        language: files[activeFile].language,
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        padding: { top: 16 }
    });

    // Listen for changes
    editorInstance.onDidChangeModelContent(() => {
        files[activeFile].content = editorInstance.getValue();
        debouncedUpdatePreview();
    });

    // Initial Preview
    updatePreview();
});

// Switch Active File
function switchFile(fileName) {
    if (!editorInstance) return;

    // Save current state is handled by onDidChangeModelContent, 
    // but just to be safe we sync before switching
    files[activeFile].content = editorInstance.getValue();

    // Update UI
    document.querySelectorAll('.file-item, .tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`file-${getExt(fileName)}`).classList.add('active');
    document.getElementById(`tab-${getExt(fileName)}`).classList.add('active');

    // Update Logic
    activeFile = fileName;
    
    // Update Editor
    const file = files[fileName];
    monaco.editor.setModelLanguage(editorInstance.getModel(), file.language);
    editorInstance.setValue(file.content);
    document.getElementById('lang-display').innerText = file.language.toUpperCase();
}

function getExt(fileName) {
    if (fileName.includes('html')) return 'html';
    if (fileName.includes('css')) return 'css';
    if (fileName.includes('js')) return 'js';
    return '';
}

// Live Preview Logic
function updatePreview() {
    const html = files['index.html'].content;
    const css = files['style.css'].content;
    const js = files['script.js'].content;

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
            try {
                ${js}
            } catch (err) {
                console.error(err);
            }
        </script>
    </body>
    </html>
    `;

    const iframe = document.getElementById('preview-frame');
    iframe.srcdoc = source;
}

// Debounce to prevent flashing on every keypress
let timeout;
function debouncedUpdatePreview() {
    clearTimeout(timeout);
    timeout = setTimeout(updatePreview, 1000);
}

// Download Project as ZIP
function downloadProject() {
    const zip = new JSZip();
    zip.file("index.html", files['index.html'].content);
    zip.file("style.css", files['style.css'].content);
    zip.file("script.js", files['script.js'].content);

    zip.generateAsync({type:"blob"}).then(function(content) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = "my-website-project.zip";
        link.click();
    });
}