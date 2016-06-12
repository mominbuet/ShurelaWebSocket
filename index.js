var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mapUser = {};
var mapUUID = {};
var mapDevice = {};
var mapSocket = {};
var socketController;
var express = require('express')
var bodyParser = require('body-parser')
//app.set('views', './views');
app.use("/css", express.static(__dirname + '/css'));
//app.set('view engine', 'jade');
var mysql = require('mysql');

var pool = mysql.createPool({
    connectionLimit: 200, //important
    host: '192.168.101.65',
    user: 'gunner',
    password: '123qweasd',
    database: 'shurela',
    debug: false
});
app.use(bodyParser.urlencoded({extended: false}));
/**
 * 
 * @param {type} msg contains all the post data from device
 * 
 */
function update_executed(msg) {
    pool.getConnection(function(err, connection) {
        if (err) {
            connection.release();
            console.log(JSON.stringify(({"code": 100, "status": "Error in connection database"})));
            return;
        }
        console.log(JSON.stringify(msg));
        connection.query("UPDATE sl_users_rpc set executed = 1 where subscriber_id ='" + msg.userid + "' and device_id=" + msg.deviceid, function(err, rows) {
            if (err)
                console.log(JSON.stringify("update_executed error " + err));
        });
        connection.on('error', function(err) {
            console.log(JSON.stringify(json({"code": 100, "status": "Error in connection database"})));
            return;
        });
    });
}
function update_is_alive(msg, is_alive) {
//    
    if (msg.UUID !== undefined) {
        pool.getConnection(function(err, connection) {
            if (err) {
                if (connection !== undefined)
                    connection.release();
                console.log(JSON.stringify(({"code": 100, "status": "Error in connection database"})));
                return;
            }

            connection.query("UPDATE sl_users_rpc set is_alive = " + is_alive + " where UUID ='" + msg.UUID + "'", function(err, rows) {
                if (err) {
                    console.log("IsAlive" + JSON.stringify(msg));
                    console.log("Error in updating is alive " + JSON.stringify(err));
                }
            });
            connection.on('error', function(err) {
                console.log(JSON.stringify(JSON({"code": 100, "status": "Error in connection database"})));
                return;
            });
        });
    }
}
function update_logout(userid, deviceid, command) {
    pool.getConnection(function(err, connection) {
        if (err) {
            connection.release();
            console.log(JSON.stringify(({"code": 100, "status": "Error in connection database"})));
            return;
        }
        console.log(command);
        connection.query("UPDATE sl_users_rpc set executed = 0,command = '" + command + "' where subscriber_id ='" + userid + "' and device_id=" + deviceid, function(err, rows) {
            if (!err) {
                if (socketController != undefined)
                    socketController.emit("news", "executed logout on " + userid);
            } else
                console.log(JSON.stringify("error in update logout " + err));
        });
        connection.on('error', function(err) {
            console.log(JSON.stringify(JSON({"code": 100, "status": "Error in connection database"})));
            return;
        });
    });
}
function insert_user_execute_last_command(msg, socket) {

    pool.getConnection(function(err, connection) {
        if (err) {
            connection.release();
            console.log(JSON.stringify(({"code": 100, "status": "Error in connection database"})));
            return;
        }
//        console.log('connected as id ' + connection.threadId);

//        console.log(JSON.stringify(msg));

        connection.query("select * from sl_users_rpc where UUID='" + msg.UUID + "'  limit 1", function(err, rows) {
//            connection.release();
            console.log("found " + rows.length);
            if (!err && rows.length !== 0) {

                console.log(rows[0].executed);
                if (rows[0].executed < 1) {
//                    rows[0].command["fromdb"] = "1";
//                    console.log("data in db " + JSON.stringify(rows[0]));
                    console.log("data in db " + rows[0].command);
                    socket.emit("execute", rows[0].command);
                }
                update_is_alive(msg, 1);
//                return;
            } else {
//                console.log(JSON.stringify(err));
                connection.query('INSERT INTO sl_users_rpc (subscriber_id,device_id,device_type,is_alive,session,UUID,version) VALUES ('
                        + msg.userid + ',' + msg.deviceid + ',\'' + msg.devicetype + '\',' + 1 + ',\''
                        + socket.id + '\',\'' + msg.UUID + '\',\'' + msg.version + '\')',
                        function(err, result) {
                            if (!err) {
                                console.log(JSON.stringify(result) + " inserted data in db");
                            } else
                                console.log("no insertion in db " + err);

//                            connection.release();
//                            return;
                        });
            }

        });

        connection.on('error', function(err) {
            console.log(JSON.stringify(err));
            return;
        });
        connection.release();
    });
}
app.post('/login', function(request, response) {
    console.log(request.body.user);
    console.log(request.body.password);
    if (request.body.user === "saad0209@gmail.com" && request.body.password === "123123") {
        console.log("logged in");
//        response.redirect('/home');
        response.statusCode = 200;
        response.setHeader("Location", "/home");
        response.end();

    }

});
app.post('/downloadSong', function(request, response) {
    var found = 0, executed = 0;
    for (var i in mapUser) {
//        console.log(mapUser[i] + "___ " + mapDevice[request.body.userID])
        if (mapUser[i] == request.body.userID && mapDevice[request.body.userID] == request.body.deviceID) {
            found = 1;
//            console.log(" found " + mapUser[i] + " in socket " + mapDevice[request.body.userID]);
            mapSocket[i].emit('execute', {"command": "downloadSong", "text": "{'track_id':" + request.body.trackID + ",'release_id':" + request.body.releaseID + "}"});
        }
    }
    if (found === 1)
        response.send("sent");
    else {
        update_logout(request.body.userID, request.body.deviceID, JSON.stringify({fromdb: 1, command: "downloadSong",
            text: {track_id: request.body.trackID, release_id: request.body.releaseID}}));
        response.send("future");
    }
});
app.post('/logoutUser', function(request, response) {
    var found = 0, executed = 0;
    for (var i in mapUser) {
//        console.log(mapUser[i] + "___ " + mapDevice[request.body.userID])
        if (mapUser[i] == request.body.userID && mapDevice[request.body.userID] == request.body.deviceID) {
            found = 1;
//            console.log(" found " + mapUser[i] + " in socket " + mapDevice[request.body.userID]);
            mapSocket[i].emit('execute', {"command": "logoutUser", "text": ""});
        }
    }
    if (found === 1)
        response.send("Your device is logged out.");
    else {
        update_logout(request.body.userID, request.body.deviceID, JSON.stringify({fromdb: 1, command: "logoutUser", text: ""}));
        response.send("Your device will be logged out.");
    }
});

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/login.html');
//    res.render('shurela', {
//        title: 'Shurela Monitoring'
//    });
});
/**
 * test user page
 */
app.get('/user', function(req, res) {
    res.sendFile(__dirname + '/index.html');
//    res.render('shurela', {
//        title: 'Shurela Monitoring'
//    });
});
app.get('/home', function(req, res) {
    res.sendFile(__dirname + '/shurela.html');
//    res.render('shurela', {
//        title: 'Shurela Monitoring'
//    });
});
io.on('connection', function(socket) {

    /**
     * msg is the message from the website to specific or all users
     * 
     */
    socket.on('command', function(msg) {
//        console.log(msg);
        if (msg.user === "all") {
            io.emit('execute', msg);
//            console.log("here");
        }
        else if (mapSocket[msg.user] !== undefined)
            mapSocket[msg.user].emit('execute', msg);
        else {
            if (socketController !== undefined) {
                socketController.emit('news', "User disconnected");
                socketController.emit("disconnectedUser", socket.id);
            }
            update_is_alive(JSON.parse("{userid: mapUser[socket.id], deviceid: mapDevice[mapUser[socket.id]]}"), 0);
            delete 	mapDevice[mapUser[socket.id]];
            delete 	mapUser[socket.id];
            delete 	mapSocket[socket.id];
        }
    });
    socket.on('disconnect', function() {
        //io.emit('chat message', mapUser[socket.id] + " has left");
        /*if(socket.id in mapUser)
         delete 	mapUser[socket.id];
         if(socket.id in mapSocket)
         delete 	mapSocket[socket.id];*/

//        if (socketController.id !== socket.id) {


//        console.log(socket.id + ' user disconnected,length ' + Object.keys(mapUser).length);
        if (socketController !== undefined)
            socketController.emit("disconnectedUser", socket.id);
        update_is_alive({UUID: mapUUID[socket.id], userid: mapUser[socket.id], deviceid: mapDevice[mapUser[socket.id]]}, 0);
        delete 	mapDevice[mapUser[socket.id]];
        delete 	mapUser[socket.id];
        delete 	mapSocket[socket.id];
//        } else
//            console.log("Controller gone :( ");
    });
    /**
     * after execution from user
     */
    socket.on('executed', function(msg) {
        msg = JSON.parse(msg);
        update_executed(msg);
    });
    /**
     * singular controller from website
     * this is where the website is initialized to socket 
     */
    socket.on('socketController', function(msg) {
        socketController = socket;
        socketController.emit("userList", JSON.stringify(mapUser));
//        console.log("Our boss is here ");
    });
    socket.on('reply', function(msg) {
        if (socketController !== undefined)
            socketController.emit('reply', msg);
    });
    /**
     * on initialization I need userid, deviceid, devicetype, UUID, version
     */
    socket.on('init', function(msg) {
        console.log(msg);
        msg = JSON.parse(msg);
        if ('userid' in msg) {
            mapUser[socket.id] = msg.userid;
            mapDevice[msg.userid] = msg.deviceid;
            if (socketController !== undefined)
                socketController.emit("userList", '{"' + socket.id + '":' + mapUser[socket.id] + '}');
        }
        mapUUID[socket.id] = msg.UUID;
        mapSocket[socket.id] = socket;


        insert_user_execute_last_command(msg, socket);
//        console.log(Object.keys(mapUser).length + " is connected with id " + socket.id + " msg " + mapUser[socket.id]);
//        socket.emit('chat message', "hi there, initialization done, " + Object.keys(mapUser).length + " is available for communication");
//	socket.emit('chat message', "Your ID is "+msg);
//        socket.emit('news', "{msg:'Your ID is " + msg + "'}");

    });

    socket.on('chat message', function(msg) {
        console.log(socket.id + ' message: ' + msg);
        for (var key in mapUser) {
            if (key !== socket.id) {
                console.log(key + "______" + socket.id);
                socket.emit('chat message', 'sending to ' + mapUser[key]);
                mapSocket[key].emit('chat message', "message from " + mapUser[socket.id] + " msg " + msg);
            }
//		mapSocket[key].emit('chat message', msg);	
        }
//io.emit('chat message', msg);	
    });
//    socket.on('broadcast message', function(msg) {
//        console.log(socket.id + ' broadcast message: ' + msg);
////        io.emit('chat message', msg);
//    });
});

http.listen(3001, function() {
    console.log('listening on *:3001');
});
