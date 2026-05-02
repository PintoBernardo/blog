let currentPath = '/';
let manifest = { articles: [], folders: [] };
let extraMetadata = { folders: {}, blogName: "Bernardo's Blog", quickLinks: [], defaults: {} };
let selectedTags = new Set();
let selectedAuthors = new Set();
let folderTree = {}; 
let expandedFolders = new Set(); 
let basePath = '';

function getBasePath() {
    if (basePath) return basePath;
    const path = window.location.pathname;
    const lastSlash = path.lastIndexOf('/');
    basePath = lastSlash > 0 ? path.substring(0, lastSlash) : '';
    if (basePath && !basePath.endsWith('/')) basePath += '/';
    if (!basePath) basePath = './';
    return basePath;
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
    setupPrism();

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1) || '/';
        renderPath(hash);
    });

    const initialHash = window.location.hash.substring(1) || '/';
    renderPath(initialHash);
}

function setupPrism() {
    if (typeof Prism !== 'undefined') {
        Prism.highlightAll();
    }
}

async function loadManifest() {
    try {
        const response = await fetch('posts.json?t=' + Date.now());
        manifest = await response.json();
    } catch (e) {
        document.getElementById('mainContent').innerHTML = `<div class="max-w-lg mx-auto mt-20 p-10 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-[2rem] text-center"><i data-lucide="alert-circle" class="w-10 h-10 text-red-500 mx-auto mb-4"></i><p class="text-lg font-bold text-red-600 dark:text-red-400">Failed to load manifest.</p><p class="text-sm text-red-400 dark:text-red-500 mt-2">Please check your connection and try again.</p></div>`;
    }
}

async function loadExtraMetadata() {
    try {
        const response = await fetch('extra.xml?t=' + Date.now());
        if (!response.ok) return;
        const text = await response.text();
        const xml = new DOMParser().parseFromString(text, "text/xml");
        extraMetadata.blogName = xml.getElementsByTagName("blogName")[0]?.textContent || "Bernardo's Blog";
        
        const folders = xml.getElementsByTagName("folder");
        for (let f of folders) {
            const name = f.getAttribute("name");
            extraMetadata.folders[name] = {
                color: f.getElementsByTagName("color")[0]?.textContent,
                icon: f.getElementsByTagName("icon")[0]?.textContent
            };
        }
        
        const links = xml.getElementsByTagName("link");
        extraMetadata.quickLinks = Array.from(links).map(l => ({
            name: l.getAttribute("name"),
            url: l.getAttribute("url"),
            icon: l.getAttribute("icon")
        }));

        const defaults = xml.getElementsByTagName("defaults")[0];
        if (defaults) {
            extraMetadata.defaults = {
                bgcolor: defaults.getElementsByTagName("bgcolor")[0]?.textContent,
                bgcolorLight: defaults.getElementsByTagName("bgcolorLight")[0]?.textContent,
                bgcolorDark: defaults.getElementsByTagName("bgcolorDark")[0]?.textContent,
                textColor: defaults.getElementsByTagName("textColor")[0]?.textContent,
                textColorLight: defaults.getElementsByTagName("textColorLight")[0]?.textContent,
                textColorDark: defaults.getElementsByTagName("textColorDark")[0]?.textContent,
                overlayLight: defaults.getElementsByTagName("overlayLight")[0]?.textContent,
                overlayDark: defaults.getElementsByTagName("overlayDark")[0]?.textContent,
                font: defaults.getElementsByTagName("font")[0]?.textContent
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
    for (let i = parts.length - 1; i >= 0; i--) {
        const name = parts[i];
        if (extraMetadata.folders[name]) return extraMetadata.folders[name];
    }
    return {};
}

function buildFolderTree() {
    folderTree = { name: 'Root', path: '', children: {}, articles: [] };
    
    // First, build folders from the folders array
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

    // Then, ensure all folders used by articles exist, and add articles to them
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
            renderArticle(last, remaining.slice(0, -1).join('/'));
        } else {
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
            icon.style.color = meta.color || '#3b82f6';
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
            <header class="mb-16">
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
    return `
        <div onclick="window.location.hash='/articles/${p.folder}/${p.id}'" class="group relative p-8 rounded-[2.5rem] bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-white cursor-pointer shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all overflow-hidden border border-slate-200 dark:border-slate-700/50">
            <div class="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/20 dark:bg-blue-500/20 rounded-full blur-3xl transition-all"></div>
            <div class="relative z-10">
                <div class="flex items-center gap-3 mb-5">
                    <span class="px-2.5 py-1 bg-blue-600/80 text-[9px] font-black uppercase tracking-widest rounded-full">Featured</span>
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
        main.innerHTML = `<div class="max-w-5xl mx-auto"><div class="mb-16"><h1 class="text-5xl font-black uppercase tracking-tighter">All Articles</h1></div><div class="grid grid-cols-1 gap-4">${manifest.articles.filter(a => matchesFilters(a)).map(p => renderPostCard(p)).join('')}</div></div>`;
        lucide.createIcons();
        return;
    }

    let current = folderTree;
    path.split('/').forEach(p => current = current?.children[p]);
    if (!current) return;

    const subs = Object.values(current.children).filter(s => s.articles.some(a => matchesFilters(a)) || Object.keys(s.children).length > 0);
    const posts = current.articles.filter(a => matchesFilters(a));

    main.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <div class="mb-16"><h1 class="text-5xl font-black uppercase tracking-tighter">${current.name}</h1></div>
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-8">
                ${subs.map(s => `
                    <div onclick="window.location.hash='/articles/${s.path}'" class="flex flex-col items-center group cursor-pointer">
                        <div class="w-full aspect-square flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-[2rem] border-2 border-transparent group-hover:border-blue-500 transition-all shadow-sm">
                            <i data-lucide="folder" class="w-12 h-12 text-blue-400/40"></i>
                        </div>
                        <span class="text-[11px] font-black mt-4 uppercase text-slate-500 group-hover:text-blue-600 tracking-widest">${s.name}</span>
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
    if (!p) return;
    
    let articleMeta = {};
    const folderParts = p.folder.split('/');
    for (let i = folderParts.length; i >= 1; i--) {
        const folderPath = folderParts.slice(0, i).join('/');
        try {
            const metaRes = await fetch(`articles/${folderPath}/article.xml`);
            if (metaRes.ok) {
                const xmlText = await metaRes.text();
                const xml = new DOMParser().parseFromString(xmlText, "text/xml");
                articleMeta = {
                    bg: xml.getElementsByTagName("bgcolor")[0]?.textContent,
                    bgLight: xml.getElementsByTagName("bgLight")[0]?.textContent,
                    bgDark: xml.getElementsByTagName("bgDark")[0]?.textContent,
                    textColor: xml.getElementsByTagName("textColor")[0]?.textContent,
                    textLight: xml.getElementsByTagName("textLight")[0]?.textContent,
                    textDark: xml.getElementsByTagName("textDark")[0]?.textContent,
                    overlay: { light: xml.getElementsByTagName("light")[0]?.textContent, dark: xml.getElementsByTagName("dark")[0]?.textContent },
                    font: { family: xml.getElementsByTagName("family")[0]?.textContent, weight: xml.getElementsByTagName("weight")[0]?.textContent }
                };
                break;
            }
        } catch (e) {}
    }
    
    const isDark = document.documentElement.classList.contains('dark');
    
    // Priority: 1. Mode-specific, 2. Global Defaults Mode-specific, 3. General (only if not Dark mode), 4. Default Transparent
    let bgColor = isDark 
        ? (articleMeta.bgDark || extraMetadata.defaults?.bgcolorDark || 'transparent')
        : (articleMeta.bgLight || extraMetadata.defaults?.bgcolorLight || articleMeta.bg || extraMetadata.defaults?.bgcolor || 'transparent');
        
    let textColor = isDark
        ? (articleMeta.textDark || extraMetadata.defaults?.textColorDark || 'inherit')
        : (articleMeta.textLight || extraMetadata.defaults?.textColorLight || articleMeta.textColor || extraMetadata.defaults?.textColor || 'inherit');

    const finalBgStyle = bgColor !== 'transparent' ? `background-color: ${bgColor};` : '';
    const finalTextColorStyle = textColor !== 'inherit' ? `color: ${textColor};` : '';

    const tagText = isDark ? (articleMeta.textDark || extraMetadata.defaults?.textColorDark || '#60a5fa') : (articleMeta.textLight || extraMetadata.defaults?.textColorLight || '#3b82f6');
    const tagBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    
    let overlayColor = (isDark ? articleMeta.overlay?.dark : articleMeta.overlay?.light) || 'transparent';
    
    const customStyle = `font-family: ${articleMeta.font?.family || extraMetadata.defaults?.font || 'Crimson Pro, Georgia, serif'}; font-weight: ${articleMeta.font?.weight || '400'};`;

    try {
        const res = await fetch(`articles/${p.path}`);
        const md = await res.text();
        
        const renderer = new marked.Renderer();
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
            
            if (src && !src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) src = `${getBasePath()}articles/${p.folder}/${src}`;
            if (src?.includes('/assets/icon/')) src = src.replace('/assets/icon/', '/assets/icons/');
            return `<div class="my-10 flex flex-col items-center">
                        <img src="${src}" alt="${text || ''}" style="${sizeStyle}" class="rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 transition-all hover:scale-[1.01]${sizeStyle ? '' : ' max-w-full'}">
                        ${text ? `<span class="mt-4 text-xs font-medium text-slate-400 italic">― ${text}</span>` : ''}
                    </div>`;
        };

        renderer.code = (code, lang) => {
            const language = lang || 'plaintext';
            const highlighted = Prism.languages[language] ? Prism.highlight(code, Prism.languages[language], language) : code;
            return `<div class="relative group my-8">
                        <pre class="relative language-${language} rounded-xl shadow-xl !m-0 !bg-slate-900 border border-slate-800 overflow-hidden">
                            <div class="flex items-center justify-between px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
                                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">${language}</span>
                                <button onclick="navigator.clipboard.writeText(\`${code.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)" class="p-1 hover:text-white transition-colors"><i data-lucide="copy" class="w-3.5 h-3.5 text-slate-500"></i></button>
                            </div>
                            <code class="language-${language} block p-6 !bg-transparent text-sm">${highlighted}</code>
                        </pre>
                    </div>`;
        };

        renderer.blockquote = (content) => {
            const quoteText = typeof content === 'string' ? content : (content.text || '');
            return `<blockquote class="relative my-12 pl-10 py-2 border-l-4 rounded-r-2xl italic text-xl font-medium leading-relaxed" style="border-color: ${tagText}; background: ${tagText}10">
                        <i data-lucide="quote" class="absolute left-3 top-3 w-5 h-5 opacity-20" style="color: ${tagText}"></i>
                        ${quoteText}
                    </blockquote>`;
        };

        main.innerHTML = `
            <div class="min-h-screen transition-colors duration-200 bg-white dark:bg-explorer-darkContent text-slate-900 dark:text-slate-100" style="${finalBgStyle} ${finalTextColorStyle}">
                <div class="max-w-4xl mx-auto relative">
                    <div class="absolute inset-0 pointer-events-none" style="background-image: linear-gradient(${overlayColor}, transparent)"></div>
                    <article class="relative max-w-4xl mx-auto px-8 py-16 z-10" style="${customStyle}">
                        <header class="mb-16 pb-10 border-b border-slate-100 dark:border-slate-800">
                            <div class="flex items-center gap-4 mb-6">
                                <button onclick="history.back()" class="p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 bg-slate-100 dark:bg-slate-800"><i data-lucide="arrow-left" class="w-5 h-5 text-slate-500"></i></button>
                                <span class="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500">${p.folder}</span>
                                <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-70">
                                    <i data-lucide="users" class="w-3.5 h-3.5"></i>
                                    ${(p.authors || []).join(', ')}
                                </div>
                                <span class="text-[10px] font-black uppercase tracking-widest opacity-50 ml-auto">${new Date(p.date).toDateString()}</span>
                            </div>
                            <h1 class="text-5xl md:text-6xl font-black tracking-tight leading-tight">${p.title}</h1>
                            <div class="flex flex-wrap gap-2 mt-6">
                                ${(p.tags || []).map(t => `<span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">#${t}</span>`).join('')}
                            </div>
                        </header>
                        <div class="prose prose-lg dark:prose-invert max-w-none 
                            prose-headings:font-bold prose-headings:tracking-tight
                            prose-a:no-underline hover:prose-a:underline" 
                            style="--tw-prose-body: ${textColor !== 'inherit' ? textColor : ''}; --tw-prose-headings: ${textColor !== 'inherit' ? textColor : ''}; --tw-prose-links: ${tagText}; --tw-prose-bold: ${textColor !== 'inherit' ? textColor : ''}; --tw-prose-code: ${textColor !== 'inherit' ? textColor : ''}; --tw-prose-pre-bg: transparent; --tw-prose-quotes: ${textColor !== 'inherit' ? textColor : ''};">
                            ${marked.parse(md, { renderer })}
                        </div>
                    </article>
                </div>
            </div>`;
    } catch (e) { console.error(e); }
    lucide.createIcons();
    if (typeof Prism !== 'undefined') Prism.highlightAllUnder(main);
}

function renderTags() {
    const list = document.getElementById('tagList');
    if (!list) return;
    const tags = new Set();
    manifest.articles.forEach(a => a.tags?.forEach(t => tags.add(t)));
    list.innerHTML = '';
    tags.forEach(t => {
        const b = document.createElement('button');
        b.textContent = t;
        const active = selectedTags.has(t);
        b.className = `px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${active ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:border-blue-500'}`;
        b.onclick = () => {
            if (active) selectedTags.delete(t); else selectedTags.add(t);
            renderTags(); renderPath(window.location.hash.substring(1) || '/');
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
    authors.forEach(a => {
        const b = document.createElement('button');
        const active = selectedAuthors.has(a);
        b.className = `shrink-0 px-4 py-2 rounded-2xl border text-xs font-bold transition-all ${active ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'}`;
        b.innerHTML = `<span class="opacity-50 mr-1.5">@</span>${a}`;
        b.onclick = () => {
            if (active) selectedAuthors.delete(a); else selectedAuthors.add(a);
            renderAuthors(); renderPath(window.location.hash.substring(1) || '/');
        };
        list.appendChild(b);
    });
}

function setupEventListeners() {
    const theme = document.getElementById('themeToggle');
    theme.onclick = () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        document.getElementById('sunIcon').classList.toggle('hidden', isDark);
        document.getElementById('moonIcon').classList.toggle('hidden', !isDark);
        renderPath(window.location.hash.substring(1) || '/');
    };
}

init();
