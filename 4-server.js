const http = require('http');
const net = require('net');
const url = require('url');

const PORT_HTTP = 8080;
const PORT_TCP = 8081;

var activeNodes = new Array();

http.createServer((req, res) => {
    if (req.method == 'GET') {
        var q = url.parse(decodeURI(req.url), true, true);
        if (q.pathname == '/register') { // Registration of a node
            q = q.query;
            var nodo = {
                username: q.username,
                ip: q.ip,
                port: q.port
            }
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            if (usuarioRegistrado(nodo)) {
                console.log('Ha intentado ingresar al chat un usuario con un nombre repetido.');
                res.end('Nombre de usuario ya registrado');
            } else {
                console.log(q.username + ' ha ingresado al chat.');
                res.end(JSON.stringify(activeNodes)); // Send the array as a string
                activeNodes.push(nodo); // Agregamos el nuevo nodo a la BD del servidor
                console.log(activeNodes);
            }
        }
    }
}).listen(PORT_HTTP);

const serverNTP = net.createServer(function (socket) {
    socket.on('data', (t1) => {
        var T2 = new Date().getTime(); // Tiempo de arribo del mensaje del cliente
        var T3 = new Date().getTime(); // Tiempo de envío del mensaje del servidor
        socket.write(t1 + ',' + T2 + ',' + T3);
    });

    socket.on('end', function () {
        console.log('[' + new Date().toLocaleTimeString() + '] El cliente se ha desconectado del servidor NTP.');
    }.bind({ socket: socket }));

    socket.on('close', () => {
        // La conexión TCP se cerró correctamente.
    });
    
    socket.on('error', (err) => {
        // console.log(err);
    });

}).listen(PORT_TCP); // Si aclaramos el HOST al que escuchamos entonces el servidor no podrá escuchar a
// otras máquinas que intenten establecer comunicación con ella.

serverNTP.on('close', () => {
    console.log('Server disconnected.');
});

serverNTP.on('error', (err) => {
    console.log(err);
});

function usuarioRegistrado(nodo) {
    let i = 0;

    while (i < activeNodes.length && activeNodes[i].username != nodo.username)
        i++;
    return i < activeNodes.length;
}