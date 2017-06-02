//TODO BEFORE conversion !!!!!!!!!!!!!!!!!!!!
//  change ticket_status.ticketno in db to INTEGER 
// add the blog entry to the db
// make dir /blog-images/
// alter table blog to add filepath, realdate

//todo - review isodate differences between old and new
//todo ADD input_method to tickets table, and cancellation
//todo productuion/dev errorhandler from gp
//todo fix problem of not knowing last record added
var get = require('get-parameter-names')
var env = require('./rbp_env.json');

var _debug = false;
var _skiplogin = 0; //todo make startup params

if(env.env == "development") {_skiplogin = 0}
var _adminemail = env.admin_email

var crypto = require('crypto');
var zlib = require('zlib');
var express = require('express');
var multer  = require('multer');
var get = require('get-parameter-names')
var request = require('request');
var path = require('path');
	
function phone(v) {
    var numbers = v.replace(/\D/g, ''),
        char = {0:'(',3:') ',6:' - '};
    v = '';
    for (var i = 0; i < numbers.length; i++) {
        v += (char[i]||'') + numbers[i];
    }
	return v;
}

	

function bplBase64Sha512(t){
	var h = crypto.createHash('sha512');
	h.update(t, 'utf8');
	return h.digest('base64')
}

    //region: 'us-east-1'
	
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

var transporter = nodemailer.createTransport(smtpTransport({
    host: env.smtp_host,
    port: 587,
    auth: {
        user: env.smtp_username,
        pass: env.smtp_password
}}));

// send mail
/*
transporter.sendMail({
    from: 'charleshardes@gmail.com',
    to: 'charleshardes@gmail.com',
    subject: 'rbp started',
    text: 'rbp was started from xxx'
}, function(error, response) {
   if (error) {
        console.log('Message error:' + error);
   } else {
        console.log('Message sent');
   }
});	
*/
	
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('rbp.db');

db.serialize(function() {
	db.run("create table if not exists users (autoID INTEGER PRIMARY KEY, olduserid INTEGER, email TEXT, xcode TEXT, password TEXT, name TEXT, sex TEXT, dob TEXT, gpa TEXT, typeid INTEGER, city TEXT, state TEXT, sms INTEGER, active INTEGER, url TEXT, phone TEXT, resetcode INTEGER, partnerid INTEGER, admin INTEGER, dateadded INTEGER)"); //use alter
	db.run("create table if not exists testers (autoID INTEGER PRIMARY KEY, userid INTEGER, ukey TEXT, cnt INTEGER)"); //use alter
	db.run("create table if not exists blog (autoID INTEGER PRIMARY KEY, userid INTEGER, ukey TEXT, title TEXT, date TEXT, imagefile TEXT, intropara TEXT, fulltext TEXT, visible INTEGER)"); //use alter
});

var express = require('express');
var restapi = express();
restapi.use(express.static(path.join(__dirname, '/public')));

//setting 'views' path to html folder
restapi.set('views', path.join(__dirname, '/html'));

if (env.env == 'development') {
    console.log('runnign development')
	console.log(__dirname + '/rbp-uploads/')
}

/*var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'rbp-uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now())
  }
})

var upload = multer({ storage: storage })	
*/

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, __dirname + '/rbp-uploads/')
  },
  filename: function (req, file, cb) {
	var fn = crypto.pseudoRandomBytes(16);
	var ft = "unknown"
	if(file.mimetype=="application/pdf"){ft = "pdf"}
	if(file.mimetype=="application/msword"){ft = "doc"}
	if(file.mimetype=="application/vnd.openxmlformats-officedocument.wordprocessingml.document"){ft = "docx"}
	if(file.mimetype=="application/vnd.ms-excel"){ft = "xls"}
	if(file.mimetype=="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"){ft = "xlsx"}
	if(file.mimetype=="application/rtf"){ft = "rtf"}
	cb(null, fn.toString('hex') + Date.now() + '.' + ft);
  }
});
var upload = multer({ storage: storage });

var storage2 = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, __dirname + '/blog-images/')
  },
  filename: function (req, file, cb) {
	var fn = file.originalname
	var ft = "unknown"
	if(file.mimetype=="image/jpeg"){ft = "jpg"}
	if(file.mimetype=="image/png"){ft = "png"}	
	console.log(file)
	cb(null, fn );
  }
});
var upload2 = multer({ storage: storage2 });

function find_id(array, id) {
	for(var x=0;x<array.length;x++){
		if(array[x]['id']==id){
			return x
		}
	}
	return 0
}

function replace_all(html, i, val) {
	var re = new RegExp(i, 'g');
	return html.replace( re, val);		
}
	
function replace_all_array(html, array) {
	for(var i in array){
		var re = new RegExp("@@"+i, 'g');
		html = html.replace( re, array[i]);		
	}	
	return html	
}
	
//Simple obfuscation of clear text sent by forms
function decode(txt) {
	 var res = ""
		for(var x=0;x<txt.length;x+=3){
			var dat = txt.substr(x,3);
			if(dat==="039") {
				res+= "&#39;"  ;//ok to keep
			} else if (dat === "010") {
				res+= "<br><br>" ;//ok to convert/keep
			} else {
				res+= String.fromCharCode(parseInt(dat));
			}
		}
	return res
}
	
function todollar(n){
	if(n==0){return 0}
	if(n>100){return (n/100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");}
	return n
}	

function from_currency (a) {
	var number = 0
	if (a.toString().length == 0) {return 0} else {
		number = Number(a.replace(/[^0-9\.]+/g,""));
		if(number>0){number = number*100}
	}
	return number
}


function average(v,c){
	if(c==0){return 0}
	return todollar(v/c)
}

function fixemail(text) {
  return text.split("%40").join("@");
}

function emailprep(a) {	
	var codes = ["&#61;","=","&#64;","@","&#60;","<","&#62;",">","&#39;","'","&#96;","'"]
	for(var x=0;x<codes.length;x=x+2){
		a = replace_all(a, codes[x], codes[x+1])
	}
	a = replace_all(a, "&#39;","'"); //must be separate
	return "<html><body><p>"+a+"</body></html>"
}

function clean(a) {
	var codes = [
	"&#61;","=",
	"&#64;","@",
	"&#60;","<",
	"&#62;",">",
	"&#91;","[",
	"&#93;","]",
	"&#123;","{",
	"&#125;","}"
	]
	for(var x=0;x<codes.length;x=x+2){
		a = replace_all(a, codes[x], codes[x+1])
	}
	a = replace_all(a, "&#39;","'"); //must be separate
	a = replace_all(a, "&#96;","'"); //must be separate
	
	return a	
}

//special characters that should not be allowed in the db
function clean_for_db_write(a){
	a = a.replace(/%20/g, " ");
	a = a.replace(/[<]/g, "&#60;")	
	a = a.replace(/[>]/g, "&#62;")
	a = a.replace(/[=]/g, "&#61;")
	a = a.replace(/[@]/g, "&#64;")
	a = a.replace(/[\[]/g, "&#91;")
	a = a.replace(/[\]]/g, "&#93;")
	a = a.replace(/[\\]/g, "&#92;")
	a = a.replace(/[{]/g, "&#123;")
	a = a.replace(/[}]/g, "&#125;")
	a = a.replace(/[']/g, "&#39;")		
	a = a.replace(/[$]/g, "&#36;")		
	return a	
}

function undo_clean_for_basic_html(a){
	a = a.replace(/%20/g, " ");
	a = replace_all(a, "&#60;b&#62;", "<b>")
	a = replace_all(a, "&#60;/b&#62;", "</b>")	
	a = replace_all(a, "&#60;p&#62;", "<p>")
	a = replace_all(a, "&#60;/p&#62;", "</p>")	
	
	a = replace_all(a, "%3Cb%3E", "<b>")
	a = replace_all(a, "%3C/b%3E", "</b>")
	a = replace_all(a, "%3Cp%3E", "<p>")
	a = replace_all(a, "%3C/p%3E", "</p>")
	return a	
}




function validateEmail(email) {
        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
    }

function comment_bubble(a){
	var bubble = ""
	if(a){
			var bs = a.split(',')
			if(bs.length > 0){
				var bsv = bs[bs.length-1]
				if(bsv==8 || bsv==10){
					bubble = _bubble
				}
			}
		}
	return bubble
}	

function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

//also in browser js
function credit_card_mask (s) {
	s=s.replace(/(\d) (\d)/g, "");
	s=s.replace(/(\d)-(\d)/g, "");
	s=s.replace(/\d(?=\d{4})/g, "*");
	return s
}

function clk(d) {	
    dformat = [d.getMonth()+1,
               d.getDate(),
               d.getFullYear()].join('/')+' '+
              [d.getHours(),
               d.getMinutes(),
               d.getSeconds()].join(':');
	return dformat;
}	

function dlk(d) {	
    dformat = [d.getMonth()+1,
               d.getDate(),
               d.getFullYear()].join('/');
	return dformat;
}	

//note, any reg expr with $ must use &#36; instead
function add_input(req, idx, ps, did, label, type, pattern){
	var atku = ""; if(req==1){atku = "onkeyup='atku(this);'"}
	if(pattern == ""){}else{pattern = "pattern='"+pattern+"' "}
	if(type == "phone"){var blur = "onblur='formatPhone(this);'"} else {var blur = ""}
	return replace_all_array(_ticket_input_row, {
		did: did,
		ps: ps,
		label: label,
		blur: blur,
		pattern: pattern,
		type: type,
		idx: idx
	})
}

function add_checkbox(req, idx, ps, did, nid, label){
	return replace_all_array(_ticket_hack_row, {
		did: did,
		ps: ps,
		label: label,
		idx: idx
	})
}

function guest_input(req, tab, pid, did, label, type, pattern, placeholder, style){
	var atku = ""; if(req==1){atku = "onkeyup='atku(this);'"}
	if(pattern == ""){}else{pattern = "pattern='"+pattern+"'"}	
	if(type == "phone"){var blur = "onblur='formatPhone(this);'"} else {var blur = ""}
	return replace_all_array(_guest_input_row, {
		did: did,
		pid: pid,
		label: label,
		blur: blur,
		pattern: pattern,
		type: type,
		atku: atku,
		tab: tab,
		placeholder: placeholder,
		style: style
	})
}

function guest_display(pid, did, label){
	return replace_all_array(_guest_display_row, {pid: pid, did: did, label: label})
}

function rbp_dte() {
	var d = new Date,
	hours = d.getHours(),
	hours = hours % 12,
	hours = hours ? hours : 12,
	ampm = d.getHours() >= 12 ? 'PM' : 'AM',
    dformat = [pad(d.getMonth()+1,2), pad(d.getDate(),2), d.getFullYear()].join('/')+' '+ [pad(hours,2), pad(d.getMinutes(),2)].join(':') + ' ' + ampm;
	return dformat;
}
	
const STATUS_SUBMITTED = 0
const STATUS_CATEGORIZED = 2
const STATUS_PENDING = 4
const STATUS_WAITING = 6
const STATUS_REOPENED = 8
const STATUS_APPROVED = 10

const _ticket_status_labels = ["Active", "ONE", "Active", "THREE", "Pending", "FIVE", "Awaiting Approval", "SEVEN", "Re-Opened", "NINE", "Closed"]
const _input_methods = ["", "Email", "Voicemail", "Call-in", "Guest"]
const _initial_types = ["N/A","Bill Copy","Inquiry"]
const _user_positions = ["N/A","Associate","Director","Manager","Credit Manager","Ass't Dir of Finance","Director of Finance"]
const _user_notifications = ["","New Inquiries/Billing Inquiries","Awaiting Approval","Guest Reopened/Guest Response","Status Report Auto","New Inquiries/Folio Copies"]

const _bigheader = (function () {/*  	
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
		<meta charset="utf-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge">
		<meta name="viewport" content="width = device-width, initial-scale = 1.0, minimum-scale = 1.0, maximum-scale = 1.0, user-scalable = no">
		<!-- The above 3 meta tags *must* come first in the head; any other head content must come *after* these tags -->
		<meta name="description" content="">
		<meta name="author" content="">
		<link rel="icon" href="./favicon.ico">
		<script src="/js/jquery.min.js"></script>
		<script src="/js/jquery.timeago.js"></script>
		<script src="/js/jquery.localtime-0.9.1.min.js"></script>
		<script src="/js/jquery-ui.js"></script>
		<script src="/js/jquery.hotkeys.js"></script>
		<script src="/js/socket.io.js"></script>
		<script src="/js/dialogs.js"></script>
		<script src="/js/rbp.js"></script>			
		<script src="/js/rbp-tabs.js"></script>			
		<script src="/js/bootstrap.min.js"></script>
		<script src="/js/responsive-tabs.js" type="text/javascript"></script>
		<script src="/js/footable.js" type="text/javascript"></script>
		<script src="/js/footable.paginate.min.js" type="text/javascript"></script>
		<script src="/js/footable.sort.js" type="text/javascript"></script>
		<script src="/js/footable.filter.js" type="text/javascript"></script>
		<link href="/css/bootstrap.min.css" rel="stylesheet" type="text/css" >
		<link href="/css/font-awesome.min.css" rel="stylesheet">
		<link href="/css/footable.core.css" rel="stylesheet" type="text/css" />
		<link href="/css/footable.standalone.css" rel="stylesheet" type="text/css" />
		<link href="/css/jquery-ui.structure.css" rel="stylesheet" type="text/css" >
		<link href="/css/jquery-ui.theme.css" rel="stylesheet" type="text/css" >
		<link href="/css/responsive-tabs.css" rel="stylesheet" type="text/css" />
		<link href="/css/starter-template.css" rel="stylesheet" type="text/css" >
		
		<title>RBP Guest Inquiries</title>
		<script type="text/javascript">
			
			var socket = io.connect();								
			
			socket.on('connect', function(){
				//console.log('connected')					
			})
			
			var socket_uid = 0
			function init_sockets(n){
				socket_uid = parseInt(n)
				//console.log('init_sockets ' + n)
				if(n>0){
					socket.on('working-'+n+'-edit-ticket', function(data){
						//console.log('socket.on working-'+n+'-edit-ticket ' + data)
						dspArray('update_conf_working', '')
						$('#working-'+n+'-edit-ticket').html(data);					
					})					
				}
				init_prop_sockets(_active_prop)
			}
			
			function remove_prop_sockets(p){
				//console.log('remove ticket-edit-'+p)
				socket.removeAllListeners('guest-request-'+p);
				socket.removeAllListeners('ticket-add-accept-'+p);
				socket.removeAllListeners('ticket-edit-'+p);
				socket.removeAllListeners('ticket-edit-accept-'+p);
				socket.removeAllListeners('ticket-edit-cancel-'+p);
			}
			
			function init_prop_sockets(p){				
				//console.log('init_prop_sockets '+p)
				
				socket.on('guest-request-'+p, function(data){
					//groupCnt-0
					//console.log('guest-request-'+p)
					//console.log(data);
					stat_ps = data.status
					var tr = data.html.split("::::");
					var d = "tickets-table-"+stat_ps
					if(document.getElementById('ticket-trow-'+data.status+'-'+data.id)){
						//console.log('skipping guest add')
					} else {
						if(tr[0]==="tr"){
							var footable = $('#'+d);			
							footable.data('footable').appendRow(tr[2]);		
							sdi('groupCnt-'+stat_ps, parseInt(gdi('groupCnt-'+stat_ps))+1);
							
							//find out where the row ended up based on sort
							var rows = $('#'+d+' tbody tr')
							var row = rows.length - 1		
							for(var r=0;r<rows.length;r++){			
								if(rows[r].id==tr[1]){
									row = r;
								}
							}		
								footable.resize();
							
							jQuery("time.timeago").timeago();
							$.localtime.setFormat("M-d-yyyy h:mm a");
							$.localtime.format();
							
							$('#'+rows[row].id).css("background-color", "rgba(0, 0, 153, 0.68)");
							$('#'+rows[row].id).css("color", "#fff");
							$('#'+rows[row].id).animate({backgroundColor: "#fff", color: "#000"}, 5000 );
						}
					}
				})
				
				socket.on('ticket-add-accept-'+p, function(data){
					if(data.userid != socket_uid){
						//console.log('ticket-add-accept-'+p)
						//console.log(data);
						//for now, our own is handled through the request
						stat_ps = data.status						
						var tr = data.html.split("::::");
						var d = "tickets-table-"+stat_ps
						if(document.getElementById('ticket-trow-'+data.status+'-'+data.id)){
							//console.log('skipping guest add')
						} else {
							pil(stat_ps,+1)
							footable_insert(tr,d,stat_ps)
						}
					}
				})
				
				
				
				socket.on('ticket-edit-'+p, function(data){
					var bit = '<span style="float:right;padding-top:2px;" class="fa fa-edit"></span>'
					$('#ticket-trow-'+data.status+'-'+data.id+' td:nth-child(3) .lockdiv').html(bit)
				})
				
				socket.on('ticket-edit-accept-'+p, function(data){
					//console.log('ticket-edit-accept-'+p)
					//console.log(data);					
					if(data.userid != socket_uid){												
						if(data.oldstatus != data.status){
							stat_ps = data.status						
							var d = "tickets-table-"+stat_ps
							//console.log('old ticket-trow-'+data.oldstatus+'-'+data.id)
							if(document.getElementById('ticket-trow-'+data.oldstatus+'-'+data.id)){
								//console.log('removing old row')
								var footable = $('#tickets-table-'+data.oldstatus);
								$('#ticket-trow-'+data.oldstatus+'-'+data.id).remove()
								footable.resize();
							}
							pil(data.oldstatus,-1)
							var tr = data.html.split("::::");
							if(document.getElementById('ticket-trow-'+data.status+'-'+data.id)){
								//console.log('skipping test add')
							} else {
								//console.log('inserting')
								pil(stat_ps,+1)
								footable_insert(tr,d,stat_ps)
							}
						} else {
							if(document.getElementById('ticket-trow-'+data.status+'-'+data.id)){
								//console.log('updating row')
								var footable = $('#tickets-table-'+data.status);
								$('#ticket-trow-'+data.status+'-'+data.id).replaceWith(data.html)	
								jQuery("time.timeago").timeago();
								$.localtime.setFormat("M-d-yyyy h:mm a");
								$.localtime.format();								
							}
						}
					}				
				})
				
				socket.on('ticket-edit-cancel-'+p, function(data){
					$('#ticket-trow-'+data.status+'-'+data.id+' td:nth-child(3) .lockdiv').html('')
				})
				
			}
			
			function pil(s,x){
				var n = parseInt(gdi('groupCnt-'+s))
				if(n>0){
					sdi('groupCnt-'+s, n+x);
					$('#groupCnt-'+s).css("visibility", "visible");
				} else {
					sdi('groupCnt-'+s, 0);
					$('#groupCnt-'+s).css("visibility", "hidden");
				}
			}			
			
			function footable_insert(tr,d,stat_ps){
				//console.log('footable_insert '+d)
				if(document.getElementById(d)){
					if(tr[0]==="tr"){
						var footable = $('#'+d);			
						footable.data('footable').appendRow(tr[2]);		
						
						//find out where the row ended up based on sort
						var rows = $('#'+d+' tbody tr')
						var row = rows.length - 1		
						for(var r=0;r<rows.length;r++){			
							if(rows[r].id==tr[1]){
								row = r;
							}
						}		
						//var p = parseInt(row / 10)
						//dspArray(w,"none");
						//footable.data("currentPage",p);
						footable.resize();
						
						jQuery("time.timeago").timeago();
						$.localtime.setFormat("M-d-yyyy h:mm a");
						$.localtime.format();
						
						$('#'+rows[row].id).css("background-color", "rgba(0, 0, 153, 0.68)");
						$('#'+rows[row].id).css("color", "#fff");
						$('#'+rows[row].id).animate({backgroundColor: "#fff", color: "#000"}, 5000 );
					}
				}
			}
			
			function ckck(id){
				if(gebi('inq.ie.show-'+id).checked){
					gebi('inq.ie.subdesc-'+id).disabled = false;
					gebi('inq.ie.prename-'+id).innerHTML = gebi('inq.ie.name').value + " - ";
				} else {
					gebi('inq.ie.subdesc-'+id).disabled = true;
					gebi('inq.ie.subdesc-'+id).value = ''
					gebi('inq.ie.prename-'+id).innerHTML = ''
				}
			}
			function ckall(){
				var props = gebi('inq.ie.props').innerHTML.split(',');
				for(var x=0;x<props.length;x++){
					gebi('inq.ie.prename-'+props[x]).innerHTML = gebi('inq.ie.name').value + " - ";
				}
			}
						
			function frefresh2(id,pid){
				//returns more than original
				var a=_z('/filehist?id='+id+'&prop='+pid);a.onreadystatechange=function(){if(a.readyState==4){		
				//dspArray('file-refresh-'+id,'none');
				var ra = a.responseText.split('::::')
				//console.log(ra);
				sdi('file-hist-'+id,ra[0]);	
				sdi('assoc-comments-'+id,ra[1])
				sdh('file-links-'+id,ra[2])
			}};_h(a);}
			
			function rfile2(f,t,p){
				var a=_z("/removefile?fid="+f+"&id="+t+"&prop="+p);a.onreadystatechange=function(){if(a.readyState==4){
					var ra = a.responseText.split("::::")
					//console.log("fileinfo-"+f);	
					document.getElementById("fileinfo-"+f).style.display = "none"
					document.getElementById("filechoice-"+f).style.display = "none"
					sdh('file-links-'+t,ra[0])
					sdi('assoc-comments-'+t,ra[1])
				}};_h(a);}		
				
			function ticketupdate3(id,next,prop,status){
				
				//console.log("file-links-"+id);
				if(gebi("file-links-"+id)==null){alert("Please use the 'Refresh files' button below before updating the ticket status");return;}

				stat_ps = status;
				var tkrm=gdv("ticket.tk.room-"+stat_ps);		
				var tkci=gdv("ticket.tk.checkin-"+stat_ps);		if(tkci!=""){
																var d = new Date(tkci);	if(d=='Invalid Date'){er=true;gebi("ticket.tk.checkin-"+stat_ps).style.borderColor="red"; ex = " Dates should be entered as mm/dd/yyyy."}
																}
				var tkco=gdv("ticket.tk.checkout-"+stat_ps);	if(tkco!=""){		
																var d = new Date(tkco);	if(d=='Invalid Date'){er=true;gebi("ticket.tk.checkout-"+stat_ps).style.borderColor="red"; ex = " Dates should be entered as mm/dd/yyyy."} 
																}
				var tkem=gdv("ticket.tk.email-"+stat_ps);	
				var btkem = document.getElementById("ticket.tk.noemail-"+stat_ps).checked
				if(!btkem){
					if(tkem.length==0 || invalidEmail(gdv("ticket.tk.email-"+stat_ps))){
						er=true;gebi("ticket.tk.email-"+stat_ps).style.borderColor="red";
						ex+=" A valid email address is required for the customer or check the 'No guest email' box.  Do not enter a made-up or fictional email address."
						}
				}				
				var tkph=gdv("ticket.tk.phone-"+stat_ps);		
				
				var tkdp=gdv("ticket.tk.dept-"+stat_ps);
				var tkct=gdv("ticket.tk.cat-"+stat_ps);
				var tkas=gdv("ticket.tk.asgn-"+stat_ps);
				var tkam=dollars(gdv("ticket.tk.amount-"+stat_ps));
				var tkcc=encode(gdv("ticket.tk.lastfour-"+stat_ps))
				
				if(tkdp==0 || tkct==0){alert("A department and category are required"); return;}
				var tkcm = "";
				
				$('.update-ticket-less-'+status).hide();
				$('.update-ticket-more-'+status).fadeIn();
				$('.update-ticket-more-'+status).css('padding-top','10px');
				if(deptsel(status)==1){
					dspArray("ticket-wrap-internal","none")
				} else {
					dspArray("ticket-wrap-internal","")
				}
				
				if(status == 0){
					dspArray("ticket-wrap-pending"|"ticket-wrap-awaiting","");
				}
				
				if(status == 1){
					sdtn("ticket-wrap-pending");
					dspArray("ticket-wrap-awaiting","");
				}
				if(status == 2){
					sdtn("ticket-wrap-pending");
					sdtn("ticket-wrap-awaiting");
				}
				tkcm=encode(gdv("ticket.tk.comment-"+stat_ps));
				var dx = gdv('ticket.tk.dept-'+stat_ps)
				var da = gdi('notifydept-list').split(";;");
				for(var x=0;x<da.length;x++){
					var di = da[x].split("::")
					if(di[0]==dx){
						sdi("notifydept",di[1]);
					}
				}
				
				stat_r = "/ticket-edit-accept?id="+id+"&room="+tkrm+"&checkin="+tkci+"&checkout="+tkco+"&email="+tkem+"&phone="+tkph+"&dept="+tkdp+"&cat="+tkct+"&amount="+tkam+"&cmmt="+tkcm+"&asgn="+tkas+"&cc="+tkcc;
				stat_v = "#groupTab1-1"
				stat_n = next; 	//return, return
				stat_id = id;
				
				//openstat();
				//console.log('starting openstat')
				gebi("ticket-wrap-approved2").style.opacity = "1";
				gebi("ticket-move-approved2").disabled = false;
				gebi("statcmmt").value = ""
				gebi("statdesc").value = ""
				rC("statcmmt","ui-state-error");
				rC("statdesc","ui-state-error");
				
				var credit = Number(gdv("ticket.tk.credit-"+stat_ps).replace(/[^0-9\.-]+/g,""));
				var amount = Number(gdv("ticket.tk.amount-"+stat_ps).replace(/[^0-9\.-]+/g,""));
				
				if(amount > credit || document.getElementById("ticket.tk.noemail-"+stat_ps).checked || validateEmail(tkem)==false){
					dspArray('ticket-wrap-approved','none');
					dspArray('ticket-wrap-approved2','none');
					dspArray("ticket-wrap-awaiting","")
				} else {					
					dspArray("ticket-wrap-approved","");
					dspArray("ticket-wrap-approved2","");
					sdtn("ticket-wrap-awaiting")
				}

				


				var files = "";
				var lnks = gebi("file-links-"+stat_id).innerHTML.split(";;;;");
				var fids = []
				for(var x=0; x<lnks.length;x++){		
					var lnk = lnks[x].split(";;");
					if(lnk.length==3){
						fids.push(lnk[0]);
						files += "<div id='ticket-wrap-file'>"
						files += "<input type='checkbox' onclick='chkone(this);' id='file-link-"+stat_id+"-"+lnk[0]+"' style='display:inline;margin-top:10px;' class='text ui-widget-content ui-corner-all'>"
						files += "<label style='display:inline;' id='ticket-desc-pending' > Include: "+lnk[1]+", "+lnk[2]+"</label>"
						files += "</div>"
					}
				}
				if(files.length>0){files = files+"<hr/>"}
				files += "<div id='ticket-files-files' style='display:none;'>"+fids.join(";")+"</div>"
				gebi("ticket-wrap-files").innerHTML = files;
				//console.log('ending openstat')
			}
			
			function initstat2(){
				stat_desc = $( "#statdesc" );
				stat_cmmt = $( "#statcmmt" );
				var allStatFields = $( [] ).add( stat_desc );
				var statNext;
				var statTips = $( ".validateTips" );
				
				var valid = true;
				allStatFields.removeClass( "ui-state-error" );
				
				valid = valid && checkFrmLength( stat_desc, "statdesc", 'ticket-notify', 2, 999 ) && checkFrmLength( stat_cmmt, "statcmmt", 'ticket-notifcust', 2, 999 );
				
				if ( $( "#statcmmt" ).val().length > 0 && gebi('ticket-notifcust').checked == false) {
					$( "#statcmmt" ).addClass( "ui-state-error" );
					alert("A guest comment was entered, but the option to include the comment was not selected.  Either select the option to include the guest comment or remove the comment.");
					valid = false;
				}
				
				if ( valid ) {
				
					dspArray("update_conf_working","");
					dspArray("update_buttons","none");		
					
					dspArray("stat-form-fs-1","none");
					dspArray("stat-form-wk-1","");
					
					stat_files = []
					if(gdi("ticket-files-files")!=""){
						var tf = gebi("ticket-files-files").innerHTML.split(";");
						for(var x=0;x<tf.length;x++){
							if(gebi('file-link-'+stat_id+'-'+tf[x]).checked == true){stat_files.push(tf[x])}
						}
					}
				
					$( "#users tbody" ).append( "<tr>" +
					  "<td>" + "1" + "</td>" +
					  "<td>" + "2" + "</td>" +
					"</tr>" );
					stat_ts = "";
					if(gebi("ticket-move-pending").checked == true){ stat_ts = "pending"}
					if(gebi("ticket-move-awaiting").checked == true){ stat_ts = "awaiting"}
					if(gebi("ticket-move-approved").checked == true){ stat_ts = "approved"}
					if(gebi("ticket-move-approved2").checked == true){ stat_ts = "approved"}
					
					stat_ny = gebi('ticket-notify').checked
					stat_ct = gebi('ticket-notifcust').checked
					stat_cl = gebi('ticket-move-approved2').checked
					if(gebi("ticket-move-approved").checked == true){
						var credit = Number(gdv("ticket.tk.credit-"+stat_ps).replace(/[^0-9\.-]+/g,""));
						var amount = Number(gdv("ticket.tk.amount-"+stat_ps).replace(/[^0-9\.-]+/g,""));
						if(amount > credit){
							return
						}
						if(stat_cl == false){
							dspArray("update_buttons","none");
							dspArray("update_conf_working","none");
							dspArray("update_conf_guest_email","");
							//closedialog.dialog("open");
						} else {
							//console.log(stat_r+"&next="+stat_n+"&tostat="+stat_ts+"&prop="+_active_prop+"&statxt="+encode(stat_desc.val())+"&notify="+stat_ny+"&files="+stat_files+"&notifcust="+stat_ct+"&custxt="+encode(stat_cmmt.val())+"&silent="+stat_cl)
							update_ticket_dialog(stat_r+"&next="+stat_n+"&tostat="+stat_ts+"&prop="+_active_prop+"&statxt="+encode(stat_desc.val())+"&notify="+stat_ny+"&files="+stat_files+"&notifcust="+stat_ct+"&custxt="+encode(stat_cmmt.val())+"&silent="+stat_cl);
						}	
					} else {
						if(stat_ct == true){						
							dspArray("update_buttons","none");
							dspArray("update_conf_working","none");
							dspArray("update_conf_guest_email","");
							//closedialog.dialog("open");
						} else {
							//console.log(stat_r+"&next="+stat_n+"&tostat="+stat_ts+"&prop="+_active_prop+"&statxt="+encode(stat_desc.val())+"&notify="+stat_ny+"&files="+stat_files+"&notifcust="+stat_ct+"&custxt="+encode(stat_cmmt.val())+"&silent="+stat_cl)
							update_ticket_dialog(stat_r+"&next="+stat_n+"&tostat="+stat_ts+"&prop="+_active_prop+"&statxt="+encode(stat_desc.val())+"&notify="+stat_ny+"&files="+stat_files+"&notifcust="+stat_ct+"&custxt="+encode(stat_cmmt.val())+"&silent="+stat_cl);
						}
					}
					clearTimeout(edtk_timeout);
						
					$(function () { 
						$('.footable').footable();
					});
				}			
			}
			
			function initstatok(hide){
				dspArray(hide,"none");
				update_ticket_dialog(stat_r+"&next="+stat_n+"&tostat="+stat_ts+"&prop="+_active_prop+"&statxt="+encode(stat_desc.val())+"&notify="+stat_ny+"&files="+stat_files+"&notifcust="+stat_ct+"&custxt="+encode(stat_cmmt.val())+"&silent="+stat_cl);				
			}
			
			function updateTips( o, t ) {
					o.attr("placeholder",t);
					}
			function checkFrmLength( o, n, g, min, max ) {
				if(gebi(g).checked == true){
					if ( o.val().length > max || o.val().length < min ) {
						o.addClass( "ui-state-error" );
						updateTips( o, "A description must be entered here when notification is selected." );return false;
					} else {
						return true;
					}
				} else {
					return true;
				}
			}
			
			
			function ticketupdateX2(next,prop,status){
				var er = false;
				stat_ps =status;
				stat_n = next; 	
				var ex = "";
				
				gebi("ticket.tk.fname-"+stat_ps).style.borderColor="";
				gebi("ticket.tk.lname-"+stat_ps).style.borderColor="";
				gebi("ticket.tk.checkin-"+stat_ps).style.borderColor="";
				gebi("ticket.tk.checkout-"+stat_ps).style.borderColor="";
				gebi("ticket.tk.email-"+stat_ps).style.borderColor="";
				//gebi("ticket.tk.phone-"+stat_ps).style.borderColor="";
				gebi("ticket.tk.imeth-"+stat_ps).style.borderColor="";
		
		
				var tkty=gdv("ticket.tk.itype-"+stat_ps);
				var tkim=gdv("ticket.tk.imeth-"+stat_ps);		if(tkim==0){er=true;gebi("ticket.tk.imeth-"+stat_ps).style.borderColor="red";}
		
				var tkfn=gedv("ticket.tk.fname-"+stat_ps);		if(tkfn.length==0){er=true;gebi("ticket.tk.fname-"+stat_ps).style.borderColor="red";}		
				//var tkmi=gedv("ticket.tk.mi-"+stat_ps);
				var tkmi=""
				var tkln=gedv("ticket.tk.lname-"+stat_ps);		if(tkln.length==0){er=true;gebi("ticket.tk.lname-"+stat_ps).style.borderColor="red";}
				var tkrm=gedv("ticket.tk.room-"+stat_ps);		
				
				var tkca=gedv("ticket.tk.cancellation-"+stat_ps);
				var tkci=gdv("ticket.tk.checkin-"+stat_ps);		if(tkci!=""){
																var d = new Date(tkci);	if(d=='Invalid Date'){er=true;gebi("ticket.tk.checkin-"+stat_ps).style.borderColor="red"; ex = " Dates should be entered as mm/dd/yyyy."}
																}
				var tkco=gdv("ticket.tk.checkout-"+stat_ps);	if(tkco!=""){		
																var d = new Date(tkco);	if(d=='Invalid Date'){er=true;gebi("ticket.tk.checkout-"+stat_ps).style.borderColor="red"; ex = " Dates should be entered as mm/dd/yyyy."} 
																}
				var tkem=gdv("ticket.tk.email-"+stat_ps);		if(tkem.length==0 || invalidEmail(gdv("ticket.tk.email-"+stat_ps))){er=true;gebi("ticket.tk.email-"+stat_ps).style.borderColor="red";}
				
				var tkph=gedv("ticket.tk.phone-"+stat_ps);		
				
				var tkds=gedv("ticket.tk.desc-"+stat_ps);		if(tkds.length==0){er=true;gebi("ticket.tk.desc-"+stat_ps).style.borderColor="red";}
				var tkdp=gdv("ticket.tk.dept-"+stat_ps);
				var tkct=gdv("ticket.tk.cat-"+stat_ps);
				var tkas=gdv("ticket.tk.asgn-"+stat_ps);		
				var tkam=dollars(gdv("ticket.tk.amount-"+stat_ps));
				
				var tkcc=encode(gdv("ticket.tk.lastfour-"+stat_ps));
				var tkcm="";
							
					
				//if(tkdp==0 || tkct==0){er.push("A department and category are required");}
				
				if(er){
					alert("Some required data is missing or is not valid." + ex);
					$("html, body").scrollTop(0)
					return;
				}
				
				dspArray("add-ticket-form","none");
				dspArray("add-ticket-working-"+stat_ps,"");
				var r = "/ticket-add-accept?typ="+tkty+"&met="+tkim+"&fname="+tkfn+"&mi="+tkmi+"&lname="+tkln+"&room="+tkrm+"&checkin="+tkci+"&checkout="+tkco+"&email="+tkem+"&phone="+tkph+"&desc="+tkds+"&dept="+tkdp+"&cat="+tkct+"&amount="+tkam+"&cmmt="+tkcm+"&ps="+_active_prop+"-"+stat_ps+"&next="+stat_n+"&ca="+tkca+"&asgn="+tkas+"&cc="+tkcc;
						
				var d = "tickets-table-"+stat_ps;
				var c = "ticket-form-"+stat_ps;
				addticket(r,d,c,
					"ticket-tr-none-"+stat_ps,
					"add-ticket-working-"+stat_ps,
					stat_n
				);							
			}

			function addticket(r,d,c,m,w,n) {
				dspArray(c,"none");
				dspArray(w,"");
				var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){		
				var tr = a.responseText.split("::::");	
				
				if(tr[0]==="alert"){
					alert(tr[1]);
					dspArray(w,"none");
					dspArray(c,"");
					return;
				} else {
					if(tr[0]==="tr"){
						var footable = $('#'+d);			
						footable.data('footable').appendRow(tr[2]);		
						sdi('groupCnt-'+stat_ps, parseInt(gdi('groupCnt-'+stat_ps))+1);
						
						//find out where the row ended up based on sort
						var rows = $('#'+d+' tbody tr')
						var row = rows.length - 1		
						for(var r=0;r<rows.length;r++){			
							if(rows[r].id==tr[1]){
								row = r;
							}
						}		
						var p = parseInt(row / 10)
						dspArray(w,"none");
						footable.data("currentPage",p);
						footable.resize();
						
						jQuery("time.timeago").timeago();
						$.localtime.setFormat("M-d-yyyy h:mm a");
						$.localtime.format();
						
						if(n=="next"){
							dspArray(w,"none");
							dspArray(d,"none");skb(c,tr[3]);
						} else {						
							dspArray(d,"");cd(c);dspArray(c,"none");
						}
						
						if(m!=""){
							if(gebi(m)!=null){
								gebi(m).innerHTML = ""
							}
						}
						$('#'+rows[row].id).css("background-color", "rgba(0, 0, 153, 0.68)");
						$('#'+rows[row].id).css("color", "#fff");
						$('#'+rows[row].id).animate({backgroundColor: "#fff", color: "#000"}, 5000 );						
					}
								
				}	
			}};_h(a);}

						
		</script>
		
		<style>
		.footable thead tr th div {display: inline-block;}
		.footable .pagination > ul > li > a, .footable .pagination > ul > li > span {
			border-left-width: 1px;
		}
		.grid-working {
		    padding: 6px;
    background: rgba(0, 0, 153, 0.68);
    border-top: none;
    color: white;
    border: 1px solid #ccc;
	}
		.footable-toggle {display:none !important;}
		body {
			background:#E4E4E4;
			padding-top:133px;
		}
		
		.hptab tr td {
			width: 33%;
		}
		
		.nav {
			float: right;
			font-size: 12px;
			text-align: left;
		}
		
		.mastbody {
			margin:auto; 
			height: 60px;
		}
		.mastbody span {
				font-size: 36px;
			}
		
		
		.lgo {
			cursor: pointer;
				float:left;padding:18px;
			}
			.navbar-header {
				padding-left: 10px;
			}
			.navbar {
				min-height: 70px;
			}
		
		.tkdesc {
				width: 433px;	
			}
			
		
		.demo {		
			background: rgba(0, 0, 153, 0.68);
			margin-top: 100px;
			margin-bottom: 100px;
			height: 250px;
			padding-left: 20px;
			padding-right: 20px;
			padding-top: 8px;
			text-align: center;		
		}
		.demo2 {		
			background: rgba(0, 0, 153, 0.68);
			margin-top: -14px;
			margin-bottom: 100px;
			height: 229px;
			padding-left: 20px;
			padding-right: 20px;
			padding-top: 8px;
			text-align: center;		
		}
		
		.demo input, .demo2 input {
			padding: 5px 10px;
			font-size: 24px;
			color: #545658;
			background-color: rgba(255, 255, 255, 1);
			box-sizing: border-box;
			border-radius: 0;
			min-width: 100%;
			margin-bottom: 10px;
		}
		
		.demo h5, .demo2 h5 {
			font-size: 22px;
			line-height: 1.2em;
			color: #000099;
			background-color: rgba(228, 228, 228, 0.8);
			border-radius: 5px;
			border: 1px solid rgba(42, 43, 44, 1);
			padding: 10px;
		}
		.demo img, .demo2 img {
			margin-top: -10px;
			margin-left: -18px;
			width: 300px;
		}
		
		.sppt {		
			background: white;
			border: 1px solid #c0c0c0;
			margin-bottom: 100px;
			height: 350px;
			padding-left: 20px;
			padding-right: 20px;
			padding-top: 8px;
			text-align: center;		
		}
		.sppt input {
			padding: 5px 10px;
			font-size: 24px;
			color: #545658;
			background-color: rgba(255, 255, 255, 1);
			box-sizing: border-box;
			border-radius: 0;
			min-width: 100%;
			margin-bottom: 10px;
		}
		
		.sppt h5 {
			font-size: 22px;
			padding: 0px;			
		}
		.sppt img {
			margin-top: -10px;
			margin-left: -18px;
			width: 300px;
		}
		.bloglegend {
		    float: right;
			margin-right: 20px;
			margin-top: 20px;
			max-width: 200px;
			padding: 10px;
		}
		
		.blogbar {
			border-bottom: 3px solid rgba(84, 86, 88, 1);
			height: 0 !important;
			min-height: 0 !important;
		}
		
		.blogpage {
		    border: 0px solid rgba(89, 30, 88, 1);
			border-radius: 0 60px 0 60px;
			box-shadow: 0px 1px 4px 0px rgba(0,0,0,0.6);
		}
		
		.blogpage .row h2 {
			margin-left: 22px;
			margin-top: -1px;
			font-size: 24px;
			color: #545658;
		}
		
		.blogmod {
			margin-right: 36% !important;
		}
		
		.guesttitle, .guestpage, .modulepage, .blogpage, .supportpage {	
			margin-left: 100px;
			margin-right: 100px;
			padding:20px;
			margin-top: 10px;
		}
		img.bg {
			min-height: 100%;
			min-width: 1024px;
			cursor: pointer;
			
			width: 100%;
			height: auto;
			
			position: fixed;
			top: 0;
			left: 0;

		}
		
		.col-md-4 {}
		.col-md-4 p {
		    font-size: 18px;
			margin-left: 23px;
			margin-right: 45px;
			margin-top: 19px;
			}
		.col-md-4 .bh2 {
		    background: rgba(0, 0, 153, 0.68);
			box-shadow: 0.07px 1px 1px 1px rgba(0,0,0,0.56);
			border: 0px solid rgba(81, 156, 255, 1);
			color: white;
			font-size: 25px;
			padding: 11px;
			text-align: center;
		}
		.col-md-4 .oh2 {
			background-color: rgba(255, 102, 0, 0.8);
			box-shadow: 0.07px 1px 1px 1px rgba(0,0,0,0.56);
			border: 0px solid rgba(81, 156, 255, 1);
			color: white;
			font-size: 25px;
			padding: 11px;
			text-align: center;
		}
		.bwrap p {
			color: #000099;
			font-size: 18px;
			font-style: italic;
			margin-top: 30px;
		}
		.pwrap {
			border: 1px solid #e2dfdf;
			height: 380px;
			margin-top: -8px;
			margin-left: 10px;
			margin-right: 10px;
		}
		.iwrap h3 {
			text-align: center;
		}
		.iwrap {
			height: 260px;
			margin-top: -10px;
			margin-left: 7px;
			margin-right: 5px;			
		}
		
		.iwrap p {
			margin-left: 5px;
			margin-right: 5px;
		}
		
		.row svg {
			width: 30%;
			height: 30%;
			position: absolute;
			top: 80px;
			right: 0;
			left: 0;
			margin: auto;
			fill: #000099;
			fill-opacity: 0.8;
			stroke: rgba(0, 0, 153, 1);
		}
		
		.row .bubble {
			border: 2px solid rgba(0, 0, 153, 0.8);
			margin-left: 25px;
			margin-right: 25px;
			display: block;
			font-size: 24px;
			background: rgba(0, 0, 153, 0.8);
			color: white;
			padding: 20px;
		}
		
		.obb {
			border: 1px solid rgba(255, 255, 255, 1);
			cursor: pointer;
			background-color: rgba(255, 102, 0, 1);
			color: #FFFFFF;
			min-width: 100px;
			max-width: calc(100% - 60px);
			min-height: 55px;
			line-height: 55px;
			margin: 15px auto 15px auto;
			display: block;
			font-size: 20px;
			padding: 0px;
		}
		
		.row h5 {
			color: white;
			font-size: 26px;
		}
		
		.blogpage .row img {
			max-width: 100%;
			margin-left: 6px;
			margin-bottom: 5px;
		}
			
		.btn-primary {
			background-color: rgba(0, 0, 153, 0.68);
			transition: border-color 0.4s ease 0s, background-color 0.4s ease 0s;
			box-shadow: 0.07px 1px 1px 1px rgba(0,0,0,0.56);
			background: rgba(0, 0, 153, 0.8) url(http://static.parastorage.com/services/skins/2.1229.62/images/wysiwyg/core/themes/base/shiny1button_bg.png) 50% 50% repeat-x;
			border: solid rgba(0, 0, 0, 1) 0px;
		}
		
		.btn-warning {
			background-color: rgba(255, 102, 0, 0.8)
			transition: border-color 0.4s ease 0s, background-color 0.4s ease 0s;
			box-shadow: 0.07px 1px 1px 1px rgba(0,0,0,0.56);
			background: rgba(255, 102, 0, 0.8) url(http://static.parastorage.com/services/skins/2.1229.62/images/wysiwyg/core/themes/base/shiny1button_bg.png) 50% 50% repeat-x;
			border: solid rgba(0, 0, 0, 1) 0px;
		}
		
		.btn-primary svg {
			fill: #FF6600;
		}
		.btn-warning svg {
			fill: #000099;
		}
		.btn-primary svg, .btn-warning svg {
			width: 25px;
			height: 25px;
			top: 0;
			right: 0;
			bottom: 0;
			left: 0;
			fill-opacity: 1;
			margin-bottom: -5px;
			position: relative;
			stroke: rgba(0, 0, 153, 1);			
		}
		
		@media screen and (max-width: 768px) {

		
			.blogmod {
				margin-left: 10px !important;
				margin-right: 10px !important;
			}
			.guesttitle, .guestpage, .modulepage {
				margin-left: 5px;
				margin-right: 5px;
			}			
			.lgo {
			cursor: pointer;
			float: left;
			padding: 9px;
			width: 60px;
			height: 60px;
		}
		.navbar-header {
			padding-left: 0px;
		}
		.navbar {
			min-height: 61px;
		}
		
		}
		
		.workbig {
			margin-top: -57px;
		}
		
		#usermewrap {
			display: inline;
			float: right;
			margin-top: -67px;
			margin-right: 10px;
		}

		.mobmore {
				display:none;
			}
			
		.filetable {
			width: 433px;
		}
		
		.nav li a {
				line-height: 24px;
			}
			
		.more-report-options, .more-ehist-options {padding: 5px;}
		.moblabel, .mobinput {display: inline;}	
		.status-buttons-wrap {display:none !important;}

		
		@media screen and (max-width: 1024px) {
			.status-buttons-wrap {display:block !important;}
			.mobmore {
				display:inline;
			}
		
			.frm > div > div > div> label, legend {width: auto !important;}
			
			.filetable {
				width: auto;
			}
			
			.tkdesc {
				width: auto;	
			}
			.frm {
				float: none !important;
			}
			span.dot0, span.dot1, span.dot2, span.dot3, span.dot9 {
				top: 0px !important;
			}
			
			img.bg {
				left: 50%;
				margin-left: -512px;				
			}
			
			.hptab tr {
				display: block;
			}
			
			.workbig {
				margin-top: 24px;
				padding-left: 5px !important;
				padding-right: 5px !important;
			}
			
			#usermewrap {
				margin-top: 32px !important;
			}
		
		
			.hptab tr td {
				width: 100%;
				display: block;
				padding-bottom: 10px;
			}
		
			
			.nav {
				float: none;
				font-size: 20px;
				text-align: center;
			}
			
			.nav ul li a {
				line-height: 6px;
			}
			
			
			
			.navbar-inverse .navbar-nav>li>a {
				color: white;
			}
		
			body {
				background:#E4E4E4;
				padding-top:56px;
			}
			
			.mastbody {
				margin:auto; 
				height: 47px;
			}
			.mastbody span {
				font-size: 28px;
			}
		
			.sppt input {
				font-size: 18px;
			}
			
			.demo h5 {
				font-size: 20px;
			}
		
			.mid-co {
				border-bottom: 1px solid #000099;
			}
			
			.supportpage {
				margin-left: 5px;
				margin-right: 5px;
			}
			
			.bloglegend {
				display: none;
			}
			
			.blogpage .row h2 {
				font-size: 22px;
				margin-left: -5px;
			}
			
			.blogpage .row img {
				margin-left: -2px;
				margin-bottom: 5px;
			}
			
		}

		@media screen and (max-width: 425px) {
			#usermewrap {
				margin-top: 7px !important;
			}
		}
		
		// For mobiles
			@media only screen and (max-width:560px){
			.panel-container > div {padding-left: 5px;}
		
			body{
			margin: 5px !important;
			}
			.foowrap {padding:0px !important;}
			}
			.timeago {float:right;}
			.rptRefresh, .rptClear {
			padding: 3.5px 4px 3.5px 4px;font-size: 12px;
			}
			.rptRefresh { color: green;} 
			.rptClear {color: red;}
			.rptDisabled {
			opacity: .5;
			color: black !important;
			}
			.rptError {
			border: 2px solid red !important;			
			}
			.report-options, .ehist-options {
			padding-top: 6px;
			padding-left: 7px;
			border: 1px solid #c0c0c0;
			margin-left: 1px;
			margin-right: 1px;
			margin-bottom: 3px;
			}
			.foowrap { padding:10px;}
			.tablab {padding: 5px;}
			td {vertical-align: top;}
			.resptable td {padding-top: 6px;}
			.resptable td input {margin-top: 2px;}
			.resptable td label {margin: 1px 6px 2px 6px;}
			.notiftable td label {margin: 6px 6px 2px 6px;}
			.notiftable td input[type=checkbox] {margin-top: 7px;}
			.deptastable td label {margin: 6px 6px 2px 6px;}
			.deptastable td input[type=checkbox] {margin-top: 7px;}
			span.dot0, span.dot1, span.dot2, span.dot3, span.dot9 {border-radius: 7px; padding: 2px 2px; font-size: 10px; top: -5px; position: relative; margin-right: -2px;}
			span.dot0 {background: red;}
			span.dot1 {background: orange;}
			span.dot2 {background: greenyellow;}
			span.dot3 {background: lightgrey;}
			span.dot9 {background: red;}
			body {
			font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
			font-size: 12px;
			}
			.assoc-comments {		
			display:inline-block;
			min-height:10px;
			width: 300px;
			margin-bottom: 6px;
			padding: 10px;
			}
			.frm {
				padding-top: 2px;
				padding-right: 3px;
				
			}
			.ui-dialog {z-index: 9999}
			.demoHeaders {
			margin-top: 2em;
			}
			i > div {
			font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
			display: inline;
			margin-left: 5px;
			}
			#dialog-link {
			padding: .4em 1em .4em 20px;
			text-decoration: none;
			position: relative;
			}
			#dialog-link span.ui-icon {
			margin: 0 5px 0 0;
			position: absolute;
			left: .2em;
			top: 50%;
			margin-top: -8px;
			}
			#icons {
			margin: 0;
			padding: 0;
			}
			#icons li {
			margin: 2px;
			position: relative;
			padding: 4px 0;
			cursor: pointer;
			float: left;
			list-style: none;
			}
			#icons span.ui-icon {
			float: left;
			margin: 0 4px;
			}
			.fakewindowcontain .ui-widget-overlay {
			position: absolute;
			}
			select {
			width: 200px;
			}
			td .choice { text-align: left;}
		
		</style>
		<style>
			.lockdiv {display:inline;}
		
			.fa-spin {
				-webkit-animation: fa-spin 1s infinite linear;
				animation: fa-spin 1s infinite linear;
			}

			.update-ticket-more-0 {background-color: lightblue;}
		
			#masthead {}
			.navbar-header {padding-left: 10px;}
			#associates-table tbody tr td { vertical-align: top; }
			.flderror {border: 1px solid red !important}
			label, input { display:block; }
			input.text, select, button, textarea { margin-bottom:6px; padding: 6px; }
			table { margin-bottom:12px;}
			fieldset { padding:0; border:0; margin-top:5px; }
			h1 { font-size: 1.2em; margin: .6em 0; }
			div#users-contain { width: 350px; margin: 20px 0; }
			div#users-contain table { margin: 1em 0; border-collapse: collapse; width: 100%; }
			div#users-contain table td, div#users-contain table th { border: 1px solid #eee; padding: .6em 10px; text-align: left; }
			.ui-dialog .ui-state-error { padding: .3em; }
			.validateTips { border: 1px solid transparent; padding: 0.3em; }
			.ro {border:none !important;}
		</style>
		<style>
			.deptmembers:hover {text-decoration: underline; cursor:pointer;}
			.frm header { margin: 0 0 20px 0;}
			.frm header div {font-size: 90%;color: #999;}
			.frm header h2 {margin: 0 0 5px 0;}
			.frm > div > div > div {clear: both;overflow: hidden;padding: 1px;margin: 0;}
			.frm > div > div > div> fieldset > div > div {margin: 0 0 5px 0;}
			.frm > div > div > div> label, legend {width: 25%;float: left;text-align:right;padding: 6px 10px 5px 5px}
			.frm > div > div > div > div,.frm > div > div > div> fieldset > div {
			width: 75%;
			float: right;
			}
			.frm > div > div > div > fieldset label {font-size: 12px;}
			fieldset {border: 0;padding: 0;}
			input[type=text],input[type=email],input[type=url],input[type=password],textarea {border: 1px solid #ccc}
			input[type=text],input[type=email],input[type=url],input[type=password],textarea {width: 50%;}
			input[type=text]:focus,input[type=email]:focus,input[type=url]:focus,input[type=password]:focus,textarea:focus {outline: 0;border-color: #4697e4;}
			@media (max-width: 600px) {
			.ticket-form {padding: 10px;}
			
			
			form > div > div {
			margin: 0 0 15px 0; 
			}
			form > div > div > label,
			legend {
			width: 100%;
			float: none;
			margin: 0 0 5px 0;
			}
			form > div > div > div,
			form > div > div > fieldset > div {
			width: 100%;
			float: none;
			}
			input[type=text],
			input[type=email],
			input[type=url],
			input[type=password],
			textarea,
			select {
			width: 100%; 
			}
			}
			@media (min-width: 1200px) {
			form > div > div > label,
			legend {
			text-align: right;
			}
			}
		</style>
		
		<style>
		
			
			
			#departments-table thead tr {height: 14em;}
			#inquiries-table thead tr {height: 14em;}
			th.rotate {
			border-left: 1px solid rgba(0, 0, 153, 0.68) !important;
			height: 140px;
			white-space: nowrap;
			}

			th.rotate > div {
			transform: 
			translate(18px, 66px)
			rotate(315deg);
			width: 5px;
			}
			th.rotate > div > span {
			border-bottom: 1px solid #ccc;
			padding: 5px 10px;
			margin-left: -12px;
			}
		</style>
		
		<style>
			#inquiries-table tbody td span.fa-check { margin-top: -3px;}
			#inquiries-table tbody td span.fa-asterisk { margin-top: 9px; margin-left: -11px; position:absolute; color: green}
			#departments-table tbody td span.fa-check { margin-top: -3px;}
			#departments-table tbody td span.fa-envelope-o { margin-top: 9px; margin-left: -11px; position:absolute; color: green}
		</style>
				
	</head>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _super_add_property_button = (function () {/* 
<button id='addprbtn' onclick='sdtn("properties-table");divup("/add-property?","property-add");' style='cursor:pointer;' >Add Property</button>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
const _admin_add_property_button = (function () {/* 
<div id='addprmsg'>For new properties, please 
	<div style='text-decoration:underline;cursor:pointer; display:inline;' onclick='active_menu("pgsupport");page("/support?");'>contact support</div>
</div>		
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _add_departments_button = (function () {/*  			
<button id='adddpbtn' onclick='sdtn("departments-table");divup("/add-department?","department-add");' style='cursor:pointer;' >Add Department</button>
<div id='adddpmsg'>For new departments, please 
	<div style='text-decoration:underline;cursor:pointer; display:inline;' onclick='active_menu("pgsupport");page("/support?");'>contact support</div>
</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _super_add_inquiries_button = (function () {/* 
<button id='addinbtn' onclick='sdtn("inquiries-table");divup("/add-inquiry?","inquiry-add");' style='cursor:pointer;'>Add Inquiry Type</button>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	

	
const _admin_add_inquiries_button = (function () {/* 
<div id='addinmsg'>For new inquiry types, please 
	<div style='text-decoration:underline;cursor:pointer; display:inline;' onclick='active_menu("pgsupport");page("/support?");'>contact support</div>
</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	
	
const _associates_table_head = (function () {/*  
	<tr>
		<th>Name</th>
		<th data-hide='phone'>Email</th>
		<th data-hide='phone'>Properties</th>
		<th data-hide='phone'>Phone</th>
		<th data-hide='phone'>Position</th>
		<th data-hide='phone,tablet'>Authority</th>
		<th data-hide='phone,tablet'>Notifications</th>
		<th data-hide='phone,tablet'>Credit</th>
	</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	

const _groups_table_head = (function () {/*  
<tr>
	<th>Group Name</th>
	<th data-hide='phone'>Email</th>
	<th data-hide='phone'>Properties</th>
	<th data-hide='phone'>Phone</th>
	<th data-hide='phone,tablet'>Authority</th>
	<th data-hide='phone,tablet'>Notifications</th>
	<th data-hide='phone,tablet'>Credit</th>
	<th data-hide='phone,tablet'>Logins</th>
</tr>							
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	
	
const _properties_table_head = (function () {/*  
<tr>
	<th data-hide='phone'><div>CODE</div></th>
	<th><div>Name</div></th>
	<th data-hide='phone'><div>Email</div></th>
	<th data-hide='phone'><div>Phone</div></th>
	<th data-hide='phone'><div>Fax</div></th>
	<th><div>City</div></th>
	<th data-hide='phone'><div>State</div></th>
	<th data-hide='phone'><div>Zip</div></th>
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	

const _departments_table_head = (function () {/*  
<tr>
	<th data-type='numeric'>#</th>
	<th style='border-right: 1px solid #cccccc;'>Name</th>
	@@columntitles
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	

const _inquiries_table_head = (function () {/*  
<tr>
	<th>#</th>
	<th style='border-right: 1px solid #cccccc;'>Name</th>
	@@columntitles
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	

const _emailhistory_table_head = (function () {/*  
<tr><td></td><th>Date</th><th>Property</th><th>Associate</th><th>From</th><th colspan='2'>Recipients</th><th>Subject</th><th>Error?</th>
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	
	
const _blog_summary = (function () {/*
<div id="blog-@@autoID" class="row blogrow" @@blogshow>
	<div class="col-md-6">
		<h2>@@title</h2>	
		<img src="/blog-images/@@filepath">					
	</div>
	<div class="col-md-6">
		<p>@@intropara</p>
		<div onclick="$(this).fadeOut(); $('#blg-@@autoID').show();" class="btn btn-warning btn-lg" style="font-size: 14px;margin-left: 4px;margin-top: 11px;">Read More</div>
	</div>
</div>		
<div id='blg-@@autoID' class="row" style='display:none;margin-left:5px; margin-right:5px;'>
	@@fulltext
</div>	
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];				

const _blog_bit = (function () {/*
	<tr style='cursor:pointer;' onclick="
		$('.blogrow').hide();
		$('#blog-@@autoID').show();
	"><td valign='top' style='padding:5px 5px 5px 0px;'>
		<img style='max-width: 70px;' src="/blog-images/@@filepath">					
	</td><td valign='top' style='padding:5px;font-size: 11px;'>
		@@title
	</td></tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];				

const _blog_archive = (function () {/*
	<tr style='cursor:pointer;' onclick="
		$('.blogrow').hide();
		$('#blog-@@autoID').show();
	"><td valign='top' style='padding:5px 5px 5px 0px;'>
		@@date
	</td></tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];				
	
const _home = (function () {/*  
<<bigheader>>
<body>
	<img class="bg" src="/hpimages/f40b81_e2ce9091db3e4259aa40bc13ab7910ef-mv2.png">
	<nav class="navbar navbar-inverse navbar-fixed-top">
		<div id="navcontainer" class="container">
			<div class="navbar-header">
				<img onclick="active_menu('pghome');home();" src="/hpimages/f40b81_60a03f27e0664cd6b3176931526c643a-mv2.png" class='lgo'>
				@@demolabel
				<button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar">
				<span class="sr-only">Toggle navigation</span>
				<span class="icon-bar"></span>
				<span class="icon-bar"></span>
				<span class="icon-bar"></span>
				</button>							
			</div>
			<div id="navbar" class="collapse navbar-collapse">
				<ul class="nav navbar-nav">					
					<li id="pghome" class="active"><a href="javascript:void(0);" onclick="$('.navbar-toggle').click(); active_menu('pghome');home();">Home</a></li>
					<li id="pgmodules" ><a href="javascript:void(0);" onclick="$('.navbar-toggle').click(); active_menu('pgmodules');modules();">Modules</a></li>
					<li id="pgreports" style="display:none;"><a href="javascript:void(0);" onclick="active_menu('pgreports');report_tab();">Reports</a></li>
					<li id="pgsupport" style="display:;"><a href="javascript:void(0);" onclick="$('.navbar-toggle').click(); active_menu('pgsupport');page('/support?');">Support</a></li>
					<li id="pgtraining" style="display:none;"><a href="javascript:void(0);" onclick="active_menu('pgtraining');page('/training?');">Training</a></li>
					<li id="logoutlink" style='display:none;'><a href="javascript:void(0);" onclick="logout();">Logout</a></li>
					<li id="adminlink" style='display:none;'><a href="javascript:void(0);" onclick="active_menu('adminlink');admin();">admin</a></li>
				</ul>
				<div style='float:right;clear:right;'>
						<img onclick="window.open('https://www.linkedin.com/company/rbp-software', '_blank');" alt="" src="/hpimages/48a2a42b19814efaa824450f23e8a253.png" style="width:23px;height:23px;object-fit:cover;cursor:pointer;">
						<img onclick="window.open('https://www.youtube.com/channel/UCd0gu2NAc4YxeHKm7FL5z9A', '_blank');" alt="" src="/hpimages/a1b09fe8b7f04378a9fe076748ad4a6a.png" style="width:23px;height:23px;object-fit:cover;cursor:pointer;">
						<img onclick="$('.navbar-toggle').click();showblog();cancelBubble(event);" alt="" src="/hpimages/062430dbfeba4663a6bf9465b05dee18.png" style="width:23px;height:23px;object-fit:cover;cursor:pointer;">
				</div>
			</div>
			<!--/.nav-collapse -->
		</div>
	</nav>
	<div id="usermewrap" style='display:none;'>
		<span class='fa fa-user' style='font-size:14px; margin-right: 4px;'></span>
		<div id="userme" style='display:inline;'></div>
	</div>
	
		<div id="justdemo" class="container" style="display:none;background:white; opacity: .9;max-width: 450px;margin-top: 10px; padding-top: 20px;">
		<div class="demo2">
		<h5 style="color: #000099;">Request a Live Demo</h5>
		<img src="http://static.parastorage.com/services/skins/2.1229.62/images/wysiwyg/core/themes/base/liftedshadow_medium.png">
		<form class='frm' id='demo2-form' action='javascript:void(0);' style='padding-top: 0px;'>
		<input type="text" name="Your Name" class="" placeholder="Your Name" id="demo2.sp.name">
		<input type="text" name="Your Email" class="" placeholder="Your Email" id="demo2.sp.email">
		<input type="text" name="Your Email2" class="" placeholder="Re-enter Your Email" id="demo2.sp.email2">
		<div class="obb" onclick="
			senddemo2();
		">Sign-Up</div>
		</form>
		<div id='demo2-form-working' style='display:none;margin:0px;color:white;font-size:16px;'>Working, please wait...</div>
		</div>
	</div>

	<div id="homecontainer" class="container">
		<div class="guesttitle" style="display:none; background:white; opacity: .9;">
			<div class="row">
				<div class="col-md-8">
					<h3>
								<div id="masthead">
									<div id="Title" class='mastbody'>
										<span style=" color: #000099; font-family:Calibri; height: 59px;">RBP Software Solutions</span><br>
									</div>
									<div id="SubTitle" style="margin:auto">
										<span style="color:#FF6600; font-size:24px">Solutions for the Hospitality Industry</span> 
									</div>
									<br>
								</div>
							</h3>
				</div>
				<div class="col-md-4">
					<div class="btn btn-primary btn-lg" style="font-size: 24px;float: right;min-width: 269px;"
						onclick="
							$('#login_drop').animate({height: 190}, 500, function() {
								// Animation complete.
							});
						"
					>Property Log-In
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="6.226997375488281 5.83599853515625 189 189" preserveAspectRatio="xMidYMid meet" style="stroke-width: 0px;">
							<g>
								<path d="M100.727 5.836c-52.192 0-94.5 42.309-94.5 94.501 0 52.191 42.309 94.499 94.5 94.499s94.5-42.309 94.5-94.499-42.309-94.501-94.5-94.501zm33.933 97.98l-5.306 5.306-39.877 39.877a4.919 4.919 0 0 1-6.958 0l-1.827-1.827a4.922 4.922 0 0 1 0-6.959l36.397-36.397a4.92 4.92 0 0 0 0-6.959L80.691 60.46a4.922 4.922 0 0 1 0-6.959l1.827-1.827a4.919 4.919 0 0 1 6.958 0l39.877 39.877 5.306 5.306a4.92 4.92 0 0 1 .001 6.959z"></path>
							</g>
						</svg>
					</div>
					<div>
						<div id="loginfrm" style="@@show_loginfrm">
							<form class="frm" action="javascript:void(0);">
								<div id="login_drop" style='border: 1px solid #e2dfdf;width: 263px;height:0px;overflow:hidden;margin-left: 23px;'>
									<div>
										<div>
											<div style='width:100%;float:none;margin-top:10px;'>
												@@loginbox
											</div>
										</div>
										<div>
											<div style='width:100%;float:none;'>
												@@passwordbox
											</div>
										</div>
										<div id="nickwrap" style="display:;">
											<div style='width:100%;float:none;'>
												<input style="width: 93%;float: none;margin-left: 10px;" placeholder="Nickname (for group login)" class="field text fn inputs" type="text" id="nick" name="nick"  style="max-width:250px;">
											</div>
										</div>
										<div>
											<div style='margin-top: 0px;text-align:center;border:1px solid rgba(0, 0, 153, 0.68);' onclick="init_login();" class="obb">Sign-In</div>
											
										</div>
									</div>
								</div>
							</form>
						</div>
						<div id="registerfrm" style="@@show_registerfrm">
							<p style='margin-left:21px;font-size: 16px;'>To complete your registration, create a password for your account.  Passwords should be between 5 and 16 characters.</p>
							<form class="frm" action="javascript:void(0);">
								<div>
									<div>
										<div>
											<label class="desc" for="pw1">Password</label>
											<div style='width: 50%'>
												<input style='width:100%;' class="field text fn inputs" onmousedown="$('#pw1').css('borderColor', '#c0c0c0')" type="password" id="pw1" name="pw1">
											</div>
										</div>
										<div>
											<label class="desc" for="pw2" style='white-space:nowrap;'>Re-enter Password</label>
											<div style='width: 50%'>
												<input style='width:100%;' class="field text fn inputs" onmousedown="$('#pw2').css('borderColor', '#c0c0c0')" type="password" id="pw2" name="pw2">
											</div>
										</div>
										<div id="nickwrap1" style="display:none;">
											<label class="desc" for="nick2">Nickname</label>
											<div style='width: 50%'>
												<input style='width:100%;' class="field text fn inputs" type="text" id="nick2" name="nick2"  style="max-width:250px;">
											</div>
										</div>
										<div>
											<label class="desc"></label>
											<div>
												<button onclick="init_regis();">Continue</button>
											</div>
										</div>
									</div>
								</div>
							</form>
						</div>
						<div id="resetfrm" style="@@show_resetfrm">
							<p style="margin-left: 20px;">Reset your password.</p>
							<form class="frm" action="javascript:void(0);">
								<div>
									<div>
										<div>
											<label class="desc" for="rpw1">Password</label>
											<div>
												<input class="field text fn inputs" onmousedown="$('#rpw1').css('borderColor', '#c0c0c0')" type="password" id="rpw1" name="rpw1">
											</div>
										</div>
										<div>
											<label class="desc" for="rpw2">Re-enter Password</label>
											<div>
												<input class="field text fn inputs" onmousedown="$('#rpw2').css('borderColor', '#c0c0c0')" type="password" id="rpw2" name="rpw2">
											</div>
										</div>
										<div id="nickwrap2" style="display:none;">
											<label class="desc" for="rnick2">Nickname</label>
											<div>
												<input class="field text fn inputs" type="text" id="rnick2" name="rnick2"  style="max-width:250px;">
											</div>
										</div>
										<div>
											<label class="desc"></label>
											<div>
												<button onclick="init_reset();">Continue</button>
											</div>
										</div>
									</div>
								</div>
							</form>
						</div>
					</div>
					
					
				</div>
				
			</div>
		</div>
		<div class="guestpage" style="display:none; background:white; opacity: .9;">
		
			<div class="row">
				<div class="col-md-4">
					<h2 class="bh2">Hospitality Solutions</h2>
					<div class="pwrap">
						<p>RBP Software Solutions has developed 'Guest Facing' Solutions for the hospitality industry for resolving post-stay guest inquiries and disputes.</p>
						<p>RBP's automated solutions will track, monitor and control all guest inquiries and disputes.</p>
					</div>
					<div class="btn btn-primary btn-lg" style="font-size: 24px;min-width: 249px;margin-left: 12px;margin-top: 11px;" onclick="showjustdemo();">Get Started
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="6.226997375488281 5.83599853515625 189 189" preserveAspectRatio="xMidYMid meet" style="stroke-width: 0px;">
							<g>
								<path d="M100.727 5.836c-52.192 0-94.5 42.309-94.5 94.501 0 52.191 42.309 94.499 94.5 94.499s94.5-42.309 94.5-94.499-42.309-94.501-94.5-94.501zm33.933 97.98l-5.306 5.306-39.877 39.877a4.919 4.919 0 0 1-6.958 0l-1.827-1.827a4.922 4.922 0 0 1 0-6.959l36.397-36.397a4.92 4.92 0 0 0 0-6.959L80.691 60.46a4.922 4.922 0 0 1 0-6.959l1.827-1.827a4.919 4.919 0 0 1 6.958 0l39.877 39.877 5.306 5.306a4.92 4.92 0 0 1 .001 6.959z"></path>
							</g>
						</svg>
					</div>
				</div>
				<div class="col-md-4">
					<h2 class="oh2">Cloud-Based</h2>
					<div class="pwrap">
						<p>RBP has partnered with Hotels Worldwide to implement the custom cloud-based solution at their properties. </p>
						<p>To learn more or to schedule an online demonstration, contact us.</p>
					</div>
					<div class="btn btn-warning btn-lg" style="
								font-size: 24px;
								min-width: 249px;
								margin-left: 12px;
								margin-top: 11px;
						  ">Watch a Demo
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="6.226997375488281 5.83599853515625 189 189" preserveAspectRatio="xMidYMid meet" style="stroke-width: 0px;">
							<g>
								<path d="M100.727 5.836c-52.192 0-94.5 42.309-94.5 94.501 0 52.191 42.309 94.499 94.5 94.499s94.5-42.309 94.5-94.499-42.309-94.501-94.5-94.501zm33.933 97.98l-5.306 5.306-39.877 39.877a4.919 4.919 0 0 1-6.958 0l-1.827-1.827a4.922 4.922 0 0 1 0-6.959l36.397-36.397a4.92 4.92 0 0 0 0-6.959L80.691 60.46a4.922 4.922 0 0 1 0-6.959l1.827-1.827a4.919 4.919 0 0 1 6.958 0l39.877 39.877 5.306 5.306a4.92 4.92 0 0 1 .001 6.959z"></path>
							</g>
						</svg>
					</div>
				</div>
				<div class="col-md-4">
					<div class="demo">
						<h5 style="color: #000099;">Request a Live Demo</h5>
						<img src="http://static.parastorage.com/services/skins/2.1229.62/images/wysiwyg/core/themes/base/liftedshadow_medium.png">
						<form class='frm' id='demo-form' action='javascript:void(0);' style='padding-top: 0px;'>
						<input type="text" name="Your Name" class="" placeholder="Your Name" id="demo.sp.name">
						<input type="text" name="Your Email" class="" placeholder="Your Email" id="demo.sp.email">
						<input type="text" name="Your Email2" class="" placeholder="Re-enter Your Email" id="demo.sp.email2">
						<div class="obb" onclick="
							senddemo();
						">Sign-Up</div>
						</form>
						<div id='demo-form-working' style='display:none;margin:0px;color:white;font-size:16px;'>Working, please wait...</div>
						
					</div>
					
				</div>
			</div>
		</div>
		<div class="guestpage" style="display:none; background:white; opacity: .9;">
			<div class="row">
				<div class="col-md-4 mid-co">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="26.499998092651367 48 146.90000915527344 104.00001525878906" preserveAspectRatio="xMidYMid meet" style="stroke-width: 0px;">
						<g>
							<path d="M170.4 133.7h-9.2V60.2c0-6.8-5.5-12.2-12.2-12.2H51c-6.8 0-12.2 5.5-12.2 12.2v73.4h-9.2c-1.7 0-3.1 1.4-3.1 3.1v3.1c0 6.7 5.5 12.2 12.2 12.2h122.4c6.7 0 12.2-5.5 12.2-12.2v-3.1c.1-1.7-1.2-3-2.9-3zm-21.4-9.2c0 1.7-1.4 3.1-3.1 3.1H54.1c-1.7 0-3.1-1.4-3.1-3.1V63.3c0-1.7 1.4-3.1 3.1-3.1h91.8c1.7 0 3.1 1.4 3.1 3.1v61.2z"></path>
							<path d="M55.7 64.5h88.1v58.7H55.7V64.5z"></path>
						</g>
					</svg>
					<div style='min-height:240px;'></div>
					<div class="iwrap">
						<h3>ONLINE COMMUNICATION</h3>
						<p>Our post-stay solutions will significantly improve the efficiency of collecting, processing and analyzing all of your guest inquiries.</p>
					</div>
				</div>

				<div class="col-md-4 mid-co">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="36.472999572753906 50 326.5270080566406 194" preserveAspectRatio="xMidYMid meet" style="stroke-width: 0px;">
						<g>
							<path d="M318.285 145.869c.004-.422.006-.78.006-1.04 0-15.508-5.99-30.279-16.87-41.592-11.03-11.469-25.593-17.785-41.01-17.785-9.21 0-17.508 1.644-24.756 4.895C222.328 65.641 196.631 50 168.537 50c-40.833 0-75.41 35.305-76.289 77.465-30.766.058-55.775 27.488-55.775 58.267 0 30.815 25.07 58.268 55.885 58.268h223.938C342.048 244 363 220.666 363 194.914c0-25.086-19.882-47.998-44.715-49.045zm-149.14-50.737c-15.927 0-28.886 12.958-28.886 28.886a5.988 5.988 0 0 1-11.975 0c0-22.531 18.33-40.861 40.861-40.861a5.988 5.988 0 0 1 0 11.975z"></path>
						</g>
					</svg>
					<div style='min-height:240px;'></div>
					<div class="iwrap">
						<h3>SIMPLE IMPLEMENTATION</h3>
						<p>Our solutions are cloud-based and do not require any additional hardware. Setup and implementation is done remotely.</p>
					</div>
				</div>

				<div class="col-md-4">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="7 12 128.6179962158203 117.61099243164062" preserveAspectRatio="xMidYMid meet" style="stroke-width: 0px;">
						<g>
							<path d="M94.77 12H52.291C26.965 12 7 28.312 7 62.623v66.988s15.064-24.61 46.107-21.61H94.77c26.17 0 40.848-20.225 40.848-46.366C135.617 32.224 120.939 12 94.77 12zM68.265 53.574c-.423 1.291-1.148 2.468-2.175 3.535-1.072 1.111-2.477 1.657-4.217 2.278-1.74.623-3.993.613-6.762.613h-3.749c.448 4 2.099 8.879 4.956 12.125 2.856 3.244 6.807 6.252 11.851 8.695l-2.941 4.816c-6.374-2.801-11.821-6.873-16.347-12.297-4.524-5.424-6.785-10.783-6.785-16.118 0-5.734 1.313-10.213 3.943-13.459 2.631-3.246 6.396-4.863 11.297-4.863 3.121 0 5.829 1.069 8.124 3.203s3.442 4.625 3.442 7.47c0 1.379-.212 2.714-.637 4.002zm32.878 0c-.426 1.291-1.148 2.468-2.176 3.535-1.07 1.111-2.477 1.657-4.215 2.278-1.74.623-3.996.613-6.764.613H84.24c.447 4 2.098 8.879 4.955 12.125 2.855 3.244 6.807 6.252 11.85 8.695l-2.941 4.816c-6.375-2.801-11.822-6.873-16.348-12.297-4.523-5.424-6.785-10.783-6.785-16.118 0-5.734 1.313-10.213 3.945-13.459 2.629-3.246 6.395-4.863 11.297-4.863 3.121 0 5.828 1.069 8.123 3.203s3.443 4.625 3.443 7.47a12.75 12.75 0 0 1-.636 4.002z"></path>
						</g>
					</svg>
					<div style='min-height:240px;'></div>
					<div class="iwrap">
						<h3>TURN GUEST PROBLEMS INTO OPPORTUNITIES</h3>
						<p>Review centralized data to identify trends, help eliminate operational defects, improve processes, and increase guest satisfaction scores.</p>
					</div>
				</div>

			</div>
		</div>
		<div class="guestpage" style="display:none; background:white; opacity: .9;">		
			<div class="row">
				<div class="bubble">
					Hear What our Clients are Saying...
				</div>
				<div style="
							bottom: -18px;
							left: 0;
							border-top: 18px solid rgba(0, 0, 153, 0.8);
							border-bottom: 23px solid transparent;
							border-right: 23px solid transparent;
							float: left;
							margin-left: 25px;					
						"></div>

			</div>

			<div class="row">
				<div class="col-md-8">
					<img style='max-width: 100%;border:1px solid rgba(255, 102, 0, 0.8);' src="/hpimages/ea2ded871fb834580ae155324f58345d.png">
					<div class='bwrap'>
						<p>"We wanted a user-friendly system for the staff but also something that was quick and easy for our guests to use. RBP Software Solutions did not let us down!"</p>
						<p>"RBP Guest Inquiries makes it very easy our hotel employees to manage incoming guest inquiries. The guest-facing link on our website also makes it easy for our guests to navigate."</p>
						<p>"RBP created the easiest programs to train staff to use - yet it's robust enough to provide all the information our hotel needs to control our guest inquiries and lost-and-found."</p>
					</div>

				</div>
				<div class="col-md-4">
					<div class='bwrap'>
						<p>"Our phones stopped ringing on day one with RBP Guest Inquiries!!"</p>
						<p>"RBP Guest Inquiries saved our hotel time and money!"</p>
					</div>
					<div style="
								border: 0px solid rgba(89, 30, 88, 1);
								background-color: rgba(0, 0, 153, 0.8);
								border-radius: 0 60px 0 60px;
								box-shadow: 0px 1px 4px 0px rgba(0,0,0,0.6);
								padding: 10px 30px 60px 30px;
								color: white;
							">
						<h5>Connect with Us</h5>
						<p style='font-size: 11px;margin-left: 0px;margin-right: 0px;'>WE ARE HERE TO HELP YOU DRIVE CHANGE. TOGETHER WE WILL SHAPE THE FUTURE.</p>
						<p style='font-size:12px;'>Bob Murphy
							<br> CEO and General Manager
							<br> 619 929 5257
							<br> bob@rbpsoftwaresolutions.com
						</p>
						<p style='font-size:12px;'>Jana Tostrude
							<br> VP Customer Service
							<br> 415 794 5262
							<br> jana@rbpsoftwaresolutions.com
						</p>
						<p style='margin-left:0px;'>Follow Us</p>

						<div style="border-bottom: 3px solid rgba(81, 156, 255, 1);height: 0 !important;min-height: 0 !important;width: 220px;margin-bottom: 25px;"></div>

						<img onclick="window.open('https://www.linkedin.com/company/rbp-software', '_blank');" alt="" src="/hpimages/48a2a42b19814efaa824450f23e8a253.png" style="width:23px;height:23px;object-fit:cover;cursor:pointer;">
						<img onclick="window.open('https://www.youtube.com/channel/UCd0gu2NAc4YxeHKm7FL5z9A', '_blank');" alt="" src="/hpimages/a1b09fe8b7f04378a9fe076748ad4a6a.png" style="width:23px;height:23px;object-fit:cover;cursor:pointer;">
						<img onclick="showblog();" alt="" src="/hpimages/062430dbfeba4663a6bf9465b05dee18.png" style="width:23px;height:23px;object-fit:cover;cursor:pointer;">

					</div>

				</div>
			</div>

		</div>
		
		<div class="modulepage" style="display:none; background:white; opacity: .9;">		
			<div class="row">
				<div class="col-md-4">
					<img style='max-width: 100%;' src="/hpimages/be61168ec4ce4669a4161af4dfc7c175.png">
					<div class="btn btn-primary btn-lg" style="font-size: 24px;min-width: 249px;margin-left: 4px;margin-top: 11px;" onclick="showjustdemo();">Get Started
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="6.226997375488281 5.83599853515625 189 189" preserveAspectRatio="xMidYMid meet" style="stroke-width: 0px;">
							<g>
								<path d="M100.727 5.836c-52.192 0-94.5 42.309-94.5 94.501 0 52.191 42.309 94.499 94.5 94.499s94.5-42.309 94.5-94.499-42.309-94.501-94.5-94.501zm33.933 97.98l-5.306 5.306-39.877 39.877a4.919 4.919 0 0 1-6.958 0l-1.827-1.827a4.922 4.922 0 0 1 0-6.959l36.397-36.397a4.92 4.92 0 0 0 0-6.959L80.691 60.46a4.922 4.922 0 0 1 0-6.959l1.827-1.827a4.919 4.919 0 0 1 6.958 0l39.877 39.877 5.306 5.306a4.92 4.92 0 0 1 .001 6.959z"></path>
							</g>
						</svg>
					</div>
				</div>
				<div class="col-md-8">
					<h2>Guest Inquiries</h2>
					<ul style='font-size: 22px;'>
					<li>Streamline Reports</li>
					<li>Cloud-Based Inquiry Solution</li>
					<li>Online Guest Communication</li>
					<li>Enhance Customer Experience</li>
					<li>Improve Morale of Accounting Staff</li>
					<li>Reduce Incoming Dispute Phone Calls by 70%</li>
					</ul>
				</div>
			</div>
		</div>
		
		<div class="modulepage" style="display:none; background:white; opacity: .9;">		
			<div class="row">
				<div class="col-md-4">
					<img style='max-width: 100%;' src="/hpimages/ea2ded871fb834580ae155324f58345d.png">
					<div class="btn btn-warning btn-lg" style="font-size: 24px;min-width: 249px;margin-left: 4px;margin-top: 11px;">Watch a Demo
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="6.226997375488281 5.83599853515625 189 189" preserveAspectRatio="xMidYMid meet" style="stroke-width: 0px;">
							<g>
								<path d="M100.727 5.836c-52.192 0-94.5 42.309-94.5 94.501 0 52.191 42.309 94.499 94.5 94.499s94.5-42.309 94.5-94.499-42.309-94.501-94.5-94.501zm33.933 97.98l-5.306 5.306-39.877 39.877a4.919 4.919 0 0 1-6.958 0l-1.827-1.827a4.922 4.922 0 0 1 0-6.959l36.397-36.397a4.92 4.92 0 0 0 0-6.959L80.691 60.46a4.922 4.922 0 0 1 0-6.959l1.827-1.827a4.919 4.919 0 0 1 6.958 0l39.877 39.877 5.306 5.306a4.92 4.92 0 0 1 .001 6.959z"></path>
							</g>
						</svg>
					</div>
				</div>
				<div class="col-md-8">
					<h2>Lost & Found</h2>
					<ul style='font-size: 22px;'>
					<li>Online Guest Communication</li>
					<li>Improve Guest Experience Scores</li>
					<li>Turn Problems into Opportunities</li>
					<li>Guests Track Updates in Real Time</li>
					<li>Automated Lost and Found Tracker</li>
					<li>Reduce Processing Time by 75%</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
	
	<div id="blogcontainer" class="container" style="display:none;">
		<div class="bloglegend"  style="display:; background:white; opacity: .9;">
			<div style='text-align:left;'>
				<h4>Recent Posts</h4>
				<div class='blogbar'></div>
					<table>
					@@blogrecent
					</table>
				<h4>Archive</h4>
					<table>
					@@blogarchive
					</table>
				<div class='blogbar'></div>
				
				<h4>Follow Us</h4>
				<div class='blogbar' style='margin-bottom: 20px;'></div>
						<img onclick="window.open('https://www.linkedin.com/company/rbp-software', '_blank');" alt="" src="/hpimages/48a2a42b19814efaa824450f23e8a253.png" style="width:23px;height:23px;object-fit:cover;cursor:pointer;">
						<img onclick="window.open('https://www.youtube.com/channel/UCd0gu2NAc4YxeHKm7FL5z9A', '_blank');" alt="" src="/hpimages/a1b09fe8b7f04378a9fe076748ad4a6a.png" style="width:23px;height:23px;object-fit:cover;cursor:pointer;">
						<img onclick="showblog();cancelBubble(event);" alt="" src="/hpimages/062430dbfeba4663a6bf9465b05dee18.png" style="width:23px;height:23px;object-fit:cover;cursor:pointer;">

			</div>
		</div>
		<div class="blogpage blogmod" style="display:; background:white; opacity: .9;">		
			@@blogs
		</div>
				
	</div>
	
	<div id="supportcontainer" class="container" style="display:none;">
		<div class="supportpage" style="display:; background:white; opacity: .9;">					
			
			<div class="row">
				<div class="col-md-6">
					<img style='max-width: 100%;border: 1px solid rgba(255, 102, 0, 0.8);' src="/hpimages/dff463d9b8b0b8fff54034736e2f5267.png">					
				</div>
				<div class="col-md-6">
			
					<div class="sppt">
						<h5 style="font-size:22px;color: #000099;">Contact Us</h5>
						<form class='frm' id='sppt-form' action='javascript:void(0);' style='padding-top: 0px;'>
						<input type="text" name="Your Name" class="" placeholder="Your Name" id="sppt.sp.name">
						<input type="text" name="Your Phone Number" class="" placeholder="Your Phone Number" id="sppt.sp.phone">
						<input type="text" name="Your Email" class="" placeholder="Your Email" id="sppt.sp.email">
						<input type="text" name="Your Email2" class="" placeholder="Re-enter Your Email" id="sppt.sp.email2">
						<textarea style="min-width: 100%;height: 80px;" placeholder="Your Message" id="sppt.sp.desc"></textarea>
						<div class="obb" onclick="
							sendsppt();
						">Send Message</div>
						</form>
						<div id='sppt-form-working' style='display:none;margin:0px;color:#000099;font-size:16px;'>Working, please wait...</div>
						
					</div>
					
				</div>
			</div>
			<div class="row">
				<div style="
							border: 0px solid rgba(89, 30, 88, 1);
							background-color: rgba(0, 0, 153, 0.8);
							border-radius: 0 60px 0 60px;
							box-shadow: 0px 1px 4px 0px rgba(0,0,0,0.6);
							padding: 10px 30px 60px 30px;
							color: white;
							margin-left: 20px;
							margin-right: 20px;
						">
					<h5>RBP Software Solutions</h5>
					<p style='font-size: 12px;'>1220 Rosecrans  Ste 956  San Diego, CA 92106</p>
					<table class='hptab' width='100%;'><tr><td valign='top'>
					<p style='font-size:16px;'>Bob Murphy
						<br> CEO and General Manager
						<br> 619 929 5257
						<br> bob@rbpsoftwaresolutions.com
					</p>
					</td><td valign='top'>
					<p style='font-size:16px;'>Jana Tostrude
						<br> VP Customer Service
						<br> 415 794 5262
						<br> jana@rbpsoftwaresolutions.com
					</p>
					</td><td valign='top'>
					<p style='font-size:16px;margin-left:0px;'>Follow Us</p>

					<div style="border-bottom: 3px solid rgba(81, 156, 255, 1);height: 0 !important;min-height: 0 !important;width: 220px;margin-bottom: 25px;"></div>

					<img onclick="window.open('https://www.linkedin.com/company/rbp-software', '_blank');" alt="" src="/hpimages/48a2a42b19814efaa824450f23e8a253.png" style="width:23px;height:23px;object-fit:cover;cursor:pointer;">
					<img onclick="window.open('https://www.youtube.com/channel/UCd0gu2NAc4YxeHKm7FL5z9A', '_blank');" alt="" src="/hpimages/a1b09fe8b7f04378a9fe076748ad4a6a.png" style="width:23px;height:23px;object-fit:cover;cursor:pointer;">
					<img onclick="showblog();" alt="" src="/hpimages/062430dbfeba4663a6bf9465b05dee18.png" style="width:23px;height:23px;object-fit:cover;cursor:pointer;">
					</td></tr></table>
				</div>
			</div>
		</div>
	</div>
		
	
	<div id="workcontainer" class="container workbig">
		<div id="worktabs" style="display:;">
			<select id='user-prop-select' style='margin-top:10px;margin-bottom:-2px;width:290px;' onchange='
				remove_prop_sockets(_active_prop)
				_active_prop=this.value;				
				init_prop_sockets(_active_prop)
				active_tab();
			'>
			</select>
			@@proptabs									
		</div>
		<div id="pages" style="padding:5px;">
		</div>
		<div id="reports" style="display:none;">
			<ul class='rtabs rowtop' id='reportTabs'>
				<li id='rptTab-0'><a href='#reportTab-0'>Status Report</a></li>
				<li id='rptTab-1'><a href='#reportTab-1'>Closed Tickets</a></li>
			</ul>
			<div class='panel-container'>
				<div id='reportTab-0'>
					<div class='report-options'>
						Group by: 
						<select id='reportSelect-0' onchange="reports('status-report-table');">
							<option value='0'>Inquiry Type</option>
							<option value='2'>Date Submitted</option>
							<option value='4'>Date Closed</option>
							<option value='6'>Associate</option>
							<option value='8'>Department</option>
						</select>
						From: 
						<input class="" onblur="chkDate('reportDateFrom-0')" onchange="rptDates(0)" id='reportDateFrom-0' style='display:inline;' 
							pattern="/^[0,1]?\d{1}\/(([0-2]?\d{1})|([3][0,1]{1}))\/(([1]{1}[9]{1}[9]{1}\d{1})|([2-9]{1}\d{3}))$/" 
							type="date" value="@@rptFrom" placeholder="mm/dd/yyyy">
						To: 								
						<input class="" onblur="chkDate('reportDateTo-0')" onchange="rptDates(0)" id='reportDateTo-0'  style='display:inline;' 
							pattern="/^[0,1]?\d{1}\/(([0-2]?\d{1})|([3][0,1]{1}))\/(([1]{1}[9]{1}[9]{1}\d{1})|([2-9]{1}\d{3}))$/" 
							type="date" value="@@rptTo" placeholder="mm/dd/yyyy">
						<button id="reportRefresh-0" title="Refresh" class='@@clsRefresh' onclick="reports('status-report-table');"><span class='fa fa-refresh'></span></button>
						<button id="reportClear-0" title="Clear Dates" onclick="rptClear(0)" class='@@clsClear'><span class='fa fa-times'></span></button>
					</div>
					<table id='status-report-table' @@footable_attributes>
						<thead>
							<tr>
								<th data-hide='phone' id="status-report-table-firstcol">Inquiry Type</th>
								<th data-hide='phone'>Total Tickets</th>
								<th data-hide='phone'>Submitted</th>
								<th data-hide='phone'>Pending</th>
								<th data-hide='phone'>Awaiting Approval</th>
								<th data-hide='phone,tablet'>Reopened</th>
								<th data-hide='phone,tablet'>Closed</th>
								<th data-hide='phone,tablet'>Amount</th>
								<th data-hide='phone,tablet'>Average</th>
							</tr>
						</thead>
						<tbody id='stat.rpt.table'></tbody>
						<tfoot id='stat.rpt.foot'>
						</tfoot>
					</table>
				</div>
				<div id='reportTab-1'>
					<div class='report-options'>
						Filter From: 
						<input class="" onblur="chkDate('reportDateFrom-1')" onchange="rptDates(1)" id='reportDateFrom-1' style='display:inline;' 
							pattern="/^[0,1]?\d{1}\/(([0-2]?\d{1})|([3][0,1]{1}))\/(([1]{1}[9]{1}[9]{1}\d{1})|([2-9]{1}\d{3}))$/" 
							type="date" value="@@rptFrom" placeholder="mm/dd/yyyy">
						To: 								
						<input class="" onblur="chkDate('reportDateTo-1')" onchange="rptDates(1)" id='reportDateTo-1'  style='display:inline;' 
							pattern="/^[0,1]?\d{1}\/(([0-2]?\d{1})|([3][0,1]{1}))\/(([1]{1}[9]{1}[9]{1}\d{1})|([2-9]{1}\d{3}))$/" 
							type="date" value="@@rptTo" placeholder="mm/dd/yyyy">
						By: 
						<select style='padding:2.5px;max-width:115px;' id='reportDateDate-1'>
							<option value='submitted'>Date Submitted</option>
							<option value='closed'>Date Closed</option>
						</select>
						<button id="reportRefresh-1" title="Refresh" class='@@clsRefresh' onclick="reports('closed-tickets-table');"><span class='fa fa-refresh'></span></button>
						<button id="reportClear-1" title="Clear Dates" onclick="rptClear(1)" class='@@clsClear'><span class='fa fa-times'></span></button>
					</div>
					<table id='closed-tickets-table' @@footable_attributes>
						<thead>
							<tr>
								<th>Property</th>
								<th>Ticket</th>
								<th>Date Submitted</th>
								<th>Date Closed</th>
								<th>Guest Name</th>
								<th>Amount</th>
								<th>Assignment</th>
							</tr>
						</thead>
						<tbody id='all.tickets.table'></tbody>
						<tfoot class='nothing' id='all.tickets.foot'>
						</tfoot>
					</table>
				</div>
				<div id='closed-ticket-edit' style='display:none;border:1px solid #c0c0c0;'>
				</div>
			</div>
		</div>
		<div id="admin" style="display:none;">
			<ul class='rtabs rowtop' id='adminTabs'>
				<li id='admTab-0'><a href='#adminTab-0' onclick='_admin_tab=0'>Associates</a></li>
				<li id='admTab-1'><a href='#adminTab-1' onclick='_admin_tab=1'>Group Logins</a></li>
				<li id='admTab-2'><a href='#adminTab-2' onclick='_admin_tab=2'>Properties</a></li>
				<li id='admTab-3'><a href='#adminTab-3' onclick='_admin_tab=3'>Departments</a></li>				
				<li id='admTab-4'><a href='#adminTab-4' onclick='_admin_tab=4'>Inquiry Types</a></li>
				<li id='admTab-5'><a href='#adminTab-5' onclick='_admin_tab=5'>Notification History</a></li>
				<li id='admTab-6'><a href='#adminTab-6' onclick='_admin_tab=6'>Blog</a></li>
			</ul>
			<div class='panel-container'>
				<div id='admin-working' class='grid-working' style='display:none;'>Loading Records, please wait</div>				
				<div id='adminTab-0'>				
				</div>
				<div id='adminTab-1'>
					
				</div>
				
				<div id='adminTab-2'>
					
				</div>
				<div id='adminTab-3'>
					
				</div>
				<div id='adminTab-4'>
					

				</div>
				<div id='adminTab-5'>
					
				</div>
				<div id='adminTab-6'>
					
				</div>
			</div>
		</div>
	</div>
	<div id="login-form" style='display:none;' title="Login">
		<form>
			<fieldset>
				<label for="email">Email</label>
				<input type="text" name="email" id="email" value="" class="text ui-widget-content ui-corner-all">
				<label for="password">Password</label>
				<input type="password" name="password" id="password" value="" class="text ui-widget-content ui-corner-all">
				<input type="submit" tabindex="-1" style="position:absolute; top:-1000px">
			</fieldset>
		</form>
		<div id='loginmsg'></div>
	</div>
</body>
</html>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _one_tabs = (function () {/*  	
<div id='propTab' style='display:;margin-top:10px;' >				
	<ul class='rtabs' id='groupTabContents'>
		<li id='groupTab-0' class='selected'><a style='z-index:999;' href='#groupTabContent-0'>Active Tickets 		<span style='display:;' class='dot0' id='groupCnt-0'>&nbsp;</span></a></li>
		<li id='groupTab-4'><a style='z-index:998;' href='#groupTabContent-4'>Pending 								<span style='display:;' class='dot1' id='groupCnt-4'>&nbsp;</span></a></li>
		<li id='groupTab-6'><a style='z-index:997;' href='#groupTabContent-6'>Awaiting Approval						<span style='display:;' class='dot2' id='groupCnt-6'>&nbsp;</span></a></li>
		<li id='groupTab-8'><a style='z-index:995;' href='#groupTabContent-8'>Re-Opened 							<span style='display:;' class='dot9' id='groupCnt-8'>&nbsp;</span></a></li>
		
		<li style='display:none;' id='groupTab-5'><a style='z-index:999;left:10px;' href='#groupTabContent-5'>Lost & Found	<span style='display:;' class='dot1' id='groupCnt-5'>&nbsp;</span></a></li>
	</ul>
	<div class='panel-container'>
		<div id='groupTabContent-0'></div>
		<div id='groupTabContent-4'></div>
		<div id='groupTabContent-6'></div>
		<div id='groupTabContent-8'></div>		
		<div id='groupTabContent-5'>lost & found content -5</div>
	</div>

</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _common_stat_frm_not_used = (function () {/*  	
<div id="stat-form" style='display:none;' title="Update Status">
	<form>
		<fieldset id='stat-form-fs-1'>
			<div id='ticket-wrap-internal'>
				<input type="checkbox" name="ticket-notify" id="ticket-notify" onclick="dlgfilecheck();ticketreqlabel()" style="display:inline;margin-top:10px;" class="text ui-widget-content ui-corner-all">
				<label for="ticket-notify"  style="display:inline;">
					Notify 
					<div style="display:inline;" id='notifydept'>Department</div>
					by Email
				</label>
				<br>
				<div id="notifydept-list" style="display:none;">@@deptlist</div>
			</div>
			<label style='font-size: 11px;margin-bottom: -1px;border: 1px solid #dddddd; background: #dddddd;'>
				Internal Comment 
				<div style='display:none;' id='ticket-require-label'> (Required)</div>
			</label>
			<textarea id='statdesc' rows=6 style='width:100%;' class="text ui-widget-content ui-corner-all"></textarea>
			<input type="submit" tabindex="-1" style="position:absolute; top:-1000px">
			<div id='ticket-wrap-customer'>
				<input type='checkbox' name='ticket-notifcust' id='ticket-notifcust' onclick='dlgfilecheck();' style='display:inline;margin-top:10px;' class='text ui-widget-content ui-corner-all'>
				<label for='ticket-notifcust'  style='display:inline;'> Include Comment for Guest</label><br>
			</div>
			<label style='font-size: 11px;margin-bottom: -1px;border: 1px solid #dddddd; background: #dddddd;'>Optional Comment for Guest</label>
			<textarea id='statcmmt' rows=6 style='width:100%;' class="text ui-widget-content ui-corner-all"></textarea>
			<input type="submit" tabindex="-1" style="position:absolute; top:-1000px">
			<div id='ticket-wrap-files' style='display:;'>
			</div>
			<div id="ticket-wrap-pending">
				<input type="checkbox" onclick='chkone(this);' name="ticket-move-pending" id="ticket-move-pending" style="display:inline;margin-top:10px;" class="text ui-widget-content ui-corner-all">
				<label for="ticket-move-pending"  style="display:inline;" id="ticket-desc-pending" > Move to Pending</label>
			</div>
			<div id="ticket-wrap-awaiting">
				<input type="checkbox" onclick='chkone(this);' name="ticket-move-awaiting" id="ticket-move-awaiting" style="display:inline;margin-top:10px;" class="text ui-widget-content ui-corner-all">
				<label for="ticket-move-awaiting"  style="display:inline;" id="ticket-desc-awaiting" > Move to Awaiting Approval</label>
			</div>
			<div id="ticket-wrap-approved">	
				<input type="checkbox" onclick='chkone(this);' name="ticket-move-approved" id="ticket-move-approved" style="display:inline;margin-top:10px;" class="text ui-widget-content ui-corner-all">
				<label for="ticket-move-approved"  style="display:inline;" id="ticket-desc-approved" > Close with Guest Notification Email</label>
			</div>
			<div id="ticket-wrap-approved2">	
				<input type="checkbox" onclick='chkone(this);' name="ticket-move-approved2" id="ticket-move-approved2" style="display:inline;margin-top:10px;" class="text ui-widget-content ui-corner-all">
				<label for="ticket-move-approved2"  style="display:inline;" id="ticket-desc-approved2" > Close without Guest Notification Email</label>
			</div>
		</fieldset>
		<div id='stat-form-wk-1' style='display:none;padding-top:18px;'>Working, please wait...</div>
	</form>
</div>
<div id="close-confirm" style='display:none;' title="Confirm Guest Email">
	<form>
		<p><span class="ui-icon ui-icon-alert"></span>This ticket has an external comment which will generate an email to the guest.  Are you sure you want to process this ticket and send an email?</p>
	</form>
</div>
<div id="users-form" style='display:none;' title="Select User">
	<form>
		<fieldset>
			<label for="userlist">Select a user to add</label>
			<select name="userlist" id="propuserlist" size="10">
				<option>text1</option>
				<option>text2</option>
				<option>text3</option>
				<option>text4</option>
				<option>text5</option>
			</select>
		</fieldset>
	</form>
</div>
<div id="keep-form" style='display:none;' title="Keep Editing?">
	<form>
		<fieldset>
			<label>Do you want to keep editing this record?</label>
			<label id='keep-countdown'></label>
		</fieldset>
	</form>
</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _support = (function () {/*
<div style='padding-left:20px;'>
	<H3>FAQ's</H3>
	<div style='margin-left: 40px;'>
		<h4>How do I use the keyboard when entering data?</h4>
		<p>Tab and spacebar are the primary keys to use on forms.  The tab key will move the focus to the next field and make it active.  Active fields are outlined in blue.</p>
		<p>If the active field is a text input box, you will see the curson blinking and you can just stop typing.</p>
	</div>
	<H3 style='cursor:pointer;' onclick='flip_fa("support-form","sup","sdn");'>Contact Support 
		<span id="sup" class='fa fa-arrow-circle-up' style='display:none;'></span>
		<span id="sdn" class='fa fa-arrow-circle-down'></span>
	</H3>
	<form class='frm' id='support-form' action='javascript:void(0);' style='display:none;'>
		<div>
			<div>
				<div>
					<label class="desc" for="support.sp.name">Name</label>
					<div><input id="support.sp.name" onkeyup="atku(this);" name="support.sp.name" type="text" class="field text fn inputs" value="@@name" tabindex="1"></div>
				</div>
				<div>
					<label class="desc" for="support.sp.phone">Phone</label>
					<div><input onblur="formatPhone(this);" id="support.sp.phone" onkeyup="atku(this);" name="support.sp.phone" pattern="{3}[]{3}[]{4}" type="phone" class="field text fn inputs" value="@@phone" tabindex="2"></div>
				</div>
				<div>
					<label class="desc" for="support.sp.email">Email</label>
					<div><input id="support.sp.email" onkeyup="atku(this);" name="support.sp.email" pattern="[a-z0-9._%+-]+@[=a-z0-9.-]+[a-z]{2,3}$" type="email" class="field text fn inputs" value="@@email" tabindex="3"></div>
				</div>
				<div>
					<label class="" for="support.sp.desc">Message</label>
					<div>
						<textarea rows="10" class="" id='support.sp.desc' name='support.sp.desc' spellcheck='true' placeholder='Describe your issue here' tabindex='4'></textarea>
						<label class="" id="support.sp.desc"></label>
					</div>
				</div>
				<div>
					<label>Action</label>
					<div>			
						<button tabindex='5' onclick="sendsupport();">Send</button>
					</div>
				</div>
				<hr>
				<div>
					<label>Alternative Contact</label>
					<div style='padding:6px;'>
						<p>Contact: Jana Tostrude</p>
						<p>Phone: 415-794-5262</p>
						<p>
							Email: <a href="mailto:jana@rbpsoftwaresolutions.com?subject=Support Request&amp;body=Please contact me about your software.  My phone number is below:">jana@rbpsoftwaresolutions.com</a>
						</p>
					</div>
				</div>
			</div>
		</div>
	</form>
	<div id='support-form-working' style='display:none;margin:50px;'>Working, please wait...</div>
</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _footable_attributes = (function () {/*
class='footable' data-page-navigation='.pagination' data-page-size='10'
	data-first-text='First Page'
	data-previous-text='Prev Page'
	data-next-text='Next Page'
	data-last-text='Last Page'
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];								
		
const _tickets_table = (function () {/*
<table id='tickets-table-@@status' style='display:none;' class='footable' data-page-navigation='.pagination' data-page-size='10'
	data-first-text='First Page'
	data-previous-text='Prev Page'
	data-next-text='Next Page'
	data-last-text='Last Page'
	>
		<thead>
			<tr>
				<th>Type</th>
				<th data-hide='phone'>Input Method</th>
				<th onmouseup='alert(hC(this,"footable-sorted-desc")); stat_s="tk";'  data-hide='phone'>Ticket</th>
				<th onclick='stat_s="dt";' data-hide='phone,tablet'>Date</th>
				<th onclick='stat_s="gn";'>Guest Name</th>
				<th onclick='stat_s="cn";' data-hide='phone,tablet'>Confirmation #</th>
				<th onclick='stat_s="am";' data-hide='phone,tablet'>Amount</th>
				<th onclick='stat_s="as";' data-hide='phone,tablet'>Assignment</th>
			</tr>
		</thead>
		<tbody id='tickets.table.@@status'>
			@@table_rows
		</tbody>
		<tfoot>
			<tr>
				<td colspan='99'>
					@@bottombuttons					
					@@pages
					<div style='float:right;' class='pagination pagination-centered hide-if-no-paging'></div>
					
				</td>
			</tr>
		</tfoot>
	</table>
	<div id='add-ticket-working-@@status' style='padding:50px;'>Working, please wait...</div>	
	<div class='ticket-form' id='ticket-form-@@status' style='display:none; border:1px solid #ccc;'></div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _ticket_tr = (function () {/*
<tr id='ticket-trow-@@status-@@id' style='cursor:pointer;' onclick='
		sdtn("tickets-table-@@status");
		edtk_id = @@id;
		edtk_prop = @@prop;
		edtk_status = @@status;
		edtk("/edit-ticket?id=@@id&status=@@status&prop=@@prop","ticket-form-@@status");'>
	<td class='footable-first-column'>@@initial_desc_type @@file</td>
	<td>@@input_desc_method</td>
	<td data='@@lockedby @@expires'>@@ticketno <div class='lockdiv'>@@locked</div></td>
	<td style='width:20%;'>
	<time datetime="@@isodate" data-localtime-format></time>
	<time class="timeago" datetime="@@isodate"></time>
	</td><td>@@fname @@mi @@lname @@bubble</td>
	<td>@@confirmation</td>
	<td style='text-align: right;'>@@amount</td><td>@@asname</td>
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _bottom_button = (function () {/*
<button onclick="sdtn('tickets-table-@@status');divup('/add-ticket?status=@@status&prop=@@prop','ticket-form-@@status');" style="cursor:pointer;" >Add Ticket</button>
	@@linkpropbutton			
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];			
	
const _bottom_search = (function () {/*
<input id="tickets-filter-@@status" type="text" placeholder="Find (ctrl+shift+f)" style="max-width: 170px;display: inline;padding: 6px;"
	onkeyup="tfilter('tickets-table-@@status', this);"
	>
	<button onclick="
		gebi('tickets-filter-@@status').value = '';
		tfilter('tickets-table-@@status', gebi('tickets-filter-@@status'));
	">Clear
</button>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];			

const _linksite_button = (function () {/*
<button onclick="window.open('@@linksite');" style="cursor:pointer;" >Property Site...</button>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _ticket_pages = (function () {/*
<select onchange="show_records(this,'tickets-table-@@status');" title="Tickets to show at one time" style="float:right;margin-left: 10px;width:55px;">
	<option value="10">10</option>
	@@more_options
	<option value="@@count">All</option></select>
</select>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _status_report_pages = (function () {/*
<select onchange="show_records(this,'status-report-table');" title="Groups to show at one time" style="float:right;margin-left: 10px;width:55px;">
	<option value="10">10</option>
	@@more_options
	<option value="@@count">All</option></select>
</select>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

	function ppages(len, bit, token){
	var pages = '';
	if(len > 10){
		pages = bit;
		if(len > 25){pages.replace('@@more_options',"<option value='25'>25</option>@@more_options")}
		if(len > 50){pages.replace('@@more_options',"<option value='50'>50</option>")}
		pages = pages.replace(token, len)
	}
	return pages
}
	
const _status_report_row = (function () {/*
<tr>
	<td>@@name</td>
	<td>@@total_count</td>
	<td>@@STATUSX_SUBMITTED_STATUSX_CATEGORIZED</td>
	<td>@@STATUS_PENDING</td>
	<td>@@STATUS_WAITING</td>
	<td>@@STATUS_REOPENED</td>
	<td>@@STATUS_APPROVED</td>
	<td style='text-align: right;'>@@total_amount</td>
	<td style='text-align: right;'>@@average_amount</td>
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _status_report_footer = (function () {/*
<tr>
	<th>Totals (all pages):</th>
	<th>@@cntTotalTotal</th>
	<th>@@cntTotalSubmittedAndCategorized</th>
	<th>@@cntTotalPending</th>
	<th>@@cntTotalWaiting</th>
	<th>@@cntTotalReopened</th>
	<th>@@cntTotalApproved</th>
	<th style='text-align: right;'>@@sumTotalTotal</th>
	<th style='text-align: right;'>@@sumTotalAverage</th>
</tr>
<tr style='height:55px;'>
	<td colspan='99'>
		@@pages
		<div style='float:right;' class='pagination pagination-centered hide-if-no-paging'></div>
	</td>
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _closed_report_footer = (function () {/*
<tr>
	<td colspan='99'>
		<input id='closed-tickets-filter' type='text' placeholder='Find (ctrl+shift+f)' style='max-width: 170px;display: inline;padding: 6px;'
				onkeyup='tfilter(&quot;closed-tickets-filter&quot;, this);'
				>
				<button onclick='
					gebi(&quot;closed-tickets-filter&quot;).value = &quot;&quot;;
					tfilter(&quot;closed-tickets-filter&quot;, gebi(&quot;closed-tickets-filter&quot;));
				'>Clear</button>
		@@pages
		<div style='float:right;' class='pagination pagination-centered hide-if-no-paging'></div>
	</td>
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _users_tr = (function () {/*
<tr id='assoc-tr-@@id' style='cursor:pointer;' onclick='@@js'>
	<td nowrap class='footable-first-column'>@@fname @@mi @@lname</td>
	<td nowrap>@@email</td>
	<td>@@property_names</td>
	<td></td>
	<td nowrap>@@phone</td>
	@@pmore 
	<td nowrap>@@auth</td>
	<td>@@notif</td>
	<td>@@limit</td>
	@@tmore	
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _groups_tr = (function () {/*
<tr id='grp-tr-@@id' style='cursor:pointer;' onclick='@@js'>
	<td nowrap class='footable-first-column'>@@fname @@mi @@lname</td>
	<td nowrap>@@email</td>
	<td>@@property_names</td>
	<td></td>
	<td nowrap>@@phone</td>
	@@pmore 
	<td nowrap>@@auth</td>
	<td>@@notif</td>
	<td>@@limit</td>
	<td>@@groupcount</td>
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _properties_tr = (function () {/*
<tr id='prop-tr-@@id' style='cursor:pointer;' onclick='sdtn("properties-table");divup("/edit-property?id=@@id","property-edit");'>
	<td class='footable-first-column'>@@hid</td><td>@@pname</td><td>@@email</td><td>@@phone</td><td>@@fax</td><td>@@city</td><td>@@state</td><td>@@zip</td>
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _properties_tdx = (function () {/*
	<td class='footable-first-column'>@@hid</td><td>@@pname</td><td>@@email</td><td>@@phone</td><td>@@fax</td><td>@@city</td><td>@@state</td><td>@@zip</td>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _departments_tr = (function () {/*
<tr id='dept-tr-@@id' style='cursor:pointer;' onclick='sdtn("departments-table");
divup("/edit-department?id=@@id"+"&row=@@row","department-edit");'>
	<td class='footable-first-column'>@@row</td>
	<td>@@name</td>
	@@propstds
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _departments_bit = (function () {/*
<tr>
	<td style='white-space: nowrap;'>
		<input id='dept.de.show-@@id' name='dept.de.show-@@id' type='checkbox' style='float:left;margin-right: 6px;' value='User' tabindex='4' @@checked> @@name
	</td>
	<td>
		<input id='dept.de.notify-@@id' name='dept.de.notify-@@id' type='checkbox' style='' value='User' tabindex='4' @@checked2>
	</td>	
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _department_adm_row_bit = (function () {/*
<tr>
	<td style='white-space: nowrap;'><input id='dept.de.show-@@id' name='dept.de.show@@id' type='checkbox' style='float:left;margin-right: 6px;' value='User' tabindex='4' @@checked> @@name</td>
	<td><input id='dept.de.notify-@@id' name='dept.de.notify-@@id' type='checkbox' style='' value='User' tabindex='4' @@checked2></td>
	<td onclick='		
		var a=_z("/edit-department-users?id=@@id&row=@@row");a.onreadystatechange=function(){if(a.readyState==4){
		document.getElementById("dept.row.single-@@id").style.display = "none"		
		document.getElementById("dept.row.item-@@id").innerHTML = a.responseText;
		document.getElementById("dept.row.item-@@id").style.display = ""		
		}};_h(a);			
	'>
	<div id='dept.row.single-@@id' class='deptmembers' >@@usernames</div>
	<div id='dept.row.item-@@id'  style='display:none;'></div>
	</td>
</tr>

	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _prop_dept_user_table = (function () {/*
<table class='deptastable'><tbody><tr>
	@@rows
</tbody></table>
<button onclick='
	var usrs = [];
	$(".deptusr-@@id").each(function (index, value) { 
		if($(this).is(":checked")){
		usrs.push($(this).attr("uid"))
		}
	});
	
	var a=_z("/save-department-users?id=@@id&row=@@row&usrs="+usrs.join(":"));a.onreadystatechange=function(){if(a.readyState==4){
	document.getElementById("dept.row.item-@@id").style.display = "none"		
	document.getElementById("dept.row.item-@@id").innerHTML = "";
	document.getElementById("dept.row.single-@@id").innerHTML = a.responseText;
	document.getElementById("dept.row.single-@@id").style.display = ""		
	}};_h(a);
'>Save</button>
<button onclick='
	document.getElementById("dept.row.single-@@id").style.display = ""		
	document.getElementById("dept.row.item-@@id").innerHTML = "";
	document.getElementById("dept.row.item-@@id").style.display = "none"		
	cancelBubble(event);
'>Cancel</button>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _emailhistory_tr = (function () {/*
<tr id='eml-tr-@@id' style='cursor:pointer;' onclick='
	var a=_z("/admin/notification/detail?id=@@id");a.onreadystatechange=function(){if(a.readyState==4){
	$("#eml-tr-@@id").closest("TR").after(a.responseText);
	}};_h(a);
	'>
	<td class='footable-first-column'>@@row</td>
	<td style='white-space:nowrap;'><time datetime='@@isodate' data-localtime-format></time><time class='timeago2' datetime='@@isodate'></time></td>
	<td style='white-space:nowrap;'>@@prop</td>
	<td style='white-space:nowrap;'>@@user</td>
	<td>@@fromlist</td>
	<td>@@count</td>
	<td>@@tolist</td>
	<td>@@subject</td>
	<td>@@response</td>
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _emailhistory_tr_item = (function () {/*
<tr id='eml-msg-@@id'>
	<td></td><td colspan=8>
		<div class='emailmore'>@@body</div>
		<button onclick='$("#eml-msg-@@id").remove();'>Close</button>
		<div style='display:inline;'>Note: Any links above may no longer be active</div>
	</td>
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
/* This is a common form for add and edit associates.  If you're a superadmin, then you can add associates at will with or without 
   association with a property.  If you're an admin, then you can only add associates to your property.  Since we allow associates
   to be added under their own tab, then if you're an admin, when you add an associate you must select a property for the new
   associate.  */
   
//not used?
  const _auth_row = (function () {/*  	
<tr @@gpinputshow>
	<td><input @@readonly id='assoc.ae.auth.@@autoID' name='assoc.ae.auth.@@autoID' type='checkbox' value='@@authname' tabindex='@@ti' @@chk onclick='authone(@@autoID, @@uadmin, "@@deflimit");'></td>
	<td><label style='text-align:left;' class='desc' id='title4' for='assoc.ae.auth.@@autoID'>@@authname</label>
	@@more
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _auth_row_td_all = (function () {/*  	
	<tr @@gpinputshow><td><input @@readonly id='assoc.ae.auth.@@id' name='assoc.ae.auth.@@id' type='checkbox' value='@@authname' tabindex='@@ti' @@chk onclick='authone(@@id, @@uadmin, "@@deflimit");'></td><td><label style='text-align:left;' class='desc' id='title4' for='assoc.ae.auth.@@id'>@@authname</label>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _auth_row_td_type2 = (function () {/*  	
	<td><div><input style='margin-bottom: -4px !important;' @@readonly id='assoc.ae.limit' name='assoc.ae.limit' type='text' class='field text fn inputs' value='@@credit' size='20' tabindex='@@ti'></div></td>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _auth_row_td_type_other = (function () {/*  	
	<td><div style='padding:6px;' id='assoc.ae.auth.limit.@@id'>@@deflimit</div></td>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _notify_row = (function () {/*  		
	<tr><td><input @@readonly id='assoc.ae.notif.@@xy' name='assoc.ae.notif.@@xy' type='checkbox' value='' tabindex='@@ti2' @@chk></td>
		<td><label style='text-align:left;' class='desc' id='title4' for='assoc.ae.notif.@@xy'>@@name</label></td></tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _blog_photo_notyet = (function () {/*  		
	<div>
		<label class="desc" style="padding-top: 10px;">Blog Image</label>			
		<div style='padding-top:10px;'>					
			A blog image can be uploaded after the record is created.
		</div>				
		
	</div>		
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _blog_photo_ok = (function () {/*  		
	<div>
		<label class="desc" style="padding-top: 10px;">Blog Image</label>			
		<div style='padding-top:10px;'>					
			
			@@image
			
			<button class='blog-add-file-@@id' onclick='
				$(".blog-add-file-@@id").hide();
				$(".blog-add-file-detail-@@id").fadeIn();
			'>Add/Replace Image
			</button>

			<div class='blog-add-file-detail-@@id' style='display:none;'>
				<label class='desc' for='blog.bg.fname'>Choose an Image File to Upload</label>
				<div>
					<div style='display:inline;'>
						<form id='upload_form' enctype='multipart/form-data' target='receiver' action='/bupload' method='POST'>
							<input type='hidden' name='id' value='@@id'>
							<input type='hidden' name='MAX_FILE_SIZE' value='100000' />
							<div style='display:inline;'>Step 1: <input style='display:inline; margin-top: 4px; margin-bottom: 4px;' name='uploadedfile' 
							type='file' value='Choose File (png, jpg, jpeg)'
							accept='image/jpeg,image/png,image/gif'/></div><br>
							<div style='display:inline;'>Step 2: <input style='display:inline;' type='submit' onclick='
								dspArray("receiver","");												
								' value='Upload File' /></div>						
						</form>						
					</div>
					
				</div>
			</div>
			<iframe name='receiver' id='receiver' style='display:none;height:60px;margin-bottom: 10px;border:1px solid #c0c0c0;width: 100%;'></iframe>

		</div>				
		
	</div>		
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _admin_blog_form = (function () {/*  	
<br>
<div class='frm'>	
	<div>
		<div>
			<div>
				<label class="date" for="blog.bg.date-@@id">Visible Date</label>
				<div><input id="blog.bg.date-@@id" name="blog.bg.date-@@id" type="text" class="field text fn inputs" value="@@date" size="2" tabindex="1"></div>
			</div>
			<div>
				<label class="rdate" for="blog.bg.rdate-@@id">Real Date (used for sorting)</label>
				<div><input id="blog.bg.rdate-@@id" name="blog.bg.rdate-@@id" type="text" placeholder="mm/dd/yyyy" class="field text fn inputs" value="@@rdate" size="2" tabindex="1"></div>
			</div>
			<div @@visshow>
				<label class="visible" for="blog.bg.visible-@@id">Visible</label>
				<div><input id="blog.bg.visible-@@id" name="blog.bg.visible-@@id" type="checkbox" @@vis_checked></div>
			</div>
			<div>
				<label class="desc" for="blog.bg.title-@@id">Blog Title</label>
				<div><input id="blog.bg.title-@@id" name="blog.bg.title-@@id" type="text" class="field text fn inputs" value="@@title" size="2" tabindex="2"></div>
			</div>
			<div>
				<label class='desc' for='blog.bg.intro-@@id' style='padding-top: 10px;'>Introduction Paragraph</label>
				<div>
					<p style='margin-top:10px;'>You can use &#60;b&#62;something bold&#60;/b&#62; and &#60;p&#62;Paragraph Text&#60;/p&#62; HTML codes.</p>
					<textarea id='blog.bg.intro-@@id' name='blog.bg.intro-@@id' spellcheck='true' rows='3' cols='55' tabindex='3'>@@intropara</textarea>
				</div>
			</div>
			<div>
				<label class='desc' for='blog.bg.desc-@@id' style='padding-top: 10px;'>Article Text</label>
				<div>
					<p style='margin-top:10px;'>You can use &#60;b&#62;something bold&#60;/b&#62; and &#60;p&#62;Paragraph Text&#60;/p&#62; HTML codes.</p>
					<textarea id='blog.bg.desc-@@id' name='blog.bg.desc-@@id' spellcheck='true' rows='5' cols='55' tabindex='4'>@@fulltext</textarea>
				</div>
			</div>
			@@photo_upload
		</div>
	</div>
	<div>
		<div>
			<div>
				<label class="desc">Options</label>
				<div>
					@@buttons
				</div>
			</div>
		</div>
	</div>
</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	
	
	
const _common_user_form = (function () {/*  	
<div class='frm'>	
	<div>
		<div>
			

			<div>
				<label class="desc" for="assoc.ae.fname">@@first_name_label</label>
				<div><input @@readonly id="assoc.ae.fname" name="assoc.ae.fname" type="text" class="field text fn inputs" value="@@fname" size="12" tabindex="1"></div>
			</div>
			<div @@gphide>
				<label class="desc" for="assoc.ae.mi">Middle Initial</label>
				<div><input @@readonly id="assoc.ae.mi" name="assoc.ae.mi" type="text" class="field text fn inputs" value="@@mi" size="2" tabindex="2"></div>
			</div>
			<div @@gphide>
				<label class="desc" for="assoc.ae.lname">Last Name</label>
				<div><input @@readonly id="assoc.ae.lname" name="assoc.ae.lname" type="text" class="field text fn inputs" value="@@lname" size="12" tabindex="3"></div>
			</div>
			<div>
				<label class="desc" for="assoc.ae.email">Email</label>
				<div><input @@readonly_email id="assoc.ae.email" name="assoc.ae.email" type="text" class="field text fn inputs" value="@@email" size="12" tabindex="4"></div>
			</div>
			<div>
				<label class="desc" for="assoc.ae.phone">Phone</label>
				<div><input @@readonly onblur="formatPhone(this);" id="assoc.ae.phone" name="assoc.ae.phone" type="text" class="field text fn inputs" value="@@phone" size="12" tabindex="5" pattern="\d{3}[\-]\d{3}[\-]\d{4}"></div>
			</div>
			<div @@poshide>
				<label class="desc" for="assoc.ae.pos">Title</label>
				<div>
					<select @@readonly id="assoc.ae.position" name="assoc.ae.position" class="field text fn inputs" value="@@position" tabindex="6">
						<option value='1' @@tsel1>Associate</option>
						<option value='2' @@tsel2>Director</option>
						<option value='3' @@tsel3>Manager</option>
						<option value='4' @@tsel4>Credit Manager</option>
						<option value='5' @@tsel5>Ass't Dir of Finance</option>
						<option value='6' @@tsel6>Director of Finance</option>										
					</select>
				</div>
			</div>
			<div @@gpshow>
				<label class="desc" for="assoc.ae.gcount">Max Logins</label>
				<div>
					<select @@readonly id="assoc.ae.gcount" name="assoc.ae.gcount" class="field text fn inputs" value="@@groupcount" tabindex="7">
						@@gcoptions												
					</select>
				</div>
			</div>
			<div $gpshow>
				<label class="desc" for="assoc.ae.auth">Authority</label>
				<div style='margin-bottom: 6px; padding-top: 6px;'>			
					<table class='resptable spaced'><thead><th colspan='2'>Authority</th><th>Credit Limit</th></thead><tbody>
						@@auth_rows
					</tbody></table><div style='display:none;' id='authkeys'>@@alist</div>
				</div>
			</div>
			<div style='display:;'>		
				<label class="desc" for="assoc.ae.assign">Ticket Assignments</label>
				<div>
				<table class="notiftable"><tbody>
					@@assignblock
					<tr>
					<td><input @@gschk id='assoc.ae.gssign' name='assoc.ae.gssign' type='checkbox'></td>
					<td><label class="desc">Exclude from ticket assignments list of associates</label></td>
					</tr>
				</tbody></table>
				</div>
			</div>
			
			<div>		
				<label class="desc" for="assoc.ae.notif">Inquiry Notification</label>
				<div>
				<table class="notiftable">
					@@notif				
				</table>
				<div style='display:none;' id='notifkeys'>@@nlist</div>
			</div>
			</div>		
				@@selprop				
				@@propdivlist
			
		</div>
	</div>
	<div>
		<div>
			
				<label class="desc">Options</label>
				<div>
					@@buttons
				</div>
			
		</div>
	</div>
</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	
	
const _common_user_edit = (function () {/*  	

	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	

const _associate_add_buttons = (function () {/*
<button tabindex='@@ti1' onclick='
					
					rC("assoc.ae.fname","flderror");
					rC("assoc.ae.lname","flderror");
					rC("assoc.ae.email","flderror");
					rC("assoc.ae.prop.div","flderror")
					
					var er = false;
					var aefn=gdv("assoc.ae.fname");		if(aefn.length==0){er=true;aC("assoc.ae.fname","flderror")}
					var aemi=gdv("assoc.ae.mi");
					var aegc=parseInt(gdv("assoc.ae.gcount"));
					var aeln=gdv("assoc.ae.lname");		if(aeln.length==0 && aegc==0){er=true;aC("assoc.ae.lname","flderror")}
					var aeem=gdv("assoc.ae.email");		if(aeem.length==0 || validateEmail(aeem)==false){er=true;aC("assoc.ae.email","flderror")}
					var aeph=gdv("assoc.ae.phone");     if(aeph.length>0 && aeph.length != 16){er=true;aC("assoc.ae.phone","flderror")}
					var aepo=gdv("assoc.ae.position");
					
					
					var aeau = gdi("authkeys").split(",");
					for(var x=aeau.length-1;x>=0;x--){if(!gebi("assoc.ae.auth."+aeau[x]).checked){aeau.splice(x, 1);}}			
					var aeno = gdi("notifkeys").split(",");
					for(var x=aeno.length-1;x>=0;x--){if(!gebi("assoc.ae.notif."+aeno[x]).checked){aeno.splice(x, 1);}}			
					var aecr=gdv("assoc.ae.limit");
					var aeua = parseInt(gdi("assoc.ae.uad"));
					
					var aeua_cnt = 0;
					var aeua_sel = [];
					if(aeua==1){
						var aeua_lst = gdi("assoc.ae.prop.list").split(";")
						for(var x=0;x<aeua_lst.length;x++){
							if(gebi("assoc.ae.prop."+aeua_lst[x]).checked){
								aeua_cnt+=1;
								aeua_sel.push(aeua_lst[x]);
							}
						}
						if(aeua_cnt==0){er=true;aC("assoc.ae.prop.div","flderror")}
					}
					if(er){
						alert("Some required data is missing, or the data is not valid.");
						$("html, body").scrollTop(0)
						return;
					}
					
					divtpost(
						"/@@ident-add-accept?fname="+aefn+"&mi="+aemi+"&lname="+aeln+"&email="+aeem+"&phone="+aeph+"&position="+aepo+"&auth="+aeau+"&notif="+aeno+"&limit="+aecr+"&props="+aeua_sel+"&group="+aegc,
						"@@idents-table",
						"@@ident-add",
						"",
						"@@ident-add-edit-working",
						""
					);cancelBubble(event);			
					'>Add</button>
					<button tabindex='@@ti2' onclick='cd("@@ident-add");dspArray("@@ident-add","none");dspArray("@@idents-table","");'>Cancel</button>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1]
	
const _common_inquiry_form = (function () {/*  	
<div class='frm'>
	<div>
		<div>			
			<div>
				<label class="desc" for="inq.ie.name">Inquiry Type Name</label>
				<div><input onkeyup='ckall()' @@namereadonly id="inq.ie.name" name="inq.ie.name" type="text" class="field text fn" value="@@name" size="12" tabindex="1"></div>
			</div>
			<hr>
			<div>
				<label class="desc" for="inq.ie.name">Inquiry Type Name</label>
				<div>
					<table class='footable' style='width:auto;' @@footable_attributes>
						<thead>
							<tr>
								<th>Property (Inquiry Type Enabled)</th>
								<th>Optional Sub-description</th>
							</tr>
						</thead>
						<tbody>
							@@rows
						</tbody>
					</table>
					<div id='inq.ie.props' style='display:none;'>@@row_props</div>
				</div>
			</div>
		</div>
	</div>
	<div id='inqwrap'>		
	</div>
	<div>
		<div>
			<div>
				<label class="desc">Options</label>			
				<div>
					@@buttons					
				</div>
			</div>
		</div>
	</div>
</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _inquiries_add_buttons = (function () {/*  	
<button onclick='
		var iqna=gdv("inq.ie.name");	
	
		dspArray("inquiry-add","none");
		dspArray("inquiry-add-edit-working","");
		var iepa = gdi("inq.ie.props").split(",");
		var iepav = []
		var iepas = []
		for(var x=0;x<iepa.length;x++){
			var v = (document.getElementById("inq.ie.show-"+iepa[x]).checked ? 1 : 0);
			var d = document.getElementById("inq.ie.subdesc-"+iepa[x]).value
			iepav.push(iepa[x]+":"+v+":"+d)			
		}
		//console.log(iepav);	

		
		var a=_z("/inquiry-add-accept?name="+iqna+"&propenab="+iepav);a.onreadystatechange=function(){if(a.readyState==4){		
		var tr = a.responseText.split("::::");	
		var tr = a.responseText.split("::::");	
		//console.log(tr);
		if(tr[0]==="alert"){
			alert(tr[1]);
			dspArray("inquiry-add-edit-working","none");
			dspArray("inquiry-add","");
			return;
		} else {
			if(tr[0]==="tr"){
				var footable = $("#inquiries-table");			
				footable.data("footable").appendRow(tr[2]);		
				//sdi("groupCnt-"+stat_ps, parseInt(gdi("groupCnt-"+stat_ps))+1);				
				//find out where the row ended up based on sort
				var rows = $("#inquiries-table tbody tr")
				var row = rows.length - 1		
				for(var r=0;r<rows.length;r++){			
					if(rows[r].id==tr[1]){
						row = r;
					}
				}		
				var p = parseInt(row / 10)
				dspArray("department-add-edit-working","none");
				footable.data("currentPage",p);
				try {
					footable.resize();
				} catch(err) {
				
				}
				
				
				jQuery("time.timeago").timeago();
				$.localtime.setFormat("M-d-yyyy h:mm a");
				$.localtime.format();
				
				dspArray("departments-table","");cd("department-add");dspArray("department-add","none");
								
				$("#"+rows[row].id).css("background-color", "rgba(0, 0, 153, 0.68)");
				$("#"+rows[row].id).css("color", "#fff");
				$("#"+rows[row].id).animate({backgroundColor: "#fff", color: "#000"}, 5000 );				
			}					
		}	
		}};_h(a);
	'>Add</button>
	<button onclick='cd("inquiry-add");dspArray("inquiry-add","none");dspArray("inquiries-table","");cancelBubble(event);'>Cancel</button>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	

const _inquiries_edit_buttons = (function () {/*  	
<button onclick='			
	var inpr=gdv("inq.ie.prop");
	var iqna=encode(gdv("inq.ie.name"));
	var inen=""
	var insb=""
	if(inpr>0){
	var iqen=gebi("inq.ie.show").checked;			                               
	var iqsb=gdv("inq.ie.subdesc");
	}
	
		//dspArray("inquiry-add","none");
		//dspArray("inquiry-add-edit-working","");
	var iepa = gdi("inq.ie.props").split(",");
	var iepav = []
	var iepas = []
	for(var x=0;x<iepa.length;x++){
		var v = (document.getElementById("inq.ie.show-"+iepa[x]).checked ? 1 : 0);
		var d = document.getElementById("inq.ie.subdesc-"+iepa[x]).value
		iepav.push(iepa[x]+":"+v+":"+d)			
	}
	//console.log(iepav);	
	
	//divtedit("/inquiry-edit-accept?id=@@id&row=@@row&propid="+inpr+"&name="+iqna+"&enabled="+iqen+"&subdesc="+iqsb,"inquiries-table",@@id,"inquiry-edit","inq-tr-@@id");
	//cancelBubble(event);			
	
	var a=_z("/inquiry-edit-accept?id=@@id&row=@@row&name="+iqna+"&propenab="+iepav);a.onreadystatechange=function(){if(a.readyState==4){		
		var tr = a.responseText.split("::::");	
		
		if(tr[0]==="tr"){		
			gebi("inq-tr-@@id").innerHTML = tr[2]
			dspArray("inquiries-table","");cd("inquiry-edit");dspArray("inquiry-edit","none");
		} else {
			dspArray("inquiry-edit","")
			alert(tr[1]);
		}
		
		}};_h(a);
	
	'>Save</button>
	<button onclick='cd("inquiry-edit");dspArray("inquiry-edit","none");dspArray("inquiries-table","");cancelBubble(event);'>Cancel</button>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _property_add_buttons = (function () {/*
<button onclick='
	var er = false;
	var prfn=gdv("prop.pr.pname"); if(prfn.length==0){er=true;gebi("prop.pr.pname").style.borderColor="red";}
	var prem=gdv("prop.pr.email");
	var prph=gdv("prop.pr.phone");
	var prfx=gdv("prop.pr.fax");
	var prci=gdv("prop.pr.city");
	var prst=gdv("prop.pr.state");
	var przp=gdv("prop.pr.zip");
	if(er){
		alert("Some required data is missing.");
		$("html, body").scrollTop(0)
		return;
	}		

	dspArray("property-add","none");
	dspArray("property-add-edit-working","");
	var a=_z("/property-add-accept?pname="+encode(prfn)+"&email="+prem+"&phone="+prph+"&fax="+prfx+"&city="+prci+"&state="+prst+"&zip="+przp);a.onreadystatechange=function(){if(a.readyState==4){		
	
	var tr = a.responseText.split("::::");	
	
	if(tr[0]==="alert"){
		alert(tr[1]);
		dspArray("property-add-edit-working","none");
		dspArray("property-add","");
		return;
	} else {
		if(tr[0]==="tr"){
			dspArray("properties-table","");cd("property-add");dspArray("property-add","none");			
			var footable = $("#properties-table");			
			footable.data("footable").appendRow(tr[2]);		
			//find out where the row ended up based on sort
			var rows = $("#properties-table tbody tr")
			var row = rows.length - 1		
			for(var r=0;r<rows.length;r++){			
				if(rows[r].id==tr[1]){
					row = r;
				}
			}		
			var p = parseInt(row / 10)
			dspArray("property-add-edit-working","none");
			footable.data("currentPage",p);
			try {
				footable.resize();
			} catch(err) {
			
			}
			
			jQuery("time.timeago").timeago();
			$.localtime.setFormat("M-d-yyyy h:mm a");
			$.localtime.format();
			
						
			
			$("#"+rows[row].id).css("background-color", "rgba(0, 0, 153, 0.68)");
			$("#"+rows[row].id).css("color", "#fff");
			$("#"+rows[row].id).animate({backgroundColor: "#fff", color: "#000"}, 5000 );
			
		}
	}
	
	}};_h(a);
	'>Add</button>
	<button onclick='cd("property-add");dspArray("property-add");dspArray("properties-table","");'>Cancel</button>	
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _common_department_form = (function () {/*  		
	<div class='frm'>	
		<div>
			<div>
				<div>
					<label class="desc" for="dept.de.fname">Department Name</label>
					<div><input @@namereadonly id="dept.de.name" name="dept.de.name" type="text" class="field text fn" value="@@name" size="12" tabindex="1"></div>
				</div>
				<hr>
				<div>
				<label class="desc" for="dept.de.name">Department Assignments</label>
				
				<div>					
					
					<table class='footable' style='width:auto;' @@footable_attributes>
						<thead>
							<tr>
								<th>Property (Department Enabled)</th>
								<th>Send All Notifications</th>
								<th>Assigned Associates/<em>Group Logins</em></th>
							</tr>
						</thead>
						<tbody>
							@@rows
						</tbody>
					</table>
					<div id='dept.de.props' style='display:none;'>@@row_props</div>
				</div>
			</div>
			</div>
		</div>
		<div id='propwrap'>
		</div>
		<div>
			<div>
				<div>
					<label class="desc">Options</label>
					<div>
						@@buttons
					</div>
				</div>
			</div>
		</div>
	</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _departments_add_buttons = (function () {/* 
<button onclick='
		var dena=gdv("dept.de.name");	
	
		dspArray("department-add","none");
		dspArray("department-add-edit-working","");
		var depa = gdi("dept.de.props").split(",");
		var depav = []
		var depas = []
		
		for(var x=0;x<depa.length;x++){
			var v = (document.getElementById("dept.de.show-"+depa[x]).checked ? 1 : 0);
			var n = document.getElementById("dept.de.notify-"+depa[x]).value
			depav.push(depa[x]+":"+v+":"+n)			
		}
		
		
		var a=_z("/department-add-accept?name="+dena+"&propenab="+depav);a.onreadystatechange=function(){if(a.readyState==4){		
		var tr = a.responseText.split("::::");	
		//console.log(tr);
		if(tr[0]==="alert"){
			alert(tr[1]);
			dspArray("department-add-edit-working","none");
			dspArray("department-add","");
			return;
		} else {
			
			if(tr[0]==="tr"){
				dspArray("departments-table","");cd("department-add");dspArray("department-add","none");
				var footable = $("#departments-table");			
				try {
					footable.data("footable").appendRow(tr[2]);	
				} catch(err) {
					
				}
				
				//find out where the row ended up based on sort
				var rows = $("#departments-table tbody tr")
				var row = rows.length - 1		
				for(var r=0;r<rows.length;r++){			
					if(rows[r].id==tr[1]){
						row = r;
					}
				}		
				var p = parseInt(row / 10)
				dspArray("department-add-edit-working","none");
				footable.data("currentPage",p);
				try {
					footable.resize();
				} catch(err) {
				
				}
				
				jQuery("time.timeago").timeago();
				$.localtime.setFormat("M-d-yyyy h:mm a");
				$.localtime.format();
				$("#"+rows[row].id).css("background-color", "rgba(0, 0, 153, 0.68)");
				$("#"+rows[row].id).css("color", "#fff");
				$("#"+rows[row].id).animate({backgroundColor: "#fff", color: "#000"}, 5000 );				
			}
						
		}	
		}};_h(a);
	'>Add</button>
	<button onclick='cd("department-add");dspArray("department-add","none");dspArray("departments-table","");cancelBubble(event);'>Cancel</button>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _departments_edit_buttons = (function () {/*  	
<button onclick='				
	var depts = gdi("dept.de.props").split(",")
	var desh = []; var denf = []
	for(var x=0;x<depts.length;x++){
		if(gebi("dept.de.show-"+depts[x]).checked){desh.push(1)}else{desh.push(0)}
		if(gebi("dept.de.notify-"+depts[x]).checked){denf.push(1)}else{denf.push(0)}
	}		
	var dena=gdv("dept.de.name");
	divtedit("/department-edit-accept?show="+desh.join("")+"&notify="+denf.join("")+"&row="+@@row+"&deptid="+@@id+"&name="+encode(dena),"departments-table",@@id,"department-edit","dept-tr-@@id");cancelBubble(event);
	'>
	Save</button>
<button onclick='cd("department-edit");dspArray("department-edit","none");dspArray("departments-table","");cancelBubble(event);'>Cancel</button>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _common_property_form = (function () { /*
	<div class='frm'>	
		<div>
			@@content		
		</div>
		<div>
			<div>
				<div>
					<label class='desc'>Options</label>
					<div>
					@@buttons	
					</div>
				</div>
			</div>
		</div>
		<hr>
		<div>
			@@more
		</div>
	</div>
*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];			
	
const _common_property_super_global_options = (function () { /*
<div>
	<div>			
		<label><b>Global Options (Super Admin)</b></label>
		<div>
			<select style='width:auto' id='prop-opt-select' onchange='
			for(var x=0;x<4;x++){
				if(this.value==x){
					dspArray("prop-opt-section-"+x,"");
				}else{
					dspArray("prop-opt-section-"+x,"none");
				}
			}
			'>
				<option value='0' selected>Select</option>
				<option value='1'>Global Department Commands</option>
				<option value='2'>Global Inquiry Type Commands</option>
			</select>
		</div>
	</div>
	<div id='prop-opt-section-1' style='display:none'>		
		<div>
			<div>
				<p style='max-width: 433px'>Use these options to make global changes for this property's departments.</p>
			</div>
		</div>
		<div>
			<div>
				<button onclick='dspArray("prop-opt-section-1-msg","");'>Enable All Departments</button>
			</div>
			<div id='prop-opt-section-1-msg' style='display:none'>
				<label>This will enable all system default departments for this Property.  Are you sure?</label>
				<button onclick='divpopglobal("/global",@@id,1);'>Yes</button>
				<button onclick='dspArray("prop-opt-section-1-msg","none");'>No</button>
			</div>					
		</div>
	</div>
	<div id='prop-opt-section-2' style='display:none'>		
		<div>
			<div>
				<p style='max-width: 433px'>Use these options to make global changes for this property's inquiry types.</p>
			</div>
		</div>
		<div>
			<div>
				<button onclick='dspArray("prop-opt-section-2-msg","");'>Enable All Inquiry Types</button>
			</div>
			<div id='prop-opt-section-2-msg' style='display:none'>
				<label>This will enable all system default inquiry types for this Property.  Are you sure?</label>
				<button onclick='divpopglobal("/global",@@id,2);'>Yes</button>
				<button onclick='dspArray("prop-opt-section-2-msg","none");'>No</button>
			</div>					
		</div>
	</div>
</div>
<hr>	
*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _common_property_main_form = (function () { /*
<div id="prop.pr.prop" style="display:none;">@@id</div>
	<div>
		<div>
			<label class="desc" for="prop.pr.pname">Property Name</label>
			<div><input @@readonly id="prop.pr.pname" name="prop.pr.pname" type="text" class="field text fn inputs" value="@@pname" size="12" tabindex="1"></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.shortname">Abbreviated Name</label>
			<div><input @@readonly id="prop.pr.shortname" name="prop.pr.shortname" type="text" class="field text fn inputs" value="@@shortname" size="12" tabindex="2"></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.email">Email</label>
			<div><input @@readonly id="prop.pr.email" name="prop.pr.email" type="text" class="field text fn inputs" value="@@email" size="12" tabindex="2"></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.phone">Phone</label>
			<div><input @@readonly onblur="formatPhone(this);" id="prop.pr.phone" name="prop.pr.phone" type="text" class="field text fn inputs" value="@@phone" size="12" tabindex="3" pattern="\d{3}[\-]\d{3}[\-]\d{4}"></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.fax">Fax</label>
			<div><input @@readonly id="prop.pr.fax" name="prop.pr.fax" type="text" class="field text fn inputs" value="@@fax" size="12" tabindex="4" pattern="\d{3}[\-]\d{3}[\-]\d{4}"></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.city">City</label>
			<div><input @@readonly id="prop.pr.city" name="prop.pr.city" type="text" class="field text fn inputs" value="@@city" size="12" tabindex="5" ></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.state">State</label>
			<div><input @@readonly id="prop.pr.state" name="prop.pr.state" type="text" class="field text fn inputs" value="@@state" size="12" tabindex="6" ></div>		
		</div>
		<div>
			<label class="desc" for="prop.pr.zip">Zip Code</label>
			<div><input @@readonly id="prop.pr.zip" name="prop.pr.zip" type="text" class="field text fn inputs" value="@@zip" size="12" tabindex="7" ></div>
		</div>
		<div>
			<label class="desc">Note</label>
			<div style='margin-top:6px;'>All existing Departments and Inquiry Types will be enabled by default for this Property.</div>
		</div>
	</div>			
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];		
		
const _common_property_more_form = (function () { /*
	@@global_options
	<div>
		<div>			
			<label><b>Guest Facing Inquiry Form</b></label>
			<div>
				<label style="margin-top:6px;">(These fields may require IT assistance)</label>
			</div>
		</div>
		<div>
			<label class="desc" for="prop.pr.css">CSS Path</label>
			<div><textarea @@readonly id="prop.pr.css" name="prop.pr.css" class="field text fn inputs" tabindex="8">@@css_url</textarea></div>
		</div>
		<div style='display:none;'>
			<label class="desc" for="prop.pr.hpheader">Form Header</label>
			<div><textarea @@readonly id="prop.pr.hpheader" name="prop.pr.hpheader" class="field text fn inputs" tabindex="">@@header</textarea></div>
		</div>
		<div style='display:none;'>
			<label class="desc" for="prop.pr.hppara1">Introduction</label>
			<div><textarea @@readonly id="prop.pr.hppara1" name="prop.pr.hppara1" class="field text fn inputs" tabindex="">@@para1</textarea></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.hppara2">Confirmation Message</label>
			<div><textarea @@readonly id="prop.pr.hppara2" name="prop.pr.hppara2" class="field text fn inputs" tabindex="9">@@para2</textarea></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.hppara3">Thank You Message</label>
			<div><textarea @@readonly id="prop.pr.hppara3" name="prop.pr.hppara3" class="field text fn inputs" tabindex="10">@@para3</textarea></div>
		</div>
		<hr>
		<div>			
			<label><b>Guest Email Defaults</b></label>
			<div>
				<select style='width:auto;' id="prop-edit-email-select" onchange="
				if(propemailchange()==false){return;}
				for(var x=0;x<4;x++){
					if(this.value==x){
						dspArray('prop-edit-email-section-'+x,'');
					}else{
						dspArray('prop-edit-email-section-'+x,'none');
					}
				}
				">
					<option value='0' selected>Select</option>
					<option value='1'>New Inquiry Email Confirmation</option>
					<option value='2'>Guest Ticket In Process Email</option>
					<option value='3'>Guest Ticket Resolution Email</option>
				</select>
			</div>
		</div>
	</div>
	<div id='prop-edit-email-section-1' style='display:none;'>		
		<div>
			<div>
				<p style='max-width: 433px;'>When a new ticket is created by a guest, the following information will be used (system defaults are shown in grey).</p>
			</div>
		</div>
		<div>
			<label class="desc" for="prop.pr.create.from">From Email Address</label>
			<div><input @@readonly id="prop.pr.create.from" name="prop.pr.create.from" type="text" onchange="prop_email_changed=true;" onkeyup="this.style.borderColor='';" class="field text fn inputs" value="@@em_create_from" size="12" tabindex="11" placeholder="noreply@rbpsoftwaresolutions.com"></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.create.subject">Message Subject</label>
			<div><textarea @@readonly id="prop.pr.create.subject" name="prop.pr.create.subject" onchange="prop_email_changed=true" class="field text fn inputs" tabindex="13" placeholder="Guest Inquiry Confirmation">@@em_create_subject</textarea></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.create.body">Message Body</label>
			<div><textarea @@readonly id="prop.pr.create.body" name="prop.pr.create.body" onchange="prop_email_changed=true" class="field text fn inputs" tabindex="14" placeholder="We have received your guest inquiry.">@@em_create_body</textarea></div>
		</div>
		<div>
			<label class="desc">Options</label>
			<div id='prop-edit-email-buttons-1'>
				<button onclick="upropmail(@@pid,&quot;create&quot;,1);">Save</button>
				<button onclick="if(propemailchange()==false){return;};dspArray('prop-edit-email-section-1','none')">Close</button>
			</div>
		</div>
	</div>
	
	
	
	<div id='prop-edit-email-section-2' style='display:none;'>		
		<div>
			<div>
				<p style='max-width: 433px;'>When a guest notification email is created for a ticket, the following information will be used (system defaults are shown in grey).</p>
			</div>
		</div>			
		<div>
			<label class="desc" for="prop.pr.process.from">From Email Address</label>
			<div><input @@readonly id="prop.pr.process.from" name="prop.pr.process.from" type="text" onchange="prop_email_changed=true" onkeyup="this.style.borderColor='';" class="field text fn inputs" value="@@em_process_from" size="15" tabindex="11"  placeholder="noreply@rbpsoftwaresolutions.com"></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.process.subject">Message Subject</label>
			<div><textarea @@readonly id="prop.pr.process.subject" name="prop.pr.process.subject" onchange="prop_email_changed=true" class="field text fn inputs" tabindex="16" placeholder="Guest Inquiry Message">@@em_process_subject</textarea></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.process.body">Message Body</label>
			<div><textarea @@readonly id="prop.pr.process.body" name="prop.pr.process.body" onchange="prop_email_changed=true" class="field text fn inputs" tabindex="17" placeholder="Message about your Guest Inquiry">@@em_process_body</textarea></div>
		</div>
		<div>
			<label class="desc">Options</label>
			<div id='prop-edit-email-buttons-2'>
				<button onclick="upropmail(@@pid,&quot;process&quot;,2);">Save</button>
				<button onclick="if(propemailchange()==false){return;};dspArray('prop-edit-email-section-2','none')">Close</button>
			</div>				
		</div>
	</div>
	
	<div id='prop-edit-email-section-3' style='display:none;'>		
		<div>
			<div>
				<p style='max-width: 433px;'>When a guest ticket is closed and a confirmation email generated, the following information will be used (system defaults are shown in grey).</p>
			</div>
		</div>			
		<div>
			<label class="desc" for="prop.pr.close.from">From Email Address</label>
			<div><input @@readonly id="prop.pr.close.from" name="prop.pr.close.from" type="text" onchange="prop_email_changed=true" onkeyup="this.style.borderColor='';" class="field text fn inputs" value="@@em_close_from" size="18" tabindex="11"  placeholder="noreply@rbpsoftwaresolutions.com"></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.close.subject">Message Subject</label>
			<div><textarea @@readonly id="prop.pr.close.subject" name="prop.pr.close.subject" onchange="prop_email_changed=true" class="field text fn inputs" tabindex="19" placeholder="Guest Inquiry Message">@@em_close_subject</textarea></div>
		</div>
		<div>
			<label class="desc" for="prop.pr.close.body">Message Body</label>
			<div><textarea @@readonly id="prop.pr.close.body" name="prop.pr.close.body" onchange="prop_email_changed=true" class="field text fn inputs" tabindex="20" placeholder="Your inquiry has been resolved">@@em_close_body</textarea></div>
		</div>
		<div>
			<label class="desc">Options</label>
			<div id='prop-edit-email-buttons-3'>
				<button onclick="upropmail(@@pid,&quot;close&quot;,3);">Save</button>
				<button onclick="if(propemailchange()==false){return;};dspArray('prop-edit-email-section-3','none')">Close</button>
			</div>
		</div>
	</div>
	
	<div>
		@@users_section
	</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
		
const _property_edit_users_section = (function () {/*
<label class='desc' style='padding-left:10px;'>Property Associates</label><div id='propuserswrap'>
	<table id='prop-assoc-list' class='footable' data-page-navigation='.pagination' data-page-size='10'><thead><tr><th>Name</th><th>Email</th></tr></thead>
	<tbody>
	@@user_rows
	</tbody>
	</table>
</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _property_edit_users_row = (function () {/*
<tr id='prop-assoc-tr-@@uid' 
		onmouseover='gebi("prop-assoc-del-@@uid").style.visibility = "";'
		onmouseout='gebi("prop-assoc-del-@@uid").style.visibility = "hidden";'
	><td nowrap>@@uname
	</td><td>@@email
	<i id='prop-assoc-del-@@uid' class='fa fa-times' style='visibility:hidden;color:red;float:right;cursor:pointer;'
		onclick='gebi("prop-assoc-del-confirm-@@uid").style.display = "";'
	></i>		
	</td></tr>
	<tr id='prop-assoc-del-confirm-@@uid' style='display:none;'><td colspan='99'>
		Remove @@uname from this property and this property's departments? 
		<button onclick='
		
			var a=_z("/removeassoc?a=@@uid&p=@@id");a.onreadystatechange=function(){if(a.readyState==4){
			gebi("prop-assoc-tr-@@uid").style.display="none";
			gebi("prop-assoc-del-confirm-@@uid").style.display="none";
			
			}};_h(a);
		
		
		'>Yes</button>
		<button onclick='gebi("prop-assoc-del-confirm-@@uid").style.display = "none";'>Cancel</button>
	</td></tr>	
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _property_edit_admin_buttons = (function () {/*  	
<button onclick='	
	var er = false;
	var prfn=gdv("prop.pr.pname"); if(prfn.length==0){er=true;gebi("prop.pr.pname").style.borderColor="red";}
	var shrt=gdv("prop.pr.shortname"); if(shrt.length==0){er=true;gebi("prop.pr.shortname").style.borderColor="red";}			
	var prem=gdv("prop.pr.email");
	var prph=gdv("prop.pr.phone");
	var prfx=gdv("prop.pr.fax");
	var prci=gdv("prop.pr.city");
	var prst=gdv("prop.pr.state");
	var przp=gdv("prop.pr.zip");
	var prcs=gdv("prop.pr.css");
	var hphd=gdv("prop.pr.hpheader");
	var hpp1=gdv("prop.pr.hppara1");
	var hpp2=gdv("prop.pr.hppara2");
	var hpp3=gdv("prop.pr.hppara3");
	
	
	if(er){
		alert("Some required data is missing.");
		$("html, body").scrollTop(0)
		return;
	}
	divtedit("/property-edit-accept?id="+@@id+"&pname="+encode(prfn)+"&shortname="+encode(shrt)+"&email="+prem+"&phone="+prph+"&fax="+prfx+"&city="+prci+"&state="+prst+"&zip="+przp+"&css="+prcs+"&hphd="+hphd+"&hpp1="+hpp1+"&hpp2="+hpp2+"&hpp3="+hpp3,"properties-table",@@id,"property-edit","prop-tr-@@id");cancelBubble(event);			
	'>
	Save</button>
<button onclick='cd("property-edit");dspArray("property-edit","none");dspArray("properties-table","");cancelBubble(event);'>Cancel</button>
		
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _inquiries_tr = (function () {/*
<tr id='inq-tr-@@id' style='cursor:pointer;' onclick='sdtn("inquiries-table");divup("/edit-inquiry?id=@@id&row=@@row","inquiry-edit");'>
	<td class='footable-first-column'>@@row</td>
	<td>@@name</td>
	@@propstds
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _common_add_ticket_form = (function () {/*  	
<form id='add-ticket-form' class='frm' action='javascript:void(0);'>		
	<div>
		@@content								
	</div>
</form>				
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _common_edit_ticket_form = (function () {/*  	
	<div class='frm' nothing>
		<div>
			<div>
			@@content	
			<div>
				@@buttons
			</div>
			</div>
		</div>
		<hr>		
		<div>
			<div>
				<label class="desc" for="ticket.tk.files" style="padding-top: 10px;">Uploaded Documents</label>			
				<div id='file-hist-@@id'>					
					@@file_hist
				</div>				
				
			</div>
		</div>
		<hr>
		<div>
			<div>
				<label class="desc" for="ticket.tk.history" style="padding-top: 10px;">Comment History</label>
				<div id='assoc-comments-@@id' class='assoc-comments'>@@history</div>
			</div>
		</div>
	</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _common_ticket_pending = (function () {/*  	
<div style='display:none;'>
	<label class='desc' for='ticket.tk.comment-@@status'>External Comments for Guest</label>
	 <div>
		<textarea id='ticket.tk.comment-@@status' name='ticket.tk.comment-$status' spellcheck='true' rows='5' cols='55' tabindex='14'></textarea>
	</div>
</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _common_ticket_assignbox = (function () {/*  	
<div class='update-ticket-less-@@status' style='display:;'>
	<label class='desc' for='ticket.tk.asgn-@@status'>Assign To</label>
	<div><select id='ticket.tk.asgn-@@status' tabindex='12'>
		@@asdat
	</select></div>			
</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _ticket_input_row = (function () {/*  	
<div>
	<label class="desc" for="ticket.tk.@@did-@@ps">@@label</label>
	<div><input @@blur id="ticket.tk.@@did-@@ps" @@atku name="ticket.tk.@@did-@@ps" @@pattern type="@@type" class="field text fn inputs" value="" tabindex="@@idx"></div>
</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _ticket_hack_row = (function () {/*  	
<div>
		<label class="desc" for="ticket.tk.@@did-@@ps">@@label</label>
		<div><input style="margin-top: 8px;" type="checkbox" id="ticket.tk.@@did-@@ps" name="ticket.tk.@@did-@@ps" onchange="
		if($(this).is(':checked')){
			document.getElementById('ticket.tk.@@nid-@@ps').style.borderColor='';
			document.getElementById('ticket.tk.@@nid-@@ps').value = '';
			document.getElementById('ticket.tk.@@nid-@@ps').placeholder = 'Unknown email';
			document.getElementById('ticket.tk.@@nid-@@ps').disabled = true;
		} else {
			document.getElementById('ticket.tk.@@nid-@@ps').placeholder = 'Enter a valid guest email only';
			document.getElementById('ticket.tk.@@nid-@@ps').disabled = false;
		}
		"/></div>
	</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _guest_input_row = (function () {/*  	
<div id='div-ticket-div-@@did-@@pid' @@style>
<label class="cls-ticket-label-@@did-@@pid" for="ticket.tk.@@did.@@pid">@@label</label>
<div>
	<input class="cls-ticket-input-@@did-@@pid" id="ticket.tk.@@did.@@pid" @@atku name="ticket.tk.@@did.@@pid" @@pattern type="@@type" value="" placeholder="@@placeholder" taborder="@@tab">
	<label class="cls-ticket-error-@@did-@@pid" id="ticket.tk.@@did.@@pid.er"></label>
</div>
</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _guest_display_row = (function () {/*  	
<label class="cls-display-label-@@did-@@pid" for="display.tk.@@did.@@pid">@@label</label>
<div><div class="cls-ticket-display-@@did-@@pid" id="display.tk.@@did.@@pid"></div></div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _common_add_ticket_content = (function () {/*  	
		<div>
			<div>
				<label class="desc" for="ticket.tk.itype-@@status">Initial Type</label>
				<div><select id="ticket.tk.itype-@@status"  tabindex='1'>
					<option value='0'>Select</option>
					<option value='1'>Bill Copy</option>
					<option value='2'>Billing Issue</option>
				</select></div>
			</div>
			<div>
				<label class="desc" for="ticket.tk.imeth-@@status">Input Method</label>
				<div><select id="ticket.tk.imeth-@@status"  tabindex='1' onchange='if(this.value>0){this.style.borderColor=&quot;&quot;};'>
					<option value='0'>Select</option>
					<option value='1'>Email</option>
					<option value='2'>Voicemail</option>
					<option value='3'>Call-in</option>
				</select></div>
			</div>	
			
				@@inputs
			
			<div>
				<label class="desc" for="ticket.tk.desc-@@status">Inquiry Description</label>
				<div>
					<textarea onkeyup="atku(this);" id='ticket.tk.desc-@@status' name='ticket.tk.desc-@@status' spellcheck='true' rows='5' cols='55' tabindex='10'></textarea>
				</div>
			</div>
			<div>
				<label class="desc" for="ticket.tk.cat-@@status">Inquiry Type</label>
				<div><select id="ticket.tk.cat-@@status"  tabindex='11'>
					@@cat
				</select></div>
			</div>
			<div>
				<label class="desc" for="ticket.tk.dept-@@status">Department</label>
				<div><select id="ticket.tk.dept-@@status" tabindex="12">
					@@dat
				</select></div>
				<div id='deptcnt-@@status' style='display:none;'>@@deptcnt</div>
				<div id='deptwarn-@@status'></div>
			</div>
			
				@@assignbox
			
				@@amountbox
				 
			<div>	
				<label class='desc' for=''>Processing Options</label>
				
				<div>					
				<button tabindex='16' onclick='event.preventDefault();ticketupdateX2("next",@@prop,@@status);'>Save + New</button>			
				<button tabindex='17' onclick='event.preventDefault();ticketupdateX2("return",@@prop,@@status);cancelBubble(event);'>Save </button>			
				<button tabindex='18' onclick='event.preventDefault();cd("ticket-form-@@status");dspArray("ticket-form-@@status","none");dspArray("tickets-table-@@status","");cancelBubble(event);'>Cancel</button>						
				</div>
			</div>
		</div>
		<hr>			
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];


const _ticket_file_row = (function () {/*  		
<tr id='fileinfo-@@id' style='cursor:pointer;' onclick='document.getElementById("filechoice-@@id").style.display="";' >
	<td>
		<div id='file_info-@@id'>@@original_name</div>
		<div style='display:none;' id='file-link-@@id'>@@tid;;@@original_name;;@@dateadd</div>
	</td>
	<td nowrap data-hide='phone,tablet'>@@dateadd</td>
	<td nowrap data-hide='phone,tablet'>@@username</td>
</tr>
<tr id='filechoice-@@id' style='display:none;'>
	<td colspan='3'  data-hide='phone,tablet'>
		<button onclick='popfile("@@server/download?id=@@file&amp;ft=@@ext");'>Download</button>
		<button onclick='rfile2(@@id,@@tid,@@pid);'>Remove File</button>
		<button onclick='document.getElementById("filechoice-@@id").style.display="none";'>Close</button>
		<div>* Links to this file in sent guest notifications will no longer work.</div>
	</td>
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _ticket_file_add = (function () {/*  	
<tr style='display;'>
	<td colspan='3'>
		<button class='ticket-add-file-@@status' onclick='
			$(".ticket-add-file-@@status").hide();
			$(".ticket-add-file-detail-@@status").fadeIn();
		'>Add Document
		</button>
	
		<div class='ticket-add-file-detail-@@status' style='display:none;'>
			<label class='desc' for='ticket.tk.fname'>Choose a File to Upload</label>
			<div>
				<div style='display:inline;'>
					<form id='upload_form' enctype='multipart/form-data' target='receiver' action='/upload' method='POST'>
						<input type='hidden' name='id' value='@@id'>
						<input type='hidden' name='pid' value='@@pid'>
						<input type='hidden' name='ticketno' value='@@ticketno'>
						<input type='hidden' name='status' value='@@status'>
						<input type='hidden' name='token' value='@@upload_token'>
						<input type='hidden' name='MAX_FILE_SIZE' value='100000' />
						<div style='display:inline;'>Step 1: <input style='display:inline; margin-top: 4px; margin-bottom: 4px;' name='uploadedfile' 
						type='file' value='Choose File (pdf,doc,rtf,xls)'
						accept='application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/rtf'/></div><br>
						<div style='display:inline;'>Step 2: <input style='display:inline;' type='submit' onclick='
							dspArray("receiver","");
							dspArray("file-refresh-@@id","");
							//dspArray("ticket-file-@@status-@@id","");
							' value='Upload File' /></div>						
					</form>						
					<div style='display:none;' id='file-refresh-@@id' >Step 3: <input style='display:inline; margin-top: 4px; margin-bottom: 4px;' onclick='frefresh2(@@id,@@pid); cancelBubble(event);' type='submit' value='Refresh Files'/></div>
				</div>
				
			</div>
		</div>
		<iframe name='receiver' id='receiver' style='display:none;height:60px;margin-bottom: 10px;border:1px solid #c0c0c0;width: 100%;'></iframe>
	</td>
</tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];		

const _common_edit_ticket_content = (function () {/*  	
		<div>
			<label class="desc" for="ticket.tk.ticketno">Ticket</label>
			<div><input readonly type="text" class="field text fn inputs ro" value="@@ticketno" tabindex="0"></div>
		</div>
		<div>
			<label class="desc" for="ticket.tk.tdate">Ticket Date</label>
			<div style='padding:6px;'>
				<time datetime="@@isodate" data-localtime-format></time>
				<time class="timeago2" datetime="@@isodate"></time>	
			</div>
		</div>
		<div>
			<label class="desc" for="ticket.tk.fname">Guest Name</label>
			<div><input readonly type="text" class="field text fn inputs ro" value="@@fname @@mi @@lname" tabindex="1"></div>
		</div>
		<div>
			<label class="desc" for="ticket.tk.cancellation">Confirmation #</label>
			<div><input readonly type="text" class="field text fn inputs ro" value="@@confirmation" tabindex="2"></div>
		</div>		
		<div>
			<label class="desc" for="ticket.tk.room-@@status">Room #</label>
			<div><input id="ticket.tk.room-@@status" name="ticket.tk.room-@@status" type="text" class="field text fn inputs" value="@@room_number" size="12" tabindex="3"></div>
		</div>
		<div>
			<label class="desc" for="ticket.tk.lastfour-@@status">CC Last 4</label>
			<div><input id="ticket.tk.lastfour-@@status" name="ticket.tk.lastfour-@@status" type="text" class="field text fn inputs" value="@@lastfour" size="12" tabindex="3"></div>
		</div>		
		<div>
			<label class="desc" for="ticket.tk.checkin-@@status">Check In</label>
			<div><input id="ticket.tk.checkin-@@status" name="ticket.tk.checkin-@@status" type="date" class="field text fn inputs" value="@@check_in" size="12" tabindex="4" pattern="/^[0,1]?\d{1}\/(([0-2]?\d{1})|([3][0,1]{1}))\/(([1]{1}[9]{1}[9]{1}\d{1})|([2-9]{1}\d{3}))$/"></div>
		</div>
		<div>
			<label class="desc" for="ticket.tk.checkout-@@status">Check Out</label>
			<div><input id="ticket.tk.checkout-@@status" name="ticket.tk.checkout-@@status" type="date" class="field text fn inputs" value="@@check_out" size="12" tabindex="5" pattern="/^[0,1]?\d{1}\/(([0-2]?\d{1})|([3][0,1]{1}))\/(([1]{1}[9]{1}[9]{1}\d{1})|([2-9]{1}\d{3}))$/" ></div>
		</div>
		<div>
			<label class="desc" for="ticket.tk.email-@@status">No Guest Email</label>
			<div><input @@noguestemail style="margin-top: 8px;" type="checkbox" id="ticket.tk.noemail-@@status" name="ticket.tk.noemail-@@status" onchange="
			if($(this).is(':checked')){
				document.getElementById('ticket.tk.email-@@status').value = '';
				document.getElementById('ticket.tk.email-@@status').placeholder = 'Unknown email';
				document.getElementById('ticket.tk.email-@@status').disabled = true;		
			} else {
				document.getElementById('ticket.tk.email-@@status').placeholder = 'Enter a valid guest email only';
				document.getElementById('ticket.tk.email-@@status').disabled = false;
				document.getElementById('ticket.tk.email-@@status').style.borderColor='';
			}
			"/></div>
		</div>
		<div class='update-ticket-less-@@status'>
			<label class="desc" for="ticket.tk.email-@@status">Email</label>
			<div><input id="ticket.tk.email-@@status" name="ticket.tk.email-@@status" type="text" class="field text fn inputs" value="@@email" size="12" tabindex="6"></div>
		</div>
		<div class='update-ticket-less-@@status'>
			<label class="desc" for="ticket.tk.phone-@@status">Phone</label>
			<div><input onblur="formatPhone(this);" id="ticket.tk.phone-@@status" name="ticket.tk.phone-@@status" type="text" class="field text fn inputs" value="@@phone" size="12" tabindex="7" pattern="\d{3}[\-]\d{3}[\-]\d{4}"></div>
		</div>
		<div>
			<label class="desc" for="ticket.tk.desc">Inquiry Description</label>
			<div>
				<div class='tkdesc' style="
    display:inline-block;
    border: solid 1px #C0C0C0;
    min-height:50px;
    margin-bottom: 6px;
	padding: 2px;
	
	">@@description</div>
		@@bubble
			</div>
		</div>
		<div class='update-ticket-less-@@status'>
			<label class="desc" for="ticket.tk.cat-@@status">Inquiry Type</label>
			<div><select id="ticket.tk.cat-@@status">
				@@cat_opts
			</select></div>
		</div>
		<div class='update-ticket-less-@@status'>
			<label class="desc" for="ticket.tk.dept-@@status">Department</label>
			<div><select id="ticket.tk.dept-@@status" onchange="deptsel(@@status);">
				@@dept_opts
			</select></div>
			<div id='deptcnt-@@status' style='display:none;'>@@deptcnt</div>
			<div id='deptwarn-@@status'></div>
		</div>
		
		@@assignbox		
		
		<div>
			<label class="desc" for="ticket.tk.amount-@@status">Refund Amount</label>
			<div><input onkeyup="crborder('@@status');" id="ticket.tk.amount-@@status" name="ticket.tk.amount" type="text" pattern="^\d+(?:,\d{3})*\.\d{2}$" class="field text fn inputs" value="@@amount" size="12" tabindex="8"></div>
		</div>
		<div class='update-ticket-less-@@status'>
			<label class="desc" for="ticket.tk.credit-@@status">Credit Limit</label>
			<div><input @@credit_border readonly id="ticket.tk.credit-@@status" name="ticket.tk.credit" type="text" class="field text fn inputs" value="@@credit" size="12" tabindex="9"></div>
		</div>		
		
		<div class='not used' style='display:none;'>
			<label class='desc' for='ticket.tk.comment-@@status'>External Comments for Guest</label>
			 <div>
				<textarea id='ticket.tk.comment-@@status' name='ticket.tk.comment-@@status' spellcheck='true' rows='5' cols='55' tabindex='4'>external_comment</textarea>
			</div>
		</div>
		
		<div id='ticket-wrap-internal' class='update-ticket-more-@@status' style='display:none;'>
			<label class="desc">Department Notification</label>
			<div><input type="checkbox" name="ticket-notify" id="ticket-notify" onclick="dlgfilecheck();ticketreqlabel()" style="display:inline;margin-top:10px;" class="text ui-widget-content ui-corner-all">
				<label for="ticket-notify"  style="display:inline;"> Notify <div style="display:inline;" id='notifydept'>@@deptname</div> by Email</label>			
			</div>
		</div>
		<div class='update-ticket-more-@@status' style='display:none;'>
			<label class="desc">Internal Comment<div style='display:none;' id='ticket-require-label'>(Required)</div></label>
			<div>
				<textarea  id='statdesc' class='' style="display:inline-block;border: solid 1px #C0C0C0;min-height:120px;width: 433px;margin-bottom: 6px;padding: 2px;"></textarea>
				<div id="notifydept-list" style="display:none;">@@deptlist</div>
			</div>
		</div>
		
		<div class='update-ticket-more-@@status' style='display:none;'>
			<label class="desc">Guest Comment</label>
			<div>
				<div id='ticket-wrap-customer'>
				<input type='checkbox' name='ticket-notifcust' id='ticket-notifcust' onclick='dlgfilecheck();' style='display:inline;margin-top:10px;' class='text ui-widget-content ui-corner-all'>
				<label for='ticket-notifcust'  style='display:inline;'> Include Comment for Guest</label><br>
				</div>
			
				<textarea  id='statcmmt' class='' style="display:inline-block;border: solid 1px #C0C0C0;min-height:120px;width: 433px;margin-bottom: 6px;padding: 2px;"></textarea>				
			</div>
		</div>
		
		<div class='update-ticket-more-@@status' style='display:none;'>
			<label class="desc">Actions</label>
			<div>
				<div id='ticket-wrap-files' style='display:;'>
				</div>
			
				<div id="ticket-wrap-pending">
				<input type="checkbox" onclick='chkone(this);' name="ticket-move-pending" id="ticket-move-pending" style="display:inline;margin-top:10px;" class="text ui-widget-content ui-corner-all">
				<label for="ticket-move-pending"  style="display:inline;" id="ticket-desc-pending" > Move to Pending</label>
				</div>

				<div id="ticket-wrap-awaiting">
				<input type="checkbox" onclick='chkone(this);' name="ticket-move-awaiting" id="ticket-move-awaiting" style="display:inline;margin-top:10px;" class="text ui-widget-content ui-corner-all">
				<label for="ticket-move-awaiting"  style="display:inline;" id="ticket-desc-awaiting" > Move to Awaiting Approval</label>
				</div>

				<div id="ticket-wrap-approved" @@approved_display>	
				<input type="checkbox" onclick='chkone(this);' name="ticket-move-approved" id="ticket-move-approved" style="display:inline;margin-top:10px;" class="text ui-widget-content ui-corner-all">
				<label for="ticket-move-approved"  style="display:inline;" id="ticket-desc-approved" > Close with Guest Notification Email</label>
				</div>
				
				<div id="ticket-wrap-approved2" @@approved2_display>	
				<input type="checkbox" onclick='chkone(this);' name="ticket-move-approved2" id="ticket-move-approved2" style="display:inline;margin-top:10px;" class="text ui-widget-content ui-corner-all">
				<label for="ticket-move-approved2" style="display:inline;" id="ticket-desc-approved2" > Close without Guest Notification Email</label>
				</div>
			</div>
		</div>
		
		<div class='update-ticket-more-@@status' style='display:none;'>
			<label class='desc' for=''>Update Status</label>
			
			<div id='update_buttons'>
				<button onclick='
					initstat2()
					'>Save Ticket</button>			
				<button onclick="
					$('.update-ticket-less-@@status').fadeIn();
					$('.update-ticket-more-@@status').hide();			
					$('.update-ticket-more-'+status).css('padding-top','0px');
					
				">Back </button>
			</div>
			<div id='update_conf_guest_email' style='display:none;max-width:434px; float: left;'>
				<span class="fa fa-warning" style='color: orange; padding: 4px 6px 4px 0px;font-size: 20px;float: left;'></span>
				<p style='padding-left: 9px;margin-top: 6px;'>This ticket has an external comment which will generate an email to the guest.  Are you sure you want to process this ticket and send an email?</p>
				<button onclick='
					dspArray("update_conf_working","");
					dspArray("update_conf_guest_email","none");
					update_ticket_dialog(stat_r+"&next="+stat_n+"&tostat="+stat_ts+"&prop="+_active_prop+"&statxt="+encode(stat_desc.val())+"&notify="+stat_ny+"&files="+stat_files+"&notifcust="+stat_ct+"&custxt="+encode(stat_cmmt.val())+"&silent="+stat_cl);
				'>OK</button>
				<button onclick='
					dspArray("update_buttons","");
					dspArray("update_conf_guest_email","none");							
				'>Cancel</button>				
			</div>			
			<div id='update_conf_working' style='display:none;float: left;'>
				<i class="fa fa-refresh fa-spin fa-3x fa-fw" style='padding: 4px;font-size: 20px;float: left;'></i>
				<p id='working-@@userid-edit-ticket' style='padding-left: 9px;margin-top: 6px;'> </p>
				
			</div>
		</div>
				
		
		<div class='update-ticket-less-@@status' >
			<label class='desc' for=''>Processing Options</label>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _ticket_edit_buttons = (function () {/*  	
<div id='actives' style='display:@@activedisplay;'>
			<button onclick='ticketupdate3(@@id,"next",@@prop,@@status);'>Update + Next Ticket No</button>			
			<button onclick='ticketupdate3(@@id,"return",@@prop,@@status);'>Update </button>			
		</div>
		<div id='inactive' style='display:@@inactivedisplay;'>
			This record is being edited by another associate
		</div>
		
		<button onclick='				
			var a=_z("\edit-ticket-cancel?id=@@id&prop=@@prop&status=@@status");a.onreadystatechange=function(){if(a.readyState==4){
			}};_h(a);
			clearTimeout(edtk_timeout);
			cd("ticket-form-@@status");dspArray("ticket-form-@@status","none");
			dspArray("tickets-table-@@status","");
			cancelBubble(event);
		'>Cancel</button>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _closed_tickets_row = (function () {/*  	
	<tr id='ticket-tr-closed-@@id' style='cursor:pointer;' onclick='
		sdtn("closed-tickets-table");
		edctk("/edit-closed-ticket?id=@@id&ps=10&prop=@@pid","closed-ticket-edit");
	'><td>@@pname</td><td>@@ticketno @@files_icon</td>
	<td><time datetime='@@isodate' data-localtime-format='M-d-yyyy'></time></td>
	<td>@@month_closed/@@day_closed/@@year_closed</td>
	<td>@@tfname @@tlname</td><td style='text-align: right;'>@@amount</td><td>@@afname @@alname</td></tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _tickets_none_date = (function () {/*  	
	<tr style='cursor:pointer;'><td colspan='99'>There are no tickets to show for the date range selected.  Clear or select a different date range. </td></tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _tickets_none_nodate = (function () {/*  	
	<tr style='cursor:pointer;'><td colspan='99'>There are no tickets to show.  If you think this is an error, please use the Support tab for help. </td></tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _closed_tickets_toomany = (function () {/*  	
	<tr style='cursor:pointer;'><td colspan='99'>The results contain @@count records, which may take some time to show.
	Try using a date range, or click <div style='text-decoration:underline;cursor:pointer; display:inline;' onclick='
		$(this).html = "OK, this may take a while.  Do not refresh the browser window or click in this window again until the report is done.  If you get tired of waiting, close the window and wait up to 15 minutes before trying again."
		var a=_z("@@toolink");a.onreadystatechange=function(){if(a.readyState==4){
		var d = "closed-tickets-table"
		//remainder duplicated from reports(d)		
		sdtn("worktabs"); sdtn("pages"); sdtn("admin");
		dspArray("reports","");
		var tr = a.responseText.split("&#58;&#58;&#58;&#58;"); //fail
		var footable = $("#"+d).data("footable");	
		//todo fix data binding
		$("#"+d).children()[1].innerHTML = ""
		for(var x=0;x<tr.length-1;x++){
			$("#"+d).append(tr[x]);
		}	
		if(tr.length > 1){
			gebi("reportTab-"+_report_tab).getElementsByClassName("footable")[0].getElementsByTagName("tfoot")[0].innerHTML = tr[tr.length-1]
			$("#"+d).trigger("footable_redraw"); //for pagination
		}
		$("#"+d).footable({ calculateWidthOverride: function() { return {width: $(window).width()}; }, breakpoints: { phone: 480, tablet: 900 } });				
		$.localtime.format();
		}};_h(a);
	'>here</div> to show a maximum of 2500 records while you wait.  </td></tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _ticket_closed_buttons = (function () {/*  	
		<button onclick='reopent("\closed-ticket-reopen?id=@@id",@@id);'>Reopen Ticket </button>
		<button onclick='													
			var a=_z("\closed-ticket-cancel?");a.onreadystatechange=function(){if(a.readyState==4){
			}};_h(a);
			clearTimeout(edtk_timeout);
					cd("closed-ticket-edit");
					dspArray("closed-ticket-edit","none")
					dspArray("closed-tickets-table","");
					cancelBubble(event);
					'>Cancel</button>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _ticket_history_item_guest = (function () {/*  	
	<time datetime='@@isodate' data-localtime-format></time> (@@stat_desc) by GUEST<br>
	<em>@@email_notes</em>
	<br><br>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _ticket_history_item_associate = (function () {/* 
	@@sdate (@@stat_desc) by @@uname<br>
	<em>@@email_notes</em>
	<br><br>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _guest_gen_css = (function () {/*  	
body {
			color: #8b8d8d;
			font: normal 16px/22px Arial,Helvetica,Sans-Serif;
			position: relative;
			margin-right: auto;
			margin-left: auto;
		}
		#Page {
			background: #fff;
			position: relative;
			display: block;
			overflow: hidden;
		}
		#guest-ticket {
			background: #fff; 
			height: 716px;
			padding-top: 2px;
			overflow: hidden;	
		}
		#guest-ticket-fields {
			margin-top: 50px;
		}
		#Content {
			background: #fff;
			margin-right: auto;
			margin-left: auto;
			padding-left: 44px;
			padding-right: 44px;
			padding-top: 40px;
			padding-bottom: 40px;
		}
		#PrimaryColumn {
			height: 100%;
		}
		.instructions {
			min-height: 1px;
			position: relative;
			padding-left: 10px;
			padding-right: 10px;
			margin-left: -10px;
		}
		a, a:visited {
			color: #6ba8c0;
			text-decoration: none;
		}
		a {
			background-color: transparent;
		}
		p {
			display: block;
			-webkit-margin-before: 1em;
			-webkit-margin-after: 1em;
			-webkit-margin-start: 0px;
			-webkit-margin-end: 0px;
		}
		.checkResForm form input[type="submit"], .checkResForm form button {
			margin: 0;
			width: 100%;
			min-height: 40px;
		}
		.checkResForm form input[type="text"] {
			width: 100%;
			font-size: 14px;
			height: 44px;
			border-color: #c5c6c6;
			color: #8b8d8d;
		}
		form input, form input[type="text"], #languagesList input, #languagesList input[type="text"], 
		.cls-ticket-select-itype-@@id-0 {
			color: #8b8d8d;
			padding: 10px 15px;
			border: 1px solid #c5c6c6;
		}
		.ctaButton {
			font-family: calibreSemiBold,Arial,Helvetica,Sans-Serif;
			font-size: 16px;
			min-width: 136px;
			min-height: 44px;
			padding: 10px 20px;
			border: none;
		}
		input {
			line-height: normal;
		}
		form input[type="submit"], form button, #languagesList input[type="submit"], #languagesList button {
			background: #a1c5d2;
			color: #0c161f;
			font-family: calibreSemiBold,Arial,Helvetica,Sans-Serif;
			font-size: 16px;
			font-weight: normal;
			min-height: 44px;
			margin: 10px 0;
			padding: 0 10px;
			text-align: center;
			text-transform: uppercase;
			border: none;
			display: block;
		}
		input[type="submit"], button {
			width: 100%;
			min-height: 40px;
			background: #a1c5d2;
			color: #0c161f;
			margin: 10px 0;
			padding: 0 10px;
			text-align: center;
			text-transform: uppercase;
			border: none;
			display: block;
			font: 16px calibreSemiBold, Arial, Helvetica, Sans-Serif;
			min-width: 136px;
		}
		button, html input[type="button"], input[type="reset"], input[type="submit"] {
			-webkit-appearance: button;
			cursor: pointer;	
		}
		button {
			overflow: visible;
		}
		button, input, optgroup, select, textarea {
			color: inherit;
			font: inherit;
			margin: 0;
		}

		.cls-ticket-label-itype-@@id-0, 
		.cls-ticket-label-fname-@@id-0 , .cls-ticket-label-mi-@@id-0, .cls-ticket-input-mi-@@id-0, .cls-ticket-label-lname-@@id-0,
		.cls-ticket-label-room-@@id-0,
		.cls-ticket-label-lastfour-@@id-0,
		.cls-ticket-label-email-@@id-0, .cls-ticket-label-email2-@@id-0,
		.cls-ticket-label-phone-@@id-0 {
			display:none;
		}

		.cls-ticket-input-fname-@@id-0 {
			position: relative;
			top: -44px;
			left: 158px;
		}
		
		@media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {
			.cls-ticket-input-fname-@@id-0 {
				top: -42px !important;
			}
		
			.cls-ticket-input-lname-@@id-0 {				
				top: -83px !important;
			}
			
			.cls-ticket-input-lastfour-@@id-0 {				
				top: -77px !important;
			}
			
			.cls-ticket-input-checkout-@@id-0 {
				top: -86px !important;
			}
			.cls-ticket-input-checkout-@@id-0 {
				top: -86px !important;
			}
			
			.cls-ticket-input-email2-@@id-0 {
				top: -100px !important;
			}
			
			.cls-ticket-input-spg-@@id-0 {
				top: -99px !important;
			}
			
			.cls-ticket-label-spg-@@id-0 {
				top: -100px !important;
			}
			
			.cls-ticket-input-amount-@@id-0 {
				top: -162px !important;
			}
			
			.cls-ticket-label-amount-@@id-0 {
				top: -164px !important;
			}
		}
		
		.cls-ticket-input-lname-@@id-0 {
			position: relative;
			top: -87px;
			left: 400px;
		}

		.cls-ticket-input-room-@@id-0 {
			position: relative;
			top: -55px;
			width: 244px;
		}
		
		.cls-ticket-input-lastfour-@@id-0 {
			position: relative;
			top: -63px;
			width: 244px;
			left: 283px;
			margin-bottom: -44px !important;
		}
		.cls-ticket-label-checkin-@@id-0 {
			position: relative;
			top: -25px;
		}
		.cls-ticket-input-checkin-@@id-0 {
			position: relative;
			top: -24px;
		}
		.cls-ticket-label-checkout-@@id-0 {
			position: relative;
			top: -93px;
			left: 211px;
		}
		.cls-ticket-input-checkout-@@id-0 {
			position: relative;
			top: -92px;
			left: 212px;
		}
		.cls-ticket-input-email-@@id-0 {
			position: relative;
			top: -59px;
			width: 340px;
		}
		.cls-ticket-input-email2-@@id-0 {
			position: relative;
			top: -103px;
			left: 355px;
			width: 340px;
		}
		.cls-ticket-input-phone-@@id-0 {
			position: relative;
			top: -68px;
			width: 293px;
		}
		.cls-ticket-label-create-@@id-0 {
			position: relative;
			top: 8px;
			left: 18px;
		}
		.cls-ticket-checkbox-create-@@id-0 {
			position: relative;
			top: -9px;
		}
		.cls-ticket-label-desc-@@id-0 {
			position: relative;
			top: -43px;
		}
		.cls-display-label-desc-@@id-0 {
			position: relative;
			top: -126px;
		}
		.cls-ticket-textarea-desc-@@id-0 {
			position: relative;
			top: -41px;
			width: 695px;
			height: 100px;
		}
		.cls-ticket-label-cancellation-@@id-0 {
			position: relative;
			top: -38px;
		}
		.cls-ticket-input-cancellation-@@id-0 {
			position: relative;
			top: -36px;
		}
		.cls-ticket-label-spg-@@id-0 {
			position: relative;
			top: -104px;
			left: 243px;
		}
		.cls-ticket-input-spg-@@id-0 {
			position: relative;
			top: -102px;
			left: 243px;
		}
		.cls-ticket-label-amount-@@id-0 {
			position: relative;
			top: -170px;
			left: 485px;
		}
		.cls-ticket-input-amount-@@id-0 {
			position: relative;
			top: -168px;
			left: 485px;
			width: 210px;
		}
		.cls-ticket-button-submit-@@id-0 {
			position: relative;
			width: 100px;
			top: -164px;
		}

		.cls-ticket-error-fname-@@id-0,
		.cls-ticket-error-lname-@@id-0,
		.cls-ticket-error-lastfour-@@id-0,
		.cls-ticket-error-cancellation-@@id-0,
		.cls-ticket-error-spg-@@id-0,
		.cls-ticket-error-amount-@@id-0 {
			display: none;
		}
		
		#div-ticket-div-lastfour-@@id-0 {
			margin-bottom: 0px;
			margin-top: -37px;
			height: 37px;
		}
		
		.cls-ticket-error-fname-@@id-0.show,		
		.cls-ticket-error-lname-@@id-0.show,
		.cls-ticket-error-room-@@id-0.show,
		.cls-ticket-error-lastfour-@@id-0.show,
		.cls-ticket-error-checkin-@@id-0.show,
		.cls-ticket-error-checkout-@@id-0.show,
		.cls-ticket-error-email-@@id-0.show,
		.cls-ticket-error-email2-@@id-0.show,
		.cls-ticket-error-phone-@@id-0.show,
		.cls-ticket-error-desc-@@id-0.show
		 {
			display: inline !important;
			margin-left: -58px;
			color: #a7042a;
			position: relative;
		}
		.cls-ticket-error-fname-@@id-0.show {
			top: -5px;
			left: -16px;
		}
		.cls-ticket-error-lname-@@id-0.show {
			top: -49px;
			left: 226px;
		}
		.cls-ticket-error-room-@@id-0.show {
			top: -15px;
			left: -191px;	
		}
		.cls-ticket-error-lastfour-@@id-0.show {
			top: -28px;
			left: 92px;	
		}
		
		.cls-ticket-error-checkin-@@id-0.show {
			left: -144px;
			top: 16px;
		}
		.cls-ticket-error-checkout-@@id-0.show {
			top: -52px;
			left: 68px;
		}
		.cls-ticket-error-email-@@id-0.show {
			top: -20px;
			left: -287px;
		}
		.cls-ticket-error-email2-@@id-0.show {
			top: -64px;
			left: 67px;
		}
		.cls-ticket-error-phone-@@id-0.show {
			top: -30px;
			left: -240px;
		}

		.cls-ticket-error-fname-@@id-0.show::after {
			content: "Please enter a valid first name"
		}
		.cls-ticket-error-lname-@@id-0.show::after {
			content: "Please enter a valid last name"
		}
		.cls-ticket-error-room-@@id-0.show::after {
			content: "Please enter your room number, or enter 'I dont know' if you dont remember it"
		}
		
		.cls-ticket-error-lastfour-@@id-0.show::after {
			content: "Please the last 4 digits of your CC"
		}
		
		.cls-ticket-error-checkin-@@id-0.show::after {
			content: "Dates are reqired"
		}
		.cls-ticket-error-checkout-@@id-0.show::after {
			content: "Dates are reqired"
		}
		.cls-ticket-error-email-@@id-0.show::after {
			content: "Please enter a valid email"
		}
		.cls-ticket-error-email2-@@id-0.show::after {
			content: "Please re-enter your email address"
		}
		.cls-ticket-error-phone-@@id-0.show::after {
			content: "Please enter your phone number"
		}


		.cls-ticket-select-itype-@@id-0.error ,
		.cls-ticket-input-fname-@@id-0.error ,
		.cls-ticket-input-lname-@@id-0.error,
		.cls-ticket-input-room-@@id-0.error,
		.cls-ticket-input-checkin-@@id-0.error,
		.cls-ticket-input-checkout-@@id-0.error,
		.cls-ticket-input-email-@@id-0.error,
		.cls-ticket-input-email2-@@id-0.error,
		.cls-ticket-input-phone-@@id-0.error,
		.cls-ticket-textarea-desc-@@id-0.error,
		.cls-ticket-input-phone-@@id-0.error,
		.cls-ticket-textarea-desc-@@id-0.error
			{
			color: #a7042a;
			background-color: #f6e5e9;
			border:1px solid #a7042a !important
			}
			
		.cls-display-label-name-@@id-0 {
			top: -20px;
			position: relative;
		}	
		.cls-ticket-display-name-@@id-0 {
			position: relative;
			top: -42px;
			left: 150px;
		}
		.cls-display-label-room-@@id-0 {
			position: relative;
			top: -40px;
		}
		.cls-ticket-display-room-@@id-0 {
			position: relative;
			top: -62px;
			left: 150px;
		}
		
		.cls-display-label-lastfour-@@id-0 {
			position: relative;
			top: -60px;
		}
		.cls-ticket-display-lastfour-@@id-0 {
			position: relative;
			top: -82px;
			left: 150px;
		}
		
		.cls-display-label-dates-@@id-0 {
			position: relative;
			top: -78px;
		}
		.cls-ticket-display-dates-@@id-0 {
			position: relative;
			top: -100px;
			left: 150px;
		}
		.cls-display-label-email-@@id-0 {
			position: relative;
			top: -66px;
		}
		.cls-ticket-display-email-@@id-0 {
		position: relative;
			top: -88px;
			left: 150px;
		}
		.cls-display-label-create-@@id-0 {
			position: relative;
			top: -100px;
		}
		.cls-ticket-display-create-@@id-0 {
			position: relative;
			top: -122px;
			left: 150px;
		}
		.cls-display-label-phone-@@id-0 {
			position: relative;
			top: -138px;
		}
		.cls-ticket-display-phone-@@id-0 {
		   position: relative;
			top: -160px;
			left: 150px;
		}

		.cls-ticket-display-itype-@@id-0 {
			position: relative;
			top: -22px;
			left: 150px;
		}
		.cls-ticket-checkbox-create-@@id-0 {
			position: relative;
			top: -9px;
			left: 0px;
		}
		.cls-display-textarea-desc-@@id-0 {
			width: 727px;
			height: 206px;
			top: -120px;
			position: relative;
		}
		.cls-display-label-cancellation-@@id-0 {
			position: fixed;
			top: 440px;
		}
		.cls-ticket-display-cancellation-@@id-0 {
			position: fixed;
			top: 440px;
			left: 150px;
		}
		.cls-display-label-spg-@@id-0 {
			position: fixed;
			top: 470px;
		}
		.cls-ticket-display-spg-@@id-0 {
			position: fixed;
			top: 470px;
			left: 150px;
		}
		.cls-display-label-amount-@@id-0 {
			position: fixed;
			top: 500px;
		}
		.cls-ticket-display-amount-@@id-0 {
			position: fixed;
			top: 500px;
			left: 150px;
		}
		.cls-guest-confirm-@@id-0 {
			position: fixed;
			top: 538px;
		}
		#guest-ticket-working-@@id-0 {
			position: fixed;
			margin-top: 102px;
		}

		#guest-ticket-buttons {
			position: fixed;
			top: 594px;
			width: 206px;
		}
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _guest_gen_page = (function () {/*  	
	<html>
		<head>
			<style>@@css</style>
		</head>
		<body style='height:1024px;'>
	<div id="Page">
		<div id="Content">
			<div id="PrimaryColumn">
					<iframe style='width:730px;height:823px' src="@@sport/guest-login?id=@@id" frameborder="0" allowfullscreen></iframe>				                       
                        
                    </div>
				</div>
			</div>
		</body>
	</html>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _guest_login_js = (function () {/*  	
	function atku(e){
			if(e.value.length>0){e.style.borderColor=""}
		}

		var submit_req = ""
		
		function encode(s){
			if(s.length == 0 || s == null){return ""}
			var c='';
			var o='';
			for(var i=0;i<s.length;i++){
				c = s.charCodeAt(i).toString(); 
				if(c.length>3){			
					if(c==8211 || c==8212){c = '045'}
					else if(c==8216 || c==8217){c = '039'}
					else if(c==8218 || c==8222){c = '044'}
					else if(c==8220 || c==8221){c = '034'}			
					else {c = (' ').charCodeAt(0).toString()} 
				}
				while ( c.length < 3) {c = '0' + c;}		
				o += c;
			};
			return o;
		}

			function sendrequest(){
				var ps = '@@ps';
				var er = false;
				var ex = ""
				var et = "ticket.tk.itype."+ps
				var tkit=parseInt(document.getElementById(et).value);
				if(tkit==0){er=true;addClass(et,"error")}else{removeClass(et,"error")}
				
				var et = "ticket.tk.fname."+ps; var eter = et+".er"			
				var tkfn=document.getElementById(et).value;
				if(tkfn.length==0){er=true;addClass(et,"error");addClass(eter,"show");}else{removeClass(et,"error");removeClass(eter,"show");}
				
				var tkmi='';
				
				var et = "ticket.tk.lname."+ps; var eter = et+".er"
				var tkln=document.getElementById(et).value;
				if(tkln.length==0){er=true;addClass(et,"error");addClass(eter,"show");}else{removeClass(et,"error");removeClass(eter,"show");}
				
				var et = "ticket.tk.room."+ps; 	
				var tkrn=document.getElementById(et).value;
				
				var et = "ticket.tk.checkin."+ps; var eter = et+".er"
				var tkci=document.getElementById(et).value;	
				if(tkci!=""){
					var d = new Date(tkci);	
					if(d.toString()==='Invalid Date' || d.getFullYear() < 2015 || isNaN(d.getFullYear())){
						er=true;addClass(et,"error");addClass(eter,"show");
						ex = ex + " Dates should be entered as mm/dd/yyyy."
					}else{
						removeClass(et,"error");removeClass(eter,"show");
					}
				}
				
							
				var et = "ticket.tk.checkout."+ps; var eter = et+".er"			
				var tkco=document.getElementById(et).value;
				if(tkco!=""){
					var d = new Date(tkco);	
					if(d.toString()==='Invalid Date' || d.getFullYear() < 2015 || isNaN(d.getFullYear())){
						er=true;addClass(et,"error");addClass(eter,"show");
						ex = ex + " Dates should be entered as mm/dd/yyyy."
					}else{
						removeClass(et,"error");removeClass(eter,"show");
					}
				}
				
				var em = "ticket.tk.email."+ps; var eter = em+".er"
				var tkem=document.getElementById(em).value;
				if(tkem.length==0){er=true;addClass(em,"error");addClass(eter,"show");}else{removeClass(em,"error");removeClass(eter,"show");}
				if(tkem.toLowerCase()=="na@na.com" || tkem.toLowerCase()=="no@notgiven.com"){er=true;addClass(em,"error");addClass(eter,"show");}else{removeClass(em,"error");removeClass(eter,"show");}
				
				var rm = "ticket.tk.email2."+ps; var eter = rm+".er"
				var tkrm=document.getElementById(rm).value;
				if(tkrm.length==0){er=true;
					addClass(rm,"error");addClass(eter,"show");
					ex = ex + " Please use a real email address name."
				}
				
				if(tkem!=tkrm){er=true;
					addClass(em,"error");
					addClass(rm,"error");
				}
				
				var et = "ticket.tk.phone."+ps; var eter = et+".er"
				var tkph=document.getElementById(et).value;
				if(tkph.length==0){er=true;addClass(et,"error");addClass(eter,"show");}else{removeClass(et,"error");removeClass(eter,"show");}
				
				var et = "ticket.tk.desc."+ps; var eter = et+".er"
				var tkds=document.getElementById(et).value
				tkds=tkds.replace(/(\d) (\d)/g, "");
				tkds=tkds.replace(/(\d)-(\d)/g, "");
				tkds=tkds.replace(/\d(?=\d{4})/g, "*");
				if(tkds.length==0){er=true;addClass(et,"error");addClass(eter,"show");}else{removeClass(et,"error");removeClass(eter,"show");}
				
				
				//var et = "ticket.tk.create."+ps
				var tkcr="false";
				
				var et = "ticket.tk.cancellation."+ps
				var tkca=document.getElementById(et).value;
				
				var et = "ticket.tk.spg."+ps
				var tksp=document.getElementById(et).value;
				
				var et = "ticket.tk.amount."+ps
				var tkam=document.getElementById(et).value;
				
				var cc = document.getElementById("ticket.tk.itype."+ps).value;
				var et = "ticket.tk.lastfour."+ps; var eter = et+".er"
				var tkcc=document.getElementById(et).value;
				if(cc==1){
					if(tkcc.length != 4){er=true;addClass(et,"error");addClass(eter,"show");}else{removeClass(et,"error");removeClass(eter,"show");}						
				}
				
				if(er==true){alert("Some of the form fields were not filled out completely.  The items outlined in red are required."+ex+" Please try again.");return;}
				submit_req = '/guest-request?ty='+tkit+'&ps='+ps+'&it='+tkit+'&fn='+encode(tkfn)+'&mi='+encode(tkmi)+'&ln='+encode(tkln)+'&rn='+encode(tkrn)+'&ci='+tkci+'&co='+tkco+'&em='+tkem+'&rm='+tkrm+'&cr='+tkcr+'&ph='+tkph+'&ds='+tkds+'&ca='+encode(tkca)+'&sp='+encode(tksp)+'&am='+tkam+'&cc='+encode(tkcc);
				
				document.getElementById("display.tk.itype."+ps).innerHTML = document.getElementById("ticket.tk.itype."+ps)[document.getElementById("ticket.tk.itype."+ps).value].text;
				document.getElementById("display.tk.name."+ps).innerHTML = document.getElementById("ticket.tk.fname."+ps).value + " " + document.getElementById("ticket.tk.lname."+ps).value;
				if(document.getElementById("ticket.tk.room."+ps).value==''){
					document.getElementById("display.tk.room."+ps).innerHTML = "Not Provided"
				}else{
					document.getElementById("display.tk.room."+ps).innerHTML = document.getElementById("ticket.tk.room."+ps).value;
				}
				
				if(document.getElementById("ticket.tk.lastfour."+ps).value==''){
					document.getElementById("display.tk.lastfour."+ps).innerHTML = "N/A"
				}else{
					document.getElementById("display.tk.lastfour."+ps).innerHTML = document.getElementById("ticket.tk.lastfour."+ps).value;
				}
				
				if(document.getElementById("ticket.tk.checkin."+ps).value=='' && document.getElementById("ticket.tk.checkout."+ps).value==''){
					document.getElementById("display.tk.dates."+ps).innerHTML = "Not Provided"
				}else{
					document.getElementById("display.tk.dates."+ps).innerHTML = document.getElementById("ticket.tk.checkin."+ps).value + " to " + document.getElementById("ticket.tk.checkout."+ps).value;
				}
				document.getElementById("display.tk.email."+ps).innerHTML = document.getElementById("ticket.tk.email."+ps).value;
				
				//if(document.getElementById("ticket.tk.create."+ps).checked){
				//	document.getElementById("display.tk.create."+ps).innerHTML = "Yes, an account will be created"
				//}else{
				//	document.getElementById("display.tk.create."+ps).innerHTML = "No, an account will not be created"
				//}
				
				document.getElementById("display.tk.phone."+ps).innerHTML = document.getElementById("ticket.tk.phone."+ps).value;
				document.getElementById("display.tk.desc."+ps).innerHTML = tkds
				document.getElementById("display.tk.cancellation."+ps).innerHTML = document.getElementById("ticket.tk.cancellation."+ps).value;
				document.getElementById("display.tk.spg."+ps).innerHTML = document.getElementById("ticket.tk.spg."+ps).value;
				document.getElementById("display.tk.amount."+ps).innerHTML = document.getElementById("ticket.tk.amount."+ps).value;
				
				document.getElementById("guest-ticket-fields").style.display = "none";
				document.getElementById("guest-ticket-display").style.display = "";
				document.getElementById("guest-instructions").style.display = "none";
			}
			
		
		function sendreqback(){
			document.getElementById("guest-ticket-fields").style.display = "";
			document.getElementById("guest-ticket-display").style.display = "none";
			document.getElementById("guest-instructions").style.display = "";
		}
		
		function sendrequest2(){
			document.getElementById("guest-ticket-buttons").style.display = "none";
			document.getElementById("guest-ticket-working-@@ps").style.display = "";
			var a=_z(submit_req);a.onreadystatechange=function(){if(a.readyState==4){
			var ra = a.responseText.split('::::')
			if(ra[0]=='success'){
				document.getElementById("guest-ticket-fields").innerHTML = ra[1];
				document.getElementById("guest-ticket-fields").style.display = "";
				document.getElementById("guest-ticket-display").style.display = "none";
				document.getElementById("guest-instructions").style.display = "none";
				window.scrollTo(0,0);
			} else {
				document.getElementById("guest-ticket-buttons").style.display = "";
				document.getElementById("guest-ticket-working-@@ps").style.display = "none";
				document.getElementById("guest-instructions").style.display = "";				
				alert(ra[1])
			}
		}};_h(a);}
		
		function _z(f){var a;f += '&rnd=' + Math.floor(Math.random()*99999);try{ a=new XMLHttpRequest();} catch (e1){try{ a=new ActiveXObject('Msxml2.XMLHTTP');} catch (e2) {try{ a=new ActiveXObject('Microsoft.XMLHTTP');} catch (e3){alert('ERR!');return false;} } } try{ a.open('GET',f);}catch (e4) {alert(e4);alert(f);return false;};return a;}
		function _h(a){a.setRequestHeader('Content-type','application/x-www-form-urlencoded');a.send();}
		function addClass(id,cls){
			var e=document.getElementById(id);
			if(e){var s=e.getAttribute('class'); 
				e.setAttribute('class',s+' '+cls);
				e.setAttribute('className',s+' '+cls);
			}
		}
		function removeClass(id,cls){
			var e=document.getElementById(id);
			var ea = e.getAttribute('class').split(' ');
			var nc = [];
			for(var x=0;x<ea.length;x++){
				if(ea[x]!=cls){nc.push(ea[x])}
			}
			if(e){ 
				var nct = nc.join(' ');
				e.setAttribute('class',nct);
				e.setAttribute('className',nct);
			}
		}
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _guest_login_page = (function () {/*  	
<html><head><title></title>
	<script>
	@@js
	</script>
	@@csslink
	</head><body>
	<div id="guest-instructions" class="instructions">
						<p>If you have an issue with your hotel stay, please submit a guest inquiry ticket by completing the form below.</p>						
					</div>
					
	<form id='guest-ticket' action='javascript:void(0);'>
		<div id='guest-ticket-fields'>			
			<label class="cls-ticket-label-itype-@@ps" for="ticket.tk.itype.@@ps">Request Type</label>
			<div><select class="cls-ticket-select-itype-@@ps" id="ticket.tk.itype.@@ps" taborder="1" onChange="
				if(this.value==1){
					document.getElementById('div-ticket-div-lastfour-@@ps').style.display = '';
				} else {
					document.getElementById('div-ticket-div-lastfour-@@ps').style.display = 'none'
				}
			">
				<option value='0'>Select</option>
				<option value='1'>Bill Copy</option>
				<option value='2'>Billing Issue</option>
			</select></div>
			
			@@inputs	
			<label class="cls-ticket-label-desc-@@ps" for="ticket.tk.desc.@@ps">Please write a message for the Hotel Staff</label>
			<div>
				<textarea class="cls-ticket-textarea-desc-@@ps" id='ticket.tk.desc.@@ps' name='ticket.tk.desc.@@ps' spellcheck='true' placeholder='Describe your inquiry here' taborder='13'></textarea>
				<label class="cls-ticket-error-desc-@@ps" id="ticket.tk.desc.@@ps.er"></label>
			</div>
			@@morebox
						
			<button class='cls-ticket-button-submit-@@ps' onclick='event.preventDefault();sendrequest();' taborder='14'>Submit </button>
		</div>
		<div id='guest-ticket-display' style='display:none;'>
			@@displays
			<label class="cls-display-label-desc-@@ps">Message for the Hotel Staff</label>
			<div>
				<textarea class="cls-display-textarea-desc-@@ps" id='display.tk.desc.@@ps'></textarea>
			</div>
			@@moredsp
			
			<div class='cls-guest-confirm-@@ps'>@@para2</div>
		
			<div id='guest-ticket-buttons'>
				<button class='cls-ticket-button-back-@@ps' onclick='event.preventDefault();sendreqback();'>Back </button>
				<button class='cls-ticket-button-submit2-@@ps' onclick='event.preventDefault();sendrequest2();'>Submit Inquiry Now</button>
			</div>
			<div id='guest-ticket-working-@@ps' style='display:none;' >
				<div class='cls-ticket-working2-@@ps'>Working, please wait...</div>
			</div>
		</div>
		
	</form>		
	</body>
	</html>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

	
const _user_prop_table = (function () {/*  	
	<div><label class='desc' for='assoc.ae.prop'>Properties for this User</label><div id='assoc.ae.prop.div' class=''><table class='notiftable'>
	@@rows
	</table></div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _user_prop_tr = (function () {/*  	
	<tr><td><input @@upchk @@readonly id='assoc.ae.prop.@@pid' name='assoc.ae.prop.@@pid' type='checkbox' value='@@pid' tabindex='@@ti2'></td>
		<td><label style='text-align:left;' class='desc' id='title4' for='assoc.ae.prop.@@pid'>@@pname</label></td></tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _user_prop_div_list = (function () {/*  	
	<div><div id='assoc.ae.uad' style='display:none;'>@@uadmin</div><div id='assoc.ae.prop.list' style='display:none;'>@@proplist</div></div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _admin_blog_tr = (function () {/*  		
	<tr id='adm-blg-@@id' style='cursor:pointer;' onclick='
		sdtn("admin-blog-table");divup("/edit-blog?id=@@id","blog-edit");'
	'><td>@@id</td><td>@@rdate</td><td>@@title</td><td>@@visible</td></tr>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
const _admin_blog_tdx = (function () {/*  		
	<td>@@id</td><td>@@rdate</td><td>@@title</td><td>@@visible</td>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _add_blog_button = (function () {/*  			
	<button class='addbutton' onclick='sdtn("admin-blog-table");divup("/add-blog?","blog-add");' style='cursor:pointer;'>Add Blog Entry</button>
*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
							
const _add_blog_buttons = (function () {/*  		
	<button tabindex='5' onclick='
		dspArray("blog-add","none");
		dspArray("blog-add-edit-working","");
		var dt = gdv("blog.bg.date-0")
		var rd = gdv("blog.bg.rdate-0")
		var tl = gdv("blog.bg.title-0")
		var it = gdv("blog.bg.intro-0")
		var ft = gdv("blog.bg.desc-0")
		
		
		if(tl.length==0 || it.length==0){
			alert("Please enter at least a title and draft intro paragraph"); 
			dspArray("blog-add","");
			dspArray("blog-add-edit-working","none");
			return;
		}
		
		var a=_z("/add-blog-accept?dt="+dt+"&tl="+tl+"&it="+it+"&ft="+ft+"&rd="+rd);a.onreadystatechange=function(){if(a.readyState==4){
		
			var tr = a.responseText.split("::::");	
			if(tr[0]==="alert"){
				alert(tr[1]);
				dspArray("blog-add-edit-working","none");
				dspArray("blog-add","");
				return;
			} else {
				if(tr[0]==="tr"){
					
					dspArray("admin-blog-table","");cd("blog-add");dspArray("blog-add","none");
					var footable = $("#admin-blog-table");			
					try {
						footable.data("footable").appendRow(tr[2]);	
					} catch(err) {
						
					}
					//find out where the row ended up based on sort
					dspArray("adm-blg-no","none")
					var rows = $("#admin-blog-table tbody tr")
					var row = rows.length - 1		
					for(var r=0;r<rows.length;r++){			
						if(rows[r].id==tr[1]){
							row = r;
						}
					}		
					var p = parseInt(row / 10)
					dspArray("blog-add-edit-working","none");
					footable.data("currentPage",p);
					try {
						footable.resize();
					} catch(err) {
					
					}
				}
			}
		}};_h(a);
				
			cancelBubble(event);
		'>Add Blog</button>
		<button tabindex='6' onclick='
			sdtn("blog-add")
			sdtn("blog-edit")
			document.getElementById("admin-blog-table").style.display="";
		'>Cancel</button>	
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _save_blog_buttons = (function () {/*  		
	<button tabindex='5' onclick='
		dspArray("blog-add","none");
		dspArray("blog-add-edit-working","");
		var dt = gdv("blog.bg.date-@@id")
		var rd = gdv("blog.bg.rdate-@@id")
		var tl = gdv("blog.bg.title-@@id")
		var it = gdv("blog.bg.intro-@@id")
		var ft = gdv("blog.bg.desc-@@id")
		var vs = gdv("blog.bg.visible-@@id")
		
		if(tl.length==0 || it.length==0){
			alert("Please enter at least a title and draft intro paragraph"); 
			dspArray("blog-add","");
			dspArray("blog-add-edit-working","none");
			return;
		}
		
		var a=_z("/save-blog-accept?id=@@id&dt="+dt+"&tl="+tl+"&it="+it+"&ft="+ft+"&vs="+vs+"&rd="+rd);a.onreadystatechange=function(){if(a.readyState==4){
		
			var tr = a.responseText.split("::::");	
			if(tr[0]==="alert"){
				alert(tr[1]);
				dspArray("blog-add-edit-working","none");
				dspArray("blog-add","");
				return;
			} else {
				if(tr[0]==="tr"){
					console.log(tr[2])
					dspArray("admin-blog-table","");cd("blog-add");dspArray("blog-add","none");
					var footable = $("#admin-blog-table");			
					$("#adm-blg-"+@@id).html(tr[2])
					dspArray("adm-blg-no","none")
					dspArray("blog-add-edit-working","none");
					try {
						footable.resize();
					} catch(err) {
					
					}
				}
			}
			sdtn("blog-add")
			sdtn("blog-edit")
			document.getElementById("admin-blog-table").style.display="";
			alert("Blogs are cached.  Refresh the page to see the new blogs")
		}};_h(a);
			
			cancelBubble(event);
		'>Save Blog</button>
		<button tabindex='6' onclick='
			sdtn("blog-add")
			sdtn("blog-edit")
			document.getElementById("admin-blog-table").style.display="";
		'>Cancel</button>	
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _add_user_buttons = (function () {/*  		
	<button tabindex='@@ti2' onclick='
		
		rC("assoc.ae.fname","flderror");
		rC("assoc.ae.lname","flderror");
		rC("assoc.ae.email","flderror");
		rC("assoc.ae.prop.div","flderror")
		
		var er = false;
		var aefn=gdv("assoc.ae.fname");		if(aefn.length==0){er=true;aC("assoc.ae.fname","flderror")}
		var aemi=gdv("assoc.ae.mi");
		var aegc=parseInt(gdv("assoc.ae.gcount"));
		var aeln=gdv("assoc.ae.lname");		if(aeln.length==0 && aegc==0){er=true;aC("assoc.ae.lname","flderror")}
		var aeem=gdv("assoc.ae.email");		if(aeem.length==0 || validateEmail(aeem)==false){er=true;aC("assoc.ae.email","flderror")}
		var aeph=gdv("assoc.ae.phone");     if(aeph.length>0 && aeph.length != 16){er=true;aC("assoc.ae.phone","flderror")}
		var aepo=gdv("assoc.ae.position");
		
		
		var aeau = gdi("authkeys").split(",");
		for(var x=aeau.length-1;x>=0;x--){if(!gebi("assoc.ae.auth."+aeau[x]).checked){aeau.splice(x, 1);}}			
		var aeno = gdi("notifkeys").split(",");
		for(var x=aeno.length-1;x>=0;x--){if(!gebi("assoc.ae.notif."+aeno[x]).checked){aeno.splice(x, 1);}}			
		var aecr=gdv("assoc.ae.limit");
		var aeua = parseInt(gdi("assoc.ae.uad"));
		
		var aegs = gebi("assoc.ae.gssign").checked
		var aeas = ""; //not used
								
		var aeua_cnt = 0;
		var aeua_sel = [];
		if(aeua==1){
			var aeua_lst = gdi("assoc.ae.prop.list").split(";")
			for(var x=0;x<aeua_lst.length;x++){
				if(gebi("assoc.ae.prop."+aeua_lst[x]).checked){
					aeua_cnt+=1;
					aeua_sel.push(aeua_lst[x]);
				}
			}
			if(aeua_cnt==0){er=true;aC("assoc.ae.prop.div","flderror")}
		}
		if(er){
			alert("Some required data is missing, or the data is not valid.");
			$("html, body").scrollTop(0)
			return;
		}
		
		divtpost(
			"/@@ident-add-accept?fname="+aefn+"&mi="+aemi+"&lname="+aeln+"&email="+aeem+"&phone="+aeph+"&position="+aepo+"&auth="+aeau+"&notif="+aeno+"&limit="+aecr+"&props="+aeua_sel+"&group="+aegc+"&assign="+aeas+"&gssign="+aegs,
			"@@idents-table",
			"@@ident-add",
			"",
			"@@ident-add-edit-working",
			""
		);cancelBubble(event);			
		'>Add</button>
		<button tabindex='@@ti2' onclick='cd("@@ident-add");dspArray("@@ident-add","none");dspArray("@@idents-table","");'>Cancel</button>	
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
	
const _edit_user_buttons = (function () {/*  	
	<div id='resetcpwwrapper' style='display:none;'>
		Reset the password for this Associate?  An email will be sent to the above email address with reset instructions.
		<button id='pwcrspok' onclick='
			var a=_z("/password-reset?a=@@id");a.onreadystatechange=function(){if(a.readyState==4){
			cd("associate-edit");dspArray("associate-edit","none");dspArray("associates-table","");}};_h(a);
			'>Reset</button>
		<button id='pwcrspcancel' onclick='dspArray("editassocwrapper","");dspArray("resetcpwwrapper","none");'>Cancel</button>					
	</div>
	<div id='delassocwrapper' style='display:none;'>
		@@delete_associate_message
		<button id='pwcdelok' onclick='var a=_z("/associate-delete?a=@@id");a.onreadystatechange=function(){if(a.readyState==4){
			//console.log(a.responseText);
			if(a.responseText.length>0){
				alert(a.responseText)
			} else {
				cd("associate-edit");dspArray("associate-edit","none");dspArray("associates-table","");dspArray("assoc-tr-@@id","none");
			}
			}};_h(a);'>Delete</button>
		<button id='pwcdelcancel' onclick='dspArray("editassocwrapper","");dspArray("delassocwrapper","none");'>Cancel</button>					
	</div>
	<div id='editassocwrapper'>
		<button id='pwcbutton' onclick='dspArray("editassocwrapper","none");dspArray("resetcpwwrapper","");'>Reset Password</button>
		@@delete_associate_button
		<button onclick='edassoc(@@id);'>Save</button>
		<button onclick='cd("associate-edit");dspArray("associate-edit","none");dspArray("associates-table","");cancelBubble(event);'>Cancel</button>
	</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _delete_associate_button = (function () {/*  	
<button id='pwcdelbtn' onclick='dspArray("editassocwrapper","none");dspArray("delassocwrapper","");'>Delete Associate</button>		
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _edit_group_buttons = (function () {/*  	
	<div id='resetgpwwrapper' style='display:none;'>
		Reset the password for this Group Login?  An email will be sent to the above email address with reset instructions.
		<button id='pwgrspok' onclick='
			var a=_z("/password-reset?a=@@id");a.onreadystatechange=function(){if(a.readyState==4){
			cd("group-edit");dspArray("group-edit","none");dspArray("groups-table","");}};_h(a);
			'>Reset</button>
		<button id='pwgrspcancel' onclick='dspArray("editgroupwrapper","");dspArray("resetgpwwrapper","none");'>Cancel</button>					
	</div>
	<div id='delgroupwrapper' style='display:none;'>
		Delete this group?  Tickets in process by any users of this group may be orphaned.
		<button id='pwgdelok' onclick='
		var a=_z("/group-delete?a=@@id");
		a.onreadystatechange=function(){if(a.readyState==4){
		cd("group-edit");
		dspArray("groups-table","");
		dspArray("grp-tr-@@id","none");
		}};_h(a);'>Delete</button>
		<button id='pwgdelcancel' onclick='dspArray("editgroupwrapper","");dspArray("delgroupwrapper","none");'>Cancel</button>					
	</div>
	<div id='editgroupwrapper'>
		<button id='pwgbutton' onclick='dspArray("editgroupwrapper","none");dspArray("resetgpwwrapper","");'>Reset Password</button>
		<button id='pwgdelbtn' onclick='dspArray("editgroupwrapper","none");dspArray("delgroupwrapper","");'>Delete Group</button>
		<button onclick='edgrp(@@id);'>Save</button>
		<button onclick='cd("group-edit");dspArray("group-edit","none");dspArray("groups-table","");cancelBubble(event);'>Cancel</button>
	</div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _bubble = (function () {/*  	
<span class='fa fa-comment' style='color: red;font-size:15px;vertical-align:top;' title='This ticket has a recent guest comment'></span>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _bubblex = (function () {/*  	
<span class='mobmore'>This ticket has a recent guest comment</span>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _nothing = (function () {/*  	

	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _sql_guest_ticket_create_message = (function () {/*  	
	SELECT em_create_from, em_create_subject, em_create_body FROM homepage WHERE pid = @@pid LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function middleHandler_guest_ticket_create_msgprep(req, res, next) {
	if(_debug){
		console.log("  middleHandler_guest_ticket_create_msgprep "+req.shared_request_prop)
		console.log(req.errors)
		};
	req.em_subject = "Guest Inquiry Confirmation"
	req.em_body = "We have received your guest inquiry."
	if(req.shared_request_prop > 0 && req.errors.length == 0) {
		var sql = _sql_guest_ticket_create_message.replace('@@pid', req.shared_request_prop)
		console.log(sql)
		db.each(sql, function(err, row) {
			if(row.em_create_subject != ""){req.em_subject = row.em_create_subject};
			if(row.em_create_body != ""){req.em_body = row.em_create_body};
		}, function () {
			next();
		});
	} else {
		next()
	}	
}
	
	
	

const _sql_guest_email_prep_approved = (function () {/*  	
	SELECT em_close_from as frm, em_close_subject as subject, em_close_body as body FROM homepage WHERE pid = @@pid
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _sql_guest_email_prep_message = (function () {/*  	
	SELECT em_process_from as frm, em_process_subject as subject, em_process_body as body FROM homepage WHERE pid =  @@pid
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function middleHandler_ticket_edit_guest_email_db_defaults(req, res, next) {
	//console.log("  middleHandler_ticket_edit_guest_email_db_defaults "+req.propid);	
	//requires the following being set first for each case
	//req.sendmail_send = true;
	//req.em_from = ''
	//req.em_subject = ''
	//req.em_body = ''
	if(req.propid > 0 && req.sendmail_send == true) {
		if(req.ticket_update_status == STATUS_APPROVED) {
			var sql = _sql_guest_email_prep_approved.replace('@@pid', req.propid)
		} else {
			var sql = _sql_guest_email_prep_message.replace('@@pid', req.propid)
		}
		db.each(_sql_users_for_dev_login, function(err, row) {
			if(row.frm != '') 		{req.em_from = row.frm}
			if(row.subject != '') 	{req.em_subject = row.subject}
			if(row.body != '') 		{req.em_body = emailprep(row.body)}
		}, function () {
			next();
		});
	} else {
		next()
	}	
}
			
const _sql_users_for_dev_login = (function () {/*  	
	SELECT users.autoID as uid, fname, lname, users.email as uemail, users.admin as admin, users.superadmin as superadmin, properties.pname as pname 
	FROM users 
	INNER JOIN user_properties ON users.autoID = user_properties.userID 
	INNER JOIN properties ON user_properties.propertyID = properties.autoID
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function middleHandler_db_user_emails_for_dev_login(req, res, next) {
	if(_skiplogin==0){
		next();
	}else{
		//console.log("  middleHandler_db_user_emails_for_dev_login.  Gets a list of emails for developer only login");	
		req.dev_user_emails = []; req.dev_user_selected_index = -1;
		//console.log(_sql_users_for_dev_login);
		db.each(_sql_users_for_dev_login, function(err, row) {
			var val = {id: row.uid, email: row.uemail, label: "( " + row.fname + " " + row.lname + ") " + row.pname, admin: row.admin, superadmin: row.superadmin} 
			req.dev_user_emails.push(val)		
		}, function () {
			next();
		});
	}
}

const _sql_db_cookie_test = (function () {/*  
	SELECT users.autoID as userid, phone, fname, lname, email, admin, superadmin,
	(select cnt FROM testers WHERE userid = users.autoID) as script_cnt, 	
	(select ukey FROM testers WHERE userid = users.autoID) as ukey 	
	FROM users
	INNER JOIN cookies ON cookies.uid = users.autoID 
	WHERE users.email = '@@email' AND cookie = '@@cookie_guid'
	LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_cookie_check(req, res, next) {
	//todo multiple hits here
	if(_debug){console.log("  middleHandler_cookie_check "+req.propid); console.log(new Date().getTime());}
	req.userid = 0
	req.user_email = '';
	req.user_phone = '';
	req.user_name = '';
	req.user_nick = '';
	req.user_admin = 0;
	req.user_superadmin = 0;
	req.user_register = 0;
	req.user_resetpw = 0;
	req.user_regkey = ''
	try {
		var ck = req.headers.cookie.split(";");
		req.incoming_email = ""; req.incoming_guid = ""; req.incoming_propid = 0;
		req.incoming_report_date_from = ""
		req.incoming_report_date_to = ""
		req.incoming_test_cnt = 0
		req.incoming_test_key = ""
		for(var x=0;x<ck.length;x++){
			var sp = ck[x].split("=")
			if(sp[0].trim()==='rbpx-g'){req.incoming_guid = sp[1]}
			if(sp[0].trim()==='rbpx-u'){req.incoming_email = fixemail(sp[1])}
			if(sp[0].trim()==='rbpx-r'){req.incoming_propid = sp[1]}		
			if(sp[0].trim()==='rbpx-f'){req.incoming_report_date_from = sp[1]}		
			if(sp[0].trim()==='rbpx-t'){req.incoming_report_date_to = sp[1]}
			if(sp[0].trim()==='rbpx-s'){req.incoming_test_key = sp[1]}
			if(sp[0].trim()==='rbpx-x'){
				if(sp[1].length>1){
					req.user_register = 1; req.user_regkey = sp[1]
				}
			}
			if(sp[0].trim()==='rbpx-z'){
				if(sp[1].length>1){
					req.user_resetpw = 1; req.user_regkey = sp[1]
				}
			}
		}
		if(_debug){
			console.log('    incoming cookies '+req.incoming_guid+', '+req.incoming_email+', '+req.incoming_propid);
		}
		if(req.incoming_email.length>3 && req.incoming_guid != ""){		
			var sql = _sql_db_cookie_test.replace('@@email', req.incoming_email);
			sql = sql.replace('@@cookie_guid', req.incoming_guid);
			db.each(sql, function(err, row) {				
					req.userid = row.userid
					req.user_email = row.email;
					req.user_phone = row.phone;
					req.user_name = row.fname + ' ' + row.lname;
					req.user_nick = '';
					req.user_admin = row.admin;
					req.user_superadmin = row.superadmin;
					if(req.incoming_test_key != ""){
						if(req.incoming_test_key == row.ukey){
							req.incoming_test_cnt = row.script_cnt
						}
					}
				}, function () {
					//console.log(' user identified ' + req.user_email);
					next();
			});	
		} else { next();}
	}
		catch(err) {
		next();
	}	
		
}

const _sql_db_blog = (function () {/*  
	SELECT * FROM blog WHERE visible = 1 ORDER BY realdate DESC
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function mh_blogs(req, res, next) {
	if(false){console.log("  mh_blogs ")}
	req.blog = []
	var sql = _sql_db_blog
	if(false){console.log(sql)}
	db.each(sql, function(err, row) {				
		req.blog.push(row)
	}, function () {
		next();
	});		
}

const _sql_admin_db_blogs = (function () {/*  
	SELECT * FROM blog ORDER BY realdate DESC
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function mh_admin_blogs(req, res, next) {
	if(false){console.log("  mh_admin_blogs ")}
	req.admin_blogs = []
	if(req.query.a==6){	
		
		var sql = _sql_admin_db_blogs
		if(false){console.log(sql)}
		db.each(sql, function(err, row) {				
			req.admin_blogs.push(row)
		}, function () {
			next();
		});
	} else {
		next();
	}
}

const _sql_admin_db_blog = (function () {/*  
	SELECT * FROM blog WHERE autoID = @@id
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function mh_admin_blog(req, res, next) {
	if(_debug){console.log("  mh_admin_blog ")}
	req.admin_blog = []
		var sql = _sql_admin_db_blog.replace('@@id', req.query.id)
		if(false){console.log(sql)}
		db.each(sql, function(err, row) {				
			req.admin_blog.push(row)
		}, function () {
			next();
		});
	
}

function homepage(req,res){
	if(_debug){
		console.log('homepage')
		console.log(req.user_register);
		console.log(req.user_resetpw);
		console.log(req.user_regkey)
		console.log(req.query);
	}
	var home = _home;
	
	if(env.env == "live"){
		home = home.replace('@@demolabel','')
	} else {
		home = home.replace('@@demolabel',"<div style='display:inline; color: white; font-size: 20pt; font-weight: bold;'>"+env.env+"</div>")
	}
	
	var show_loginfrm = "display:none;"
	var show_registerfrm = "display:none;"
	var show_resetfrm = "display:none;"
	
	if(req.user_register == 1){
		show_registerfrm = ""
	} else if(req.user_resetpw == 1){
		show_resetfrm = ""
	} else {
		show_loginfrm = ""
	}
	home = replace_all_array(home, {
		show_loginfrm: show_loginfrm,
		show_registerfrm: show_registerfrm,
		show_resetfrm: show_resetfrm
	})
	
	home = replace_all(home, '@@footable_attributes', _footable_attributes);
	home = replace_all(home, '@@rptFrom', req.incoming_report_date_from);
	home = replace_all(home, '@@rptTo', req.incoming_report_date_to);
	
	var blogs = ''
	var blog_bits = ''
	var blog_archive = ''
	if(req.blog){
		if(false){console.log(req.blog)}
		for(var x=0;x<req.blog.length;x++){
			var blg = {
				autoID: req.blog[x]['autoID'],
				title: undo_clean_for_basic_html(req.blog[x]['title']),
				date: undo_clean_for_basic_html(req.blog[x]['date']),
				intropara: undo_clean_for_basic_html(req.blog[x]['intropara']),
				fulltext: undo_clean_for_basic_html(req.blog[x]['fulltext']),
				filepath: req.blog[x]['filepath']
			}			
			blogs+=replace_all_array(_blog_summary, blg)			
			if(x==0){blogs = blogs.replace('@@blogshow', '')}else{blogs = blogs.replace('@@blogshow', "style='display:none;'")}
			if(x<5){
				blog_bits+=replace_all_array(_blog_bit, blg)
			}
			blog_archive+=replace_all_array(_blog_archive, blg)
		}
	}
	home = home.replace('@@blogs', blogs)
	home = home.replace('@@blogrecent', blog_bits)
	home = home.replace('@@blogarchive', blog_archive)
	
	
	
	/*isodate: function(){
				var dt = new Date(row.tdate);
				return dt.toISOString()},
		*/	
	
	var loginbox = ''; var passwordbox = ''
	switch(_skiplogin) {
		case 0:
			loginbox = "<input placeholder='Your Email' style='width:93%;float:none;margin-left:10px;' class='field text fn inputs' onmousedown='[format %c 36](&quot;#email&quot;).css(&quot;borderColor&quot;, &quot;#c0c0c0&quot;)' type='text' id='email' name='email' style='max-width:250px;'>"
			passwordbox = "<input placeholder='Password' style='width:93%;float:none;margin-left:10px;' class='field text fn inputs' type='password' id='password' name='password'  style='max-width:250px;'>"
			break;
		case 1:
			loginbox = "<select style='width:93%;float:none;margin-left:10px;' id='email' name='email'>"
			for(var x=0;x<req.dev_user_emails.length;x++){
				loginbox += "<option value='"+req.dev_user_emails[x]['email']+"'>"+req.dev_user_emails[x]['email']+" "+req.dev_user_emails[x]['label']+"</option>"				
			}
			loginbox += "</select>"
			passwordbox = "<input style='width:93%;float:none;margin-left:10px;' class='field text fn inputs' type='password' id='password' name='password' value='nothing'>"
			break;
			
	}
	
	//necessary to handle refresh correctly
		if(req.user_superadmin==1){
			var add_property_option = _super_add_property_button;
			var add_inquiries_option = _super_add_inquiries_button
		} else {
			var add_property_option = _admin_add_property_button;
			var add_inquiries_option = _admin_add_inquiries_button
		}
		
		home = home.replace('@@add_property_option', add_property_option);
		home = home.replace('@@add_departments_option', _add_departments_button);
		home = home.replace('@@add_inquiries_option', add_inquiries_option);
	
	//var common_stat_frm = _common_stat_frm;
	//common_stat_frm = common_stat_frm.replace('@@deptlist', '');  //todo
		
	home = home.replace('<<bigheader>>',			_bigheader);
	home = home.replace('@@proptabs',				_one_tabs);
	home = home.replace('@@loginbox',				loginbox);
	home = home.replace('@@passwordbox',			passwordbox);
	//home = home.replace('@@common_stat_frm',		common_stat_frm);
		
	//res.writeHead(200, {"Content-Type": "text/html"});
	
	for(var x=0;x<req.ticket_cancel_emit_list.length;x++){
		//console.log('ticket-edit-cancel-'+req.ticket_cancel_emit_list[x]['pid'])
		io.emit('ticket-edit-cancel-'+req.ticket_cancel_emit_list[x]['pid'], {
			id: req.ticket_cancel_emit_list[x]['id'], 
			uid: req.userid, 
			status: req.ticket_cancel_emit_list[x]['status']
		})
	}
	return home
}

restapi.get('/', 
	mh_blogs,
	middleHandler_cookie_check,
	middleHandler_db_user_emails_for_dev_login, 
	middleHandler_db_edit_ticket_unlock_emit,
	middleHandler_db_edit_ticket_cancel,
	
	function(req,res){	
	//console.log('/');
	var home = homepage(req,res)
	
	res.write(home)
	res.end();
	
});



const _sql_user_login_with_properties = (function () {/*  
	SELECT propertyID as propid, pname, users.autoID as userid, users.email as email, users.phone as phone, users.admin as admin, users.superadmin as superadmin
        FROM user_properties
        INNER JOIN properties ON user_properties.propertyID = properties.autoID
        LEFT OUTER JOIN users ON user_properties.userID = users.autoID
        WHERE user_properties.userID = @@userid
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _sql_regular_login_with_properties = (function () {/*  
	SELECT users.autoID as userid, users.email as email, users.phone as phone, users.admin as admin, users.superadmin as superadmin, user_properties.propertyID as propid, properties.pname as pname
    FROM users
    LEFT OUTER JOIN user_properties ON users.autoID = user_properties.userID
	LEFT OUTER JOIN properties ON user_properties.propertyID = properties.autoID
	WHERE users.email = '@@email' AND users.password = '@@password'
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _sql_super_admin_with_properties = (function () {/*  
	SELECT users.autoID as userid, users.email as email, users.phone as phone, users.admin as admin, users.superadmin as superadmin, properties.autoID as propid, pname, users.fname
	FROM properties
	LEFT OUTER JOIN users ON users.autoID = @@userid
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function middleHandler_db_get_user_login_with_properties(req, res, next) {
	//console.log("  middleHandler_db_get_user_login_with_properties");	
	
	req.user_email = '';
	req.user_phone = '';
	req.user_name = '';
	req.user_nick = '';
	req.user_admin = 0;
	req.user_superadmin = 0;
	
	var sql = '';
	if(_skiplogin == 1){
		//console.log('    skipping login')
		for(var x=0;x<req.dev_user_emails.length;x++){
			if(req.dev_user_emails[x]['email']==req.query.e){
				//console.log('    skipping found ' + req.query.e);
				req.userid = req.dev_user_emails[x]['id']
				req.user_email = req.dev_user_emails[x]['email']
				req.user_admin = req.dev_user_emails[x]['admin']
				req.user_superadmin = req.dev_user_emails[x]['superadmin']
				req.dev_user_selected_index = x;
				if(req.dev_user_emails[x]['superadmin']==1){
					sql = _sql_super_admin_with_properties.replace('@@userid', req.userid);
				} else {
					sql = _sql_user_login_with_properties.replace('@@userid', req.userid);
				}
			}
		}
	} else {
		//req.query.e+' p='+req.query.p);
		sql = _sql_regular_login_with_properties.replace('@@email', req.query.e);
		sql = sql.replace('@@password', bplBase64Sha512(req.query.p+req.query.e));
	}
	//console.log('    req.userid = ' + req.userid);
	if(sql.length > 0) {
		req.user_properties = [];	
		db.each(sql, function(err, row) {			
			req.userid = row.userid;
			req.user_email = row.email;
			req.user_phone = row.phone;
			req.user_name = row.fname + ' ' + row.lname;
			req.user_nick = '';
			req.user_admin = row.admin;
			req.user_superadmin = row.superadmin;

			var val = {id: row.propid, name: row.pname}
			//console.log('    setting properties ' + row.propid)
			req.user_properties.push(val)		
		}, function () {	
			if(req.user_properties.length>0){
				req.propid = req.user_properties[0]['id']
				//console.log('ack2 '+req.propid)
			}
			next();
		});		
	} else {
		next();
	}
}

function middleHandler_db_get_user_properties(req, res, next) {
	if(_debug){
		console.log("  middleHandler_db_get_user_properties");	 
		console.log(new Date().getTime());
	}
	var sql = '';
	req.errors = []
	if(req.userid > 0){
		if(req.user_superadmin==1){sql = _sql_super_admin_with_properties.replace('@@userid', req.userid);
		} else {sql = _sql_user_login_with_properties.replace('@@userid', req.userid);}		
		req.user_properties = [];	
		req.user_sqlor_for_tickets = ""
		if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {
			req.user_properties.push({id: row.propid, name: row.pname})
		}, function () {	
			if(req.user_properties.length>0){
				if(req.incoming_propid>0){
					for(var x=0;x<req.user_properties.length;x++){
						if(req.user_properties[x]['id']==req.incoming_propid){
							req.propid = req.incoming_propid
							if(_debug){console.log('ack3a '+req.propid)}
							break;
						}
					}
				} else {
					req.propid = req.user_properties[0]['id']
					if(_debug){console.log('ack3b '+req.propid)}
				}
			}
			//setup sqlor for reports 
			var sqlorlist = []
			for(var x=0;x<req.user_properties.length;x++){
				sqlorlist.push('pid = '+req.user_properties[x]['id'])
			}
			req.user_sqlor_for_tickets = 'WHERE ('+sqlorlist.join(' OR ')+') '
			next();
		});
	} else {
		next();
	}
}

const _sql_check_superadmin_property = (function () {/*  
	SELECT autoID as propertyID, linksite 
	FROM properties
	WHERE autoID = @@prop
	LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _sql_check_user_property = (function () {/*  
	SELECT propertyID, linksite 
	FROM user_properties 
	INNER JOIN properties ON properties.autoID = user_properties.propertyID
	WHERE propertyID = @@prop
	LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function middleHandler_db_check_user_supplied_property(req, res, next) {
	//console.log("  middleHandler_db_check_user_supplied_property " + req.query.prop);	
	req.propid = 0;
	req.prop_linksite = '';
	req.shared_ticket_id = 0
	var sql = '';
	if(req.user_superadmin==1){
		sql = _sql_check_superadmin_property;
	} else {
		sql = _sql_check_user_property.replace('@@userid', req.userid);
	}
	sql = sql.replace('@@prop', req.query.prop);
	db.each(sql, function(err, row) {		
		req.propid = row.propertyID
		req.prop_linksite = "http://" + env.guest_server + "/" + row.linksite + "/"
	}, function () {	
		next();
	});	
}

function middleHandler_db_get_user_login_cookie_factory(req, res, next) {
	if(_debug){
		console.log("middleHandler_db_get_user_login_cookie_factory");	
		console.log('    req.userid = '+req.userid);
		console.log(req.propid)
	}
	req.email = ""
	
	if(req.userid > 0){
		db.each("SELECT autoID, email FROM users WHERE autoID = '"+req.userid+"'", function(err, row) {
		req.email = row.email;		
		db.run("DELETE FROM cookies WHERE uid = "+row.autoID);
		var guid = require('guid');
		req.cookieid = guid.create();
		var sql = "INSERT INTO cookies VALUES(NULL, "+row.autoID+", '"+req.cookieid+"', '', '')"
		if(_debug){console.log(sql)}
		db.run(sql);					
			if(req.userid>0){
				if(_debug){
					console.log('    setting cookies '+ req.cookieid.value + ', '+req.email+', '+req.propid);
				}
				res.cookie("rbpx-g",req.cookieid.value, { signed: false });
				res.cookie("rbpx-u",req.email, { signed: false });
				res.cookie("rbpx-r",req.propid, { signed: false });	
			}		
		}, function() {				
			next();
		});
	} else { 
		next(); 
	}
}


restapi.get('/home', 
	middleHandler_db_user_emails_for_dev_login, 
	middleHandler_cookie_check,
	middleHandler_db_get_user_login_with_properties, 
	middleHandler_db_get_user_login_cookie_factory, 
	
	function(req,res){	
	if(true){console.log('/home e='+req.query.e+' p='+req.query.p);}
	var r = req.query.r; if(r == ''){r=0}
	var propid = r;
		
	//var email = req.query.e.toLowerCase();
	//var pwhash = bplBase64Sha512(req.query.p+''+email);
	//console.log('  ' + r + ' ' + email + ' ' + req.query.p + ' ' + pwhash);
	//set nick [clean [decode $n]]
	var home = "Error"
	var cont = 0; //pass all of the tests
	var adm = 0; var admt = ''; var superadmin = 0;
	if(_skiplogin == 1){
		if(req.dev_user_selected_index>=0){
			cont = 1;
			var x = req.dev_user_selected_index;		
			adm = req.dev_user_emails[x]['admin']; 
			superadmin = req.dev_user_emails[x]['superadmin']; 
		}
	} else {	
		if(req.query.e != "" && req.query.p == ""){
			home = "Password"
		} else {
			if(req.userid == 0){
				if(req.query.e == "" || req.query.p == ""){
				} else {
					req.userid = 0;			
				}	
			} else {
				adm = req.user_admin; admt = ''; superadmin = req.user_superadmin;
				cont = 1;
			}
		}
	}
	if(adm==1){admt = "Administrator"}; if(superadmin==1){admt = "Super Admin"}
	
	var tabs = '';
	if (cont == 1) {
		tabs = adm+'::'+admt+'::'+req.user_email+'::'+req.userid+';;'
		for(var x=0; x < req.user_properties.length; x++){
			tabs = tabs+req.user_properties[x]['id']+'::'+req.user_properties[x]['name'];
			if(x < req.user_properties.length-1){tabs+=';;'}
		}		
	}
	res.write(tabs)
	res.end();
	
});


restapi.get('/home2', 
	middleHandler_cookie_check,
	middleHandler_db_get_user_properties,
	
	function(req,res){		
	//console.log('/home2 '+req.user_email);
	var tabs = '';
	var adm = 0; var admt = ''; var superadmin = 0;
	
	if(req.userid == 0){
		tabs = "Login";
	} else {
		var cont = 1
		adm = req.user_admin; admt = ''; superadmin = req.user_superadmin;
		if(adm==1){admt = "Administrator"}; if(superadmin==1){admt = "Super Admin"}	
		if (cont == 1) {
			tabs = adm+'::'+admt+'::'+req.user_email+'::'+req.userid+';;'		
			for(var x=0; x < req.user_properties.length; x++){
				tabs = tabs+req.user_properties[x]['id']+'::'+req.user_properties[x]['name'];
				if(x < req.user_properties.length-1){tabs+=';;'}
			}				
		}
	}
	
	res.write(tabs)
	res.end();
	
});



function middleHandler_db_register_user_checkkey(req, res, next) {
	if(_debug){console.log("middleHandler_db_register_user_checkkey");}
	req.errors = []; req.user_reg_found = 0; req.user_reg_userid = 0; req.user_reg_email = ''
	if(req.user_register==1 && req.user_regkey != ''){
		var sql = "SELECT autoID as userid, admin as adm, email, groupcount FROM users WHERE xcode = '"+req.user_regkey+"'"
		if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {
			req.user_reg_found = 1; 
			req.user_reg_userid = row.userid; 
			req.user_reg_email = row.email.toLowerCase()
			req.email = req.user_reg_email
		}, function() {next();});
	} else {next();}
}

function middleHandler_db_register_user_checkkey2(req, res, next) {
	if(_debug){console.log("middleHandler_db_register_user_checkkey2");}
	req.errors = []; req.user_reg_found = 0; req.user_reset_userid = 0; req.user_reset_email = ''
	if(req.user_resetpw==1 && req.user_regkey != ''){
		var sql = "SELECT autoID as userid, admin as adm, email, groupcount FROM users WHERE xcode = '"+req.user_regkey+"'"
		if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {
			req.user_reg_found = 1; 
			req.user_reset_userid = row.userid; 
			req.userid  = row.userid;
			req.user_reset_email = row.email.toLowerCase()
			req.email = req.user_reg_email
		}, function() {next();});
	} else {next();}
}

function middleHandler_db_register_user_setpassword(req, res, next) {
	if(_debug){console.log("middleHandler_db_register_user_setpassword");}
	if(req.user_register==1 && req.user_reg_userid > 0 && req.errors.length==0){
		var pwhash = bplBase64Sha512(req.query.p+''+req.user_reg_email);	
		var sql = "UPDATE users SET password = '"+pwhash+"', xcode = '' WHERE autoID = "+req.user_reg_userid
		db.run(sql, function(err) {			
		}, function() {req.userid = req.user_reg_userid;next();});
	} else {next();}
}

function middleHandler_db_typical_user_setpassword(req, res, next) {
	if(_debug){console.log("middleHandler_db_typical_user_setpassword");}
	if(req.user_resetpw==1 && req.user_reset_userid > 0 && req.errors.length==0){
		var pwhash = bplBase64Sha512(req.query.p+''+req.user_reset_email);	
		var sql = "UPDATE users SET password = '"+pwhash+"', xcode = '' WHERE autoID = "+req.user_reset_userid
		if(_debug){console.log(sql)}
		db.run(sql, function(err) {			
		}, function() {next();});
	} else {next();}
}

restapi.get('/home3', 
	middleHandler_cookie_check,
	middleHandler_db_register_user_checkkey,
	middleHandler_db_register_user_checkkey2,
	middleHandler_db_register_user_setpassword,
	middleHandler_db_typical_user_setpassword,
	middleHandler_db_get_user_properties,
	middleHandler_db_get_user_login_cookie_factory,
	function(req,res){	
	if(true){
		console.log('/home3')
		console.log(req.email);
		console.log(req.query)
	}
	req.user_register=0	
	req.user_resetpw=0
		res.cookie("rbpx-x",'', { signed: false });	
		res.cookie("rbpx-z",'', { signed: false });	
		
	res.write("Refresh")
	res.end()
	
});


restapi.get('/support', 
	middleHandler_cookie_check,
		
	function(req,res){
	//console.log('/support');
	var bit = replace_all_array(_support, {name: req.user_name, phone: req.user_phone, email: req.user_email})	
	res.write(bit)
	res.end();
	
});


function middleHandler_email_prep_support(req, res, next) {
	//console.log("  middleHandler_email_prep_support");	
	req.sendmail_send = true;
	req.sendmail_from = env.sendmail_from_noreply
	req.sendmail_to = 'jana@rbpsoftwaresolutions.com'
	req.sendmail_subject = 'Guest Inquiries Support Message - '+ decode(req.query.name)
	req.sendmail_text = '\nName: '+ decode(req.query.name)+'\n\nPhone: '+ decode(req.query.phone)+'\n\nEmail: '+  decode(req.query.email).toLowerCase() + '\n\n' +  decode(req.query.desc) + '\n'
	req.sendmail_html = '<br>Name: '+ decode(req.query.name)+'<br><br>Phone: '+ decode(req.query.phone)+'<br><br>Email: '+  decode(req.query.email).toLowerCase() + '<br><br>' +  decode(req.query.desc) + '<br>'
	req.sendmail_okresponse = 'Message sent.  We will contact you as soon as possible.'
	next();
}

function middleHandler_email_prep_demo(req, res, next) {
	//console.log("  middleHandler_email_prep_demo");	
	req.sendmail_send = true;
	req.sendmail_from = env.sendmail_from_noreply
	req.sendmail_to = 'jana@rbpsoftwaresolutions.com'
	req.sendmail_subject = 'Guest Inquiries Demo Request - '+ decode(req.query.name)
	req.sendmail_text = '\nDemo Request\n\nName: '+ decode(req.query.name)+'\n\nEmail: '+  decode(req.query.email).toLowerCase() + '\n'
	req.sendmail_html = '<br>Demo Request<br><br>Name: '+ decode(req.query.name)+'<br><br>Email: '+  decode(req.query.email).toLowerCase() + '<br>'
	req.sendmail_okresponse = 'Thank You.  RBP Software Solutions received your message.  We will contact you as soon as possible.'
	next();
}

function middleHandler_email_prep_new_associate(req, res, next) {
	//console.log("  middleHandler_email_prep_new_associate");	
	if(req.errors.length == 0 && req.new_assoc_row.length == 1){
	req.sendmail_send = true;
	req.sendmail_from = env.sendmail_from_noreply
	req.sendmail_to = req.new_assoc_row[0]['email']
	req.sendmail_subject = "Guest Inquiries Associate Account"
	var body = "<br>Email: @@email<br><br>To complete your registration, you must create a password by clicking on the following link:<br><br><a rel='nofollow' target='_blank' href='@@sport/associate/create?id=@@xcode'>@@sport/associate/create?id=@@xcode</a><br>"
	body = replace_all_array(body, {
		email: req.sendmail_to,
		sport: env.server,
		xcode: req.add_user_xcode 
	})
	req.sendmail_text = "An account has been created for you on RBP Software Solutions<br>"+body
	req.sendmail_html = "An account has been created for you on RBP Software Solutions<br>"+body
	req.sendmail_okresponse = 'Message sent for new Associate'
	}
	next();
}


function middleHandler_send_message(req, res, next) {
	console.log("  middleHandler_send_message " + req.sendmail_subject);	
	if(req.sendmail_send){
		req.transporter_result = ''
		var to = req.sendmail_to
		var subject = req.sendmail_subject
		if (env.env == 'development') {
			subject = 'TO:('+to+') '+ subject;
			to = env.dev_redirect_outgoing_emails_to;
		}
		var debug = true
		if(_debug){
			console.log(to)
			console.log(req.sendmail_from)
			console.log(subject)
			console.log(req.sendmail_text)
			console.log(req.sendmail_html)
		}
			
		transporter.sendMail({ from: req.sendmail_from, to: to, subject: subject, text: req.sendmail_text, html: req.sendmail_html
		}, function(error, response) {
			if(_debug){console.log(response)}
			if (error) {
				console.log(error)
				req.transporter_result = 'alert::::Message error:' + error;
			} else {
				req.transporter_result = 'ok::::'+req.sendmail_okresponse;
			}
			req.sendmail_send = false;
			next();
		});	
	} else {
		//console.log('email skipped')
		next();
	}
}

restapi.get('/support_message', 
	middleHandler_email_prep_support,
	middleHandler_send_message,
	
	function(req,res){		
	//console.log("/support_message");
	res.write(req.transporter_result)
	res.end();
})

restapi.get('/sppt_message', 
	middleHandler_email_prep_support,
	middleHandler_send_message,
	function(req,res){		
	//console.log("/sppt_message");
	res.write(req.transporter_result)
	res.end();
})

restapi.get('/demo_message', 
	middleHandler_email_prep_demo,
	middleHandler_send_message,
	
	function(req,res){		
	//console.log("/demo_message");
	if(false){console.log(req.transporter_result)}
	res.write(req.transporter_result)
	res.end();
})


const _sql_ticket_unlock_emit = (function () {/*  
	SELECT ticket_locking.ticketID as id,
        tickets.status as status,
        tickets.pid as pid		
    FROM ticket_locking 
    INNER JOIN tickets ON ticketID = tickets.autoID
    WHERE lockedby = @@uid AND nick = '@@nick'

	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
		
function middleHandler_db_edit_ticket_unlock_emit(req, res, next) {
	//console.log("  middleHandler_db_edit_ticket_unlock_emit "+req.query.t);		
	req.ticket_cancel_emit_list = []
	if(req.userid > 0){
		var sql = _sql_ticket_unlock_emit.replace('@@uid', req.userid)
		sql = sql.replace('@@nick',req.user_nick)
		db.each(sql, function(err, row) {
			//console.log(row);
			req.ticket_cancel_emit_list.push(row)
		}, function () {	
			next();
		});	
	} else { 
		next(); 
	}
}

function middleHandler_db_edit_ticket_cancel(req, res, next) {
	//console.log("  middleHandler_db_edit_ticket_cancel "+req.query.t);		
	if(req.userid > 0){
		db.run("DELETE FROM ticket_locking WHERE lockedby = "+req.userid+" AND nick = '"+req.user_nick+"'", function() {				
			next();
		});
	} else { 
		next(); 
	}
}


function middleHandler_emit_edit_ticket_working(req, res, next) {
	req.errors = []
	if(req.userid>0){
		//console.log('sti 1' + req.query.id)
		req.shared_ticket_id = req.query.id
		io.emit('working-'+req.userid+'-edit-ticket','Request Accepted...')
	}
	next(); 	
}

restapi.get('/edit-ticket-cancel',
	middleHandler_cookie_check,
	middleHandler_db_edit_ticket_unlock_emit,
	middleHandler_db_edit_ticket_cancel,	
	function(req,res){	
	//console.log('/edit-ticket-cancel');
	for(var x=0;x<req.ticket_cancel_emit_list.length;x++){
		//console.log('ticket-edit-cancel-'+req.ticket_cancel_emit_list[x]['pid'])
		io.emit('ticket-edit-cancel-'+req.ticket_cancel_emit_list[x]['pid'], {
			id: req.ticket_cancel_emit_list[x]['id'], 
			uid: req.userid, 
			status: req.ticket_cancel_emit_list[x]['status']
		})
	}
	res.end();	
});

function middleHandler_ticket_verify_update_data(req, res, next) {
	req.errors = []
	req.update_data = []
	if(req.userid > 0 && req.query.id > 0){
		io.emit('working-'+req.userid+'-edit-ticket','Verifying Ticket Data...')
		var statxt = decode(req.query.statxt); if(statxt.length>0){statxt = "Internal Comment: "+statxt}
		var custxt = decode(req.query.custxt);		
		//set userid [lindex $ck 0]
		//set nick [lindex $ck 4]
		var old_status = 0
		var first_assignmentID = 0
		var last_first_assignmentID = req.query.asgn
		var room = decode(req.query.room)		
		var editing = 0
		var email = req.query.email.toLowerCase();
		if(!validateEmail(email)){req.errors.push("Invalid email address")} else {
			req.update_data.push( {
				statxt: statxt,
				custxt: custxt,
				old_status: 0,
				first_assignmentID: 0,
				last_first_assignmentID: req.query.asgn,
				room: req.query.room,
				editing: 0,
				email: req.query.email.toLowerCase()
			})
		}
		next();
	} else {
		req.errors.push("An unknown error ocurred, id")
		next(); 
	}
}

const _sql_ticket_gcode_more = (function () {/* 
	SELECT guest_edit_code as gcode, pid, first_assignmentID, ticketno, status as old_status, initial_type, tdate, 
	fname, mi, lname, email as uemail, description, input_method, cancellation as confirmation 
	FROM tickets WHERE autoID = @@id LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function middleHandler_db_prepare_for_ticket_update(req, res, next) {
	//console.log("  middleHandler_db_prepare_for_ticket_update");	
	req.ticket_old_status = 0
	req.ticket_old_row = []
	req.ticket_old_first_assignmentID = 0;
	if(req.userid > 0 && req.query.id > 0 && req.errors.length == 0){
		io.emit('working-'+req.userid+'-edit-ticket','Preparing to Update...')
		var sql = _sql_ticket_gcode_more.replace('@@id', req.query.id);
		db.each(sql, function(err, row) {
			req.ticket_old_status = row.old_status
			req.ticket_old_row.push(row)
			req.ticket_old_first_assignmentID = row.first_assignmentID;
		}, function () {	
			next();
		});	
	} else {
		next();
	}
}
	
function middleHandler_db_edit_single_ticket_cancel(req, res, next) {
	//console.log("  middleHandler_db_edit_single_ticket_cancel "+req.query.id);		
	if(req.userid > 0){
		db.run("DELETE FROM ticket_locking WHERE lockedby = "+req.userid+" AND nick = '"+req.user_nick+"' AND ticketID = "+req.query.id, function() {				
			next();
		});
	} else { 
		next(); 
	}
}

const _sql_db_ticket_edit_accept = (function () {/*  
	UPDATE tickets SET 
		@@status_sql 
	room_number = '@@room', 
	check_in = '@@checkin', 
	check_out = '@@checkout', 
	email = '@@email', 
	phone = '@@phone', 
	deptID = @@dept, 
	catID = @@cat, 
	amount = @@amount 
	@@update_more WHERE autoID = @@id		
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_ticket_edit_accept_update(req, res, next) {
	//console.log("  middleHandler_db_ticket_edit_accept_update "+req.query.id);		
	req.ticket_update_status = 0
	var status_sql = ''
	var update_more = ''
	var d = new Date
	req.ticket_edit_dnow = rbp_dte()
	
	if(req.userid > 0 && req.query.id > 0){
		if(req.query.tostat == "pending"){req.ticket_update_status = STATUS_PENDING; status_sql = "status = "+STATUS_PENDING+","}
		if(req.query.tostat == "awaiting"){req.ticket_update_status = STATUS_WAITING; status_sql = "status = "+STATUS_WAITING+","}
		if(req.query.tostat == "approved" || req.query.silent == "true"){
			req.ticket_update_status = STATUS_APPROVED; status_sql = "status = "+STATUS_APPROVED+","; 
			update_more = ", tdate_closed = '"+req.ticket_edit_dnow+"', month_closed = "+d.getMonth()+", day_closed = "+d.getDate()+", year_closed = "+d.getFullYear()+", unix_date_closed = "+parseInt(d.getTime() / 1000)+" "}				
		io.emit('working-'+req.userid+'-edit-ticket','Updating ticket...')
		var sql = replace_all_array(_sql_db_ticket_edit_accept, {
			id: req.query.id,
			status_sql: status_sql,
			room: req.update_data[0]['room'],
			checkin: req.query.checkin,
			checkout: req.query.checkout,
			email: req.update_data[0]['email'],
			phone: req.query.phone,
			dept: req.query.dept,
			cat: req.query.cat,
			amount: from_currency(req.query.amount),
			update_more: update_more
		})
		//console.log(sql)
		db.run(sql, function(err) {
			next();
		});
	} else { 
		next(); 
	}
}


const _sql_db_ticket_edit_status_update = (function () {/*  
	INSERT INTO ticket_status 
	VALUES(NULL, @@pid, @@userid, @@ticketno, @@status, '@@dnow', '@@statxt', '@@nick')
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_ticket_edit_status_update(req, res, next) {
	//console.log("  middleHandler_db_ticket_edit_status_update "+req.query.id);		
	if(req.userid > 0 && req.query.id > 0 && req.update_data.length == 1 && req.ticket_old_row.length == 1){
		io.emit('working-'+req.userid+'-edit-ticket','Updating ticket status...')
		var sql = replace_all_array(_sql_db_ticket_edit_status_update, {
			id: req.query.id,
			dnow: req.ticket_edit_dnow,
			pid: req.ticket_old_row[0]['pid'],
			userid: req.userid,
			ticketno: req.ticket_old_row[0]['ticketno'],
			status: req.ticket_update_status,
			statxt: req.update_data[0]['statxt'],
			nick: req.user_nick
		})
		//console.log(sql)
		db.run(sql, function(err) {
			next();
		});
	} else { 
		next(); 
	}
}



function middleHandler_ticket_assignment_change_get_name(req, res, next) {
	if(_debug){
		console.log("  middleHandler_ticket_assignment_change_get_name "+req.query.id);	
		console.log(req.tickets[0]);
		console.log(req.ticket_old_first_assignmentID)
		console.log(req.tickets[0]['first_assignmentID'])
		console.log(req.query.asgn)
	}
	req.send_asgn = 0
	req.update_asgn = false
	req.send_asgn_asgn = req.query.asgn
	req.send_asgn_name = ''
	req.send_asgn_email = []
	if(req.userid > 0 && req.tickets.length == 1){
		if(req.ticket_update_status == STATUS_APPROVED){
			if(req.ticket_old_first_assignmentID == 0){
				req.ticket_old_first_assignmentID = req.userid;
			}
		}				
		if(req.send_asgn_asgn == 0){
			req.send_asgn = 1
			req.update_asgn = true
			req.send_asgn_asgn = req.userid			
		} else {			
			if(req.ticket_old_first_assignmentID != req.send_asgn_asgn){
				req.send_asgn = 1
				req.update_asgn = true
			}
		}
		var sql = "SELECT fname as ufname, mi as umi, lname as ulname, email FROM users WHERE autoID = " + req.send_asgn_asgn
		if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {			
			req.send_asgn_name = row.ufname + " "+row.umi+" "+row.ulname
			req.send_asgn_email.push(row.email.toLowerCase())
			if(_debug){console.log(req.send_asgn_name)}
		}, function () {
			next()
		});	
	} else { 
		next(); 
	}
}

function middleHandler_db_department_emails_ticket_assignment(req, res, next) {
	if(_debug){console.log("  middleHandler_db_department_emails_ticket_assignment "+req.query.id)};
	if(req.userid > 0 && req.query.notify == "true"){
		var sql = "SELECT userID, email FROM department_users INNER JOIN users ON department_users.userID = users.autoID WHERE pid = "+req.propid+" AND departmentID = " + req.query.dept		
		if(_debug){console.log(sql);console.log(req.send_asgn_email)}
		db.each(sql, function(err, row) {						
			if(_debug){console.log(row)}
			var found = false;
			for(var x=0;x<req.send_asgn_email.length;x++){
				if(row.email.toLowerCase() == req.send_asgn_email[x]){found = true}
			}
			if(!found){req.send_asgn_email.push(row.email.toLowerCase())}
		}, function () {
			next()
		});	
	} else { 
		next(); 
	}
}
function middleHandler_ticket_assignment_change_update_ticket(req, res, next) {
	console.log("  middleHandler_ticket_assignment_change_update_ticket "+req.query.id);	
	if(req.userid > 0 && req.tickets.length == 1 && req.update_asgn){
		var sql = "UPDATE tickets SET first_assignmentID = "+req.send_asgn_asgn+" WHERE autoID = "+req.query.id
		if(_debug){console.log(sql)}
		db.run(sql, function(err) {			
		}, function () {
			next()
		});	
	} else { 
		next(); 
	}
}

const system_email_ticket_assignment = (function () {/*  
A new ticket has been assigned to you.<br><br>
Property Name: @@pname<br>
Ticket Date: @@tdate<br>
Guest Name: @@fname @@mi @@lname<br><br>
To process the inquiry now, please use the link below<br><br>
<a rel='nofollow' target='_blank' href='@@sport/special/ticket/edit?id=@@id&status=@@status&prop=@@prop'>@@sport/special/ticket/edit?id=@@id&status=@@status&prop=@@prop</a><br><br>
Comment History:<br><br>
@@ticket_history
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

	
function middleHandler_ticket_edit_system_email_ticket_assignment(req, res, next) {
	console.log("  middleHandler_ticket_edit_system_email_ticket_assignment ");	
	req.sendmail_from = env.sendmail_from_noreply
	req.sendmail_subject = "Unknown Status Subject"
	req.sendmail_to = req.send_asgn_email.join(",")
	if(_debug){console.log(req.sendmail_to)}
	if(req.update_asgn && validateEmail(req.sendmail_to)) {		
		var subject = "Ticket Assignment for @@pname - @@ticketno"
			req.sendmail_subject = replace_all_array(subject, req.tickets[0]);
		var body = replace_all_array(system_email_ticket_assignment, req.tickets[0]);
			body = replace_all_array(body, {sport: env.server, status: _ticket_status_labels[req.ticket_update_status]})
			body = body.replace('@@ticket_history', req.ticket_history);
		req.sendmail_text = body
		req.sendmail_html = body
		req.sendmail_send = true;
	}
	next()
}





const _sql_db_system_notification_for_email = (function () {/*  
	SELECT user_properties.userID AS unid,
    email
	FROM user_properties
	INNER JOIN user_notification ON user_notification.userid = user_properties.userID AND notification = @@notif
    INNER JOIN users ON user_properties.userID = users.autoID
	WHERE propertyID = @@pid;
*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_ticket_edit_system_email_notification_prep(req, res, next) {
	console.log("  middleHandler_ticket_edit_system_email_notification_prep "+req.query.id);		
	req.sendmail_send = false;
	var mailto = []
	if(req.userid > 0 ){
		var sql = replace_all_array(_sql_db_system_notification_for_email, {
			pid: req.propid,
			notif: 2
		})
		if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {			
			mailto.push(row.email)
		}, function () {
			req.sendmail_to = mailto.join(',')
			console.log(req.sendmail_to);
			next()
		});	
	} else { 
		next(); 
	}
}

const system_email_waiting_body = (function () {/*  
A guest inquiry ticket has been submitted for approval.  Please check the Awaiting Approval Folder.<br><br>
Property Name: @@pname<br>
Ticket Date: @@tdate<br>
Guest Name: @@fname @@mi @@lname<br><br>
To process the inquiry now, please use the link below<br><br>
<a rel='nofollow' target='_blank' href='@@sport/special/ticket/edit?id=@@id&status=@@status&prop=@@prop'>@@sport/special/ticket/edit?id=@@id&status=@@status&prop=@@prop</a><br><br>
Comment History:<br><br>
@@ticket_history
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const system_email_attention_body = (function () {/*  
A guest inquiry ticket needs your attention.<br><br>
Property Name: @@pname<br>
Ticket Date: @@tdate<br>
Guest Name: @@fname @@mi @@lname<br><br>
To process the inquiry now, please use the link below<br><br>
<a rel='nofollow' target='_blank' href='@@sport/special/ticket/edit?id=@@id&status=@@status&prop=@@prop'>@@sport/special/ticket/edit?id=@@id&status=@@status&prop=@@prop</a><br><br>
Comment History:<br><br>
@@ticket_history
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function middleHandler_ticket_edit_system_email_system_defaults(req, res, next) {
	console.log("  middleHandler_ticket_edit_system_email_system_defaults "+_ticket_status_labels[req.ticket_update_status]);	
	req.sendmail_from = env.sendmail_from_noreply
	req.sendmail_subject = "Unknown Status Subject"
	if(req.ticket_update_status == STATUS_WAITING) {		
		var subject = "Guest Inquiry Awaiting Approval for @@pname - @@ticketno"
			req.sendmail_subject = replace_all_array(subject, req.tickets[0]);
		var body = replace_all_array(system_email_waiting_body, req.tickets[0]);
			body = replace_all_array(body, {sport: env.server, status: _ticket_status_labels[req.ticket_update_status]})
			body = body.replace('@@ticket_history', req.ticket_history);
		req.sendmail_text = body
		req.sendmail_html = body
		req.sendmail_send = true;
	}
	if(req.query.notify == "true") {		
		var subject = "Guest Inquiries Notification for @@pname - @@ticketno"
			req.sendmail_subject = replace_all_array(subject, req.tickets[0]);
		var body = replace_all_array(system_email_attention_body, req.tickets[0]);
			body = replace_all_array(body, {sport: env.server, status: _ticket_status_labels[req.ticket_update_status]})
			body = body.replace('@@ticket_history', req.ticket_history);
		req.sendmail_text = body
		req.sendmail_html = body
		req.sendmail_send = true;
	}
	next()
}
	
	
	
	
function middleHandler_ticket_edit_guest_email_system_defaults(req, res, next) {
	//console.log("  middleHandler_ticket_edit_guest_email_system_defaults "+req.propid);	
	req.em_from = env.sendmail_from_noreply
	req.em_subject = "Guest Inquiry Message"
	if(req.ticket_update_status == STATUS_APPROVED) {
		req.em_body = "Your inquiry has been resolved"
	} else {
		req.em_body = "Message about your Guest Inquiry"
	}
	next()
}

const _sql_db_file_elinks = (function () {/*  
	SELECT autoID as id, ticketid, content, original_name, dateadded 
	FROM ticket_docs WHERE deleted = 0 AND @@sqlorlist
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_ticket_edit_file_elinks(req, res, next) {
	//console.log("  middleHandler_db_ticket_edit_file_elinks ");		
	req.file_links = []
	req.file_comments = []
	var files = req.query.files.split(",")
	if(req.userid > 0 && req.query.id > 0 && req.query.files.length > 0){		
		var sqlorlist = []
		for(var x=0;x<files.length;x++){
			sqlorlist.push('autoID = '+files[x])
		}
		var sqlor = ' ('+sqlorlist.join(' OR ')+') '		
		var sql = _sql_db_file_elinks.replace('@@sqlorlist', sqlor)
		//console.log(sql)
		db.each(sql, function(err,row) {
			req.file_links.push({
				id: row.id,
				ticketid: row.ticketid,
				content: row.content,
				original_name: row.original_name,
				dateadded: row.dateadded,
				ft: row.original_name.split(".")[1],
				server: env.server
			})
			next();
		});
	} else { 
		next(); 
	}
}

	
const _email_guest_message_text = (function () {/*  
	@@em_body \n\n
	Inquiry Date: @@tdate \n
	Guest Name: @@fname @@mi @@lname \n\n
	@@extra_comment @@filelinks_text \n\n
	To reply to this message, please use the following link:\n\n
	<a rel='nofollow' target='_blank' href='@@server/guest/ticket/comment?id=@@id&gcode=@@gcode'>@@server/guest/ticket/comment?id=@@id&gcode=@@gcode</a> \n\n
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _email_guest_message_html = (function () {/*  
	@@em_body <br><br>
	Inquiry Date: @@tdate <br>
	Guest Name: @@fname @@mi @@lname <br><br>
	@@extra_comment @@filelinks_html <br><br>
	To reply to this message, please use the following link:<br><br>
	<a rel='nofollow' target='_blank' href='@@server/guest/ticket/comment?id=@@id&gcode=@@gcode'>@@server/guest/ticket/comment?id=@@id&gcode=@@gcode</a> <br><br>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _email_guest_message_file_link_text = (function () {/*  
	<a rel='nofollow' target='_blank' href='@@server/download?id=@@content&ft=@@ft'>@@original_name</a> \n
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _email_guest_message_file_link_html = (function () {/*  
	<a rel='nofollow' target='_blank' href='@@server/download?id=@@content&ft=@@ft'>@@original_name</a><br>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_email_prep_ticket_edit_guest_message(req, res, next) {
	//console.log("  middleHandler_email_prep_ticket_edit_guest_message");		
	var extra_comment_text = ''
	var extra_comment_html = ''
	req.sendmail_send = false;
	if(req.query.notifcust == "true" && req.update_data.length == 1 && req.ticket_old_row.length == 1){
		if( (req.ticket_update_status == STATUS_APPROVED && req.query.silent === "false") || req.query.notifcust == "true") {
			io.emit('working-'+req.userid+'-edit-ticket','Sending guest email...')
			extra_comment_text = req.update_data[0]['custxt']+'\n\n'
			extra_comment_html = req.update_data[0]['custxt']+'<br><br>'
			req.sendmail_send = true;
			req.sendmail_from = req.em_from
			req.sendmail_to = req.ticket_old_row[0]['uemail']
			req.sendmail_subject = req.em_subject
			
			var files_text = ''; var files_html = ''
			for(var x=0;x<req.file_links.length;x++){
				files_text += replace_all_array(_email_guest_message_file_link_text, req.file_links[x])
				files_html += replace_all_array(_email_guest_message_file_link_html, req.file_links[x])
			}
			
			var bodybits = {
				id: req.query.id,
				gcode: req.ticket_old_row[0]['gcode'],
				em_body: req.em_body,
				tdate: req.ticket_old_row[0]['tdate'],
				fname: req.ticket_old_row[0]['fname'],
				mi: req.ticket_old_row[0]['mi'],
				lname: req.ticket_old_row[0]['lname'],				
				server: env.server,
				filelinks_text: files_text,
				filelinks_html: files_html
			}
				
			req.sendmail_text = replace_all_array(_email_guest_message_text, bodybits)
				req.sendmail_text = req.sendmail_text.replace('@@extra_comment', extra_comment_text)
			req.sendmail_html = replace_all_array(_email_guest_message_html, bodybits)
				req.sendmail_html = req.sendmail_html.replace('@@extra_comment', extra_comment_html)
			req.sendmail_okresponse = 'Message sent.'
		}
		
		//	set sql "INSERT INTO ticket_status VALUES(NULL, $pid, $userid, $ticketno, $status, '$dnow', 'Comment To Guest: $custxt $filecomments', '')"
		//	with $mydb $sql
		//	sendemail1 $userid $pid $em_from $uemail $em_subject [emailprep $body]
		
	}
	next();
}	
	
restapi.get('/ticket-edit-accept',
	middleHandler_cookie_check,
	middleHandler_emit_edit_ticket_working,
	middleHandler_ticket_verify_update_data,
	middleHandler_db_prepare_for_ticket_update,
	middleHandler_db_edit_single_ticket_cancel,
	middleHandler_db_ticket_edit_accept_update,
	middleHandler_db_ticket_edit_status_update,
	middleHandler_db_get_tickets,
	middleHandler_ticket_history,
	
	middleHandler_ticket_assignment_change_get_name,
	middleHandler_db_department_emails_ticket_assignment,
	middleHandler_ticket_assignment_change_update_ticket,	
	middleHandler_ticket_edit_system_email_ticket_assignment,
	middleHandler_send_message,
	
	middleHandler_ticket_edit_system_email_notification_prep,
	middleHandler_ticket_edit_system_email_system_defaults,	
	middleHandler_send_message,
	
	middleHandler_ticket_edit_guest_email_system_defaults,
	middleHandler_ticket_edit_guest_email_db_defaults,
	middleHandler_db_ticket_edit_file_elinks,
	middleHandler_email_prep_ticket_edit_guest_message,
	middleHandler_send_message,
	
	function(req,res){
	console.log('/ticket-edit-accept');
	var html = "alert"
	if(req.errors.length == 0){
		if(req.tickets.length == 1) {			
			var bubble = comment_bubble(req.tickets[0]['bubble_status'])
			if(req.incoming_test_key != ""){					
					var row = "@@id::@@pid::@@initial_type::@@ticketno::@@tdate::@@fname::@@mi::@@lname::@@email::@@phone::@@deptID::@@catID::@@amount::@@pid::@@status::@@asname::0::0::@@input_method::@@confirmation"
					row = replace_all_array(row, req.tickets[0])
					html = row				
			} else {		
				//req.tickets[0]['locked'] = '';
				var row = replace_all_array(_ticket_tr, req.tickets[0])
				
				row = replace_all_array(row, {
					bubble: bubble,
					status: req.ticket_update_status,
					prop: req.propid
					})
				html = "tr::::ticket-trow-"+req.tickets[0]['id']+"::::"+row
				if(req.query.next == "next"){
					html = html + "::::" + add_ticket_form(STATUS_SUBMITTED, req.propid)
				}
				html = html.replace(/(\r\n|\n|\r)/gm,"")
			}		
			io.emit('working-'+req.userid+'-edit-ticket','Ticket updated.')
			var data = {
				id: req.tickets[0]['id'], 
				userid: req.userid, 
				oldstatus: req.ticket_old_status, 
				status: req.ticket_update_status,
				html: html
			}
			//console.log(data)
			io.emit('ticket-edit-accept-'+req.query.prop, data)
		} else {
			io.emit('working-'+req.userid+'-edit-ticket','An error occurred.  Invalid ticket length.')
		}
	} else {
		var ers = req.errors.join(", ")
		html = "alert::::"+ers
		io.emit('working-'+req.userid+'-edit-ticket','An error occurred. ' +ers)
	}
	
	/*
		if {$next eq "return"} {
			set res "tr::::ticket-trow-${id}::::[ticket_tr_td $status $id $pid $initial_type $ticketno $tdate $fname $mi $lname $email $phone $deptID $catID $amount $asname $lockedby $expires $input_method $cancellation]"
		}
	*/
	res.write(html)
	
	res.end();	
});


function middleHandler_db_closed_ticket_reopen(req, res, next) {
	//console.log("  middleHandler_db_closed_ticket_reopen "+req.query.id);		
	if(req.userid > 0 && req.query.id > 0){
		db.run("UPDATE tickets SET status = "+STATUS_REOPENED+" WHERE autoID = "+req.query.id+" AND status = "+STATUS_APPROVED, function() {				
			next();
		});
	} else { 
		next(); 
	}
}

const _sql_db_common_reopened_comment = (function () {/*  
	insert into ticket_status VALUES(NULL, 
	(SELECT pid FROM tickets WHERE autoID = @@id), 
	@@userid, 
	(SELECT ticketno FROM tickets WHERE autoID = @@id),
	@@status, '@@sdate', 'Re-opened', '@@nick')
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_closed_ticket_comment(req, res, next) {
	//console.log("  middleHandler_db_closed_ticket_comment "+req.query.id);		
	if(req.userid > 0 && req.query.id > 0){
		var dt = new Date();
		var sql = replace_all_array(_sql_db_common_reopened_comment, {
			id: req.query.id,
			userid: req.userid,
			sdate: dt.toISOString(),
			nick: req.user_nick,
			status: STATUS_REOPENED
		})
		db.run(sql, function() {				
			next();
		});
	} else { 
		next(); 
	}
}

restapi.get('/closed-ticket-reopen',
	middleHandler_cookie_check,
	middleHandler_db_closed_ticket_reopen,
	middleHandler_db_closed_ticket_comment,
	function(req,res){
	//console.log('/closed-ticket-reopen');
	
	res.end();	
});



//todo edtk_timeout probably not being setup correctly as in edit-ticket
restapi.get('/closed-ticket-cancel',
	middleHandler_cookie_check,
	middleHandler_db_edit_ticket_cancel,	
	function(req,res){
	//console.log('/closed-ticket-cancel');
	res.end();	
});


const _sql_tickets = (function () {/*  	
	SELECT 
	properties.pname as pname,
	tickets.autoID, tickets.ticketno as ticketno, tdate, tickets.fname as tfname, tickets.mi as tmi, tickets.lname as tlname, tickets.email as temail, tickets.phone as tphone, 
	deptID, catID, amount, first_assignmentID, initial_type, input_method, cancellation as confirmation,
		departments.name as dept_name,
		inquiries.name as cat_name,
		ticket_locking.lockedby, 
		ticket_locking.expires, 
		ticket_locking.nick,
		users.fname as ufname,
		users.lname as ulname,
		(SELECT 
		    count(ticket_docs.autoID) as cnt 
		    FROM ticket_docs
		    WHERE tickets.autoID = ticket_docs.ticketid
		    AND deleted = 0
		    ) as cnt,
		group_concat(ticket_status.status, ',')  as bubble_status
	FROM tickets 
	INNER JOIN properties ON tickets.pid = properties.autoID
	LEFT OUTER JOIN departments ON tickets.deptID = departments.autoID
	LEFT OUTER JOIN inquiries ON tickets.catID = inquiries.autoID	
	LEFT OUTER JOIN ticket_locking ON tickets.autoID = ticket_locking.ticketID
	LEFT OUTER JOIN users ON tickets.first_assignmentID = users.autoID
	LEFT OUTER JOIN ticket_status ON tickets.ticketno = ticket_status.ticketno AND tickets.pid = ticket_status.pid
	WHERE tickets.pid = @@pid AND @@statsql
	GROUP BY tickets.autoID
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_get_tickets(req, res, next) {
	if(_debug){
		console.log("  middleHandler_db_get_tickets "+req.propid);	
	}
	
	if(req.userid > 0){
		if(req.shared_ticket_id == 0) {
			var statsql = "tickets.status = " + req.query.status; 
			if(req.query.status == STATUS_SUBMITTED){
				statsql = "(tickets.status = "+STATUS_SUBMITTED+" OR tickets.status = "+STATUS_CATEGORIZED+")"
			}			
		} else {
			req.propid = req.query.prop
			statsql = "tickets.autoID = "+req.query.id
		}
		req.tickets = [];
		var sql = _sql_tickets.replace('@@pid', req.propid);
		sql = sql.replace('@@statsql', statsql);		
		if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {
			var val = {id: row.autoID, 
			ticketno: row.ticketno, 
			tdate: row.tdate, 
			isodate: function(){
				var dt = new Date(row.tdate);
				return dt.toISOString()},
			fname: row.tfname, 
			mi: row.tmi, 
			lname: row.tlname, 
			email: row.temail, 
			phone: row.tphone, 
			deptID: row.deptID, 
			catID: row.catID, 
			bubble_status: row.bubble_status,
			amount: todollar(row.amount), 
			asname: function(){
				var rs = '';
				if(row.ufname!=null){rs=row.ufname+' '}
				if(row.ulname!=null){rs=rs+row.ulname}
				return rs},			
			dept_name: row.dept_name, 
			cat_name: row.cat_name, 
			file: function(){
				if(row.cnt>1){
					return "<span id='ticket-file-"+req.query.status+"-"+row.autoID+"' class='fa fa-files-o' style='float:right;'></span>"
				}else if(row.cnt==1){
					return "<span id='ticket-file-"+req.query.status+"-"+row.autoID+"' class='fa fa-file-o' style='float:right;'></span>"
				}else{
					return ""
				}}, 
			lockedby: row.lockedby,
			locked: function(){if(row.lockedby==null){return ""}else{return "<span style='float:right;padding-top:2px;' class='fa fa-edit'></span>"}},
			expires: row.expires, 
			initial_type: row.initial_type,
			initial_desc_type: function(){return _initial_types[row.initial_type]}, 
			input_method: row.input_method,
			input_desc_method: function(){return _input_methods[row.input_method]},
			confirmation: row.confirmation,
			nick: row.nick,
			first_assignmentID: row.first_assignmentID,
			pname: row.pname} 
			req.tickets.push(val)		
		}, function () {
			next();
		});	
	} else {
		next();
	}
}

const _sql_ticket_count = (function () {/*  	
	SELECT count(*) as ct0,
		(SELECT count(*) FROM tickets WHERE pid = @@pid AND status = @@STATUS_PENDING) as ct1,
		(SELECT count(*) FROM tickets WHERE pid = @@pid AND status = @@STATUS_WAITING) as ct2,
		(SELECT count(*) FROM tickets WHERE pid = @@pid AND status = @@STATUS_REOPENED) as ct9
	FROM tickets 
	WHERE pid = @@pid AND (status = @@STATUS_SUBMITTED OR status = @@STATUS_CATEGORIZED)	
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_get_ticket_count(req, res, next) {
	//console.log("  middleHandler_db_get_ticket_count");	
	if(req.userid > 0){
		req.ticketcounts = [];
		var sql = replace_all(_sql_ticket_count, '@@pid', req.propid);
		sql = sql.replace('@@STATUS_SUBMITTED', STATUS_SUBMITTED);
		sql = sql.replace('@@STATUS_CATEGORIZED', STATUS_CATEGORIZED);
		sql = sql.replace('@@STATUS_PENDING', STATUS_PENDING);
		sql = sql.replace('@@STATUS_WAITING', STATUS_WAITING);
		sql = sql.replace('@@STATUS_REOPENED', STATUS_REOPENED);		
		db.each(sql, function(err, row) {
			var val = {ct0: row.ct0, ct1: row.ct1, ct2: row.ct2, ct9: row.ct9}
			req.ticketcounts.push(val)		
		}, function () {
			next();
		});	
	} else {
		next();
	}
}

restapi.get('/ticketct',
	middleHandler_cookie_check,
	middleHandler_db_check_user_supplied_property,
	middleHandler_db_get_ticket_count,
	function(req,res){
	var bit = STATUS_SUBMITTED+":"+req.ticketcounts[0]['ct0']+"::"+STATUS_PENDING+":"+req.ticketcounts[0]['ct1']+"::"+STATUS_WAITING+":"+req.ticketcounts[0]['ct2']+"::"+STATUS_REOPENED+":"+req.ticketcounts[0]['ct9']
	res.write(bit)
	res.end();	
	
})

const _oops = (function () {/*  	
<div style='padding:10px;'>Oops!  There was a problem with your account.  Please <div style='display:inline; text-decoration:underline;cursor:pointer' onclick='page("/support?");'>contact support</div></div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];




restapi.get('/tickets',
	middleHandler_cookie_check,
	middleHandler_db_check_user_supplied_property, 
	middleHandler_db_get_tickets,
	
	function(req,res){
	//console.log('/tickets status='+req.query.status+' prop='+req.query.prop);
	//console.log(req.query)
	res.cookie("rbpx-r",req.query.prop, { signed: false });		
	//console.log('testing ' + req.incoming_test_cnt)
	
	
	var rows = '';
	var scriptlist = []
	if(req.tickets){
		for(var x=0;x<req.tickets.length;x++){
			var bubble = comment_bubble(req.tickets[x]['bubble_status'])
			if(req.incoming_test_key != "" && req.incoming_test_cnt > 0) {
				scriptlist.push(req.tickets[x]['id']+":"+req.tickets[x]['ticketno'])		
			} else {
				var row = replace_all_array(_ticket_tr, req.tickets[x])
				row = replace_all_array(row, {status: req.query.status, prop: req.propid, bubble: bubble})
				rows+=row;			
			}		
		}
		
		if(req.incoming_test_key != "" && req.incoming_test_cnt > 0) {
			var bit = scriptlist.join(";")
		} else {
			var bit = _tickets_table;
			var bottombuttons = '';
			if(req.query.status==STATUS_SUBMITTED){
				bottombuttons = replace_all_array(_bottom_button, {status: req.query.status, prop: req.propid});
			}
			bottombuttons+=_bottom_search;
			
			var pages = ppages(req.tickets.length, _ticket_pages, '@@count')
			bit = bit.replace('@@table_rows', rows);
			bit = bit.replace('@@pages', pages);
			bit = bit.replace('@@bottombuttons', bottombuttons);
			var linksite_button = _linksite_button.replace('@@linksite', req.prop_linksite)
			//todo before production
			linksite_button = linksite_button.replace('http://guest.rbpsoftwaresolutions.com', env.server)
			bit = bit.replace('@@linkpropbutton', linksite_button)
			bit = replace_all(bit, '@@status', req.query.status)	
		}
	} else {
		bit = _oops
	}
	
	res.write(bit)
	res.end();

});


const _sql_reports_pre_inquiry_types = (function () {/*  	
SELECT autoID, name FROM inquiries
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _sql_db_ticket_inquiry_types = (function () {/*  	
SELECT inquiries.autoID as inquiryID, name as inquiryname, sub_desc
	FROM inquiry_properties 
	INNER JOIN inquiries ON inqid = inquiries.autoID 
	WHERE pid = @@pid AND name != ''
	ORDER BY name
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _sql_db_ticket_assignables = (function () {/*  	
SELECT users.autoID as asid, fname as afname, mi as ami, lname as alname 
	FROM users INNER JOIN user_properties ON users.autoID = user_properties.userID 
	WHERE user_properties.propertyID = @@pid
	AND excludeassign = 0	
*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _sql_db_ticket_departments = (function () {/*  	
SELECT deptid as departmentID, name as deptname ,
    (SELECT count(*) as cnt FROM department_users 
        WHERE deptid = department_users.departmentID AND department_users.pid = department_properties.pid
        ) as cnt
	FROM department_properties 
	INNER JOIN departments ON deptid = departments.autoID 
	LEFT OUTER JOIN department_users ON deptid = department_users.departmentID AND department_users.pid = department_properties.pid
	WHERE department_properties.pid = @@pid AND name != '' 
	GROUP BY deptid
	ORDER BY name
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _sql_reports_pre_date_submitted = (function () {/*  	
SELECT min(autoID) as start, max(autoID) as end FROM tickets ORDER BY unix_date_submitted
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _sql_reports_pre_associates = (function () {/*  	
SELECT autoID, fname, mi, lname FROM users
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _sql_reports_pre_departments = (function () {/*  	
SELECT autoID, name FROM departments
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_reports_pre_inquiry_types(req, res, next) {
	//console.log("  middleHandler_db_reports_pre_inquiry_types");	
	req.report_categories = [];
	if(req.query.r == 0 && req.userid > 0){
		
		req.report_categories.push(
		{id: 0, name: '', total_count: 0,
			STATUS_SUBMITTED: 0,
			STATUS_CATEGORIZED: 0,
			STATUSX_SUBMITTED_STATUSX_CATEGORIZED: 0,
			STATUS_PENDING: 0,
			STATUS_WAITING: 0,
			STATUS_REOPENED: 0,
			STATUS_APPROVED: 0,
			total_amount: 0,
			average_amount: 0})	
		var sql = '';
		if(req.query.o == 0) {sql = _sql_reports_pre_inquiry_types}
		if(req.query.o == 2 || req.query.o == 4) {sql = _sql_reports_pre_date_submitted}
		if(req.query.o == 6) {sql = _sql_reports_pre_associates}
		if(req.query.o == 8) {sql = _sql_reports_pre_departments}
		
		db.each(sql, function(err, row) {
			if(req.query.o == 0 || req.query.o == 8) {var id = row.autoID; var name = row.name}
			if(req.query.o == 2 || req.query.o == 4) {var id = 0; var name = "nothing"}
			if(req.query.o == 6) {var id = row.autoID; var name = row.fname + ' ' + row.mi + ' ' + row.lname}
			var val = {id: id, name: name, total_count: 0,
			STATUS_SUBMITTED: 0,
			STATUS_CATEGORIZED: 0,
			STATUSX_SUBMITTED_STATUSX_CATEGORIZED: 0,
			STATUS_PENDING: 0,
			STATUS_WAITING: 0,
			STATUS_REOPENED: 0,
			STATUS_APPROVED: 0,
			total_amount: 0,
			average_amount: 0}
			req.report_categories.push(val)
		}, function () {
			next();
		});	
	} else {
		next();
	}
}

const _sql_reports_inquiry_types = (function () {/*  	
	SELECT catID, inquiries.name as cname, status, count(*) as cnt, sum(amount) as sum    
	FROM tickets
	LEFT OUTER JOIN inquiries ON catID = inquiries.autoID
	@@sqlor
	GROUP BY catID, status
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _sql_reports_date_submitted = (function () {/*  		
	select count(*) as cnt, year_submitted as year, month_submitted as month, day_submitted as day, status, sum(amount) as sum    
	from tickets 
	@@sqlor
	GROUP BY status, year_submitted, month_submitted, day_submitted
	ORDER BY year_submitted, month_submitted, day_submitted
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _sql_reports_date_closed = (function () {/*  		
	select count(*) as cnt, year_closed as year, month_closed as month, day_closed as day, status, sum(amount) as sum    
	from tickets 
	@@sqlor
	GROUP BY status, year_closed, month_closed, day_closed
	ORDER BY year_closed, month_closed, day_closed
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _sql_reports_associate = (function () {/*  		
	SELECT first_assignmentID, users.fname, users.lname, status, count(*) as cnt, sum(amount) as sum    
	FROM tickets
	LEFT OUTER JOIN users ON first_assignmentID = users.autoID
	@@sqlor
	GROUP BY first_assignmentID, status
	ORDER BY first_assignmentID
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _sql_reports_departments = (function () {/*  	
	SELECT deptID, departments.name as cname, status, count(*) as cnt, sum(amount) as sum    
	FROM tickets
	LEFT OUTER JOIN departments ON deptID = departments.autoID
	@@sqlor
	GROUP BY deptID, status
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function middleHandler_db_reports_date_cookies(req, res, next) {
	//console.log("  middleHandler_db_reports_date_cookies "+req.query.f+" "+req.query.t);		
	req.reports_date_range_used = false
	if(req.userid > 0){
		req.user_sqlor_for_tickets_submitted = ""
		req.user_sqlor_for_tickets_closed = ""
		if(req.query.f != '' && req.query.t != '') {
			var dtf = new Date(req.query.f);
			var dtt = new Date(req.query.t);
			dtt.setDate(dtt.getDate() + 1);
			//row = row.replace('@@isodate', dt.toISOString())
			//console.log(dtf.toISOString())
			//console.log(dtt.toISOString())
			var mdtf = new Date(dtf.toISOString())
			var mdtt = new Date(dtt.toISOString())
			var f = mdtf.getTime(); if(f>0){f=f/1000}
			var t = mdtt.getTime(); if(t>0){t=t/1000}
			req.user_sqlor_for_tickets_submitted = " AND unix_date_submitted >= "+ f + " AND unix_date_submitted <= "+t + " "
			req.user_sqlor_for_tickets_closed = " AND unix_date_closed >= "+ f + " AND unix_date_closed <= "+t + " "
			res.cookie("rbpx-f",req.query.f, { signed: false });
			res.cookie("rbpx-t",req.query.t, { signed: false });
			req.reports_date_range_used = true
		} else {			
			res.cookie("rbpx-f",'', { signed: false });
			res.cookie("rbpx-t",'', { signed: false });			
		}
	}
	next();
}

function middleHandler_db_reports_inquiry_types(req, res, next) {
	//console.log("  middleHandler_db_reports_inquiry_types "+req.query.o);	
	if(req.query.r == 0 && req.userid > 0){
		var sql = '';
		var sqlor = req.user_sqlor_for_tickets
		
		if(req.query.o == 0){sql = _sql_reports_inquiry_types; 
			if(req.user_sqlor_for_tickets_submitted != ""){sqlor = sqlor + req.user_sqlor_for_tickets_submitted}}
		if(req.query.o == 2){sql = _sql_reports_date_submitted;
			if(req.user_sqlor_for_tickets_submitted != ""){sqlor = sqlor + req.user_sqlor_for_tickets_submitted}}
		if(req.query.o == 4){sql = _sql_reports_date_closed;
			if(req.user_sqlor_for_tickets_closed != ""){sqlor = sqlor + req.user_sqlor_for_tickets_closed}}
		if(req.query.o == 6){sql = _sql_reports_associate;
			if(req.user_sqlor_for_tickets_submitted != ""){sqlor = sqlor + req.user_sqlor_for_tickets_submitted}}
		if(req.query.o == 8){sql = _sql_reports_departments;
			if(req.user_sqlor_for_tickets_submitted != ""){sqlor = sqlor + req.user_sqlor_for_tickets_submitted}}
		
		sql = sql.replace('@@sqlor', sqlor);
		db.each(sql, function(err, row) {	
			if(req.query.o == 0){var id = find_id(req.report_categories, row.catID)}
			if(req.query.o == 6){var id = find_id(req.report_categories, row.first_assignmentID);}
			if(req.query.o == 8){var id = find_id(req.report_categories, row.deptID);}
			if(req.query.o == 2 || req.query.o == 4){
				var id = req.report_categories.length;
				var name = row.month+'/'+row.day+'/'+row.year
				if(name == '0/0/0'){name = 'Not Closed'}
				var val = {id: id, name: name, total_count: 0, STATUS_SUBMITTED: 0, STATUS_CATEGORIZED: 0, STATUSX_SUBMITTED_STATUSX_CATEGORIZED: 0, STATUS_PENDING: 0, STATUS_WAITING: 0, STATUS_REOPENED: 0, STATUS_APPROVED: 0, total_amount: 0, average_amount: 0}
				var found = false;
				for(var x=0;x<req.report_categories.length;x++){
					if(req.report_categories[x]['name']==name){
						id = x;
						found = true; break;
					}
				}
				if(!found){
					req.report_categories.push(val);
				}
			}
			var val = {id: id, cntTotal: row.cnt}
			req.report_categories[id]['total_count']+=row.cnt;
			req.report_categories[id]['total_amount']+=row.sum;
			if(row.status == STATUS_SUBMITTED || row.status == STATUS_CATEGORIZED){	req.report_categories[id]['STATUSX_SUBMITTED_STATUSX_CATEGORIZED']+=row.cnt;}			
			//if(row.status == STATUS_SUBMITTED){		req.report_categories[id]['STATUS_SUBMITTED']+=row.cnt;}
			//if(row.status == STATUS_CATEGORIZED){	req.report_categories[id]['STATUS_CATEGORIZED']+=row.cnt;}
			if(row.status == STATUS_PENDING){		req.report_categories[id]['STATUS_PENDING']+=row.cnt;}
			if(row.status == STATUS_WAITING){		req.report_categories[id]['STATUS_WAITING']+=row.cnt;}
			if(row.status == STATUS_REOPENED){		req.report_categories[id]['STATUS_REOPENED']+=row.cnt;}
			if(row.status == STATUS_APPROVED){		req.report_categories[id]['STATUS_APPROVED']+=row.cnt;}		
		}, function () {
			next();
		});	
	} else {
		next();
	}
}



const _sql_reports_closed_qc_tickets = (function () {/*  		
	select count(*) as filecount FROM tickets @@sqlor AND status = @@STATUS_APPROVED        
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function middleHandler_db_reports_closed_qc_tickets(req, res, next) {
	if(_debug){console.log("  middleHandler_db_reports_closed_qc_tickets "+req.query.o);}
	req.closed_qc_tickets = []
	if(req.query.r == 1 && req.userid > 0){
		var sql = _sql_reports_closed_qc_tickets.replace('@@STATUS_APPROVED',STATUS_APPROVED) ;
		var sqlor = req.user_sqlor_for_tickets
		if(req.query.b == "submitted"){
			if(req.user_sqlor_for_tickets_submitted != ""){sqlor = sqlor + req.user_sqlor_for_tickets_submitted}}
		if(req.query.b == "closed"){
			if(req.user_sqlor_for_tickets_closed != ""){sqlor = sqlor + req.user_sqlor_for_tickets_closed}}			
		sql = sql.replace('@@sqlor', sqlor);
		if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {			
			req.closed_qc_tickets.push(row);
		}, function () {
			next();
		});	
	} else {
		next();
	}
}


const _sql_reports_closed_tickets = (function () {/*  		
	select tickets.autoID as id, ticketno, tdate, pid,
      (SELECT count(*) 
          FROM ticket_docs 
          WHERE ticket_docs.ticketid = tickets.autoID
          AND deleted = 0) as filecount,

		amount, pname, month_submitted, day_submitted,
        year_submitted, month_closed, day_closed, year_closed, tickets.fname as tfname,
        tickets.lname as tlname, users.fname as afname, users.lname as alname
        FROM tickets
        INNER JOIN properties on pid = properties.autoID
        INNER JOIN users on first_assignmentID = users.autoID
        LEFT OUTER JOIN ticket_docs ON ticket_docs.ticketid = tickets.autoID
        @@sqlor AND status = @@STATUS_APPROVED
        GROUP BY tickets.autoID	LIMIT 2500
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function middleHandler_db_reports_closed_tickets(req, res, next) {
	if(_debug){console.log("  middleHandler_db_reports_closed_tickets "+req.query.o);}
	if(req.query.r == 1 && req.userid > 0){
		if(req.closed_qc_tickets.length==1){
			if(req.query.r == 1 && req.userid > 0 && 
				(req.closed_qc_tickets[0]['filecount'] < 501 || req.query.x == 1)
				){
				req.closed_tickets = []
				var sql = _sql_reports_closed_tickets.replace('@@STATUS_APPROVED',STATUS_APPROVED) ;
				var sqlor = req.user_sqlor_for_tickets
				if(req.query.b == "submitted"){
					if(req.user_sqlor_for_tickets_submitted != ""){sqlor = sqlor + req.user_sqlor_for_tickets_submitted}}
				if(req.query.b == "closed"){
					if(req.user_sqlor_for_tickets_closed != ""){sqlor = sqlor + req.user_sqlor_for_tickets_closed}}			
				sql = sql.replace('@@sqlor', sqlor);
				if(_debug){console.log(sql)}
				db.each(sql, function(err, row) {			
					req.closed_tickets.push(row);
				}, function () {
					next();
				});				
			} else {
				next();		
			}
		} else {
			next();
		}
	} else {
		next();
	}
}

restapi.get('/reports', 
	middleHandler_cookie_check,	
	middleHandler_db_reports_date_cookies,
	middleHandler_db_get_user_properties,
	middleHandler_db_reports_closed_qc_tickets,
	middleHandler_db_reports_pre_inquiry_types,
	middleHandler_db_reports_inquiry_types,
	middleHandler_db_reports_closed_tickets,
	
	function(req,res){		
	if(_debug){
		console.log("/reports");
		console.log(req.query.x);
		console.log(req.closed_qc_tickets);
		console.log(req.user_sqlor_for_tickets_submitted)
		console.log(req.user_sqlor_for_tickets_closed)
		console.log(req.user_sqlor_for_tickets)
		console.log(req.user_properties);
		console.log(req.report_categories);
	}
	var bit = '';
	var cntTotalTotal = 0;
	var cntTotalSubmittedAndCategorized = 0
	var cntTotalPending = 0
	var cntTotalWaiting = 0
	var cntTotalReopened = 0
	var cntTotalApproved = 0
	var sumTotalTotal = 0
	var sumTotalAverage = 0
	
	if(_debug){
		console.log('query.r = '+req.query.r)
		console.log(req.closed_qc_tickets);
	}
	
	if(req.userid > 0){
		if(req.query.r == 0){	
			var stat_row = _status_report_row.trim();
			for (var x=0;x<req.report_categories.length;x++){
				if(req.report_categories[x]['total_count']>0){
					var row = stat_row
					row = row.replace('@@average_amount', average(req.report_categories[x]['total_amount'],req.report_categories[x]['total_count']))
					row = row.replace('@@total_amount', todollar(req.report_categories[x]['total_amount']))
					row = replace_all_array(row, req.report_categories[x]); //what's left
					
					cntTotalTotal += req.report_categories[x]['total_count']			
					cntTotalSubmittedAndCategorized += req.report_categories[x]['STATUS_SUBMITTED'] + req.report_categories[x]['STATUS_CATEGORIZED']
					cntTotalPending += req.report_categories[x]['STATUS_PENDING']
					cntTotalWaiting += req.report_categories[x]['STATUS_WAITING']
					cntTotalReopened += req.report_categories[x]['STATUS_REOPENED']
					cntTotalApproved += req.report_categories[x]['STATUS_APPROVED']
					sumTotalTotal += req.report_categories[x]['total_amount']
					bit = bit + row + '::::'
				}
			}
			var footer = _status_report_footer;
			footer = footer.replace('@@cntTotalTotal', cntTotalTotal)
			footer = footer.replace('@@cntTotalSubmittedAndCategorized', cntTotalSubmittedAndCategorized);
			footer = footer.replace('@@cntTotalPending', cntTotalPending);
			footer = footer.replace('@@cntTotalWaiting', cntTotalWaiting)
			footer = footer.replace('@@cntTotalReopened', cntTotalReopened)
			footer = footer.replace('@@cntTotalApproved', cntTotalApproved)
			footer = footer.replace('@@sumTotalTotal', todollar(sumTotalTotal))
			footer = footer.replace('@@sumTotalAverage', average(sumTotalTotal,cntTotalTotal))
			var pages = ppages(req.report_categories.length, _status_report_pages, '@@count')
			footer = footer.replace('@@pages', pages);
			bit = bit + footer;
		}
				
		
		
		if(req.query.r == 1 && req.closed_qc_tickets.length==1){
			if(req.closed_qc_tickets[0]['filecount'] < 501 || req.query.x==1){	
				var closed_row = _closed_tickets_row.trim();
				if(req.closed_tickets.length>500 && parseInt(req.query.x) != 1){
					var lnk = '/reports?r=1&o='+req.query.o+'&f='+req.query.f+'&t='+req.query.t+'&b='+req.query.b+'&x=1'
					bit = _closed_tickets_toomany.trim()
					bit = bit.replace('@@toolink', lnk)
					bit = bit.replace('@@count', req.closed_tickets.length)
					bit = bit + '::::'
				} else {
					if(req.closed_tickets.length == 0) {
						if(req.reports_date_range_used){
							bit = _tickets_none_date.trim() + '::::'
						} else {
							bit = _tickets_none_nodate.trim() + '::::'
						}
					} else {
						for (var x=0;x<req.closed_tickets.length;x++){
							var row = closed_row.replace('@@amount', todollar(req.closed_tickets[x]['amount']))
							var row = replace_all_array(row, req.closed_tickets[x])
							var fc = parseInt(req.closed_tickets[x]['filecount'])
							var files_icon = ''
							if(fc==1){files_icon = "<span class='fa fa-file-o' style='float:right;'></span>"}
							if(fc>1){files_icon = "<span class='fa fa-files-o' style='float:right;'></span>"}
							row = row.replace('@@files_icon', files_icon)
							
							var dt = new Date(req.closed_tickets[x]['tdate']);
							row = row.replace('@@isodate', dt.toISOString())
							
							bit = bit + row + '::::'
						}
					}
				}
				var footer = _closed_report_footer;
				var pages = ppages(req.closed_tickets.length, _ticket_pages, '@@count')
				footer = footer.replace('@@pages', pages);
				bit = bit + footer;
			} else {
				var lnk = '/reports?r=1&o='+req.query.o+'&f='+req.query.f+'&t='+req.query.t+'&b='+req.query.b+'&x=1'
				bit = _closed_tickets_toomany.trim()
				bit = bit.replace('@@toolink', lnk)
				bit = bit.replace('@@count', req.closed_qc_tickets[0]['filecount'])
				bit = bit + '::::'
			}
		}
	}
	res.write(bit);
	if(_debug){console.log('reports done')}
	res.end();
})

const _sql_shared_get_users = (function () {/*  	
SELECT users.autoID AS id,
       ( 
           SELECT group_concat( user_properties.propertyid, ',' )
             FROM user_properties
            WHERE user_properties.userid = users.autoID 
       ) 
       AS property_ids,
       ( 
           SELECT group_concat( properties.pname, ',' )
             FROM user_properties
             INNER JOIN properties ON user_properties.propertyid = properties.autoID 
             WHERE user_properties.userid = users.autoID
       ) 
       AS property_names,
       (
           SELECT user_authority.authority FROM user_authority
           WHERE user_authority.userid = users.autoID
       ) AS authority,
       (
           SELECT authorities.name FROM authorities 
           INNER JOIN user_authority ON user_authority.userID = users.autoID
           WHERE authorities.autoID = user_authority.authority
       ) AS authname,
       (
           SELECT authorities.deflimit FROM authorities 
           INNER JOIN user_authority ON user_authority.userID = users.autoID
           WHERE authorities.autoID = user_authority.authority
       ) AS deflimit,
       ( 
           SELECT group_concat( notification, ', ' )
             FROM user_notification
            WHERE user_notification.userID = users.autoID 
       ) 
       AS notifications,
	   fname,
       mi,
       lname,
       users.email AS email,
       users.phone AS phone,
       position,
       credit,
       groupcount,
       excludeassign,
       superadmin
  FROM users
	
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function shared_userrow(row){
	var limit = todollar(row.credit)
	var pmore = "";
	if(row.groupcount == 0) {pmore = "<td>"+_user_positions[row.position]+"</td>"}
	var tmore = ""
	if(row.groupcount > 0) {tmore = "<td>groupcount</td>"}
	var notif = ''	
	if(row.notifications){
		var reslist = []
		var notiflist = row.notifications.split(', ')
		for(var x=0;x<notiflist.length;x++){
			var found = false; //eliminate sql duplicates
			for(var y=0;y<reslist.length;y++){
				if(_user_notifications[notiflist[x]]==reslist[y]){found = true}
			}
			if(!found){reslist.push(_user_notifications[notiflist[x]])}
		}
		notif = reslist.join(', ')
	}	
	var val = {
		id: row.id, 
		fname: row.fname, 
		mi: row.mi, 
		lname: row.lname, 
		name: row.fname+' '+row.mi+' '+row.lname, 
		email: row.email, 
		phone: row.phone,
		auth: row.authname,
		authority: row.authority,
		excludeassign: row.excludeassign,
		limit: limit,
		property_ids: row.property_ids,
		property_names: row.property_names,
		pmore: pmore,				
		tmore: tmore,
		notif: notif,
		notifications: row.notifications,
		groupcount: row.groupcount
		}	
	return val
}
function middleHandler_db_admin_users(req, res, next) {
	//console.log("  middleHandler_db_admin_users ");	
	req.admin_users = [];
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = '';
		if(req.query.a == 0 || req.query.a == 1){
			var sql_shared_get_users = _sql_shared_get_users+" WHERE users.deleted = 0 AND @@groups AND (@@sqlor) GROUP BY users.autoID"
			if(req.user_superadmin==1){
				sql = sql_shared_get_users.replace('@@sqlor','users.autoID > 0')
			}else if(req.user_admin==1){
				if(req.user_properties.length>0){
					var sqlorlist = []
					for(var x=0;x<req.user_properties.length;x++){
						sqlorlist.push('propertyID = '+req.user_properties[x]['id'])
					}
					sql = sql_shared_get_users.replace('@@sqlor',sqlorlist.join(' OR '))
				}
			}
			if(req.query.a == 0){sql = sql.replace('@@groups', 'groupcount = 0')}
			if(req.query.a == 1){sql = sql.replace('@@groups', 'groupcount > 0')}			
			if(_debug){console.log(sql)}
			db.each(sql, function(err, row) {								
					req.admin_users.push(shared_userrow(row));
			}, function () {
				next();
			});	
		} else {
			next();
		}
	} else {
		next();
	}
}

const _sql_superadmin_properties = (function () {/*  
SELECT autoID as id, hid, pname, email, phone, fax, city, state, zip FROM properties
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _sql_admin_properties = (function () {/*  
SELECT properties.autoID as id, hid, pname, email, phone, fax, city, state, zip
	FROM user_properties
        INNER JOIN properties ON user_properties.propertyID = properties.autoID        
	WHERE (@@sqlor) GROUP BY properties.autoID
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_admin_properties(req, res, next) {
	//console.log("  middleHandler_db_admin_properties ");	
	req.admin_properties = [];
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = '';
		if(req.query.a == 2){
			if(req.user_superadmin==1){
				sql = _sql_superadmin_properties
			}else if(req.user_admin==1){
				if(req.user_properties.length>0){
					var sqlorlist = []
					for(var x=0;x<req.user_properties.length;x++){
						sqlorlist.push('propertyID = '+req.user_properties[x]['id'])
					}
					sql = _sql_admin_properties.replace('@@sqlor',sqlorlist.join(' OR '))
				}
			}
			db.each(sql, function(err, row) {			
				var val = {
					id: row.id,
					hid: row.hid,
					pname: row.pname,
					email: row.email,
					phone: row.phone,
					fax: row.fax,
					city: row.city,
					state: row.state,
					zip: row.zip
					}				
					req.admin_properties.push(val);
			}, function () {
				next();
			});	
		} else {
			next();
		}
	} else {
		next();
	}
}

const _sql_admin_departments = (function () {/*  
	SELECT departments.autoID as id, name,
	group_concat(department_properties.pid, ',') as props,
	group_concat(department_properties.notifications, ',') as notifications,
	(SELECT count(*)
			FROM department_users
			INNER JOIN users ON department_users.userID = users.autoID
			WHERE department_users.departmentID = departments.autoID
		)
		AS associates 
	FROM departments
	INNER JOIN department_properties ON departments.autoID = department_properties.deptid
	GROUP BY departments.autoID
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_admin_departments(req, res, next) {
	//console.log("  middleHandler_db_admin_departments ");	
	req.admin_departments = [];
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = '';
		if(req.query.a == 3){
			sql = _sql_admin_departments
			db.each(sql, function(err, row) {			
				var val = {
					id: row.id,
					name: row.name,
					props: row.props,
					notifications: row.notifications,
					associates: row.associates
					//ulist: function(){if(row.associates==null){return ''}else{return row.associates}}					
				}
			req.admin_departments.push(val);
			}, function () {
				next();
			});
		} else {
			next();
		}
	} else {
		next();
	}
}

const _sql_admin_inquiries = (function () {/*  
	SELECT inquiries.autoID as id, name,
	group_concat(inquiry_properties.pid, ',') as props,
	group_concat(inquiry_properties.sub_desc, ';;') as subs
	FROM inquiries
	LEFT OUTER JOIN inquiry_properties ON inquiries.autoID = inquiry_properties.inqid
	GROUP BY inquiries.autoID
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_admin_inquiries(req, res, next) {
	//leHandler_db_admin_inquiries ");	
	req.admin_inquiries = [];
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = '';
		if(req.query.a == 4){
			sql = _sql_admin_inquiries
			db.each(sql, function(err, row) {			
				var val = {
					id: row.id,
					name: row.name,
					props: row.props,
					subs: row.subs
				}
			req.admin_inquiries.push(val);
			}, function () {
				next();
			});
		} else {
			next();
		}
	} else {
		next();
	}
}

const _sql_admin_emailhistory = (function () {/*  
	SELECT email_history.autoID as id, pid, edate, count, tolist, fromlist, subject, body, response, 
    coalesce(''||fname,'') as fname, coalesce(''||lname,'') as lname, coalesce(''||pname,'') as pname 
    FROM email_history 
    LEFT JOIN users ON email_history.userID = users.autoID 
    LEFT JOIN properties ON email_history.pid = properties.autoID
	@@where LIMIT 500
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_admin_emailhistory(req, res, next) {
	//console.log("  middleHandler_db_admin_emailhistory ");	
	req.admin_emailhistory = [];
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = '';		
		if(req.query.a == 5){
			if(req.user_superadmin==1){
				sql = _sql_admin_emailhistory.replace('@@where','');
			}else if(req.user_admin==1){
				if(req.user_properties.length>0){
					var sqlorlist = []
					for(var x=0;x<req.user_properties.length;x++){
						sqlorlist.push('propertyID = '+req.user_properties[x]['id'])
					}
					sql = _sql_admin_emailhistory.replace('@@where','WHERE '+sqlorlist.join(' OR '))
				}
			}
			
			db.each(sql, function(err, row) {			
				var val = {
					id: row.id,
					name: row.name,
					prop: row.pname,
					user: row.fname + ' ' + row.lname,
					fromlist: row.fromlist,
					count: row.count,
					tolist: row.tolist,
					subject: row.subject,
					response: row.response,
					body: function(){return emailprep(row.body)}
				}
			req.admin_emailhistory.push(val);
			}, function () {
				next();
			});
		} else {
			next();
		}
	} else {
		next();
	}
}


const _associates_table_start = (function () {/*  
	<table id='associates-table' class='footable' data-page-navigation='.pagination' data-page-size='10'
								data-first-text='First Page'
								data-previous-text='Prev Page'
								data-next-text='Next Page'
								data-last-text='Last Page'>
				  <thead><tr>
					<th><div>Name</div></th>
					<th data-hide='phone'><div>Email</div></th>
					<th data-hide='phone'><div>Properties</div></th>
					<th><div>Properties</div></th>
					<th data-hide='phone'><div>Phone</div></th>
					<th data-hide='phone'><div>Position</div></th>
					<th data-hide='phone'><div>Authority</div></th>
					<th data-hide='phone,tablet'><div>Notifications</div></th>
					<th data-hide='phone,tablet' data-type='numeric'><div>Credit</div></th>							
					</tr></thead>
				  <tbody id='assoc.table'>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _associates_table_end = (function () {/*  
	</tbody>
				  <tfoot id='assoc.foot'><tr style='height:55px;'><td colspan='99'>
											
					<button class='addbutton' onclick='sdtn("associates-table");divup("/add-associate?","associate-add");' style='cursor:pointer;'>Add Associate</button>						  
					<input id='associates-filter' type='text' placeholder='Find (ctrl+shift+f)' style='max-width: 170px;display: inline;padding: 6px;'onkeyup='tfilter(&quot;associates-table&quot;, this);'>
					<button onclick='gebi(&quot;associates-filter&quot;).value = &quot;&quot;; tfilter(&quot;associates-table&quot;, gebi(&quot;associates-filter&quot;));'>Clear</button>
				  
					<div style='float:right;' class='pagination pagination-centered hide-if-no-paging'></div>
					</td></tr>
					</tfoot>
				</table>
				<div id='associate-add-edit-working' style='display:none;padding:50px;'>Working, please wait...</div>
				<div id='associate-edit' style='display:none;border:1px solid #ccc;'></div>
				<div id='associate-add' style='display:none;border:1px solid #ccc;'></div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _groups_table_start = (function () {/*  
	<table id='groups-table' class='footable' data-page-navigation='.pagination' data-page-size='10'
								data-first-text='First Page'
								data-previous-text='Prev Page'
								data-next-text='Next Page'
								data-last-text='Last Page'>
					  <thead><tr>
					  <th><div>Group Name</div></th>
						<th data-hide='phone'><div>Email</div></th>
						<th data-hide='phone'><div>Properties</div></th>
						<th><div>Properties</div></th>
						<th data-hide='phone'><div>Phone</div></th>
						<th data-hide='phone'><div>Authority</div></th>
						<th data-hide='phone'><div>Notifications</div></th>
						<th data-hide='phone,tablet' data-type='numeric'><div>Credit</div></th>
						<th data-hide='phone,tablet' data-type='numeric'><div>Logins</div></th>
						</tr></thead>
					  <tbody id='groups.table'>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _groups_table_end = (function () {/*  
	</tbody>
					  <tfoot id='groups.foot'><tr style='height:55px;'><td colspan='99'>
						<button class='addbutton' onclick='sdtn("groups-table");divup("/add-group?","group-add");' style='cursor:pointer;' >Add Group Login</button>
						<input id='groups-filter' type='text' placeholder='Find (ctrl+shift+f)' style='max-width: 170px;display: inline;padding: 6px;'onkeyup='tfilter(&quot;groups-table&quot;, this);'>
						<button onclick='gebi(&quot;groups-filter&quot;).value = &quot;&quot;; tfilter(&quot;groups-table&quot;, gebi(&quot;groups-filter&quot;));'>Clear</button>						  
						<div style='float:right;' class='pagination pagination-centered hide-if-no-paging'></div>
						</td></tr>
						</tfoot>
					</table>
					<div id='group-add-edit-working' style='display:none;padding:50px;'>Working, please wait...</div>
					<div id='group-edit' style='display:none;border:1px solid #ccc;'></div>
					<div id='group-add' style='display:none;border:1px solid #ccc;'></div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _properties_table_start = (function () {/*  
	<table id='properties-table' @@footable_attributes>
						<thead><tr>
							<th data-hide='phone'><div>CODE</div></th>
							<th><div>Name</div></th>
							<th data-hide='phone'><div>Email</div></th>
							<th data-hide='phone'><div>Phone</div></th>
							<th data-hide='phone'><div>Fax</div></th>
							<th><div>City</div></th>
							<th data-hide='phone'><div>State</div></th>
							<th data-hide='phone'><div>Zip</div></th>
							</tr></thead>
						<tbody id='prop.table'>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _add_property_button = (function () {/*  
	<button class='addbutton' id='addprbtn' onclick='sdtn("properties-table");divup("/add-property?","property-add");' 
		style='@@showprbtn cursor:pointer;' >Add Property</button>
		<div id='addprmsg' 
		style='@@showprmsg'><div>For new properties, please &nbsp;</div> <div style='text-decoration:underline;cursor:pointer' onclick='page("/support?");'>contact support</div></div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _properties_table_end = (function () {/*  
	</tbody>
						<tfoot id='prop.foot'>
							<tr>
								<td colspan='8'>
									@@add_property_option
									<input id='properties-filter' type='text' placeholder='Find (ctrl+shift+f)' style='max-width: 170px;display: inline;padding: 6px;'onkeyup='tfilter(&quot;properties-table&quot;, this);'>
									<button onclick='gebi(&quot;properties-filter&quot;).value = &quot;&quot;; tfilter(&quot;properties-table&quot;, gebi(&quot;properties-filter&quot;));'>Clear</button>						  								
									<div style='float:right;' class='pagination pagination-centered hide-if-no-paging'></div>
								</td>
							</tr>
						</tfoot>
					</table>
					<div id='property-edit' style='display:none;border:1px solid #ccc;'></div>
					<div id='property-add' style='display:none;border:1px solid #ccc;'></div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _departments_table_start = (function () {/*  
	<table id='departments-table' class='footable' data-page-navigation='.pagination' data-page-size='10'
								data-first-text='First Page'
								data-previous-text='Prev Page'
								data-next-text='Next Page'
								data-last-text='Last Page'>
						<thead>
						@@departments_table_head
						</thead>
						<tbody id='dept.table'>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _super_add_department_button = (function () {/*  
<button class='addbutton' id='adddpbtn' onclick='sdtn("departments-table");divup("/add-department?","department-add");' 
		style='@@showdpbtn cursor:pointer;' >Add Department</button>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
const _admin_add_department_button = (function () {/*  
<div id='adddpmsg'
		style='@@showdpmsg'
		><div>For new departments, please &nbsp;</div><div style='text-decoration:underline;cursor:pointer' onclick='page("/support?");'>contact support</div></div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

	
const _departments_table_end = (function () {/*  
	</tbody>
						<tfoot>
							<tr><td colspan=99>
							@@add_department_button
							<input id='departments-filter' type='text' placeholder='Find (ctrl+shift+f)' style='max-width: 170px;display: inline;padding: 6px;'onkeyup='tfilter(&quot;departments-table&quot;, this);'>
							<button onclick='gebi(&quot;departments-filter&quot;).value = &quot;&quot;; tfilter(&quot;departments-table&quot;, gebi(&quot;departments-filter&quot;));'>Clear</button>						  
							<div style='float:right;' class='pagination pagination-centered hide-if-no-paging'></div>									
							</td></tr>
						  </tfoot>
						</table>
						<div id='department-edit' style='display:none;border:1px solid #ccc;'></div>
						<div id='department-add' style='display:none;border:1px solid #ccc;'></div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _inquiries_table_start = (function () {/*  
	<table id='inquiries-table' class='footable' data-page-navigation='.pagination' data-page-size='10'
								data-first-text='First Page'
								data-previous-text='Prev Page'
								data-next-text='Next Page'
								data-last-text='Last Page'>
					<thead>
						@@inquiries_table_head
						</thead>
											  
					<tbody id='inq.table'>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _inquiries_table_end = (function () {/*  
	</tbody>
					<tfoot id='inquiry.table'>
					<tr><td colspan=99>
						@@add_inquiries_option
						<input id='inquiries-filter' type='text' placeholder='Find (ctrl+shift+f)' style='max-width: 170px;display: inline;padding: 6px;'onkeyup='tfilter(&quot;inquiries-table&quot;, this);'>
						<button onclick='gebi(&quot;inquiries-filter&quot;).value = &quot;&quot;; tfilter(&quot;inquiries-table&quot;, gebi(&quot;inquiries-filter&quot;));'>Clear</button>						  
						<div style='float:right;' class='pagination pagination-centered hide-if-no-paging'></div>
					</td></tr>
					</tfoot>
					</table>
					<div id='inquiry-edit' style='display:none;border:1px solid #ccc;'></div>
					<div id='inquiry-add' style='display:none;border:1px solid #ccc;'></div>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _email_history_table_start = (function () {/*  
	
	<div id='ehistTab-1'>
		<div class='ehist-options'>
			Filter From: 
			<input class="" onblur="chkDate('ehistDateFrom-1')" onchange="rptDates(1)" id='ehistDateFrom-1' style='display:inline;' 
				pattern="/^[0,1]?\d{1}\/(([0-2]?\d{1})|([3][0,1]{1}))\/(([1]{1}[9]{1}[9]{1}\d{1})|([2-9]{1}\d{3}))$/" 
				type="date" value="@@rptFrom" placeholder="mm/dd/yyyy">
			To: 								
			<input class="" onblur="chkDate('ehistDateTo-1')" onchange="rptDates(1)" id='ehistDateTo-1'  style='display:inline;' 
				pattern="/^[0,1]?\d{1}\/(([0-2]?\d{1})|([3][0,1]{1}))\/(([1]{1}[9]{1}[9]{1}\d{1})|([2-9]{1}\d{3}))$/" 
				type="date" value="@@rptTo" placeholder="mm/dd/yyyy">
			By: 
			<select style='padding:2.5px;max-width:115px;' id='ehistDateDate-1'>
				<option value='submitted'>Date Submitted</option>
				<option value='closed'>Date Closed</option>
			</select>
			<button id="ehistRefresh-1" title="Refresh" class='@@clsRefresh' onclick="ehists('closed-tickets-table');"><span class='fa fa-refresh'></span></button>
			<button id="ehistClear-1" title="Clear Dates" onclick="rptClear(1)" class='@@clsClear'><span class='fa fa-times'></span></button>
		</div>	
	<table id='email-history-table' class='footable' data-page-navigation='.pagination' data-page-size='5'  data-show-toggle='false'
								data-first-text='First Page'
								data-previous-text='Prev Page'
								data-next-text='Next Page'
								data-last-text='Last Page'>
					<thead><tr>
						<th data-hide='phone' data-type='numeric'><div>#</div></th>
						<th><div>Date</div></th>
						<th data-hide='phone'><div>Property</div></th>
						<th data-hide='phone'><div>Associate</div></th>
						<th data-hide='phone'><div>From</div></th>
						<th><div>#</div></th>
						<th><div>Recipients</div></th>
						<th data-hide='phone'><div>Subject</div></th>
						<th data-hide='phone'><div>Error</div></th>
						</tr></thead>  							  
					<tbody id='eml.table'>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _email_history_table_end = (function () {/*  
	</tbody>
					<tfoot id='emailhistory.table'>
					<tr><td colspan=99>
						<div style='float:right;' class='pagination pagination-centered hide-if-no-paging'></div>
					</td></tr>
					</tfoot>
					</table>
	</div>
	<div id='ehist-more' style='display:none;border:1px solid #c0c0c0;'>
	</div>
						
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _admin_blog_table_start = (function () {/*  
	<table id='admin-blog-table' class='footable' data-show-toggle='false' data-page-navigation='.pagination' data-page-size='5'  data-show-toggle='false'
								data-first-text='First Page'
								data-previous-text='Prev Page'
								data-next-text='Next Page'
								data-last-text='Last Page'>
					<thead><tr>
						<th data-hide='phone' data-type='numeric'><div>#</div></th>
						<th><div>Sort Date</div></th>
						<th><div>Title</div></th>
						<th><div>Visible</div></th>
						</tr></thead>  							  
					<tbody id='blg.table'>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

const _admin_blog_noblog = (function () {/*  	
	<tr><td colspan=3>For RBP blog ideas, please &nbsp;</div><div style='text-decoration:underline;cursor:pointer' onclick='page("/support?");'>contact support</div></td></tr>
*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
const _admin_blog_table_end = (function () {/*  
	</tbody>
	<tfoot id='adminblogtable.table'>
					<tr><td colspan=99>
						@@add_blog_button
						<div style='float:right;' class='pagination pagination-centered hide-if-no-paging'></div>
					</td></tr>
					</tfoot>
		</table>
		<div id='blog-add-edit-working' style='display:none;padding:50px;'>Working, please wait...</div>
		<div id='blog-edit' style='display:none;border:1px solid #ccc;'></div>
		<div id='blog-add' style='display:none;border:1px solid #ccc;'></div>
			
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
restapi.get('/admin', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_admin_users,
	middleHandler_db_admin_properties,
	middleHandler_db_admin_departments,
	middleHandler_db_admin_inquiries,
	middleHandler_db_admin_emailhistory,
	mh_admin_blogs,
	
	function(req,res){		
	//console.log("/admin "+req.query.a);
	var rows = '';

	if(req.user_superadmin==1){
		var showprbtn = "display:;"; var showprmsg = "display:none;"
		var showdpbtn = "display:;"; var showdpmsg = "display:none;"
		var showinbtn = "display:;"; var showinmsg = "display:none;"
	} else {
		var showprbtn = "display:none;"; var showprmsg = "display:;"
		var showdpbtn = "display:none;"; var showdpmsg = "display:;"
		var showinbtn = "display:none;"; var showinmsg = "display:;"
	}
	
	if(req.query.a==0 || req.query.a == 1) {
		var row_tr = _users_tr
		if(req.query.a==0){rows = _associates_table_start}
		if(req.query.a==1){rows = _groups_table_start; row_tr = _groups_tr}
		for(var x=0;x<req.admin_users.length;x++){
			var row = replace_all_array(row_tr, req.admin_users[x])
			if(req.query.a==0){
				row = row.replace('@@js','sdtn("associates-table");divup("/edit-associate?id='+req.admin_users[x]['id']+'","associate-edit");')
			}
			if(req.query.a==1){
				row = row.replace('@@js','sdtn("groups-table");divup("/edit-group?id='+req.admin_users[x]['id']+'","group-edit");')
			}
			rows+=row;
		};
		if(req.query.a==0){rows += _associates_table_end}		
		if(req.query.a==1){rows += _groups_table_end}		
	}	
	
	if(req.query.a==2) {
		rows = _properties_table_start.replace('@@footable_attributes', _footable_attributes)
		for(var x=0;x<req.admin_properties.length;x++){
			var row = replace_all_array(_properties_tr, req.admin_properties[x])
			rows+=row;
		};
		if(req.user_superadmin==1){
			var add_property_option = _super_add_property_button;
		} else {
			var add_property_option = _admin_add_property_button;
		}
		rows += replace_all_array(_properties_table_end, {
			add_property_option: add_property_option, 
			showprbtn: showprbtn, 
			showprmsg: showprmsg
		})
	}	
	
	/*
	if(req.query.a==33) {
		var rownum = 1
		rows = _departments_table_head + '::::'
		for(var x=0;x<req.admin_departments.length;x++){
			var row = replace_all_array(_departments_tr, req.admin_departments[x])
			row = replace_all(row, '@@row',rownum); rownum+=1
			rows+=row;
		};
	}	
	*/
	
	if(req.query.a==3) {
		var rownum = 1		
		var cols = ''
		var cls = '';
		if(req.user_superadmin==1){cls="class='rotate' data-sort-ignore='true'"}
		for(var y=0;y<req.user_properties.length;y++){
			cols = cols + "<th "+cls+"><div><span>"+req.user_properties[y]['name']+'</span></div></th>'
		}
		if(req.user_superadmin==1){
			cols = cols+"<th style='min-width: 60px; border-left: 0px;' data-sort-ignore='true'></th>"
		}
		rows = _departments_table_start
		var departments_table_head = _departments_table_head.replace('@@columntitles',cols);
		rows = rows.replace('@@departments_table_head', departments_table_head);
		
		for(var x=0;x<req.admin_departments.length;x++){
			var row = _departments_tr;
			var temp_props = req.admin_departments[x]['props'].split(',')
			var temp_notifs = req.admin_departments[x]['notifications'].split(',')
			var associates = req.admin_departments[x]['associates']
			var rtd = ''
			for(var y=0;y<req.user_properties.length;y++){
				var td_value = '';
				var td_notifs = '';
				var td_assocs = '';
				for(var z=0;z<temp_props.length;z++){
					if(temp_props[z]==req.user_properties[y]['id']){
						td_value = "<span class='fa fa-check'></span>"
						if(temp_notifs[z]==1){
							td_notifs = "<span class='fa fa-envelope-o'></span>"
						}						
					}
				}
				
				rtd=rtd+'<td>'+td_value+td_notifs+'</td>'
			}			
			if(req.user_superadmin==1){
				rtd=rtd+'<td></td>'
			}
			row = row.replace('@@propstds',rtd);
			row = replace_all_array(row, req.admin_departments[x])
			row = replace_all(row, '@@row',rownum); 
			rownum+=1
			rows+=row;
		};
		if(req.user_superadmin==1){
			var add_department_button = _super_add_department_button;
		} else {
			var add_department_button = _admin_add_department_button;
		}
		rows += replace_all_array(_departments_table_end, {
			add_department_button: add_department_button, 
			showprbtn: showprbtn, 
			showprmsg: showprmsg
		})
		
	}
	
	
	if(req.query.a==4) {
		var rownum = 1
		
		var cols = ''
		var cls = '';
		if(req.user_superadmin==1){cls="class='rotate' data-sort-ignore='true'"}
		for(var y=0;y<req.user_properties.length;y++){
			cols = cols + "<th "+cls+"><div><span>"+req.user_properties[y]['name']+'</span></div></th>'
		}
		if(req.user_superadmin==1){
			cols = cols+"<th style='min-width: 60px; border-left: 0px;' data-sort-ignore='true'></th>"
		}
		
		rows = _inquiries_table_start
		var inquiries_table_head = _inquiries_table_head.replace('@@columntitles',cols);
		rows = rows.replace('@@inquiries_table_head', inquiries_table_head);		
		
		for(var x=0;x<req.admin_inquiries.length;x++){
			var row = _inquiries_tr;
			if(req.admin_inquiries[x]['props']){
				var temp_props = req.admin_inquiries[x]['props'].split(',')
				var temp_subs = req.admin_inquiries[x]['subs'].split(';;')
				var rtd = ''
				for(var y=0;y<req.user_properties.length;y++){
					var td_value = '';
					var td_subs = '';
					for(var z=0;z<temp_props.length;z++){
						if(temp_props[z]==req.user_properties[y]['id']){
							td_value = "<span class='fa fa-check'></span>"
							if(temp_subs[z].length>0){
								td_subs = "<span class='fa fa-asterisk'></span>"
							}						
						}
					}
					rtd=rtd+'<td>'+td_value+td_subs+'</td>'
				}			
			} else { //no records in detail				
				var rtd = '';
				for(var y=0;y<req.user_properties.length;y++){					
					rtd=rtd+'<td></td>'
				}				
			}
			if(req.user_superadmin==1){
				rtd=rtd+'<td></td>'
			}
			row = row.replace('@@propstds',rtd);
			row = replace_all_array(row, req.admin_inquiries[x])
			row = replace_all(row, '@@row',rownum); 
			rownum+=1
			rows+=row;
		};
		
		if(req.user_superadmin==1){
			var add_inquiries_option = _super_add_inquiries_button;
		} else {
			var add_inquiries_option = _admin_add_inquiries_button;
		}
		rows += replace_all_array(_inquiries_table_end, {
			add_inquiries_option: add_inquiries_option, 
			showprbtn: showprbtn, 
			showprmsg: showprmsg
		})
		
	}
	
	if(req.query.a==5) {
		rows = _email_history_table_start
		var rownum = 1
		for(var x=0;x<req.admin_emailhistory.length;x++){
			var row = replace_all_array(_emailhistory_tr, req.admin_emailhistory[x])
			row = replace_all(row, '@@row',rownum); rownum+=1
			rows+=row;
		};
		rows += _email_history_table_end
	}
	
	if(req.query.a==6) {
		rows = _admin_blog_table_start
		var add_blog_button = ''
		if(req.user_superadmin==1){
			add_blog_button = _add_blog_button
			var rownum = 1
			if(req.admin_blogs.length>0){
				for(var x=0;x<req.admin_blogs.length;x++){
					var blg = req.admin_blogs[x]
					var visible = "no"
					if(blg.visible==1){visible = "yes"}
					var d = new Date(blg.realdate);
					var row = replace_all_array(_admin_blog_tr, {
						id: blg.autoID,
						rdate: dlk(d), 
						title: blg.title,
						visible: visible})
					row = replace_all(row, '@@row',rownum); rownum+=1
					rows+=row;
				};
			} else {				
				rows+="<tr id='adm-blg-no'><td colspan=3>No Blog Records Exist</td></tr>"
			}
		} else {
			rows+=_admin_blog_noblog
		}
		rows += _admin_blog_table_end	
		rows = rows.replace('@@add_blog_button', add_blog_button)
	}
	res.write(rows);
	res.end();
})

function middleHandler_db_admin_emailhistory_item(req, res, next) {
	//console.log("  middleHandler_db_admin_emailhistory_item ");	
	req.admin_emailhistory_item_body = ''
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = "SELECT body FROM email_history WHERE autoID = "+req.query.id
		if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {
				req.admin_emailhistory_item_body = emailprep(row.body)
		}, function () {	
			next();
		});
	} else {
		next();
	}
	
}

restapi.get('/admin/notification/detail', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_admin_emailhistory_item,
	
	function(req,res){		
	//console.log("/admin/notification/detail "+req.query.id);	
	//console.log(req.admin_emailhistory_item_body);
	var row = replace_all(_emailhistory_tr_item, '@@body', req.admin_emailhistory_item_body)
	row = replace_all(row, '@@id', req.query.id);
	res.write(row);
	res.end();
})


const _sql_admin_new_authorities = (function () {/*  
SELECT autoID as id, name as authname, deflimit FROM authorities
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_assoc_new_authorities(req, res, next) {
	//console.log("  middleHandler_db_assoc_new_authorities ");	
	req.assoc_authorities = [];
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = _sql_admin_new_authorities
		db.each(sql, function(err, row) {			
			var val = {id: row.id, name: row.authname, limit: row.deflimit}
		req.assoc_authorities.push(val);
		}, function () {
			next();
		});
	} else {
		next();
	}
}	

const _sql_admin_user_authorities = (function () {/*  
SELECT authorities.autoID as id,
       name AS authname,
       deflimit,
       ( 
           SELECT authority
             FROM user_authority
            WHERE userID = @@id 
                  AND
                  user_authority.authority = authorities.autoID 
       ) 
       AS auth
  FROM authorities
       INNER JOIN user_authority
               ON authority = authorities.autoID
 GROUP BY authorities.autoID;
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_associate_authorities(req, res, next) {
	//console.log("  middleHandler_db_associate_authorities ");	
	req.assoc_authorities = [];
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = _sql_admin_user_authorities.replace('@@id', req.query.id)	
		db.each(sql, function(err, row) {			
			var val = {id: row.id, name: row.authname, limit: row.deflimit, auth: row.auth}
		req.assoc_authorities.push(val);
		}, function () {
			next();
		});
	} else {
		next();
	}
}


restapi.get('/add-blog', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	function(req,res){		
	//console.log("/add-blog");
	var form = "Invalid Blog Access"
	if(req.user_superadmin==1){
		var form = replace_all_array(_admin_blog_form, {visshow: "style='display:none;'", id: '0', rdate: '', date: '', title: '', intropara: '', fulltext: '', photo_upload: _blog_photo_notyet, vischecked: ''})
		form = form.replace('@@buttons', replace_all_array(_add_blog_buttons, {}))
	}
	
	res.write(form);
	res.end();
})	

restapi.get('/edit-blog', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	mh_admin_blog,
	function(req,res){		
	//console.log("/edit-blog");
	var form = "Invalid Blog Access"
	if(req.user_superadmin==1){
		var blg = req.admin_blog[0]
		if(_debug){console.log(blg)}
		var visible = ""
		if(blg.visible==1){visible="checked"}
		var filepath = "<img style='max-width: 600px;' src='/blog-images/"+blg.filepath+"'/><br>Note: the image will be auto-sized when appearing in the blog.<br>"
		var d = new Date(blg.realdate);
		var form = replace_all_array(_admin_blog_form, {
			id: req.query.id, 
			date: blg.date, 
			rdate: dlk(d),
			title: undo_clean_for_basic_html(blg.title), 
			intropara: undo_clean_for_basic_html(blg.intropara), 
			fulltext: undo_clean_for_basic_html(blg.fulltext), 
			visshow: '',
			vis_checked: visible,
			photo_upload: replace_all_array(_blog_photo_ok, {id: req.query.id, image: filepath})
		})
		form = form.replace('@@buttons', replace_all_array(_save_blog_buttons, {id: req.query.id}))
	}
	
	res.write(form);
	res.end();
})	

function middleHandler_db_add_blog(req, res, next) {
	//console.log("  middleHandler_db_add_blog");	
	req.blog_last_id = 0	
	var dte = new Date(req.query.rd).getTime();
	var sql = "INSERT INTO blog VALUES(NULL, @@userid, '', '@@title', '@@date', '', '@@intropara', '@@fulltext', 0, '',"+parseInt(dte)+")"
	sql = replace_all_array(sql, {
		userid: req.userid,
		title: req.query.tl,
		date: req.query.dt,
		intropara: req.query.it,
		fulltext: req.query.ft})
	db.run(sql, function(err) {						
	}, function () {	
		req.blog_last_id = this['lastID']
		next();
	});	
}

function middleHandler_db_save_blog(req, res, next) {
	if(_debug){console.log("  middleHandler_db_save_blog")}
	var visible = 0
	if(req.query.vs == 'on'){visible = 1}
	var dte = new Date(req.query.rd).getTime();
	var sql = "UPDATE blog set userid = @@userid, title = '@@title', date = '@@date', intropara = '@@intropara', fulltext = '@@fulltext', visible = "+visible+", realdate = "+parseInt(dte)+" WHERE autoID = "+req.query.id
	sql = replace_all_array(sql, {
		userid: req.userid,
		title: clean_for_db_write(req.query.tl),
		date: clean_for_db_write(req.query.dt),
		intropara: clean_for_db_write(req.query.it),
		fulltext: clean_for_db_write(req.query.ft)})
	if(_debug){console.log(sql)}
	db.run(sql, function(err) {						
	}, function () {	
		next();
	});	
}

function middleHandler_db_blog_image_record(req, res, next) {
	if(_debug){console.log("  middleHandler_db_blog_image_record");}
	var sql = "update blog set filepath = '@@filepath' WHERE autoID = @@id"
	sql = replace_all_array(sql, {
		id: req.body.id,
		filepath: req.blog_upload_data[0]['name']
		})
	if(_debug){console.log(sql)}
	db.run(sql, function(err) {						
	}, function () {	
		next();
	});	
}


restapi.get('/add-blog-accept', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_add_blog,
	function(req,res){		
	//console.log("/add-blog");
	var row = replace_all_array(_admin_blog_tr, {id: req.blog_last_id, title: req.query.tl, visible: 'false'})
	if(_debug){console.log(row)}
	var html = "tr::::blog-tr-"+req.blog_last_id+"::::"+row;
	res.write(html);
		
	res.write('ok');
	res.end();
})	

restapi.get('/save-blog-accept', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_save_blog,
	mh_admin_blog,
	function(req,res){		
	if(_debug){console.log("/save-blog-accept"); console.log(req.admin_blog[0])}
	
	var blg = req.admin_blog[0]
	var visible = "no"
	if(blg.visible==1){visible = "yes"}
	var d = new Date(blg.realdate);
	var row = replace_all_array(_admin_blog_tdx, {
		id: blg.autoID,
		rdate: dlk(d), 
		title: blg.title,
		visible: visible})
	var html = "tr::::blog-tr-"+req.blog_last_id+"::::"+row;
	res.write(html);
		
	res.write('ok');
	res.end();
})	

restapi.get('/add-associate', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_assoc_new_authorities,

	function(req,res){		
	//console.log("/add-associate "+req.query.a);
	var val = {
		id: '0', 
		first_name_label: 'First Name', 
		fname: '', 
		mi: '', 
		lname: '', 
		email: '', 
		phone: '', 
		gpshow: 'style="display:none;"', 
		readonly_email: '',
		position: 1, tsel1: 'selected', tsel2: '', tsel3: '', tsel4: '', tsel5: '', tsel6: '' }
	var form = replace_all_array(_common_user_form, val)
	form = replace_all(form, '@@gphide', '')
	form = form.replace('@@assignblock', '')
	form = form.replace('@@gschk','')
	form = form.replace('@@groupcount', '0')
	
	
	var authrows = ''
	var ti = 8
	var alist = []
	for(var x=0;x<req.assoc_authorities.length;x++){
		alist.push(req.assoc_authorities[x]['id'])
		var bit = _auth_row_td_all
		if(req.assoc_authorities[x]['id']==2) {
			bit += _auth_row_td_type2
			ti+=1
		} else {
			bit += _auth_row_td_type_other
		}		
		authrows += replace_all_array(bit, {
			ti: ti,
			uadmin: 1,
			id: req.assoc_authorities[x]['id'],
			gpinputshow: '',
			authname: req.assoc_authorities[x]['name'],
			credit: todollar(req.assoc_authorities[x]['limit']),
			deflimit: todollar(req.assoc_authorities[x]['limit'])
		})		
		ti+=1
	}
	form = form.replace('@@auth_rows', authrows)
	form = form.replace('@@alist', alist)
	
	var ti2 = ti + 1
	var notifsort = [0, 5, 1, 2, 3, 4]
	var notifications = ["", "New Inquiries/Billing Inquiries", "Awaiting Approval", "Guest Reopened/Guest Response", "Status Report Auto", "New Inquiries/Folio Copies"]
	var notif = ""; var nlist = []
	var start = 1
	for(var x=start; x<notifsort.length;x++){
			var xy = notifsort[x]
			nlist.push(xy)
			notif += replace_all_array(_notify_row, {
				xy: xy,
				chk: '',
				name: notifications[xy],
				readonly: '',
				ti2: ti2
			})
			ti2+=1
	}
	form = form.replace('@@notif', notif)
	form = form.replace('@@nlist', nlist)

	var selprop = ''
	var proplist = []
	if(req.user_admin == 1) {
		var rows = ''
		for(var x=0;x<req.user_properties.length;x++){
			proplist.push(req.user_properties[x]['id'])
			ti2 += 1
			var row = replace_all_array(_user_prop_tr, {
				ti2: ti2,
				upchk: '',
				readonly: '',
				pid: req.user_properties[x]['id'],
				pname: req.user_properties[x]['name'],
				upchk: ''
			})
			rows += row
		}
		selprop = _user_prop_table.replace('@@rows', rows)
	} else {
		
	}	
	form = form.replace('@@propdivlist', replace_all_array(_user_prop_div_list, {uadmin: req.user_admin, proplist: proplist.join(";")}))
	form = form.replace('@@selprop', selprop)
	ti2+=1
	form = form.replace('@@buttons', replace_all_array(_add_user_buttons, {ti2: ti2, ident: 'associate'}))
	
	res.write(form);
	res.end();
})


const _sql_db_existing_user_test = (function () {/*  
SELECT * FROM users WHERE email = '@@email'
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_existing_user_test(req, res, next) {
	//console.log("  middleHandler_db_existing_user_test ");	
	req.errors = [];
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = _sql_db_existing_user_test.replace('@@email', req.query.email.toLowerCase())	
		db.each(sql, function(err, row) {			
			req.errors.push("User email already exists")
		}, function () {
			next();
		});
	} else {
		next();
	}
}

function middleHandler_db_new_user_validate_fields(req, res, next) {
	if(_debug){
		console.log("  middleHandler_db_new_user_validate_fields ");			
		console.log(req.query.position)
		console.log(req.position_test_list);
		console.log(req.query.auth)
		console.log(req.authkeys_test_list);
	}
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		if(req.query.fname.length==0){req.errors.push("First Name not supplied")}
		var email = req.query.email.toLowerCase();
		if(!validateEmail(email)){req.errors.push("Invalid email address")}
		if(req.query.props.split(",").length<1){req.errors.push("At least one Property must be selected")}	
		var found = false
		for(var x=0;x<req.position_test_list.length;x++){
			if(req.position_test_list[x]['id']==req.query.position){found = true; break;}
		}
		if(!found){req.errors.push("A valid position is required. Please contact support.")}		
		
		var found = false
		for(var x=0;x<req.authkeys_test_list.length;x++){
			if(req.authkeys_test_list[x]['id']==req.query.auth){found = true; break;}
		}
		if(!found){req.errors.push("A valid authority level is required. Please contact support.")}				
		next();
	} else {
		next();
	}
}

function middleHandler_db_new_associate_pre_associate(req, res, next) {
	req.groupcount = 0; next();
}
function middleHandler_db_new_associate_pre_group(req, res, next) {
	req.groupcount = req.query.group; next();
}


const _sql_db_associate_add_record = (function () {/*  
INSERT INTO users VALUES(NULL, '@@fname', '@@mi', '@@lname', '@@email', '@@phone', '', '', '', 0, '@@dnow', @@position, 0, 0,'0',0,0,'','@@xcode', @@regdate, @@groupcount, '', @@canassign, @@excludeassign)
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_new_associate_accept(req, res, next) {
	if(_debug){console.log("  middleHandler_db_new_associate_accept " + req.errors);}
	req.add_edit_userid = 0
	req.add_user_xcode = ''
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1) && req.errors.length == 0){
		
		var guid = require('guid');
		var g = guid.create()
		req.add_user_xcode = g
		var d = new Date;
		var excludeassign = 0; if(req.query.gssign=="true"){excludeassign = 1}
		var sql = replace_all_array(_sql_db_associate_add_record, {
			fname: req.query.fname,
			mi: req.query.mi,
			lname: req.query.lname,
			phone: phone(req.query.phone),
			email: req.query.email.toLowerCase(),
			position: req.query.position,	
			xcode: g,
			dnow: rbp_dte(),
			regdate: parseInt(d.getTime() / 1000),
			groupcount: 0,
			canassign: 0,
			excludeassign: excludeassign
		})
		if(_debug){console.log(sql)}
		db.run(sql, function(err) {			
			//todo handle errors			
		}, function () {
			req.add_edit_userid = this.lastID;
			next();
		});		
	} else {
		next();
	}
}

const _sql_db_associate_edit_record = (function () {/*  
UPDATE users SET 
	fname = '@@fname', 
	mi = '@@mi', 
	lname = '@@lname', 
	phone = '@@phone', 
	position = @@position, 
	excludeassign = @@excludeassign
	WHERE autoID = @@uid
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_edit_associate_accept(req, res, next) {
	//console.log("  middleHandler_db_edit_associate_accept ");	
	req.add_edit_userid = req.query.id
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1) && req.errors.length == 0){
		
		var guid = require('guid');
		var g = guid.create()
		var d = new Date;
		var excludeassign = 0; if(req.query.gssign=="true"){excludeassign = 1}
		var sql = replace_all_array(_sql_db_associate_edit_record, {
			uid: req.add_edit_userid,
			fname: req.query.fname,
			mi: req.query.mi,
			lname: req.query.lname,
			phone: phone(req.query.phone),
			position: req.query.position,	
			excludeassign: excludeassign
		})
		db.run(sql, function(err) {			
			//todo handle errors			
		}, function () {
			next();
		});		
	} else {
		next();
	}
}

function middleHandler_db_add_edit_associate_delete_authority(req, res, next) {
	//console.log("  middleHandler_db_add_edit_associate_delete_authority ");		
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1) && req.errors.length == 0){
		var sql = "DELETE FROM user_authority WHERE userID = @@newuserid"
		var sql = sql.replace('@@newuserid', req.add_edit_userid)		
		db.run(sql, function(err) {			
			//todo handle errors			
		}, function () {
			next();
		});		
	} else {
		next();
	}
}

function middleHandler_db_add_edit_associate_create_authority(req, res, next) {
	//console.log("  middleHandler_db_add_edit_associate_create_authority ");		
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1) && req.errors.length == 0){
		var sql = "INSERT INTO user_authority VALUES(null, '12345', @@newuserid, @@auth)"
		var sql = sql.replace('@@newuserid', req.add_edit_userid)
		var sql = sql.replace('@@auth', req.query.auth)
		db.run(sql, function(err) {			
			//todo handle errors			
		}, function () {
			next();
		});		
	} else {
		next();
	}
}

function middleHandler_db_add_edit_associate_set_credit(req, res, next) {
	//console.log("  middleHandler_db_add_edit_associate_set_credit ");		
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1) && req.errors.length == 0){
		if(req.query.auth==2){
			var sql = "UPDATE users SET credit = '"+from_currency(req.query.limit)+"' WHERE autoID = "+req.add_edit_userid
		} else {			
			var sql = "UPDATE users SET credit = (SELECT deflimit FROM authorities WHERE autoID = "+req.query.auth+") WHERE autoID = "+req.add_edit_userid
		}		
		db.run(sql, function(err) {			
			//todo handle errors			
		}, function () {
			next();
		});		
	} else {
		next();
	}
}

function middleHandler_db_add_edit_associate_set_admin(req, res, next) {
	//console.log("  middleHandler_db_add_edit_associate_set_admin ");			
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1) && req.errors.length == 0){
		if(req.query.auth==3){
			var sql = "UPDATE users SET admin = 1 WHERE autoID = "+req.add_edit_userid
			db.run(sql, function(err) {			
				//todo handle errors			
			}, function () {
				next();
			});		
		} else {
			next();
		}
	} else {
		next();
	}
}


function middleHandler_db_add_edit_associate_delete_notifications(req, res, next) {
	//console.log("  middleHandler_db_add_edit_associate_delete_notifications ");		
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1) && req.errors.length == 0){
		var sql = "DELETE FROM user_notification WHERE userID = @@newuserid"
		var sql = sql.replace('@@newuserid', req.add_edit_userid)		
		db.run(sql, function(err) {			
			//todo handle errors			
		}, function () {
			next();
		});		
	} else {
		next();
	}
}

function middleHandler_db_add_edit_associate_create_notifications(req, res, next) {
	//console.log("  middleHandler_db_add_edit_associate_create_notifications ");		
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1) && req.errors.length == 0){		
		var sql_parts = []
		var notif_list = req.query.notif.split(",")
		var props_list = req.query.props.split(",")
		for(var p=0;p<props_list.length;p++){
			for(var x=0;x<notif_list.length;x++){
				sql_parts.push("(NULL, "+props_list[p]+","+req.add_edit_userid+","+notif_list[x]+")")
			}
		}				
		var sql = "INSERT INTO user_notification (autoID, pid, userID, notification) VALUES "+sql_parts.join(", ")+";"
		db.run(sql, function(err) {			
			//todo handle errors			
		}, function () {
			next();
		});		
	} else {
		next();
	}
}

function middleHandler_db_add_edit_associate_delete_user_properties(req, res, next) {
	//console.log("  middleHandler_db_add_edit_associate_delete_user_properties ");		
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1) && req.errors.length == 0){
		var sql = "DELETE FROM user_properties WHERE userID = @@newuserid"
		var sql = sql.replace('@@newuserid', req.add_edit_userid)		
		db.run(sql, function(err) {			
			//todo handle errors			
		}, function () {
			next();
		});		
	} else {
		next();
	}
}

function middleHandler_db_add_edit_associate_set_user_properties(req, res, next) {
	if(_debug){
		console.log("  middleHandler_db_add_edit_associate_set_user_properties ");
		console.log(req.query.props);
		console.log(req.errors);
	}
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1) && req.errors.length == 0){		
		if(_debug){console.log('continue')}
		var sql_parts = []
		var query_props = req.query.props.split(",")
		if(req.user_superadmin == 1) {
			for(var x=0;x<query_props.length;x++){
				sql_parts.push("(NULL, "+query_props[x]+","+req.add_edit_userid+")")
			}
		} else {
			if(req.user_admin == 1) {
				for(var x=0;x<query_props.length;x++){
					var found = false
					for(var p=0;p<req.user_props.length;p++){
						if(req.user_props[p]['id']==query.props[x]){found = true; break;}
						if(found){
							sql_parts.push("(NULL, "+query_props[x]+","+req.newyserud+")")
						}
					}
				}
			}
		}
		if(_debug){console.log(sql_parts)};
		if(sql_parts.length>0){		
			var sql = "INSERT OR REPLACE INTO user_properties (autoID, propertyID, userID) values "+sql_parts.join(", ")+";"
			if(_debug){console.log(sql)}
			db.run(sql, function(err) {			
				//todo handle errors			
			}, function () {
				next();
			});			
		} else {
			//todo errpr
			next();
		}
	} else {
		next();
	}
}


function middleHandler_db_new_associate_row(req, res, next) {
	if(_debug){
		console.log("  middleHandler_db_new_associate_row "+req.add_edit_userid);		
	}
	req.new_assoc_row = []
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1) && req.add_edit_userid > 0 && req.errors.length == 0){
		var sql_shared_get_users = _sql_shared_get_users+" WHERE users.autoID = @@userid"			
		var sql = sql_shared_get_users.replace('@@userid', req.add_edit_userid)		
		if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {			
			req.new_assoc_row.push(shared_userrow(row))
		}, function () {			
			next();
		});		
	} else {
		next();
	}
}


/*
auth: req.query.auth,
notif: req.query.notif,
			*/

restapi.get('/associate-add-accept', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_tester_positions_list,
	middleHandler_tester_authkeys_list,
	middleHandler_tester_notifications_list,
	middleHandler_db_existing_user_test,
	middleHandler_db_new_user_validate_fields,
	middleHandler_db_new_associate_pre_associate,
	middleHandler_db_new_associate_accept,
	middleHandler_db_add_edit_associate_delete_authority,
	middleHandler_db_add_edit_associate_create_authority,
	middleHandler_db_add_edit_associate_set_credit,
	middleHandler_db_add_edit_associate_set_admin,
	middleHandler_db_add_edit_associate_create_notifications,
	middleHandler_db_add_edit_associate_set_user_properties,
	middleHandler_db_new_associate_row,
	middleHandler_email_prep_new_associate,
	middleHandler_send_message,
	function(req,res){		
	if(_debug){
		console.log("/associate-add-accept ");
		console.log(req.query)
		console.log(req.new_assoc_row)
		console.log(req.errors)
	}
	var text = ""
	if(req.errors.length==0 && req.new_assoc_row.length == 1){
		text = "tr::::assoc-tr-"+req.add_edit_userid+":::: "+replace_all_array(_users_tr, req.new_assoc_row[0])
	} else {
		console.log(req.errors.join(". "))
		text = "alert::::"+req.errors.join(". ");
	}
	if(_debug){console.log(text)}
	res.write(text);
	res.end();
})	

restapi.get('/group-add-accept', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_tester_positions_list,
	middleHandler_tester_authkeys_list,
	middleHandler_tester_notifications_list,
	middleHandler_db_existing_user_test,
	middleHandler_db_new_user_validate_fields,
	middleHandler_db_new_associate_pre_group,
	middleHandler_db_new_associate_accept,
	middleHandler_db_add_edit_associate_delete_authority,
	middleHandler_db_add_edit_associate_create_authority,
	middleHandler_db_add_edit_associate_set_credit,
	middleHandler_db_add_edit_associate_set_admin,
	middleHandler_db_add_edit_associate_create_notifications,
	middleHandler_db_add_edit_associate_set_user_properties,
	middleHandler_db_new_associate_row,
	middleHandler_email_prep_new_associate,
	middleHandler_send_message,
	function(req,res){		
	if(_debug){
		console.log("/group-add-accept ");
		console.log(req.query)
		console.log(req.new_assoc_row)
		console.log(req.errors)
	}
	var text = ""
	if(req.errors.length==0 && req.new_assoc_row.length == 1){
		text = "tr::::grp-tr-"+req.add_edit_userid+":::: "+replace_all_array(_groups_tr, req.new_assoc_row[0])
		text = text.replace('@@js','sdtn("groups-table");divup("/edit-group?id='+req.new_assoc_row[0]['id']+'","group-edit");')
	} else {
		console.log(req.errors.join(". "))
		text = "alert::::"+req.errors.join(". ");
	}
	if(_debug){console.log(text)}
	res.write(text);
	res.end();
})	

function middleHandler_db_new_associate_check_db(req, res, next) {
	if(_debug){console.log("  middleHandler_db_new_associate_check_db ")}
	req.new_associate = []	
	var sql = "SELECT autoID as userid, email, groupcount, superadmin FROM users WHERE xcode = '"+req.query.id+"'"
	if(_debug){console.log(sql)}
	db.each(sql, function(err, row) {
		req.new_associate.push(row)
	}, function () {	
		next();
	});	
}

function middleHandler_db_new_associate_check_properties(req, res, next) {
	if(_debug){console.log("  middleHandler_db_new_associate_check_properties ")}
	req.new_assoc_prop = 0
	if(req.new_associate.length == 1){
		var sql = "SELECT propertyID as propid FROM user_properties WHERE userID = "+req.new_associate[0]['userid']+" LIMIT 1"
		if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {
			req.new_assoc_prop = row.propid
		}, function () {	
			next();
		});	
	} else { 
		next(); 
	}
}

restapi.get('/associate/create', 
	middleHandler_db_new_associate_check_db,
	middleHandler_db_new_associate_check_properties,
	function(req,res){	
	if(_debug){
		console.log('/associate/create')
		console.log(req.query.id)
		console.log(req.new_assoc_prop)
		console.log(req.new_associate)
	}
	if(req.new_associate.length == 1 && req.new_assoc_prop > 0){
		res.cookie("rbpx-g",'', { signed: false });
		res.cookie("rbpx-u",req.new_associate[0]['email'], { signed: false });
		res.cookie("rbpx-r",req.new_assoc_prop, { signed: false });	
		res.cookie("rbpx-x",req.query.id, { signed: false });	
		res.redirect('/');
	} else {
		res.write("RegError")
		res.end();
	}
	
})	

restapi.get('/associate-edit-accept', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_tester_positions_list,
	middleHandler_tester_authkeys_list,
	middleHandler_tester_notifications_list,
	middleHandler_db_new_user_validate_fields,
	middleHandler_db_edit_associate_accept,
	middleHandler_db_add_edit_associate_delete_authority,
	middleHandler_db_add_edit_associate_create_authority,
	middleHandler_db_add_edit_associate_set_credit,
	middleHandler_db_add_edit_associate_set_admin,
	middleHandler_db_add_edit_associate_delete_notifications,
	middleHandler_db_add_edit_associate_create_notifications,
	middleHandler_db_add_edit_associate_delete_user_properties,
	middleHandler_db_add_edit_associate_set_user_properties,
	middleHandler_db_new_associate_row,

	function(req,res){		
	if(_debug){
		console.log("/associate-edit-accept ");
		console.log(req.query)
	}
	var text = ""
	//console.log(req.new_assoc_row[0])
	if(req.errors.length==0){
		text = "tr::::assoc-tr-"+req.add_edit_userid+":::: "+replace_all_array(_users_tr, req.new_assoc_row[0])
	} else {
		text = req.errors.join(". ");
	}
	res.write(text);
	res.end();
})	

restapi.get('/group-edit-accept', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_tester_positions_list,
	middleHandler_tester_authkeys_list,
	middleHandler_tester_notifications_list,
	middleHandler_db_new_user_validate_fields,
	middleHandler_db_edit_associate_accept,
	middleHandler_db_add_edit_associate_delete_authority,
	middleHandler_db_add_edit_associate_create_authority,
	middleHandler_db_add_edit_associate_set_credit,
	middleHandler_db_add_edit_associate_set_admin,
	middleHandler_db_add_edit_associate_delete_notifications,
	middleHandler_db_add_edit_associate_create_notifications,
	middleHandler_db_add_edit_associate_delete_user_properties,
	middleHandler_db_add_edit_associate_set_user_properties,
	middleHandler_db_new_associate_row,

	function(req,res){		
	if(_debug){
		console.log("/group-edit-accept ");
		console.log(req.query)
	}
	var text = ""
	//console.log(req.new_assoc_row[0])
	if(req.errors.length==0){
		text = "tr::::grp-tr-"+req.add_edit_userid+":::: "+replace_all_array(_groups_tr, req.new_assoc_row[0])
	} else {
		text = req.errors.join(". ");
	}
	res.write(text);
	res.end();
})	

function middleHandler_db_get_admin_user_properties(req, res, next) {
	//console.log("  middleHandler_db_get_admin_user_properties ");	
	req.admin_user_properties = []
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){		
		var sql = "SELECT * FROM user_properties WHERE userID = "+req.query.a
		db.each(sql, function(err, row) {			
			//todo handle errors			
			req.admin_user_properties.push(row)
		}, function () {
			next();
		});		
	} else {
		next();
	}
}

function middleHandler_db_delete_associate_check_properties(req, res, next) {
	//console.log("  middleHandler_db_delete_associate_check_properties ");	
	req.errors = []
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){				
		if(req.user_superadmin == 0){
			if(req.user_admin == 1){
				var found = false
				for(var x=0;x<req.user_properties.length;x++){
					for(var y=0;y<req.admin_user_properties.length;y++){
						if(req.user_properties[x]['id']==req.admin_user_properties[y]['propertyID']){
							found = true;
							break;
						}
					}
				}
				if(!found){
					req.errors.push("Invalid property for admin")
				}
			}
		}
		next();
	} else {
		req.errors.push("An unknown error occurred")
		next();
	}
}

const _sql_db_delete_associate = (function () {/*  
UPDATE users SET 
	deleted = 1, 
	fname = 'Deleted', 
	lname = 'User', 
	email = '@@guid', 
	password = '@@guid',
	groupcount = 0	
	WHERE autoID = @@uid AND superadmin != 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_delete_associate_accept(req, res, next) {
	//console.log("  middleHandler_db_delete_associate_accept ");	
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1) && req.errors.length == 0){		
		var guid = require('guid');
		var g = guid.create()		
		var sql = replace_all_array(_sql_db_delete_associate, {
			uid: req.query.a,
			guid: g
			});
		db.run(sql, function(err) {			
			//todo handle errors			
		}, function () {
			next();
		});		
	} else {
		next();
	}
}

restapi.get('/associate-delete', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_get_admin_user_properties,
	middleHandler_db_delete_associate_check_properties,
	middleHandler_db_delete_associate_accept,
	
	function(req,res){		
	//console.log("/associate-delete ");
	//console.log(req.errors)
	res.write(req.errors.join(", "));
	res.end();
})	

restapi.get('/group-delete', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_get_admin_user_properties,
	middleHandler_db_delete_associate_check_properties,
	middleHandler_db_delete_associate_accept,
	
	function(req,res){		
	//console.log("/group-delete ");
	//console.log(req.errors)
	res.write(req.errors.join(", "));
	res.end();
})	


function get_gc_options(sel){
	var gcselects = ['', '', '', '', '', '']
	gcselects[sel] = "selected"
	var g = "<option value='1' "+gcselects[1]+">1</option>"
	g = g + "<option value='2' "+gcselects[2]+">2</option>"
	g = g + "<option value='3' "+gcselects[3]+">3</option>"
	g = g + "<option value='4' "+gcselects[4]+">4</option>"
	g = g + "<option value='5' "+gcselects[5]+">5</option>"
	return g
}

restapi.get('/add-group', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_assoc_new_authorities,

	function(req,res){		
	//console.log("/add-group "+req.query.a);
	var val = {id: '0', 
		first_name_label: 'Group Name', 
		fname: '', mi: '', lname: '', email: '', phone: '', gpshow: '', readonly_email: ''}
	var form = replace_all_array(_common_user_form, val);
	form = replace_all(form, '@@gphide', 'style="display:none;"');
	
	var gcoptions = get_gc_options(1)
	form = form.replace('@@gcoptions', gcoptions)
	form = form.replace('@@groupcount', 1)
			
	var authrows = ''
	var ti = 8
	var alist = []
	for(var x=0;x<req.assoc_authorities.length;x++){
		if(req.assoc_authorities[x]['id'] != 3){
			alist.push(req.assoc_authorities[x]['id'])
			var bit = _auth_row_td_all
			if(req.assoc_authorities[x]['id']==2) {
				bit += _auth_row_td_type2
				ti+=1
			} else {
				bit += _auth_row_td_type_other
			}		
			authrows += replace_all_array(bit, {
				ti: ti,
				uadmin: 1,
				id: req.assoc_authorities[x]['id'],
				gpinputshow: '',
				authname: req.assoc_authorities[x]['name'],
				credit: todollar(req.assoc_authorities[x]['limit']),
				deflimit: todollar(req.assoc_authorities[x]['limit'])
			})		
			ti+=1
		}
	}
	form = form.replace('@@auth_rows', authrows)
	form = form.replace('@@alist', alist)
	
	var ti2 = ti + 1
	var notifsort = [0, 5, 1, 2, 3, 4]
	var notifications = ["", "New Inquiries/Billing Inquiries", "Awaiting Approval", "Guest Reopened/Guest Response", "Status Report Auto", "New Inquiries/Folio Copies"]
	var notif = ""; var nlist = []
	var start = 1
	for(var x=start; x<notifsort.length;x++){
			var xy = notifsort[x]
			nlist.push(xy)
			notif += replace_all_array(_notify_row, {
				xy: xy,
				chk: '',
				name: notifications[xy],
				readonly: '',
				ti2: ti2
			})
			ti2+=1
	}
	form = form.replace('@@notif', notif)
	form = form.replace('@@nlist', nlist)

	form = form.replace('@@assignblock', '')
	
	var selprop = ''
	var proplist = []
	if(req.user_admin == 1) {
		var rows = ''
		for(var x=0;x<req.user_properties.length;x++){
			proplist.push(req.user_properties[x]['id'])
			ti2 += 1
			var row = replace_all_array(_user_prop_tr, {
				ti2: ti2,
				upchk: '',
				readonly: '',
				pid: req.user_properties[x]['id'],
				pname: req.user_properties[x]['name'],
				upchk: ''
			})
			rows += row
		}
		selprop = _user_prop_table.replace('@@rows', rows)
	} else {
		
	}	
	form = form.replace('@@propdivlist', replace_all_array(_user_prop_div_list, {uadmin: req.user_admin, proplist: proplist.join(";")}))
	form = form.replace('@@selprop', selprop)
	ti2+=1
	form = form.replace('@@buttons', replace_all_array(_add_user_buttons, {ti2: ti2, ident: 'group'}))
	
	res.write(form);
	res.end();
})

function middleHandler_db_get_associate_row(req, res, next) {
	//console.log("  middleHandler_db_get_associate_row "+req.query.id);		
	req.user_row = []
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1) && req.query.id > 0 && req.errors.length == 0){
		var sql_shared_get_users = _sql_shared_get_users+" WHERE users.autoID = @@userid"			
		var sql = sql_shared_get_users.replace('@@userid', req.query.id)		
		db.each(sql, function(err, row) {			
			req.user_row.push(shared_userrow(row))
		}, function () {
			
			next();
		});		
	} else {
		next();
	}
}


function common_user_group_edit(req, gp){
	var pos = req.user_row[0]['position']
	
	var first_name_label = 'First Name'
	var gp_show = 'style="display:none;"'
	var gp_hide = ''
	if(gp==1){
		first_name_label = 'Group Name'
		gp_hide = 'style="display:none;"'
		gp_show = ''
	}
	
	var form = replace_all_array(_common_user_form, {
		id: '', 
		first_name_label: first_name_label, 
		fname: req.user_row[0]['fname'],
		mi: req.user_row[0]['mi'],
		lname: req.user_row[0]['lname'],
		email: req.user_row[0]['email'],
		phone: req.user_row[0]['phone'],
		gpshow: gp_show,
		gphide: gp_hide,
		readonly_email: 'readonly',
		position: pos,
		tsel1: pos==1 ? 'selected':'',
		tsel2: pos==2 ? 'selected':'',
		tsel3: pos==3 ? 'selected':'',
		tsel4: pos==4 ? 'selected':'',
		tsel5: pos==5 ? 'selected':'',
		tsel6: pos==6 ? 'selected':'',
		});
	
	form = form.replace('@@assignblock', '')
	
	var gschk = ""; if(req.user_row[0]['excludeassign']==1) {gschk = "checked"}	
	form = form.replace('@@gschk', gschk)
	var gphide = ""; if(req.user_row[0]['groupcount']==0) {gphide = 'style="display:none;"'}
	form = replace_all(form, '@@gphide', gphide)
	form = form.replace('@@groupcount', req.user_row[0]['groupcount'])
	
	
	//duplicate
	var authrows = ''
	var ti = 8
	var alist = []
	for(var x=0;x<req.assoc_authorities.length;x++){
		//console.log(req.assoc_authorities[x])
		var ok = false
		if(gp==0){ok = true}
		if(gp==1 && req.assoc_authorities[x]['id']!=3){ok = true}
		if(ok){
			alist.push(req.assoc_authorities[x]['id'])
			var bit = _auth_row_td_all
			
			//this is what is different
			var chk = ""
			if(req.assoc_authorities[x]['id']==req.user_row[0]['authority']){chk = "checked"}		
			bit = bit.replace('@@chk', chk)
			//
			
			if(req.user_row[0]['authority']==2) {
				credit = todollar(req.user_row[0]['limit'])
			} else {
				credit = todollar(req.assoc_authorities[x]['limit'])
			}
			
			if(req.assoc_authorities[x]['id']==2) {
				bit += _auth_row_td_type2
				ti+=1			
			} else {
				bit += _auth_row_td_type_other
			}		
			authrows += replace_all_array(bit, {
				ti: ti,
				uadmin: 1,
				id: req.assoc_authorities[x]['id'],
				gpinputshow: '',
				authname: req.assoc_authorities[x]['name'],
				credit: credit,
				deflimit: todollar(req.assoc_authorities[x]['limit'])
			})		
			ti+=1
		}
	}
	form = form.replace('@@auth_rows', authrows)
	form = form.replace('@@alist', alist)

	//duplicate
	var ti2 = ti + 1
	var notifsort = [0, 5, 1, 2, 3, 4]
	var notifications = ["", "New Inquiries/Billing Inquiries", "Awaiting Approval", "Guest Reopened/Guest Response", "Status Report Auto", "New Inquiries/Folio Copies"]
	var notif = ""; var nlist = []
	var start = 1
	//console.log(req.user_row[0]['notifications'])
	
	var user_notif_list = []
	//console.log(req.user_row[0]['notifications']);
	if(req.user_row[0]['notifications']){
		var lst = req.user_row[0]['notifications'].split(",")
		if(lst){
			for(var x=0;x<lst.length;x++){
				user_notif_list.push(lst[x])
			}
		}
	}
		for(var x=start; x<notifsort.length;x++){
				var xy = notifsort[x]
				nlist.push(xy)
				
				//different
				var chk = "";
				for(var y=0;y<user_notif_list.length;y++){
					if(notifsort[x]==user_notif_list[y]){chk = "checked"; break;}
				}
				
				notif += replace_all_array(_notify_row, {
					xy: xy,
					chk: '',
					name: notifications[xy],
					readonly: '',
					ti2: ti2,
					chk: chk
				})
				ti2+=1
		}
	
	form = form.replace('@@notif', notif)
	form = form.replace('@@nlist', nlist)

	//duplicate
	var selprop = ''
	var proplist = []
	if(req.user_admin == 1) {
		var rows = ''
		//console.log(req.user_row[0])
		if(req.user_row[0]['property_ids']){
			var user_prop_list = req.user_row[0]['property_ids'].split(",")
		} else {
			var user_prop_list = []
		}
		
			
			for(var x=0;x<req.user_properties.length;x++){
				//console.log(req.user_properties[x]['id']);
				proplist.push(req.user_properties[x]['id'])
				ti2 += 1
				
				//different
				var chk = "";
				for(var y=0;y<user_prop_list.length;y++){
					if(req.user_properties[x]['id']==user_prop_list[y]){chk = "checked"; break;}
				}
				
				var row = replace_all_array(_user_prop_tr, {
					ti2: ti2,
					upchk: '',
					readonly: '',
					pid: req.user_properties[x]['id'],
					pname: req.user_properties[x]['name'],
					upchk: chk
				})
				rows += row
			}
		
		selprop = _user_prop_table.replace('@@rows', rows)
	} else {
		
	}	
	form = form.replace('@@propdivlist', replace_all_array(_user_prop_div_list, {uadmin: req.user_admin, proplist: proplist.join(";")}))
	form = form.replace('@@selprop', selprop)
	
	if(gp==0){
		var buttons = replace_all(_edit_user_buttons, '@@id', req.query.id)
	} 
	
	if(gp==1){
		var buttons = replace_all(_edit_group_buttons, '@@id', req.query.id)
	} 
	
	if(req.user_row[0]['superadmin']==0){
		buttons = buttons.replace('@@delete_associate_button', _delete_associate_button)
		buttons = buttons.replace('@@delete_associate_message', "Delete this associate?  Tickets in process by this associate may be orphaned.")
	} else {
		buttons = buttons.replace('@@delete_associate_button', '')
		buttons = buttons.replace('@@delete_associate_message', '')
	}
	form = form.replace('@@buttons', buttons)
	
	if(_debug){console.log(form)}
	return form
}

restapi.get('/edit-associate', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_associate_authorities,
	middleHandler_db_get_associate_row,

	function(req,res){		
	if(_debug){
		console.log("/edit-associate "+req.query.id);
		console.log(req.user_row[0]);
	}
	var form = common_user_group_edit(req, 0)
	res.write(form);
	res.end();
})

restapi.get('/edit-group', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_associate_authorities,
	middleHandler_db_get_associate_row,

	function(req,res){		
	if(_debug){
		console.log("/edit-group "+req.query.id);
		console.log(req.user_row[0]);
	}
	var form = common_user_group_edit(req, 1)	
	var g = req.user_row[0]['groupcount']
	var gcoptions = get_gc_options(g)
	form = form.replace('@@gcoptions', gcoptions)
	form = form.replace('@@groupcount', g)
	
	res.write(form);
	res.end();
})


function middleHandler_email_prep_reset_password(req, res, next) {
	//console.log("  middleHandler_email_prep_reset_password");
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){			
		var guid = require('guid');
		var g = guid.create()			
		var sql = "UPDATE users SET password = '', xcode = '"+g+"' WHERE autoID = "+req.query.a
		db.run(sql, function(err) {						
		}, function () {
			req.sendmail_from = env.sendmail_from_noreply
			req.sendmail_subject = 'RBP Software Solutions - Password Reset'
			req.sendmail_text = '\nTo reset your password on RBP Software Solutions, click on the following link or copy and past the link into your web browser.\n\n'+env.server+'/associate/pwres?xcode='+g+'\n\nSupport: 415-794-5262'
			req.sendmail_html = 'To reset your password on RBP Software Solutions, click on the following link or copy and past the link into your web browser.</p><br><a rel=\"nofollow\" target=\"_blank\" href=\"'+env.server+'/associate/pwres?xcode='+g+'\">'+env.server+'/associate/pwres?xcode='+g+'</a><br><br>Support: 415-794-5262'
			req.sendmail_okresponse = 'Password reset email sent'
			next();
		});		
	} else {
		next();
	}
}

function middleHandler_email_prep_reset_password_info(req, res, next) {
	//console.log("  middleHandler_email_prep_reset_password_info");
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){			
		var sql = "SELECT email FROM users WHERE autoID = "+req.query.a + " LIMIT 1"
		//console.log(sql)
		db.each(sql, function(err, row) {						
			req.sendmail_send = true;
			req.sendmail_to = row.email			
		}, function () {
			next();
		});		
	} else {
		next();
	}
}

restapi.get('/password-reset', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_email_prep_reset_password,
	middleHandler_email_prep_reset_password_info,
	middleHandler_send_message,
	function(req,res){		
	//console.log("/password-reset "+req.query.a);

	res.end();
})

function middleHandler_email_prep_assoc_reset_pw_info(req, res, next) {
	if(_debug){console.log("  middleHandler_email_prep_assoc_reset_pw_info");}
	req.userid = 0
	req.reset_email = ''
	var sql = "SELECT autoID as userid, superadmin, email, groupcount FROM users WHERE password = '' AND xcode = '"+req.query.xcode+"'"
	if(_debug){console.log(sql)}
	db.each(sql, function(err, row) {						
		req.userid = row.userid		
		req.reset_email = row.email.toLowerCase();
	}, function () {
		next();
	});		
}


restapi.get('/associate/pwres', 
	middleHandler_email_prep_assoc_reset_pw_info,
	function(req,res){		
	if(_debug){console.log("/associate/pwres "+req.userid);}
	if(req.userid > 0){
		res.cookie("rbpx-g",'', { signed: false });
		res.cookie("rbpx-u",req.reset_email, { signed: false });
		res.cookie("rbpx-z",req.query.xcode, { signed: false });	
		res.redirect('/');
	} else {
		res.write("ResetError")
		res.end()
	}	
})


//***************************************************************************************************************
//INQUIRIES
//***************************************************************************************************************
const _sql_db_common_inquiry = (function () {/*  
	SELECT inquiries.autoID as id, name, group_concat(inquiry_properties.pid, ',') as props, group_concat(inquiry_properties.sub_desc, ';;') as subs FROM inquiries 
	LEFT OUTER JOIN inquiry_properties ON inquiries.autoID = inquiry_properties.inqid WHERE inquiries.autoID = @@id LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_common_inquiry(req, res, next) {
	//console.log("  middleHandler_db_common_inquiry ");	
	req.inquiry_name = ''; req.inquiry_props = []; req.inquiry_subs = [];
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = _sql_db_common_inquiry.replace('@@id',req.query.id)
		db.each(sql, function(err, row) {
			req.inquiry_name = row.name; 
			if(row.props){
				req.inquiry_props = row.props.split(','); 
				req.inquiry_subs = row.subs.split(';;');
			}
		}, function () {next()});	
	} else {next()}
}

restapi.get('/add-inquiry', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_common_inquiry,

	function(req,res){console.log("/add-inquiry "+req.query.id);
	var form = 'System Error'
	var row_props = []
	if(req.user_superadmin==1){
		form = replace_all_array(_common_inquiry_form, {id: '0', namereadonly: '', name: '', footable_attributes: _footable_attributes, buttons: _inquiries_add_buttons})
		var rows = '';
		for(var y=0;y<req.user_properties.length;y++){
			var iid = req.user_properties[y]['id']
			row_props.push(iid)
			var bit = "<tr><td><input onchange='ckck("+iid+")' id='inq.ie.show-"+iid+"' name='inq.ie.show-"+iid+"' type='checkbox' style='float:left;margin-right: 6px;' value='User' tabindex='4' @@checked> @@name</td><td style='text-align:right;'><div id='inq.ie.prename-"+iid+"' style='display:inline;'> </div><input id='inq.ie.subdesc-"+iid+"' name='inq.ie.subdesc-"+iid+"' type='text' style='display:inline;' placeholder='@@placeholder' value='@@sub_desc' tabindex='5'></td></tr>"			
			var row = bit.replace('@@checked', 'checked');			
			row = replace_all_array(row, {sub_desc: '', name: req.user_properties[y]['name'], placeholder: req.inquiry_name})
			rows += row
		}
		form = replace_all_array(form, {rows: rows, row_props: row_props.join(',')})
	} 	
	res.write(form);
	res.end();
})

const _sql_db_common_inquiry_add = (function () {/*  
	INSERT INTO inquiries VALUES(NULL,(SELECT sortid FROM inquiries ORDER BY sortid DESC LIMIT 1),'@@name')
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

//TODO does not prevent duplicates	
function middleHandler_db_common_inquiry_add(req, res, next) {
	//console.log("  middleHandler_db_common_inquiry_add ");		
	req.inquiry_add_edit_err = '';
	req.inquiry_get_sql = "SELECT autoID, sortid, name, (SELECT count(*) as cnt FROM inquiries)as cnt FROM inquiries ORDER BY autoID DESC LIMIT 1"
	if(req.query.name.length == 0){
		req.inquiry_add_edit_err = 'Name cannot be blank'; next();
	} else {
		if(req.userid > 0 && req.user_superadmin == 1){
			db.run(_sql_db_common_inquiry_add.replace('@@name',req.query.name), function(err) {						
				req.inquiry_add_edit_err = err;
			}, function () {next()});	
		} else {next()}		
	}
}

function middleHandler_db_common_inquiry_get(req, res, next) {
	//console.log("  middleHandler_db_common_inquiry_get ");	
	req.inquiry_get = []; req.inquiry_newid = 0	
	//todo test && req.user_superadmin == 1 
	if(req.userid > 0 && req.inquiry_add_edit_err == ""){		
		db.each(req.inquiry_get_sql, function(err, row) {						
			req.inquiry_newid = row.autoID
			var val = {id: row.autoID, sortid: row.sortid, name: row.name, row: row.cnt}			
			req.inquiry_get.push(val);
		}, function () {next()});
	} else {next()}
}
	
function middleHandler_db_common_inquiry_add_props(req, res, next) {
	//console.log("  middleHandler_db_common_inquiry_add_props ");		
	//todo handle && req.user_superadmin == 1 
	if(req.userid > 0 && req.inquiry_add_edit_err == "" && req.inquiry_newid > 0){
		var insert_rows = []
		var props_list = req.query.propenab.split(",");
		for(var x=0;x<props_list.length;x++){
			var pi = props_list[x].split(":");
			if(pi[1]==1){insert_rows.push("(NULL,"+pi[0]+","+req.inquiry_newid+",2,'"+pi[2]+"')")}
		}
		//console.log(insert_rows);
		var sql = 'INSERT into inquiry_properties (autoID, pid, inqid, sortid, sub_desc) VALUES '+insert_rows.join(",") + ";"
		db.run(sql, function(err) {
			req.inquiry_add_edit_err += " " + err
		}, function () {next()});	
	} else {next()}
}

function middleHandler_db_common_inquiry_add_edit_row(req, res, next) {	
	//console.log("  middleHandler_db_common_inquiry_add_edit_row");
	if(req.inquiry_add_edit_err != "") {
		next();
	} else {
	
		var row = replace_all(_inquiries_tr, '@@id', req.inquiry_get[0]['id'])
		row = replace_all(row, '@@row', req.inquiry_get[0]['row'])
		row = row.replace('@@name', req.inquiry_get[0]['name'])
		
		var props_list = req.query.propenab.split(",");	
		var rtd = ""		
		for(var y=0;y<req.user_properties.length;y++){		
			var td_value = '';
			var td_subs = '';			
			for(var x=0;x<props_list.length;x++){						
				var pi = props_list[x].split(":");
				
				var p = parseInt(pi[0])
				var v = parseInt(pi[1])
				var d = pi[2]
				if(p==req.user_properties[y]['id']){
					if(v==1){
						//console.log(pi);
						//console.log(p+'=='+req.user_properties[y]['id']);			
						td_value = "<span class='fa fa-check'></span>"
						if(d.length>0){
							td_subs = "<span class='fa fa-asterisk'></span>"
						}
						break;
					}
				}			
			}
			rtd=rtd+'<td>'+td_value+td_subs+'</td>'
		}
		if(req.user_superadmin==1){
			rtd=rtd+'<td></td>'
		}
		row = row.replace('@@propstds', rtd)	
		req.inquiry_add_edit_row = row;
		next();
	}
}


restapi.get('/inquiry-add-accept', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_common_inquiry_add,
	middleHandler_db_common_inquiry_get,
	middleHandler_db_common_inquiry_add_props,
	middleHandler_db_common_inquiry_add_edit_row,
		
	function(req,res){
	//console.log("/inquiry-add-accept");
	//todo only admin
	if(req.inquiry_add_edit_err != "") {
		res.write('alert::::'+req.inquiry_add_edit_err);
		res.end();
	} else {			
		var html = "tr::::inq-tr-"+req.inquiry_get[0]['id']+"::::"+req.inquiry_add_edit_row;
		res.write(html);
		res.end();
	}
})
		
restapi.get('/edit-inquiry', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_common_inquiry,
	
	function(req,res){
	//console.log("/edit-inquiry "+req.query.id);
	
	var form = replace_all(_common_inquiry_form,'@@id',req.query.id);
	if(req.user_superadmin==1){
		form = form.replace('@@namereadonly', '')
	} else {
		form = form.replace('@@namereadonly', 'readonly')
	}
	form = replace_all(form,'@@name', req.inquiry_name);
	form = form.replace('@@footable_attributes', _footable_attributes);
	
	var buttons = replace_all_array(_inquiries_edit_buttons, { id: req.query.id, row: req.query.row})
	buttons = buttons.replace('@@row', req.query.row);
	
	form = form.replace('@@buttons', buttons);
	var rows = ''; var row_props = []
	for(var y=0;y<req.user_properties.length;y++){
		var id = req.user_properties[y]['id']
		row_props.push(id)
		var bit = "<tr><td><input onchange='ckck("+id+")' id='inq.ie.show-"+id+"' name='inq.ie.show-"+id+"' type='checkbox' style='float:left;margin-right: 6px;' value='User' tabindex='4' @@checked> @@name</td><td style='text-align: right;'><div id='inq.ie.prename-"+id+"' style='display:inline;'> @@placeholder</div> <input id='inq.ie.subdesc-"+id+"' name='inq.ie.subdesc-"+id+"' @@disabled type='text' style='display:inline;' placeholder='' value='@@sub_desc' tabindex='5'></td></tr>"
		var checked = ''; var sub_desc = ''; var disabled = 'disabled'; var placeholder = ''
		for(var z=0;z<req.inquiry_props.length;z++){
			if(req.inquiry_props[z]==req.user_properties[y]['id']){
				checked = 'checked';
				sub_desc = req.inquiry_subs[z]				
				disabled = '';				
				placeholder = req.inquiry_name + ' - ';
			}
		}
		var row = bit.replace('@@checked', checked);
		var row = row.replace('@@disabled', disabled);
		var row = row.replace('@@placeholder', placeholder);
		row = replace_all_array(row, {sub_desc: sub_desc, name: req.user_properties[y]['name']})
		rows += row
	}
	form = form.replace('@@rows', rows)
	form = form.replace('@@row_props', row_props.join(','))
	
	res.write(form);
	res.end();
})

const _sql_db_common_inquiry_edit = (function () {/*  
	UPDATE inquiries SET name = '@@name' WHERE autoID = @@id;
	DELETE FROM inquiry_properties WHERE inqid = @@id;	
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

//TODO does not prevent duplicates	
function middleHandler_db_common_inquiry_edit(req, res, next) {
	//console.log("  middleHandler_db_common_inquiry_edit ");		
	req.inquiry_add_edit_err = '';
	req.inquiry_newid = 0;	//updated herein for use in _get_sql
	req.inquiry_get_sql = "SELECT autoID, sortid, name, '@@row' as cnt FROM inquiries WHERE autoID = @@id"
	if(req.query.name.length == 0){
		req.inquiry_add_edit_err = 'Name cannot be blank'; next();
	} else {
		//todo handle && req.user_superadmin == 1
		if(req.userid > 0){
			req.inquiry_newid = req.query.id; //for sharing _add_props
			req.inquiry_get_sql = replace_all_array(req.inquiry_get_sql, {id: req.inquiry_newid, row: req.query.row});
			if(req.user_superadmin == 1){								
				var sql = replace_all_array(_sql_db_common_inquiry_edit, {id: req.query.id, name: decode(req.query.name)})
			} else {
				var sql_props = []
				for(var y=0;y<req.user_properties.length;y++){sql_props.push("pid = " + req.user_properties[y]['id']+" ")}				
				var sql = "DELETE FROM inquiry_properties WHERE inqid = "+req.inquiry_newid+" AND ( " + sql_props.join("OR ") + " )"		
			}
			db.run(sql, function(err) {						
				req.inquiry_add_edit_err = err;
			}, function () {next()});	
		} else {next()}		
	}
}

restapi.get('/inquiry-edit-accept', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_common_inquiry_edit,
	middleHandler_db_common_inquiry_add_props,
	middleHandler_db_common_inquiry_get,
	middleHandler_db_common_inquiry_add_edit_row,
	
	
	function(req,res){		
	//console.log("/inquiry-edit-accept "+req.query.id);
	//todo only admin
	if(req.inquiry_add_edit_err != "") {
		res.write('alert::::'+req.inquiry_add_edit_err);
		res.end();
	} else {	
		var html = "tr::::inq-tr-"+req.inquiry_get[0]['id']+"::::"+req.inquiry_add_edit_row;
		res.write(html);
		res.end();
	}
})

//***************************************************************************************************************
//DEPARTMENTS
//***************************************************************************************************************

const _sql_db_common_department = (function () {/*  
	SELECT departments.autoID as id, name,
	group_concat(department_properties.pid, ',') as props,
	group_concat(department_properties.notifications, ',') as notifications,
	(SELECT group_concat(coalesce(department_users.pid || ',' || users.autoID ||',' || users.fname || ' ' || users.lname || ',' || users.groupcount,''),';;')	    
	    FROM users 
	    INNER JOIN department_users ON users.autoID = department_users.userID
	    WHERE department_users.departmentID = departments.autoID
	) as associates
	
	FROM departments
	INNER JOIN department_properties ON departments.autoID = department_properties.deptid
	LEFT OUTER JOIN department_users ON department_users.departmentID = departments.autoID
	AND department_users.pid = department_properties.pid
	WHERE departments.autoID = @@id LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_common_department(req, res, next) {
	//console.log("  middleHandler_db_common_department ");	
	req.department_name = '';
	req.department_props = [];
	req.department_notifs = [];
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = '';		
		sql = _sql_db_common_department.replace('@@id',req.query.id);
		console.log(sql)
		db.each(sql, function(err, row) {			
			req.department_name = row.name;	
			req.department_props = row.props.split(',');
			req.department_notifs = row.notifications.split(',');			
			if(row.associates==null){
				req.department_associates = '';
			}else{
				req.department_associates = row.associates.split(';;');
			}
		}, function () {
			next();
		});
	
	} else {
		next();
	}
}

const _sql_admin_property_users = (function () {/*  	
	select user_properties.userID as uid, fname, mi, lname, email from user_properties inner join users on user_properties.userID = users.autoID where propertyID = @@id
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_property_associates(req, res, next) {
	//console.log("  middleHandler_db_property_associates ");	
	req.property_x_associates = []
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = replace_all_array(_sql_admin_property_users,
			{id: req.query.id})
		db.each(sql, function(err, row) {			
			req.property_x_associates.push(row)
		}, function () {
			next();
		});
	
	} else {
		next();
	}
}

const _sql_admin_department_sql_associates = (function () {/*  	
	select userID as uid from department_users where pid = @@id and departmentID = @@row
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_department_associates(req, res, next) {
	//console.log("  middleHandler_db_department_associates ");	
	req.department_x_associates = []
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = replace_all_array(_sql_admin_department_sql_associates,
			{id: req.query.id, row: req.query.row})
		db.each(sql, function(err, row) {			
			req.department_x_associates.push(row)
		}, function () {
			next();
		});
	
	} else {
		next();
	}
}

const _sql_dmin_with_properties_extra_dept_users = (function () {/*  	
	select properties.pname,
	group_concat(coalesce(user_properties.userID || ':' || users.fname || ' ' || users.mi || ' ' || users.lname,''), ',') as peeps,
	(SELECT group_concat(coalesce(department_users.userID || ':' || department_users.departmentID,''), ', ')
	FROM department_users
	WHERE department_users.pid = properties.autoID
	) AS depts
	from user_properties 
	INNER JOIN properties ON user_properties.propertyID = properties.autoID 
	INNER JOIN users ON user_properties.userID = users.autoID 
	@@sqlor
	group by properties.autoID
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_db_get_user_properties_extra_dept_users(req, res, next) {
	//console.log("  middleHandler_db_get_user_properties_extra_dept_users");	
	var sql = '';
	//WHERE user_properties.propertyID = 10 or user_properties.propertyID = 11
	if(req.userid > 0){
		sql = _sql_dmin_with_properties_extra_dept_users.replace('@@userid', req.userid);
		if(req.user_superadmin==1){
			sql = sql.replace('@@sqlor','')
		}else if(req.user_admin==1){
				if(req.user_properties_dept_users.length>0){
					var sqlorlist = []
					for(var x=0;x<req.user_properties_dept_users.length;x++){
						sqlorlist.push('propertyID = '+req.user_properties_dept_users[x]['id'])
					}
					sql = _sql_admin_properties.replace('@@sqlor','WHERE '+sqlorlist.join(' OR '))
				}			
		} 
		req.user_properties_dept_users = [];	
		db.each(sql, function(err, row) {
			var val = {id: row.propid, name: row.pname, peeps: row.peeps, depts: row.depts}
			req.user_properties_dept_users.push(val)
		}, function () {	
			if(req.user_properties_dept_users.length>0){				
				req.propid = req.user_properties_dept_users[0]['id']				
				//console.log('ack1 '+req.propid)
			}
			next();
		});
	} else {
		next();
	}
}

restapi.get('/add-department', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,	
	middleHandler_db_common_department,

	function(req,res){		
	//console.log("/add-department "+req.query.id);
	var form = 'System Error'
	var row_props = []
	if(req.user_superadmin==1){
		var form = replace_all_array(_common_department_form, {id: 0, namereadonly: '', name: '', footable_attributes: _footable_attributes, buttons: _departments_add_buttons});
		var rows = '';
		for(var y=0;y<req.user_properties.length;y++){
			var id = req.user_properties[y]['id']
			row_props.push(id)
			var bit = _departments_bit
			var row = bit.replace('@@checked', 'checked');			
			row = replace_all_array(row, {id: id, name: req.user_properties[y]['name']})
			rows += row
		}
		form = replace_all_array(form, {rows: rows, row_props: row_props.join(',')})
	} 	
	res.write(form);
	res.end();
})

const _sql_db_common_department_add = (function () {/*  
	INSERT INTO departments VALUES(NULL,(SELECT sortid FROM departments ORDER BY sortid DESC LIMIT 1),'@@name')
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

//TODO does not prevent duplicates	
function middleHandler_db_common_department_add(req, res, next) {
	//console.log("  middleHandler_db_common_department_add ");		
	req.department_add_edit_err = '';
	req.department_get_sql = "SELECT autoID, sortid, name, (SELECT count(*) as cnt FROM departments)as cnt FROM departments ORDER BY autoID DESC LIMIT 1"
	if(req.query.name.length == 0){
		req.department_add_edit_err = 'Name cannot be blank'; next();
	} else {
		if(req.userid > 0 && req.user_superadmin == 1){
			db.run(_sql_db_common_department_add.replace('@@name',req.query.name), function(err) {						
				req.department_add_edit_err = err;
			}, function () {next()});	
		} else {next()}		
	}
}

function middleHandler_db_common_department_edit(req, res, next) {
	if(_debug){console.log("  middleHandler_db_common_department_edit ");}
	req.department_add_edit_err = '';
	req.department_get_sql = "SELECT autoID, sortid, name, (SELECT count(*) as cnt FROM departments)as cnt FROM departments WHERE autoID = "+req.query.deptid
	if(req.query.name.length == 0){
		req.department_add_edit_err = 'Name cannot be blank'; next();
	} else {
		if(req.userid > 0 && req.user_superadmin == 1){
		var sql = _sql_db_common_department_add.replace('@@name',req.query.name)
		if(_debug){console.log(sql)}
			db.run(sql, function(err) {						
				req.department_add_edit_err = err;
			}, function () {next()});	
		} else {next()}		
	}
}

function middleHandler_db_common_department_get(req, res, next) {
	if(_debug){console.log("  middleHandler_db_common_department_get ")}
	req.department_get = []; req.department_newid = 0	
	//todo test && req.user_superadmin == 1 
	if(req.userid > 0 && req.department_add_edit_err == ""){		
		if(_debug){console.log(req.department_get_sql)}
		db.each(req.department_get_sql, function(err, row) {						
			req.department_newid = row.autoID
			var val = {id: row.autoID, sortid: row.sortid, name: row.name, row: row.cnt}			
			req.department_get.push(val);
		}, function () {next()});
	} else {next()}
}

function middleHandler_db_common_department_add_props(req, res, next) {
	//console.log("  middleHandler_db_common_department_add_props ");		
	//todo handle && req.user_superadmin == 1 
	if(req.userid > 0 && req.department_add_edit_err == "" && req.department_newid > 0){
		var insert_rows = []
		var props_list = req.query.propenab.split(",");
		for(var x=0;x<props_list.length;x++){
			var pi = props_list[x].split(":");
			if(pi[1]==1){insert_rows.push("(NULL,"+pi[0]+","+req.department_newid+",0,'"+pi[1]+"')")}
		}
		var sql = 'INSERT into department_properties (autoID, pid, deptid, notifications, sortid) VALUES '+insert_rows.join(",") + ";"
		db.run(sql, function(err) {
			req.department_add_edit_err += " " + err
		}, function () {next()});	
	} else {next()}
}

function middleHandler_db_common_department_add_edit_row(req, res, next) {	
	//console.log("  middleHandler_db_common_department_add_edit_row");
	
	if(req.department_add_edit_err != "") {
		next();
	} else {
	
		var row = replace_all(_departments_tr, '@@id', req.department_get[0]['id'])
		row = replace_all(row, '@@row', req.department_get[0]['row'])
		row = row.replace('@@name', req.department_get[0]['name'])
		
		var props_list = req.query.propenab.split(",");	
		var rtd = ""		
		for(var y=0;y<req.user_properties.length;y++){		
			var td_value = '';
			var td_subs = '';			
			for(var x=0;x<props_list.length;x++){						
				var pi = props_list[x].split(":");
				
				var p = parseInt(pi[0])
				var v = parseInt(pi[1])
				var n = pi[2]
				if(p==req.user_properties[y]['id']){
					if(v==1){
						td_value = "<span class='fa fa-check'></span>"
						if(n.length>0){
							td_subs = "<span class='fa fa-asterisk'></span>"
						}
						break;
					}
				}			
			}
			rtd=rtd+'<td>'+td_value+td_subs+'</td>'
		}
		if(req.user_superadmin==1){
			rtd=rtd+'<td></td>'
		}
		row = row.replace('@@propstds', rtd)	
		req.department_add_edit_row = row;
		next();
	}
}

restapi.get('/department-add-accept', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_common_department_add,
	middleHandler_db_common_department_get,
	middleHandler_db_common_department_add_props,
	middleHandler_db_common_department_add_edit_row,
		
	function(req,res){
	//console.log("/department-add-accept");
	//todo only admin
	if(req.department_add_edit_err != "") {
		res.write('alert::::'+req.department_add_edit_err);
		res.end();
	} else {					
		var html = "tr::::dept-tr-"+req.department_get[0]['id']+"::::"+req.department_add_edit_row;
		res.write(html);
		res.end();
	}
})

restapi.get('/edit-department', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_common_department,
	
	function(req,res){		
	//console.log("/edit-department "+req.query.id);
	var form = replace_all(_common_department_form,'@@id',req.query.id);
	if(req.user_superadmin==1){
		form = form.replace('@@namereadonly', '')
	} else {
		form = form.replace('@@namereadonly', 'readonly')
	}
	form = replace_all(form,'@@name', req.department_name);
	form = form.replace('@@footable_attributes', _footable_attributes);
	departments_edit_buttons = replace_all_array(_departments_edit_buttons, {id: req.query.id, row: req.query.row})
	form = form.replace('@@buttons', departments_edit_buttons);	
	var rows = ''; var row_props = []
	for(var y=0;y<req.user_properties.length;y++){
		console.log(req.user_properties[y])
		var id = req.user_properties[y]['id']
		row_props.push(id)		
		var bit = replace_all_array(_department_adm_row_bit, {id: id, row: req.query.row})
		var checked = '';
		var checked2 = '';
		var usernames = [];
		
		for(var z = 0;z < req.department_props.length; z++) {
			if(req.department_props[z]==req.user_properties[y]['id']){
				checked = 'checked';				
				if(req.department_notifs[z]==1){
					checked2 = 'checked';				
				}
			}			
						
		}
		
		for(var a=0;a<req.department_associates.length;a++){
				var as = req.department_associates[a].split(',')
				if(as[0]==req.user_properties[y]['id']){
					if(parseInt(as[3])>0){
						usernames.push("<em>"+as[2]+"</em>")
					} else {
						usernames.push(as[2])
					}
				}
			}
			
		var row = bit.replace('@@checked', checked);
		row = row.replace('@@checked2', checked2);
		row = row.replace('@@usernames', usernames.join(', '));
		row = row.replace('@@name', req.user_properties[y]['name']);
		row = row.replace('@@placeholder', req.department_name);		
		rows += row
	}
	form = form.replace('@@rows', rows)
	form = form.replace('@@row_props', row_props.join(','))
	
	//"<option value='$propid'>$pname</option>"
	
	res.write(form);
	res.end();
})

restapi.get('/edit-department-users', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_property_associates,
	middleHandler_db_department_associates,
	
	function(req,res){		
	console.log("/edit-department-users "+req.query.id);
	console.log(req.property_x_associates);
	console.log(req.department_x_associates);
	
	var rows = '';
		for(var y=0;y<req.property_x_associates.length;y++){
			var u = req.property_x_associates[y]
			var uid = u['uid']
			var uname = u['fname']+' '+u['mi']+' '+u['lname']
			var uemail = u['email']
			var checked = ''
			for(var z=0;z<req.department_x_associates.length;z++){
				if(req.department_x_associates[z]['uid']==uid){
					checked = "checked"
				}
			}
			rows += "<tr><td><input uid='"+uid+"' class='deptusr-@@id' id='deptusr-@@id-"+uid+"' type='checkbox' "+checked+" onclick='cancelBubble(event);'/></td><td><label>"+uname+"</label></td></tr>"
			//var row = replace_all(_property_edit_users_row, '@@uid', uid)
			//var row = replace_all(row, '@@uname', uname)
			//var row = replace_all(row, '@@email', uemail)
			//var bit = "<tr><td><input id='dept.de.show' name='dept.de.show' type='checkbox' style='float:left;margin-right: 6px;' value='User' tabindex='4' @@checked> @@name</td><td><input id='dept.de.notify' name='dept.de.notify' type='checkbox' style='' value='User' tabindex='4' @@checked2></td><td>@@usernames</td></tr>"
			//var row = bit.replace('@@checked', 'checked');			
		}
	
		
	res.write(replace_all_array(_prop_dept_user_table, {rows: rows, id: req.query.id, row: req.query.row}))
	res.end();
})

function middleHandler_db_delete_property_department_users(req, res, next) {
	if(req.userid > 0){
		var sql = "DELETE FROM department_users WHERE pid = "+req.query.id+" AND departmentID = "+req.query.row
		db.run(sql, function(err) {		
		}, function () {	
		next();
		});	
	} else {
		next();
	}	
}

function middleHandler_db_add_property_department_users(req, res, next) {
	var usrs = req.query.usrs.split(":")
	if(req.userid > 0 && usrs.length > 0){
		var sqlvalues = []
		for(var x=0;x<usrs.length;x++){
			sqlvalues.push("(NULL, "+req.query.id+","+req.query.row+","+usrs[x]+")")
		}
		var sql = "INSERT INTO department_users VALUES"+sqlvalues.join(",")
		db.run(sql, function(err) {		
		}, function () {	
		next();
		});	
	} else {
		next();
	}	
}

restapi.get('/save-department-users', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_delete_property_department_users,
	middleHandler_db_add_property_department_users,
	middleHandler_db_property_associates,
	middleHandler_db_department_associates,
	
	function(req,res){		
	console.log("/save-department-users "+req.query.id + " " + req.query.row);
	
	var usernames = []
	for(var y=0;y<req.property_x_associates.length;y++){
		var u = req.property_x_associates[y]
		var uid = u['uid']
		var uname = u['fname']+' '+u['mi']+' '+u['lname']
		var uemail = u['email']
		var checked = ''
		for(var z=0;z<req.department_x_associates.length;z++){
			if(req.department_x_associates[z]['uid']==uid){
				usernames.push(uname)
			}
		}
	}
	res.write(usernames.join(", "))
	res.end()
})

const _sql_db_superadmin_dept_edit = (function () {/*  	
	UPDATE departments SET name = '@@name' WHERE autoID = @@id
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function middleHandler_department_edit_super_admin_test(req, res, next) {
	//console.log("  middleHandler_department_edit_super_admin_test");	
	if(req.userid > 0 && req.user_superadmin == 1 && req.query.name.length > 1){
		sql = _sql_db_superadmin_dept_edit.replace('@@id', req.query.deptid);		
		sql = sql.replace('@@name', decode(req.query.name))		
		db.run(sql, function(err) {			
		}, function () {	
			next();
		});
	} else {
		next();
	}
}

const _sql_db_admin_depts_delete = (function () {/*  	
	DELETE FROM department_properties 
	@@sqlandor AND deptid = @@dept
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
	
function middleHandler_department_delete_admin(req, res, next) {
	//console.log("  middleHandler_department_delete_admin");	
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = _sql_db_admin_depts_delete.replace('@@dept', req.query.deptid);		
		sql = sql.replace('@@sqlandor', req.user_sqlor_for_tickets)
		db.run(sql, function(err) {			
		}, function () {	
			next();
		});
	} else {
		next();
	}
}


const _sql_db_admin_depts_edit = (function () {/*  	
	INSERT OR REPLACE INTO department_properties (autoID, pid, deptid, notifications, sortid) 
	VALUES @@insertvalues
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
	
function middleHandler_department_edit_admin_update(req, res, next) {
	//console.log("  middleHandler_department_edit_admin_update");	
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var bits = []
		for(var x=0;x < req.user_properties.length; x++){
			var show = parseInt(req.query.show.substr(x,1))
			if(show==1){
				var notif = parseInt(req.query.notify.substr(x,1))
				var pid = req.user_properties[x]['id']
				var did = req.query.deptid
				var bit = "((SELECT autoID FROM department_properties WHERE pid = "+pid+" AND deptid = "+did+"), "+pid+", "+did+", "+notif+", 0)"
				bits.push(bit)
			}			
		}
		var bitsql = bits.join(",")+";"
		//console.log(bitsql)
		var sql = _sql_db_admin_depts_edit.replace('@@insertvalues', bitsql)
		db.run(sql, function(err) {			
		}, function () {	
			next();
		});
	} else {
		next();
	}
}


restapi.get('/department-edit-accept', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_department_edit_super_admin_test,
	middleHandler_department_delete_admin,
	middleHandler_department_edit_admin_update,	
	middleHandler_db_common_department_edit,
	middleHandler_db_common_department_get,
	function(req,res,next){req.query.id = req.query.deptid;next();},
	middleHandler_db_common_department,
	function(req,res){
	var text = ""
	console.log(req.department_notifs);
	if(req.errors.length==0){
		var row = _departments_tr;
		var temp_props = req.department_props
		var temp_notifs = req.department_notifs
		var rtd = ''
		for(var y=0;y<req.user_properties.length;y++){
			var td_value = '';
			var td_notifs = '';
			var td_assocs = '';
			for(var z=0;z<temp_props.length;z++){
				if(temp_props[z]==req.user_properties[y]['id']){
					td_value = "<span class='fa fa-check'></span>"									
					if(temp_notifs[z]==1){
						td_notifs = "<span class='fa fa-envelope-o'></span>"
					}
				}
										
			}
			
			rtd=rtd+'<td>'+td_value+td_notifs+'</td>'
		}			
		if(req.user_superadmin==1){
			rtd=rtd+'<td></td>'
		}
		row = row.replace('@@propstds',rtd);

		text = "tr::::dept-tr-"+req.query.deptid+":::: "+replace_all_array(row, req.department_get[0])
	}
	res.write(text);
	res.end();
})

/*
/department-edit-accept?
	show="+desh.join("")+"&
	notify="+denf.join("")+"&
	row="+@@row+"&
	deptid="+@@id+"&
	name="+encode(dena)
*/

const _sql_db_common_property = (function () {/*  
	SELECT properties.autoID as id, hid, pname, shortname, email, phone, fax, city, state, zip, css_url, css_content, homepage.para2 as para2, homepage.para3 as para3,
	em_create_from, em_create_subject, em_create_body,
	em_process_from, em_process_subject, em_process_body,
	em_close_from, em_close_subject, em_close_body,
	(SELECT group_concat(coalesce(users.autoID ||',' || users.fname || ' ' || users.mi || ' ' || users.lname || ',' || users.email,','),';;')	    	    
	    FROM users 
	    INNER JOIN user_properties ON users.autoID = user_properties.userID
	    WHERE user_properties.propertyID = properties.autoID
	) as associates
	
	FROM properties
	INNER JOIN homepage ON homepage.pid = properties.autoID
	LEFT OUTER JOIN user_properties ON user_properties.propertyID = properties.autoID AND properties.autoID = user_properties.propertyID
	WHERE properties.autoID = @@id LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function middleHandler_db_common_property(req, res, next) {
	//console.log("  middleHandler_db_common_property ");	
	req.property_name = '';
	req.property_detail = []
	req.property_associates = [];
	if(req.userid > 0 && (req.user_admin == 1 || req.user_superadmin == 1)){
		var sql = '';		
		sql = _sql_db_common_property.replace('@@id',req.query.id);
		db.each(sql, function(err, row) {			
			req.property_name = row.pname;	
			var val = {id: row.id, hid: row.hid, pname: row.pname, email: row.email, shortname: row.shortname, phone: row.phone, fax: row.fax, city: row.city, state: row.state, zip: row.zip, css_url: row.css_url, para2: row.para2, para3: row.para3, em_create_from: row.em_create_from, em_create_subject: row.em_create_subject, em_create_body: row.em_create_body, em_process_from: row.em_process_from, em_process_subject: row.em_process_subject, em_process_body: row.em_process_body, em_close_from: row.em_close_from, em_close_subject: row.em_close_subject, em_close_body: row.em_close_body}
			req.property_detail.push(val)
			if(row.associates){req.property_associates = row.associates.split(';;');}
			if(row.associates==null){
				req.property_associates = '';
			}else{
				req.property_associates = row.associates.split(';;');
			}
		}, function () {
			next();
		});
	
	} else {
		next();
	}
}

restapi.get('/edit-property', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_common_property,
	
	function(req,res){		
	//console.log("/edit-property "+req.query.id);
	var form = replace_all(_common_property_form,'@@pid',req.query.id);
	form = form.replace('@@content', _common_property_main_form);
	
	var rows = '';
		for(var y=0;y<req.property_associates.length;y++){
			var u = req.property_associates[y].split(',');
			var uid = u[0]
			var uname = u[1]
			var uemail = u[2]
			var row = replace_all(_property_edit_users_row, '@@uid', uid)
			var row = replace_all(row, '@@uname', uname)
			var row = replace_all(row, '@@email', uemail)
			//var bit = "<tr><td><input id='dept.de.show' name='dept.de.show' type='checkbox' style='float:left;margin-right: 6px;' value='User' tabindex='4' @@checked> @@name</td><td><input id='dept.de.notify' name='dept.de.notify' type='checkbox' style='' value='User' tabindex='4' @@checked2></td><td>@@usernames</td></tr>"
			//var row = bit.replace('@@checked', 'checked');
			rows += row
		}
	var property_edit_users_section = _property_edit_users_section.replace('@@user_rows', rows)
	
	var common_property_more_form = _common_property_more_form.replace('@@users', property_edit_users_section)
	form = form.replace('@@more', common_property_more_form);
	form = form.replace('@@buttons', _property_edit_admin_buttons);	
	
	if(req.user_superadmin==1){
		var common_property_super_global_options = replace_all(_common_property_super_global_options, '@@id', req.query.id)
		form = form.replace('@@global_options', common_property_super_global_options);
	} else {
		form = form.replace('@@global_options', '');
	}
	form = replace_all(form,'@@pname', req.property_name);
	form = replace_all_array(form, req.property_detail[0])
	form = form.replace('@@footable_attributes', _footable_attributes);
	
	/*
	form = form.replace('@@buttons', _properties_edit_buttons);	
	
	var rows = '';
	for(var y=0;y<req.user_properties.length;y++){
		var bit = "<tr><td><input id='dept.de.show' name='dept.de.show' type='checkbox' style='float:left;margin-right: 6px;' value='User' tabindex='4' @@checked> @@name</td><td><input id='dept.de.notify' name='dept.de.notify' type='checkbox' style='' value='User' tabindex='4' @@checked2></td><td>@@usernames</td></tr>"
		var checked = '';
		var usernames = [];
		
		for(var z=0;z<req.department_props.length;z++){
			
			if(req.department_props[z]==req.user_properties[y]['id']){
				checked = 'checked';				
			}			
		}
		
		for(var a=0;a<req.department_associates.length;a++){
				var as = req.department_associates[a].split(',')
				if(as[0]==req.user_properties[y]['id']){
					usernames.push(as[2])
				}
			}
			
		var row = bit.replace('@@checked', checked);
		row = row.replace('@@usernames', usernames.join(', '));
		row = row.replace('@@name', req.user_properties[y]['name']);
		row = row.replace('@@placeholder', req.department_name);		
		rows += row
	}
	form = form.replace('@@rows', rows)
		
			
	
	//"<option value='$propid'>$pname</option>"
	*/
	form = replace_all(form,'@@pid',req.query.id);
	res.write(form);
	res.end();
})

function middleHandler_db_common_property_email_messages(req, res, next) {
	if(_debug){console.log("  middleHandler_db_common_property_email_messages ");}
	if(req.userid > 0 && req.user_superadmin == 1 && req.query.id){		
		var em_from = req.query.frm.toLowerCase();
		var em_subject = decode(req.query.sub);
		var em_body = decode(req.query.body);
		var sql = ''
		if(req.query.cat == "create"){sql = "UPDATE homepage SET em_create_from = '"+em_from+"', em_create_subject = '"+em_subject+"', em_create_body = '"+em_body+"' WHERE pid = " + req.query.id}
		if(req.query.cat == "process"){sql = "UPDATE homepage SET em_process_from = '"+em_from+"', em_process_subject = '"+em_subject+"', em_process_body = '"+em_body+"' WHERE pid = " + req.query.id}
		if(req.query.cat == "close"){sql = "UPDATE homepage SET em_close_from = '"+em_from+"', em_close_subject = "+em_subject+"', em_close_body = '"+em_body+"' WHERE pid = " + req.query.id}
		if(_debug){console.log(sql)}
		db.run(sql, function(err) {						
			
		}, function () {next()});	
	} else {next()}		
}
restapi.get('/property-edit-accept-email', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_common_property,
	middleHandler_db_common_property_email_messages,
	function(req,res){		
	if(_debug){console.log("/property-edit-accept-email "+req.query.id);}

	res.end();
})

function middleHandler_db_remove_associate(req, res, next) {
	if(_debug){console.log("  middleHandler_db_remove_associate ");}
	if(req.userid > 0){		
		var sql = "DELETE FROM user_properties WHERE userID = "+req.query.a+" AND propertyID = "+req.query.p
		if(_debug){console.log(sql)}
		db.run(sql, function(err) {						
			
		}, function () {next()});	
	} else {next()}		
}

function middleHandler_db_remove_dept_associate(req, res, next) {
	if(_debug){console.log("  middleHandler_db_remove_dept_associate ");}
	if(req.userid > 0){		
		var sql = "DELETE FROM user_properties WHERE userID = "+req.query.a+" AND propertyID = "+req.query.p
		if(_debug){console.log(sql)}
		db.run(sql, function(err) {						
			
		}, function () {next()});	
	} else {next()}		
}

restapi.get('/removeassoc', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_common_property,
	middleHandler_db_remove_associate,
	middleHandler_db_remove_dept_associate,
	function(req,res){		
	if(_debug){console.log("/removeassoc "+req.query.a);}

	res.end();
})

function middleHandler_db_common_property_update(req, res, next) {
	if(_debug){console.log("  middleHandler_db_common_property_update ");}
	if(req.userid > 0 && req.user_superadmin == 1){
		var sql = "UPDATE properties SET pname = '@@pname', shortname = '@@shortname', email = '@@email', phone = '@@phone', fax = '@@fax', city = '@@city', state = '@@state', zip = '@@zip', css_url = '@@css' WHERE autoID = @@id"
		sql = replace_all_array(sql, {
			id: req.query.id,
			pname: decode(req.query.pname),
			shortname: decode(req.query.shortname),
			email: req.query.email,
			phone: req.query.phone,
			fax: req.query.fax,
			city: req.query.city,
			state: req.query.state,
			zip: req.query.zip,
			css: req.query.css
		})
		if(_debug){console.log(sql)}
		db.run(sql, function(err) {						
			
		}, function () {next()});	
	} else {next()}		
}

restapi.get('/property-edit-accept', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_common_property_update,
	middleHandler_db_common_property,
	
	function(req,res){		
	if(_debug){
		console.log("/property-edit-accept "+req.query.id);
		console.log(req.query)
		console.log(req.property_detail[0])
	}
	
	var html = "tr::::prop-tr-"+req.property_detail[0]['id']+"::::"+replace_all_array(_properties_tdx, req.property_detail[0]);
	res.write(html);
	res.end();
})

restapi.get('/add-property', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_common_property_get,
	
	function(req,res){		
	//console.log("/add-property "+req.query.id);
	
	
		
	if(req.user_superadmin==1){
		var form = replace_all(_common_property_form,'@@id','0');
		form = form.replace('@@content', _common_property_main_form);
		var val = {pname: '', shortname: '', email: '', phone: '', fax: '', city: '', state: '', zip:''}
		form = replace_all_array(form, val)
		form = form.replace('@@buttons', _property_add_buttons);
		form = form.replace('@@more', '');
	} else {
	
	}
	
	res.write(form);
	res.end();
})

const _sql_db_common_property_add = (function () {/*  
	INSERT INTO properties VALUES(NULL, '@@hid', '@@pname', '@@email', '@@phone', '@@fax', '@@city', '@@state', '@@zip', '@@dateadded', '@@modules', '@@css_url', '@@css_content', '@@linksite', '');
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

//TODO does not prevent duplicates	
function middleHandler_db_common_property_add(req, res, next) {
	if(_debug){console.log("  middleHandler_db_common_property_add ");}
	req.property_add_edit_err = '';
	req.property_get_sql = "SELECT autoID as id, hid, pname, email, phone, fax, city, state, zip, dateadded, modules, css_url, css_content, linksite, (SELECT count(*) as cnt FROM properties)as cnt FROM properties ORDER BY autoID DESC LIMIT 1"
	if(req.query.pname.length == 0){
		req.property_add_edit_err = 'Name cannot be blank'; next();
	} else {
		if(req.userid > 0 && req.user_superadmin == 1){
			var guid = require('guid');
			var g = guid.create()
			var hid = (g.value.substr(6,2)+g.value.substr(10,1)+g.value.substr(14,4)).toUpperCase();
			var dateadded = rbp_dte();
			var linksite = env.guest_server+'/gen?id='+hid
			var sql = replace_all_array(_sql_db_common_property_add,
				{ pname: decode(req.query.pname), hid: hid, email: req.query.email, phone: req.query.phone, fax: req.query.fax, city: req.query.city, state: req.query.state, zip: req.query.zip, dateadded: dateadded, modules: '', css_url: '', css_content: '', linksite: linksite}
				)
			if(_debug){console.log(sql)}
			db.run(sql, function(err) {						
				req.property_add_edit_err = err;
			}, function () {next()});	
		} else {next()}		
	}
}

function middleHandler_db_common_property_get(req, res, next) {
	//console.log("  middleHandler_db_common_property_get ");	
	req.property_get = []; req.property_newid = 0	
	//todo test && req.user_superadmin == 1 
	if(req.userid > 0 && req.property_add_edit_err == ""){		
		db.each(req.property_get_sql, function(err, row) {						
			req.property_newid = row.id
			var val = { id: row.id, pname: row.pname, hid: row.hid, email: row.email, phone: row.phone, fax: row.fax, city: row.city, state: row.state, zip: row.zip, dateadded: row.dateadded, modules: row.modules, css_url: row.css_url, css_content: row.css_content, linksite: row.linksite, row: row.cnt}			
			req.property_get.push(val);
		}, function () {next()});
	} else {next()}
}

const _sql_db_common_property_add_homepage = (function () {/*  
	INSERT INTO homepage VALUES(NULL,@@id,'','','','','','','','','','','','','','','');
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

//TODO does not prevent duplicates	
function middleHandler_db_common_property_add_homepage(req, res, next) {
	//console.log("  middleHandler_db_common_property_add ");		
	if(req.property_add_edit_err != ''){
		next();
	} else {
		if(req.userid > 0 && req.user_superadmin == 1){
			var sql = _sql_db_common_property_add_homepage.replace('@@id',req.property_newid);
			db.run(sql, function(err) {						
				req.property_add_edit_err = err;
			}, function () {next()});	
		} else {next()}		
	}
}


function middleHandler_db_common_property_add_edit_row(req, res, next) {	
	//console.log("  middleHandler_db_common_property_add_edit_row");	
	if(req.property_add_edit_err != "") {
		next();
	} else {	
		var row = replace_all_array(_properties_tr, req.property_get[0])
		req.property_add_edit_row = row;
		next();
	}
}

restapi.get('/property-add-accept', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_db_common_property_add,
	middleHandler_db_common_property_get,
	middleHandler_db_common_property_add_homepage,
	middleHandler_db_common_property_add_edit_row,
		
	function(req,res){
	//console.log("/property-add-accept");
	//todo only admin
	if(req.property_add_edit_err != "") {
		res.write('alert::::'+req.property_add_edit_err);
		res.end();
	} else {					
		var html = "tr::::prop-tr-"+req.property_get[0]['id']+"::::"+req.property_add_edit_row;
		res.write(html);
		res.end();
	}
})

restapi.get('/add-ticket', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_ticket_edit_inquiry_types,
	middleHandler_ticket_edit_departments,
	middleHandler_ticket_edit_assignables,
		
	function(req,res){
	//console.log("/add-ticket");
	var ps = req.query.status
	var prop = req.query.prop	
	
	var cat = "<option value='0' selected>None</option>"
	for(var x=0;x<req.ticket_inquiry_types.length;x++){
		var iq = req.ticket_inquiry_types[x]
		cat += "<option value="+iq['id']+">"+iq['name']+"</option>"
	}
	cat += "</option>"
	
	var dept = "<option value='0' selected>None</option>"
	var datcnt = []
	var datlst = []
	for(var x=0;x<req.ticket_departments.length;x++){
		var iq = req.ticket_departments[x]
		datcnt.push(iq['id']+":"+iq['cnt'])
		datlst.push(iq['id']+"::"+iq['name'])
		dept += "<option value="+iq['id']+">"+iq['name']+"</option>"
	}
	deptcnt = datcnt.join(";")
	deptlist = datlst.join(";;")
	dept += "</option>"
	
	var assignbox = replace_all_array(_common_ticket_assignbox, {status: STATUS_SUBMITTED})
	var asdat = "<option selected value='0'>Myself</option>"
	for(var x=0;x<req.ticket_assignables.length;x++){
		var fa = req.ticket_assignables[x]
		asdat += "<option value="+fa['id']+">"+fa['name']+"</option>"
	}
	asdat += "</option>"
	
	
	
	var form = add_ticket_form(ps, prop)
	form = form.replace('@@cat', cat)
	form = form.replace('@@dat', dept)
	form = form.replace('@@asdat', asdat)
	res.write(form);
	res.end();	
})

function add_ticket_form(ps, prop){
	var content = replace_all_array(_common_add_ticket_content, {
		status: ps,
		prop: prop
	})
	var inputs = add_input(1, 2, ps, 'fname', "Guest First Name", 'text', '')
	//#append inputs [add_input 0 3 $ps mi "Guest Middle Initial" text', '')
	inputs += add_input(1, 3, ps, 'lname', "Guest Last Name",'text', '')
	inputs += add_input(1, 4, ps, 'cancellation', "Confirmation #", 'text', '')
	inputs += add_input(1, 5, ps, 'room', "Guest Room #", 'text', "[0-9]{1-5}")
	inputs += add_input(1, 6, ps, 'lastfour', "CC Last 4", 'text', "[0-9]{4}")
	inputs += add_input(1, 7, ps, 'checkin', "Check In Date", 'date', "\d{1,2}/\d{1/2}/\d{1,4}")
	inputs += add_input(1, 8, ps, 'checkout', "Check Out Date", 'date', "\d{1,2}/\d{1/2}/\d{1,4}")
	inputs += add_checkbox(1, 9, ps, 'noemail', 'email', 'No Guest Email')
	inputs += add_input(1, 10, ps, 'email', "Guest Email", 'email', "[a-z0-9._%+-]+@[=a-z0-9.-]+\.[a-z]{2,3}&#36;")
	inputs += add_input(1, 11, ps, 'phone', "Guest Phone", 'phone', "\d{3}[\-]\d{3}[\-]\d{4}")
	var amountbox = add_input(1, 12, ps, 'amount', "Refund Requested", 'number', '')	
	var assignbox = replace_all_array(_common_ticket_assignbox, {status: ps})
	var form = _common_add_ticket_form.replace('@@content', content);
	form = replace_all_array(form, {
		inputs: inputs,
		amountbox: amountbox,
		assignbox: assignbox
	})	
	return form
}

const _sql_db_departments_for_tester = (function () {/*  
	SELECT deptid, departments.name as name 
	FROM department_properties 
	INNER JOIN departments ON departments.autoID = department_properties.deptid 
	WHERE pid = @@pid
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_tester_department_list(req, res, next) {	
	//console.log("  middleHandler_tester_department_list");		
	req.department_test_list = []
	if(req.userid > 0 && req.propid > 0){	
		var sql = _sql_db_departments_for_tester.replace('@@pid', req.propid)
		db.each(sql, function(err, row) {					
			req.department_test_list.push(row.deptid+":"+row.name)
		}, function () {
			next()
		});
	} else {next()}
}
	
const _sql_db_authkeys_for_tester = (function () {/*  
	SELECT autoID as id, name as authname, deflimit FROM authorities
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_tester_authkeys_list(req, res, next) {	
	//console.log("  middleHandler_tester_authkeys_list");		
	req.authkeys_test_list = []
	if(req.userid > 0 && req.propid > 0){	
		var sql = _sql_db_authkeys_for_tester
		db.each(sql, function(err, row) {					
			req.authkeys_test_list.push({ id: row.id, name: row.authname, limit: row.deflimit})
		}, function () {
			next()
		});
	} else {next()}
}

function middleHandler_tester_positions_list(req, res, next) {	
	//console.log("  middleHandler_tester_positions_list");		
	req.position_test_list = []
	if(req.userid > 0 && req.propid > 0){	
		req.position_test_list.push({id:0, name:"N/A"})
		req.position_test_list.push({id:1, name:"Associate"})
		req.position_test_list.push({id:2, name:"Director"})
		req.position_test_list.push({id:3, name:"Manager"})
		req.position_test_list.push({id:4, name:"Credit Manager"})
		req.position_test_list.push({id:5, name:"Ass't Dir of Finance"})
		req.position_test_list.push({id:6, name:"Director of Finance"})
		next()		
	} else {next()}
}
	
function middleHandler_tester_notifications_list(req, res, next) {	
	//console.log("  middleHandler_tester_notifications_list");		
	req.notification_test_list = []
	if(req.userid > 0 && req.propid > 0){	
		req.notification_test_list.push({ id: 0, name:"N/A"})
		req.notification_test_list.push({ id: 1, name:"New Inquiries/Billing Inquiries"})
		req.notification_test_list.push({ id: 2, name:"Awaiting Approval"})
		req.notification_test_list.push({ id: 3, name:"Guest Reopened/Guest Response"})
		req.notification_test_list.push({ id: 4, name:"Status Report Auto"})
		req.notification_test_list.push({ id: 5, name:"New Inquiries/Folio Copies"})
		next()		
	} else {next()}
}

//todo secure this	
restapi.get('/properties', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	function(req, res){	
	//console.log('/properties ' + req.query.prop )	
	var list = []
	for(var x=0;x<req.user_properties.length;x++){
		list.push(req.user_properties[x]['id']+":"+req.user_properties[x]['name'])
	}
	res.write(list.join(";"))	
	res.end();
});
	
//todo secure this	
restapi.get('/departments', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_tester_department_list,
	function(req, res){	
	//console.log('/departments ' + req.query.prop )	
	res.write(req.department_test_list.join(";"))	
	res.end();
});

//todo secure this	
restapi.get('/positions', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_tester_positions_list,
	function(req, res){	
	var list = []
	//console.log('/positions ' + req.query.prop )	
	for(var x=0;x<req.position_test_list.length;x++){
		list.push(req.position_test_list[x]['id']+":"+req.position_test_list[x]['name'])
	}
	res.write(list.join(";"))	
	res.end();
});

//todo secure this	
restapi.get('/authkeys', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_tester_authkeys_list,
	function(req, res){	
	//console.log('/authkeys ' + req.query.prop )	
	var list = []
	for(var x=0;x<req.authkeys_test_list.length;x++){
		list.push(req.authkeys_test_list[x]['id']+":"+req.authkeys_test_list[x]['name']+":"+req.authkeys_test_list[x]['limit'])
	}
	res.write(list.join(";"))	
	res.end();
});

//todo secure this	
restapi.get('/notifications', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_tester_notifications_list,
	function(req, res){	
	//console.log('/notifications ' + req.query.prop )	
	var list = []
	for(var x=0;x<req.notification_test_list.length;x++){
		list.push(req.notification_test_list[x]['id']+":"+req.notification_test_list[x]['name'])
	}
	res.write(list.join(";"))	
	res.end();
});

const _sql_db_inquirytypes_for_tester = (function () {/*  
	SELECT inqid, inquiries.name as name 
	FROM inquiry_properties 
	INNER JOIN inquiries ON inquiries.autoID = inquiry_properties.inqid 
	WHERE pid = @@pid
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_tester_inquirytypes_list(req, res, next) {	
	//console.log("  middleHandler_tester_inquirytypes_list");		
	req.inquirytypes_test_list = []
	if(req.userid > 0 && req.propid > 0){	
		var sql = _sql_db_inquirytypes_for_tester.replace('@@pid', req.propid)
		db.each(sql, function(err, row) {					
			req.inquirytypes_test_list.push(row.inqid+":"+row.name)
		}, function () {
			next()
		});
	} else {next()}
}
	
	
//todo secure this	
restapi.get('/inquirytypes', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_tester_inquirytypes_list,
	function(req, res){	
	//console.log('/inquirytypes ' + req.query.prop )	
	res.write(req.inquirytypes_test_list.join(";"))	
	res.end();
});

//todo secure this	
restapi.get('/token_balance', 
	middleHandler_cookie_check,
	function(req, res){	
	//console.log('/token_balance ')	
	res.write(req.incoming_test_cnt.toString())	
	res.end();
});


function middleHandler_associate_ticket_validate_hack(req, res, next) {	
	//console.log("  middleHandler_associate_ticket_validate_hack " + req.errors.length);	
	if(req.errors.length==0){
		req.shared_request_prop = req.propid		
		//console.log('shared = '+req.propid)
	}
	next()		
}



//todo more validation, like total length
function middleHandler_associate_ticket_validate_user_supplied(req, res, next) {	
	//console.log("  middleHandler_associate_ticket_validate_user_supplied " + req.errors.length);	
	if(req.errors.length==0){
		if(req.query.typ!=0&&req.query.typ!=1&&req.query.typ!=2){req.errors.push("Type Error")}
		if(req.query.met!=1&&req.query.met!=2&&req.query.met!=3){req.errors.push("Method of Input Error")}
		if(decode(req.query.fname).length==0||decode(req.query.lname).length<2){req.errors.push("First or Last Name not supplied")}
		var email = req.query.email.toLowerCase();
		if(!validateEmail(email)){req.errors.push("Invalid email address")}
		if(req.query.desc.length==0){req.errors.push("A description is required")}		
		
	}
	next()		
}

const _sql_db_associate_insert_ticket = (function () {/*  
	INSERT INTO tickets VALUES(NULL, @@status, @@pid, @@ticketno,
	'@@tdate', '@@fn', '@@mi', '@@ln', '@@em', '@@ph', '', @@dept, @@ct, @@am, '@@ds', 
	'@@rn', '@@ci', '@@co', '', @@asgn, '@@ca', '', @@ty,
	@@month, @@day, @@year, '', 0, 0, 0, '@@gcode', '', @@cs, 0, @@met,'@@cc')	
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_associate_insert_ticket(req, res, next) {	
	//console.log("  middleHandler_associate_insert_ticket " + req.errors.length);	
	req.associate_ticket_inserted = 0
	if(req.userid > 0 && req.errors.length==0){
		//console.log(req.propid)
	
		var d = new Date
		var cdt = clk(d);
		var guid = require('guid');
		gcode = guid.create();
		
		if(req.query.amount.toString()=="NaN"){req.query.amount = "0"}
		if(req.query.amount.toString().length==0){req.query.amount = "0"}
		var amt = req.query.amount.replace(/[^0-9.]+/g, '')
		if(amt>0){amt = amt * 100}
		
		var asgn = req.query.asgn
		var sendasgn = 0
		if(asgn == 0) {asgn = req.userid} else {sendasgn = 1}
		
		var sql = replace_all_array(_sql_db_associate_insert_ticket, {
		status: STATUS_SUBMITTED,
		pid: req.query.ps,
		ticketno: req.newticketno,
		tdate: cdt,
		fn: decode(req.query.fname),
		mi: decode(req.query.mi),
		ln: decode(req.query.lname),
		em: req.query.email.toLowerCase(),
		ph: decode(req.query.phone),
		am: amt,
		ds: credit_card_mask(decode(req.query.desc)),
		rn: decode(req.query.room),
		ci: req.query.checkin,
		co: req.query.checkout,
		ca: decode(req.query.ca),
		sp: '',
		ty: req.query.typ,
		month: d.getMonth(),
		day: d.getDate(),
		year: d.getFullYear(),
		gcode: gcode,
		cs: parseInt(d.getTime() / 1000),
		cc: decode(req.query.cc),
		dept: 0,
		ct: 0,
		asgn: asgn,
		met: req.query.met
		})
		var found = false;
		db.run(sql, function(err) {						
			//console.log("ierr"+err)
		}, function (err) {		
			//console.log("eerr"+err)
			next()
		});
	}else{
		next()
	}	
}

const _sql_single_ticket = (function () {/*  	
	SELECT tickets.autoID, tickets.description as description, pid, status, ticketno, tdate, tickets.fname as tfname, tickets.mi as tmi, tickets.lname as tlname, 
	tickets.email as temail, tickets.phone as tphone, deptID, catID, amount, first_assignmentID, initial_type, input_method,
	cancellation as confirmation,
		departments.name as dept_name,
		inquiries.name as cat_name,
		ticket_locking.lockedby, 
		ticket_locking.expires, 
		ticket_locking.nick,
		users.fname as ufname,
		users.lname as ulname,
		(SELECT 
		    count(ticket_docs.autoID) as cnt 
		    FROM ticket_docs
		    WHERE tickets.autoID = ticket_docs.ticketid
		    AND deleted = 0
		    ) as cnt
	FROM tickets 
	LEFT OUTER JOIN departments ON tickets.deptID = departments.autoID
	LEFT OUTER JOIN inquiries ON tickets.catID = inquiries.autoID	
	LEFT OUTER JOIN ticket_locking ON tickets.autoID = ticket_locking.ticketID
	LEFT OUTER JOIN users ON tickets.first_assignmentID = users.autoID
	ORDER BY tickets.autoID desc LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

//todo change this to not use limit 1	
function middleHandler_db_get_last_ticket_inserted(req, res, next) {
	//console.log("  middleHandler_db_get_last_ticket_inserted "+req.errors.length);	
	req.tickets = [];
	//removed req.userid > 0 
	if(req.errors.length == 0){		
		var sql = _sql_single_ticket		
		//console.log(sql)
		db.each(sql, function(err, row) {
			var val = {id: row.autoID, 
			pid: row.pid,
			prop: row.pid,
			status: row.status,
			description: row.description,
			ticketno: row.ticketno, 
			tdate: row.tdate, 
			isodate: function(){
				var dt = new Date(row.tdate);
				return dt.toISOString()},
			fname: row.tfname, 
			mi: row.tmi, 
			lname: row.tlname, 
			email: row.temail, 
			phone: row.tphone, 
			deptID: row.deptID, 
			catID: row.catID, 
			amount: todollar(row.amount), 
			asname: function(){
				var rs = '';
				if(row.ufname!=null){rs=row.ufname+' '}
				if(row.ulname!=null){rs=rs+row.ulname}
				return rs},
			dept_name: row.dept_name, 
			cat_name: row.cat_name, 
			file: function(){
				if(row.cnt>1){
					return "<span id='ticket-file-"+req.query.status+"-"+row.autoID+"' class='fa fa-files-o' style='float:right;'></span>"
				}else if(row.cnt==1){
					return "<span id='ticket-file-"+req.query.status+"-"+row.autoID+"' class='fa fa-file-o' style='float:right;'></span>"
				}else{
					return ""
				}}, 
			lockedby: row.lockedby,
			locked: function(){if(row.lockedby==null){return ""}else{return "<span style='float:right;padding-top:2px;' class='fa fa-edit'></span>"}},
			expires: row.expires, 
			initial_type: row.initial_type,
			initial_desc_type: function(){return _initial_types[row.initial_type]}, 
			input_method: row.input_method,
			input_desc_method:  function(){return _input_methods[row.input_method]}, 
			confirmation: row.confirmation,
			nick: row.nick} 			
			req.tickets.push(val)		
		}, function () {
			next();
		});	
	} else {
		next();
	}
}



//todo scriptx testers
restapi.get('/ticket-add-accept', 
	middleHandler_cookie_check,	
	middleHandler_db_get_user_properties,
	middleHandler_associate_ticket_validate_user_supplied,
	middleHandler_associate_ticket_validate_hack,
	middleHandler_shared_request_first_ticket_test,
	middleHandler_associate_insert_ticket,
	middleHandler_db_get_last_ticket_inserted,
	
	function(req, res){
	//console.log('/ticket-add-accept ' )	
	//console.log(req.query)
	
	var html = ""
	if(req.errors.length == 0){
		if(req.tickets.length == 1) {			
			if(req.incoming_test_key != ""){					
					var row = "@@id::@@pid::@@initial_type::@@ticketno::@@tdate::@@fname::@@mi::@@lname::@@email::@@phone::@@deptID::@@catID::@@amount::@@pid::@@status::@@asname::0::0::@@input_method::@@confirmation"
					row = replace_all_array(row, req.tickets[0])
					html = row				
			} else {			
				var row = replace_all_array(_ticket_tr, req.tickets[0])
				html = "tr::::ticket-trow-"+req.tickets[0]['id']+"::::"+row
				if(req.query.next == "next"){
					html = html + "::::" + add_ticket_form(STATUS_SUBMITTED, req.propid)
				}
				html = html.replace('@@bubble', '')
				html = html.replace(/(\r\n|\n|\r)/gm,"")				
				io.emit('ticket-add-accept-'+req.tickets[0]['prop'], {userid: req.userid, id: req.tickets[0]['id'], status: req.tickets[0]['status'], html: html})
			}
			
		}
	} else {
		html = "alert::::"+req.errors.join(", ")
	}
	res.write(html)
	res.end();
})	

function middleHandler_ticket_edit_locktest(req, res, next) {	
	if(_debug){
		console.log("  middleHandler_ticket_edit_locktest"); 
		console.log(new Date().getTime());
	}
	req.ticket_data = []
	req.ticket_edit_locked = 0
	req.ticket_common_id = 0
	if(req.userid > 0){		
		var expiredat = parseInt(new Date().getTime() / 1000 - (60 * 10));
		req.ticket_common_id = req.query.id
		db.each("SELECT lockedby, expires, nick FROM ticket_locking WHERE ticketID = "+req.query.id+" AND expires > "+expiredat, function(err, row) {						
			req.ticket_edit_locked = row.lockedby
		}, function () {			
			next()
		});
	} else {next()}
}
	
const _sql_db_lock_ticket = (function () {/*  
	INSERT OR REPLACE INTO ticket_locking (autoID, ticketID, lockedby, expires, nick) 
	VALUES ((select autoID from ticket_locking where ticketID = @@id),@@id,@@userid,@@n,'@@nick')
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_ticket_edit_lock(req, res, next) {	
	if(_debug){console.log("  middleHandler_ticket_edit_lock"); console.log(new Date().getTime());}
	req.ticket_keeptime = 0;
	if(req.userid > 0 && req.ticket_edit_locked == 0){				
		var sql = replace_all_array(_sql_db_lock_ticket, {			
			id: req.query.id,
			userid: req.userid,
			nick: req.user_nick,
			n: parseInt(new Date().getTime() / 1000)
			})
		db.run(sql, function(err, row) {					
		}, function () {
			req.ticket_keeptime = 600; //10 minutes
			next()
		});
	} else {next()}
}

function middleHandler_ticket_upload_token(req, res, next) {	
	if(_debug){console.log("  middleHandler_ticket_upload_token");console.log(new Date().getTime());}
	req.ticket_upload_token = '';
	if(req.userid > 0 && req.ticket_edit_locked == 0){
		var guid = require('guid');
		var token = guid.create();		
		var sql = "UPDATE users SET upload_token = '"+token+"' WHERE autoID = "+req.userid
		db.run(sql, function(err, row) {								
		}, function () {
			req.ticket_upload_token = token;
			next()
		});
	} else {next()}
}

function middleHandler_ticket_check_token(req, res, next) {	
	//console.log("  middleHandler_ticket_check_token");		
	req.ticket_check_token = '';
	if(req.userid > 0){
		var sql = "SELECT upload_token FROM users WHERE autoID = "+req.userid
		db.each(sql, function(err, row) {	
			req.ticket_check_token = row.upload_token;		
		}, function () {
			next()
		});
	} else {next()}
}


const _sql_db_get_ticket = (function () {/* 
	SELECT 
	users.credit as credit,
	ticket_locking.lockedby as lockedby,
	group_concat(ticket_status.status, ',')  as bubble_status,	
	tickets.autoID as id,
	tickets.status as status,
	tickets.pid as pid,
	tickets.ticketno as ticketno,
	tickets.tdate as tdate,
	tickets.fname as fname, 
	tickets.mi as mi, 
	tickets.lname as lname, 
	tickets.email as email, 
	tickets.phone as phone, 
	tickets.fax as fax, 
	tickets.deptID as deptID,
	tickets.catID as catID,
	tickets.amount as amount, 
	tickets.description as desc, 
	tickets.room_number as rm, 
	tickets.check_in as check_in,
	tickets.check_out as check_out, 
	tickets.external_comment as external_comment, 
	tickets.first_assignmentID as first_assignmentID, 
	tickets.cancellation as confirmation, 
	tickets.spg as spg,
	tickets.initial_type as initial_type,

	tickets.month_submitted as month_submitted,
	tickets.day_submitted as day_submitted,
	tickets.year_submitted as year_submitted,

	tickets.tdate_closed as tdate_closed,
	tickets.month_closed as month_closed,
	tickets.day_closed as day_closed,
	tickets.year_closed as year_closed,

	tickets.guest_edit_code as guest_edit_code,
	tickets.guest_upload_token as guest_upload_token,

	tickets.unix_date_submitted as unix_date_submitted,
	tickets.unix_date_closed as unix_date_closed,
	tickets.input_method as input_method,
	tickets.lastfour as lastfour

	FROM tickets 
	INNER JOIN users ON users.autoID = @@userid
	INNER JOIN ticket_locking ON ticket_locking.ticketID = tickets.autoID
	LEFT OUTER JOIN ticket_status ON tickets.ticketno = ticket_status.ticketno AND tickets.pid = ticket_status.pid
	
	WHERE tickets.autoID = @@id
	LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_ticket_edit_getdata(req, res, next) {	
	if(_debug){console.log("  middleHandler_ticket_edit_getdata");console.log(new Date().getTime());}
	if(req.userid > 0){		
		var sql = replace_all_array(_sql_db_get_ticket, {userid: req.userid, id: req.query.id});
		db.each(sql, function(err, row) {						
			var val = {
			credit: row.credit,
			lockedby: row.lockedby,
			id: row.id,
			status: row.status,
			lastfour: row.lastfour,
			pid: row.pid,
			ticketno: row.ticketno,
			tdate: row.tdate,
			isodate: new Date(row.tdate).toISOString(),
			fname: row.fname, 
			mi: row.mi, 
			lname: row.lname, 
			email: row.email, 
			phone: row.phone, 
			fax: row.fax, 
			deptID: row.deptID, 
			catID: row.catID, 
			amount: todollar(row.amount), 
			desc: row.desc, 
			room_number: row.rm, 
			check_in: row.check_in,
			check_out: row.check_out, 
			external_comment: row.external_comment, 
			first_assignmentID: row.first_assignmentID, 
			confirmation: row.confirmation, 
			spg: row.spg,
			initial_type: row.initial_type,
			bubble_status: row.bubble_status,

			month_submitted: row.month_submitted,
			day_submitted: row.day_submitted,
			year_submitted: row.year_submitted,

			tdate_closed: row.tdate_closed,
			month_closed: row.month_closed,
			day_closed: row.day_closed,
			year_closed: row.year_closed,

			guest_edit_code: row.guest_edit_code,
			guest_upload_token: row.guest_upload_token,

			unix_date_submitted: row.unix_date_submitted,
			unix_date_closed: row.unix_date_closed,
			input_method: row.input_method,
			lastfour: row.lastfour
			}
			req.ticket_data.push(val)
		}, function () {
			
			next()});
	} else {next()}
}

function middleHandler_ticket_edit_inquiry_types(req, res, next) {	
	if(_debug){console.log("  middleHandler_ticket_edit_inquiry_types");console.log(new Date().getTime());}
	req.ticket_inquiry_types = []
	if(req.userid > 0){	
		var sql = _sql_db_ticket_inquiry_types.replace('@@pid', req.query.prop);		
		db.each(sql, function(err, row) {						
			var val = {id: row.inquiryID,name: row.inquiryname, sub_desc: row.sub_desc}
			req.ticket_inquiry_types.push(val)
		}, function () {			
			next()});
	} else {next()}
}

function middleHandler_ticket_edit_departments(req, res, next) {	
	if(_debug){console.log("  middleHandler_ticket_edit_departments");console.log(new Date().getTime());}
	req.ticket_departments = []
	if(req.userid > 0){	
		var sql = _sql_db_ticket_departments.replace('@@pid', req.query.prop);				
		db.each(sql, function(err, row) {						
			var val = {id: row.departmentID, name: row.deptname, cnt: row.cnt}
			req.ticket_departments.push(val)
		}, function () {			
			next()});
	} else {next()}
}

function middleHandler_ticket_edit_assignables(req, res, next) {	
	if(_debug){console.log("  middleHandler_ticket_edit_assignables");console.log(new Date().getTime());}
	req.ticket_assignables = []
	if(req.userid > 0){	
		var sql = _sql_db_ticket_assignables.replace('@@pid', req.query.prop);		
		db.each(sql, function(err, row) {						
			var val = {id: row.asid, name: row.afname + ' ' + row.ami + ' ' + row.alname}
			req.ticket_assignables.push(val)
		}, function () {			
			next()});
	} else {next()}
}

const _sql_db_ticket_file_hist = (function () {/*  
SELECT ticket_docs.autoID as fid, userid, ticketid, content, original_name, ticket_docs.dateadded as dateadd,
coalesce(users.fname||' '||users.mi||' '||users.lname,',') as username
FROM ticket_docs 
LEFT OUTER JOIN users ON users.autoID = ticket_docs.userid
WHERE ticketid = @@id AND ticket_docs.deleted = 0
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_ticket_get_files(req, res, next) {	
	if(_debug){console.log("  middleHandler_ticket_get_files");console.log(new Date().getTime());}
	req.ticket_files = []
	if(req.userid > 0 && req.ticket_common_id > 0){			
		var sql = replace_all_array(_sql_db_ticket_file_hist, {
			id: req.ticket_common_id
			})
			if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {
			if(row.userid == 0){username = "Guest"}else{username = row.username}
			var val = {id: row.fid, userid: row.userid, tid: row.ticketid, content: row.content, 
			file: row.content,
			server: env.server,
			ext: row.content.split('.')[1],
			original_name: row.original_name, dateadd: row.dateadd, username: username}
			req.ticket_files.push(val);
			
		}, function () {			
			next()});
	} else {next()}
}


const _sql_db_ticket_history = (function () {/*
	SELECT ticket_status.autoID, tickets.ticketno,
    ticket_status.userid as uid, ticket_status.status as stat, ticket_status.sdate as sdate,
    ticket_status.notes as notes, ticket_status.nick as nick,
    (SELECT fname FROM users WHERE users.autoID = ticket_status.userid) AS fname, 
    (SELECT lname FROM users WHERE users.autoID = ticket_status.userid) AS lname    
    FROM tickets
    INNER JOIN ticket_status ON ticket_status.ticketno = tickets.ticketno
    INNER JOIN users ON (ticket_status.userid = users.autoID) or ticket_status.userid = 0
    where tickets.autoID = @@tid and ticket_status.pid = @@pid
	GROUP BY ticket_status.autoID
    ORDER BY ticket_status.autoID DESC
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_ticket_history(req, res, next) {	
	if(_debug){console.log("  middleHandler_ticket_history " + req.query.id);console.log(new Date().getTime());}
	req.ticket_history = ''
	var hist = []
	if(req.userid > 0){			
		var sql = replace_all_array(_sql_db_ticket_history, {tid: req.query.id, pid: req.query.prop})		
		if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {
			hist.push(row)
		}, function () {			
			if(_debug){console.log(hist.length);console.log(new Date().getTime());}
			var hist_html = ''
			for(var x=0;x<hist.length;x++){
				var uid = parseInt(hist[x]['uid'])
				if(uid==0) {
					var bit = _ticket_history_item_guest;
				} else {
					var bit = _ticket_history_item_associate;
				}
				var dt = new Date(hist[x]['sdate']);				
				var stat_desc = _ticket_status_labels[parseInt(hist[x]['stat'])]
				var uname = hist[x]['fname'] + ' ' + hist[x]['lname']
				var email_notes = emailprep(hist[x]['notes'])
				if(hist[x]['nick'] != '') {uname = uname + ' // '+hist[x]['nick'] + ' // '}
				bit = replace_all_array(bit, {
					sdate: dt.toISOString(),
					isodate: dt.toISOString(),
					stat_desc: stat_desc,
					uname: uname,
					email_notes: email_notes					
				})
				hist_html = hist_html + bit;
			}						
			req.ticket_history = hist_html
			if(_debug){console.log("  middleHandler_ticket_history-done " + req.query.id);console.log(new Date().getTime());}
			next()});
	} else {next()}
}

restapi.get('/removefile', 
	middleHandler_cookie_check,	
	middleHandler_ticket_get_remove_file,
	middleHandler_ticket_remove_file,
	middleHandler_ticket_remove_file_comment,
	middleHandler_ticket_history,
	middleHandler_ticket_refresh_file,
	middleHandler_ticket_get_files,
	
	function(req,res){		
	//console.log('/removefile')	
	//todo add check for user properties
	res.write(file_links_detail(req.ticket_files) + "::::" + req.ticket_history)
	res.end();
});

function file_history_detail(ar){	
	var files = "<table class='footable filetable' "+_footable_attributes+"><thead><tr><th>Name</th><th>Date Added</th><th>Added By</th></tr></thead><tbody>"
	for(var x=0;x<ar.length;x++){
		var file = replace_all_array(_ticket_file_row, ar[x])
		files += file;
	}
	files += "</tbody><tfoot>"+_ticket_file_add + "</tfoot></table>"
	return files
}		

function file_links_detail(ar){
	var flinks = []
	for(var x=0;x<ar.length;x++){
		flinks.push(ar[x]['id']+";;"+ar[x]['original_name']+";;"+ar[x]['dateadd'])
	}
	return flinks.join(";;;;")
}		

restapi.get('/edit-ticket', 
	middleHandler_cookie_check,	
	middleHandler_ticket_edit_locktest,
	middleHandler_db_get_user_properties,
	middleHandler_ticket_edit_lock,
	middleHandler_ticket_upload_token,
	middleHandler_ticket_edit_getdata,
	middleHandler_ticket_edit_inquiry_types,
	middleHandler_ticket_edit_departments,
	middleHandler_ticket_edit_assignables,
	middleHandler_ticket_get_files,
	middleHandler_ticket_history,
		
	function(req,res){
	if(_debug){console.log("/edit-ticket");console.log(new Date().getTime());}
	var id = req.query.id
	var ps = req.query.status
	var prop = req.query.prop
	var form = "invalid ticket form"
	var noguestemail = "checked"
	
	if(req.ticket_edit_locked == 0){	
		io.emit('ticket-edit-'+req.query.prop, {id: req.ticket_common_id, uid: req.userid, status: req.query.status})
	}
	var lastfour = req.ticket_data[0]['lastfour']
	var bubble = comment_bubble(req.ticket_data[0]['bubble_status'])+_bubblex
	
	var dt = new Date(req.ticket_data[0]['tdate']);
	
	// && req.ticket_keeptime > 0
	
	
	var noguestemail = 'checked'
	var approved_display = "style='display:none;'"
	var approved2_display = "style='display:none;'"
	if (validateEmail(req.ticket_data[0]['email'])) {
		noguestemail = "";
		approved_display = "";
		approved2_display = "";
		}
	
	
	
	if(req.userid > 0) {
		var content = replace_all_array(_common_edit_ticket_content, {
			userid: req.userid,
			status: ps,
			prop: prop,
			bubble: bubble,
			isodate: dt.toISOString(),
			noguestemail: noguestemail,
			approved_display: approved_display,
			approved2_display: approved2_display,
			lastfour: lastfour
			})
		
		
		var assignbox = replace_all_array(_common_ticket_assignbox, {status: ps})
		var faid = req.ticket_data[0]['first_assignmentID']
		if(faid==0 || faid=='null'){
			var asdat = "<option selected value='0'>Myself</option>"
		} else {
			var asdat = "<option value='0'>Myself</option>"
		}
		for(var x=0;x<req.ticket_assignables.length;x++){
			var fa = req.ticket_assignables[x]
			if(fa['id']==faid){
				asdat += "<option selected value="+fa['id']+">"+fa['name']+"</option>"
			} else {
				asdat += "<option value="+fa['id']+">"+fa['name']+"</option>"
			}
		}
		asdat += "</option>"
		
		
		var cat = "<option value='0'>None</option>"
		var catID = req.ticket_data[0]['catID']
		for(var x=0;x<req.ticket_inquiry_types.length;x++){
			var iq = req.ticket_inquiry_types[x]
			if(iq['id']==catID){
				cat += "<option selected value="+iq['id']+">"+iq['name']+"</option>"
			} else {
				cat += "<option value="+iq['id']+">"+iq['name']+"</option>"
			}
		}
		cat += "</option>"
		
		var dept = "<option value='0'>None</option>"
		var deptID = req.ticket_data[0]['deptID']
		var datcnt = []
		var datlst = []
		for(var x=0;x<req.ticket_departments.length;x++){
			var iq = req.ticket_departments[x]
			datcnt.push(iq['id']+":"+iq['cnt'])
			datlst.push(iq['id']+"::"+iq['name'])
			if(iq['id']==deptID){
				dept += "<option selected value="+iq['id']+">"+iq['name']+"</option>"
			} else {
				dept += "<option value="+iq['id']+">"+iq['name']+"</option>"
			}
		}
		deptcnt = datcnt.join(";")
		deptlist = datlst.join(";;")
		dept += "</option>"
		
		var activedisplay = "inline"; var inactivedisplay = "none";
		if(req.ticket_edit_locked > 0 && req.ticket_edit_locked != req.userid) {activedisplay = "none"; inactivedisplay = "inline"}
		var buttons = replace_all_array(_ticket_edit_buttons, {id: id, prop: prop, status: ps, activedisplay: activedisplay, inactivedisplay: inactivedisplay})
		form = _common_edit_ticket_form.replace('@@content', content);
		form = replace_all_array(form, {
			assignbox: assignbox,
			buttons: buttons,
			deptcnt: deptcnt,
			deptlist: deptlist
		})
		
		form = form.replace('@@file_hist', "<div style='display:none;' id='file-links-@@id'>@@file_links</div>"+ file_history_detail(req.ticket_files))
		form = form.replace('@@file_links', file_links_detail(req.ticket_files))
		form = replace_all_array(form, req.ticket_data[0])
		form = replace_all_array(form, {cat_opts: cat, dept_opts: dept, asdat: asdat, upload_token: req.ticket_upload_token});
		
		form = form.replace('@@history', req.ticket_history);
	}
	res.write(req.ticket_keeptime + '::::' + form);
	console.log(new Date().getTime()+"--Done");
	res.end();	
})

restapi.get('/edit-closed-ticket', 
	middleHandler_cookie_check,	
	middleHandler_ticket_edit_locktest,
	middleHandler_db_get_user_properties,
	middleHandler_ticket_edit_lock,
	middleHandler_ticket_upload_token,
	middleHandler_ticket_edit_getdata,
	middleHandler_ticket_edit_inquiry_types,
	middleHandler_ticket_edit_departments,
	middleHandler_ticket_edit_assignables,
	middleHandler_ticket_get_files,
	middleHandler_ticket_history,		
	function(req,res){
	if(_debug){console.log("/edit-closed-ticket "+req.query.id);console.log(new Date().getTime());}
	var id = req.query.id
	var ps = req.query.status
	var prop = req.query.prop
	var form = "invalid ticket form 2"
		
	if(req.userid > 0 && req.ticket_keeptime > 0) {
		var content = replace_all_array(_common_edit_ticket_content, {
			status: ps,
			prop: prop
			})
		
		
		var assignbox = replace_all_array(_common_ticket_assignbox, {status: ps})
		var faid = req.ticket_data[0]['first_assignmentID']
		if(faid==0 || faid=='null'){
			var asdat = "<option selected value='0'>Myself</option>"
		} else {
			var asdat = "<option value='0'>Myself</option>"
		}
		for(var x=0;x<req.ticket_assignables.length;x++){
			var fa = req.ticket_assignables[x]
			if(fa['id']==faid){
				asdat += "<option selected value="+fa['id']+">"+fa['name']+"</option>"
			} else {
				asdat += "<option value="+fa['id']+">"+fa['name']+"</option>"
			}
		}
		asdat += "</option>"
		
		
		var cat = "<option value='0'>None</option>"
		var catID = req.ticket_data[0]['catID']
		for(var x=0;x<req.ticket_inquiry_types.length;x++){
			var iq = req.ticket_inquiry_types[x]
			if(iq['id']==catID){
				cat += "<option selected value="+iq['id']+">"+iq['name']+"</option>"
			} else {
				cat += "<option value="+iq['id']+">"+iq['name']+"</option>"
			}
		}
		cat += "</option>"
		
		var dept = "<option value='0'>None</option>"
		var deptID = req.ticket_data[0]['deptID']
		for(var x=0;x<req.ticket_departments.length;x++){
			var iq = req.ticket_departments[x]
			if(iq['id']==deptID){
				dept += "<option selected value="+iq['id']+">"+iq['name']+"</option>"
			} else {
				dept += "<option value="+iq['id']+">"+iq['name']+"</option>"
			}
		}
		dept += "</option>"
		
		var activedisplay = "inline"; var inactivedisplay = "none";
		if(req.ticket_edit_locked > 0 && req.ticket_edit_locked != req.userid) {activedisplay = "none"; inactivedisplay = "inline"}
		var buttons = replace_all_array(_ticket_closed_buttons, {id: id, prop: prop, status: ps, activedisplay: activedisplay, inactivedisplay: inactivedisplay})
		form = _common_edit_ticket_form.replace('@@content', content);
		form = replace_all_array(form, {
			assignbox: assignbox,
			buttons: buttons
		})
		
		var files = "<table style='width:433px;' "+_footable_attributes+"><thead><tr><th>Name</th><th>Date Added</th><th>Added By</th></tr></thead><tbody>"
		for(var x=0;x<req.ticket_files.length;x++){
			var file = replace_all_array(_ticket_file_row, req.ticket_files[x])
			files += file;
		}
		files += "</tbody></table>"
		
		form = form.replace('@@file_hist', files)
		form = form.replace('@@bubble', '')
		form = replace_all_array(form, req.ticket_data[0])
		form = replace_all_array(form, {cat_opts: cat, dept_opts: dept, asdat: asdat, upload_token: req.ticket_upload_token});
		
		form = form.replace('@@history', req.ticket_history);
	}
	res.write(req.ticket_keeptime + '::::' + form);
	res.end();	
})


const _sql_db_get_remove_file = (function () {/*
	SELECT content, original_name, 
	tickets.pid as pid, tickets.ticketno as ticketno, tickets.status as status, tickets.tdate as tdate
	FROM ticket_docs 
	INNER JOIN tickets ON tickets.autoID = ticket_docs.ticketid
	WHERE ticket_docs.autoID = @@fid and ticket_docs.ticketid = @@tid AND ticket_docs.deleted = 0
	LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
	
function middleHandler_ticket_get_remove_file(req, res, next) {	
	//console.log("  middleHandler_ticket_get_remove_file "+ req.query.fid + ", " + req.query.id);			
	req.remove_file_content = ''
	req.remove_file_ticket_array = []
	if(req.userid > 0 && parseInt(req.query.fid) > 0 && parseInt(req.query.id) > 0){			
		var sql = replace_all_array(_sql_db_get_remove_file, {
			fid: req.query.fid,
			tid: req.query.id
		})
		db.each(sql, function(err, row) {
			req.remove_file_content = row.content
			req.remove_file_ticket_array.push(row);
		}, function () {			
			next()});
	} else {next()}
}
	
const _sql_db_remove_file = (function () {/*
	UPDATE ticket_docs 
	SET deleted = 1, content = '@@content' 
	WHERE autoID = @@fid and ticketid = @@tid
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_ticket_remove_file(req, res, next) {	
	//console.log("  middleHandler_ticket_remove_file " + req.remove_file_content);			
	if(req.userid > 0 && req.remove_file_content != ''){			
		var sql = replace_all_array(_sql_db_remove_file, {
			fid: req.query.fid,
			tid: req.query.id,
			content: req.remove_file_content
		})
		db.run(sql, function(err) {
			//todo add error handler
		}, function () {			
			next()});
	} else {next()}
}

const _sql_db_remove_file_comment = (function () {/*
	INSERT INTO ticket_status 
	VALUES(NULL, @@pid, @@userid, @@ticketno, @@status, '@@tdate', 'Associate file removed: @@original_name','')	
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_ticket_remove_file_comment(req, res, next) {	
	//console.log("  middleHandler_ticket_remove_file_comment " + req.remove_file_content);			
	//todo  && remove_file_ticket_array.length == 1
	if(req.userid > 0 && req.remove_file_content != ''){			
		var sql = replace_all_array(_sql_db_remove_file_comment, req.remove_file_ticket_array[0])
		var sql = sql.replace('@@userid', req.userid)
		db.run(sql, function(err) {
			//todo add error handler
		}, function () {			
			next()});
	} else {next()}
}

restapi.get('/removefile', 
	middleHandler_cookie_check,	
	middleHandler_ticket_get_remove_file,
	middleHandler_ticket_remove_file,
	middleHandler_ticket_remove_file_comment,
	function(req,res){		
	//console.log('/removefile')	
	//todo add check for user properties
	res.write('ok')
	res.end();
});

restapi.get('/download', function(req,res){	
	if(_debug){
		console.log('/download')
		console.log(__dirname + '/rbp-uploads/'+req.query.id);	
	}
	res.download(__dirname + '/rbp-uploads/'+req.query.id);
	
});


restapi.get('/training', 
	function(req,res){		
	//console.log("/training");
	//res.write("<div style='padding:20px;'><p>Under Construction</p></div>")
	//res.end();
	//res.sendFile(path.join(__dirname + '/html/Admin_Guide_v3.1.1.htm'));
	res.sendFile(path.join(__dirname + '/public/Admin_Guide_v3.1.3.htm'));
	//res.sendFile(path.join(__dirname + '/html/Administrator Guide Manual 3.1 - RBP Guest Inquiries.htm'));

})

restapi.get('/logout',
	middleHandler_db_edit_ticket_cancel,
	function(req,res){		
	//console.log("/logout");
	res.cookie("rbpx-g","", { signed: false });
	res.cookie("rbpx-u","", { signed: false });
	res.cookie("rbpx-r","", { signed: false });	
	req.userid = 0
	res.redirect('/');
})

var cpUpload = upload.fields([{ name: 'uploadedfile', maxCount: 1 }])
var cpUpload2 = upload2.fields([{ name: 'uploadedfile', maxCount: 1 }])

function middleHandler_ticket_refresh_file(req, res, next) {	
	//console.log("  middleHandler_ticket_refresh_file");		
	req.ticket_common_id = req.query.id
	next();
}

function middleHandler_ticket_upload_file(req, res, next) {	
	var n = new Date();
	if(_debug){console.log("  middleHandler_ticket_upload_file " + n.getMilliseconds());}
	req.ticket_upload_data = []	
	req.ticket_common_id = 0
	//no user test since this is shared with guest (todo fix this)
		try {
		 var fts = req.files['uploadedfile'][0].originalname.split(".")
		}
		catch (e) {
			req.ticket_upload_result = e
			var fts = []
		}
		if(fts.length==0){
			req.ticket_upload_result = 'Oops!  a file must be chosen first.'
		} else {
			if(fts.length==2){
				var ft = fts[fts.length-1].toLowerCase();
				if(ft==="pdf"||ft==="doc"||ft==="rtf"||ft==="xls"||ft==="docx"||ft==="xlsx"){		
					var val = {
					id: req.body.id,
					pid: req.body.pid,
					token: req.body.token,
					status: req.body.status,
					ticketno: req.body.ticketno,
					file: req.files['uploadedfile'][0].filename,
					name: req.files['uploadedfile'][0].originalname
					}
					console.log(val);
					req.ticket_common_id = req.body.id
					req.ticket_upload_data.push(val);
					next();
					return;
				} else {
					req.ticket_upload_result = 'Oops!  Valid file types are .pdf, .doc, and .rtf'					
				}				
			} else {
				req.ticket_upload_result = 'Oops!  An uploaded file must have a single extention type, like myfile.pdf'
			}	
		}
	if(_debug){console.log(req.ticket_upload_result);console.log(req.ticket_upload_data)}
	next();
}

const _sql_db_insert_ticket_doc = (function () {/*  
INSERT INTO ticket_docs VALUES(NULL, @@id, @@userid, '@@tdate', '@@file', '@@name', 0);
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_ticket_upload_insert_db_doc(req, res, next) {	
	if(_debug){
		console.log("  middleHandler_ticket_upload_insert_db_doc");
		console.log(req.ticket_upload_data.length);
	}
	
	if(req.ticket_upload_data.length == 1){			
		var sql = replace_all_array(_sql_db_insert_ticket_doc, {
			id: req.ticket_upload_data[0]['id'],
			pid: req.ticket_upload_data[0]['pid'],
			ticketno: req.ticket_upload_data[0]['ticketno'],
			status: req.ticket_upload_data[0]['status'],
			userid: req.ticket_upload_userid,
			tdate: rbp_dte(),
			file: req.ticket_upload_data[0]['file'],
			name: req.ticket_upload_data[0]['name']
			})
		if(_debug){console.log(sql)}
		db.run(sql, function(err) {						
			//todo add error handler
		}, function () {			
			next()});
	} else {next()}
}


//not used?
const _sql_db_insert_ticket_status = (function () {/*  
INSERT INTO ticket_status VALUES(NULL, @@pid, @@userid, @@ticketno, @@status,'@@tdate', 'Associate file uploaded: @@name','')
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_ticket_upload_insert_db_status(req, res, next) {	
	//console.log("  middleHandler_ticket_upload_insert_db_status");			
	if(req.userid > 0 && req.ticket_upload_data.length == 1){			
		var sql = replace_all_array(_sql_db_insert_ticket_status, {
			id: req.ticket_upload_data[0]['id'],
			pid: req.ticket_upload_data[0]['pid'],
			ticketno: req.ticket_upload_data[0]['ticketno'],
			status: req.ticket_upload_data[0]['status'],
			userid: req.userid,
			tdate: rbp_dte(),
			name: req.ticket_upload_data[0]['name']
			})
		db.run(sql, function(err) {						
			//todo add error handler
		}, function () {			
			next()});
	} else {next()}
}

restapi.post('/upload', 
	cpUpload,
	middleHandler_cookie_check,	
	middleHandler_ticket_check_token,
	middleHandler_db_get_user_properties,	
	function (req, res, next){
		req.ticket_upload_result = 'Success!  Use the Refresh Files button to show the uploaded file.'; 
		req.ticket_upload_userid = req.userid;
		next();},
	middleHandler_ticket_upload_file,
	middleHandler_ticket_upload_insert_db_doc,
	middleHandler_ticket_upload_insert_db_status,
	middleHandler_ticket_get_files,
	
	function (req, res) {
	var n = new Date();
	//console.log('/upload');
					
	var found = false
	for(var x=0;x<req.user_properties.length;x++){
		if(req.user_properties[x]['id'] == parseInt(req.body.pid)){
			found = true; break
		}
	}
	
	if(!found){
		req.ticket_upload_result = 'Oops!  An error occurred trying to upload.  Error 5.'
	}
	res.write(req.ticket_upload_result)
	res.end();
})

const _sql_db_guest_upload = (function () {/*  
INSERT INTO ticket_docs VALUES(NULL, @@id, @@userid, '@@tdate', '@@file', '@@name', 0);
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

restapi.get('/gfref', 
	function(req, res){
	if(_debug){console.log('/gfref');}
	res.write(req.query.token)
	res.end();
})

function mh_blog_upload_file(req, res, next) {	
	if(_debug){console.log("  mh_blog_upload_file ")}
	req.blog_image_upload_result = 'success'
	req.blog_upload_data = []	
	req.blog_image_file_exists = false
	
		try {
			if(_debug){console.log(req.files['uploadedfile'][0])}
			var fts = req.files['uploadedfile'][0].originalname.split(".")
		}
		catch (e) {
			req.blog_image_upload_result = e
			var fts = []
		}
		if(fts.length==0){
			req.blog_image_upload_result = 'Oops!  a file must be chosen first.'
		} else {
			if(fts.length==2){
				var ft = fts[fts.length-1].toLowerCase();
				if(ft==="jpg"||ft==="jpeg"||ft==="png"){		
					var val = {					
					file: req.files['uploadedfile'][0].filename,
					name: req.files['uploadedfile'][0].originalname
					}
					req.blog_upload_data.push(val);
					
				} else {
					req.blog_image_upload_result = 'Oops!  Valid file types are .jpg, .jpeg, & .png'					
				}				
			} else {
				req.blog_image_upload_result = 'Oops!  An uploaded file must have a single extention type, like myfile.pdf'
			}	
		}
	
	next();
}

restapi.post('/bupload', 
	cpUpload2,	
	mh_blog_upload_file,
	middleHandler_db_blog_image_record,
	function(req, res){
		if(_debug){
			console.log('/bupload');
			console.log(req.blog_image_upload_result)
			console.log(req.blog_upload_data)
			console.log(req.blog_image_file_exists)
		}
	res.write(req.blog_image_upload_result)
	res.end();
})

restapi.post('/gupload', 
	cpUpload,
	function (req, res, next){
		if(_debug){console.log(JSON.stringify(req.body))}
		req.query.id = req.body.id
		req.query.gcode = req.body.token;		
		next();
	},
	middleHandler_guest_only_precheck,
	middleHandler_ticket_guest_getdata,
	middleHandler_guest_only_history,
	function (req, res, next){		
		req.body.pid = req.guest_ticket[0]['pid']
		req.body.status = req.guest_ticket[0]['status'];  //dont change yet, wait until form is complete
		req.body.ticketno = req.guest_ticket[0]['ticketno']
		req.ticket_upload_result = 'Success!  Your upload has been saved.  Complete the rest of the form and use the Send Comment button.'; 
		req.ticket_upload_userid = 0;
		next();},	
	middleHandler_ticket_upload_file,
	middleHandler_ticket_upload_insert_db_doc,
	function(req, res){
		if(_debug){console.log('/gupload');}
	res.write(req.ticket_upload_result)
	console.log(req.ticket_upload_result);
	res.end();
})


function middleHandler_filehist_temp(req, res, next) {	
	req.ticket_data = []
	next()
}

restapi.get('/filehist', 
	middleHandler_cookie_check,	
	middleHandler_ticket_refresh_file,
	middleHandler_ticket_get_files,
	middleHandler_ticket_history,	
	middleHandler_filehist_temp,
	middleHandler_ticket_edit_getdata,		
	function(req,res){
	//console.log("/filehist");
	var id = req.query.id
	var form = replace_all_array("<div style='display:none;' id='file-links-@@id'>@@file_links</div>" + file_history_detail(req.ticket_files), req.ticket_data[0])
	var links = file_links_detail(req.ticket_files)
	res.write(form + "::::" + req.ticket_history + "::::" + links)	
	res.end();	
})


const _sql_db_check_guest_code = (function () {/*  
	SELECT autoID, css_url FROM properties WHERE hid = '@@code' LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_guest_code_check(req, res, next) {	
	//console.log("  middleHandler_guest_code_check " + req.query.id);						
	var sql = _sql_db_check_guest_code.replace('@@code', req.query.id)
	req.guest_code_pid = 0
	req.guest_code_css_url = 'http://127.0.0.1:4349/GrandHotel/css/style.css'
	db.each(sql, function(err, row) {						
		//todo add error handler		
		req.guest_code_pid = row.autoID
		req.guest_code_css_url = row.css_url
	}, function () {			
		next()
	});
}


restapi.get('/gen', 
	middleHandler_guest_code_check,
	function(req, res){
	//console.log('/gen '+req.query.id )
	var html = "Error Guest Login"
	//console.log(req.guest_code_pid);
	if(req.guest_code_pid > 0) {
		var css = replace_all_array(_guest_gen_css, {id: req.query.id})	
		html = replace_all_array(_guest_gen_page, {
			id: req.query.id, 
			css: css, 
			sport: env.guest_server})	
	}
	res.write(html)
	res.end()
})

const _sql_db_guest_custom = (function () {/*  
	SELECT para2 FROM homepage WHERE autoID = @@autoID AND para2 != '' LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_guest_custom(req, res, next) {	
	//console.log("  middleHandler_guest_custom " + req.guest_code_pid);						
	req.guest_custom_para2 = 'Please confirm that the above information is correct and press Submit Inquiry Now to complete your request, or select the Back button to make changes'
	if(req.guest_code_pid > 0) {
		var sql = _sql_db_guest_custom.replace('@@autoID', req.guest_code_pid)
		db.each(sql, function(err, row) {						
			//todo add error handler					
			req.guest_custom_para2 = row.para2
		}, function () {			
			next()
		});
	} else {next();}
}

restapi.get('/guest-login', 
	middleHandler_guest_code_check,
	middleHandler_guest_custom,
	
	function(req, res){
	//console.log('/guest-login '+req.query.id )
	var html = "Error Guest Login2"
	if(req.guest_code_pid > 0) {
		var css = replace_all_array(_guest_gen_css, {id: req.query.id})	
		var csslink = "<style>"+css+"</style>"
		if(req.guest_code_css_url!=''){csslink = "<link href='"+req.guest_code_css_url+"' rel='stylesheet' type='text/css'>"}
		var ps = req.query.id+'-0'
		var eq = "[a-z0-9._%+-]+@[=a-z0-9.-]+\[a-z]{2,3}&#36;"; //&#36; replaces $
		var inputs = guest_input(1, 2, ps, "fname", "First Name", "text", "", "First Name","")
		//#append inputs [guest_input 0 3 $ps mi "Middle Initial" text "" ""]
		inputs += guest_input(1, 3, ps, "lname", "Last Name", "text", "", "Last Name","")
		inputs += guest_input(1, 4, ps, "room", "Room #", "text", "[0-9]{1-5}", "Room Number","")
		inputs += guest_input(1, 5, ps, "lastfour", "Last Four", "text", "[0-9]{4,4}", "CC Last 4 Digits","style='display:none;'")
		inputs += guest_input(1, 6, ps, "checkin", "Check In Date", "date", "\d{1,2}/\d{1/2}/\d{1,4}", "mm/dd/yyyy","")
		inputs += guest_input(1, 7, ps, "checkout", "Check Out Date", "date", "\d{1,2}/\d{1/2}/\d{1,4}", "mm/dd/yyyy","")
		inputs += guest_input(1, 8, ps, "email", "Email Address", "email", eq, "Enter your email address here","")
		inputs += guest_input(1, 9, ps, "email2", "Re-Enter Email", "email", eq, "Re-enter your email address here","")
	
		inputs += guest_input(1, 10, ps, "phone", "Phone", "phone", "\d{3}[\-]\d{3}[\-]\d{4}", "Enter your phone number here","")
	
		var morebox = guest_input(1, 12, ps, "cancellation", "Confirmation #", "text", "", "","")
		morebox += guest_input(1, 13, ps, "spg", "SPG #", "text", "", "")
		morebox += guest_input(1, 14, ps, "amount", "Refund Requested", "number", "", "","")
		
		var displays = guest_display(ps, "itype", "Request Type")
		displays += guest_display(ps, "name", "Name")
		displays += guest_display(ps, "room", "Room")
		displays += guest_display(ps, "lastfour", "CC Last 4 Digits")		
		displays += guest_display(ps, "dates", "Dates")
		displays += guest_display(ps, "email", "Email Address")
		displays += guest_display(ps, "phone", "Phone")

		var moredsp = guest_display(ps, "cancellation", "Confirmation #")
		moredsp += guest_display(ps, "spg", "SPG #")
		moredsp += guest_display(ps, "amount", "Refund Requested")

		
		html = _guest_login_page.replace('@@js', _guest_login_js)
		html = html.replace('@@inputs', inputs)
		html = html.replace('@@morebox', morebox)
		html = html.replace('@@displays', displays)
		html = html.replace('@@moredsp', moredsp)
		html = html.replace('@@para2', req.guest_custom_para2)
		html = replace_all_array(html, {
			ps: req.query.id+'-0',
			csslink: csslink
		})
	}
	res.write(html)
	res.end()
})

const _sql_db_guest_validate_property = (function () {/*  
	SELECT autoID as pid FROM properties WHERE hid = '@@prop'
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_guest_request_validate_property(req, res, next) {	
	//console.log("  middleHandler_guest_request_validate_property "+req.query.ps);
	req.shared_request_prop = 0
	var prop = 0
	var ps = req.query.ps.split('-')
	req.errors = []
	if(ps.length==2){
		prop = ps[0];
		var sql = "SELECT autoID as pid FROM properties WHERE hid = '"+prop+"' LIMIT 1"
		db.each(sql, function(err, row) {						
			req.shared_request_prop = row.pid
			//console.log('shared2 = '+row.pid)
		}, function () {		
			if(req.shared_request_prop == 0){
				req.errors.push("Invalid prop1")
			}
			next()
		});
	}else{
		req.errors.push("Invalid prop2")
		next()
	}	
}

const _sql_db_guest_duplicate_check = (function () {/*  
	SELECT * FROM tickets WHERE
		pid = @@pid AND
		fname = '@@fname' AND
		lname = '@@lname' AND
		email = '@@email'	AND
		description = '@@description'
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_guest_request_validate_duplicate(req, res, next) {	
	//console.log("  middleHandler_guest_request_validate_duplicate " + req.errors.length);	
	if(req.errors.length==0){
		var sql = replace_all_array(_sql_db_guest_duplicate_check, {
			pid: req.shared_request_prop,
			fname: decode(req.query.fn),
			lname: decode(req.query.ln),
			email: req.query.em,
			description: req.query.ds
		})
		var found = false;
		db.each(sql, function(err, row) {						
			req.errors.push("Duplicate Ticket found")
		}, function () {		
			next()
		});
	}else{
		next()
	}	
}

//todo more validation, like total length
function middleHandler_guest_request_validate_user_supplied(req, res, next) {	
	//console.log("  middleHandler_guest_request_validate_user_supplied " + req.errors.length);	
	if(req.errors.length==0){
		if(req.query.ty!=1&&req.query.ty!=2){req.errors.push("Type Error")}
		if(decode(req.query.fn).length==0||decode(req.query.ln).length<2){req.errors.push("First or Last Name not supplied")}
		var em = req.query.em.toLowerCase();
		var rm = req.query.rm.toLowerCase();
		if(em != rm){req.errors.push("Email's do not match")}
		if(!validateEmail(em)){req.errors.push("Invalid email address")}
		if(req.query.ph.length==0){req.errors.push("Phone number is required")}
		if(req.query.ds.length==0){req.errors.push("A description is required")}		
	}
	next()		
}

const _sql_db_guest_first_ticket_test = (function () {/*  
	SELECT ticketno FROM tickets WHERE pid = @@pid ORDER BY autoID DESC LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_shared_request_first_ticket_test(req, res, next) {	
	//console.log("  middleHandler_shared_request_first_ticket_test " + req.errors.length);	
	req.newticketno = 10000
	if(req.errors.length==0){
		var sql = replace_all_array(_sql_db_guest_first_ticket_test, {
		pid: req.shared_request_prop,
		})
		var found = false;
		db.each(sql, function(err, row) {						
			req.newticketno = parseInt(row.ticketno) + 1
		}, function () {		
			next()
		});
	}else{
		next()
	}	
}

const _sql_db_guest_insert_ticket = (function () {/*  
	INSERT INTO tickets VALUES(NULL, @@status, @@pid, @@ticketno,
	'@@tdate', '@@fn', '@@mi', '@@ln', '@@em', '@@ph', '', 0, 0, @@am, '@@ds', 
	'@@rn', '@@ci', '@@co', '', 0, '@@ca', '@@sp', @@ty,
	@@month, @@day, @@year, '', 0, 0, 0, '@@gcode', '', @@cs, 0, 4, '@@cc')	
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_guest_request_insert_ticket(req, res, next) {	
	//console.log("  middleHandler_guest_request_insert_ticket " + req.errors.length);	
	req.guest_ticket_inserted = 0
	req.guest_ticket_gcode = ''
	if(req.errors.length==0){
		var d = new Date
		var cdt = clk(d);
		var guid = require('guid');
		req.guest_ticket_gcode = guid.create();
		
		if(req.query.am.toString().length==0){req.query.am = "0"}
		var amt = req.query.am.replace(/[^0-9.]+/g, '')
		if(amt>0){amt = amt * 100}
		
		var sql = replace_all_array(_sql_db_guest_insert_ticket, {
		status: STATUS_SUBMITTED,
		pid: req.shared_request_prop,
		ticketno: req.newticketno,
		tdate: cdt,
		fn: decode(req.query.fn),
		mi: decode(req.query.mi),
		ln: decode(req.query.ln),
		em: req.query.em.toLowerCase(),
		ph: req.query.ph,
		am: amt,
		ds: credit_card_mask(req.query.ds),
		rn: req.query.rn,
		ci: req.query.ci,
		co: req.query.co,
		ca: decode(req.query.ca),
		sp: decode(req.query.sp),
		ty: req.query.ty,
		month: d.getMonth(),
		day: d.getDate(),
		year: d.getFullYear(),
		gcode: req.guest_ticket_gcode,
		cs: parseInt(d.getTime() / 1000),
		cc: decode(req.query.cc)
		})
		var found = false;		
		db.run(sql, function(err) {									
		}, function (err) {		
			req.guest_ticket_inserted = 1
			next()
		});
	}else{
		next()
	}	
}


const _sql_db_guest_ticket_status = (function () {/*  
INSERT INTO ticket_status VALUES(NULL, @@pid, 0, @@ticketno, @@status,'@@tdate', 'Ticket Created by Guest','')
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_guest_ticket_status(req, res, next) {	
	//console.log("  middleHandler_guest_ticket_status "+req.guest_ticket_inserted);			
	if(req.guest_ticket_inserted==1){
		var sql = replace_all_array(_sql_db_guest_ticket_status, {
			pid: req.shared_request_prop,
			ticketno: req.newticketno,
			status: STATUS_SUBMITTED,
			tdate: rbp_dte()
			})		
		db.run(sql, function(err) {						
			//todo add error handler
		}, function () {			
			next()});
	} else {next()}
}


const _sql_db_guest_select_thank_you = (function () {/*  
	SELECT para3 as thankyou FROM homepage WHERE pid = @@pid LIMIT 1
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function middleHandler_guest_request_thank_you(req, res, next) {	
	//console.log("  middleHandler_guest_request_thank_you " + req.errors.length);	
	req.guest_thank_you = "Thank you for your inquiry.  A representative will be contacting you shortly."
	if(req.errors.length==0){
		var sql = _sql_db_guest_select_thank_you.replace('@@pid', req.shared_request_prop)
		db.each(sql, function(err, row) {						
			req.guest_thank_you = row.thankyou
		}, function () {		
			next()
		});
	}else{
		next()
	}		
}

var _em_link_text = (function () {/*
Guest Name: @@fname @@lname
Inquriy Date: @@tdate
Email: @@email

@@description

To reply to this message, please use the following link:
<a rel='nofollow' target='_blank' href='@@sport/guest/ticket/comment?id=@@id&gcode=@@gcode'>@@sport/guest/ticket/comment?id=@@id&gcode=@@gcode</a>

	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

var _em_link_html = (function () {/*
<br><br>
Guest Name: @@fname @@lname<br>
Inquriy Date: @@tdate<br>
Email: @@email<br><br>
@@description<br><br>
To reply to this message, please use the following link:<br><br>
<a rel='nofollow' target='_blank' href='@@sport/guest/ticket/comment?id=@@id&gcode=@@gcode'>@@sport/guest/ticket/comment?id=@@id&gcode=@@gcode</a>
<br><br>
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	
	
function middleHandler_guest_request_message(req, res, next) {
	//console.log("  middleHandler_guest_request_message");	
	req.sendmail_send = false;
	if(req.errors.length == 0){
		req.sendmail_send = true;
		req.sendmail_from = env.sendmail_from_noreply
		req.sendmail_to = req.query.em.toLowerCase();
		req.sendmail_subject = req.em_subject;
		var body = req.em_body		
		var params = {sport: env.server, id: req.tickets[0]['id'], gcode: req.guest_ticket_gcode, fname: req.tickets[0]['fname'], lname: req.tickets[0]['lname'], tdate: req.tickets[0]['tdate'], email: req.tickets[0]['email'], description: req.tickets[0]['description']}
		req.sendmail_text = body + replace_all_array(_em_link_text, params)
		req.sendmail_html = body + replace_all_array(_em_link_html, params)
		req.sendmail_okresponse = 'Message sent.'
	}
	next();
}	

restapi.get('/guest-request', 
	middleHandler_guest_request_validate_property,
	middleHandler_guest_request_validate_duplicate,
	middleHandler_guest_request_validate_user_supplied,
	middleHandler_shared_request_first_ticket_test,
	middleHandler_guest_request_insert_ticket,
	middleHandler_db_get_last_ticket_inserted,
	middleHandler_guest_ticket_status,
	middleHandler_guest_request_thank_you,
	middleHandler_guest_ticket_create_msgprep,
	middleHandler_guest_request_message,
	middleHandler_send_message,
	function(req, res){
	if(_debug){
		console.log('/guest-request '+req.query.ps )	
		console.log(req.shared_request_prop)
		console.log(req.errors)
	}
	if(req.errors.length>0){
		res.write("errors::::"+req.errors.join())
	} else {
		res.write("success::::"+req.guest_thank_you)
		
		//console.log(req.tickets[0])
		var row = replace_all_array(_ticket_tr, req.tickets[0])
		row = row.replace('@@bubble','');
		var bit = "tr::::ticket-trow-"+req.tickets[0]['id']+"::::"+row		
		bit = bit.replace(/(\r\n|\n|\r)/gm,"")
		io.emit('guest-request-'+req.tickets[0]['prop'], {id: req.tickets[0]['id'], status: req.tickets[0]['status'], html: bit})
	}
	res.end();
})	



const _guest_ticket_page = (function () {/*
	<<bigheader>>
				<body>
					<div id='notifydept-list' style='display:none;'>$deptlist</div>
					<div class='container'>
						<div id='form-pan-cont' class='panel-container'>
							<div id='ticket-form-comment' style='border:1px solid #ccc;'>
								<div class='frm'>
									<div>
										<div>
											@@content
											<div><div><button onclick='guest_comment(@@id,&quot;@@gcode&quot;);'>Send Comment</button></div>
										</div>
										<div>
											@@history
										</div>
									</div>
									
								</div>
							</div>
						</div>
						<div id='form-working' style='display:none;'>
							Working... Please wait.
						</div>
						<div id='can-close' style='display:none;'>
							Thank you.  A representative will be contacting you shortly.
						</div>
					</div>
					
					
	<div id='stat-form' style='display:none;max-width: 100%' title='Update Status'>		
	<form>
	<fieldset id='stat-form-fs-1'>
	<label for='curpw'>Internal Comment <div style='display:none;' id='ticket-require-label'>(Required)</div></label>
	<textarea id='statdesc' rows=5 style='width:100%;' class='text ui-widget-content ui-corner-all'></textarea>
	<input type='submit' tabindex='-1' style='position:absolute; top:-1000px'>


	<input type='checkbox' name='ticket-notify' id='ticket-notify' onclick='ticketreqlabel()' style='display:inline;margin-top:10px;' class='text ui-widget-content ui-corner-all'>
	<label for='ticket-notify'  style='display:inline;'> Notify.. <div style='display:inline;' id='notifydept'>Department</div> by Email</label><br>
	<div id='notifydept-list' style='display:none;'>$deptlist</div>

	<div id='ticket-wrap-customer'>
	<input type='checkbox' name='ticket-notifcust' id='ticket-notifcust' onclick='' style='display:inline;margin-top:10px;' class='text ui-widget-content ui-corner-all'>
	<label for='ticket-notifcust'  style='display:inline;'> Notify Guest by Email</label><br>
	</div>

	<div id='ticket-wrap-pending'>
	<input type='checkbox' onclick='chkone(this);' name='ticket-move-pending' id='ticket-move-pending' style='display:inline;margin-top:10px;' class='text ui-widget-content ui-corner-all'>
	<label for='ticket-move-pending'  style='display:inline;' id='ticket-desc-pending' > Move to Pending</label>
	</div>

	<div id='ticket-wrap-awaiting'>
	<input type='checkbox' onclick='chkone(this);' name='ticket-move-awaiting' id='ticket-move-awaiting' style='display:inline;margin-top:10px;' class='text ui-widget-content ui-corner-all'>
	<label for='ticket-move-awaiting'  style='display:inline;' id='ticket-desc-awaiting' > Move to Awaiting Approval</label>
	</div>

	<div id='ticket-wrap-approved'>	
	<input type='checkbox' onclick='chkone(this);' name='ticket-move-approved' id='ticket-move-approved' style='display:inline;margin-top:10px;' class='text ui-widget-content ui-corner-all'>
	<label for='ticket-move-approved'  style='display:inline;' id='ticket-desc-approved' > Close</label>
	</div>

	<div id='ticket-wrap-files'>	


	</div>

	</fieldset>
	<div id='stat-form-wk-1' style='display:none;padding-top:18px;'>Working, please wait...</div>

	</form>
	</div>

	<div id='close-confirm' style='display:none;' title='Confirm Guest Email'>
	<form>
	<p><span class='ui-icon ui-icon-alert'></span>This ticket has an automatic notification email or an external comment which will generate an email to the guest.  Are you sure you want to process this ticket and send an email?</p>
	</form>
	</div>
				
					
					
					
				</body>
			</html>
*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	

const _guest_ticket_form = (function () {/*
			<div>
				<label class='desc' for='ticket.tk.checkin'>Check In</label>
				<div><input id='ticket.tk.checkin' name='ticket.tk.checkin' type='date' class='field text fn inputs' value='@@check_in' size='12' tabindex='4' pattern='/^[0,1]?\d{1}\/(([0-2]?\d{1})|([3][0,1]{1}))\/(([1]{1}[9]{1}[9]{1}\d{1})|([2-9]{1}\d{3}))@@/'></div>
			</div>
			<div>
				<label class='desc' for='ticket.tk.checkout'>Check Out</label>
				<div><input id='ticket.tk.checkout' name='ticket.tk.checkout' type='date' class='field text fn inputs' value='@@check_out' size='12' tabindex='5' pattern='/^[0,1]?\d{1}\/(([0-2]?\d{1})|([3][0,1]{1}))\/(([1]{1}[9]{1}[9]{1}\d{1})|([2-9]{1}\d{3}))@@/' ></div>
			</div>
			<div>
				<label class='desc' for='ticket.tk.cancellation'>Confirmation #</label>
				<div><input readonly type='text' class='field text fn inputs ro' value='@@cancellation' tabindex='2'></div>
			</div>

			<div>
				<label class='desc' for='ticket.tk.phone'>Phone</label>
				<div><input onblur='formatPhone(this);' id='ticket.tk.phone' name='ticket.tk.phone' type='text' class='field text fn inputs' value='@@phone' size='12' tabindex='7' pattern='\d{3}[\-]\d{3}[\-]\d{4}'></div>
			</div>
			
			
			<div>
				<label class='desc' for='ticket.tk.desc' style='padding-top: 10px;'>Inquiry</label>
				<div>
					<div style='display:inline-block;border: solid 1px #C0C0C0;min-height:50px;width: 415px;margin-bottom: 6px;padding: 6px;margin-top: 4px;'>@@description</div>	
				</div>
			</div>
			<div>
				<label class='desc' for='guest.me.message'>Comment</label>
				<div>
					<textarea style='margin-top:-1px;' onkeyup='guest_msgcount();' id='guest.me.message' name='guest.me.message' spellcheck='true' rows='6' cols='50' tabindex='1' placeholder='Enter your message here'></textarea>
					<div><div style='display:inline;' id='guest.me.length'>500</div> characters left</div>
				</div>			
			</div>
			
			<div style='display:;'>
				<label class='desc' for='ticket.tk.fname'>Choose a File to Upload</label>
				<div>
					<div style='display:inline;'>
						<form enctype='multipart/form-data' target='receiver' action='@@xport/gupload' method='POST'>
							<input type='hidden' name='id' value='@@id'>
							<input type='hidden' name='token' value='@@upload_token'>
							<input type='hidden' name='MAX_FILE_SIZE' value='100000' />
							<div style='display:inline;'>Step 1: <input style='display:inline; margin-top: 4px; margin-bottom: 4px;' name='uploadedfile' type='file' value='Choose File (pdf,doc,rtf,xls)' accept='application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/rtf'/></div><br>						
							<div style='display:inline;'>Step 2: <input style='display:inline;' type='submit' onclick='cd(&quot;file-hist-@@id&quot;);' value='Upload File' /></div>
						</form>							
					</div>
					<iframe name='receiver' id='receiver' style='height:60px;margin-bottom: 10px;border:1px solid #c0c0c0;width: 50%;'></iframe>
				</div>
			</div>
			
	*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	


//selects a ticket using the id and guid code (to prevent hacking by ticket id).
function middleHandler_guest_only_precheck(req, res, next) {	
	if(_debug){console.log("  middleHandler_guest_only_check");}
	req.guest_only_pre_pid = 0
	req.guest_only_pre_ticketno = 0
	if(req.query.id > 0 && req.query.gcode != ''){		
		var sql = "SELECT pid, ticketno FROM tickets WHERE autoID = "+req.query.id+" AND guest_edit_code = '"+req.query.gcode+"'"
		db.each(sql, function(err, row) {						
			req.guest_only_pre_pid = row.pid
			req.guest_only_pre_ticketno = row.ticketno
		}, function () {			
			next()});
	} else {next()}
}
	
function middleHandler_ticket_guest_getdata(req, res, next) {	
	//console.log("  middleHandler_ticket_guest_getdata");		
	req.guest_ticket_history = [];
	if(req.query.id > 0 && req.query.gcode != ''){		
		var sql = "SELECT userid as uid, status as stat, sdate, notes, nick FROM ticket_status WHERE pid = "+req.guest_only_pre_pid+" AND ticketno = "+req.guest_only_pre_ticketno+" ORDER BY autoID DESC"
		if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {						
			req.guest_ticket_history.push(row)
		}, function () {			
			next()});
	} else {next()}
}

function middleHandler_guest_only_history(req, res, next) {	
	if(_debug){console.log("  middleHandler_guest_only_history");}
	req.guest_ticket = [];
	if(req.query.id > 0 && req.query.gcode != ''){		
		var sql = "SELECT * FROM tickets WHERE autoID = "+req.query.id+" AND guest_edit_code = '"+req.query.gcode+"'"
		if(_debug){console.log(sql)}
		db.each(sql, function(err, row) {						
			req.guest_ticket.push(row)
		}, function () {			
			next()});
	} else {next()}
}

restapi.get('/guest/ticket/comment', 
	middleHandler_guest_only_precheck,
	middleHandler_ticket_guest_getdata,
	middleHandler_guest_only_history,	
	function(req, res){
	if(_debug){
		console.log('/guest/ticket/comment '+req.query.id )	
		console.log(req.guest_ticket[0])
	}
	req.errors = [];
	if(req.errors.length>0){
		var html = "An error occured"
	} else {
		var history = ""
		if(req.guest_ticket_history.length>0){
			var hist = "<label class='desc' for='ticket.tk.history' style='padding-top: 10px;'>Comment History</label><div class='assoc-comments' style='padding-left: 0px;'>"
			for(var x=0;x<req.guest_ticket_history.length;x++){				
				var dt = new Date(req.guest_ticket_history[x]['sdate']);
				var isodate = dt.toISOString();
				var nts = req.guest_ticket_history[x]['notes']
				var notes = ""
				if (nts.substr(0,16) == "Comment To Guest:") { 
					notes = "Comment From Hotel: " + nts.substr(17)
					history += "<time datetime='"+isodate+"' data-localtime-format></time><br><em>"+emailprep(notes)+"</em><br><br>"			
				}
				if (notes.substr(0,18) == "Comment From Guest:") { 
					notes = "Comment To Hotel: " + nts.substr(19)
					history += "<time datetime='"+isodate+"' data-localtime-format></time><br><em>"+emailprep(notes)+"</em><br><br>"			
				}				
			}
			hist += history+"</div>"
		} 
		
		var html = _guest_ticket_page.replace('<<bigheader>>', _bigheader);
		html = replace_all_array(html, {id: req.query.id, gcode: req.query.gcode})
		var form =  replace_all_array(_guest_ticket_form, req.guest_ticket[0])		
		form = replace_all_array(form, {id: req.query.id, upload_token: req.query.gcode, xport: env.server})
		html = html.replace('@@content', form)
		html = html.replace('@@history', history)
	}
	res.write(html)
	res.end();
})	

function middleHandler_guest_only_update_status(req, res, next) {	
	if(_debug){console.log("  middleHandler_guest_only_update_status");}
	if(req.query.id > 0 && req.guest_ticket[0]['status'] == STATUS_APPROVED){	
		var sql = "UPDATE tickets SET status = "+STATUS_REOPENED+" WHERE autoID =  = "+req.query.id+" AND guest_edit_code = '"+req.query.gcode+"'"
		if(_debug){console.log(sql)}
		db.run(sql, function(err) {						
		}, function () {			
			next()});
	} else {next()}
}

function middleHandler_guest_only_insert_status(req, res, next) {	
	if(_debug){console.log("  middleHandler_guest_only_insert_status");}
	if(req.query.id > 0){			
		var comment = clean(decode(req.query.comment));
		var sql = "INSERT INTO ticket_status VALUES(NULL, @@pid, 0, @@ticketno, "+STATUS_REOPENED+",'@@tdate', 'Comment From Guest: "+comment+"','')"
		sql = replace_all_array(sql, req.guest_ticket[0])
		if(_debug){console.log(sql)}
		db.run(sql, function(err) {						
		}, function () {			
			next()});
	} else {next()}
}

restapi.get('/guest/ticket/comment/accept', 
	middleHandler_guest_only_precheck,
	middleHandler_ticket_guest_getdata,
	middleHandler_guest_only_history,	
	middleHandler_guest_only_update_status,
	middleHandler_guest_only_insert_status,
	function(req, res){
	if(_debug){
		console.log('/guest/ticket/comment/accept '+req.query.id )	
		console.log(req.guest_ticket[0])
	}
	res.write('')
	res.end();
})	

	
const _grand_hotel_home = (function () {/*

	<!--A Design by W3layouts
		Author: W3layout
		Author URL: http://w3layouts.com
		License: Creative Commons Attribution 3.0 Unported
		License URL: http://creativecommons.org/licenses/by/3.0/
		-->
		<!DOCTYPE HTML>
		<html>
		<head>
		<title>The Grand-Hotel | Home :: w3layouts</title>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
		<link href="/GrandHotel/css/style.css" rel="stylesheet" type="text/css" media="all" />
		</head>
		<body>
		<div class="wrap">
		<div class="header">
			<div class="logo">
				<a href="index.html"><img src="/GrandHotel/images/logo.png" alt=""></a>
			</div>
			<div class="search-form">
			<form>
				<fieldset>
					<label><input type="text" value="Search" onfocus="if(this.value=='Search'){this.value=''}" onblur="if(this.value==''){this.value='Search'}"></label><input type="image" src="/GrandHotel/images/search-form-input-img.png" alt="">
				</fieldset>
			</form>
			</div>
			<div class="clear"></div>
				<div class="nav">
				<ul>   	
						<li class="active"><a href="/GrandHotel/index.html">HOME</a></li>
						<li><a href="/GrandHotel/about.html">ABOUT</a></li>
						<li><a href="/GrandHotel/booking.html">BOOKING</a></li>
						<li><a href="/GrandHotel/contact.html">CONTACT</a></li>
						<li><a href="/GrandHotel/inquiry.html">BILLING</a></li>
					</ul>
		</div>
			<div class="clear"></div>
		<div class="header-banner">
			<div class="banner">
				<img src="/GrandHotel/images/banner1.jpg" alt="">
			</div>
			
			<div class="clear"></div>
		</div>
		</div>
		<div class="clear"></div>
		<div class="content">
		<div class="cont-box1">
				 <div class="grid2">
					<h4><img src="/GrandHotel/images/h4-bg.png" alt=""><a>Book A Room</a></h4>
			<div class="booking-form">	
				<h3>Reservation Form</h3>
					  <form action="#" id="reservation-form">
					  <fieldset>
					  <div class="rowElem">
							<strong>Check in</strong><br>
							<label><input type="text" name="Day" value="30" class="input"></label><label><input type="text" name="month" value="April 2010" class="input1"></label>
					 </div>
					  <div class="rowElem1">
							<strong>Check out</strong><br>
							<label><input type="text" name="Day" value="01" class="input"></label><label><input type="text" name="month" value="May 2010" class="input1"></label>
						</div>
				   <div>
					<strong>Persons</strong> <label><input type="text" name="Day" value="1" class="input2"></label> <strong>Rooms</strong> &nbsp;<label><input type="text" name="Day" value="1" class="input2"></label>
					
				   </div>
					  </fieldset>
					</form>
				 <div class="form-button">
						<form>
							<input type="submit" value="Check Availabilty">
						</form> 
				</div>
				 <div class="search-button">
						<form>
							<input type="submit" value="Advanced Search">
						</form> 
				</div>
					<div class="clear"></div>
		</div>
		</div>
		</div>
		<div class="cont-right-box">
			<div class="cont-right-logo">
				<h2>Buy<a>Gift Vouchers Here!</a></h2>
			</div>
					<div class="cont-img-logo">
					<img src="/GrandHotel/images/pic.jpg" alt="">
					</div>
					<div class="cont-para">
					<span>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's  </span>
					<p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when </p>
					<p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard  </p>
					<div class="read-m">
						<a>Read More</a>
					</div>
					</div>
			</div>
			<div class="clear"></div>
		</div>

		<div class="cont-grid-list">
			 <h4><img src="/GrandHotel/images/h4-bg.png" alt=""><a>In <span> Room</span></a></h4>
			 <div class="cont-nav">
			<nav>
			<ul>
				<li><a href="#">Rediffusion and Library</a></li>
				<li><a href="#">Color TV</a></li>
				<li><a href="#">Video Con</a></li>
				<li><a href="#">Mini-bar</a></li>
				<li><a href="#">Color TV</a></li>
				<li><a href="#">Rediffusion</a></li>
				<li><a href="#">Color TV</a></li>
				<li><a href="#">Video Con</a></li>
				<li><a href="#">Video Con</a></li>
			</ul>
		</nav>
			<div class="read-m">
						<a>See All</a>
					</div>
			</div>
		</div>
		<div class="cont-grid-list">
			 <h4><img src="/GrandHotel/images/h4-bg.png" alt=""><a>Soft <span>Deals</span></a></h4>
			 <p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when </p>
			 <div class="grid_2">
				<ul class="list">
						<li>Los Angeles<br> <a href="#">Hotels, Things to do</a></li>
						<li>New York City<br> <a href="#">Hotels, Things to do</a> </li>
						<li>Orlando<br> <a href="#">Hotels, Things to do</a></li>
						<li>Paris<br> <a href="#">Hotels, Things to do</a></li>
				</ul>
			</div>
				 <div class="grid_2">
				<ul class="list">
						<li>Los Angeles<br> <a href="#">Hotels, Things to do</a></li>
						<li>New York City<br> <a href="#">Hotels, Things to do</a> </li>
						<li>Orlando<br> <a href="#">Hotels, Things to do</a></li>
						<li>Paris<br> <a href="#">Hotels, Things to do</a></li>
				</ul>
			</div>
		</div>
		<div class="cont-grid-list">
			 <h4><img src="/GrandHotel/images/h4-bg.png" alt=""><a>SPECIAL <span>OFFER!</span></a></h4>
			 <div class="cont-img-logo">
					<img src="/GrandHotel/images/pic1.jpg" alt="">
			</div>
			<h5>Get Breakfast with hot pizza......</h5>
		</div>
				<div class="clear"></div>
		<div class="footer">
				<div class="f-link">
					<a>terms of use </a>
				</div>
				<div class="f-link1">
					<a>privacy statement </a>
				</div>
				<div class="f-copyrights">
					<p>?all rights reserved | Designed by  <a href="http://w3layouts.com/">W3Layouts</a></p>	
				</div>
			<div class="clear"></div>
		</div>
		</div>
		</body>
		</html>
*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	

const _grand_hotel_about = (function () {/*
<!--A Design by W3layouts
		Author: W3layout
		Author URL: http://w3layouts.com
		License: Creative Commons Attribution 3.0 Unported
		License URL: http://creativecommons.org/licenses/by/3.0/
		-->
		<!DOCTYPE HTML>
		<html>
		<head>
		<title>The Grand-Hotel | About :: w3layouts</title>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
		<link href="/GrandHotel/css/style.css" rel="stylesheet" type="text/css" media="all" />
		</head>
		<body>
		<div class="wrap">
		<div class="header">
			<div class="logo">
				<a href="index.html"><img src="/GrandHotel/images/logo.png" alt=""></a>
			</div>
			<div class="search-form">
			<form>
				<fieldset>
					<label><input type="text" value="Search" onfocus="if(this.value=='Search'){this.value=''}" onblur="if(this.value==''){this.value='Search'}"></label><input type="image" src="/GrandHotel/images/search-form-input-img.png" alt="">
				</fieldset>
			</form>
			</div>
			<div class="clear"></div>
				<div class="nav">
					<ul>   	
						<li><a href="/GrandHotel/index.html">HOME</a></li>
						<li class="active"><a href="/GrandHotel/about.html">ABOUT</a></li>
						<li><a href="/GrandHotel/booking.html">BOOKING</a></li>
						<li><a href="/GrandHotel/contact.html">CONTACT</a></li>
						<li><a href="/GrandHotel/inquiry.html">BILLING</a></li>
					</ul>
				</div>
			<div class="clear"></div>
			<div class="header-banner">
				<div class="clear"></div>
			</div>
		</div>
		<div class="clear"></div>
		<div class="content">
				<div class="cont-logo">
					<h2>Guest Information</h2>
				</div>
			<div class="cont-left">
				<div class="cont-left-main"> 
					<span>Lorem Ipsum is simply dummy text of the printing and typesetting industry.</span>
					<div class="about-para">
						<p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unkn</p>
						<p>The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33 from "de Finibus Bonorum et Malorum" by Cicero are also reproduced in their exact original form, accompanied by English versions from the 1914 translation by H. Rackham.</p>
					</div>
					<div class="about-pic">
						<img src="/GrandHotel/images/pic4.jpg" alt="">
					</div>
				<div class="clear"></div>
				</div>
				<div class="grid-list-main">
					<h4>Our Values</h4>
					<p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when </p>
				</div>
				<div class="grid-list">
					<h4>Our Service</h4>
						<div class="grid-list-logo"><img src="/GrandHotel/images/customer-ser.png" alt=""></div>
						<div class="grid-list-para">
							<p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when </p>
							<div class="readmore1"><a><img src="/GrandHotel/images/doubledisc.gif" alt="">Read	More</a></div>
						</div>
				</div>
				<div class="grid-list1">
					<h4>Soft Drinks</h4>
					<div class="grid-list-logo"><img src="/GrandHotel/images/ico-med-2.png" alt=""></div>
						<div class="grid-list-para">
							<p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when </p>
							<div class="readmore1"><a><img src="/GrandHotel/images/doubledisc.gif" alt="">Read	More</a></div>
						</div>
				</div>
				<div class="clear"></div>
				<div class="grid-list1">
					<h4>Global Rest</h4>
					<div class="grid-list-logo"><img src="/GrandHotel/images/ico-med-3.png" alt=""></div>
						<div class="grid-list-para">
							<p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when </p>
							<div class="readmore1"><a><img src="/GrandHotel/images/doubledisc.gif">Read	More</a></div>
						</div>
				</div>
				<div class="grid-list">
					<h4>VideoCon</h4>
					<div class="grid-list-logo"><img src="/GrandHotel/images/ico-med-4.png"></div>
					<div class="grid-list-para">
						<p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when  </p>
						<div class="readmore1"><a><img src="/GrandHotel/images/doubledisc.gif">Read	More</a></div>
					</div>
				</div>
				<div class="clear"></div>
				<div class="cont-bot-para">
				<p>The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33 from "de Finibus Bonorum et Malorum" by Cicero are also reproduced in their exact original form, accompanied by English versions from the 1914 translation by H. Rackham.</p>
				</div>
				<div class="clear"></div>
			</div>
		</div>
			<div class="clear"></div>
		<div class="footer">
			<div class="f-link">
				<a>terms of use </a>
			</div>
			<div class="f-link1">
				<a>privacy statement </a>
			</div>
			<div class="f-copyrights">
				<p>� all rights reserved | Designed by  <a href="http://w3layouts.com/">W3Layouts</a></p>	
			</div>
			<div class="clear"></div>
		</div>
		</div>
		</body>
		</html>
		
*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	
	
const _grand_hotel_booking = (function () {/*
<!--A Design by W3layouts
		Author: W3layout
		Author URL: http://w3layouts.com
		License: Creative Commons Attribution 3.0 Unported
		License URL: http://creativecommons.org/licenses/by/3.0/
		-->
		<!DOCTYPE HTML>
		<html>
		<head>
		<title>The Grand-Hotel | Booking :: w3layouts</title>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
		<link href="/GrandHotel/css/style.css" rel="stylesheet" type="text/css" media="all" />
		</head>
		<body>
		<div class="wrap">
		<div class="header">
			<div class="logo">
				<a href="index.html"><img src="/GrandHotel/images/logo.png" alt=""></a>
			</div>
			<div class="search-form">
			<form>
				<fieldset>
					<label><input type="text" value="Search" onfocus="if(this.value=='Search'){this.value=''}" onblur="if(this.value==''){this.value='Search'}"></label><input type="image" src="/GrandHotel/images/search-form-input-img.png" alt="">
				</fieldset>
			</form>
			</div>
			<div class="clear"></div>
				<div class="nav">
					<ul>   	
						<li><a href="/GrandHotel/index.html">HOME</a></li>
						<li><a href="/GrandHotel/about.html">ABOUT</a></li>
						<li class="active"><a href="/GrandHotel/booking.html">BOOKING</a></li>
						<li><a href="/GrandHotel/contact.html">CONTACT</a></li>
						<li><a href="/GrandHotel/inquiry.html">BILLING</a></li>
					</ul>
				</div>
			<div class="clear"></div>
			<div class="header-banner">
				<div class="clear"></div>
			</div>
		</div>
			<div class="clear"></div>
		<div class="content">
		<div class="cont-right-box">
				<div class="cont-right-logo">
					<h2>Welcome<a>&nbsp;Message</a></h2>
				</div>
					<div class="cont-right-grid">
						<div class="cont1-img-logo">
							<img src="/GrandHotel/images/b-pic1.jpg" alt="">
						</div>
					<div class="cont1-para">
						<span>Lorem Ipsum is simply dummy text of the printing and  </span>
					</div>
					 <div class="clear"></div>
					<p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when </p>
					<div class="read-m">
						<a>Read More</a>
					</div>
					</div>
					<div class="cont-right-grid">
						<div class="cont1-img-logo">
							<img src="/GrandHotel/images/b-pic2.jpg" alt="">
						</div>
					<div class="cont1-para">
						<span>Lorem Ipsum is simply dummy text of the printing and  </span>
					</div>
					 <div class="clear"></div>
					<p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when </p>
					<div class="read-m">
						<a>Read More</a>
					</div>
					</div>
					<div class="clear"></div>
		</div>
		<div class="cont-box1">
				 <div class="grid2">
					 <h4><img src="/GrandHotel/images/h4-bg.png" alt=""><a>Book A Room</a></h4>
			<div class="booking-form">	
				<h3>Reservation Form</h3>
					  <form action="#" id="reservation-form">
					  <fieldset>
					  <div class="rowElem">
							<strong>Check in</strong><br>
							<label><input type="text" name="Day" value="30" class="input"></label><label><input type="text" name="month" value="April 2010" class="input1"></label>
					 </div>
					  <div class="rowElem1">
							<strong>Check out</strong><br>
							<label><input type="text" name="Day" value="01" class="input"></label><label><input type="text" name="month" value="May 2010" class="input1"></label>
					  </div>
					   <div>
						<strong>Persons</strong> <label><input type="text" name="Day" value="1" class="input2"></label> <strong>Rooms</strong> &nbsp;<label><input type="text" name="Day" value="1" class="input2"></label>
					   </div>
					  </fieldset>
					</form>
				 <div class="form-button">
						<form>
								<input type="submit" value="Check Availabilty">
						</form> 
				</div>
				 <div class="search-button">
						<form>
								<input type="submit" value="Advanced Search">
						</form> 
				</div>
					<div class="clear"></div>
				 </div>
		</div>
		</div>
			<div class="clear"></div>
		<div class="cont-grid-list">
			 <h4><img src="/GrandHotel/images/h4-bg.png" alt=""><a>In <span> Room</span></a></h4>
			 <div class="cont-nav">
			<nav>
			<ul>
				<li><a href="#">Rediffusion and Library</a></li>
				<li><a href="#">Color TV</a></li>
				<li><a href="#">Video Con</a></li>
				<li><a href="#">Mini-bar</a></li>
				<li><a href="#">Color TV</a></li>
				<li><a href="#">Rediffusion</a></li>
				<li><a href="#">Color TV</a></li>
				<li><a href="#">Video Con</a></li>
				<li><a href="#">Video Con</a></li>
			</ul>
		</nav>
					<div class="read-m">
						<a>See All</a>
					</div>
			</div>
		</div>
		<div class="cont-grid-list">
			 <h4><img src="/GrandHotel/images/h4-bg.png" alt=""><a>SPECIAL <span>OFFER!</span></a></h4>
			 <div class="cont-img-logo">
					<img src="/GrandHotel/images/pic2.jpg">
			</div>
			<h5>Get Breakfast with fruits......</h5>
		</div>
		<div class="cont-grid-list">
			 <h4><img src="/GrandHotel/images/h4-bg.png"><a>Soft <span>Deals</span></a></h4>
			 <p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when </p>
			 <div class="grid_2">
				<ul class="list">
						<li>Los Angeles<br> <a href="#">Hotels, Things to do</a></li>
						<li>New York City<br> <a href="#">Hotels, Things to do</a> </li>
						<li>Orlando<br> <a href="#">Hotels, Things to do</a></li>
						<li>Paris<br> <a href="#">Hotels, Things to do</a></li>
				</ul>
			</div>
			<div class="grid_2">
				<ul class="list">
						<li>Los Angeles<br> <a href="#">Hotels, Things to do</a></li>
						<li>New York City<br> <a href="#">Hotels, Things to do</a> </li>
						<li>Orlando<br> <a href="#">Hotels, Things to do</a></li>
						<li>Paris<br> <a href="#">Hotels, Things to do</a></li>
				</ul>
			</div>
		</div>
				<div class="clear"></div>
		</div>
		<div class="footer">
			<div class="f-link">
				<a>terms of use </a>
			</div>
			<div class="f-link1">
				<a>privacy statement </a>
			</div>
			<div class="f-copyrights">
				<p>� all rights reserved | Designed by  <a href="http://w3layouts.com/">W3Layouts</a></p>	
			</div>
			<div class="clear"></div>
		</div>
		</div>
		</body>
		</html>
*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	

const _grand_hotel_contact = (function () {/*
<!--A Design by W3layouts
		Author: W3layout
		Author URL: http://w3layouts.com
		License: Creative Commons Attribution 3.0 Unported
		License URL: http://creativecommons.org/licenses/by/3.0/
		-->
		<!DOCTYPE HTML>
		<html>
		<head>
		<title>The Grand-Hotel | Contact :: w3layouts</title>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
		<link href="/GrandHotel/css/style.css" rel="stylesheet" type="text/css" media="all" />
		</head>
		<body>
		<div class="wrap">
		<div class="header">
			<div class="logo">
				<a href="index.html"><img src="/GrandHotel/images/logo.png" alt=""></a>
			</div>
			<div class="search-form">
			<form>
				<fieldset>
					<label><input type="text" value="Search" onfocus="if(this.value=='Search'){this.value=''}" onblur="if(this.value==''){this.value='Search'}"></label><input type="image" src="/GrandHotel/images/search-form-input-img.png" alt="">
				</fieldset>
			</form>
			</div>
		 <div class="clear"></div>
				<div class="nav">
					<ul>   	
						<li><a href="/GrandHotel/index.html">HOME</a></li>
						<li><a href="/GrandHotel/about.html">ABOUT</a></li>
						<li><a href="/GrandHotel/booking.html">BOOKING</a></li>
						<li class="active"><a href="/GrandHotel/contact.html">CONTACT</a></li>
						<li><a href="/GrandHotel/inquiry.html">BILLING</a></li>
					</ul>
		</div>
			<div class="clear"></div>
			<div class="header-banner">
				<div class="clear"></div>
			</div>
		</div>
		<div class="clear"></div>
		<div class="content">
			<div class="cont-logo">
				<h2>Get In Touch</h2>
			</div>
		<div class="contact">
			<div class="cont-left-main"> 
					<span>Lorem Ipsum is simply dummy text of the printing and typesetting industry.</span>
					<div class="ser-para">
					<p>The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33 from "de Finibus Bonorum et Malorum" by Cicero are also reproduced in their exact original form, accompanied by English versions from the 1914 translation by H. Rackham.</p>
					</div>
					<div class="clear"></div>
			</div>
			<h3>Contact form:</h3>
		<div class="main">
			<form>
			<table cellspacing="8">
			<tbody><tr><th>NAME:</th><td colspan="6"><input type="text" value="" onfocus="this.value = '';" onblur="if (this.value == '') {this.value = 'Name';}"></td></tr>
			<tr><th>E-Mail Address:</th><td colspan="6"><input type="text" value="" onfocus="this.value = '';" onblur="if (this.value == '') {this.value = 'E-Mail';}"></td></tr>
			<tr><th>Phone Number:</th><td colspan="6"><input type="text" value="" onfocus="this.value = '';" onblur="if (this.value == '') {this.value = 'Phone No';}"></td></tr>
			<tr><th>Address:</th><td colspan="6"><input type="text" value="" onfocus="this.value = '';" onblur="if (this.value == '') {this.value = 'Address';}"></td></tr>
			<tr><th>Likes / Comments:</th></tr>
			<tr><td colspan="6"><textarea value="" onfocus="this.value = '';" onblur="if (this.value == '') {this.value = 'Message';}"></textarea></td></tr>
			 <tr> <td> </td></tr>
			 </tbody></table>
			 </form>
			 <div class="clear"></div>
				<div class="contact-form">
						<div>
							<button class="tsc_c3b_large tsc_c3b_orange tsc_button1">Submit</button>
						</div>
				</div>
		</div>
		   <div class="clear"></div>
		<div class="contact-grids">
					<h4>Contact Details</h4>
					<p>The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those </p>
					<div class="grid-bot">
						<div class="grid1-l-img">
							<img src="/GrandHotel/images/ico-phone.png" alt=""/>
						</div>
						<div class="grid1-l-desc">
							<p>Telephone: +1 959 603 6035</p>
						</div>
						<div class="clear"></div>
				</div>
					<div class="grid-bot">
						<div class="grid1-l-img">
							<img src="/GrandHotel/images/ico-fax.png" alt=""/>
						</div>
						<div class="grid1-l-desc">
							<p> Fax: +1 800 550 6539</p>
						</div>
						<div class="clear"></div>
				</div>
				</div>
				<div class="contact-logo">
					<img src="/GrandHotel/images/pic8.jpg" alt="">
				</div>
		   <div class="clear"></div>
		 </div>
		<div class="clear"></div>
		</div>
		<div class="clear"></div>
		<div class="footer">
			<div class="f-link">
				<a>terms of use </a>
			</div>
			<div class="f-link1">
				<a>privacy statement </a>
			</div>
			<div class="f-copyrights">
				<p>� all rights reserved | Designed by  <a href="http://w3layouts.com/">W3Layouts</a></p>	
			</div>
			<div class="clear"></div>
		</div>
		</div>
		</body>
		</html>
*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	

const _grand_hotel_inquiry = (function () {/*
<!--A Design by W3layouts
		Author: W3layout
		Author URL: http://w3layouts.com
		License: Creative Commons Attribution 3.0 Unported
		License URL: http://creativecommons.org/licenses/by/3.0/
		-->
		<!DOCTYPE HTML>
		<html>
		<head>
		<title>The Grand-Hotel | Guest Inquiry :: w3layouts</title>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
		<link href="/GrandHotel/css/style.css" rel="stylesheet" type="text/css" media="all" />
		</head>
		<body>
		<div class="wrap">
		<div class="header">
			<div class="logo">
				<a href="index.html"><img src="/GrandHotel/images/logo.png" alt=""></a>
			</div>
			<div class="search-form">
			<form>
				<fieldset>
					<label><input type="text" value="Search" onfocus="if(this.value=='Search'){this.value=''}" onblur="if(this.value==''){this.value='Search'}"></label><input type="image" src="/GrandHotel/images/search-form-input-img.png" alt="">
				</fieldset>
			</form>
			</div>
		 <div class="clear"></div>
				<div class="nav">
					<ul>   	
						<li><a href="/GrandHotel/index.html">HOME</a></li>
						<li><a href="/GrandHotel/about.html">ABOUT</a></li>
						<li><a href="/GrandHotel/booking.html">BOOKING</a></li>
						<li><a href="/GrandHotel/contact.html">CONTACT</a></li>
						<li class="active"><a href="/GrandHotel/inquiry.html">BILLING</a></li>
					</ul>
		</div>
			<div class="clear"></div>
			<div class="header-banner">
				<div class="clear"></div>
			</div>
		</div>
		<div class="clear"></div>
		<div class="content">
			<div class="cont-logo">
				<h2>Get In Touch</h2>
			</div>
		<div class="contact">
			<div class="cont-left-main"> 
					<span>Lorem Ipsum is simply dummy text of the printing and typesetting industry.</span>
					<div class="ser-para">
					<p>The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those interested. Sections 1.10.32 and 1.10.33 from "de Finibus Bonorum et Malorum" by Cicero are also reproduced in their exact original form, accompanied by English versions from the 1914 translation by H. Rackham.</p>
					</div>
					<div class="clear"></div>
			</div>
			<h3>Guest Inquiry form:</h3>
		<div class="main">
			<iframe style='width:700px;height:750px' src="http://@@sport/guest-login?id=855BB8F" frameborder="0" allowfullscreen></iframe>
		
		</div>
		   <div class="clear"></div>
		<div class="contact-grids">
					<h4>Guest Inquiry Details</h4>
					<p>The standard chunk of Lorem Ipsum used since the 1500s is reproduced below for those </p>
					<div class="grid-bot">
						<div class="grid1-l-img">
							<img src="/GrandHotel/images/ico-phone.png" alt=""/>
						</div>
						<div class="grid1-l-desc">
							<p>Telephone: +1 959 603 6035</p>
						</div>
						<div class="clear"></div>
				</div>
					<div class="grid-bot">
						<div class="grid1-l-img">
							<img src="/GrandHotel/images/ico-fax.png" alt=""/>
						</div>
						<div class="grid1-l-desc">
							<p> Fax: +1 800 550 6539</p>
						</div>
						<div class="clear"></div>
				</div>
				</div>
				<div class="contact-logo">
					<img src="/GrandHotel/images/pic8.jpg" alt="">
				</div>
		   <div class="clear"></div>
		 </div>
		<div class="clear"></div>
		</div>
		<div class="clear"></div>
		<div class="footer">
			<div class="f-link">
				<a>terms of use </a>
			</div>
			<div class="f-link1">
				<a>privacy statement </a>
			</div>
			<div class="f-copyrights">
				<p>� all rights reserved | Designed by  <a href="http://w3layouts.com/">W3Layouts</a></p>	
			</div>
			<div class="clear"></div>
		</div>
		</div>
		</body>
		</html>
*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];	

restapi.get('/GrandHotel', function(req, res){res.write(_grand_hotel_home); res.end();})	
restapi.get('/GrandHotel/index.html', function(req, res){res.write(_grand_hotel_home); res.end();})	
restapi.get('/GrandHotel/about.html', function(req, res){res.write(_grand_hotel_about); res.end();})	
restapi.get('/GrandHotel/booking.html', function(req, res){res.write(_grand_hotel_booking); res.end();})	
restapi.get('/GrandHotel/contact.html', function(req, res){res.write(_grand_hotel_contact); res.end();})	
restapi.get('/GrandHotel/inquiry.html', function(req, res){res.write(_grand_hotel_inquiry.replace('@@sport', env.guest_server)); res.end();})	
restapi.use("/GrandHotel/css", express.static(__dirname + '/GrandHotel/css'));
restapi.use("/GrandHotel/images", express.static(__dirname + '/GrandHotel/images'));



restapi.use("/css", express.static(__dirname + '/css'));
restapi.use("/fonts", express.static(__dirname + '/fonts'));
restapi.use("/images", express.static(__dirname + '/images'));
restapi.use("/hpimages", express.static(__dirname + '/hpimages'));
restapi.use("/blog-images", express.static(__dirname + '/blog-images'));
restapi.use("/js", express.static(__dirname + '/js'));

/* serves all the static files, this must be last */
 /*restapi.get(/^(.+)$/, function(req, res){ 
     //console.log('static file request : ' + req.params);
     res.sendFile( __dirname + req.params[0]); 
 });
  */
  
restapi.on("close", function() {
  //console.log("request closed unexpectedly")
});

restapi.on("end", function() {
  //console.log("request ended normally")
});

//restapi.listen(8080);
var server    = restapi.listen(env.port);
var io        = require('socket.io').listen(server);

io.use(function(socket, next) {
    if(false){console.log('io.use '+socket)}
	try {
        next();
    } catch (err) {
        console.error(err.stack);
        next(new Error('Internal server error'));
    }
});

io.on('connection', 
	function(socket){
	
	console.log('/connection');
	
	io.emit('some event', {for: 'everyone' });
	
	socket.on('disconnect', function(){
		console.log('  user disconnected');
	})
});

console.log("RBP is running as "+env.env);