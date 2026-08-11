const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const os = require('os');
const { exec } = require('child_process');
const QRCode = require('qrcode');
const Jimp = require('jimp');
const QrCodeReader = require('qrcode-reader');
const express = require('express');
const crypto = require('crypto');

// ═══════ KONFIG ═══════
const TOKEN = '8650738683:AAGwbBb5oDu0pCOh3ptfZAsoLnDeSmORvLU';
const OWNER = '1402999777';
const DATA = './data.json';
const TEMP = './temp';

// ═══════ SETUP ═══════
const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
app.use(express.static(__dirname));
fs.ensureDirSync(TEMP);

// ═══════ DATABASE ═══════
let DB = { users: [], bans: [] };
if (fs.existsSync(DATA)) DB = fs.readJsonSync(DATA);
const save = () => fs.writeJsonSync(DATA, DB, { spaces: 2 });

// ═══════ HELPERS ═══════
const reply = (msg, text, opts) => bot.sendMessage(msg.chat.id, text, { reply_to_message_id: msg.message_id, ...opts });
const editMsg = (chatId, msgId, text, opts) => bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opts }).catch(() => {});
const isOwner = (msg) => String(msg.from.id) === OWNER;
const getUptime = () => moment.duration(process.uptime(), 'seconds').humanize();

// ═══════ LOADING BOX GENERATOR ═══════
const loadingFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const makeLoadingBox = (percent, frame, text) => {
    const bar = '█'.repeat(Math.floor(percent / 10)) + '░'.repeat(10 - Math.floor(percent / 10));
    return `┌─────────────────────┐
│  ${loadingFrames[frame]} ${text.padEnd(16)} │
│  [${bar}] ${percent}%  │
└─────────────────────┘`;
};

// ═══════ MIDDLEWARE ═══════
bot.on('message', (msg, next) => {
    if (DB.bans.includes(String(msg.from.id)) && msg.text && msg.text.startsWith('/')) {
        return reply(msg, '🚫 Anda dibanned.');
    }
    next();
});

// ═══════════════════════════════════════════
//  MENU /start
// ═══════════════════════════════════════════
bot.onText(/\/start/, (msg) => {
    if (!isOwner(msg)) return reply(msg, '🔒 Bot private. Gunakan /akses untuk request.');
    
    reply(msg, `╔══════════════════════╗
║  🐍 RANZ BOT AKTIF  ║
╠══════════════════════╣
║ Owner: @${msg.from.username || msg.from.first_name}
║ Uptime: ${getUptime()}
╠══════════════════════╣
║ /menu — Semua menu
║ /akses — Request akses
╚══════════════════════╝`);
});

// ═══════════════════════════════════════════
//  MENU /akses
// ═══════════════════════════════════════════
bot.onText(/\/akses/, (msg) => {
    const user = msg.from;
    if (String(user.id) === OWNER) return reply(msg, '✅ Anda adalah owner.');
    if (DB.users.find(u => u.id === String(user.id) && u.verified)) return reply(msg, '✅ Anda sudah terdaftar.');

    const kode = Math.floor(100000 + Math.random() * 900000);
    
    const existing = DB.users.find(u => u.id === String(user.id));
    if (existing) {
        existing.kode = String(kode);
    } else {
        DB.users.push({ 
            id: String(user.id), 
            username: user.username || '', 
            first_name: user.first_name || '',
            kode: String(kode),
            verified: false,
            joined: Date.now()
        });
    }
    save();

    bot.sendMessage(OWNER, `🔐 *PERMINTAAN AKSES*\n\n👤 Nama: ${user.first_name}\n👥 Username: @${user.username || '-'}\n🆔 ID: \`${user.id}\`\n🔑 Kode: *${kode}*\n\nBalas: /terima ${user.id} atau /tolak ${user.id}`, { parse_mode: 'Markdown' });
    
    reply(msg, '✅ Permintaan akses dikirim ke owner.\nKode verifikasi Anda: *' + kode + '*', { parse_mode: 'Markdown' });
});

// ═══════ OWNER: TERIMA/TOLAK ═══════
bot.onText(/\/terima (.+)/, (msg, match) => {
    if (!isOwner(msg)) return;
    const id = match[1].trim();
    const user = DB.users.find(u => u.id === id);
    if (!user) return reply(msg, '❌ User tidak ditemukan.');
    user.verified = true;
    save();
    reply(msg, '✅ User diterima.');
    bot.sendMessage(id, '✅ Akses Anda diterima! Gunakan /menu.');
});

bot.onText(/\/tolak (.+)/, (msg, match) => {
    if (!isOwner(msg)) return;
    const id = match[1].trim();
    DB.users = DB.users.filter(u => u.id !== id);
    save();
    reply(msg, '❌ User ditolak.');
    bot.sendMessage(id, '❌ Akses Anda ditolak.');
});

// ═══════ MIDDLEWARE AKSES ═══════
const requireAccess = (handler) => (msg, match) => {
    if (isOwner(msg)) return handler(msg, match);
    const user = DB.users.find(u => u.id === String(msg.from.id) && u.verified);
    if (!user) return reply(msg, '🔒 Anda belum punya akses. Gunakan /akses untuk request.');
    handler(msg, match);
};

// ═══════════════════════════════════════════
//  MENU /menu
// ═══════════════════════════════════════════
bot.onText(/\/menu/, requireAccess((msg) => {
    reply(msg, `╔══════════════════════════════╗
║    🐍 MENU UTAMA (53)      ║
╠══════════════════════════════╣
║ 📱 *UTILITAS*               ║
║ /ping — Cek bot online      ║
║ /info — Info server         ║
║ /uptime — Waktu hidup       ║
║ /time — Jam sekarang        ║
║ /date — Tanggal             ║
║ /calc [math] — Kalkulator   ║
║ /translate [text] — Trjemh  ║
║ /qrgen [text] — Buat QR     ║
║ /qrscan — Scan QR (reply)   ║
╠══════════════════════════════╣
║ 🌐 *WEB & NETWORK*          ║
║ /ipinfo [ip] — Info IP      ║
║ /whois [domain] — Whois     ║
║ /dns [domain] — DNS lookup  ║
║ /pingweb [url] — Ping web   ║
║ /headers [url] — HTTP header║
║ /ssweb [url] — Screenshot   ║
║ /cweb [url] — Copy HTML 100%║
║ /source [url] — View source ║
║ /links [url] — Extract link ║
║ /title [url] — Get title    ║
╠══════════════════════════════╣
║ 🔍 *SEARCH & DOWNLOAD*      ║
║ /google [q] — Search        ║
║ /yt [q] — YouTube search    ║
║ /wiki [q] — Wikipedia       ║
║ /github [user] — GitHub     ║
║ /npm [pkg] — NPM info       ║
╠══════════════════════════════╣
║ 🛠️ *TOOLS*                  ║
║ /encrypt [text] — Encrypt   ║
║ /decrypt [text] — Decrypt   ║
║ /hash [text] — Hash MD5     ║
║ /base64e [text] — Encode    ║
║ /base64d [text] — Decode    ║
║ /random — Random number     ║
║ /uuid — Generate UUID       ║
║ /password — Gen password    ║
║ /count [text] — Hitung kata ║
║ /reverse [text] — Balik     ║
╠══════════════════════════════╣
║ 👥 *USER MANAGEMENT*        ║
║ /userlist — Daftar user     ║
║ /ban @user — Ban user       ║
║ /unban @user — Unban user   ║
║ /info @user — Info user     ║
║ /broadcast [text] — BC      ║
║ /stats — Statistik bot      ║
╠══════════════════════════════╣
║ 🎮 *FUN*                    ║
║ /joke — Random joke         ║
║ /quote — Random quote       ║
║ /fact — Random fact         ║
║ /dice — Roll dadu           ║
║ /coin — Koin flip           ║
║ /say [text] — Bot ngomong   ║
╚══════════════════════════════╝`, { parse_mode: 'Markdown' });
}));

// ═══════════════════════════════════════════
//  📱 UTILITAS
// ═══════════════════════════════════════════
bot.onText(/\/ping/, requireAccess((msg) => reply(msg, `🏓 Pong! ${Date.now() - msg.date * 1000}ms`)));
bot.onText(/\/uptime/, requireAccess((msg) => reply(msg, `⏱️ ${getUptime()}`)));
bot.onText(/\/time/, requireAccess((msg) => reply(msg, `🕐 ${moment().format('HH:mm:ss')}`)));
bot.onText(/\/date/, requireAccess((msg) => reply(msg, `📅 ${moment().format('DD MMMM YYYY')}`)));

bot.onText(/\/info/, requireAccess((msg) => {
    reply(msg, `╔════════════════╗
║  🖥️ SERVER INFO ║
╠════════════════╣
║ OS: ${os.type()} ${os.release()}
║ CPU: ${os.cpus()[0].model}
║ RAM: ${(os.totalmem()/1024/1024/1024).toFixed(1)} GB
║ Uptime: ${getUptime()}
║ Node: ${process.version}
║ Users: ${DB.users.length}
║ Bans: ${DB.bans.length}
╚════════════════╝`);
}));

bot.onText(/\/calc (.+)/, requireAccess((msg, match) => {
    try { reply(msg, `🧮 ${match[1]} = ${eval(match[1])}`); }
    catch { reply(msg, '❌ Error kalkulasi.'); }
}));

bot.onText(/\/translate (.+)/, requireAccess(async (msg, match) => {
    try {
        const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(match[1])}&langpair=auto|id`);
        reply(msg, `🌐 ${res.data.responseData.translatedText}`);
    } catch { reply(msg, '❌ Gagal translate.'); }
}));

bot.onText(/\/qrgen (.+)/, requireAccess(async (msg, match) => {
    const file = path.join(TEMP, `qr_${Date.now()}.png`);
    await QRCode.toFile(file, match[1]);
    bot.sendPhoto(msg.chat.id, file, { reply_to_message_id: msg.message_id });
    setTimeout(() => fs.remove(file), 5000);
}));

bot.onText(/\/qrscan/, requireAccess(async (msg) => {
    if (!msg.reply_to_message?.photo) return reply(msg, '❌ Balas foto QR code.');
    
    const photo = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1];
    const file = await bot.getFileLink(photo.file_id);
    const imgPath = path.join(TEMP, `scan_${Date.now()}.png`);
    
    const res = await axios({ url: file, responseType: 'arraybuffer' });
    fs.writeFileSync(imgPath, res.data);
    
    Jimp.read(imgPath, (err, img) => {
        if (err) return reply(msg, '❌ Gagal baca gambar.');
        const qr = new QrCodeReader();
        qr.callback = (err, val) => {
            fs.removeSync(imgPath);
            if (err) return reply(msg, '❌ QR tidak terdeteksi.');
            reply(msg, `✅ *Hasil Scan:*\n\`${val.result}\``, { parse_mode: 'Markdown' });
            console.log(`[QR SCAN] ${val.result}`);
        };
        qr.decode(img.bitmap);
    });
}));

// ═══════════════════════════════════════════
//  🌐 WEB & NETWORK
// ═══════════════════════════════════════════
bot.onText(/\/ipinfo (.+)/, requireAccess(async (msg, match) => {
    try {
        const res = await axios.get(`http://ip-api.com/json/${match[1]}`);
        const d = res.data;
        reply(msg, `🌍 *${d.query}*\n📍 ${d.city}, ${d.country}\n🏢 ${d.isp}\n📌 ${d.lat}, ${d.lon}`, { parse_mode: 'Markdown' });
    } catch { reply(msg, '❌ Gagal lookup.'); }
}));

bot.onText(/\/whois (.+)/, requireAccess(async (msg, match) => {
    try {
        const res = await axios.get(`https://api.domainsdb.info/v1/domains/search?domain=${match[1]}`);
        if (!res.data.domains.length) return reply(msg, '❌ Tidak ditemukan.');
        const d = res.data.domains[0];
        reply(msg, `🌐 *${d.domain}*\n📅 Created: ${d.create_date || '-'}\n📅 Expires: ${d.expire_date || '-'}`, { parse_mode: 'Markdown' });
    } catch { reply(msg, '❌ Gagal whois.'); }
}));

bot.onText(/\/dns (.+)/, requireAccess(async (msg, match) => {
    try {
        const res = await axios.get(`https://dns.google/resolve?name=${match[1]}&type=A`);
        const records = res.data.Answer?.map(a => a.data).join(', ') || 'Tidak ada record.';
        reply(msg, `📡 DNS *${match[1]}*:\n${records}`, { parse_mode: 'Markdown' });
    } catch { reply(msg, '❌ Gagal DNS lookup.'); }
}));

bot.onText(/\/pingweb (.+)/, requireAccess(async (msg, match) => {
    const start = Date.now();
    const url = match[1].startsWith('http') ? match[1] : `https://${match[1]}`;
    try {
        await axios.get(url, { timeout: 10000 });
        reply(msg, `✅ Online — ${Date.now() - start}ms`);
    } catch { reply(msg, `❌ Offline — ${Date.now() - start}ms`); }
}));

bot.onText(/\/headers (.+)/, requireAccess(async (msg, match) => {
    try {
        const url = match[1].startsWith('http') ? match[1] : `https://${match[1]}`;
        const res = await axios.get(url);
        reply(msg, `📋 Headers:\n\`\`\`json\n${JSON.stringify(res.headers, null, 2).substring(0, 3500)}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) { reply(msg, '❌ Gagal ambil headers.'); }
}));

bot.onText(/\/ssweb (.+)/, requireAccess(async (msg, match) => {
    const url = match[1].startsWith('http') ? match[1] : `https://${match[1]}`;
    reply(msg, '⏳ Screenshot diproses...');
    try {
        const res = await axios.get(`https://image.thum.io/get/width/800/crop/600/${url}`, { responseType: 'arraybuffer' });
        const file = path.join(TEMP, `ss_${Date.now()}.png`);
        fs.writeFileSync(file, res.data);
        bot.sendPhoto(msg.chat.id, file, { caption: url });
        setTimeout(() => fs.remove(file), 5000);
    } catch { reply(msg, '❌ Gagal screenshot.'); }
}));

// ═══════════════════════════════════════════
//  🔥 CWEB - COPY HTML 100% DENGAN LOADING BOX KECIL & KIRIM FILE
// ═══════════════════════════════════════════
bot.onText(/\/cweb (.+)/, requireAccess(async (msg, match) => {
    const url = match[1].startsWith('http') ? match[1] : `https://${match[1]}`;
    const chatId = msg.chat.id;
    
    // Kirim loading box awal
    const loadingMsg = await reply(msg, makeLoadingBox(0, 0, 'Memulai...'));
    const msgId = loadingMsg.message_id;
    
    let frame = 0;
    let percent = 0;
    
    // Animasi loading
    const loadingInterval = setInterval(() => {
        frame = (frame + 1) % 10;
        if (percent < 90) percent += Math.floor(Math.random() * 15) + 5;
        if (percent > 90) percent = 90;
        editMsg(chatId, msgId, makeLoadingBox(percent, frame, 'Mendownload...'));
    }, 400);

    try {
        // Step 1: Download HTML
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            maxRedirects: 5,
            timeout: 30000,
            responseType: 'text'
        });

        clearInterval(loadingInterval);
        
        // Step 2: Parsing & Inject Base Tag
        const $ = cheerio.load(response.data);
        
        // Tambahkan base tag agar resource relatif tetap bekerja
        $('head').prepend(`<base href="${url}">`);
        
        // Dapatkan HTML lengkap
        const fullHTML = $.html();
        const sizeKB = (Buffer.byteLength(fullHTML, 'utf8') / 1024).toFixed(1);
        
        // Step 3: Simpan ke file
        const domain = new URL(url).hostname;
        const timestamp = moment().format('YYYYMMDD_HHmmss');
        const fileName = `${domain}_${timestamp}.html`;
        const filePath = path.join(TEMP, fileName);
        
        fs.writeFileSync(filePath, fullHTML, 'utf8');
        
        // Step 4: Update loading ke 100% lalu hapus
        editMsg(chatId, msgId, makeLoadingBox(100, 9, 'Selesai!'));
        await new Promise(r => setTimeout(r, 500));
        bot.deleteMessage(chatId, msgId).catch(() => {});
        
        // Step 5: Kirim ringkasan + file
        const summary = `╔══════════════════════╗
║  ✅ COPY WEB SUKSES  ║
╠══════════════════════╣
║ URL: ${url.substring(0, 30)}...
║ Domain: ${domain}
║ Size: ${sizeKB} KB
║ File: ${fileName}
║ Status: 100% Complete
╚══════════════════════╝`;
        
        // Kirim file HTML
        await bot.sendDocument(chatId, filePath, {
            caption: summary,
            reply_to_message_id: msg.message_id
        });
        
        // Log ke console
        console.log(`[CWEB] ✅ ${url} -> ${fileName} (${sizeKB} KB)`);
        
        // Bersihkan file setelah 10 detik
        setTimeout(() => fs.remove(filePath).catch(() => {}), 10000);
        
    } catch (error) {
        clearInterval(loadingInterval);
        bot.deleteMessage(chatId, msgId).catch(() => {});
        
        const errorMsg = `╔══════════════════════╗
║  ❌ COPY WEB GAGAL   ║
╠══════════════════════╣
║ URL: ${url.substring(0, 30)}...
║ Error: ${error.message.substring(0, 30)}
╚══════════════════════╝`;
        
        reply(msg, errorMsg);
        console.log(`[CWEB] ❌ ${url} -> ${error.message}`);
    }
}));

bot.onText(/\/source (.+)/, requireAccess(async (msg, match) => {
    try {
        const res = await axios.get(match[1]);
        reply(msg, `\`\`\`html\n${res.data.substring(0, 4000)}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch { reply(msg, '❌ Gagal ambil source.'); }
}));

bot.onText(/\/links (.+)/, requireAccess(async (msg, match) => {
    try {
        const res = await axios.get(match[1]);
        const $ = cheerio.load(res.data);
        const links = [];
        $('a').each((i, el) => { if ($(el).attr('href')) links.push($(el).attr('href')); });
        reply(msg, `🔗 ${links.length} link:\n${links.slice(0, 50).join('\n')}`);
    } catch { reply(msg, '❌ Gagal ekstrak link.'); }
}));

bot.onText(/\/title (.+)/, requireAccess(async (msg, match) => {
    try {
        const res = await axios.get(match[1]);
        const $ = cheerio.load(res.data);
        reply(msg, `📝 ${$('title').text() || 'Tidak ada title.'}`);
    } catch { reply(msg, '❌ Gagal ambil title.'); }
}));

// ═══════════════════════════════════════════
//  🔍 SEARCH & DOWNLOAD
// ═══════════════════════════════════════════
bot.onText(/\/google (.+)/, requireAccess(async (msg, match) => {
    try {
        const res = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(match[1])}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const results = [];
        $('h3').each((i, el) => {
            const title = $(el).text();
            const link = $(el).closest('a').attr('href');
            if (title && results.length < 5) results.push(`${results.length+1}. ${title}`);
        });
        reply(msg, results.join('\n') || 'Tidak ada hasil.');
    } catch { reply(msg, '❌ Gagal search.'); }
}));

bot.onText(/\/yt (.+)/, requireAccess((msg, match) => {
    reply(msg, `🔗 https://www.youtube.com/results?search_query=${encodeURIComponent(match[1])}`);
}));

bot.onText(/\/wiki (.+)/, requireAccess(async (msg, match) => {
    try {
        const res = await axios.get(`https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(match[1])}`);
        reply(msg, `📚 *${res.data.title}*\n${res.data.extract?.substring(0, 1000)}...\n🔗 ${res.data.content_urls?.desktop?.page}`, { parse_mode: 'Markdown' });
    } catch { reply(msg, '❌ Tidak ditemukan.'); }
}));

bot.onText(/\/github (.+)/, requireAccess(async (msg, match) => {
    try {
        const res = await axios.get(`https://api.github.com/users/${match[1]}`);
        reply(msg, `👤 *${res.data.login}*\n📝 ${res.data.bio || '-'}\n📦 ${res.data.public_repos} repos\n👥 ${res.data.followers} followers\n🔗 ${res.data.html_url}`, { parse_mode: 'Markdown' });
    } catch { reply(msg, '❌ Tidak ditemukan.'); }
}));

bot.onText(/\/npm (.+)/, requireAccess(async (msg, match) => {
    try {
        const res = await axios.get(`https://registry.npmjs.org/${match[1]}`);
        const d = res.data;
        const latest = d['dist-tags']?.latest;
        reply(msg, `📦 *${d.name}* v${latest}\n📝 ${d.description?.substring(0, 200) || '-'}\n🔗 https://npmjs.com/${d.name}`, { parse_mode: 'Markdown' });
    } catch { reply(msg, '❌ Tidak ditemukan.'); }
}));

// ═══════════════════════════════════════════
//  🛠️ TOOLS
// ═══════════════════════════════════════════
bot.onText(/\/encrypt (.+)/, requireAccess((msg, match) => {
    const cipher = crypto.createCipher('aes-256-cbc', 'ranz-secret-key');
    let encrypted = cipher.update(match[1], 'utf8', 'hex');
    encrypted += cipher.final('hex');
    reply(msg, `🔒 \`${encrypted}\``, { parse_mode: 'Markdown' });
}));

bot.onText(/\/decrypt (.+)/, requireAccess((msg, match) => {
    try {
        const decipher = crypto.createDecipher('aes-256-cbc', 'ranz-secret-key');
        let decrypted = decipher.update(match[1], 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        reply(msg, `🔓 ${decrypted}`);
    } catch { reply(msg, '❌ Gagal decrypt.'); }
}));

bot.onText(/\/hash (.+)/, requireAccess((msg, match) => {
    const md5 = crypto.createHash('md5').update(match[1]).digest('hex');
    const sha256 = crypto.createHash('sha256').update(match[1]).digest('hex');
    reply(msg, `#️⃣ MD5: \`${md5}\`\nSHA256: \`${sha256}\``, { parse_mode: 'Markdown' });
}));

bot.onText(/\/base64e (.+)/, requireAccess((msg, match) => {
    reply(msg, `📝 \`${Buffer.from(match[1]).toString('base64')}\``, { parse_mode: 'Markdown' });
}));

bot.onText(/\/base64d (.+)/, requireAccess((msg, match) => {
    try {
        reply(msg, `📝 ${Buffer.from(match[1], 'base64').toString('utf8')}`);
    } catch { reply(msg, '❌ Invalid base64.'); }
}));

bot.onText(/\/random/, requireAccess((msg) => {
    reply(msg, `🎲 ${Math.floor(Math.random() * 999999)}`);
}));

bot.onText(/\/uuid/, requireAccess((msg) => {
    reply(msg, `🆔 \`${crypto.randomUUID()}\``, { parse_mode: 'Markdown' });
}));

bot.onText(/\/password/, requireAccess((msg) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 16; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    reply(msg, `🔑 \`${pass}\``, { parse_mode: 'Markdown' });
}));

bot.onText(/\/count (.+)/, requireAccess((msg, match) => {
    reply(msg, `📏 ${match[1].length} karakter, ${match[1].split(/\s+/).length} kata`);
}));

bot.onText(/\/reverse (.+)/, requireAccess((msg, match) => {
    reply(msg, `🔄 ${match[1].split('').reverse().join('')}`);
}));

// ═══════════════════════════════════════════
//  👥 USER MANAGEMENT
// ═══════════════════════════════════════════
bot.onText(/\/userlist/, requireAccess((msg) => {
    if (!isOwner(msg)) return reply(msg, '🔒 Hanya owner.');
    const list = DB.users.map((u, i) => `${i+1}. ${u.first_name} (@${u.username || '-'}) - ${u.verified ? '✅' : '⏳'} [${u.id}]`).join('\n');
    reply(msg, `👥 *Daftar User (${DB.users.length})*\n\n${list || 'Belum ada user.'}`, { parse_mode: 'Markdown' });
}));

bot.onText(/\/ban (.+)/, requireAccess((msg, match) => {
    if (!isOwner(msg)) return reply(msg, '🔒 Hanya owner.');
    const target = match[1].replace('@', '').trim();
    const user = DB.users.find(u => u.id === target || u.username === target);
    if (!user) return reply(msg, '❌ User tidak ditemukan.');
    if (DB.bans.includes(user.id)) return reply(msg, '❌ Sudah dibanned.');
    DB.bans.push(user.id);
    save();
    reply(msg, `🚫 ${user.first_name} telah dibanned.`);
}));

bot.onText(/\/unban (.+)/, requireAccess((msg, match) => {
    if (!isOwner(msg)) return reply(msg, '🔒 Hanya owner.');
    const target = match[1].replace('@', '').trim();
    const idx = DB.bans.indexOf(target);
    if (idx === -1) {
        const user = DB.users.find(u => u.id === target || u.username === target);
        if (!user) return reply(msg, '❌ Tidak ditemukan.');
        DB.bans = DB.bans.filter(id => id !== user.id);
    } else {
        DB.bans.splice(idx, 1);
    }
    save();
    reply(msg, '✅ User di-unban.');
}));

bot.onText(/\/broadcast (.+)/, requireAccess((msg, match) => {
    if (!isOwner(msg)) return reply(msg, '🔒 Hanya owner.');
    const text = match[1];
    let sent = 0;
    DB.users.filter(u => u.verified).forEach(u => {
        bot.sendMessage(u.id, `📢 *Broadcast:*\n${text}`, { parse_mode: 'Markdown' }).then(() => sent++).catch(() => {});
    });
    reply(msg, `✅ Broadcast dikirim ke ${sent} user.`);
}));

bot.onText(/\/stats/, requireAccess((msg) => {
    reply(msg, `📊 *Statistik Bot*
👥 User terdaftar: ${DB.users.length}
✅ User verified: ${DB.users.filter(u => u.verified).length}
🚫 User banned: ${DB.bans.length}
⏱️ Uptime: ${getUptime()}
💾 RAM: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`, { parse_mode: 'Markdown' });
}));

// ═══════════════════════════════════════════
//  🎮 FUN
// ═══════════════════════════════════════════
bot.onText(/\/joke/, requireAccess(async (msg) => {
    try {
        const res = await axios.get('https://candaan-api.vercel.app/api/text/random');
        reply(msg, `😂 ${res.data.data}`);
    } catch { reply(msg, '😂 Kenapa programmer suka begadang? Karena kalau tidur, mimpinya error.'); }
}));

bot.onText(/\/quote/, requireAccess(async (msg) => {
    try {
        const res = await axios.get('https://api.quotable.io/random');
        reply(msg, `💬 *"${res.data.content}"*\n— ${res.data.author}`, { parse_mode: 'Markdown' });
    } catch { reply(msg, '💬 "Hidup itu seperti coding, kadang error, kadang sukses."'); }
}));

bot.onText(/\/fact/, requireAccess(async (msg) => {
    try {
        const res = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random');
        reply(msg, `🤯 ${res.data.text}`);
    } catch { reply(msg, '🤯 Tahukah kamu? Node.js dibuat dalam waktu 10 hari.'); }
}));

bot.onText(/\/dice/, requireAccess((msg) => {
    reply(msg, `🎲 ${Math.floor(Math.random() * 6) + 1}`);
}));

bot.onText(/\/coin/, requireAccess((msg) => {
    reply(msg, `🪙 ${Math.random() > 0.5 ? 'HEAD' : 'TAIL'}`);
}));

bot.onText(/\/say (.+)/, requireAccess((msg, match) => {
    reply(msg, match[1]);
}));

// ═══════════════════════════════════════════
//  WEB SERVER
// ═══════════════════════════════════════════
app.get('/', (req, res) => res.send('🐍 RANZ BOT ONLINE'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════╗
║   🐍 RANZ BOT AKTIF       ║
╠══════════════════════════════╣
║ Port   : ${PORT}
║ Owner  : ${OWNER}
║ Token  : ${TOKEN.substring(0, 10)}...
║ Status : ONLINE
╚══════════════════════════════╝
    `);
});
