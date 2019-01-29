$(function() {

    let url = "http://connect4.pawz.pw";

    //Click on login or sign up button
    $("#buttons > a").click(function(event) {

        //Check if password is at least 3 characters long
        if($("#password").val().length < 3) {
            alert("Password must be at least 3 characters long!");
        } else {

            //Mode for either log in or sign up request
            let mode = event.target.getAttribute('data-mode');
            //Client id
            let id = Cookies.get('client-id');

            //Request server for login/signup
            //Password encrypted sha256
            socket.emit(mode, {
                name: $("#name").val(),
                password: sha256($("#password").val()),
                client_id: id
            });
        }
    });

    //Server response for login attempt
    socket.on('login', function(success, id) {

        //If server responds with new client id, use it
        if(id > 0) Cookies.set('client-id', id);

        //If login attempt was success, redirect to the actual website
        if(success) {
            console.log("Logged in!");
            window.location.replace(url + "/lobby");
        } else {
            alert("Incorrect login credentials!");
        }

    });

    //Helper event for alerting data
    socket.on('alert', data => alert(data));

    //Check if client id already exists
    if(Cookies.get('client-id')) {
        let id = Cookies.get('client-id');
        //If exists, try to log in with that id
        console.log(`Logging in with client id ${id}`);
        socket.emit('check-account', id);
    }

});