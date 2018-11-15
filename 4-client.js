const http = require('http');
const net = require('net');
const ip = require('ip');
const readline = require('readline');
const readline_sync = require('readline-sync');

const USERNAME = readline_sync.question('Ingrese nombre de usuario: ');
username = encodeURIComponent(USERNAME);
const IP_ADDRESS = ip.address();
const IP_HTTP_SERVER = ip.address();
const PORT_HTTP_SERVER = 8080;
const PORT_TCP_SERVER = 8081;
const PORT_TCP_CLIENT = 8082;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var offset = Number.MAX_VALUE;

var activeNodes = new Array();
var sockets = new Array();

const clientTCP = net.createConnection(PORT_TCP_SERVER, IP_HTTP_SERVER, () => { // Sincronización con el servidor
    var i = 10;
    var id = setInterval(() => {
        if (i--) {
            var T1 = new Date().getTime();
            clientTCP.write(T1.toString());
        } else
            clearInterval(id);
    }, 100);
});

clientTCP.on('data', function (data) {
    var T4 = new Date().getTime();
    var times = data.toString().split(',');
    var T1 = parseInt(times[0]);
    var T2 = parseInt(times[1]);
    var T3 = parseInt(times[2]);
    var aux = ((T2 - T1) + (T3 - T4)) / 2;
    if (aux < offset) {
        offset = aux;
    }
});

clientTCP.on('close', function () {
    console.log('Conexión cerrada con el servidor NTP.');
});

clientTCP.on('error', function (err) {
    console.log(err);
});

var registration = 'http://' + IP_HTTP_SERVER + ':' + PORT_HTTP_SERVER + '/register?username=' + username +
    '&ip=' + IP_ADDRESS + '&port=' + PORT_TCP_CLIENT;

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
        console.log('Bienvenido a la sala de chat');
        for (i = 0; i < activeNodes.length; i++) {
            const client = net.createConnection(activeNodes[i].port, activeNodes[i].ip, () => {
                var json = {
                    username: USERNAME,
                    ip: IP_ADDRESS,
                    port: PORT_TCP_CLIENT
                };
                client.write(JSON.stringify(json));
            });

            sockets.push(client);

            client.on('data', (data) => {
                var mensaje = JSON.parse(data.toString());
                mostrarMensaje(mensaje);
            });

            client.on('close', () => {
                console.log('Entro al close de client...')
                var i = 0;
                while (i < activeNodes.length && activeNodes[i].ip != nodo.ip && activeNodes[i].port != nodo.port)
                    i++
                if (i < activeNodes.length)
                    activeNodes.splice(i, 1);
            });

            client.on('error', (err) => {
                console.log(err);
            });
        }
    });
});

const server = net.createServer(function (socket) {
    sockets.push(socket);

    socket.on('data', function (data) {
        var mensaje = JSON.parse(data.toString());
        if (mensaje.hasOwnProperty('username')) {
            activeNodes.push(mensaje);
            console.log(mensaje.username + ' se ha conectado.')
        } else 
            mostrarMensaje(mensaje);
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

rl.on('line', (cad) => {
    var line = cad.split('@');
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
        timestamp: new Date().getTime(),
        offset: offset
    };

    sockets.forEach((socket) => {
        socket.write(JSON.stringify(json));
    ;})
});

function mostrarMensaje(mensaje) {
    receivers = mensaje.to.split(',');
    if (receivers.includes('all') || receivers.includes(username)) {
        var time = parseInt(mensaje.timestamp) - parseInt(mensaje.offset);
        console.log('[' + msToTime(time) + '] ' + mensaje.from + ': ' + mensaje.message);
    }
}

function msToTime(s) {
    // Pad to 2 or 3 digits, default is 2
    var pad = (n, z = 2) => ('00' + n).slice(-z);
    return new Date().getHours() + ':' + pad((s % 3.6e6) / 6e4 | 0) + ':' + pad((s % 6e4) / 1000 | 0) + '.' + pad(s % 1000, 3);
}