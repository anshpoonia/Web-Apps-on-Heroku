const express = require("express");
const {Server} = require("ws");

const server = express()
    //Making root directory available from index.html required files
    .use([express.static("./")])

    //sending index.html
    .get("/", (req, res) => {
        res.sendFile(__dirname + "index.html");
    })

    //Handling all the other requests and redirecting them
    .all("*", (req, res) => {
        res.redirect("/");
    })

    //starting the server
    .listen((process.env.PORT || 2000), () => console.log("Server is up"));

const wss = new Server({server});

//Storing all the active users with userid as property and ws object as value
const users = {}

//Storing all the list of users in a room with roomid as property and an array of ws objects
const rooms = {}

//regex pattern
const pattern = /^[a-z0-9-\'_\.,:\(\)&\[\]\/+=\?#@ \xC0-\xFF]+$/i;

wss.on('connection', (ws) => {

    //Assigning a unique userid to every ws connection
    const userid = stringGenerator();
    users[userid] = ws;
    ws.userid = userid;

    ws.on('message', (data) => {

        //parsing the message
        const message = JSON.parse(data);
        const messageCode = message[0];

        //WS connection is terminated if there is any violation
        if(messageCode === 0)
        {
            try
            {
                //assigning ws object with username of the user
                if(!pattern.test(message[1])) throw new Error("The message is not alpha numeric")
                ws.username = message[1];
            }
            catch (e)
            {
                console.log(e);
                ws.send(JSON.stringify([5]));
                ws.terminate();
            }
        }
        else if(messageCode === 1)
        {
            try
            {
                if(ws.roomCode) throw new Error("User is already in a room")

                if(!pattern.test(message[1])) throw new Error("The message is not alpha numeric")
                const roomCode = message[1];

                //assigning the roomCode the ws object if the room exist
                if(rooms[roomCode])
                {
                    rooms[roomCode].push(ws);
                    ws.roomCode = roomCode;
                    ws.send(JSON.stringify([3]));
                    sendUserList(ws, roomCode);
                    broadCast(roomCode, ws.username + " has joined");
                }
                else
                {
                    //creating a new room
                    ws.roomCode = roomCode;
                    rooms[roomCode] = [ws];
                    ws.send(JSON.stringify([3]));
                    ws.send(JSON.stringify([1, "Share room code with others for them to join you too."]));
                }
            }
            catch (e)
            {
                console.log(e);
                ws.send(JSON.stringify([5]));
                ws.terminate();
            }
        }
        else if(messageCode === 2)
        {
            try
            {
                if(!pattern.test(message[1])) throw new Error("The message is not alpha numeric")

                //sending message to all the users of a room
                rooms[ws.roomCode].forEach(value => {
                    value.send(JSON.stringify([2, ws.username, message[1]]));
                });
            }
            catch (e)
            {
                console.log(e);
                ws.send(JSON.stringify([5]));
                ws.terminate();
            }
        }
        else if(messageCode === 4)
        {
            //ping the keep connection alive
            ws.send(JSON.stringify([4]));
        }
        else
        {
            console.log("error")
            ws.send(JSON.stringify([5]));
            ws.terminate();
        }
    });

    ws.on("close", () => {

        //broadcasting message if a user leaves
        if(ws.roomCode)
        {
            rooms[ws.roomCode] = rooms[ws.roomCode].filter(value => {
                if(value.userid !== ws.userid) return value;
            });
            broadCast(ws.roomCode, ws.username+ " has left");
        }
        else
        {
            users[ws.userid] = null;
        }
    });
});

function sendUserList(ws, roomCode)
{
    let string = "";
    rooms[roomCode].forEach((value, index) => {

        if(value.userid === ws.userid) return

        if(index === rooms[roomCode].length-1 ) string = string + " and " + value.username + " "
        else if( index === rooms[roomCode].length-2 ) string = string + value.username + " "
        else string = string + value.username + ", "
    })
    string = string + "are there in the room."

    ws.send(JSON.stringify([1, string]));
}

function broadCast(roomCode, message)
{
    rooms[roomCode].forEach(value => {
        value.send(JSON.stringify([1, message]));
    })
}


function stringGenerator()
{
    let string = "";
    for(let i = 0 ; i < 64; i++)
    {
        const num = Math.floor(Math.random() * 26) + 97;
        string = string + String.fromCharCode(num);
    }
    return string;
}