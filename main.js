let express = require("express");
var cookieParser = require('cookie-parser');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
app.use(cookieParser());

//DB CONNECTION
var pool = mysql.createPool({
    host: "host",
    database: "database",
    user: "user",
    password: "password"
});

//Users connected to the server
let users = [];
//Game rooms currently online
let rooms = [];

//Access the public folder from /
app.use("/", express.static(__dirname + "/public"));

//Return login page for path /
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/Menu/index.html');
});

//Return lobby page for path /lobby
app.get('/lobby/', function(req, res) {
    res.sendFile(__dirname + '/public/Lobby/lobby.html');
});

//Return game room for /room/anyid
app.get('/room/*', function(req, res) {
    res.sendFile(__dirname + '/public/Game/game.html');
});


/*****************
 *  IO - SOCKETS  *
  ******************/
io.on('connection', function(socket) {


    /**********************
     *  MANAGING ACCOUNTS  *
     ************************/

    /**
     * Create and return a sql command ready for execution
     * @param credentials {Object} User credentials that are being used
     * @param mode {string} Mode defining what sql command we want
     * @param id {Number} Client ID
     * @returns {string} Sql command
     */
    function getDBCommand(credentials, mode, id) {
        if(mode === "login") {
            return `SELECT * FROM C4_Accounts WHERE name = "${credentials.name}" AND pw_hash = "${credentials.password}"`;
        }
        if(mode === "create_account") {
            return `INSERT INTO C4_Accounts (name, pw_hash) VALUES ("${credentials.name}", "${credentials.password}")`;
        }
        if(mode === "edit") {
            return `UPDATE C4_Accounts SET clientID = ${id} WHERE name = "${credentials.name}"`;
        }
        if(mode === "remove_id") {
            return `UPDATE C4_Accounts SET clientID = 0 WHERE id = "${id}"`;
        }
        if(mode === "checkID") {
            return `SELECT * FROM C4_Accounts WHERE clientID = ${id};`;
        }
        if(mode === "checkAccount") {
            return `SELECT * FROM C4_Accounts WHERE name = "${credentials.name}"`;
        }
    }

    /**
     * Execute the given sql command
     * @param command {string} Command to be executed
     * @param callback {function} Possible callback function
     */
    function executeDBCommand(command, callback = null) {

        console.log("Executing command " + command);

        pool.getConnection(function(err, connection) {

            //Handle possible errors
            if(err) {
                connection.release();
                throw err;
            }

            connection.query(command, function(err, result) {

                //Release connection after query
                connection.release();

                //Call callback function if one is provided
                if(callback !== null) {
                    console.log("Calling callback, results: ");
                    console.log(result);
                    callback(result);
                }

            });

        });

    }

    //When an user sends a 'create-account' request
    socket.on('create-account', function(credentials) {

        let checkAccount = getDBCommand(credentials, 'checkAccount', null);
        executeDBCommand(checkAccount, function(results) {

            if(results === undefined || results === null || results.length === 0) {

                //Name is not taken, proceed with creating the account
                let newUser = getDBCommand(credentials, 'create_account');

                executeDBCommand(newUser, function() {
                    io.to(getIp()).emit('alert', "Account created! You can now log in.");
                });

            } else {
                //Alerting user about name already being in use
                io.to(getIp()).emit('alert', `Name ${credentials.name} is already taken!`);
            }
        });

    });

    //User requests login
    socket.on('login', function(credentials) {

        //New client ID used for automatic login
        let id = Math.floor(Math.random() * 100000);

        //Get sql command for checking login
        let cmd = getDBCommand(credentials, 'login');

        //Check if given login credentials exist in database
        executeDBCommand(cmd, function(results) {
            if(results !== undefined && results !== null && results.length > 0) {
                //If we find an account with same name and password hash we change account id to client id
                pool.query(getDBCommand(credentials, 'edit', id));
            }
            //Tell the client that login was successful
            io.to(getIp()).emit('login', (results.length === 1 ? results[0].name : null), id);
        });

    });

    //Check if client id is saved in database
    socket.on('check-account', function(id) {

        if(id !== undefined && id !== null && id !== "") {

            let cmd = getDBCommand(null, 'checkID', id);
            executeDBCommand(cmd, function(results) {
                //If client id is found, automatically log in to that account
                if(results !== undefined && results !== null && results.length > 0) {
                    io.to(getIp()).emit('login', results[0].name);
                }
            });

        }

    });

    //When an user logs out, remove the client id from account
    socket.on('remove-client-id', function(id) {

        let resetID = getDBCommand(null, 'remove_id', id);
        executeDBCommand(resetID);

    });


    /**********
     *  LOBBY  *
      ***********/

    //Join the "lobby" room
    socket.join('lobby', () => {
        sendMessage("You have joined the lobby.");
    });

    /**
     * Get the ip of current socket
     * @returns {string} ip of socket
     */
    function getIp() {
        return Object.keys(socket.rooms)[0];
    }

    /**
     * Send a message to any given ip
     * @param msg {string} Message to be sent
     * @param ip {string} IP to which the message is sent, defaulted to own socket ip
     */
    function sendMessage(msg, ip = getIp()) {
        io.to(ip).emit('chat message', { sender: 'system', text: msg });
    }

    /**
     * Update the online users list
     * Empty current users list and send a 'check' event to all connected clients, to
     * which they respond by sending a 'check' event back
     */
    function updateUsers() {
        users = [];
        io.emit('check');
    }

    /**
     * Emit the online users list to every client
     */
    function emitUsers() {
        io.emit('online-users', users);
    }

    /**
     * Check who left the server
     * @param old {array} User list from before a client left
     */
    function whoLeft(old) {
        let user = old.reduce((all, user) => all + users.includes(user) ? "" : user, "");
        console.log(user + ' left, current users: ' + users);
        emitUsers();
    }

    /**
     * Check if a game room is active
     * @param roomID {Number} Room ID to be checked
     * @returns {boolean} Whether room is active or not
     */
    function roomIsActive(roomID) {

        for(room of rooms) {
            console.log(`${room.id} == ${roomID} //${room.id == roomID}`);
            if(room.id == roomID) {
                return true;
            }
        }
        console.log(`Room ${roomID} is not active.`);
        return false;
    }

    //When a client requests for game lobbies, emit all the lobbies to the client
    socket.on('get-lobbies', function() {
        let ip = getIp();
        //Emit lobbies to the client
        io.to(ip).emit('chat message', { sender: 'system', text: 'Receiving lobbies..'});
        rooms.forEach(room => io.to(ip).emit('new-lobby', room));
    });

    //When a client returns 'check' event, we add it to online users
    socket.on('check', function(user) {
        users.push(user);
    });

    //New user connected
    socket.on('joined', function(user) {
        //Update user list and emit that to all users
        users.push(user);
        console.log(user + ' connected, current users: ' + users);
        emitUsers();
    });

    //Existing user disconnected
    socket.on('disconnect', function(){
        let oldList = users;
        updateUsers();
        setTimeout(whoLeft, 1000, oldList);
    });

    //Someone sent a chat message
    socket.on('chat message', function(msg) {
        console.log(`[${msg.sender}]: ${msg.text}`);
        //Emit the chat message to everyone
        io.emit('chat message', msg);
    });

    //Someone sent a message inside a game room
    socket.on('ingame-chat-message', function(msg) {
        //Emit the message into the game room it was sent from
        io.to(msg.id).emit('ingame-chat-message', msg);
    });

    //An user created a new game lobby
    socket.on('new-lobby', function(creatorName, title) {

        //Create a new random ID for the game room and check if its a duplicate
        let id = Math.floor(Math.random() * 100000);
        let isDuplicate = rooms.some(room => room.id === id);

        //Create the room object
        let room = {
            creator      : creatorName,
            id           : id,
            title        : title,
            players      : [creatorName, null],
            currentPlayer: creatorName
        };

        //If room ID is unique, make room active
        if(!isDuplicate) {
            rooms.push(room);
            console.log(creatorName + " joined room " + id);
            io.emit('new-lobby', room);
        }

    });

    //User tries to join a game
    socket.on('join-lobby', function(data) {

        console.log(data.player + " is trying to join lobby " + data.id);

        //If room is active, we tell everyone to remove it so they cant join it anymore
        if(roomIsActive(data.id)) {
            console.log(`Room ${data.id} is active.`);

            io.emit('remove-lobby', data.id);

            //Add player to room he wants to join
            rooms.forEach(function(room) {
                if(room.id == data.id) {
                    console.log(`Adding player ${data.player} to room ${data.id}`);
                    //Set client as the 2nd player for that room
                    room.players[1] = data.player;
                    console.log(`Added new player, now room.players = ${room.players}`);
                } else {
                    console.log(`Couldn't find room..`);
                }
            });

            //Tell user to open the game window
            io.to(getIp()).emit('join-lobby', { id: data.id });
        } else {
            console.log(`${data.player} failed to join room ${data.id}.`);
        }
    });

    /*********
     *  GAME  *
      **********/

    //Player joined a game room
    socket.on('joined-game', function(data) {
        //Connect player to a private lobby, where we can emit messages privately
        socket.join(data.game);
        console.log(data.player + " joined game " + data.game);

        //Check if the room we joined is valid
        rooms.forEach(function(room) {

            //If game is active, client is a player in that game, and a 2nd player is also present, start game
            if(room.id === data.game && room.players.includes(data.player) && room.players[1] !== null) {
                io.to(data.game).emit('start-game', room.players);
            }

        });
    });

    //Game action controller, such as add coin or restart game
    socket.on('game-action', function(data) {
        io.to(data.room).emit(data.action, {
           player: data.player,
           col: data.col
        });
    });

    //Restart game request
    socket.on('reset-game-request', function(data) {
        io.to(data.game).emit('reset-game-request', data.sender);
    });

    //Restart game request successful, thus restart game
    socket.on('reset-game', function(data) {
        io.to(data.game).emit('reset-game', data);
    });

    //Either player left the game room
    socket.on('quit', function(game, leaver) {
        //Game room is no longer valid, since player(s) left
        rooms = rooms.filter(room => room.id != game);
        //Inform other player in the room that their opponent has left
        io.to(game).emit('quit', leaver);
        io.emit('remove-lobby', game);
    });

});


/*************
 *  LISTENER  *
  **************/

http.listen(51911, function() {
    console.log('Server online at localhost:51911');
});