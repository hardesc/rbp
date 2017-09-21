function tfilter(d,i){
	if(i.value.length == 0){
		$('#'+d).trigger('footable_clear_filter');
	} else {
		$('#'+d).trigger('footable_filter', {filter: i.value});
	}
}

function validateEmail(email) {
        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
    }

var stat_r;
var stat_v;
var stat_t;
var stat_n;
var stat_ts;
var stat_id;
var stat_ps;
var stat_s;
var stat_ny;
var stat_files;
var stat_ct;
var stat_cl;
var stat_desc;
var stat_cmmt;

var _active_prop = 0;
var _active_stat = 0;
function ticketupdate2(id,next,prop,status){

	if(deptsel(status)==1){
		dspArray("ticket-wrap-internal","none")
	} else {
		dspArray("ticket-wrap-internal","inline")
	}
	
	if(gebi("file-link-"+id)==null){alert("Please use the 'Refresh files' button below before updating the ticket status");return;}

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
	var tkam=dollars(gdv("ticket.tk.amount-"+stat_ps));
	
	if(tkdp==0 || tkct==0){alert("A department and category are required"); return;}
	var tkcm = "";
	
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
	stat_r = "/ticket-edit-accept?id="+id+"&room="+tkrm+"&checkin="+tkci+"&checkout="+tkco+"&email="+tkem+"&phone="+tkph+"&dept="+tkdp+"&cat="+tkct+"&amount="+tkam+"&cmmt="+tkcm;
	stat_v = "#groupTab1-1"
	stat_n = next; 	//return, return
	stat_id = id;

	openstat();
	
	
	
}

function openstat(){	
	
	gebi("ticket-wrap-approved2").style.opacity = "1";
	gebi("ticket-move-approved2").disabled = false;
	gebi("statcmmt").value = ""
	gebi("statdesc").value = ""
	rC("statcmmt","ui-state-error");
	rC("statdesc","ui-state-error");
	
	var credit = Number(gdv("ticket.tk.credit-"+stat_ps).replace(/[^0-9\.-]+/g,""));
	var amount = Number(gdv("ticket.tk.amount-"+stat_ps).replace(/[^0-9\.-]+/g,""));
	if(amount > credit){
		sdtn("ticket-wrap-approved");
		dspArray("ticket-wrap-awaiting","")
	} else {
		dspArray("ticket-wrap-approved","");
		sdtn("ticket-wrap-awaiting")
	}

	var files = "";
	var lnks = gebi("file-link-"+stat_id).innerHTML.split(";;;;");
	var fids = []
	for(var x=0; x<lnks.length;x++){		
		var lnk = lnks[x].split(";;");
		if(lnk.length==3){
			fids.push(lnk[0]);
			files += "<div id='ticket-wrap-pending'>"
			files += "<input type='checkbox' onclick='chkone(this);' id='file-link-"+stat_id+"-"+lnk[0]+"' style='display:inline;margin-top:10px;' class='text ui-widget-content ui-corner-all'>"
			files += "<label style='display:inline;' id='ticket-desc-pending' > Include: "+lnk[1]+", "+lnk[2]+"</label>"
			files += "</div>"
		}
	}
	if(files.length>0){files = files+"<hr/>"}
	files += "<div id='ticket-files-files' style='display:none;'>"+fids.join(";")+"</div>"
	gebi("ticket-wrap-files").innerHTML = files;
	statdialog.dialog( "open" );	
	$(this).parents('.ui-dialog-buttonpane button:eq(0)').focus(); 
}


function dlgfilecheck(){
	if(gebi("ticket-notifcust").checked == true || gebi("ticket-notify").checked == true) {
		dspArray("ticket-wrap-files","");
	} else {
		dspArray("ticket-wrap-files","");
	}
	if(gebi("ticket-notifcust").checked == true){
		gebi("ticket-move-approved2").disabled = true;
		gebi("ticket-move-approved2").checked = false;
		gebi("ticket-wrap-approved2").style.opacity = .5;
	} else {
		gebi("ticket-move-approved2").disabled = false;
		gebi("ticket-wrap-approved2").style.opacity = 1;
	}
}


function atku(e){
	if(gdv(e.id).length>0){e.style.borderColor=""}
}

var _emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
function invalidEmail(e){if(_emailRegex.test(e)){return false;} else {return true;}}

function ticketupdateX(next,prop,status){
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
		gebi("ticket.tk.desc-"+stat_ps).style.borderColor="";
		gebi("ticket.tk.imeth-"+stat_ps).style.borderColor="";
		gebi("ticket.tk.itype-"+stat_ps).style.borderColor="";
		
		
		var tkty=gdv("ticket.tk.itype-"+stat_ps);	    if(tkty==0){er=true;gebi("ticket.tk.itype-"+stat_ps).style.borderColor="red";}
		var tkim=gdv("ticket.tk.imeth-"+stat_ps);		if(tkim==0){er=true;gebi("ticket.tk.imeth-"+stat_ps).style.borderColor="red";}
		
		var tkfn=gedv("ticket.tk.fname-"+stat_ps);		if(tkfn.length==0){er=true;gebi("ticket.tk.fname-"+stat_ps).style.borderColor="red";}		
		//var tkmi=gedv("ticket.tk.mi-"+stat_ps);
		var tkmi = '';
		var tkln=gedv("ticket.tk.lname-"+stat_ps);		if(tkln.length==0){er=true;gebi("ticket.tk.lname-"+stat_ps).style.borderColor="red";}
		var tkrm=gedv("ticket.tk.room-"+stat_ps);		
		var tkca=gedv("ticket.tk.cancellation-"+stat_ps);		
		var tkci=gdv("ticket.tk.checkin-"+stat_ps);		if(tkci!=""){
														var d = new Date(tkci);	if(d=='Invalid Date'){er=true;gebi("ticket.tk.checkin-"+stat_ps).style.borderColor="red"; ex = " Dates should be entered as mm/dd/yyyy."}
														}
		var tkco=gdv("ticket.tk.checkout-"+stat_ps);	if(tkco!=""){		
														var d = new Date(tkco);	if(d=='Invalid Date'){er=true;gebi("ticket.tk.checkout-"+stat_ps).style.borderColor="red"; ex = " Dates should be entered as mm/dd/yyyy."} 
														}
		var tkem=gdv("ticket.tk.email-"+stat_ps);		
		if(tkem.toLowerCase()=='na@na.com' || tkem.toLowerCase()=='no@notgiven.com'){
			er=true;gebi("ticket.tk.email-"+stat_ps).style.borderColor="red";
			ex = ex + "  Please use real email address only, or select the 'No Guest Email' check box."
		}
		
		if(!document.getElementById("ticket.tk.noemail-"+stat_ps).checked){
			if(tkem.length==0 || invalidEmail(gdv("ticket.tk.email-"+stat_ps))){er=true;gebi("ticket.tk.email-"+stat_ps).style.borderColor="red";}
		}
		
		var tkph=gedv("ticket.tk.phone-"+stat_ps);		
		var tkds=gedv("ticket.tk.desc-"+stat_ps);		if(tkds.length==0){er=true;gebi("ticket.tk.desc-"+stat_ps).style.borderColor="red";}
		var tkdp=gdv("ticket.tk.dept-"+stat_ps);
		var tkct=gdv("ticket.tk.cat-"+stat_ps);
		var tkas=gdv("ticket.tk.asgn-"+stat_ps);
		var tkam=dollars(gdv("ticket.tk.amount-"+stat_ps));
		var tkcm=gedv("ticket.tk.comment-"+stat_ps);
		var tkcc=encode(gdv("ticket.tk.lastfour-"+stat_ps));
			
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
		divtpost(
			r,
			d,
			c,
			"ticket-tr-none-"+stat_ps,
			"add-ticket-working-"+stat_ps,
			stat_n
		);		
	
}

function crborder(ps){
	var credit = Number(gdv("ticket.tk.credit-"+ps).replace(/[^0-9\.-]+/g,""));
	var amount = Number(gdv("ticket.tk.amount-"+ps).replace(/[^0-9\.-]+/g,""));
	if(amount > credit){
		gebi("ticket.tk.credit-"+ps).style.borderColor = "red";
	} else {
		gebi("ticket.tk.credit-"+ps).style.borderColor = "green";
	}
}

function divup(r,d){
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){	
	skd(d,a.responseText);	
		$('.inputs').keydown(function (e) {
			 if (e.which === 13) {
				 var index = $('.inputs').index(this) + 1;
				 $('.inputs').eq(index).focus();
			 }
		 });
}};_h(a);}

function propemailchange(){
	if(prop_email_changed==true){
		if(prop_email_changed){
			var c = confirm('The changes have not been saved and may be lost, do you want to continue?');
			if(c==false){
				this.selectedIndex = prop_email_lastindex;
				return false;
			}else{
				prop_email_lastindex = this.selectedIndex;
				return true;
			}
		}
	}
	return true
}

function upropmail(id,cat,n){
	var er = false;
	var prfr=gdv("prop.pr."+cat+".from"); 
	if(prfr!=""){
		er = !checkRegexp( prfr, /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/);
	}
	var prsu=gedv("prop.pr."+cat+".subject");
	var prcb=gedv("prop.pr."+cat+".body");
	if(er){
		gebi("prop.pr."+cat+".from").style.borderColor = "red";
		alert("The email is not a valid email address");
		
		return;
	}			
	var a=_z("\property-edit-accept-email?id="+id+"&cat="+cat+"&frm="+prfr+"&sub="+prsu+"&body="+prcb);a.onreadystatechange=function(){if(a.readyState==4){
	alert(a.responseText);
	prop_email_changed = false;
	dspArray('prop-edit-email-section-'+n,'none')
	prop_email_lastindex = 0;
	gebi("prop-edit-email-select").selectedIndex = 0;
}};_h(a);}

var prop_email_changed = false;
var prop_email_lastindex = 0;

var edtk_timeout;
var edtk_ticker;
var edtk_id;
var edtk_prop;
var edtk_status;

function edtk(r,d){
var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){
	var ra = a.responseText.split("::::");
	var tm = parseInt(ra[0])
	if(tm>0){
		edtk_timeout = setTimeout(function(){ 
		keepcountdown = 30
		clearTimeout(edtk_timeout);
		edtkticker();		
		keepdialog.dialog( "open" ); 		
		}, tm * 1000);
	}
	skd(d,ra[1]);	
		$('.inputs').keydown(function (e) {
			 if (e.which === 13) {
				 var index = $('.inputs').index(this) + 1;
				 $('.inputs').eq(index).focus();
			 }
		 });
	jQuery("time.timeago2").timeago();
	$.localtime.setFormat("M-d-yyyy h:mm a");
	$.localtime.format();
}};_h(a);}

function rfile(f,t){
var a=_z("/removefile?fid="+f+"&tid="+t);a.onreadystatechange=function(){if(a.readyState==4){
	console.log("fileinfo-"+f);	
	document.getElementById("fileinfo-"+f).style.display = "none"
	document.getElementById("filechoice-"+f).style.display = "none"
}};_h(a);}

function edctk(r,d){
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){
	
	var ra = a.responseText.split("::::");
	var tm = parseInt(ra[0])
	if(tm>0){
		edtk_timeout = setTimeout(function(){ 
		keepcountdown = 30
		clearTimeout(edtk_timeout);
		edtkticker();		
		keepdialog.dialog( "open" ); 		
		}, tm * 1000);
	}
	skd(d,ra[1]);	
		
	jQuery("time.timeago2").timeago();
	$.localtime.setFormat("M-d-yyyy h:mm a");
	$.localtime.format();
	
}};_h(a);}


function divapnd(r,d,dv){
var v = gdv(dv);
var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){	
	var chunk = gdi(d);
	var n = chunk.search("<hr>");
	gebi(d).innerHTML = chunk.substr(0,n+4) + a.responseText;
	sdv(dv,v);
		$('.inputs').keydown(function (e) {
			 if (e.which === 13) {
				 var index = $('.inputs').index(this) + 1;
				 $('.inputs').eq(index).focus();
			 }
		 });
}};_h(a);}

function divtedit(r,d,id,c,td){
	if(c=="associate-edit"||c=="associate-add"){dspArray("associate-add-edit-working","")}
	dspArray(c,"none")
		
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){	
	var tr = a.responseText.split("::::");	
	if(tr[0]==="tr"){		
		gebi(td).innerHTML = tr[2]
		dspArray(d,"");cd(c);dspArray(c,"none");
	} else {
		dspArray(c,"")
		alert(tr);
	}
	if(c=="associate-edit"||c=="associate-add"){dspArray("associate-add-edit-working","none")}
}};_h(a);}

//remove after converting to 2
function divtpost(r,d,c,m,w,n){
	dspArray(c,"none");
	dspArray(w,"");
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){		
	//console.log(a.responseText)
	var tr = a.responseText.split("::::");	
	
	if(tr[0]==="alert"){
		alert(tr[1]);
		dspArray(w,"none");
		dspArray(c,"");
		return;
	} else {
		if(tr[0]==="tr"){
			console.log('add debug')
			var footable = $('#'+d);			
			footable.data('footable').appendRow(tr[2]);		
			sdi('groupCnt-'+stat_ps, parseInt(gdi('groupCnt-'+stat_ps))+1);
			console.log(1)
			//find out where the row ended up based on sort
			var rows = $('#'+d+' tbody tr')
			var row = rows.length - 1		
			for(var r=0;r<rows.length;r++){			
				if(rows[r].id==tr[1]){
					row = r;
				}
			}	
			console.log(2)
			var p = parseInt(row / 10)
			dspArray(w,"none");
			footable.data("currentPage",p);
			footable.resize();
			console.log(3)
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
			console.log(4)
			$('#'+rows[row].id).css("background-color", "rgba(0, 0, 153, 0.68)");
			$('#'+rows[row].id).css("color", "#fff");
			$('#'+rows[row].id).animate({backgroundColor: "#fff", color: "#000"}, 5000 );
			if(d==""){window.location.href = '/';}
			console.log(5)
		}
					
	}	
}};_h(a);}

function popfile(r){
	window.open(r,"Folio File","titlebar=yes,location=yes");	
}

function frefresh(id){
	var a=_z('/filehist?id='+id);a.onreadystatechange=function(){if(a.readyState==4){		
	//dspArray('file-refresh-'+id,'none');
	sdi('file-hist-'+id,a.responseText);	
}};_h(a);}

function divtpost2(r,d,c,m,pw){
	dspArray(pw,"");
	dspArray(c,"none");
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){		
	var tr = a.responseText.split("::::");
	if(tr[0]==="tr"){
		var footable = $('#'+d).data('footable');	
		footable.appendRow(tr[1]);
		dspArray(pw,"none");
		dspArray(d,"");cd(c);
		if(m!=""){alert(m)}
		if(d==""){window.location.href = '/';}
	}
	if(tr[0]==="alert"){
		dspArray(pw,"none");
		dspArray(c,"");	
		alert(tr[1]);		
	}
}};_h(a);}

function reopent(r,id){
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){		
	dspArray("ticket-tr-closed-"+id,"none");
	cd("closed-ticket-edit");
	dspArray("closed-ticket-edit","none")
	dspArray("closed-tickets-table","");
				
}};_h(a);}

function home(){
	sdtn("pages");sdtn("admin");sdtn("reports");	
	if(_root_status == "login"){
		$("#justdemo").hide();
		$(".modulepage").hide()
		$("#supportcontainer").hide();
		$("#homecontainer").show();
		$(".guesttitle").fadeIn(500)
		$(".guestpage").fadeIn(1500)
		sdtn("worktabs");		
		$("html, body").animate({ scrollTop: 0 }, 800);
	} else {		
		dspArray("worktabs","");
		sdtn("guestpage");
	}
}

function modules(){
	$("#justdemo").hide();
	$(".guestpage").hide()
	$("#supportcontainer").hide();
	$("#homecontainer").show();
	$(".modulepage").fadeIn(1500)
	$("html, body").animate({ scrollTop: 0 }, 800);
}
function showblog(){
	$("#justdemo").hide();
	$(".guesttitle").hide();
	$(".guestpage").hide();
	$("#supportcontainer").hide();
	$(".modulepage").hide();
	$("#workcontainer").hide();
	$("#usermewrap").hide();
	$('#blogcontainer').fadeIn(1500);
	$("html, body").animate({ scrollTop: 0 }, 800);
}			

function showjustdemo(){
	$("#homecontainer").hide();
	$(".guesttitle").hide();
	$(".guestpage").hide();
	$("#supportcontainer").hide();
	$(".modulepage").hide();
	$("#workcontainer").hide();
	$("#usermewrap").hide();
	$('#justdemo').fadeIn(1500);
	$("html, body").animate({ scrollTop: 0 }, 800);
}		
	

function page(r){
if(close_ticket_edits()){return}
var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){
sdtn("guestpage");sdtn("worktabs");sdtn("reports");sdtn("admin");
sdi("pages",a.responseText);
}};_h(a);}

function logout(){
var a=_z("/logout?");a.onreadystatechange=function(){if(a.readyState==4){
window.location.href = "/"
}};_h(a);}


function propusers(id){
var a=_z("\propusr?id="+id);a.onreadystatechange=function(){if(a.readyState==4){
sdi("propuserlist",a.responseText);
if(a.responseText != ""){				
	usersdialog.dialog( "open" );
} else {
	alert("No users exist that are unassigned");
}
}};_h(a);}

function reports(d){
	if(close_ticket_edits()){return}
	var opt = "";
	var frm = ""; var fto = ""
	if(_report_tab == 0){
		opt=gebi("reportSelect-"+_report_tab).value
		if(opt==0){gebi("status-report-table-firstcol").innerHTML = "Inquiry Type"}
		if(opt==2){gebi("status-report-table-firstcol").innerHTML = "Date Submitted"}
		if(opt==4){gebi("status-report-table-firstcol").innerHTML = "Date Closed"}
		if(opt==6){gebi("status-report-table-firstcol").innerHTML = "Associate"}
		if(opt==8){gebi("status-report-table-firstcol").innerHTML = "Department"}
	}
	frm=gebi("reportDateFrom-"+_report_tab).value
	fto=gebi("reportDateTo-"+_report_tab).value
	var fby = "";
	if(d==='closed-tickets-table'){fby = gebi("reportDateDate-1").value}
		
	var a=_z('/reports?r='+_report_tab+"&o="+opt+"&f="+frm+"&t="+fto+"&b="+fby+"&x=0");a.onreadystatechange=function(){if(a.readyState==4){
	
	sdtn("worktabs"); sdtn("pages"); sdtn("admin");
	dspArray("reports","");
	var tr = a.responseText.split("::::");
	var footable = $('#'+d).data('footable');	
	//todo fix data binding
	$('#'+d).children()[1].innerHTML = ""
	for(var x=0;x<tr.length-1;x++){
		$('#'+d).append(tr[x]);
	}	
	if(tr.length > 1){
		gebi("reportTab-"+_report_tab).getElementsByClassName("footable")[0].getElementsByTagName("tfoot")[0].innerHTML = tr[tr.length-1]
		$('#'+d).trigger('footable_redraw'); //for pagination
	}
	$('#'+d).footable({ calculateWidthOverride: function() { return {width: $(window).width()}; }, breakpoints: { phone: 480, tablet: 900 } });				
	$.localtime.format();
}};_h(a);}

function show_records(o,d){
	document.cookie="rbp-z="+o.value+"; expires=Mon, 01-Jan-2021 22:23:01 GMT; path=/";
	$('#'+d).data('page-size', o.value);
	$('#'+d).trigger('footable_initialized');
}

function divpopglobal(r,id,i){
	var a=_z(r+'?id='+id+'&i='+i);a.onreadystatechange=function(){if(a.readyState==4){
	alert(a.responseText);
	dspArray('prop-opt-section-'+i+'-msg','none');		
	dspArray('prop-opt-section-'+i,'none');
	gebi('prop-opt-select').selectedIndex = 0;
}};_h(a);}


function rptClear(n){
	gebi("reportDateFrom-"+n).value = ""
	gebi("reportDateTo-"+n).value = ""
	if(n==1){gebi("reportDateDate-1").value = "submitted";}
	sC("reportRefresh-"+n,"rptRefresh rptDisabled")
	sC("reportClear-"+n,"rptClear rptDisabled")
	if(n==0){reports('status-report-table')}
	if(n==1){reports('closed-tickets-table')}
}

function rptDates(n){
	var frm = gebi("reportDateFrom-"+n).value
	var fto = gebi("reportDateTo-"+n).value
	var d1 = new Date(frm);	
	var d2 = new Date(fto);	
	
	if(d1.toString()==='Invalid Date' || d2.toString()==="Invalid Date" || d1.getFullYear() < 1000 || d2.getFullYear() < 1000){
		sC("reportRefresh-"+n,"rptRefresh rptDisabled");
		sC("reportClear-"+n,"rptClear rptDisabled");
		return
	}
	sC("reportRefresh-"+n,"rptRefresh");
	sC("reportClear-"+n,"rptClear");			
}

function chkDate(id){
	var dt = gebi(id).value
	var d = new Date(dt);	
	if(d.getFullYear() < 1000 || d.getFullYear() > 2100){
		sC(id,"rptError");
	} else {
		rC(id,"rptError");
	}
		
}

function chkone(e){
	if(e.id === "ticket-move-pending"){
		gebi("ticket-move-awaiting").checked = false;
		gebi("ticket-move-approved").checked = false;
		gebi("ticket-move-approved2").checked = false;
	} 
	
	if(e.id === "ticket-move-awaiting"){
		gebi("ticket-move-pending").checked = false;
		gebi("ticket-move-approved").checked = false;
		gebi("ticket-move-approved2").checked = false;
	} 

	if(e.id === "ticket-move-approved" || e.id === "ticket-move-approved2"){
		gebi("ticket-move-pending").checked = false;
		gebi("ticket-move-awaiting").checked = false;
	} 
	if(e.id === "ticket-move-approved" && e.checked == true){
		gebi("ticket-move-approved2").checked = false;
	}
	if(e.id === "ticket-move-approved2" && e.checked == true){
		gebi("ticket-move-approved").checked = false;
	}
}

function authone(id,a,df){
	//if(a==0){return}
	var ak = gdi('authkeys').split(',');
	for(var x=0;x<ak.length;x++){
		if(id==ak[x]){
			gebi('assoc.ae.auth.'+ak[x]).checked = true;
			if(df==2){
				sdv('assoc.ae.limit',df);
				gebi('assoc.ae.limit').focus();
			}
		} else {
			gebi('assoc.ae.auth.'+ak[x]).checked = false
		}
	}
}

function ticketreqlabel(){
	if(gebi('ticket-notify').checked == true){
		dspArray('ticket-require-label','inline')
	} else {
		sdtn('ticket-require-label')
	}
}
	

function gebi(t){var e=document.getElementById(t);if(e){return e;}else{return null;}}
function isArray(e){if (e.constructor.toString().indexOf('Array')==-1){return false;}else{return true;}}
function dspArray(ar,d){var e;
	if(isArray(ar)){var ln=ar.length;for(var i=0;i<ln;i++){e=gebi(ar[i]);if(e){e.style.display=d;}else{if(document.layers){document.ar[i].display=d;}else{alert('error with ' + ar[i]);}}}
	}else{e=gebi(ar);if(e){e.style.display=d;}else{if(document.layers){document.ar.display=d;}else{/*alert('error with ' + ar);*/}}}}
function sdtn(ar){dspArray(ar,'none');}


function cd(ar){if(isArray(ar)){var ln=ar.length;for (var i=0;i<ln;i++){sdi(ar[i],'');}}else{sdi(ar,'');}}
function ar(a,x){return a[x]}
function sdi(t,v){var e=gebi(t);if(e){e=replaceHtml(e,v);dspArray(t,'inline');}}
function sdh(t,v){var e=gebi(t);if(e){e=replaceHtml(e,v);sdtn(t);}}
function sib(t,v){var e=gebi(t);if(e){e=replaceHtml(e,v);dspArray(t,'inline-block');}}
function skb(t,v){var e=gebi(t);if(e){e=replaceHtml(e,v);dspArray(t,'block');}}
function skd(t,v){var e=gebi(t);if(e){e=replaceHtml(e,v);dspArray(t,'');}}
function gdi(t){var e=gebi(t);if(e){return gebi(t).innerHTML;}else{return null;}}
function gdv(t){var e=gebi(t);if(e){return gebi(t).value;}else{return null;}}
function gedv(t){console.log(t);if(t==null){t=""};return encode(gdv(t))}
function sdv(t,v){var e=gebi(t);if(e){gebi(t).value=v;}}
function replaceHtml(e,h) {var oe=typeof e==='string'?gebi(e):e;var ne=oe.cloneNode(false);ne.innerHTML=h;oe.parentNode.replaceChild(ne,oe);return ne;};
function trim(str){return str.replace(/^\\s\\s*/, '').replace(/\\s\\s*$/, '');}
function sC(id,cls){var e=gebi(id);if(e){e.setAttribute('class',cls);e.setAttribute('className',cls);}else {alert(id + ' js error');}}
function aC(id,cls){var e=gebi(id);if(e){var s=e.getAttribute('class'); e.setAttribute('class',s+' '+cls);e.setAttribute('className',s+' '+cls);}}
function gC(id){var e=gebi(id);var c = e.getAttribute('class'); if (c == null) {return ''}; return trim(c);}
function rC(id,cls){
	console.log(id + ' ' + cls)
	var e=gebi(id);
	if(e){
		if(e.getAttribute('class').length>0){
			var ca=e.getAttribute('class').split(' ');
			var nc='';
			for(var x=0;x<ca.length;x++){
				if(ca[x]==cls){
				
				} else {
					nc = nc + ca[x] + ' ';
				}
			};
			sC(id,nc);
		}
	}
}
function hC(e,cls){
	if(e){
		var ca = e.getAttribute('class').split(" ");
		for (var x=0;x<ca.length;x++){
			if (ca[x]==cls){return true}
		}
		var ca = e.getAttribute('className').split(" ");
		for (var x=0;x<ca.length;x++){
			if (ca[x]==cls){return true}
		}		
	}
	return false;
	}
function _z(f){var a;f += '&rnd=' + Math.floor(Math.random()*99999);try{ a=new XMLHttpRequest();} catch (e1){try{ a=new ActiveXObject('Msxml2.XMLHTTP');} catch (e2) {try{ a=new ActiveXObject('Microsoft.XMLHTTP');} catch (e3){alert('ERR!');return false;} } } try{ a.open('GET',f);}catch (e4) {alert(e4);alert(f);return false;};return a;}
function _h(a){a.setRequestHeader('Content-type','application/x-www-form-urlencoded');a.send();}	
function encode(s){
	if(s.length == 0 || s == null){return ""}
	var c='';
	var o='';
	for(var i=0;i<s.length;i++){
		c = s.charCodeAt(i).toString(); 
		while ( c.length < 3) {c = '0' + c;}
		o += c;
	};
	return o;
}
function toggle(div,dsp){
	var d = gebi(div)
	if (d.style.display == 'none') {d.style.display = dsp} else {d.style.display = 'none'}
}
function cancelBubble(e){
	var evt = e ? e : window.event;if (undefined == evt) return;if (evt.stopPropagation) evt.stopPropagation();if (evt.cancelBubble!=null) evt.cancelBubble = true;
}		
function dollars(a){
	return parseFloat(a.replace(/[^0-9.-]+/g, ''));
}

function checkLength( o, min, max ) {if ( o.length > max || o.length < min ) {return false;} else {return true;}}
function checkRegexp( o, regexp) {if ( !( regexp.test( o ) ) ) {return false;} else {return true;}}

function init_login(){
	// From http://www.whatwg.org/specs/web-apps/current-work/multipage/states-of-the-type-attribute.html#e-mail-state-%28type=email%29
	var e = false;
	var p = false;
	var email = $("#email").val();
	var password = $("#password").val();
	var nick = $("#nick").val();
	var e = checkLength( email, 1, 80 );
	var e = e && checkRegexp( email, /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/);
	var p = checkRegexp( password, /^([0-9a-zA-Z])+$/);
	var p = p && checkLength( password, 5, 16 );
	
	if(e && p){		
		root_login("/home?e="+email+"&p="+password+"&r=1&n="+encode(nick),"worktabs");				
	} else {
		if(!e){$("#email").css('borderColor', 'red')}
		if(!p){$("#password").css('borderColor', 'red')}		
		alert("The login information provided does not match our records.");
	}
	return;
}

function init_regis(){
	var p = false;
	var p1 = $("#pw1").val();
	var p2 = $("#pw2").val();
	var nick2 = $("#nick2").val();
	var p = checkRegexp( p1, /^([0-9a-zA-Z])+$/);
	var p = p && checkLength( p1, 5, 16 );
	var p = p && (p1 == p2)
	if($("#nickwrap2").css("display")==""){
		if(nick.length==0){
			p = p & true;
		}
	}
	if(p){		
		$("#pw1").val("");
		$("#pw2").val("");
		root_login("/home3?p="+p1+"&n2="+encode(nick2),"worktabs");				
	} else {
		if(!p){
			$("#pw1").css('borderColor', 'red');
			$("#pw2").css('borderColor', 'red');
			if($("#nick2").val()==""){$("#nick2").css('borderColor', 'red');}
		}		
	}
	return;
}
function deptsel(stat){
	var res = 0;
	//dspArray("deptwarn-"+stat,"none")
	var a = gdi("deptcnt-"+stat).split(";")
	var v = gdv("ticket.tk.dept-"+stat)	
	for(var x=0;x<a.length;x++){
		var i=a[x].split(":")
			if(v==i[0]){
				if(parseInt(i[1])==0){
					res = 1;
					//sdi("deptwarn-"+stat,"This department does not have any members to receive notifications")
				}
			}
			
	}
	sdv('ticket.tk.dept-'+stat,gdv('ticket.tk.dept-'+stat));	
	return res;
}

function init_reset(){
	var p = false;
	var p1 = $("#rpw1").val();
	var p2 = $("#rpw2").val();
	var nick2 = $("#rnick2").val();
	var p = checkRegexp( p1, /^([0-9a-zA-Z])+$/);
	var p = p && checkLength( p1, 5, 16 );
	var p = p && (p1 == p2)
	if($("#rnickwrap2").css("display")==""){
		if(nick.length==0){
			p = p & true;
		}
	}
	if(p){		
		$("#rpw1").val("");
		$("#rpw2").val("");
		root_login("/home3?p="+p1+"&n2="+encode(nick2),"worktabs");				
	} else {
		if(!p){
			$("#rpw1").css('borderColor', 'red');
			$("#rpw2").css('borderColor', 'red');
			if($("#rnick2").val()==""){$("#rnick2").css('borderColor', 'red');}
		}		
	}
	return;
}

function edassoc(id) {
	var er = false;
	var aefn=gdv("assoc.ae.fname");		if(aefn.length==0){er=true;aC("assoc.ae.fname","flderror")}
	var aemi=gdv("assoc.ae.mi");
	var aegc=0;
	var aeln=gdv("assoc.ae.lname");		if(aeln.length==0){er=true;aC("assoc.ae.lname","flderror")}
	var aeem=gdv("assoc.ae.email");		if(aeem.length==0 || validateEmail(aeem)==false){er=true;aC("assoc.ae.email","flderror")}

	var aeph=gdv("assoc.ae.phone");
	var aepo=gdv("assoc.ae.position");

	var aeau = gdi("authkeys").split(",");
	for(var x=aeau.length-1;x>=0;x--){if(!gebi("assoc.ae.auth."+ar(aeau,x)).checked){aeau.splice(x, 1);}}
	var aeno = gdi("notifkeys").split(",");
	for(var x=aeno.length-1;x>=0;x--){if(!gebi("assoc.ae.notif."+ar(aeno,x)).checked){aeno.splice(x, 1);}}

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
	
	var aegs = gebi("assoc.ae.gssign").checked
	var aeas = ""; //not used
		

	if(er){
		alert("Some required data is missing, or the data is not valid.");
		$("html, body").scrollTop(0)
		return;
	}

	var aecr=gdv("assoc.ae.limit");
	divtedit("\associate-edit-accept?id="+id+"&fname="+aefn+"&mi="+aemi+"&lname="+aeln+"&email="+aeem+"&phone="+aeph+"&position="+aepo+"&auth="+aeau+"&notif="+aeno+"&limit="+aecr+"&props="+aeua_sel+"&group="+aegc+"&assign="+aeas+"&gssign="+aegs,"associates-table",id,"associate-edit","assoc-tr-"+id);cancelBubble(event);	
}

function edgrp(id) {
	var er = false;
	var aefn=gdv("assoc.ae.fname");		if(aefn.length==0){er=true;aC("assoc.ae.fname","flderror")}
	var aemi="";
	var aeln="";
	var aeem=gdv("assoc.ae.email");		if(aeem.length==0 || validateEmail(aeem)==false){er=true;aC("assoc.ae.email","flderror")}

	var aeph=gdv("assoc.ae.phone");
	var aepo=gdv("assoc.ae.position");

	var aeau = gdi("authkeys").split(",");
	for(var x=aeau.length-1;x>=0;x--){if(!gebi("assoc.ae.auth."+ar(aeau,x)).checked){aeau.splice(x, 1);}}
	var aeno = gdi("notifkeys").split(",");
	for(var x=aeno.length-1;x>=0;x--){if(!gebi("assoc.ae.notif."+ar(aeno,x)).checked){aeno.splice(x, 1);}}

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

	var aecr=gdv("assoc.ae.limit");
	divtedit("\group-edit-accept?id="+id+"&fname="+aefn+"&mi="+aemi+"&lname="+aeln+"&email="+aeem+"&phone="+aeph+"&position="+aepo+"&auth="+aeau+"&notif="+aeno+"&limit="+aecr+"&props="+aeua_sel,"groups-table",id,"group-edit","assoc-tr-"+id);cancelBubble(event);			
}

function formatPhone(obj) {
    var numbers = obj.value.replace(/\D/g, ''),
        char = {0:'(',3:') ',6:' - '};
    obj.value = '';
    for (var i = 0; i < numbers.length; i++) {
        obj.value += (char[i]||'') + numbers[i];
    }
}


function flip_fa(div,up,dn) {
	if(document.getElementById(div).style.display == "none"){
		document.getElementById(div).style.display = "";
		document.getElementById(dn).style.display = "none"
		document.getElementById(up).style.display = "";
	} else {
		document.getElementById(div).style.display = "none";
		document.getElementById(dn).style.display = ""
		document.getElementById(up).style.display = "none";
	}	
}

function sendsupport() {
	var er = false;
	var spnm=gdv("support.sp.name");	if(spnm.length==0){er=true;aC("support.sp.name","flderror")}
	var spem=gdv("support.sp.email");	if(spem.length==0 || validateEmail(spem)==false){er=true;aC("support.sp.email","flderror")}
	var spph=gdv("support.sp.phone");	if(spph.length==0){er=true;aC("support.sp.phone","flderror")}
	var spde=gdv("support.sp.desc");	if(spde.length==0){er=true;aC("support.sp.desc","flderror")}
	
	if(er){
		alert("Some required data is missing, or the data is not valid.");
		$("html, body").scrollTop(0)
		return;
	}
	dspArray("support-form","none");
	dspArray("support-form-working","");
	
	var r = "/support_message?name="+encode(spnm)+"&email="+encode(spem)+"&phone="+encode(spph)+"&desc="+encode(spde);
			
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){		
		var ra = a.responseText.split("::::");
		if(ra[0]=="alert"){	
			dspArray("support-form","");
			dspArray("support-form-working","none");
		} else {
			skb("support-form-working",ra[1]);
		}
	}};_h(a);
		
}

function sendsppt() {
	var er = false;
	var spnm=gdv("sppt.sp.name");	if(spnm.length==0){er=true;aC("sppt.sp.name","flderror")}
	var spph=gdv("sppt.sp.phone");	if(spph.length==0){er=true;aC("sppt.sp.phone","flderror")}
	var spem=gdv("sppt.sp.email");	if(spem.length==0 || validateEmail(spem)==false){er=true;aC("sppt.sp.email","flderror")}	
	var spde=gdv("sppt.sp.desc");	if(spde.length==0){er=true;aC("sppt.sp.desc","flderror")}
	var spre=gdv("sppt.sp.email2");	if(spre.length==0){er=true;aC("sppt.sp.email2","flderror")}
	if(spem!=spre){er=true;
		aC("sppt.sp.email1","flderror");
		aC("sppt.sp.email2","flderror")
	}
	
	if(er){
		alert("Some required data is missing, or the data is not valid.");
		$("html, body").scrollTop(0)
		return;
	}
	dspArray("sppt-form","none");
	dspArray("sppt-form-working","");
	
	var r = "/sppt_message?name="+encode(spnm)+"&email="+encode(spem)+"&phone="+encode(spph)+"&desc="+encode(spde);
			
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){		
		var ra = a.responseText.split("::::");
		if(ra[0]=="alert"){	
			dspArray("sppt-form","");
			dspArray("sppt-form-working","none");
		} else {
			skb("sppt-form-working",ra[1]);
		}
	}};_h(a);
		
}

function senddemo() {
	var er = false;
	var spnm=gdv("demo.sp.name");	if(spnm.length==0){er=true;aC("demo.sp.name","flderror")}
	var spem=gdv("demo.sp.email");	if(spem.length==0 || validateEmail(spem)==false){er=true;aC("demo.sp.email","flderror")}
	var spre=gdv("demo.sp.email2");	if(spre.length==0){er=true;aC("demo.sp.email2","flderror")}
	if(spem!=spre){er=true;
		aC("demo.sp.email1","flderror");
		aC("demo.sp.email2","flderror")
	}
	
	if(er){
		alert("Some required data is missing, or the data is not valid.");
		//$("html, body").scrollTop(0)
		return;
	}
	dspArray("demo-form","none");
	dspArray("demo-form-working","");
	
	var r = "/demo_message?name="+encode(spnm)+"&email="+encode(spem);
			
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){		
		var ra = a.responseText.split("::::");
		console.log(ra)
		if(ra[0]=="alert"){	
			dspArray("demo-form","");
			dspArray("demo-form-working","none");
		} else {
			sdv("demo.sp.name","")
			sdv("demo.sp.email","")
			sdv("demo.sp.email2","")
			dspArray("demo-form","");
			dspArray("demo-form-working","none");
			alert(ra[1])
		}
	}};_h(a);
		
}

function senddemo2() {
	var er = false;
	var spnm=gdv("demo2.sp.name");	if(spnm.length==0){er=true;aC("demo2.sp.name","flderror")}
	var spem=gdv("demo2.sp.email");	if(spem.length==0 || validateEmail(spem)==false){er=true;aC("demo2.sp.email","flderror")}
	var spre=gdv("demo2.sp.email2");	if(spre.length==0){er=true;aC("demo2.sp.email2","flderror")}
	if(spem!=spre){er=true;
		aC("demo2.sp.email1","flderror");
		aC("demo2.sp.email2","flderror")
	}
	
	if(er){
		alert("Some required data is missing, or the data is not valid.");
		//$("html, body").scrollTop(0)
		return;
	}
	dspArray("demo2-form","none");
	dspArray("demo2-form-working","");
	
	var r = "/demo_message?name="+encode(spnm)+"&email="+encode(spem);
			
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){		
		var ra = a.responseText.split("::::");
		console.log(ra)
		if(ra[0]=="alert"){	
			dspArray("demo2-form","");
			dspArray("demo2-form-working","none");
		} else {
			sdv("demo2.sp.name","")
			sdv("demo2.sp.email","")
			sdv("demo2.sp.email2","")
			dspArray("demo2-form","");
			dspArray("demo2-form-working","none");
			alert(ra[1])
			home();
		}
	}};_h(a);
		
}

function guest_comment(id,g) {
	var cmt = encode(gdv("guest.me.message"));
	if(cmt.length>1500){alert("The message length is too long");return;}
	dspArray("ticket-form-comment","none");
	dspArray("form-working","none");
	dspArray("form-working","");
	var a=_z("/guest/ticket/comment/accept?id="+id+"&gcode="+g+"&comment="+cmt);a.onreadystatechange=function(){if(a.readyState==4){					
	dspArray("form-working","none");
	dspArray("can-close","");
}};_h(a);
}

function guest_msgcount(){
	var l = gdv("guest.me.message").length;
	gebi("guest.me.length").innerHTML = 500 - l
}