const http = require('http');
const net = require('net');
const url = require('url');
const ip = require('ip');

const PORT_HTTP = 8085;
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
                port: q.port,
                timestamp: getTime()
            }
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            if (usuarioRegistrado(nodo)) {
                console.log('[' + getTime() + ']' + ' [' + nodo.ip + ':' + nodo.port + ']' + ' ha intentado ingresar al chat con un nombre de usuario repetido.');
                var res_arr = new Array();
                res_arr.push({ repetido: true });
                res.end(JSON.stringify(res_arr));
            } else {
                console.log('[' + getTime() + '] [' + nodo.ip + ':' + nodo.port + '] ' + nodo.username + ' ha ingresado al chat.');
                res.end(JSON.stringify(activeNodes)); // Send the array as a string
                activeNodes.push(nodo); // Agregamos el nuevo nodo a la BD del servidor
            }
        } else if (q.pathname == '/reload') {
            var i = 0;
            var tabla = `<table class='table table-dark' id="table">
                            <tr>
                                <th>#</th>
                                <th>Username</th>
                                <th>Ip</th>
                                <th>Port</th>
                                <th>Login time</th>
                            </tr>`;
            activeNodes.forEach((item) => {
                tabla += "<tr><td>" + ++i + "</td><td>@" + item.username + "</td><td>" + item.ip + "</td><td>" + item.port + "</td><td>" + item.timestamp + "</td></tr>";
            });
            tabla += '</table>';
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(tabla);
        } else {
            var html = `<!DOCTYPE html><html>
                        <head>
                            <title>Registros de conexiones</title>
                            <link rel='stylesheet' href='https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css' integrity='sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm' crossorigin='anonymous'>
                            <script src='https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js'></script>
                            <script src='https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js'></script>
                        </head>
                        <body id=body>
                            <div class='container-fluid'>
                                <div class='row'>
                                    <div class='col text-center'>
                                        <h1 class='h1 mb-5 mt-3 text-center'>Registro de conexiones</h1>
                                        <div id='tabla'>
                                        <table class='table table-dark' id="table">
                                            <tr>
                                                <th>#</th>
                                                <th>Username</th>
                                                <th>Ip</th>
                                                <th>Port</th>
                                                <th>Login time</th>
                                            </tr>`;
            var i = 0;
            activeNodes.forEach((item) => {
                html += "<tr><td>" + ++i + "</td><td>@" + item.username + "</td><td>" + item.ip + "</td><td>" + item.port + "</td><td>" + item.timestamp + "</td></tr>";
            });
            html += `               </table>
                                </div>
                            </div>
                        </div>  
                    </div>
                    <script>
                        setInterval(function () {
                            $.get('http://${ip.address()}:${PORT_HTTP}/reload', function(data) {
                                $("#table").html(data);
                            });
                        },10000);
                    </script>
                </body>
            </html>`;
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        }
    }
}).listen(PORT_HTTP);

const serverNTP = net.createServer((socket) => {
    socket.on('data', (t1) => {
        var T2 = Date.now(); // Tiempo de arribo del mensaje del cliente
        var T3 = Date.now(); // Tiempo de envío del mensaje del servidor
        socket.write(t1 + ',' + T2 + ',' + T3);
    });

    socket.on('end', () => {
        // El cliente está intentando cerrar la conexión.
    });

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
    // console.log(err);
});

function usuarioRegistrado(nodo) {
    let i = 0;

    while (i < activeNodes.length && activeNodes[i].username != nodo.username)
        i++;
    return i < activeNodes.length;
}

function getTime() {
    var s = Date.now();
    // Pad to 2 or 3 digits, default is 2
    var pad = (n, z = 2) => ('00' + n).slice(-z);
    return new Date().getHours() + ':' + pad((s % 3.6e6) / 6e4 | 0) + ':' + pad((s % 6e4) / 1000 | 0);
}