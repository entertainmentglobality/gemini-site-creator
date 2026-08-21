import type { BuildMode } from "./prompt";

const CONSOLE_BRIDGE = `<script>
(function(){
  var send=function(level,args){
    try{parent.postMessage({__atlas:true,level:level,message:Array.prototype.map.call(args,function(a){
      try{return typeof a==='string'?a:JSON.stringify(a);}catch(e){return String(a);}}).join(' ')},'*');}catch(e){}
  };
  ['log','warn','error','info'].forEach(function(k){
    var orig=console[k];console[k]=function(){send(k,arguments);orig.apply(console,arguments);};
  });
  window.addEventListener('error',function(e){send('error',[e.message+' ('+(e.filename||'')+':'+(e.lineno||0)+')']);});
  window.addEventListener('unhandledrejection',function(e){send('error',['Unhandled promise rejection: '+(e.reason&&e.reason.message||e.reason)]);});
  document.addEventListener('click',function(e){
    var a=e.target.closest && e.target.closest('a');
    if(a&&a.getAttribute('href')&&a.getAttribute('href').indexOf('#')!==0&&!/^https?:/.test(a.getAttribute('href'))){
      e.preventDefault();parent.postMessage({__atlas:true,navigate:a.getAttribute('href')},'*');
    }
  },true);
})();
</script>`;

const safeJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");

function injectInto(html: string) {
  if (html.includes("</head>")) return html.replace("</head>", `${CONSOLE_BRIDGE}</head>`);
  return CONSOLE_BRIDGE + html;
}

/** Inlines local css/js references so a multi-page site previews without a server. */
function inlineAssets(html: string, files: Record<string, string>) {
  let out = html;
  out = out.replace(
    /<link[^>]+href=["']\.?\/?([^"':]+\.css)["'][^>]*>/g,
    (m, href) => (files[href] !== undefined ? `<style>\n${files[href]}\n</style>` : m),
  );
  out = out.replace(
    /<script[^>]+src=["']\.?\/?([^"':]+\.js)["'][^>]*>\s*<\/script>/g,
    (m, src) => (files[src] !== undefined ? `<script>\n${files[src]}\n</script>` : m),
  );
  return out;
}

const REACT_RUNTIME = (files: Record<string, string>) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>
${CONSOLE_BRIDGE}
<style>body{margin:0}</style>
</head><body><div id="root"></div>
<script>
const FILES = ${safeJson(files)};
const CDN = "https://esm.sh/";
function norm(p){const parts=[];for(const seg of p.split('/')){if(seg==='.'||seg==='')continue;if(seg==='..')parts.pop();else parts.push(seg);}return parts.join('/');}
function resolvePath(spec, from){
  const base = from.split('/').slice(0,-1).join('/');
  let p = norm(base ? base + '/' + spec : spec);
  const tries=[p,p+'.jsx',p+'.js',p+'.tsx',p+'/index.jsx',p+'/index.js'];
  for(const t of tries){ if(FILES[t]!==undefined) return t; }
  for(const t of tries){ const alt='src/'+t; if(FILES[alt]!==undefined) return alt; }
  return null;
}
const cache={};
function build(path){
  if(cache[path]) return cache[path];
  let code = FILES[path] || '';
  if(path.endsWith('.css')){
    const style=document.createElement('style'); style.textContent=code; document.head.appendChild(style);
    const url=URL.createObjectURL(new Blob(['export default {}'],{type:'text/javascript'}));
    cache[path]=url; return url;
  }
  code = Babel.transform(code,{presets:[['react',{runtime:'classic'}]],filename:path}).code;
  code = code.replace(/(from\\s*|import\\s*\\(\\s*)["']([^"']+)["']/g, function(m, pre, spec){
    if(spec.startsWith('.')||spec.startsWith('/')){
      const target = resolvePath(spec, path);
      return pre + '"' + (target ? build(target) : CDN + spec) + '"';
    }
    if(spec==='react'||spec==='react-dom'||spec.startsWith('react-dom/')||spec.startsWith('react/'))
      return pre + '"' + CDN + spec + '@19.2.0' + '"';
    return pre + '"' + CDN + spec + '"';
  });
  const url = URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  cache[path]=url; return url;
}
(async function(){
  try{
    const entry = ['src/App.jsx','src/App.js','App.jsx','src/main.jsx','src/index.jsx']
      .find(p => FILES[p] !== undefined) || Object.keys(FILES).find(p=>/\\.(jsx|js)$/.test(p));
    if(!entry) throw new Error('No React entry file found (expected src/App.jsx).');
    Object.keys(FILES).filter(p=>p.endsWith('.css')).forEach(build);
    const mod = await import(build(entry));
    const React = (await import(CDN+'react@19.2.0')).default;
    const { createRoot } = await import(CDN+'react-dom@19.2.0/client');
    const App = mod.default;
    if(!App) throw new Error(entry+' has no default export.');
    createRoot(document.getElementById('root')).render(React.createElement(App));
  }catch(err){
    console.error(err && err.message || String(err));
    document.getElementById('root').innerHTML =
      '<pre style="font:14px/1.5 ui-monospace,monospace;color:#f87171;padding:24px;white-space:pre-wrap">'+
      (err && (err.stack||err.message) || String(err))+'</pre>';
  }
})();
</script>
</body></html>`;

const EMPTY = `<!doctype html><html><body style="margin:0;display:grid;place-items:center;height:100vh;font-family:ui-sans-serif,system-ui;background:#0c0d10;color:#6b7280">
<p>Nothing to preview yet</p></body></html>`;

export function buildPreview(
  files: Record<string, string>,
  mode: BuildMode,
  page = "index.html",
): string {
  if (Object.keys(files).length === 0) return EMPTY;
  if (mode === "react" || mode === "fullstack") return REACT_RUNTIME(files);
  const html = files[page] ?? files["index.html"] ?? Object.values(files)[0];
  if (!html) return EMPTY;
  return injectInto(inlineAssets(html, files));
}

export function htmlPages(files: Record<string, string>) {
  return Object.keys(files).filter((f) => f.endsWith(".html"));
}
