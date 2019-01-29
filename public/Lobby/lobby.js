$(function () {

    let name = "";
    let url = "http://connect4.pawz.pw";

    //Send a message
    $('#send-message').click(function() {
        if($('#m').val() !== "") {
            //Tell server that we sent a message
            socket.emit('chat message', {
                sender: name,
                text: $('#m').val()
            });
            $('#m').val('');
        }
    });

    //Create a game lobby
    $("#create-lobby").on('click', function() {
        let title = prompt("Give name for your lobby");
        if(title !== "" && title !== null) {
            //Tell server that we have made a new game lobby
            socket.emit('new-lobby', name, title);
        }
    });

    //Join a lobby
    $("#lobbies").on('click', function(event) {
       if(event.target.tagName === "I") {
           console.log("Trying to join a lobby..");
           //Tell server that we're trying to join a game lobby
           socket.emit('join-lobby', {
               id: event.target.parentNode.getAttribute('data-id'),
               player: name
           });
       }
    });

    //Log out from current account
    $("#logout").on('click', function() {
        //Tell server to not auto-login to this client anymore
        socket.emit('remove-client-id', Cookies.get('client-id'));
        Cookies.set('client-id', undefined);

        alert("Logged out");
        //Go back to login site
        window.location.replace(url);
    });

    //Automatic login
    socket.on('login', function(_name) {

        //Only get access to website if server accepts your login request
        if(_name !== null && _name.length) {

            name = _name;
            $("#name").text("Logged in as " + _name);

            socket.emit('joined', _name);
            socket.emit('get-lobbies');

            $("#account").hide();
            $("#site").show();

        } else {
            alert("Failed to log in.");
            window.location.replace(url);
        }

    });

    //Receive chat message and add it locally to our messages container
    socket.on('chat message', function(msg){
        $('#messages').append($('<li>').text(`[${msg.sender}]: ${msg.text}`));
    });

    //Respond to server's online users check
    socket.on('check', function() {
        socket.emit('check', name);
    });

    //Update online users list with data given by the server
    socket.on('online-users', function(users) {
         $("#online-users").html("");
         users.forEach(user => $("#online-users").append($('<li>').text(user)));
    });

    //Remove a lobby by id
    socket.on('remove-lobby', function(lobbyID) {
        $(`li[data-id="${lobbyID}"]`).remove();
    });

    //Create a new lobby
    socket.on('new-lobby', function(lobby) {
        //If you were the one to make the lobby, go join the lobby and wait for another player to join you
        if(lobby.creator === name) {
            window.location.replace(url + /room/ + lobby.id);
        }
        //Add the active lobby to the list of lobbies
        $("#lobbies").append($('<li data-id="' + lobby.id + '">').html(lobby.title + '<i class="material-icons">send</i>'));
    });

    //Server accepted our request to join a game
    socket.on('join-lobby', function(game) {
        console.log(`Opening game ${game.id}`);
        window.location.replace(url + "/room/" + game.id);
    });

    //If client id exists, try to log in with that
    if(Cookies.get('client-id') !== undefined && Cookies.get('client-id') > 0) {
        let id = Cookies.get('client-id');
        console.log(`Logging in with client id ${id}`);
        socket.emit('check-account', id);
    } else {
        //If couldn't log in, redirect to login page
        window.location.replace(url);
    }

});