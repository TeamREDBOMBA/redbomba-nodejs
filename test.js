var http = require('http');

action = "League_JoinLeague";
uid = "31";
contents = "1"

//var path = '/socket/notification/?ele_action='+action+'&ele_user='+uid+'&ele_contents='+contents;
//var path = '/socket/notification/';
var path = '/';
	var options = {
      host: '0.0.0.0',
      port:8000,
      path: path
    };

callback = function(response) {
  var str = '';

  //another chunk of data has been recieved, so append it to `str`
  response.on('data', function (chunk) {
    str += chunk;
  });

  //the whole response has been recieved, so we just print it out here
  response.on('end', function () {
    console.log(str);
  });
}

http.request(options, callback).end();