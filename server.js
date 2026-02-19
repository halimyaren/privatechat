const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Web klasörünü yayınla
app.use(express.static(path.join(__dirname, "public")));

// ======================
// VERİTABANI
// ======================
const db = new sqlite3.Database("chat.db");

db.run(`
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT,
    receiver TEXT,
    message TEXT,
    time DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// ======================
// SADECE İZİNLİ KULLANICILAR
// ======================
const allowedUsers = ["halim", "arkadas"];
function sendUserList() {
    const list = allowedUsers.map(user => {
        return {
            username: user,
            online: users[user] ? true : false
        };
    });

    io.emit("user_list", list);
}

// Online kullanıcılar
let users = {};

// ======================
// SOCKET
// ======================
io.on("connection", (socket) => {

    socket.on("login", (username) => {
        if (!allowedUsers.includes(username)) {
            socket.emit("error_message", "Bu kullanıcıya izin yok!");
            return;
        }

        users[username] = socket.id;
        socket.username = username;

        console.log(username + " giriş yaptı");

        socket.emit("login_success");
    sendUserList();

        // Eski mesajları gönder
        db.all(
            "SELECT * FROM messages WHERE sender=? OR receiver=? ORDER BY time ASC",
            [username, username],
            (err, rows) => {
                if (!err) {
                    socket.emit("old_messages", rows);
                }
            }
        );
    });

    socket.on("private_message", (data) => {
        const { to, message } = data;

        if (!socket.username) return;

        // Veritabanına kaydet
        db.run(
            "INSERT INTO messages (sender, receiver, message) VALUES (?, ?, ?)",
            [socket.username, to, message]
        );

        // Alıcı online ise gönder
        if (users[to]) {
            io.to(users[to]).emit("private_message", {
                from: socket.username,
                message: message
            });
        }

        // Gönderene de göster
        socket.emit("private_message", {
            from: socket.username,
            message: message
        });
    });

    socket.on("disconnect", () => {
        if (socket.username) {
            delete users[socket.username];
            console.log(socket.username + " çıktı");
            sendUserList();

        }
    });
});

// ======================
// SERVER BAŞLAT
// ======================
const PORT = process.env.PORT || 3000;


server.listen(PORT, () => {
    console.log("Server çalışıyor: http://localhost:" + PORT);
});
