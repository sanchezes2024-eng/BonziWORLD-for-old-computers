var socket = null;

var myId = null;
var myPlayer = null;

var players = {};

var desktop = null;
var desktopArea = null;

var nameInput = null;
var roomInput = null;

var messageInput = null;
var startButton = null;
var submitButton = null;

var dragging = false;
var dragOffsetX = 0;
var dragOffsetY = 0;


/*
============================================================
OLD BROWSER HELPERS
============================================================
*/

function addEvent(element, eventName, handler) {
    if (element.attachEvent) {
        element.attachEvent("on" + eventName, handler);
    } else {
        element["on" + eventName] = handler;
    }
}


function trimString(value) {
    return value.replace(/^\s+|\s+$/g, "");
}


function escapeHTML(value) {
    value = String(value);

    value = value.replace(/&/g, "&amp;");
    value = value.replace(/</g, "&lt;");
    value = value.replace(/>/g, "&gt;");
    value = value.replace(/"/g, "&quot;");

    return value;
}


function getMouseX(event) {
    if (event.pageX) {
        return event.pageX;
    }

    return event.clientX +
        document.documentElement.scrollLeft +
        document.body.scrollLeft;
}


function getMouseY(event) {
    if (event.pageY) {
        return event.pageY;
    }

    return event.clientY +
        document.documentElement.scrollTop +
        document.body.scrollTop;
}


/*
============================================================
CREATE PLAYER
============================================================
*/

function createPlayer(data) {

    if (!data || !data.id) {
        return;
    }

    if (players[data.id]) {
        updatePlayer(
            data.id,
            data.x,
            data.y
        );

        return;
    }

    var player = document.createElement("div");

    player.className = "player";
    player.id = "player_" + data.id;

    player.innerHTML =
        '<div class="playerSquare"></div>' +
        '<div class="speech">' +
            '<div class="speechText"></div>' +
            '<div class="speechTail">' +
                '<div class="speechTailInner"></div>' +
            '</div>' +
        '</div>' +
        '<div class="playerName">' +
            escapeHTML(data.name) +
        '</div>';

    desktopArea.appendChild(player);

    players[data.id] = {
        element: player,
        name: data.name,
        x: data.x,
        y: data.y,
        speechTimer: null
    };

    updatePlayer(
        data.id,
        data.x,
        data.y
    );

    /*
     * Only our own character can be dragged.
     */
    if (data.id === myId) {
        makeDraggable(player);
    }
}


/*
============================================================
UPDATE PLAYER
============================================================
*/

function updatePlayer(id, x, y) {

    var player = players[id];

    if (!player) {
        return;
    }

    player.x = x;
    player.y = y;

    player.element.style.left = x + "%";
    player.element.style.top = y + "%";
}


/*
============================================================
DRAGGING
============================================================
*/

function makeDraggable(element) {

    addEvent(
        element,
        "mousedown",
        function(event) {

            event = event || window.event;

            /*
             * Only the left mouse button.
             */
            if (
                event.button !== undefined &&
                event.button !== 0 &&
                event.button !== 1
            ) {
                return;
            }

            dragging = true;

            var rectLeft = element.offsetLeft;
            var rectTop = element.offsetTop;

            var mouseX = getMouseX(event);
            var mouseY = getMouseY(event);

            dragOffsetX = mouseX - rectLeft;
            dragOffsetY = mouseY - rectTop;

            if (event.preventDefault) {
                event.preventDefault();
            }

            event.returnValue = false;
        }
    );
}


/*
============================================================
GLOBAL DRAG HANDLERS
============================================================
*/

function dragMove(event) {

    if (!dragging) {
        return;
    }

    if (!players[myId]) {
        return;
    }

    event = event || window.event;

    var mouseX = getMouseX(event);
    var mouseY = getMouseY(event);

    var areaLeft = desktopArea.offsetLeft;
    var areaTop = desktopArea.offsetTop;

    var width = desktopArea.offsetWidth;
    var height = desktopArea.offsetHeight;

    var x = mouseX - areaLeft - dragOffsetX;
    var y = mouseY - areaTop - dragOffsetY;

    /*
     * Convert pixels to percentages.
     */
    var percentX =
        (x / width) * 100;

    var percentY =
        (y / height) * 100;

    /*
     * Keep the player inside the desktop.
     */
    if (percentX < 2) {
        percentX = 2;
    }

    if (percentX > 98) {
        percentX = 98;
    }

    if (percentY < 5) {
        percentY = 5;
    }

    if (percentY > 85) {
        percentY = 85;
    }

    updatePlayer(
        myId,
        percentX,
        percentY
    );

    /*
     * Send the new position to everyone else.
     */
    socket.emit(
        "move",
        {
            x: percentX,
            y: percentY
        }
    );

    if (event.preventDefault) {
        event.preventDefault();
    }

    event.returnValue = false;
}


function dragStop(event) {

    if (!dragging) {
        return;
    }

    dragging = false;

    event = event || window.event;

    if (event.preventDefault) {
        event.preventDefault();
    }

    event.returnValue = false;
}


addEvent(
    document,
    "mousemove",
    dragMove
);

addEvent(
    document,
    "mouseup",
    dragStop
);


/*
============================================================
REMOVE PLAYER
============================================================
*/

function removePlayer(id) {

    var player = players[id];

    if (!player) {
        return;
    }

    if (player.element.parentNode) {
        player.element.parentNode.removeChild(
            player.element
        );
    }

    delete players[id];
}


/*
============================================================
SPEECH
============================================================
*/

function showSpeech(id, text) {

    var player = players[id];

    if (!player) {
        return;
    }

    var bubble = findChildByClass(
        player.element,
        "speech"
    );

    if (!bubble) {
        return;
    }

    var textElement = findChildByClass(
        bubble,
        "speechText"
    );

    if (textElement) {
        textElement.innerHTML = escapeHTML(text);
    }

    bubble.style.display = "block";

    if (player.speechTimer) {
        window.clearTimeout(
            player.speechTimer
        );
    }

    player.speechTimer = window.setTimeout(
        function() {
            bubble.style.display = "none";
        },
        5000
    );
}


function findChildByClass(element, className) {

    var children =
        element.getElementsByTagName("*");

    var i;

    for (i = 0; i < children.length; i++) {

        if (
            (" " + children[i].className + " ")
                .indexOf(" " + className + " ") !== -1
        ) {
            return children[i];
        }
    }

    return null;
}


/*
============================================================
LOGIN
============================================================
*/

function login() {

    var name = trimString(
        nameInput.value
    );

    var room = trimString(
        roomInput.value
    );

    if (!name) {
        name = "Anonymous";
    }

    if (!room) {
        room = "default";
    }

    socket.emit(
        "login",
        {
            name: name,
            room: room
        }
    );
}


/*
============================================================
SEND MESSAGE
============================================================
*/

function sendMessage() {

    var message = trimString(
        messageInput.value
    );

    if (!message) {
        return;
    }

    socket.emit(
        "message",
        message
    );

    messageInput.value = "";

    messageInput.focus();
}


/*
============================================================
SHOW DESKTOP
============================================================
*/

function showDesktop() {

    var loginScreen =
        document.getElementById("login");

    desktop.style.display = "block";
    loginScreen.style.display = "none";
}


/*
============================================================
SOCKET.IO
============================================================
*/

function connectSocket() {

    socket = io.connect(
        window.location.protocol +
        "//" +
        window.location.host,
        {
            transports: [
                "polling"
            ],
            "force new connection": true
        }
    );


    socket.on(
        "loginSuccess",
        function(data) {

            myId = data.id;

            myPlayer = data;

            showDesktop();

            createPlayer({
                id: data.id,
                name: data.name,
                x: data.x,
                y: data.y
            });

            messageInput.focus();
        }
    );


    socket.on(
        "existingPlayers",
        function(list) {

            var i;

            for (i = 0; i < list.length; i++) {

                createPlayer(
                    list[i]
                );
            }
        }
    );


    socket.on(
        "playerJoined",
        function(data) {

            createPlayer(
                data
            );
        }
    );


    socket.on(
        "playerMoved",
        function(data) {

            /*
             * Don't overwrite our own position
             * with network updates while dragging.
             */
            if (
                data.id === myId &&
                dragging
            ) {
                return;
            }

            updatePlayer(
                data.id,
                data.x,
                data.y
            );
        }
    );


    socket.on(
        "playerLeft",
        function(data) {

            removePlayer(
                data.id
            );
        }
    );


    socket.on(
        "message",
        function(data) {

            showSpeech(
                data.id,
                data.text
            );
        }
    );
}


/*
============================================================
KEYBOARD
============================================================
*/

function messageKeyDown(event) {

    event = event || window.event;

    if (event.keyCode === 13) {
        sendMessage();
    }
}


function loginKeyDown(event) {

    event = event || window.event;

    if (event.keyCode === 13) {
        login();
    }
}


/*
============================================================
INITIALIZE
============================================================
*/

function initialize() {

    desktop =
        document.getElementById("desktop");

    desktopArea =
        document.getElementById("desktopArea");

    nameInput =
        document.getElementById("name");

    roomInput =
        document.getElementById("room");

    messageInput =
        document.getElementById("messageInput");

    startButton =
        document.getElementById("startButton");

    submitButton =
        document.getElementById("submit");


    addEvent(
        submitButton,
        "click",
        login
    );

    addEvent(
        startButton,
        "click",
        sendMessage
    );

    addEvent(
        messageInput,
        "keydown",
        messageKeyDown
    );

    addEvent(
        nameInput,
        "keydown",
        loginKeyDown
    );

    addEvent(
        roomInput,
        "keydown",
        loginKeyDown
    );


    connectSocket();
}


addEvent(
    window,
    "load",
    initialize
);