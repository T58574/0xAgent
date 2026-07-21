use std::net::{TcpListener, UdpSocket};
use std::sync::{Mutex, OnceLock};
use std::thread;
use serde_json::json;
use tauri::{AppHandle, Manager};
use tokio::sync::oneshot;
use crate::session::{ChatMessage, load_session, save_session, list_sessions};
use crate::AppState;


pub struct GlobalShareState {
    pub password: Option<String>,
    pub active_session_id: Option<String>,
    pub status: String,      // "idle", "thinking", "executing_tool", "waiting_approval"
    pub last_tokens: String, // accumulated active response tokens
    pub server_url: Option<String>,
    pub shutdown_tx: Option<oneshot::Sender<()>>,
}

pub static SHARE_STATE: OnceLock<Mutex<GlobalShareState>> = OnceLock::new();

pub fn get_share_state() -> &'static Mutex<GlobalShareState> {
    SHARE_STATE.get_or_init(|| {
        Mutex::new(GlobalShareState {
            password: None,
            active_session_id: None,
            status: "idle".to_string(),
            last_tokens: String::new(),
            server_url: None,
            shutdown_tx: None,
        })
    })
}

// Find local IP using robust routing lookup first, falling back to filtered interfaces
pub fn get_local_ip() -> Option<String> {
    // 1. Primary Method: UDP routing table query
    // Binds a UDP socket and "connects" it to a public Internet address.
    // This doesn't send any network packets, but asks the OS routing table
    // which local interface would route traffic to that address.
    for target in &["8.8.8.8:80", "1.1.1.1:80", "8.8.4.4:80"] {
        if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
            if socket.connect(target).is_ok() {
                if let Ok(local_addr) = socket.local_addr() {
                    let ip = local_addr.ip().to_string();
                    // Ensure it is not loopback or link-local
                    if !ip.starts_with("127.") && !ip.starts_with("169.254.") {
                        return Some(ip);
                    }
                }
            }
        }
    }

    // 2. Secondary Method: Interface Enumeration and Scoring
    get_filtered_ips().first().cloned()
}

pub fn get_filtered_ips() -> Vec<String> {
    let mut candidates = Vec::new();
    
    if let Ok(interfaces) = local_ip_address::list_afinet_netifas() {
        for (name, ip) in interfaces {
            if ip.is_ipv4() && !ip.is_loopback() {
                let ip_str = ip.to_string();
                let name_lower = name.to_lowercase();
                
                // Skip link-local APIPA addresses
                if ip_str.starts_with("169.254.") {
                    continue;
                }

                // Check for virtual/bridge adapter signatures
                let is_virtual = name_lower.contains("docker")
                    || name_lower.contains("wsl")
                    || name_lower.contains("vbox")
                    || name_lower.contains("virtual")
                    || name_lower.contains("vmware")
                    || name_lower.contains("host-only")
                    || name_lower.contains("hyper-v")
                    || name_lower.contains("vethernet")
                    || name_lower.contains("npcap")
                    || name_lower.contains("vpn")
                    || name_lower.contains("tap")
                    || name_lower.contains("tun")
                    || name_lower.contains("zerotier")
                    || name_lower.contains("tailscale")
                    || name_lower.contains("hamachi");

                if is_virtual {
                    continue;
                }

                // Score candidate based on standard subnets
                let score = if ip_str.starts_with("192.168.") {
                    100
                } else if ip_str.starts_with("10.") {
                    90
                } else if ip_str.starts_with("172.") {
                    // Check if Docker class B subnet 172.16.x.x - 172.31.x.x
                    let parts: Vec<&str> = ip_str.split('.').collect();
                    if parts.len() >= 2 {
                        if let Ok(second_octet) = parts[1].parse::<u8>() {
                            if second_octet >= 16 && second_octet <= 31 {
                                10 // Likely virtual/Docker subnet
                            } else {
                                50
                            }
                        } else {
                            50
                        }
                    } else {
                        50
                    }
                } else {
                    30
                };

                candidates.push((score, ip_str));
            }
        }
    }
    
    // Sort candidates by score descending
    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    candidates.into_iter().map(|(_, ip)| ip).collect()
}


// Mobile responsive HTML Single-Page client with premium dark styling, session management, and tool confirmations
const MOBILE_HTML: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>0xAgent Mobile</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Outfit', 'sans-serif'],
            mono: ['Fira Code', 'monospace'],
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #05070f;
      color: #e2e8f0;
      font-family: 'Outfit', sans-serif;
    }
    .glass-card {
      background: rgba(18, 24, 41, 0.65);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
    }
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    @keyframes swipeUp {
      from { transform: translateY(12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .animate-swipeUp {
      animation: swipeUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  </style>
</head>
<body class="flex flex-col h-screen overflow-hidden">

  <!-- PASSWORD GATE -->
  <div id="auth-gate" class="fixed inset-0 bg-[#05070f]/98 flex items-center justify-center p-4 z-50 hidden">
    <div class="w-full max-w-sm glass-card p-6 border border-white/10 space-y-4 shadow-2xl">
      <h2 class="text-xl font-bold text-center bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent uppercase tracking-wider select-none">Access Locked</h2>
      <p class="text-xs text-slate-400 text-center">Enter the password configured on your host computer.</p>
      <input type="password" id="auth-password" placeholder="Password" onkeydown="if(event.key === 'Enter') submitPassword()" class="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500 transition-colors">
      <button onclick="submitPassword()" class="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-orange-500/10 active:scale-95 transition-all cursor-pointer">Submit</button>
      <p id="auth-error" class="text-xs text-rose-400 text-center hidden">Invalid Password</p>
    </div>
  </div>

  <!-- MAIN LAYOUT -->
  <header class="h-14 shrink-0 border-b border-white/5 bg-[#0a0f1d]/85 backdrop-blur-md flex items-center justify-between px-4 z-10">
    <div class="flex items-center gap-2">
      <span class="text-sm font-bold tracking-widest bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent uppercase select-none">0xAgent</span>
      <span id="header-status-dot" class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" title="System Status"></span>
    </div>
    
    <div class="flex items-center gap-1.5">
      <select id="session-select" onchange="switchSession()" class="bg-slate-950/60 border border-white/10 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg max-w-[130px] outline-none focus:border-orange-500/50 transition-colors"></select>
      <button onclick="createSession()" class="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-semibold" title="New Session">+</button>
      <button onclick="deleteSession()" class="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer text-xs" title="Delete Session">🗑️</button>
    </div>
  </header>

  <!-- CHAT MESSAGES WINDOW -->
  <main id="chat-window" class="flex-1 overflow-y-auto p-4 space-y-4 select-text no-scrollbar bg-[#05070f]"></main>

  <!-- STREAMING STATUS BAR -->
  <div id="status-bar" class="h-9 px-4 shrink-0 bg-[#0e1322] border-t border-white/5 text-[10px] font-medium text-orange-400 flex items-center justify-between hidden">
    <div class="flex items-center gap-2">
      <span class="relative flex h-2 w-2">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
      </span>
      <span id="status-text" class="font-mono">Agent is processing...</span>
    </div>
    <span class="text-[9px] bg-slate-950 border border-white/10 px-2 py-0.5 rounded-md text-slate-400 select-none">ACTIVE</span>
  </div>

  <!-- INPUT AREA -->
  <footer class="p-3 border-t border-white/5 bg-[#0a0f1d]/85 backdrop-blur-md shrink-0">
    <div class="flex gap-2">
      <input type="text" id="prompt-input" onkeydown="handleEnter(event)" placeholder="Ask anything..." class="flex-1 px-4 py-2.5 bg-slate-950 border border-white/10 text-sm rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all">
      <button onclick="sendMessage()" class="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-orange-500/10 active:scale-95 transition-all cursor-pointer border-0">Send</button>
    </div>
  </footer>

  <script>
    let currentSessionId = '';
    let pollingInterval = null;
    let currentAgentStatus = 'idle';
    let lastStatus = 'idle';
    let lastLoadedContentHash = '';

    function getPassword() {
      return localStorage.getItem('share_pwd') || '';
    }

    async function apiRequest(url, options = {}) {
      const pwd = getPassword();
      const separator = url.includes('?') ? '&' : '?';
      const fetchUrl = `${url}${separator}pwd=${encodeURIComponent(pwd)}`;
      
      const res = await fetch(fetchUrl, options);
      if (res.status === 401) {
        document.getElementById('auth-gate').classList.remove('hidden');
        return null;
      }
      return res.json();
    }

    function submitPassword() {
      const val = document.getElementById('auth-password').value;
      localStorage.setItem('share_pwd', val);
      document.getElementById('auth-gate').classList.add('hidden');
      document.getElementById('auth-error').classList.add('hidden');
      initApp();
    }

    async function initApp() {
      await loadSessionList();
    }

    async function loadSessionList(selectId = null) {
      const sessions = await apiRequest('/api/sessions');
      if (!sessions) return;
      
      const select = document.getElementById('session-select');
      select.innerHTML = '';
      
      if (sessions.length === 0) {
        select.innerHTML = '<option value="">No Active Chats</option>';
        currentSessionId = '';
        document.getElementById('chat-window').innerHTML = '';
        return;
      }

      sessions.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.title;
        select.appendChild(opt);
      });

      if (selectId && sessions.some(s => s.id === selectId)) {
        currentSessionId = selectId;
      } else {
        currentSessionId = sessions[0].id;
      }
      select.value = currentSessionId;
      
      lastLoadedContentHash = ''; // Force redraw
      await loadChat();
    }

    async function createSession() {
      const title = prompt("Enter session title:", "New Chat");
      if (!title || !title.trim()) return;
      const res = await apiRequest('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() })
      });
      if (res) {
        await loadSessionList(res.id);
      }
    }

    async function deleteSession() {
      if (!currentSessionId) return;
      if (!confirm("Are you sure you want to delete this session?")) return;
      const res = await apiRequest('/api/sessions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentSessionId })
      });
      if (res) {
        await loadSessionList();
      }
    }

    async function switchSession() {
      currentSessionId = document.getElementById('session-select').value;
      lastLoadedContentHash = ''; // Force redraw
      await loadChat();
    }

    function formatMessageContent(content) {
      let cleaned = content;
      cleaned = cleaned.replace(/<read_file[^>]*\/>/gi, "");
      cleaned = cleaned.replace(/<write_file[^>]*>([\s\S]*?)<\/write_file>/gi, "");
      cleaned = cleaned.replace(/<patch_file[^>]*>([\s\S]*?)<\/patch_file>/gi, "");
      cleaned = cleaned.replace(/<list_dir[^>]*\/>/gi, "");
      cleaned = cleaned.replace(/<grep_search[^>]*\/>/gi, "");
      cleaned = cleaned.replace(/<execute_command[^>]*>([\s\S]*?)<\/execute_command>/gi, "");
      
      cleaned = cleaned.trim();
      if (!cleaned) return "";

      const temp = document.createElement('div');
      temp.textContent = cleaned;
      let escaped = temp.innerHTML;

      escaped = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre class="bg-black/50 border border-white/10 rounded-lg p-3 my-2 font-mono text-xs text-orange-200 overflow-x-auto whitespace-pre">${code.trim()}</pre>`;
      });

      escaped = escaped.replace(/`([^`]+)`/g, '<code class="bg-slate-800 text-orange-400 px-1 py-0.5 rounded font-mono text-xs">$1</code>');

      return escaped;
    }

    function toggleOutput(btn) {
      const block = btn.nextElementSibling;
      const arrow = btn.firstElementChild;
      if (block.classList.contains('hidden')) {
        block.classList.remove('hidden');
        arrow.style.transform = 'rotate(90deg)';
      } else {
        block.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
      }
    }

    async function respondToTool(msgId, toolId, approve) {
      const res = await apiRequest('/api/sessions/respond_tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSessionId, tool_call_id: toolId, approve: approve })
      });
      if (res) {
        await forcePollState();
      }
    }

    async function loadChat() {
      if (!currentSessionId) return;
      const sess = await apiRequest(`/api/sessions/${currentSessionId}`);
      if (!sess) return;

      const messagesStr = JSON.stringify(sess.messages) + "_" + currentAgentStatus;
      if (messagesStr === lastLoadedContentHash) {
        return; 
      }
      lastLoadedContentHash = messagesStr;

      const win = document.getElementById('chat-window');
      const wasAtBottom = win.scrollHeight - win.scrollTop - win.clientHeight < 50;

      win.innerHTML = '';

      sess.messages.forEach(msg => {
        if (msg.role === 'tool') return; 
        
        const bubble = document.createElement('div');
        bubble.className = msg.role === 'user' ? 'flex justify-end animate-swipeUp' : 'flex justify-start animate-swipeUp';
        
        if (msg.role === 'user') {
          const inner = document.createElement('div');
          inner.className = 'max-w-[85%] rounded-2xl rounded-tr-none px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-sm leading-relaxed text-white shadow-lg shadow-orange-500/5 select-text';
          inner.textContent = msg.content;
          bubble.appendChild(inner);
        } else {
          const container = document.createElement('div');
          container.className = 'max-w-[85%] space-y-1.5';
          
          const inner = document.createElement('div');
          inner.className = 'rounded-2xl rounded-tl-none px-4 py-3 bg-[#121829]/65 backdrop-blur-sm border border-white/5 text-sm leading-relaxed text-slate-200 select-text shadow-sm';
          
          const formatted = formatMessageContent(msg.content);
          if (formatted) {
            inner.innerHTML = formatted;
            container.appendChild(inner);
          }
          
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            msg.tool_calls.forEach(tool => {
              const card = document.createElement('div');
              card.className = 'p-3 bg-slate-950/80 border border-white/5 rounded-xl space-y-2.5 shadow-inner transition-all hover:border-white/10';
              
              let badgeColor = 'bg-orange-500/10 border-orange-500/30 text-orange-400';
              if (tool.name.includes('read') || tool.name.includes('list') || tool.name.includes('grep')) {
                badgeColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
              } else if (tool.name.includes('exec')) {
                badgeColor = 'bg-rose-500/10 border-rose-500/30 text-rose-400';
              }
              
              let argText = '';
              try {
                const args = JSON.parse(tool.arguments);
                if (args.path) argText = `path: ${args.path}`;
                else if (args.command) argText = `command: ${args.command}`;
                else if (args.pattern) argText = `find: "${args.pattern}" in ${args.path}`;
                else argText = JSON.stringify(args);
              } catch(e) {
                argText = tool.arguments;
              }

              let statusText = tool.status;
              let statusColor = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
              if (tool.status === 'completed') statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
              else if (tool.status === 'error') statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
              else if (tool.status === 'pending' || tool.status === 'running') {
                statusColor = 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20 animate-pulse';
              } else if (tool.status === 'rejected') {
                statusColor = 'text-slate-500 bg-slate-800/10 border-slate-800/20';
              }

              let innerHtml = `
                <div class="flex items-center justify-between text-[10px]">
                  <span class="px-2 py-0.5 border rounded-md font-bold uppercase tracking-wider text-[8px] ${badgeColor}">${tool.name}</span>
                  <span class="px-2 py-0.5 border rounded-md font-semibold text-[8px] ${statusColor}">${statusText}</span>
                </div>
                <div class="font-mono text-[10px] text-slate-300 break-all select-all bg-black/30 px-2 py-1.5 rounded border border-white/5">${argText}</div>
              `;

              if (tool.status === 'pending' && currentAgentStatus === 'waiting_approval') {
                innerHtml += `
                  <div class="p-2 border border-yellow-500/20 bg-yellow-500/5 rounded-lg flex flex-col gap-2 animate-swipeUp">
                    <span class="text-[9px] text-yellow-400 font-semibold">⚠️ Requires confirmation</span>
                    <div class="flex gap-2">
                      <button onclick="respondToTool('${msg.id}', '${tool.id}', true)" class="flex-1 py-1.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-md text-xs font-bold transition-all shadow-md cursor-pointer border-0">Approve</button>
                      <button onclick="respondToTool('${msg.id}', '${tool.id}', false)" class="flex-1 py-1.5 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white rounded-md text-xs font-bold transition-all shadow-md cursor-pointer border-0">Reject</button>
                    </div>
                  </div>
                `;
              }

              if (tool.output) {
                const hasError = tool.output.startsWith('Error:');
                const outputLabel = hasError ? 'Error Output' : 'Execution Output';
                const outputClass = hasError ? 'text-rose-400' : 'text-slate-300';
                
                innerHtml += `
                  <div class="space-y-1">
                    <button onclick="toggleOutput(this)" class="text-[9px] text-orange-400/80 hover:text-orange-400 font-semibold flex items-center gap-1 cursor-pointer outline-none bg-transparent border-0">
                      <span class="inline-block transform transition-transform duration-200 select-none">▶</span> <span>${outputLabel} (${tool.output.length} chars)</span>
                    </button>
                    <div class="hidden mt-1">
                      <pre class="bg-black/60 p-2 border border-white/5 rounded text-[9px] overflow-x-auto whitespace-pre-wrap max-h-48 scrollbar-thin select-all ${outputClass}">${tool.output}</pre>
                    </div>
                  </div>
                `;
              }

              card.innerHTML = innerHtml;
              container.appendChild(card);
            });
          }
          
          bubble.appendChild(container);
        }
        
        win.appendChild(bubble);
      });

      if (wasAtBottom || currentAgentStatus !== 'idle') {
        win.scrollTop = win.scrollHeight;
      }
    }

    async function sendMessage() {
      const input = document.getElementById('prompt-input');
      const text = input.value.trim();
      if (!text || !currentSessionId) return;
      input.value = '';

      const win = document.getElementById('chat-window');
      const bubble = document.createElement('div');
      bubble.className = 'flex justify-end animate-swipeUp';
      const inner = document.createElement('div');
      inner.className = 'max-w-[85%] rounded-2xl rounded-tr-none px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-sm leading-relaxed text-white shadow-lg shadow-orange-500/5 select-text';
      inner.textContent = text;
      bubble.appendChild(inner);
      win.appendChild(bubble);
      win.scrollTop = win.scrollHeight;

      const res = await apiRequest('/api/sessions/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSessionId, text: text })
      });

      if (res) {
        await forcePollState();
      }
    }

    function handleEnter(e) {
      if (e.key === 'Enter') sendMessage();
    }

    async function pollState() {
      try {
        const state = await apiRequest('/api/status');
        if (!state) return;

        currentAgentStatus = state.status;
        
        const statusBar = document.getElementById('status-bar');
        const statusText = document.getElementById('status-text');
        const statusDot = document.getElementById('header-status-dot');
        
        if (currentAgentStatus !== 'idle') {
          statusBar.classList.remove('hidden');
          if (currentAgentStatus === 'thinking') {
            statusText.textContent = 'Agent is reasoning...';
            statusDot.className = 'w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b] animate-pulse';
          } else if (currentAgentStatus === 'executing_tool') {
            statusText.textContent = 'Executing local tool...';
            statusDot.className = 'w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316] animate-pulse';
          } else if (currentAgentStatus === 'waiting_approval') {
            statusText.textContent = 'Waiting for tool confirmation...';
            statusDot.className = 'w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-ping';
          }
        } else {
          statusBar.classList.add('hidden');
          statusDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]';
        }

        if (state.active_session_id && state.active_session_id !== currentSessionId) {
          const select = document.getElementById('session-select');
          if (!Array.from(select.options).some(opt => opt.value === state.active_session_id)) {
            await loadSessionList(state.active_session_id);
          } else {
            currentSessionId = state.active_session_id;
            select.value = currentSessionId;
          }
        }

        if (currentAgentStatus !== 'idle' || lastStatus !== 'idle') {
          await loadChat();
        }
        
        lastStatus = currentAgentStatus;
      } catch (e) {
        console.error(e);
      }
    }

    async function forcePollState() {
      await pollState();
    }

    initApp();
    setInterval(pollState, 1000);
  </script>
</body>
</html>"#;

// Starts HTTP server in background tokio loop
pub fn start_http_server(app: AppHandle, password: Option<String>) -> Result<String, String> {
  // Enumerate candidate IPv4 addresses
  let mut ips = Vec::new();
  if let Some(udp_ip) = get_local_ip() {
    ips.push(udp_ip);
  }
  for ip in get_filtered_ips() {
    if !ips.contains(&ip) {
      ips.push(ip);
    }
  }

  // Fallback if no interfaces detected
  if ips.is_empty() {
    return Err("Could not determine any valid local network IP".to_string());
  }

  // Bind to preferred port 1889 first, fallback to dynamic port if busy
  let listener = match TcpListener::bind("0.0.0.0:1889") {
    Ok(l) => l,
    Err(_) => {
      TcpListener::bind("0.0.0.0:0")
        .map_err(|e| format!("Failed to bind to any port: {}", e))?
    }
  };
  
  let bound_port = listener.local_addr()
    .map(|addr| addr.port())
    .map_err(|e| format!("Failed to read bound port: {}", e))?;

  // Map all candidate IPs to the allocated port
  let urls: Vec<String> = ips.iter()
    .map(|ip| format!("http://{}:{}", ip, bound_port))
    .collect();
  let server_urls = urls.join(",");

  let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();

  // Register in global state
  {
    let mut state = get_share_state().lock().unwrap();
    state.password = password.clone();
    state.server_url = Some(server_urls.clone());
    state.shutdown_tx = Some(shutdown_tx);
  }

  let app_clone = app.clone();

  
  // Spawn listener thread
  thread::spawn(move || {
    let tokio_runtime = tokio::runtime::Runtime::new().unwrap();
    
    tokio_runtime.block_on(async move {
      let listener = tokio::net::TcpListener::from_std(listener).unwrap();
      let mut active = true;
      
      while active {
        // Handle shutdown signal
        tokio::select! {
          _ = &mut shutdown_rx => {
            active = false;
          }
          accept_res = listener.accept() => {
            if let Ok((mut stream, _addr)) = accept_res {
              let app_handle = app_clone.clone();
              tokio::spawn(async move {
                use tokio::io::{AsyncReadExt, AsyncWriteExt};
                
                let mut buf = Vec::new();
                let mut chunk = [0; 2048];
                let mut headers_end = None;

                while buf.len() < 8192 {
                  match stream.read(&mut chunk).await {
                    Ok(0) => break,
                    Ok(n) => {
                      buf.extend_from_slice(&chunk[..n]);
                      if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                        headers_end = Some(pos);
                        break;
                      }
                    }
                    Err(_) => break,
                  }
                }

                if let Some(pos) = headers_end {
                  let req_str = String::from_utf8_lossy(&buf);
                  
                  // Find Content-Length
                  let mut content_length = 0;
                  for line in req_str[..pos].lines() {
                    let line_lower = line.to_lowercase();
                    if line_lower.starts_with("content-length:") {
                      if let Some(val_str) = line.split(':').nth(1) {
                        if let Ok(len) = val_str.trim().parse::<usize>() {
                          content_length = len;
                        }
                      }
                    }
                  }

                  // Read body bytes if needed
                  let body_start = pos + 4;
                  let mut current_body_len = buf.len() - body_start;
                  while current_body_len < content_length && buf.len() < 65536 {
                    match stream.read(&mut chunk).await {
                      Ok(0) => break,
                      Ok(n) => {
                        buf.extend_from_slice(&chunk[..n]);
                        current_body_len += n;
                      }
                      Err(_) => break,
                    }
                  }

                  let req_str = String::from_utf8_lossy(&buf);
                  let mut lines = req_str.lines();
                  
                  let request_line = match lines.next() {
                    Some(line) => line,
                    None => return,
                  };

                  let parts: Vec<&str> = request_line.split_whitespace().collect();
                  if parts.len() < 2 {
                    return;
                  }
                  
                  let _method = parts[0];
                  let mut full_path = parts[1];
                  
                  // Simple password validation via query parameter `?pwd=...`
                  let mut query_pwd = "";
                  if let Some(idx) = full_path.find('?') {
                    let query = &full_path[idx + 1..];
                    full_path = &full_path[..idx];
                    for param in query.split('&') {
                      let kv: Vec<&str> = param.split('=').collect();
                      if kv.len() == 2 && kv[0] == "pwd" {
                        query_pwd = kv[1];
                      }
                    }
                  }

                  // Verify gate ONLY for API calls
                  if full_path.starts_with("/api/") {
                    let required_password = {
                      let state = get_share_state().lock().unwrap();
                      state.password.clone()
                    };

                    if let Some(ref ref_pwd) = required_password {
                      if query_pwd != ref_pwd {
                        // Reject with 401
                        let response = "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"error\":\"Unauthorized\"}";
                        let _ = stream.write_all(response.as_bytes()).await;
                        return;
                      }
                    }
                  }

                  // ROUTING HANDLERS
                  if full_path == "/" || full_path == "/index.html" {
                    let response = format!(
                      "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                      MOBILE_HTML.len(),
                      MOBILE_HTML
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                  } else if full_path == "/api/sessions" {
                    match list_sessions(&app_handle) {
                      Ok(sess_list) => {
                        let json_res = json!(sess_list).to_string();
                        let response = format!(
                          "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                          json_res.len(),
                          json_res
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                      }
                      Err(e) => {
                        let err_json = json!({ "error": e }).to_string();
                        let response = format!(
                          "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                          err_json.len(),
                          err_json
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                      }
                    }
                  } else if full_path == "/api/sessions/create" {
                    let mut success = false;
                    let mut created_sess = None;
                    let mut err_msg = "Unknown error".to_string();
                    
                    let body = if body_start <= req_str.len() { &req_str[body_start..] } else { "" };
                    if let Ok(payload) = serde_json::from_str::<serde_json::Value>(body) {
                      let title = payload.get("title").and_then(|v| v.as_str()).unwrap_or("New Session");
                      match crate::session::create_new_session(&app_handle, title) {
                        Ok(sess) => {
                          created_sess = Some(sess);
                          success = true;
                        }
                        Err(e) => {
                          err_msg = e;
                        }
                      }
                    } else {
                      err_msg = "Failed to parse body JSON".to_string();
                    }

                    if success && created_sess.is_some() {
                      let json_res = json!(created_sess.unwrap()).to_string();
                      let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        json_res.len(),
                        json_res
                      );
                      let _ = stream.write_all(response.as_bytes()).await;
                    } else {
                      let err_json = json!({ "error": err_msg }).to_string();
                      let response = format!(
                        "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        err_json.len(),
                        err_json
                      );
                      let _ = stream.write_all(response.as_bytes()).await;
                    }
                  } else if full_path == "/api/sessions/delete" {
                    let mut success = false;
                    let mut err_msg = "Unknown error".to_string();
                    
                    let body = if body_start <= req_str.len() { &req_str[body_start..] } else { "" };
                    if let Ok(payload) = serde_json::from_str::<serde_json::Value>(body) {
                      let session_id = payload.get("id").and_then(|v| v.as_str()).unwrap_or("");
                      match crate::session::delete_session(&app_handle, session_id) {
                        Ok(_) => {
                          success = true;
                        }
                        Err(e) => {
                          err_msg = e;
                        }
                      }
                    } else {
                      err_msg = "Failed to parse body JSON".to_string();
                    }

                    if success {
                      let response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"success\":true}";
                      let _ = stream.write_all(response.as_bytes()).await;
                    } else {
                      let err_json = json!({ "error": err_msg }).to_string();
                      let response = format!(
                        "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        err_json.len(),
                        err_json
                      );
                      let _ = stream.write_all(response.as_bytes()).await;
                    }
                  } else if full_path == "/api/sessions/respond_tool" {
                    let mut success = false;
                    let mut err_msg = "Unknown error".to_string();
                    
                    let body = if body_start <= req_str.len() { &req_str[body_start..] } else { "" };
                    if let Ok(payload) = serde_json::from_str::<serde_json::Value>(body) {
                      let session_id = payload.get("session_id").and_then(|v| v.as_str()).unwrap_or("");
                      let tool_call_id = payload.get("tool_call_id").and_then(|v| v.as_str()).unwrap_or("");
                      let approve = payload.get("approve").and_then(|v| v.as_bool()).unwrap_or(false);
                      
                      let state = app_handle.state::<AppState>();
                      let mut lock = state.pending_confirmation.lock().await;
                      if let Some(pending) = lock.take() {
                        if pending.session_id == session_id && pending.tool_call_id == tool_call_id {
                          let _ = pending.tx.send(approve);
                          success = true;
                        } else {
                          // Restore pending confirmation
                          *lock = Some(pending);
                          err_msg = "Pending confirmation does not match active session and tool ID".to_string();
                        }
                      } else {
                        err_msg = "No pending confirmation found".to_string();
                      }
                    } else {
                      err_msg = "Failed to parse body JSON".to_string();
                    }

                    if success {
                      let response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"success\":true}";
                      let _ = stream.write_all(response.as_bytes()).await;
                    } else {
                      let err_json = json!({ "error": err_msg }).to_string();
                      let response = format!(
                        "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        err_json.len(),
                        err_json
                      );
                      let _ = stream.write_all(response.as_bytes()).await;
                    }
                  } else if full_path.starts_with("/api/sessions/") && !full_path.ends_with("/send") {
                    let session_id = full_path.trim_start_matches("/api/sessions/");
                    match load_session(&app_handle, session_id) {
                      Ok(sess) => {
                        let json_res = json!(sess).to_string();
                        let response = format!(
                          "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                          json_res.len(),
                          json_res
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                      }
                      Err(e) => {
                        let err_json = json!({ "error": e }).to_string();
                        let response = format!(
                          "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                          err_json.len(),
                          err_json
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                      }
                    }
                  } else if full_path == "/api/status" {
                    let (status, last_tokens, active_id) = {
                      let state = get_share_state().lock().unwrap();
                      (state.status.clone(), state.last_tokens.clone(), state.active_session_id.clone())
                    };
                    let json_res = json!({
                      "status": status,
                      "last_tokens": last_tokens,
                      "active_session_id": active_id
                    }).to_string();
                    let response = format!(
                      "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                      json_res.len(),
                      json_res
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                  } else if full_path == "/api/sessions/send" {
                    // Extract POST body
                    let mut success = false;
                    let mut err_msg = "Unknown error".to_string();
                    
                    let body = if body_start <= req_str.len() { &req_str[body_start..] } else { "" };
                    if let Ok(payload) = serde_json::from_str::<serde_json::Value>(body) {
                      let session_id = payload.get("session_id").and_then(|v| v.as_str()).unwrap_or("");
                      let text = payload.get("text").and_then(|v| v.as_str()).unwrap_or("");
                      
                      match load_session(&app_handle, session_id) {
                        Ok(mut session) => {
                          let user_msg = ChatMessage {
                            id: uuid::Uuid::new_v4().to_string()[..8].to_string(),
                            role: "user".to_string(),
                            content: text.to_string(),
                            timestamp: chrono::Utc::now().timestamp_millis(),
                            tool_calls: None,
                          };
                          session.messages.push(user_msg);
                          session.updated_at = chrono::Utc::now().timestamp_millis();
                          let _ = save_session(&app_handle, &session);
                          
                          // Trigger agent loop in the background!
                          let config = crate::config::load_config(&app_handle);
                          let state = app_handle.state::<AppState>();
                          let state_clone = state.pending_confirmation.clone();
                          let sess_id_str = session_id.to_string();
                          let app_h = app_handle.clone();
                          
                          // Set global share state active values
                          {
                            let mut share = get_share_state().lock().unwrap();
                            share.active_session_id = Some(sess_id_str.clone());
                            share.status = "thinking".to_string();
                            share.last_tokens = String::new();
                          }

                          tokio::spawn(async move {
                            crate::agent::run_agent_loop(app_h, sess_id_str, config, state_clone).await;
                          });
                          
                          success = true;
                        }
                        Err(e) => {
                          err_msg = e;
                        }
                      }
                    } else {
                      err_msg = "Failed to parse body JSON".to_string();
                    }

                    if success {
                      let response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"success\":true}";
                      let _ = stream.write_all(response.as_bytes()).await;
                    } else {
                      let err_json = json!({ "error": err_msg }).to_string();
                      let response = format!(
                        "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        err_json.len(),
                        err_json
                      );
                      let _ = stream.write_all(response.as_bytes()).await;
                    }
                  } else {
                    let response = "HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\nConnection: close\r\n\r\nNot Found";
                    let _ = stream.write_all(response.as_bytes()).await;
                  }
                }
              });
            }
          }
        }
      }
    });
  });

  Ok(server_urls)
}


// Stops active web server
pub fn stop_http_server() -> Result<(), String> {
  let mut state = get_share_state().lock().unwrap();
  if let Some(tx) = state.shutdown_tx.take() {
    let _ = tx.send(());
  }
  state.server_url = None;
  Ok(())
}
