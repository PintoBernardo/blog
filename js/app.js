let currentPath = '/';
let manifest = { articles: [], folders: [] };
let extraMetadata = { folders: {}, blogName: "Bernardo's Blog", quickLinks: [], defaults: {} };
let selectedTags = new Set();
let selectedAuthors = new Set();
let folderTree = {}; 
let expandedFolders = new Set(); 
let codeBlockStore = {}; // Store raw code by ID 

// Global copy function for code blocks
function copyCode(btn, blockId) {
    const rawCode = codeBlockStore[blockId];
    
    if (!rawCode) {
        showToast('Failed to copy');
        return;
    }
    
    navigator.clipboard.writeText(rawCode).then(() => {
        showToast('Copied to clipboard!');
    }).catch(() => {
        showToast('Failed to copy');
    });
}

// Toast notification
function showToast(message) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm rounded-full shadow-lg z-50 animate-fade-in';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 2000);
}

// --- Prism.js Configuration ---
// Ensure Prism.js and its languages are loaded globally.
// For demonstration, we'll assume common languages are available.
// In a real-world scenario, you might need to dynamically load Prism language files
// or include them in your build process.
// We'll add a check to ensure Prism and its languages are ready.
if (typeof Prism === 'undefined') {
    console.error("Prism.js is not loaded. Code highlighting and other features will not work.");
} else {
    // Load common languages if not already loaded. This is a basic approach.
    // A more robust solution might involve dynamic imports or a specific Prism build.
    // Example: Ensure JavaScript, CSS, Bash, Python languages are available.
    if (!Prism.languages.javascript) Prism.languages.javascript = Prism.languages.extend('javascript', {});
    if (!Prism.languages.css) Prism.languages.css = Prism.languages.extend('css', {});
    if (!Prism.languages.bash) Prism.languages.bash = Prism.languages.extend('bash', {});
    if (!Prism.languages.python) Prism.languages.python = Prism.languages.extend('python', {});
    if (!Prism.languages.plaintext) Prism.languages.plaintext = Prism.languages.extend('plaintext', {}); // Ensure plaintext is defined
}

// Enable Prism.js plugins if available
if (typeof Prism !== 'undefined') {
    if (Prism.plugins && Prism.plugins.lineNumbers) {
        Prism.plugins.lineNumbers.toggle = true; // Enable line numbers by default
    }
    // You might need to ensure prism-line-numbers.js and prism-line-numbers.css are loaded.
}

async function init() {
    console.log("Initializing Bernardo's Blog...");
    
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
    }

    await loadManifest();
    await loadExtraMetadata();
    buildFolderTree();
    
    document.title = extraMetadata.blogName;
    renderTags();
    renderAuthors();
    setupEventListeners();
    setupPrism(); // Call setupPrism to ensure Prism is ready

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1) || '/';
        renderPath(hash);
    });

    const initialHash = window.location.hash.substring(1) || '/';
    renderPath(initialHash);
}

function setupPrism() {
    // This function is now mainly a placeholder, as Prism setup is done globally
    // and highlightAll is called in renderArticle.
    // If more specific Prism setup is needed, it can be added here.
    console.log("Prism setup complete (global config applied).");
}

async function loadManifest() {
    try {
        const response = await fetch('posts.json?t=' + Date.now());
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        manifest = await response.json();
    } catch (e) {
        console.error("Failed to load manifest:", e);
        document.getElementById('mainContent').innerHTML = `<div class="max-w-lg mx-auto mt-20 p-10 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-[2rem] text-center"><i data-lucide="alert-circle" class="w-10 h-10 text-red-500 mx-auto mb-4"></i><p class="text-lg font-bold text-red-600 dark:text-red-400">Failed to load manifest.</p><p class="text-sm text-red-400 dark:text-red-500 mt-2">Please check your connection and try again.</p></div>`;
    }
}

async function loadExtraMetadata() {
    try {
        const response = await fetch('extra.xml?t=' + Date.now());
        if (!response.ok) return; // Silently fail if extra.xml is not found
        const text = await response.text();
        const xml = new DOMParser().parseFromString(text, "text/xml");
        extraMetadata.blogName = xml.getElementsByTagName("blogName")[0]?.textContent || "Bernardo's Blog";
        
        const folders = xml.getElementsByTagName("folder");
        for (let f of folders) {
            const name = f.getAttribute("name");
            if (name) {
                extraMetadata.folders[name] = {
                    color: f.getElementsByTagName("color")[0]?.textContent,
                    icon: f.getElementsByTagName("icon")[0]?.textContent
                };
            }
        }
        
        const links = xml.getElementsByTagName("link");
        extraMetadata.quickLinks = Array.from(links).map(l => ({
            name: l.getAttribute("name"),
            url: l.getAttribute("url"),
            icon: l.getAttribute("icon")
        }));

        const defaultsNode = xml.getElementsByTagName("defaults")[0];
        if (defaultsNode) {
            const getXmlText = (node, ...tags) => {
                for (const tag of tags) {
                    const el = node.getElementsByTagName(tag)[0];
                    if (el) return el.textContent;
                    // Try lowercase
                    const elLower = node.getElementsByTagName(tag.toLowerCase())[0];
                    if (elLower) return elLower.textContent;
                }
                return undefined;
            };
            extraMetadata.defaults = {
                bgcolor: getXmlText(defaultsNode, "bgcolor"),
                bgcolorLight: getXmlText(defaultsNode, "bgcolorLight"),
                bgcolorDark: getXmlText(defaultsNode, "bgcolorDark"),
                textColor: getXmlText(defaultsNode, "textColor"),
                textColorLight: getXmlText(defaultsNode, "textLight"),
                textColorDark: getXmlText(defaultsNode, "textDark"),
                overlayLight: getXmlText(defaultsNode, "overlayLight", "light"),
                overlayDark: getXmlText(defaultsNode, "overlayDark", "dark"),
                fontFamily: getXmlText(defaultsNode, "font", "family", "fontFamily"),
                fontWeight: getXmlText(defaultsNode, "fontWeight", "weight")
            };
        }
    } catch (e) {
        console.error("Error loading extra metadata:", e);
    }
}

function getFolderMeta(folderPath) {
    const parts = folderPath.split('/');
    for (let i = parts.length; i >= 1; i--) {
        const path = parts.slice(0, i).join('/');
        if (extraMetadata.folders[path]) return extraMetadata.folders[path];
    }
    // Check for single-part folder names if path-based lookup fails
    for (let i = parts.length - 1; i >= 0; i--) {
        const name = parts[i];
        if (extraMetadata.folders[name]) return extraMetadata.folders[name];
    }
    return {};
}

function buildFolderTree() {
    folderTree = { name: 'Root', path: '', children: {}, articles: [] };
    
    // Ensure all folders used by articles exist, and add articles to them
    // This also implicitly creates folders if they only exist via articles
    (manifest.articles || []).forEach(art => {
        let current = folderTree;
        let p = '';
        art.folder.split('/').forEach(part => {
            p = p ? `${p}/${part}` : part;
            if (!current.children[part]) {
                current.children[part] = { name: part, path: p, children: {}, articles: [] };
            }
            current = current.children[part];
        });
        current.articles.push(art);
    });

    // Explicitly add folders from manifest.folders if they weren't created by articles
    (manifest.folders || []).forEach(fPath => {
        let current = folderTree;
        let p = '';
        fPath.split('/').forEach(part => {
            p = p ? `${p}/${part}` : part;
            if (!current.children[part]) {
                current.children[part] = { name: part, path: p, children: {}, articles: [] };
            }
            current = current.children[part];
        });
    });
}

function matchesFilters(art) {
    const matchesTags = selectedTags.size === 0 || Array.from(selectedTags).every(t => art.tags?.includes(t));
    const matchesAuthors = selectedAuthors.size === 0 || Array.from(selectedAuthors).some(a => art.authors?.includes(a));
    return matchesTags && matchesAuthors;
}

function renderPath(path) {
    currentPath = path;
    const pathEl = document.getElementById('currentPath');
    if (pathEl) pathEl.textContent = path;

    const parts = path.split('/').filter(p => p);
    
    if (path === '/' || path === '') {
        renderHome();
    } else if (parts[0] === 'articles') {
        const remaining = parts.slice(1);
        const postIds = manifest.articles.map(a => a.id);
        const last = remaining[remaining.length - 1];

        if ((selectedTags.size > 0 || selectedAuthors.size > 0) && path === '/articles') {
            renderTagTree();
        } else if (postIds.includes(last)) {
            // It's an article
            renderArticle(last, remaining.slice(0, -1).join('/'));
        } else {
            // It's a folder
            renderFolder(remaining.join('/'));
        }
    }
    
    renderSidebar();
    lucide.createIcons();
}

function renderSidebar() {
    const list = document.getElementById('folderList');
    if (!list) return;
    list.innerHTML = '';

    const hasMatchingContent = (node) => {
        return node.articles.some(a => matchesFilters(a)) || 
               Object.values(node.children).some(c => hasMatchingContent(c));
    };

    const renderNodes = (node, parent, depth = 0) => {
        // Folders
        Object.values(node.children).sort((a,b) => a.name.localeCompare(b.name)).forEach(child => {
            if (!hasMatchingContent(child)) return;

            const open = expandedFolders.has(child.path);
            const active = currentPath === `/articles/${child.path}`;

            const row = document.createElement('div');
            row.className = `group flex items-center py-1 px-1 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-bold' : 'text-slate-600 dark:text-slate-400'}`;
            row.style.paddingLeft = `${depth * 12}px`;

            const hasSub = Object.keys(child.children).length > 0 || child.articles.some(a => matchesFilters(a));
            if (hasSub) {
                const chev = document.createElement('button');
                chev.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform ${open ? 'rotate-90' : ''}"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
                chev.className = "w-4 h-4 flex items-center justify-center shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200";
                chev.onclick = (e) => {
                    e.stopPropagation();
                    if (open) expandedFolders.delete(child.path);
                    else expandedFolders.add(child.path);
                    renderSidebar();
                };
                row.appendChild(chev);
            } else {
                row.appendChild(Object.assign(document.createElement('div'), { className: "w-4" }));
            }

            const meta = getFolderMeta(child.path);
            const icon = document.createElement('i');
            icon.dataset.lucide = open ? "folder-open" : "folder";
            icon.style.color = meta.color || '#3b82f6'; // Default folder color
            icon.className = "w-4 h-4 mr-1.5 shrink-0";
            row.appendChild(icon);

            const name = document.createElement('span');
            name.className = "text-sm truncate font-medium";
            name.textContent = child.name;

            row.onclick = () => window.location.hash = `/articles/${child.path}`;
            row.appendChild(name);
            parent.appendChild(row);

            if (open) renderNodes(child, parent, depth + 1);
        });

        // Articles
        node.articles.sort((a,b) => a.title.localeCompare(b.title)).forEach(art => {
            if (!matchesFilters(art)) return;

            const active = currentPath.endsWith(`/${art.id}`);
            const row = document.createElement('div');
            row.className = `flex items-center py-1 px-1 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-bold' : 'text-slate-500 dark:text-slate-500'}`;
            row.style.paddingLeft = `${depth * 12 + 16}px`;

            const icon = document.createElement('i');
            icon.dataset.lucide = "file-text";
            icon.className = "w-3.5 h-3.5 mr-1.5 shrink-0 text-slate-400";

            const name = document.createElement('span');
            name.className = "text-sm truncate";
            name.textContent = art.title;

            row.onclick = () => window.location.hash = `/articles/${art.folder}/${art.id}`;
            row.appendChild(icon);
            row.appendChild(name);
            parent.appendChild(row);
        });
    };

    renderNodes(folderTree, list);
    lucide.createIcons();
}

function renderHome() {
    const main = document.getElementById('mainContent');
    const pinned = manifest.articles.filter(a => a.pinned && matchesFilters(a));
    const latest = [...manifest.articles].filter(a => matchesFilters(a)).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    
    main.innerHTML = `
        <div class="max-w-5xl mx-auto">
            <header class="mb-8">
                <h1 class="text-6xl font-black text-slate-900 dark:text-white tracking-tighter">${extraMetadata.blogName}</h1>
                <p class="text-xl text-slate-400 mt-2 font-medium">Software, Engineering & Personal Log.</p>
            </header>

            ${pinned.length > 0 ? `
            <section class="mb-24">
                <h2 class="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 mb-10 flex items-center gap-3">
                    <span class="w-10 h-px bg-blue-100"></span> Pinned Posts
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${pinned.map(p => renderPinnedCard(p)).join('')}
                </div>
            </section>` : ''}

            <section>
                <h2 class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-10 flex items-center gap-3">
                    <span class="w-10 h-px bg-slate-100"></span> Recent Activity
                </h2>
                <div class="grid grid-cols-1 gap-4">
                    ${latest.map(p => renderPostCard(p)).join('')}
                </div>
            </section>
        </div>
    `;
    lucide.createIcons();
}

function renderPinnedCard(p) {
    // Changed 'Featured' to be conditional on p.pinned for clarity, though it's already filtered.
    // Styling for the "Featured" badge is here.
    return `
        <div onclick="window.location.hash='/articles/${p.folder}/${p.id}'" class="group relative p-8 rounded-[2.5rem] bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-white cursor-pointer shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all overflow-hidden border border-slate-200 dark:border-slate-700/50">
            <div class="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/20 dark:bg-blue-500/20 rounded-full blur-3xl transition-all"></div>
            <div class="relative z-10">
                <div class="flex items-center gap-3 mb-5">
                    ${p.pinned ? `<span class="px-2.5 py-1 bg-blue-600/80 text-[9px] font-black uppercase tracking-widest rounded-full">Featured</span>` : ''}
                    <span class="text-[10px] text-slate-400 uppercase tracking-widest">${new Date(p.date).toLocaleDateString()}</span>
                </div>
                <h3 class="text-2xl font-black leading-tight text-slate-900 dark:text-white">${p.title}</h3>
                <div class="mt-4 flex flex-wrap gap-2 text-[9px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">
                    ${(p.authors || []).map(a => `<span>@${a}</span>`).join(' ')}
                </div>
            </div>
        </div>
    `;
}

function renderPostCard(p) {
    return `
        <div onclick="window.location.hash='/articles/${p.folder}/${p.id}'" class="group flex items-center gap-6 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl cursor-pointer hover:border-blue-500 transition-all">
            <div class="w-14 h-14 flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:bg-blue-50 transition-colors">
                <i data-lucide="file-text" class="w-7 h-7 text-slate-400 group-hover:text-blue-500"></i>
            </div>
            <div class="flex-1">
                <h3 class="text-xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">${p.title}</h3>
                <div class="flex flex-wrap items-center gap-3 mt-2">
                    <div class="flex gap-2 text-[10px] font-bold text-blue-500/70 uppercase tracking-widest">
                        ${(p.authors || []).map(a => `<span>@${a}</span>`).join(' ')}
                    </div>
                    <div class="w-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                    <div class="flex gap-2">
                        ${(p.tags || []).map(t => `<span class="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">#${t}</span>`).join('')}
                    </div>
                </div>
            </div>
            <div class="hidden md:block text-right text-xs font-black text-slate-300 uppercase tracking-widest">
                ${new Date(p.date).toLocaleDateString()}
            </div>
        </div>
    `;
}

function renderFolder(path) {
    const main = document.getElementById('mainContent');
    if (path === '' || path === '/') {
        // Render all articles if the path is root
        main.innerHTML = `<div class="max-w-5xl mx-auto"><div class="mb-8"><h1 class="text-5xl font-black uppercase tracking-tighter">All Articles</h1></div><div class="grid grid-cols-1 gap-4">${manifest.articles.filter(a => matchesFilters(a)).map(p => renderPostCard(p)).join('')}</div></div>`;
        lucide.createIcons();
        return;
    }

    let current = folderTree;
    path.split('/').forEach(p => {
        if (current && current.children && current.children[p]) {
            current = current.children[p];
        } else {
            current = null; // Folder not found
        }
    });
    if (!current) {
        main.innerHTML = `<p class="text-center text-slate-500 mt-20">Folder not found.</p>`;
        return;
    }

    const subs = Object.values(current.children).filter(s => s.articles.some(a => matchesFilters(a)) || Object.keys(s.children).length > 0);
    const posts = current.articles.filter(a => matchesFilters(a));

    main.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <div class="mb-8"><h1 class="text-5xl font-black uppercase tracking-tighter">${current.name}</h1></div>
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-8">
                ${subs.map(s => `
                    <div onclick="window.location.hash='/articles/${s.path}'" class="flex flex-col items-center group cursor-pointer">
                        <div class="w-full aspect-square flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-[2rem] border-2 border-transparent group-hover:border-blue-500 transition-all shadow-sm">
                            <i data-lucide="folder" class="w-12 h-12 text-blue-400/40"></i>
                        </div>
                        <span class="text-[11px] font-bold mt-4 uppercase text-slate-500 group-hover:text-blue-600 tracking-widest">${s.name}</span>
                    </div>`).join('')}
                ${posts.map(p => `
                    <div onclick="window.location.hash='/articles/${p.folder}/${p.id}'" class="flex flex-col items-center group cursor-pointer">
                        <div class="w-full aspect-square flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] border-2 border-transparent group-hover:border-blue-500 transition-all shadow-sm">
                            <i data-lucide="file-text" class="w-10 h-10 text-slate-300 group-hover:text-blue-500"></i>
                        </div>
                        <span class="text-[10px] font-bold mt-4 uppercase text-center line-clamp-2 px-2">${p.title}</span>
                    </div>`).join('')}
            </div>
        </div>
    `;
    lucide.createIcons();
}

async function renderArticle(id) {
    const main = document.getElementById('mainContent');
    const p = manifest.articles.find(a => a.id === id);
    if (!p) {
        main.innerHTML = `<p class="text-center text-slate-500 mt-20">Article not found.</p>`;
        return;
    }
    
    let articleMeta = {};
    const folderParts = p.folder.split('/');
    
    const getXmlText = (node, ...tags) => {
        for (const tag of tags) {
            const el = node.getElementsByTagName(tag)[0];
            if (el) return el.textContent;
            const elLower = node.getElementsByTagName(tag.toLowerCase())[0];
            if (elLower) return elLower.textContent;
        }
        return undefined;
    };

    // Try to find article.xml in the same directory as the markdown file
    const articleDir = p.path.replace(/\/[^/]+$/, ''); // Path relative to 'articles/'
    const articleDirParts = articleDir.split('/');
    try {
        const res = await fetch(`articles/${articleDir}/article.xml`);
        if (res.ok) {
            const xmlText = await res.text();
            const xml = new DOMParser().parseFromString(xmlText, "text/xml");
            articleMeta = {
                bgColor: getXmlText(xml, "bgcolor", "bgColor"),
                bgLight: getXmlText(xml, "bgLight"),
                bgDark: getXmlText(xml, "bgDark"),
                textColor: getXmlText(xml, "textColor"),
                textLight: getXmlText(xml, "textLight"),
                textDark: getXmlText(xml, "textDark"),
                overlayLight: getXmlText(xml, "overlayLight", "light"),
                overlayDark: getXmlText(xml, "overlayDark", "dark"),
                fontFamily: getXmlText(xml, "family", "fontFamily", "font"),
                fontWeight: getXmlText(xml, "fontWeight", "weight")
            };
        }
    } catch (e) {
        console.log(`article.xml not found in ${articleDir}/article.xml`, e);
    }

    // Fall back to parent folder article.xml if not found in article dir
    if (!articleMeta.fontFamily) { // Check if essential metadata like fontFamily is missing
        for (let i = articleDirParts.length - 1; i >= 1; i--) {
            const folderPath = articleDirParts.slice(0, i).join('/');
            try {
                const metaRes = await fetch(`articles/${folderPath}/article.xml`);
                if (metaRes.ok) {
                    const xmlText = await metaRes.text();
                    const xml = new DOMParser().parseFromString(xmlText, "text/xml");
                    articleMeta = {
                        bgColor: getXmlText(xml, "bgcolor", "bgColor"),
                        bgLight: getXmlText(xml, "bgLight"),
                        bgDark: getXmlText(xml, "bgDark"),
                        textColor: getXmlText(xml, "textColor"),
                        textLight: getXmlText(xml, "textLight"),
                        textDark: getXmlText(xml, "textDark"),
                        overlayLight: getXmlText(xml, "overlayLight", "light"),
                        overlayDark: getXmlText(xml, "overlayDark", "dark"),
                        fontFamily: getXmlText(xml, "family", "fontFamily", "font"),
                        fontWeight: getXmlText(xml, "fontWeight", "weight")
                    };
                    break; // Found metadata, stop searching parent folders
                }
            } catch (e) {
                console.log(`article.xml not found in articles/${folderPath}/article.xml`, e);
            }
        }
    }
    
    const isDark = document.documentElement.classList.contains('dark');
    
    const hasArticleBg = Boolean(articleMeta.bgColor || articleMeta.bgLight || articleMeta.bgDark);
    const hasArticleText = Boolean(articleMeta.textColor || articleMeta.textLight || articleMeta.textDark);
    const hasArticleOverlay = Boolean(articleMeta.overlayLight || articleMeta.overlayDark);

    const bgColor = isDark
        ? (articleMeta.bgDark || '')
        : (articleMeta.bgLight || articleMeta.bgColor || '');
    const textColor = isDark
        ? (articleMeta.textDark || '')
        : (articleMeta.textLight || articleMeta.textColor || '');

    const finalBgStyle = hasArticleBg && bgColor ? `background-color: ${bgColor};` : '';
    const finalTextColorStyle = hasArticleText && textColor ? `color: ${textColor};` : '';

    // Use article-specific text colors when provided. Otherwise let CSS handle default theme styling.
    const linkColor = isDark ? (articleMeta.textDark || '#60a5fa') : (articleMeta.textLight || '#3b82f6');
    
    const overlayColor = hasArticleOverlay
        ? (isDark ? (articleMeta.overlayDark || '') : (articleMeta.overlayLight || ''))
        : '';
    
    const customFontFamily = articleMeta.fontFamily || extraMetadata.defaults?.fontFamily || 'Georgia, Cambria, "Times New Roman", Times, serif';
    const customFontWeight = articleMeta.fontWeight || extraMetadata.defaults?.fontWeight || '400';
    const customStyle = `font-family: ${customFontFamily}; font-weight: ${customFontWeight};`;

    try {
        const res = await fetch(`articles/${p.path}`);
        if (!res.ok) throw new Error(`Failed to fetch article: ${p.path}, Status: ${res.status}`);
        const md = await res.text();
        
        // --- Custom Marked Renderer ---
        const renderer = new marked.Renderer();
        
        // Image Renderer
        renderer.image = (href, title, text) => {
            let src = typeof href === 'object' ? href.href : href;
            let sizeStyle = '';
            
            const sizeMatch = src?.match(/=(\d+)(?:x(\d+))?$/);
            if (sizeMatch) {
                src = src.replace(/=(\d+)(?:x(\d+))?$/, '');
                const width = sizeMatch[1];
                const height = sizeMatch[2];
                if (width && height) {
                    sizeStyle = `width: ${width}px; height: ${height}px;`;
                } else if (width) {
                    sizeStyle = `width: ${width}px;`;
                }
            }
            
            if (src && !src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) src = `articles/${p.folder}/${src}`;
            if (src?.includes('/assets/icon/')) src = src.replace('/assets/icon/', '/assets/icons/');
            return `<div class="my-10 flex flex-col items-center">
                        <img src="${src}" alt="${text || ''}" style="${sizeStyle}" class="rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 transition-all hover:scale-[1.01]${sizeStyle ? '' : ' max-w-full'}">
                        ${text ? `<span class="mt-4 text-xs font-medium text-slate-400 italic">― ${text}</span>` : ''}
                    </div>`;
        };

// Code Block Renderer
        renderer.code = (code, lang) => {
            const language = lang || 'plaintext';
            let codeText = typeof code === 'object' ? code.text : code;
            
            // Check if it's a shell/terminal block
            const isShell = language === 'bash' || language === 'sh' || language === 'shell';
            
            const lines = codeText.split('\n');
            const langLabel = language === 'plaintext' ? 'code' : language.toUpperCase();
            
            const blockId = 'code-' + Math.random().toString(36).substr(2, 9);
            codeBlockStore[blockId] = codeText;
            
            if (isShell) {
                // Shell/Terminal style - like linux terminal
                return `<div class="shell-block my-4 rounded-lg overflow-hidden border border-slate-700 bg-black">
                            <div class="flex items-center px-3 py-2 bg-slate-900 border-b border-slate-700">
                                <span class="flex gap-1.5 mr-3">
                                    <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                                    <span class="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                                    <span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                                </span>
                                <span class="text-xs text-slate-400">Terminal</span>
                            </div>
                            <pre class="!my-0 !rounded-none overflow-x-auto p-3"><code class="text-green-400 font-mono text-sm">${codeText}</code></pre>
                        </div>`;
            }
            
            const linesWithNumbers = lines.map((line, i) => {
                return `<span class="code-line"><span class="line-num">${i + 1}</span><span class="line-text">${line}</span></span>`;
            }).join('');
            
            return `<div class="code-block my-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div class="code-block-header flex items-center justify-between">
                            <span class="text-xs text-slate-500">${langLabel}</span>
                            <button onclick="copyCode(this, '${blockId}')" class="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400" title="Copy code">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                        </div>
                        <pre class="code-with-lines !my-0 !rounded-none overflow-x-auto"><code>${linesWithNumbers}</code></pre>
                    </div>`;
        };

        // Blockquote Renderer
        renderer.blockquote = (content) => {
            const quoteText = typeof content === 'string' ? content : (content.text || '');
            return `<blockquote class="relative my-12 pl-10 py-2 border-l-4 rounded-r-2xl italic text-xl font-medium leading-relaxed" style="border-color: ${linkColor}; background: ${linkColor}10">
                        <i data-lucide="quote" class="absolute left-3 top-3 w-5 h-5 opacity-20" style="color: ${linkColor}"></i>
                        ${quoteText}
                    </blockquote>`;
        };

        marked.use({ renderer });
        let html = marked.parse(md);
        
        // Custom text formatting
        // ==yellow highlight==
        html = html.replace(/==([^=]+)==/g, '<mark class="bg-yellow-200 dark:bg-yellow-600 px-1 rounded">$1</mark>');
        // ::#ff0000::colored text:: or ::red::colored text::
        html = html.replace(/::(#\w+|[a-zA-Z]+)::([^:]+)::/g, '<span style="color:$1">$2</span>');
        // [ ] unchecked - show as [ ]
        html = html.replace(/\[ \]([^\n<]+)/g, '<span class="todo-box">☐ $1</span>');
        // [x] checked - show as [x] with strikethrough
        html = html.replace(/\[x\]([^\n<]+)/g, '<span class="todo-box done">☑ $1</span>');
        
        // --- [[Link]] Replacement ---
        html = html.replace(/\[\[([^\]]+)\]\]/g, (match, idOrPath) => {
            const post = manifest.articles.find(a => 
                a.id === idOrPath || 
                a.path === idOrPath || 
                a.title.toLowerCase().includes(idOrPath.toLowerCase())
            );
            if (post) {
                // Dynamically set link color based on theme/article meta
                const postLinkColor = isDark ? (articleMeta.textDark || extraMetadata.defaults?.textColorDark || '#60a5fa') : (articleMeta.textLight || extraMetadata.defaults?.textColorLight || '#3b82f6');
                return `<a href="#/articles/${post.folder}/${post.id}" class="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-500 hover:text-white transition-all no-underline" style="color: ${postLinkColor};">
                    <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    ${post.title}
                </a>`;
            }
            return match; // Return original markdown if no post is found
        });

        // --- Article Content Structure ---
        const articleWrapperClasses = `min-h-screen transition-colors duration-200 text-slate-900 dark:text-slate-100 ${finalBgStyle ? 'bg-white dark:bg-explorer-darkContent' : 'bg-transparent dark:bg-transparent'}`;
        const overlayMarkup = overlayColor && overlayColor !== 'transparent' ? `<div class="absolute inset-0 pointer-events-none" style="background-image: linear-gradient(${overlayColor}, transparent)"></div>` : '';

        main.innerHTML = `
            <div class="${articleWrapperClasses}" style="${finalBgStyle} ${finalTextColorStyle}">
                <div class="max-w-4xl mx-auto relative">
                    ${overlayMarkup}
                    <article class="relative max-w-4xl mx-auto px-8 py-16 z-10" style="${customStyle}">
                        <header class="mb-8 pb-8 border-b border-slate-100 dark:border-slate-800">
                            <div class="flex items-center gap-4 mb-6">
                                <button onclick="history.back()" class="p-2 rounded-lg transition-all hover:scale-105 active:scale-95 bg-slate-100 dark:bg-slate-800"><i data-lucide="arrow-left" class="w-4 h-4"></i></button>
                                <span class="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-slate-100 dark:bg-slate-800">${p.folder}</span>
                                <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                                    <i data-lucide="users" class="w-3 h-3"></i>
                                    ${(p.authors || []).join(', ')}
                                </div>
                                <span class="text-[10px] font-bold uppercase tracking-widest ml-auto">${new Date(p.date).toDateString()}</span>
                            </div>
                            <h1 class="text-4xl md:text-5xl font-black tracking-tight leading-tight">${p.title}</h1>
                            <div class="flex flex-wrap gap-1.5 mt-4">
                                ${(p.tags || []).map(t => `<span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[9px] font-bold uppercase tracking-widest">#${t}</span>`).join('')}
                            </div>
                        </header>
                        <div class="prose dark:prose-invert max-w-none 
                            prose-headings:font-bold prose-headings:tracking-tight
                            prose-a:no-underline hover:prose-a:underline" 
                            style="--tw-prose-body: ${textColor !== 'inherit' ? textColor : ''}; --tw-prose-headings: ${textColor !== 'inherit' ? textColor : ''}; --tw-prose-links: ${linkColor}; --tw-prose-bold: ${textColor !== 'inherit' ? textColor : ''}; --tw-prose-code: ${textColor !== 'inherit' ? textColor : ''}; --tw-prose-pre-bg: transparent; --tw-prose-quotes: ${linkColor}; font-family: ${customFontFamily};">
                            ${html}
                        </div>
                    </article>
                </div>
            </div>`;
    } catch (e) { 
        console.error("Error rendering article:", e); 
        main.innerHTML = `<p class="text-center text-slate-500 mt-20">Error loading article content.</p>`;
    }
    lucide.createIcons(); // Re-create icons after updating innerHTML
    // Attempt to highlight code blocks after content is loaded and rendered.
    // This should include line numbers if Prism.plugins.lineNumbers is active and configured.
    if (typeof Prism !== 'undefined') {
        // Highlight only the newly added code blocks within the article content.
        // This is a safer approach than highlightAll() on the whole document.
        const articleContentElement = main.querySelector('.prose');
        if (articleContentElement) {
            // Select only code blocks that might not have been highlighted yet
            articleContentElement.querySelectorAll('pre[class*="language-"]:not(.line-numbers)').forEach(block => {
                block.classList.add('line-numbers');
                Prism.highlightElement(block);
            });
        } else {
            // Fallback: ensure all code blocks have line numbers and are highlighted
            document.querySelectorAll('pre[class*="language-"]:not(.line-numbers)').forEach(block => {
                block.classList.add('line-numbers');
                Prism.highlightElement(block);
            });
        }
    }
}

function renderTags() {
    const list = document.getElementById('tagList');
    if (!list) return;
    const tags = new Set();
    manifest.articles.forEach(a => a.tags?.forEach(t => tags.add(t)));
    list.innerHTML = '';
    // Sort tags alphabetically
    const sortedTags = Array.from(tags).sort(); 
    sortedTags.forEach(t => {
        const b = document.createElement('button');
        b.textContent = t;
        const active = selectedTags.has(t);
        b.className = `px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${active ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:border-blue-500'}`;
        b.onclick = () => {
            if (active) selectedTags.delete(t); else selectedTags.add(t);
            renderTags(); 
            renderPath(window.location.hash.substring(1) || '/'); // Re-render current path
        };
        list.appendChild(b);
    });
}

function renderAuthors() {
    const list = document.getElementById('authorList');
    if (!list) return;
    const authors = new Set();
    manifest.articles.forEach(a => a.authors?.forEach(au => authors.add(au)));
    list.innerHTML = '';
    // Sort authors alphabetically
    const sortedAuthors = Array.from(authors).sort(); 
    sortedAuthors.forEach(a => {
        const b = document.createElement('button');
        const active = selectedAuthors.has(a);
        b.className = `shrink-0 px-4 py-2 rounded-2xl border text-xs font-bold transition-all ${active ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'}`;
        b.innerHTML = `<span class="opacity-50 mr-1.5">@</span>${a}`;
        b.onclick = () => {
            if (active) selectedAuthors.delete(a); else selectedAuthors.add(a);
            renderAuthors();
            renderPath(window.location.hash.substring(1) || '/'); // Re-render current path
        };
        list.appendChild(b);
    });
}

function setupEventListeners() {
    const theme = document.getElementById('themeToggle');
    if (theme) {
        theme.onclick = () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            document.getElementById('sunIcon').classList.toggle('hidden', isDark);
            document.getElementById('moonIcon').classList.toggle('hidden', !isDark);
            // Re-render current path to apply theme-specific styles if any
            renderPath(window.location.hash.substring(1) || '/'); 
        };
    }

    // Handle search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // Create search results container
        const searchResults = document.createElement('div');
        searchResults.id = 'searchResults';
        searchResults.className = 'absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg mt-1 max-h-80 overflow-y-auto z-50 hidden';
        searchInput.parentElement.style.position = 'relative';
        searchInput.parentElement.appendChild(searchResults);

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            if (query === '') {
                searchResults.classList.add('hidden');
                searchResults.innerHTML = '';
                return;
            }

            // Search through articles
            const results = manifest.articles.filter(article => 
                article.title.toLowerCase().includes(query) ||
                (article.tags && article.tags.some(tag => tag.toLowerCase().includes(query))) ||
                (article.authors && article.authors.some(author => author.toLowerCase().includes(query)))
            ).slice(0, 8); // Limit to 8 results

            if (results.length === 0) {
                searchResults.innerHTML = '<div class="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">No results found</div>';
            } else {
                searchResults.innerHTML = results.map(article => `
                    <div onclick="window.location.hash='/articles/${article.folder}/${article.id}'; document.getElementById('searchResults').classList.add('hidden'); document.getElementById('searchInput').value='';" 
                         class="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-b-0">
                        <div class="font-medium text-slate-900 dark:text-slate-100 text-sm">${article.title}</div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            ${article.authors ? article.authors.join(', ') : ''} • ${new Date(article.date).toLocaleDateString()}
                        </div>
                        ${article.tags ? `<div class="flex gap-1 mt-2">${article.tags.slice(0, 3).map(tag => `<span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-xs rounded">${tag}</span>`).join('')}</div>` : ''}
                    </div>
                `).join('');
            }
            
            searchResults.classList.remove('hidden');
        });

        // Hide results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.add('hidden');
            }
        });

        // Handle Enter key to go to first result
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !searchResults.classList.contains('hidden')) {
                const firstResult = searchResults.querySelector('[onclick]');
                if (firstResult) {
                    firstResult.click();
                }
            } else if (e.key === 'Escape') {
                searchResults.classList.add('hidden');
                searchInput.blur();
            }
        });
    }
}

init();
