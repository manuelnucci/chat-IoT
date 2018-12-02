

const mqtt = require('mqtt');


var clientmqtt  = mqtt.connect('mqtt://mqtt.fi.mdp.edu.ar');
 
clientmqtt.on('connect', function () {
  console.log("conectado");
  clientmqtt.subscribe('prueba', function (err) {
    // if (!err) {
    //   client.publish('prueba', 'Hola prueba');
    // }
  })
});
 
clientmqtt.on('message', function (topic, message) {
  // message is Buffer
  console.log("-Topico:"+topic+" -Mensaje:"+message.toString());
  clientmqtt.end();
})
