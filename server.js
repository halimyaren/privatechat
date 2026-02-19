const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Static files
app.use(express.static("public"));

// SQLite
const db = new sqlite3.Database("messages.db");

db.run(`
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT,
    receiver TEXT,
    message TEXT,
    time DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

let users = {}; // username -> socket.id

io.on("connection", (socket) => {

    socket.on("login", (username) => {
        users[username] = socket.id;
        socket.username = username;

        io.emit("user_list", Object.keys(users));
    });

    socket.on("private_message", (data) => {
        const { to, message } = data;
        const from = socket.username;

        // Veritabanına kaydet
        db.run(
            "INSERT INTO messages (sender, receiver, message) VALUES (?, ?, ?)",
            [from, to, message]
        );

        // Alıcı online ise gönder
        if (users[to]) {
            io.to(users[to]).emit("private_message", {
                from,
                message
            });
        }
    });

    socket.on("get_old_messages", (user2) => {
        const user1 = socket.username;

        db.all(
            `SELECT * FROM messages 
             WHERE (sender=? AND receiver=?)
             OR (sender=? AND receiver=?)
             ORDER BY time`,
            [user1, user2, user2, user1],
            (err, rows) => {
                socket.emit("old_messages", rows);
            }
        );
    });

    socket.on("disconnect", () => {
        if (socket.username) {
            delete users[socket.username];
            io.emit("user_list", Object.keys(users));
        }
    });
});

// Render port uyumu
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
