$(function() {

    var name = "";
    let url = "http://connect4.pawz.pw";

    //Sure way to get correct id of room
    var lobbyID = Number(document.URL.match(/\d+/g)[1]);

    //Send restart game request
    rest.addEventListener('click', function() {
        socket.emit('reset-game-request', {
            game: lobbyID,
            sender: name
        });
    });

    //Try to drop a coin in the game
    cols.forEach(function(button, index) {
        button.addEventListener('click', function() {
            //If its your turn, go send the action to server
            if(currentPlayer === name) {
                socket.emit('game-action', {
                    room: lobbyID,
                    action: 'add',
                    col: index,
                    player: name
                });
            }
        });
    });

    //Leave game and tell server about it
    $(".quit").click(function() {
        socket.emit('quit', lobbyID, name);
    });

    //Send a chat message
    $('#send-message').click(function() {
        if($('#m').val() !== "") {
            socket.emit('ingame-chat-message', {
                sender: name,
                text: $('#m').val(),
                id: lobbyID
            });
            $('#m').val('');
        }
    });

    //Automatic login result
    socket.on('login', function(_name) {

        //If successful, tell other player we're ready to play
        if(_name !== null && _name !== undefined) {

            console.log("Logged in as " + _name);
            name = _name;

            socket.emit('joined-game', {
                game: lobbyID,
                player: _name
            });

        } else {
            alert("Error authenticating your login, redirecting to login page.");
            window.location.replace(url);
        }

    });

    //Add chat message given by server to our chat locally
    socket.on('ingame-chat-message', function(msg){
        $('#messages').append($('<li>').text(`[${msg.sender}]: ${msg.text}`));
    });

    //Start game with the 2 players given by server
    socket.on('start-game', function(players) {
        currentPlayers = players;
        currentPlayer = players[0];
        paused = false;
        console.log("GAME STARTING!!");

        turn.innerHTML = `${currentPlayer}'s turn!`;

        $('#wait').hide();
        $('#container').show();
    });

    //Player requests add coin
    socket.on('add', function(data) {

        console.log(`${data.player} clicked add, currentPlayer: ${currentPlayer}`);

        if(currentPlayer === data.player) {
            add(data.col, data.player);
        }
    });

    //Player requests to restart game
    socket.on('reset-game-request', function(sender) {
        if(sender === name) {
            M.toast({html: 'Waiting for other player to accept restart request..'});
        } else {
            //Custom confirm window
            requestRestart(sender).then(function(result) {
                console.log("Restart: " + result);
                socket.emit('reset-game', {
                    game: lobbyID,
                    sender: sender,
                    restart: result,
                    name: name
                });
            });

        }
    });

    //Results from restart game request
    socket.on('reset-game', function(response) {
        if(response.restart) {
            M.toast({html: 'Game restarted!'});
            resetGame();
        } else if (response.sender === name) {
            M.toast({html: `${response.name} declined restart request!`});
        }

    });

    //Player left game, redirect back to lobby
    socket.on('quit', function(leaver) {
        if(leaver !== name) {
            alert(leaver + " left the game.");
        }
        window.location.replace(url + "/lobby");
    });

    //Automatic login attempt
    if(Cookies.get('client-id')) {
        let id = Cookies.get('client-id');
        console.log(`Logging in with client id ${id}`);
        socket.emit('check-account', id);
    }

    //If window is closed manually, alert other player before closing
    window.onbeforeunload = function(){
        socket.emit('quit', lobbyID, name);
    };

});