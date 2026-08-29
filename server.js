const http = require('http');

const PORT = process.env.PORT || 3000;
// 1. Mettez votre vraie clé API Gemini ici
const API_KEY = "VOTRE_CLE_API_GEMINI_ICI"; 

// 2. Gestionnaire de limitation (Rate Limit de 15 questions par 15 min par IP)
const rateLimitMap = new Map();
const LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_REQUESTS = 15;

function isRateLimited(ip) {
    const now = Date.now();
    const userRecord = rateLimitMap.get(ip) || { count: 0, resetTime: now + LIMIT_WINDOW };

    if (now > userRecord.resetTime) {
        userRecord.count = 1;
        userRecord.resetTime = now + LIMIT_WINDOW;
    } else {
        userRecord.count++;
    }

    rateLimitMap.set(ip, userRecord);
    return userRecord.count > MAX_REQUESTS;
}

// 3. Serveur HTTP unique
const server = http.createServer((req, res) => {
    const userIp = req.socket.remoteAddress;

    // Route API POST : /api/chat
    if (req.method === 'POST' && req.url === '/api/chat') {
        if (isRateLimited(userIp)) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: { message: "Vous avez dépassé la limite de questions autorisées. Réessayez dans 15 minutes." } }));
        }

        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { prompt } = JSON.parse(body || '{}');
                if (!prompt) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: { message: "Le texte ne peut pas être vide." } }));
                }

                // Appel sécurisé à Gemini depuis le backend
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
                const apiRes = await fetch(geminiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                const data = await apiRes.json();
                res.writeHead(apiRes.status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));

            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: "Erreur serveur : " + err.message } }));
            }
        });
        return;
    }

    // Route GET / : Sert l'interface HTML
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`
<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>KING IA - Pro Chat</title>
    <style>
        :root[data-theme="dark"] {
            --bg-main: #0b0e14;
            --card-bg: #161b22;
            --header-bg: rgba(22, 27, 34, 0.85);
            --border-color: rgba(255, 255, 255, 0.08);
            --text-main: #f0f6fc;
            --text-sub: #8b949e;
            --user-bubble: linear-gradient(135deg, #0084ff, #0056b3);
            --user-text: #ffffff;
            --ia-bubble: #21262d;
            --ia-text: #e6edf3;
            --input-bg: #0d1117;
            --shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
        }

        :root[data-theme="light"] {
            --bg-main: #eef2f5;
            --card-bg: #ffffff;
            --header-bg: rgba(255, 255, 255, 0.85);
            --border-color: rgba(0, 0, 0, 0.08);
            --text-main: #1f2328;
            --text-sub: #656d76;
            --user-bubble: linear-gradient(135deg, #0084ff, #0066cc);
            --user-text: #ffffff;
            --ia-bubble: #f3f4f6;
            --ia-text: #1f2328;
            --input-bg: #f6f8fa;
            --shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            -webkit-tap-highlight-color: transparent;
        }

        body {
            height: 100vh;
            height: 100dvh;
            background-color: var(--bg-main);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            color: var(--text-main);
            overflow: hidden;
        }

        .chat-container {
            width: 100%;
            max-width: 440px;
            height: 100vh;
            height: 100dvh;
            background-color: var(--card-bg);
            border-radius: 0;
            box-shadow: var(--shadow);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border: none;
            position: relative;
        }

        @media (min-width: 480px) {
            body { padding: 10px; }
            .chat-container {
                height: 92vh;
                border-radius: 28px;
                border: 1px solid var(--border-color);
            }
        }

        .header {
            padding: 14px 18px;
            background: var(--header-bg);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 10;
        }

        .profile-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .avatar-crown {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, #ff3b5c, #99001a);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(255, 42, 75, 0.4), inset 0 2px 4px rgba(255,255,255,0.4);
            border: 2px solid #ff4d6d;
            position: relative;
            transition: background 0.3s ease;
        }

        .avatar-crown svg {
            width: 24px;
            height: 24px;
            fill: #ffd700;
            filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));
        }

        .user-details h1 {
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.3px;
        }

        .status {
            font-size: 11.5px;
            color: var(--text-sub);
            display: flex;
            align-items: center;
            gap: 5px;
            margin-top: 2px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background-color: #23c55e;
            border-radius: 50%;
            box-shadow: 0 0 8px #23c55e;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .theme-btn, .color-picker-label {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 20px;
            opacity: 0.8;
            transition: transform 0.2s ease;
        }

        .theme-btn:hover, .color-picker-label:hover { transform: scale(1.1); }
        #iaColorPicker { display: none; }

        .chat-box {
            flex: 1;
            padding: 18px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            scroll-behavior: smooth;
        }

        .message-wrapper {
            display: flex;
            flex-direction: column;
            max-width: 85%;
        }

        .message-wrapper.user {
            align-self: flex-end;
            align-items: flex-end;
        }

        .message-wrapper.ia {
            align-self: flex-start;
            align-items: flex-start;
        }

        .message {
            padding: 12px 16px;
            border-radius: 20px;
            font-size: 15px;
            line-height: 1.45;
            word-wrap: break-word;
            white-space: pre-wrap;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
            transition: background-color 0.3s ease;
        }

        .message-wrapper.user .message {
            background: var(--user-bubble);
            color: var(--user-text);
            border-bottom-right-radius: 4px;
        }

        .message-wrapper.ia .message {
            background-color: var(--ia-bubble);
            color: var(--ia-text);
            border-bottom-left-radius: 4px;
            border: 1px solid var(--border-color);
        }

        .timestamp {
            font-size: 10px;
            color: var(--text-sub);
            margin-top: 4px;
            padding: 0 4px;
        }

        .typing-indicator {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 12px 16px;
            background-color: var(--ia-bubble);
            border-radius: 20px;
            border-bottom-left-radius: 4px;
            width: fit-content;
            border: 1px solid var(--border-color);
        }

        .dot {
            width: 6px;
            height: 6px;
            background-color: var(--text-sub);
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out both;
        }

        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }

        .input-group {
            padding: 12px 16px;
            border-top: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            gap: 10px;
            background-color: var(--card-bg);
        }

        #question {
            flex: 1;
            padding: 12px 18px;
            border: 1px solid var(--border-color);
            border-radius: 24px;
            background-color: var(--input-bg);
            color: var(--text-main);
            font-size: 16px;
            outline: none;
            transition: border-color 0.2s ease;
        }

        #question:focus { border-color: #0084ff; }
        #question::placeholder { color: var(--text-sub); }

        #envoie {
            width: 44px;
            height: 44px;
            border: none;
            border-radius: 50%;
            background: var(--user-bubble);
            color: #ffffff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 10px rgba(0, 132, 255, 0.3);
            transition: transform 0.1s ease;
        }

        #envoie:active { transform: scale(0.92); }
        #envoie svg { width: 18px; height: 18px; fill: currentColor; margin-left: 2px; }
    </style>
</head>
<body>

    <div class="chat-container">
        <div class="header">
            <div class="profile-info">
                <div class="avatar-crown" id="avatarCrown">
                    <svg viewBox="0 0 24 24">
                        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                    </svg>
                </div>
                <div class="user-details">
                    <h1>KING IA</h1>
                    <div class="status"><span class="status-dot"></span> Actif maintenant</div>
                </div>
            </div>
            <div class="header-actions">
                <label for="iaColorPicker" class="color-picker-label" title="Changer la couleur de l'IA">🎨</label>
                <input type="color" id="iaColorPicker" value="#21262d" onchange="changerCouleurIA(this.value)">
                <button class="theme-btn" id="themeToggle" onclick="toggleTheme()">🌙</button>
            </div>
        </div>

        <div id="chatBox" class="chat-box">
            <div class="message-wrapper ia">
                <div class="message">Bonjour ! Je suis KING IA. Comment puis-je vous aider aujourd'hui ? 👋</div>
                <div class="timestamp" id="firstMsgTime"></div>
            </div>
        </div>

        <div class="input-group">
            <input id="question" placeholder="Écrivez un message...">
            <button id="envoie" title="Envoyer">
                <svg viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
            </button>
        </div>
    </div>

    <script>
        const question = document.getElementById("question");
        const envoie   = document.getElementById("envoie");
        const chatBox  = document.getElementById("chatBox");
        const themeToggle = document.getElementById("themeToggle");
        const avatarCrown = document.getElementById("avatarCrown");

        function getHeure() {
            const d = new Date();
            return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
        }

        document.getElementById("firstMsgTime").textContent = getHeure();

        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute("data-theme");
            if (currentTheme === "dark") {
                document.documentElement.setAttribute("data-theme", "light");
                themeToggle.textContent = "☀️";
            } else {
                document.documentElement.setAttribute("data-theme", "dark");
                themeToggle.textContent = "🌙";
            }
        }

        function changerCouleurIA(couleurHex) {
            document.documentElement.style.setProperty('--ia-bubble', couleurHex);
            avatarCrown.style.background = couleurHex;
        }

        function ajouterMessage(texte, type) {
            const wrapper = document.createElement("div");
            wrapper.classList.add("message-wrapper", type);

            const msgDiv = document.createElement("div");
            msgDiv.classList.add("message");
            msgDiv.textContent = texte;

            const timeDiv = document.createElement("div");
            timeDiv.classList.add("timestamp");
            timeDiv.textContent = getHeure();

            wrapper.appendChild(msgDiv);
            wrapper.appendChild(timeDiv);

            chatBox.appendChild(wrapper);
            chatBox.scrollTop = chatBox.scrollHeight;
            return msgDiv;
        }

        function afficherAnimationFrappe() {
            const wrapper = document.createElement("div");
            wrapper.classList.add("message-wrapper", "ia");
            wrapper.id = "typingWrapper";

            const typingDiv = document.createElement("div");
            typingDiv.classList.add("typing-indicator");
            typingDiv.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';

            wrapper.appendChild(typingDiv);
            chatBox.appendChild(wrapper);
            chatBox.scrollTop = chatBox.scrollHeight;
            return wrapper;
        }

        async function poserQuestion() {
            const texte = question.value.trim();
            if (!texte) return;

            ajouterMessage(texte, "user");
            question.value = "";

            const typingElem = afficherAnimationFrappe();

            try {
                const response = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: texte })
                });

                const data = await response.json();
                typingElem.remove();

                if (data.error) {
                    ajouterMessage("Erreur : " + data.error.message, "ia");
                    return;
                }

                if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
                    ajouterMessage(data.candidates[0].content.parts[0].text, "ia");
                } else {
                    ajouterMessage("Aucune réponse reçue.", "ia");
                }

            } catch (erreur) {
                typingElem.remove();
                ajouterMessage("Erreur de connexion : " + erreur.message, "ia");
            }
        }

        envoie.addEventListener('click', poserQuestion);
        question.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') poserQuestion();
        });
    </script>
</body>
</html>
        `);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`KING IA est démarré sur http://localhost:${PORT}`);
});