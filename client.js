const http = require('http');
const net = require('net');
const ip = require('ip');
const readline = require('readline');
const readline_sync = require('readline-sync');
const events = require('events');
const eventEmitter = new events.EventEmitter();

const IP_ADDRESS = ip.address();
const IP_HTTP_SERVER = '10.9.10.206';
const PORT_HTTP_SERVER = 8085;
const PORT_TCP_SERVER = 8081;
const PORT_TCP_CLIENT = 8083;

var username = encodeURIComponent(readline_sync.question('Ingrese nombre de usuario: '));
var rl;
var offset = Number.MAX_VALUE;
var connections = new Map();
var flag_exit = false;

const clientTCP = net.createConnection(PORT_TCP_SERVER, IP_HTTP_SERVER, () => { // Sincronización con el servidor
    var i = 10;
    var id = setInterval(() => {
        if (i--) {
            var T1 = Date.now();
            clientTCP.write(T1.toString());
        } else {
            clearInterval(id);
            clientTCP.end();
        }
    }, 100);
});

clientTCP.on('data', (data) => {
    var T4 = Date.now();
    var times = data.toString().split(',');
    var T1 = parseInt(times[0]);
    var T2 = parseInt(times[1]);
    var T3 = parseInt(times[2]);
    var aux = ((T2 - T1) + (T3 - T4)) / 2;
    if (aux < offset) {
        offset = aux;
    }
});

clientTCP.on('close', () => {
    console.log('Conexión sincronizada con el servidor NTP.');
});

clientTCP.on('error', (err) => {
    console.log(err);
});

peticion();

eventEmitter.on('ya_registrado', () => {
    username = encodeURIComponent(readline_sync.question('Ingrese nombre de usuario: '));
    peticion();
});

function peticion() {
    var registration = `http://${IP_HTTP_SERVER}:${PORT_HTTP_SERVER}/register?username=${username}&ip=${IP_ADDRESS}&port=${PORT_TCP_CLIENT}`;
    http.get(registration, (res) => { // Registro con el servidor
        let body = '';

        res.on('error', (e) => {
            console.log('Problem with request:', e.message);
        });

        res.on('data', (chunk) => {
            body += chunk;
        });

        res.on('end', () => {
            var activeNodes = new Array();
            activeNodes = JSON.parse(body);
            if (activeNodes.length == 0 || !activeNodes[0].hasOwnProperty('repetido')) {
                console.log('Bienvenido a la sala de chat');
                rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.on('line', rd_line); // Preparamos el evento para leer por teclado
                // Limpiar array de nodos activos: borrar repetidos y viejos logins mios
                activeNodes = limpiar_array(activeNodes);
                for (var i = 0; i < activeNodes.length; i++) {
                    const client = net.createConnection(activeNodes[i].port, activeNodes[i].ip, () => {
                        var json = {
                            username: username
                        };
                        // Notifico a los clientes más viejos que me conecté
                        client.write(JSON.stringify(json));
                    });

                    // Inserto en el map de connections el username y su socket respectivo
                    connections.set(activeNodes[i].username, client);

                    client.on('data', (data) => {
                        mostrarMensaje(JSON.parse(data.toString()));
                    });

                    client.on('end', function () { // El otro (servidor) o yo pone/puse exit: El nodo par me envía un FIN packet indicando que se desconectará
                        if (flag_exit) {
                            console.log("Me desconecté de " + activeNodes[this.index].username);
                        } else {
                            console.log("El cliente " + activeNodes[this.index].username + " se desconectó");
                            connections.delete(activeNodes[this.index].username);
                        }
                    }.bind({ index: i }));

                    client.on('close', () => {
                        // La conexión TCP se cerró correctamente.
                    });

                    client.on('error', function (err) {
                        // console.log(err);
                        console.log("El cliente " + activeNodes[this.index].username + " se desconectó");
                        connections.delete(activeNodes[this.index].username);
                    }.bind({ index: i }));
                }
            }
            else {
                console.log('Usuario ya registrado');
                eventEmitter.emit('ya_registrado');
            };
        });
    });
};

const server = net.createServer((socket) => {
    var username;
    socket.on('data', function (data) {
        var mensaje = JSON.parse(data.toString());
        if (mensaje.hasOwnProperty('username')) { // No es un mensaje de chat de otro cliente, sino una notificacion
            username = mensaje.username;
            connections.set(mensaje.username, socket);
            console.log(mensaje.username + " se ha conectado.");
        } else
            mostrarMensaje(mensaje);
    });

    socket.on('end', function () { // El nodo par me envía un FIN packet indicando que se desconectará
        if (flag_exit) {
            console.log("Me desconecté de " + username);
        } else {
            console.log("El cliente " + username + " se desconectó");
            connections.delete(username);
        }
    });

    socket.on('close', () => {
        // La conexión TCP se cerró correctamente.
    });

    socket.on('error', (err) => {
        // console.log(err);
        console.log("El cliente " + username + " se desconectó");
        connections.delete(username);
    });
}).listen(PORT_TCP_CLIENT);

server.on('close', () => { // Evento emitido cuando el servidor cierra y sólo si no hay conexiones existentes
    console.log('Usted se ha desconectado del chat.');
});

server.on('error', (err) => {
    console.log(err);
});

function rd_line(cad) {
    var line = cad.split('@');
    var to;
    var mensaje = line[0];
    for (var i = 1; i < line.length; i++) {
        line[i] = line[i].replace(/\s+/g, '');
    }
    if (mensaje == "exit") {
        flag_exit = true;
        for (const socket of connections.values()) {
            socket.end();
        }
        process.exit();
    } else {
        if (line.length == 1) { // El mensaje es a todos, no hubo un @
            to = 'all';
        } else {
            to = '';
            for (i = 1; i < line.length; i++) {
                to += line[i] + ',';
            }
        }
        var mensaje_completo = {
            from: username,
            to: to,
            message: mensaje,
            timestamp: Date.now(),
            offset: offset
        };

        if (to == 'all') {
            for (const socket of connections.values()) {
                socket.write(JSON.stringify(mensaje_completo));
            }
            mostrarMensaje(mensaje_completo);
        } else {
            var i = 1;
            var flag = true;
            while (i < line.length && flag) {
                var socket = connections.get(line[i]);
                if (socket == undefined) {
                    flag = false;
                }
                i++;
            }
            if (flag) {
                i = 1;
                while (i < line.length) {
                    var socket = connections.get(line[i]);
                    socket.write(JSON.stringify(mensaje_completo));
                    i++
                }
                mostrarMensaje(mensaje_completo);
            } else {
                console.log("El usuario \"" + line[i - 1] + "\" no esta registrado en la sala de chat");
            };
        };
    };
};

function mostrarMensaje(mensaje) {
    receivers = mensaje.to.split(',');
    if (receivers.includes('all') || receivers.includes(username) || mensaje.from == username) {
        var time = parseInt(mensaje.timestamp) - parseInt(mensaje.offset);
        console.log('[' + msToTime(time) + '] ' + mensaje.from + ': ' + mensaje.message);
    }
}

function msToTime(s) {
    // Pad to 2 or 3 digits, default is 2
    var pad = (n, z = 2) => ('00' + n).slice(-z);
    return new Date().getHours() + ':' + pad((s % 3.6e6) / 6e4 | 0) + ':' + pad((s % 6e4) / 1000 | 0);
}

function limpiar_array(nodos_activos) {
    nodos_activos = nodos_activos.filter(function (item, pos, array) {
        var index = array.map(function (e) { return e.ip + e.port; }).lastIndexOf(item.ip + item.port);
        return index == pos;
    });
    var nodos_activos_ret= new Array();
        var nodos_activos_ret = nodos_activos.filter((item) => {
        return !(item.ip == IP_ADDRESS && item.port == PORT_TCP_CLIENT);
    });
    return nodos_activos_ret;
}