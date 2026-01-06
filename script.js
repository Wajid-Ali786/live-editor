// --- ICONS & INITIALIZATION ---
lucide.createIcons();

// --- STATE MANAGEMENT ---
const DEFAULT_PROJECT = {
    'index.html': { name: 'index.html', language: 'html', content: '<h1>Hello World</h1>' },
    'style.css': { name: 'style.css', language: 'css', content: 'body { font-family: sans-serif; padding: 20px; } h1 { color: #007acc; }' },
    'script.js': { name: 'script.js', language: 'javascript', content: 'console.log("System Ready");' }
};

let files = {};
let activeFile = 'index.html';
let editor = null;
let appSettings = JSON.parse(localStorage.getItem('vscode-clone-settings')) || {
    theme: 'vs-dark',
    cdns: []
};

// --- STARTUP LOGIC ---
async function init() {
    // 1. Check URL for shared project
    if (window.location.hash.length > 5) {
        try {
            const compressed = window.location.hash.substring(1);
            const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
            if (decompressed) {
                files = JSON.parse(decompressed);
                toast("Project loaded from URL");
            } else {
                throw new Error("Invalid URL");
            }
        } catch (e) {
            console.error(e);
            toast("Failed to load shared project", "error");
            files = loadLocal();
        }
    } else {
        files = loadLocal();
    }

    // 2. Initialize UI
    renderExplorer();
    renderTabs();
    initSplitPane();
    
    // 3. Initialize Monaco
    await initMonaco();
    
    // 4. Run Preview
    updatePreview();
    
    // 5. Restore Settings
    document.getElementById('cdn-input').value = appSettings.cdns.join('\n');
    document.getElementById('theme-select').value = appSettings.theme;
}

function loadLocal() {
    const saved = localStorage.getItem('vscode-clone-project');
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_PROJECT));
}

// --- MONACO EDITOR ---
async function initMonaco() {
    return new Promise(resolve => {
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
        require(['vs/editor/editor.main'], function () {
            document.getElementById('editor-loading').style.display = 'none';
            
            editor = monaco.editor.create(document.getElementById('monaco-editor-container'), {
                value: files[activeFile].content,
                language: files[activeFile].language,
                theme: appSettings.theme,
                automaticLayout: true,
                minimap: { enabled: true },
                fontSize: 14,
                fontFamily: '"Fira Code", "Menlo", "Monaco", monospace',
                fontLigatures: true,
                padding: { top: 16 }
            });

            // Events
            editor.onDidChangeModelContent(() => {
                files[activeFile].content = editor.getValue();
                saveProject();
                debouncedUpdatePreview();
            });
            
            editor.onDidChangeCursorPosition((e) => {
                document.getElementById('cursor-position').innerText = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
            });

            // Add Command: Ctrl+S
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                saveProject();
                toast("Saved successfully");
            });

            resolve();
        });
    });
}

// --- FILE MANAGEMENT ---
function promptNewFile() {
    const name = prompt("Enter file name (e.g., utils.js, card.css):");
    if (!name) return;
    if (files[name]) return toast("File already exists", "error");

    const ext = name.split('.').pop();
    let lang = 'plaintext';
    if (ext === 'js') lang = 'javascript';
    if (ext === 'css') lang = 'css';
    if (ext === 'html') lang = 'html';

    files[name] = { name, language: lang, content: '' };
    saveProject();
    renderExplorer();
    switchFile(name);
}

function deleteFile(name) {
    if (Object.keys(files).length <= 1) return toast("Cannot delete the last file", "error");
    if (!confirm(`Delete ${name}?`)) return;

    delete files[name];
    if (activeFile === name) {
        switchFile(Object.keys(files)[0]);
    } else {
        renderExplorer();
        renderTabs();
    }
    saveProject();
}

function switchFile(name) {
    if (!editor) return;
    activeFile = name;
    
    // Update Model
    const file = files[name];
    const model = editor.getModel();
    monaco.editor.setModelLanguage(model, file.language);
    editor.setValue(file.content);
    
    // Update UI
    renderExplorer();
    renderTabs();
    document.getElementById('lang-display').innerText = file.language.toUpperCase();
}

// --- RENDERING UI ---
function renderExplorer() {
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    
    Object.values(files).forEach(file => {
        const div = document.createElement('div');
        div.className = `file-item ${activeFile === file.name ? 'active' : ''} group justify-between`;
        div.onclick = () => switchFile(file.name);
        
        let icon = 'file';
        let color = 'text-gray-400';
        if (file.name.endsWith('.html')) { icon = 'file-code'; color = 'text-orange-500'; }
        if (file.name.endsWith('.css')) { icon = 'file-type'; color = 'text-blue-400'; }
        if (file.name.endsWith('.js')) { icon = 'file-json'; color = 'text-yellow-400'; }

        div.innerHTML = `
            <div class="flex items-center">
                <i data-lucide="${icon}" class="w-4 h-4 ${color} mr-2"></i>
                <span class="truncate w-32">${file.name}</span>
            </div>
            ${file.name !== 'index.html' ? 
                `<button onclick="event.stopPropagation(); deleteFile('${file.name}')" class="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>` : ''}
        `;
        list.appendChild(div);
    });
    lucide.createIcons();
}

function renderTabs() {
    const list = document.getElementById('tab-list');
    list.innerHTML = '';
    
    Object.values(files).forEach(file => {
        const div = document.createElement('div');
        div.className = `tab ${activeFile === file.name ? 'active' : ''}`;
        div.onclick = () => switchFile(file.name);
        
        let icon = 'file';
        let color = 'text-gray-400';
        if (file.name.endsWith('.html')) { icon = 'file-code'; color = 'text-orange-500'; }
        if (file.name.endsWith('.css')) { icon = 'file-type'; color = 'text-blue-400'; }
        if (file.name.endsWith('.js')) { icon = 'file-json'; color = 'text-yellow-400'; }

        div.innerHTML = `
            <i data-lucide="${icon}" class="w-3.5 h-3.5 ${color} mr-2"></i>
            <span>${file.name}</span>
        `;
        list.appendChild(div);
    });
    lucide.createIcons();
}

// --- PREVIEW BUILDER ---
function updatePreview() {
    const htmlFile = files['index.html'] || Object.values(files).find(f => f.name.endsWith('.html'));
    if (!htmlFile) return;

    // Collect all CSS and JS
    let cssContent = '';
    let jsContent = '';
    
    Object.values(files).forEach(f => {
        if (f.name.endsWith('.css')) cssContent += f.content + '\n';
        if (f.name.endsWith('.js')) jsContent += `
            try {
                ${f.content}
            } catch(e) { console.error(e); }
        \n`;
    });

    // CDNs
    const cdnTags = appSettings.cdns.map(url => {
        if (url.endsWith('.css')) return `<link rel="stylesheet" href="${url}">`;
        return `<script src="${url}"><\/script>`;
    }).join('\n');

    const source = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${cdnTags}
        <style>
            ${cssContent}
        </style>
        <script>
            // Console Proxy
            (function(){
                const _log = console.log;
                const _warn = console.warn;
                const _error = console.error;
                
                console.log = function(...args) { 
                    window.parent.postMessage({type:'console', level:'log', args}, '*'); 
                    _log.apply(console, args);
                };
                console.warn = function(...args) { 
                    window.parent.postMessage({type:'console', level:'warn', args}, '*'); 
                    _warn.apply(console, args);
                };
                console.error = function(...args) { 
                    window.parent.postMessage({type:'console', level:'error', args}, '*'); 
                    _error.apply(console, args);
                };
            })();
        <\/script>
    </head>
    <body>
        ${htmlFile.content}
        <script>
            ${jsContent}
        <\/script>
    </body>
    </html>
    `;

    document.getElementById('preview-frame').srcdoc = source;
}

// --- UTILITIES ---
function saveProject() {
    localStorage.setItem('vscode-clone-project', JSON.stringify(files));
    document.getElementById('save-indicator').style.opacity = 1;
    setTimeout(() => document.getElementById('save-indicator').style.opacity = 0.5, 500);
}

// Split Pane
function initSplitPane() {
    Split(['#editor-pane', '#preview-pane'], {
        sizes: [50, 50],
        minSize: 100,
        gutterSize: 8,
        cursor: 'col-resize'
    });
}

// Debounce
let debounceTimer;
function debouncedUpdatePreview() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updatePreview, 1000);
}

// Toast Notification
function toast(msg, type = 'info') {
    Toastify({
        text: msg,
        duration: 3000,
        gravity: "bottom", 
        position: "right", 
        backgroundColor: type === 'error' ? "#ff5555" : "#007acc",
    }).showToast();
}

// Console Handling
window.addEventListener('message', (e) => {
    if (e.data.type === 'console') {
        const output = document.getElementById('console-output');
        const line = document.createElement('div');
        line.className = `log-entry ${e.data.level}`;
        line.textContent = `> ${e.data.args.join(' ')}`;
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }
});

function clearConsole() {
    document.getElementById('console-output').innerHTML = '';
}

function toggleConsole() {
    const p = document.getElementById('console-panel');
    p.classList.toggle('hidden');
}

// --- MODALS & FEATURES ---
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('transform');
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
}

function openSettingsModal() { document.getElementById('settings-modal').classList.remove('hidden'); }
function openTemplateModal() { document.getElementById('templates-modal').classList.remove('hidden'); }
function closeModals() { 
    document.getElementById('settings-modal').classList.add('hidden'); 
    document.getElementById('templates-modal').classList.add('hidden'); 
}

function saveSettings() {
    const theme = document.getElementById('theme-select').value;
    const cdnText = document.getElementById('cdn-input').value;
    
    appSettings.theme = theme;
    appSettings.cdns = cdnText.split('\n').filter(l => l.trim().length > 0);
    
    localStorage.setItem('vscode-clone-settings', JSON.stringify(appSettings));
    monaco.editor.setTheme(theme);
    updatePreview();
    closeModals();
    toast("Settings Saved");
}

function generateShareUrl() {
    const str = JSON.stringify(files);
    const compressed = LZString.compressToEncodedURIComponent(str);
    window.location.hash = compressed;
    navigator.clipboard.writeText(window.location.href);
    toast("URL copied to clipboard!");
}

function downloadProject() {
    const zip = new JSZip();
    Object.values(files).forEach(f => zip.file(f.name, f.content));
    zip.generateAsync({type:"blob"}).then(blob => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "project.zip";
        link.click();
    });
}

function loadTemplate(type) {
    if (!confirm("This will overwrite your current work. Continue?")) return;
    
    if (type === 'vanilla') files = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    
    if (type === 'react') {
        files = {
            'index.html': { name: 'index.html', language: 'html', content: '<div id="root"></div>' },
            'style.css': { name: 'style.css', language: 'css', content: 'body { font-family: sans-serif; padding: 20px; }' },
            'script.js': { name: 'script.js', language: 'javascript', content: 'const root = ReactDOM.createRoot(document.getElementById("root"));\nroot.render(<h1>Hello React!</h1>);' }
        };
        appSettings.cdns = [
            'https://unpkg.com/react@18/umd/react.development.js',
            'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
            'https://unpkg.com/@babel/standalone/babel.min.js'
        ];
        // Note: For Babel to work in preview, we might need <script type="text/babel">. 
        // This simple implementation injects JS as normal script. 
        // A full React implementation usually needs a bundler or specific iframe handling.
        // We will stick to simple injection for now, React users might need to manually adjust types in this basic environment.
    }

    if (type === 'tailwind') {
        files = {
            'index.html': { name: 'index.html', language: 'html', content: '<div class="h-screen flex items-center justify-center bg-gray-900">\n  <h1 class="text-4xl font-bold text-blue-500">Hello Tailwind</h1>\n</div>' },
            'style.css': { name: 'style.css', language: 'css', content: '' },
            'script.js': { name: 'script.js', language: 'javascript', content: '' }
        };
        appSettings.cdns = ['https://cdn.tailwindcss.com'];
    }

    if (type === 'three') {
        files = {
            'index.html': { name: 'index.html', language: 'html', content: '<style>body { margin: 0; }</style>' },
            'style.css': { name: 'style.css', language: 'css', content: '' },
            'script.js': { name: 'script.js', language: 'javascript', content: 'const scene = new THREE.Scene();\nconst camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);\nconst renderer = new THREE.WebGLRenderer();\nrenderer.setSize(window.innerWidth, window.innerHeight);\ndocument.body.appendChild(renderer.domElement);\nconst geometry = new THREE.BoxGeometry();\nconst material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });\nconst cube = new THREE.Mesh(geometry, material);\nscene.add(cube);\ncamera.position.z = 5;\nfunction animate() { requestAnimationFrame(animate); cube.rotation.x += 0.01; cube.rotation.y += 0.01; renderer.render(scene, camera); }\nanimate();' }
        };
        appSettings.cdns = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'];
    }

    closeModals();
    saveProject();
    saveSettings(); // To save CDNs
    init(); // Reload
}

// --- BOOT ---
init();