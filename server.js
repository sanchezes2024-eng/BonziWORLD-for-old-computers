var http = require("http");
var fs = require("fs");
var path = require("path");
var socketio = require("socket.io");

var PORT = process.env.PORT || 3000;

var server = http.createServer(function (req, res) {
    var filePath;

    if (req.url === "/" || req.url === "/index.html") {
        filePath = path.join(__dirname, "public", "index.html");
    } else {
        filePath = path.join(__dirname, "public", req.url);
    }

    filePath = path.normalize(filePath);

    var publicFolder = path.normalize(path.join(__dirname, "public"));

    if (filePath.indexOf(publicFolder) !== 0) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.readFile(filePath, function (err, data) {
        if (err) {
            res.writeHead(404);
            res.end("Not Found");
            return;
        }

        var ext = path.extname(filePath).toLowerCase();

        var contentType = "text/plain";

        if (ext === ".html") {
            contentType = "text/html";
        } else if (ext === ".css") {
            contentType = "text/css";
        } else if (ext === ".js") {
            contentType = "application/javascript";
        } else if (ext === ".json") {
            contentType = "application/json";
        } else if (ext === ".png") {
            contentType = "image/png";
        } else if (ext === ".jpg" || ext === ".jpeg") {
            contentType = "image/jpeg";
        } else if (ext === ".gif") {
            contentType = "image/gif";
        } else if (ext === ".svg") {
            contentType = "image/svg+xml";
        } else if (ext === ".ico") {
            contentType = "image/x-icon";
        }

        res.writeHead(200, {
            "Content-Type": contentType
        });

        res.end(data);
    });
});


/*
============================================================
SOCKET.IO
============================================================
*/

var io = socketio(server, {
    transports: ["polling"]
});


/*
============================================================
PLAYER STORAGE
============================================================
*/

var players = {};


/*
============================================================
RANDOM POSITION
============================================================
*/

function randomX() {
    return Math.random() * 90 + 5;
}

function randomY() {
    return Math.random() * 80 + 10;
}


/*
============================================================
CLAMP POSITION
============================================================
*/

function clamp(value, min, max) {
    if (value < min) {
        return min;
    }

    if (value > max) {
        return max;
    }

    return value;
}


/*
============================================================
CONNECTION
============================================================
*/

io.sockets.on("connection", function (socket) {

    /*
    --------------------------------------------------------
    LOGIN
    --------------------------------------------------------
    */

    socket.on("login", function (data) {

        data = data || {};

        /*
        If no name is provided, use Anonymous.
        */

        var name = data.name;

        if (!name || String(name).replace(/^\s+|\s+$/g, "") === "") {
            name = "Anonymous";
        } else {
            name = String(name).replace(/^\s+|\s+$/g, "");
        }

        var room = data.room;

        if (!room || String(room).replace(/^\s+|\s+$/g, "") === "") {
            room = "default";
        } else {
            room = String(room).replace(/^\s+|\s+$/g, "");
        }


        /*
        ----------------------------------------------------
        CREATE PLAYER
        ----------------------------------------------------
        */

        var player = {
            id: socket.id,
            name: name,
            room: room,
            x: randomX(),
            y: randomY()
        };

        players[socket.id] = player;

        socket.join(room);

        /*
        ----------------------------------------------------
        SEND LOGIN SUCCESS
        ----------------------------------------------------
        */

        socket.emit("loginSuccess", {
            id: player.id,
            name: player.name,
            room: player.room,
            x: player.x,
            y: player.y
        });


        /*
        ----------------------------------------------------
        SEND EXISTING PLAYERS
        ----------------------------------------------------
        */

        var existingPlayers = [];

        for (var id in players) {
            if (!players.hasOwnProperty(id)) {
                continue;
            }

            if (id === socket.id) {
                continue;
            }

            var other = players[id];

            if (other.room === room) {
                existingPlayers.push({
                    id: other.id,
                    name: other.name,
                    room: other.room,
                    x: other.x,
                    y: other.y
                });
            }
        }

        socket.emit("existingPlayers", existingPlayers);


        /*
        ----------------------------------------------------
        TELL EVERYONE ELSE ABOUT NEW PLAYER
        ----------------------------------------------------
        */

        socket.to(room).emit("playerJoined", {
            id: player.id,
            name: player.name,
            room: player.room,
            x: player.x,
            y: player.y
        });

    });


    /*
    --------------------------------------------------------
    MESSAGE
    --------------------------------------------------------
    */

    socket.on("message", function (data) {

        if (!players[socket.id]) {
            return;
        }

        data = data || {};

        var player = players[socket.id];

        var text = data.text;

        if (text === undefined || text === null) {
            return;
        }

        text = String(text);

        /*
        Remove whitespace around the message.
        */

        text = text.replace(/^\s+|\s+$/g, "");

        /*
        Don't send empty messages.
        */

        if (!text) {
            return;
        }

        /*
        Prevent enormous messages.
        */

        if (text.length > 500) {
            text = text.substring(0, 500);
        }

        io.to(player.room).emit("message", {
            id: player.id,
            name: player.name,
            text: text
        });

    });


    /*
    --------------------------------------------------------
    MOVE
    --------------------------------------------------------
    */

    socket.on("move", function (data) {

        if (!players[socket.id]) {
            return;
        }

        data = data || {};

        var player = players[socket.id];

        var x = parseFloat(data.x);
        var y = parseFloat(data.y);

        /*
        Ignore invalid coordinates.
        */

        if (isNaN(x) || isNaN(y)) {
            return;
        }

        /*
        Keep the character inside the desktop.
        */

        x = clamp(x, 2, 98);
        y = clamp(y, 5, 85);

        player.x = x;
        player.y = y;

        /*
        Send the new position to everyone
        in the same room.
        */

        io.to(player.room).emit("playerMoved", {
            id: player.id,
            x: player.x,
            y: player.y
        });

    });


    /*
    --------------------------------------------------------
    DISCONNECT
    --------------------------------------------------------
    */

    socket.on("disconnect", function () {

        var player = players[socket.id];

        if (!player) {
            return;
        }

        /*
        Tell everyone in the room that this player left.
        */

        io.to(player.room).emit("playerLeft", {
            id: player.id
        });

        /*
        Remove player from server memory.
        */

        delete players[socket.id];

    });

});


/*
============================================================
START SERVER
============================================================
*/

server.listen(PORT, function () {
    console.log("Chat server running on port " + PORT);
});