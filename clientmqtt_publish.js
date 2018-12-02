

const mqtt = require('mqtt');


var clientmqtt  = mqtt.connect('mqtt://mqtt.fi.mdp.edu.ar:1883');
 
clientmqtt.on('connect', function () {
	// clientmqtt.publish('a', JSON.stringify({valor: false}))
    clientmqtt.subscribe('ingenieria/anexo/exterior/led', function (err) {
        if (err) {
            console.log(err);    
        } else {
            console.log("Subscripcion exitosa");
        }

               
  	})
})
 
clientmqtt.on('message', function (topic, message) {
   // message is Buffer
   console.log(message.toString());
   
})

// var boolean = true
// setInterval(() => {
// 	var valor = boolean
// 	if(valor)
// 		valor = false
// 	else
// 		valor = true
// 	clientmqtt.publish('a', JSON.stringify({valor: valor,timestamp: 1}))
// },1000)



//     console.log("conectado")
//     var count = 0
//     var t = 0;
//     var h =0
//     setInterval(() => {

//     	let mensaje = {
//     		valor: t, 
//     		timestamp: new Date().getTime()
//     	}
//     	console.log(mensaje.valor + ' ' + mensaje.timestamp.toString())
//     	clientmqtt.publish('ingenieria/anexo/exterior/temperatura', JSON.stringify(mensaje))
//     	t++
//     	h++
//     	count++
// 	},3000)




    // console.log("conectado")
    // var count = 0
    // var t = 0;
    // var buf; 
    // setInterval(() => {
    //     buf = Buffer.from(t.toString);
    //     clientmqtt.publish('ingenieria/anexo/sala4/temperatura', JSON.stringify(buf));
    //     t++
    // },3000)