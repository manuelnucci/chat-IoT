const http = require('http');
const net = require('net');
const ip = require('ip');
const readline = require('readline');
const readline_sync = require('readline-sync');

const USERNAME = readline_sync.question('Ingrese nombre de usuario: ');
username = encodeURIComponent(USERNAME);
const IP_ADDRESS = '127.0.0.1'; // ip.address();
const IP_HTTP_SERVER = '127.0.0.1'; // ip.address();
const PORT_HTTP_SERVER = 8080;
const PORT_TCP_SERVER = 8081;
const PORT_TCP_CLIENT = 8082;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var offset = Number.MAX_SAFE_INTEGER;

var registration = 'http://' + IP_HTTP_SERVER + ':' + PORT_HTTP_SERVER + '/register?username=' + username +
                   '&ip=' + IP_ADDRESS + '&port=' + PORT_TCP_CLIENT;

var activeNodes = new Array();

const clientTCP = net.createConnection(PORT_TCP_SERVER, IP_HTTP_SERVER, () => { // Sincronización con el servidor
    var id = setInterval(() => {
        for (i = 0; i < 10; i++) {
            var T1 = now('milli');
            clientTCP.write(T1.toString());
        }
        clearInterval(id);
    }, 100);
});

clientTCP.on('data', function (data) {
    var T4 = now('milli');
    var times = data.toString().split(',');

    var T1 = parseInt(times[0]);
    var T2 = parseInt(times[1]);
    var T3 = parseInt(times[2]);
    var aux = ((T2 - T1) + (T3 - T4)) / 2;
    if (aux < offset)
        offset = aux;
});

clientTCP.on('close', function () {
    console.log('Conexión cerrada con el servidor NTP.');
});

clientTCP.on('error', function (err) {
    console.log(err);
});

http.get(registration, (res) => { // Registro con el servidor
    let body = '';
    
    res.on('error', function (e) {
        console.log('Problem with request:', e.message);
    });

    res.on('data', function (chunk) {
        body += chunk;
    });

    res.on('end', () => {
        activeNodes = JSON.parse(body);
        console.log('Bienvenido al chat');
        for (nodo in activeNodes) {
            var client = net.createConnection(nodo.port, nodo.ip, () => {
                var json = {
                    username: username,
                    ip: ip,
                    port: port
                };
                client.write(json);
            });

            client.on('data', (data) => {
                var mensaje = JSON.stringify(data.toString());
                receivers = mensaje.to.split(',');
                if (receivers.include('all') || receivers.include(username)) {
                    console.log('[' + (parseInt(mensaje.timestamp) - parseInt(mensaje.offset)).toString() +
                        '] ' + mensaje.from + ': ' + mensaje.message);
                }

                rl.on('line', (c) => {
                    var line = c.split('@');
                    var to;
                    var mensaje = line[0];
                    if (line.length == 1) { // El mensaje es a todos, no hubo un @
                        to = 'all';
                    } else {
                        to = '';
                        for (i = 1; i < line.length; i++) {
                            to += line[i] + ',';
                        }
                    }

                    var json = {
                        from: username,
                        to: to,
                        message: mensaje,
                        timestamp: now('milli'),
                        offset: offset
                    };
                    client.write(json);
                });

                client.on('close', () => {
                    var i = 0;
                    while (i < activeNodes.length && activeNodes[i].ip != nodo.ip && activeNodes[i].port != nodo.port)
                        i++
                    if (i < activeNodes.length)
                        activeNodes.splice(i, 1);
                });

                client.on('error', (err) => {
                    // console.log(err);
                });
            });
        }
    });
});

const server = net.createServer(function (socket) {
    socket.on('data', function (data) {
        var mensaje = JSON.stringify(data.toString());
        if (mensaje.hasOwnProperty('username')) {
            activeNodes.push(mensaje);
            console.log(mensaje.username + ' se ha conectado.')
        } else {
            receivers = mensaje.to.split(',');
            if (receivers.include('all') || receivers.include(username)) {
                console.log('[' + (parseInt(mensaje.timestamp) - parseInt(mensaje.offset)).toString() +
                    '] ' + mensaje.from + ': ' + mensaje.message);
            }

            rl.on('line', (c) => {
                var line = c.split('@');
                var to;
                var mensaje = line[0];
                if (line.length == 1) { // El mensaje es a todos, no hubo un @
                    to = 'all';
                } else {
                    to = '';
                    for (i = 1; i < line.length; i++) {
                        to += line[i] + ',';
                    }
                }

                var json = {
                    from: username,
                    to: to,
                    message: mensaje,
                    timestamp: now('milli'),
                    offset: offset
                };
                socket.write(json);
            });
        }
    });
    
    socket.on('end', () => {
        console.log('Se ha desconectado un cliente.')
    });

    socket.on('error', (err) => {
        console.log(err);
    });
}).listen(PORT_TCP_CLIENT);

server.on('close', () => {
    console.log('Usted se ha desconectado del chat.');
});

server.on('error', (err) => {
    console.log(err);
});

const now = (unit) => {
    const hrTime = process.hrtime();

    switch (unit) {
        case 'milli':
            return hrTime[0] * 1000 + hrTime[1] / 1000000;
        case 'micro':
            return hrTime[0] * 1000000 + hrTime[1] / 1000;
        case 'nano':
            return hrTime[0] * 1000000000 + hrTime[1];
        default:
            return hrTime[0] * 1000000000 + hrTime[1];
    }
};