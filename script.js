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
const defaultSettings = {
    theme: 'vs-dark',
    cdns: [],
    wordWrap: false,
    minimap: true,
    fontSize: 14
};
let appSettings = { ...defaultSettings, ...(JSON.parse(localStorage.getItem('vscode-clone-settings')) || {}) };

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
    updateStatusBar();
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
                minimap: { enabled: appSettings.minimap },
                wordWrap: appSettings.wordWrap ? 'on' : 'off',
                fontSize: appSettings.fontSize,
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

    let lang = getLanguageForFile(name);

    files[name] = { name, language: lang, content: '' };
    saveProject();
    renderExplorer();
    switchFile(name);
}

function renameFile(name) {
    const newName = prompt("Rename file to:", name);
    if (!newName || newName === name) return;
    if (files[newName]) return toast("File already exists", "error");

    const file = files[name];
    delete files[name];
    file.name = newName;
    file.language = getLanguageForFile(newName);
    files[newName] = file;
    if (activeFile === name) activeFile = newName;
    saveProject();
    renderExplorer();
    renderTabs();
    switchFile(activeFile);
}

function duplicateFile(name) {
    const duplicateName = prompt("Duplicate file as:", `copy-${name}`);
    if (!duplicateName) return;
    if (files[duplicateName]) return toast("File already exists", "error");

    const file = files[name];
    files[duplicateName] = {
        name: duplicateName,
        language: getLanguageForFile(duplicateName),
        content: file.content
    };
    saveProject();
    renderExplorer();
    renderTabs();
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
            <div class="flex items-center opacity-0 group-hover:opacity-100">
                <button onclick="event.stopPropagation(); duplicateFile('${file.name}')" class="hover:text-blue-400 p-1" title="Duplicate">
                    <i data-lucide="copy" class="w-3 h-3"></i>
                </button>
                <button onclick="event.stopPropagation(); renameFile('${file.name}')" class="hover:text-yellow-400 p-1" title="Rename">
                    <i data-lucide="edit-3" class="w-3 h-3"></i>
                </button>
                ${file.name !== 'index.html' ? 
                    `<button onclick="event.stopPropagation(); deleteFile('${file.name}')" class="hover:text-red-400 p-1" title="Delete">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>` : ''}
            </div>
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

function persistSettings() {
    localStorage.setItem('vscode-clone-settings', JSON.stringify(appSettings));
    updateStatusBar();
}

function updateStatusBar() {
    const wrapStatus = document.getElementById('wrap-status');
    const fontStatus = document.getElementById('font-status');
    if (wrapStatus) wrapStatus.innerText = `Wrap: ${appSettings.wordWrap ? 'On' : 'Off'}`;
    if (fontStatus) fontStatus.innerText = `Font: ${appSettings.fontSize}px`;
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
    
    persistSettings();
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

function getLanguageForFile(name) {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'js') return 'javascript';
    if (ext === 'css') return 'css';
    if (ext === 'html') return 'html';
    if (ext === 'json') return 'json';
    if (ext === 'md') return 'markdown';
    return 'plaintext';
}

// --- COMMAND PALETTE ---
const commandDefinitions = [
    { id: 'file:new', label: 'File: New File', hint: 'Create a new file', action: () => promptNewFile() },
    { id: 'file:rename', label: 'File: Rename Active File', hint: 'Rename current file', action: () => renameFile(activeFile) },
    { id: 'file:duplicate', label: 'File: Duplicate Active File', hint: 'Create a copy', action: () => duplicateFile(activeFile) },
    { id: 'view:toggle-sidebar', label: 'View: Toggle Sidebar', hint: 'Show/hide explorer', action: () => toggleSidebar() },
    { id: 'view:toggle-console', label: 'View: Toggle Console', hint: 'Show/hide console', action: () => toggleConsole() },
    { id: 'editor:toggle-wrap', label: 'Editor: Toggle Word Wrap', hint: 'Wrap lines', action: () => toggleWordWrap() },
    { id: 'editor:toggle-minimap', label: 'Editor: Toggle Minimap', hint: 'Show/hide minimap', action: () => toggleMinimap() },
    { id: 'editor:font-increase', label: 'Editor: Increase Font Size', hint: 'Zoom in', action: () => adjustFontSize(1) },
    { id: 'editor:font-decrease', label: 'Editor: Decrease Font Size', hint: 'Zoom out', action: () => adjustFontSize(-1) },
    { id: 'editor:format', label: 'Editor: Format Document', hint: 'Format current file', action: () => formatDocument() },
    { id: 'editor:find', label: 'Editor: Find', hint: 'Search in file', action: () => editor?.trigger('keyboard', 'actions.find', null) },
    { id: 'editor:replace', label: 'Editor: Replace', hint: 'Search and replace', action: () => editor?.trigger('keyboard', 'editor.action.startFindReplaceAction', null) },
    { id: 'run:preview', label: 'Run: Update Preview', hint: 'Refresh preview', action: () => updatePreview() },
    { id: 'settings:open', label: 'Preferences: Open Settings', hint: 'Open settings modal', action: () => openSettingsModal() }
];
let filteredCommands = [...commandDefinitions];
let commandIndex = 0;

function openCommandPalette() {
    const modal = document.getElementById('command-modal');
    const input = document.getElementById('command-input');
    modal.classList.remove('hidden');
    input.value = '';
    filteredCommands = [...commandDefinitions];
    commandIndex = 0;
    renderCommandList();
    setTimeout(() => input.focus(), 0);
}

function closeCommandPalette() {
    document.getElementById('command-modal').classList.add('hidden');
}

function renderCommandList() {
    const list = document.getElementById('command-list');
    list.innerHTML = '';
    if (filteredCommands.length === 0) {
        list.innerHTML = '<div class="px-4 py-3 text-xs text-gray-500">No matching commands</div>';
        return;
    }
    filteredCommands.forEach((cmd, index) => {
        const item = document.createElement('div');
        item.className = `command-item ${index === commandIndex ? 'active' : ''}`;
        item.innerHTML = `<div>${cmd.label}</div><span>${cmd.hint}</span>`;
        item.onclick = () => runCommand(index);
        list.appendChild(item);
    });
}

function runCommand(index) {
    const cmd = filteredCommands[index];
    if (!cmd) return;
    closeCommandPalette();
    cmd.action();
}

function toggleWordWrap() {
    appSettings.wordWrap = !appSettings.wordWrap;
    editor?.updateOptions({ wordWrap: appSettings.wordWrap ? 'on' : 'off' });
    persistSettings();
    toast(`Word wrap ${appSettings.wordWrap ? 'enabled' : 'disabled'}`);
}

function toggleMinimap() {
    appSettings.minimap = !appSettings.minimap;
    editor?.updateOptions({ minimap: { enabled: appSettings.minimap } });
    persistSettings();
    toast(`Minimap ${appSettings.minimap ? 'enabled' : 'disabled'}`);
}

function adjustFontSize(delta) {
    const nextSize = Math.min(24, Math.max(10, appSettings.fontSize + delta));
    appSettings.fontSize = nextSize;
    editor?.updateOptions({ fontSize: appSettings.fontSize });
    persistSettings();
}

function formatDocument() {
    const action = editor?.getAction('editor.action.formatDocument');
    if (action) {
        action.run();
    }
}

document.addEventListener('keydown', (event) => {
    const isPaletteOpen = !document.getElementById('command-modal').classList.contains('hidden');
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyP') {
        event.preventDefault();
        openCommandPalette();
        return;
    }
    if (!isPaletteOpen) return;

    if (event.key === 'Escape') {
        event.preventDefault();
        closeCommandPalette();
    }
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        commandIndex = Math.min(filteredCommands.length - 1, commandIndex + 1);
        renderCommandList();
    }
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        commandIndex = Math.max(0, commandIndex - 1);
        renderCommandList();
    }
    if (event.key === 'Enter') {
        event.preventDefault();
        runCommand(commandIndex);
    }
});

document.getElementById('command-input').addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase();
    filteredCommands = commandDefinitions.filter(cmd => cmd.label.toLowerCase().includes(query));
    commandIndex = 0;
    renderCommandList();
});

document.getElementById('command-modal').addEventListener('click', (event) => {
    if (event.target.id === 'command-modal') {
        closeCommandPalette();
    }
});

// --- BOOT ---
init();
