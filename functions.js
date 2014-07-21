exports.htmlEscape = function (str) {
  return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
};

exports.dateFormat = function (datevar) {
  var datestr = "";
  datestr = (datevar.getYear()+1900)+"-"+(datevar.getMonth()+1)+"-"+datevar.getDate();
  datestr+= " "+datevar.getHours()+":"+datevar.getMinutes()+":"+datevar.getSeconds();
  return datestr;
};

exports.getUnixtime = function (date) {
  return parseInt(date.getTime().toString());
};

exports.getTimeStamp = function (datevar) {
	var d = new Date();
	var s =
	  leadingZeros(d.getFullYear(), 4) + '-' +
	  leadingZeros(d.getMonth() + 1, 2) + '-' +
	  leadingZeros(d.getDate(), 2) + ' ' +
	  leadingZeros((d.getHours()-9), 2) + ':' +
	  leadingZeros(d.getMinutes(), 2) + ':' +
	  leadingZeros(d.getSeconds(), 2);

	return s;
};

exports.getUserId = function (user, userid) {
	var res = [];
	for(key in user){
	    if(user[key] == userid){
	      res.push(key);
	    }
	  }
	 return res;
};

function leadingZeros (n, digits) {
	var zero = '';
	n = n.toString();

	if (n.length < digits) {
	  for (i = 0; i < digits - n.length; i++)
	    zero += '0';
	}
	return zero + n;
}