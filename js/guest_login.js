

var submit_req = ""

//reset the border color of an empty element to none
function atku(e) {
	if(e.value.length > 0) {
		e.style.borderColor = ""
	}
}


//basic 
function encode(s) {

	if (s.length == 0 || s == null) {return ""}

	var c = '';
	var o = '';

	for (var i = 0; i < s.length; i++) {
		c = s.charCodeAt(i).toString(); 
		if (c.length > 3) {			
			if (c == 8211 || c == 8212) {c = '045'}//change to ascii dash
			else if (c == 8216 || c == 8217) {c = '039'}//change to ascii single apostrophe
			else if (c == 8218 || c == 8222){c = '044'}//change to ascii comma
			else if(c == 8220 || c == 8221) {c = '034'}//change to ascii double quotes
			else {c = (' ').charCodeAt(0).toString()} 
		}
		while ( c.length < 3) {c = '0' + c;}		
		o += c;
	};
	return o;
}

function sendrequest(ps) {

	console.log("made it into sendrequest")

	//var ps = '@@ps';
	var er = false;
	var ex = ""
	var et = "ticket.tk.itype." + ps
	var tkit = parseInt(document.getElementById(et).value);
	var eter = ""
	var tkfn = ""
	var tkmi = ""
	var tkln = ""
	var tkrn = ""
	var tkci = ""
	var tkci = ""
	var d = ""
	var tkco = ""
	var em = ""
	var eter = ""
	var tkem = ""
	var rm = ""
	var tkrm = ""
	var tkph = ""
	var tkds = ""
	var tkcr = ""
	var tkca = ""
	var tksp = ""
	var tkam = ""
	var cc = ""
	var tkcc = ""

	if (tkit == 0) {
		er = true;
		addClass(et,"error")
	}
	else { removeClass(et,"error") }
	
	et = "ticket.tk.fname." + ps;
	eter = et + ".er"			
	tkfn = document.getElementById(et).value;

	if (tkfn.length == 0) {
		er = true;
		addClass(et,"error");
		addClass(eter,"show");
	}
	else {
		removeClass(et,"error");
		removeClass(eter,"show");
	}
	
	
	et = "ticket.tk.lname." + ps;
	eter = et + ".er"
	tkln = document.getElementById(et).value;

	if (tkln.length == 0) {
		er = true;
		addClass(et,"error");
		addClass(eter,"show");
	}
	else {
		removeClass(et,"error");
		removeClass(eter,"show");
	}
	
	et = "ticket.tk.room." + ps; 	
	tkrn = document.getElementById(et).value;
	
	et = "ticket.tk.checkin." + ps;
	eter = et + ".er"
	tkci = document.getElementById(et).value;	

	if (tkci != "") {
		var d = new Date(tkci);

		if (d.toString() === 'Invalid Date' || (d.getFullYear() < 2015) || isNaN(d.getFullYear())) {
			er = true;
			addClass(et,"error");
			addClass(eter,"show");
			ex = ex + " Dates should be entered as mm/dd/yyyy."
		}
		else{
			removeClass(et,"error");
			removeClass(eter,"show");
		}
	}
				
	et = "ticket.tk.checkout." + ps; 
	eter = et + ".er"			
	tkco = document.getElementById(et).value;

	if (tkco != "") {
		d = new Date(tkco);	
		if (d.toString() === 'Invalid Date' || (d.getFullYear() < 2015) || isNaN(d.getFullYear())) {
			er = true;
			addClass(et, "error");
			addClass(eter,"show");
			ex = ex + " Dates should be entered as mm/dd/yyyy."
		}
		else{
			removeClass(et, "error");
			removeClass(eter, "show");
		}
	}
	
	em = "ticket.tk.email." + ps;
	eter = em + ".er"
	tkem = document.getElementById(em).value;

	if (tkem.length == 0) {
		er = true;
		addClass(em, "error");
		addClass(eter,"show");
	}
	else {
		removeClass(em, "error");
		removeClass(eter, "show");
	}

	if ((tkem.toLowerCase() == "na@na.com") || (tkem.toLowerCase()) == "no@notgiven.com") {
		er = true;
		addClass(em, "error");
		addClass(eter, "show");
	}
	else {
		removeClass(em, "error");
		removeClass(eter, "show");
	}
	
	rm = "ticket.tk.email2." + ps;
	eter = rm + ".er"

	tkrm = document.getElementById(rm).value;
	if (tkrm.length == 0) {
		er=true;
		addClass(rm, "error");
		addClass(eter, "show");
		ex = ex + " Please use a real email address name."
	}
	
	if (tkem != tkrm) {
		er = true;
		addClass(em, "error");
		addClass(rm, "error");
	}
	
	et = "ticket.tk.phone." + ps;
	eter = et + ".er"
	tkph = document.getElementById(et).value;

	if (tkph.length == 0) {
		er = true;
		addClass(et, "error");
		addClass(eter, "show");
	}
	else {
		removeClass(et, "error");
		removeClass(eter, "show");
	}
	
	et = "ticket.tk.desc." + ps;
	eter = et + ".er"
	tkds = document.getElementById(et).value
	tkds = tkds.replace( /(\d) (\d)/g, "");
	tkds = tkds.replace( /(\d)-(\d)/g, "");
	tkds = tkds.replace( /\d(?=\d{4})/g, "*");

	if (tkds.length == 0) {
		er = true;
		addClass(et, "error");
		addClass(eter, "show");
	}
	else {
		removeClass(et, "error");
		removeClass(eter, "show");
	}
	
	//var et = "ticket.tk.create."+ps
	tkcr = "false";
	
	et = "ticket.tk.cancellation." + ps
	tkca = document.getElementById(et).value;
	
	et = "ticket.tk.spg." + ps
	tksp = document.getElementById(et).value;
	
	et = "ticket.tk.amount."+ps
	tkam = document.getElementById(et).value;
	
	cc = document.getElementById("ticket.tk.itype." + ps).value;
	et = "ticket.tk.lastfour." + ps;
	eter = et + ".er"

	tkcc = document.getElementById(et).value;

	if (cc == 1) {
		if (tkcc.length != 4) {
			er = true;
			addClass(et, "error");
			addClass(eter, "show");
		}
		else {
			removeClass(et, "error");
			removeClass(eter,"show");
		}						
	}
	
	if (er == true) {
		alert("Some of the form fields were not filled out completely.  The items outlined in red are required." + ex + " Please try again.");
		return;
	}

	submit_req = 
		'/guest-request?ty=' + tkit 
		+ '&ps=' + ps 
		+ '&it=' + tkit 
		+ '&fn=' + encode(tkfn) 
		+ '&mi=' + encode(tkmi) 
		+ '&ln=' + encode(tkln) 
		+ '&rn=' + encode(tkrn) 
		+ '&ci=' + tkci 
		+ '&co=' + tkco 
		+ '&em=' + tkem 
		+ '&rm=' + tkrm 
		+ '&cr=' + tkcr 
		+ '&ph=' + tkph 
		+ '&ds=' + tkds 
		+ '&ca=' + encode(tkca) 
		+ '&sp=' + encode(tksp) 
		+ '&am=' + tkam 
		+ '&cc=' + encode(tkcc);
	
	document.getElementById("display.tk.itype." + ps).innerHTML = 
		document.getElementById("ticket.tk.itype." + ps)[document.getElementById("ticket.tk.itype."+ps).value].text;

	document.getElementById("display.tk.name." + ps).innerHTML = 
		document.getElementById("ticket.tk.fname." + ps).value + " " + document.getElementById("ticket.tk.lname." + ps).value;

	if (document.getElementById("ticket.tk.room." + ps).value == '') {
		document.getElementById("display.tk.room." + ps).innerHTML = "Not Provided"
	}
	else {
		document.getElementById("display.tk.room." + ps).innerHTML = 
			document.getElementById("ticket.tk.room." + ps).value;
	}
	
	if (document.getElementById("ticket.tk.lastfour." + ps).value == '') {
		document.getElementById("display.tk.lastfour." + ps).innerHTML = "N/A"
	}
	else {
		document.getElementById("display.tk.lastfour." + ps).innerHTML = 
			document.getElementById("ticket.tk.lastfour." + ps).value;
	}
	
	if (document.getElementById("ticket.tk.checkin." + ps).value == '' && document.getElementById("ticket.tk.checkout." + ps).value == '') {
		document.getElementById("display.tk.dates." + ps).innerHTML = "Not Provided"
	}
	else {
		document.getElementById("display.tk.dates." + ps).innerHTML = 
			document.getElementById("ticket.tk.checkin." + ps).value + " to " + document.getElementById("ticket.tk.checkout." + ps).value;
	}

	document.getElementById("display.tk.email." + ps).innerHTML = document.getElementById("ticket.tk.email." + ps).value;
	
	//if(document.getElementById("ticket.tk.create."+ps).checked){
	//	document.getElementById("display.tk.create."+ps).innerHTML = "Yes, an account will be created"
	//}else{
	//	document.getElementById("display.tk.create."+ps).innerHTML = "No, an account will not be created"
	//}
	
	document.getElementById("display.tk.phone." + ps).innerHTML = 
		document.getElementById("ticket.tk.phone." + ps).value;

	document.getElementById("display.tk.desc." + ps).innerHTML = tkds
	document.getElementById("display.tk.cancellation." + ps).innerHTML = 
		document.getElementById("ticket.tk.cancellation." + ps).value;

	document.getElementById("display.tk.spg." + ps).innerHTML = document.getElementById("ticket.tk.spg." + ps).value;
	document.getElementById("display.tk.amount." + ps).innerHTML = document.getElementById("ticket.tk.amount." + ps).value;
	
	document.getElementById("guest-ticket-fields").style.display = "none";
	document.getElementById("guest-ticket-display").style.display = "";
	document.getElementById("guest-instructions").style.display = "none";
}
			
		
function sendreqback() {
	document.getElementById("guest-ticket-fields").style.display = "";
	document.getElementById("guest-ticket-display").style.display = "none";
	document.getElementById("guest-instructions").style.display = "";
}
		
function sendrequest2(ps) {
	console.log("sendrequest2")
	document.getElementById("guest-ticket-buttons").style.display = "none";
	document.getElementById("guest-ticket-working-" + ps).style.display = "";
	var a = _z(submit_req);

	a.onreadystatechange = function() {

		if (a.readyState == 4) {
			var ra = a.responseText.split('::::')

			if (ra[0] == 'success') {
				document.getElementById("guest-ticket-fields").innerHTML = ra[1];
				document.getElementById("guest-ticket-fields").style.display = "";
				document.getElementById("guest-ticket-display").style.display = "none";
				document.getElementById("guest-instructions").style.display = "none";
				//window.scrollTo(0,0);
				console.log('about to scroll');
				//window.parent.scrollTo(0,0);
				window.parent.scroll(0, 0);
				console.log('should have scrolled');
				//setTimeout(function() {window.scrollTo(0, 0);},1);
				//document.getElementById("body1").scrollTo()
			}
			else {
				document.getElementById("guest-ticket-buttons").style.display = "";
				document.getElementById("guest-ticket-working-" + ps).style.display = "none";
				document.getElementById("guest-instructions").style.display = "";				
				alert(ra[1])
			}
		}
	};
	_h(a);
}

function requestType(req, ps) {
	if (req == 1) {
		document.getElementById('div-ticket-div-lastfour-' + ps).style.display = '';
	}
	else { document.getElementById('div-ticket-div-lastfour-' + ps).style.display = 'none'}
}
		
function _z(f) {
	var a;
	f += '&rnd=' + Math.floor(Math.random()*99999);
	try { a = new XMLHttpRequest();}
	catch (e1) { 
		try { a = new ActiveXObject('Msxml2.XMLHTTP');}
		catch (e2) {
			try { a = new ActiveXObject('Microsoft.XMLHTTP');} 
			catch (e3) {
				alert('ERR!');
				return false;
			}
		}
	} 
	try { a.open('GET', f);}
	catch (e4) {
		alert(e4);
		alert(f);
		return false;
	};
	return a;
}

function _h(a) {
	a.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
	a.send();
}

function addClass(id,cls) {
	var e = document.getElementById(id);

	if (e) {
		var s = e.getAttribute('class'); 
		e.setAttribute('class', s + ' ' + cls);
		e.setAttribute('className', s + ' ' + cls);
	}
}

function removeClass(id, cls) {
	var e = document.getElementById(id);
	var ea = e.getAttribute('class').split(' ');
	var nc = [];

	for (var x = 0; x < ea.length; x++) {
		if (ea[x] != cls) {nc.push(ea[x])}
	}

	if(e){ 
		var nct = nc.join(' ');
		e.setAttribute('class', nct);
		e.setAttribute('className', nct);
	}
}