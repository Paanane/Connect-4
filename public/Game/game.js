let canvas = document.getElementById("canvas");
let context = canvas.getContext('2d');
let circleSize = 100;

context.fillStyle = "SkyBlue";
context.fillRect(0, 0, 1600, 900);

let board = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0]
];

let currentPlayers = [];
let currentPlayer = -1;
let paused = true;

let cols = document.querySelectorAll(".col"),
    rest = document.getElementById("restart"),
    turn = document.getElementById("turn");

function resetGame() {
    board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0]
    ];
    paused = false;
    currentPlayer = currentPlayers[0];
    drawGame();
}

function add(index, player) {
    if (!paused && player === currentPlayer) {
        for (let i = 5; i >= 0; i--) {
            if (board[i][index] === 0) {
                board[i][index] = player === currentPlayers[0] ? 1 : 2;
                currentPlayer = player === currentPlayers[0] ? currentPlayers[1] : currentPlayers[0];
                break;
            }
        }
        drawGame();
        checkWinner();
    }
}

function gameOver(number) {
    paused = true;
    let winner = currentPlayers[number - 1];
    alert(`${winner} has won!`);
}

function requestRestart(sender) {

    return new Promise((resolve, reject) => {
        const addHandler = () => {
            let toast = document.querySelector(".toast");
            let handlers = {
                proxy(handler) {
                    M.Toast.dismissAll();
                    this[handler]();
                },
                confirm() { return resolve(true); },
                deny() { return resolve(false); }
            };

            toast.addEventListener("click", event => {
                let handler = event.target.classList[0];
                if (handler) {
                    handlers.proxy(handler)
                }
            });

            setTimeout(() => {
                handlers.proxy("deny");
            }, M.Toast.getInstance(toast).timeRemaining);

        };

        M.toast({
            html: `
                ${sender} wants to restart game.
                <button class="confirm btn-flat toast-action">Confirm</button>
                <button class="deny btn-flat toast-action">Deny</button>`,
            displayLength: 15000
        });

        addHandler();
    });

}

function checkWinner() {

    //Horizontal
    for (let row = 5; row >= 0; row--) {
        for (let column = 0; column <= 3; column++) {
                if (board[row][column] !== 0 &&
                    board[row][column] === board[row][column + 1] &&
                    board[row][column + 1] === board[row][column + 2] &&
                    board[row][column + 2] === board[row][column + 3]) {
                    gameOver(board[row][column]);
            }
        }
    }
    //Vertical
    for (let row = 5; row > 2; row--) {
        for (let column = 0; column <= 6; column++) {
            if (board[row][column] !== 0 &&
                board[row][column] === board[row - 1][column] &&
                board[row - 1][column] === board[row - 2][column] &&
                board[row - 2][column] === board[row - 3][column]) {
                gameOver(board[row][column]);
            }
        }
    }

    //Diagonal right
    for (let row = 0; row <= 2; row++) {
        for (let column = 0; column <= 3; column++) {
            if (board[row][column] !== 0 &&
                board[row][column] === board[row + 1][column + 1] &&
                board[row + 1][column + 1] === board[row + 2][column + 2] &&
                board[row + 2][column + 2] === board[row + 3][column + 3]) {
                gameOver(board[row][column]);
            }
        }
    }

    //Diagonal left
    for (let row = 0; row <= 2; row++) {
        for (let column = 6; column >= 3; column--) {
            if (board[row][column] !== 0 &&
                board[row][column] === board[row + 1][column - 1] &&
                board[row + 1][column - 1] === board[row + 2][column - 2] &&
                board[row + 2][column - 2] === board[row + 3][column - 3]) {
                gameOver(board[row][column]);
            }
        }
    }

}

function drawGame() {

    let posX, posY;

    turn.innerHTML = currentPlayer + "'s turn.";

    context.strokeStyle = "Black";
    context.fillStyle = ["Blue", "Red"][currentPlayers.indexOf(currentPlayer)];
    context.lineWidth = 2;
    context.beginPath();
    context.arc(875, 250,50, 0, 2 * Math.PI);
    context.fill();
    context.stroke();


for (let row = 0; row < 6; row++) {
    for (let column = 0; column < 7; column++) {

        let index = board[row][column];
        context.fillStyle = ["White", "Blue", "Red"][index];

        posX = column * circleSize;
        posY = row * circleSize;
        context.beginPath();
        context.arc(10 + 10 * column + posX + circleSize / 2, 40 + 10 * row + posY + circleSize / 2, 50, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
        }
    }
}

drawGame();