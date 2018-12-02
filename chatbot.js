const http = require('http');
const net = require('net');
const ip = require('ip');
const mqtt = require('mqtt');
const readline = require('readline');
const readline_sync = require('readline-sync');
const events = require('events');
const eventEmitter = new events.EventEmitter();

const IP_ADDRESS = ip.address();
const IP_HTTP_SERVER = '192.168.1.33';
const PORT_HTTP_SERVER = 8085;
const PORT_TCP_SERVER = 8081;
const PORT_TCP_CLIENT = 8082;

const TOP_RAIZ = 'ingenieria/anexo/';
const TOP_SALA4_TEMP = TOP_RAIZ + 'sala4/temperatura';
const TOP_EXT_TEMP = TOP_RAIZ + 'exterior/temperatura';
const TOP_PAS_TEMP = TOP_RAIZ + 'pasillo/temperatura';
const TOP_SALA4_LED = TOP_RAIZ + 'sala4/led';
const TOP_EXT_LED = TOP_RAIZ + 'exterior/led';
const TOP_PAS_LED = TOP_RAIZ + 'sala4/led';
const TOP_SALA4_MOTOR = TOP_RAIZ + 'sala4/motor';
// const TOP_EXT_MOTOR = TOP_RAIZ + 'exterior/motor';
// const TOP_PAS_MOTOR = TOP_RAIZ + 'pasillo/motor';

// Ubicaciones
const UB_CUALQUIERA = 0;
const UB_SALA4 = 1;
const UB_EXTERIOR = 2;
const UB_PASILLO = 3;

var temperaturas = [{ temp_valor: undefined, temp_tiempo: undefined, temp_ubicacion: undefined },
{ temp_valor: undefined, temp_tiempo: undefined },
{ temp_valor: undefined, temp_tiempo: undefined },
{ temp_valor: undefined, temp_tiempo: undefined }];

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

var clientmqtt = mqtt.connect('mqtt://mqtt.fi.mdp.edu.ar:1883');

clientmqtt.on('connect', () => {
    console.log("Conexión exitosa con el broker.");
    clientmqtt.subscribe(TOP_SALA4_TEMP, (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log("Subscripcion exitosa");
        }
    });

    clientmqtt.subscribe(TOP_EXT_TEMP, (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log("Subscripcion exitosa");
        }
    });

    clientmqtt.subscribe(TOP_PAS_TEMP, (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log("Subscripcion exitosa");
        }
    });
});

clientmqtt.on('message', (topic, message) => {
    // message is Buffer
    message = JSON.parse(message.toString());
    if (topic == TOP_SALA4_TEMP) {
        temperaturas[UB_SALA4].temp_valor = message.valor;
        temperaturas[UB_SALA4].temp_tiempo = msToTime(message.timestamp);
        // console.log("-Topico:" + topic + " -Temperatura:" + temperaturas[UB_SALA4].temp_valor + " Tiempo:" + temperaturas[UB_SALA4].temp_tiempo);
    } else if (topic == TOP_EXT_TEMP) {
        temperaturas[UB_EXTERIOR].temp_valor = message.valor;
        temperaturas[UB_EXTERIOR].temp_tiempo = msToTime(message.timestamp);
        // console.log("-Topico:" + topic + " -Temperatura:" + temperaturas[UB_EXTERIOR].temp_valor + " Tiempo:" + temperaturas[UB_EXTERIOR].temp_tiempo);
    } else if (topic == TOP_PAS_TEMP) {
        temperaturas[UB_PASILLO].temp_valor = message.valor;
        temperaturas[UB_PASILLO].temp_tiempo = msToTime(message.timestamp);
        // console.log("-Topico:" + topic + " -Temperatura:" + temperaturas[UB_PASILLO].temp_valor + " Tiempo:" + temperaturas[UB_PASILLO].temp_tiempo);
    }
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
                        var mensaje = JSON.parse(data.toString());
                        analizarMensaje(mensaje);
                        mostrarMensaje(mensaje);
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
        } else {
            analizarMensaje(mensaje);
            mostrarMensaje(mensaje);
        }
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

function detectar_pregunta(preg) {
    var preg_ret;
    if (preg == "¿que temperatura hace?") {
        preg_ret = 1;
    } else if (preg == "¿que temperatura hace en sala4?") {
        preg_ret = 2;
    } else if (preg == "¿que temperatura hace en exterior?") {
        preg_ret = 3;
    } else if (preg == "¿que temperatura hace en pasillo?") {
        preg_ret = 4;
    } else if (preg == "prender LED de sala4") {
        preg_ret = 5;
    } else if (preg == "prender LED de exterior") {
        preg_ret = 6;
    } else if (preg == "prender LED de pasillo") {
        preg_ret = 7;
    } else if (preg == "apagar LED de sala4") {
        preg_ret = 8;
    } else if (preg == "apagar LED de exterior") {
        preg_ret = 9;
    } else if (preg == "apagar LED de pasillo") {
        preg_ret = 10;
    } else if (preg.startsWith("girar motor a ")) {
        preg_ret = 11;
    } else {
        preg_ret = 0;
    }
    return preg_ret;
}

function analizarMensaje(mensaje) {
    receivers = mensaje.to.split(',');
    if (receivers.includes('all') || receivers.includes(username) || mensaje.from == username) {
        pregunta = detectar_pregunta(mensaje.message);
        // Es una pregunta diriga hacia el chatbot
        if (pregunta) {
            var mensaje_completo;
            switch (pregunta) {
                case 1: mensaje_completo = {
                    from: username,
                    to: 'all',
                    message: 'Temperatura: ' + temperaturas[UB_CUALQUIERA].temp_valor + ' a las ' + temperaturas[UB_CUALQUIERA].temp_tiempo + " en " + temperaturas[UB_CUALQUIERA].temp_ubicacion,
                    timestamp: Date.now(),
                    offset: offset
                };
                    break;
                case 2: mensaje_completo = {
                    from: username,
                    to: 'all',
                    message: 'Temperatura: ' + temperaturas[UB_SALA4].temp_valor + ' a las ' + temperaturas[UB_SALA4].temp_tiempo + " en sala4",
                    timestamp: Date.now(),
                    offset: offset
                };
                    break;
                case 3: mensaje_completo = {
                    from: username,
                    to: 'all',
                    message: 'Temperatura: ' + temperaturas[UB_EXTERIOR].temp_valor + ' a las ' + temperaturas[UB_EXTERIOR].temp_tiempo + " en exterior",
                    timestamp: Date.now(),
                    offset: offset
                };
                    break;
                case 4: mensaje_completo = {
                    from: username,
                    to: 'all',
                    message: 'Temperatura: ' + temperaturas[UB_PASILLO].temp_valor + ' a las ' + temperaturas[UB_PASILLO].temp_tiempo + " en pasillo",
                    timestamp: Date.now(),
                    offset: offset
                };
                    break;
                case 5: mensaje_completo = {
                    from: username,
                    to: 'all',
                    message: 'Led encendido en sala4.',
                    timestamp: Date.now(),
                    offset: offset
                };
                    clientmqtt.publish(TOP_SALA4_LED, JSON.stringify({ valor: true, timestamp: Date.now() }));
                    break;
                case 6: mensaje_completo = {
                    from: username,
                    to: 'all',
                    message: 'Led encendido en exterior.',
                    timestamp: Date.now(),
                    offset: offset
                };
                    // Encender led en exterior
                    clientmqtt.publish(TOP_EXT_LED, JSON.stringify({ valor: true, timestamp: Date.now() }));
                    break;
                case 7: mensaje_completo = {
                    from: username,
                    to: 'all',
                    message: 'Led encendido en pasillo.',
                    timestamp: Date.now(),
                    offset: offset
                };
                    // Encender led en pasillo
                    clientmqtt.publish(TOP_PAS_LED, JSON.stringify({ valor: true, timestamp: Date.now() }));
                    break;
                case 8: mensaje_completo = {
                    from: username,
                    to: 'all',
                    message: 'Led apagado en sala4',
                    timestamp: Date.now(),
                    offset: offset
                };
                    // Apagar led en sala4
                    clientmqtt.publish(TOP_SALA4_LED, JSON.stringify({ valor: false, timestamp: Date.now() }));
                    break;
                case 9: mensaje_completo = {
                    from: username,
                    to: 'all',
                    message: 'Led apagado en exterior',
                    timestamp: Date.now(),
                    offset: offset
                };
                    // Apagar led en exterior
                    clientmqtt.publish(TOP_EXT_LED, JSON.stringify({ valor: false, timestamp: Date.now() }));
                    break;
                case 10: mensaje_completo = {
                    from: username,
                    to: 'all',
                    message: 'Led apagado en pasillo',
                    timestamp: Date.now(),
                    offset: offset
                };
                    // Apagar led en pasillo
                    clientmqtt.publish(TOP_PAS_LED, JSON.stringify({ valor: false, timestamp: Date.now() }));
                    break;
                case 11:
                    var grados = mensaje.message.split('a ');
                    if (grados[1] >= 0 && grados[1] <= 360) {
                        mensaje_completo = {
                            from: username,
                            to: 'all',
                            message: 'Motor girado',
                            timestamp: Date.now(),
                            offset: offset
                        };
                        // Girar motor
                        clientmqtt.publish(TOP_SALA4_MOTOR, JSON.stringify({ valor: grados[1], timestamp: Date.now() }));
                    } else {
                        mensaje_completo = {
                            from: username,
                            to: 'all',
                            message: 'Grados incorrectos',
                            timestamp: Date.now(),
                            offset: offset
                        };
                    }
                    break;
            }
            for (const socket of connections.values()) {
                socket.write(JSON.stringify(mensaje_completo));
            }
        }
    }
}

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
    var nodos_activos_ret = new Array();
    var nodos_activos_ret = nodos_activos.filter((item) => {
        return !(item.ip == IP_ADDRESS && item.port == PORT_TCP_CLIENT);
    });
    return nodos_activos_ret;
}