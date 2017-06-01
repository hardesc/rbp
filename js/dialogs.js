var _root_status = "login"
function root_login(r,d){
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){	
	if (a.responseText == "Password") {
		pwsdialog.dialog( "open" );
		setTimeout(function(){
		$("html, body").scrollTop($("#pw-form").offset().top);},50);
		$(this).parents('.ui-dialog-buttonpane button:eq(0)').focus(); 				
	} else if(a.responseText == "Nickname") {
		dspArray("nickwrap",""); return;
	} else if(a.responseText == "Register") {
		_root_status = "register"
		sdtn("worktabs");
		$(".guesttitle").fadeIn(500);$(".guestpage").fadeIn(1500)
		dspArray("registerfrm","");
		dspArray("nickwrap1","none");
	} else if(a.responseText == "Register2") {
		_root_status = "register"
		sdtn("worktabs");
		$(".guesttitle").fadeIn(500);$(".guestpage").fadeIn(1500)
		dspArray("registerfrm","");
		dspArray("nickwrap1","");
	} else if(a.responseText == "Reset") {
		_root_status = "reset"
		sdtn("worktabs");
		$(".guesttitle").fadeIn(500);$(".guestpage").fadeIn(1500)
		dspArray("resetfrm","");
		dspArray("nickwrap2","");
	} else if(a.responseText == "RegError") {
		alert("Registration Error, please contact support")
	} else if(a.responseText == "RegGroup") {
	
	} else if(a.responseText == "Refresh") {	
		window.location.href = "/";
	} else if(a.responseText == "Error") {
		//logindialog.effect("shake");
		alert("The email or password is incorrect.  Passwords are case sensitive.");
	} else if (a.responseText == "Login") {
		_root_status = "login"		
		//logindialog.dialog( "open" );
		sdtn("worktabs");
		$(".guesttitle").fadeIn(500);$(".guestpage").fadeIn(1500)
		dspArray("loginfrm","");
	} else {
			//worktabs
			_root_status = ""	
			$("#email").val("");
			$("#password").val("");
			$("#nick").val("");		
			
			var ta = a.responseText.split(";;")
			document.getElementById("userme").innerHTML = ta[0].split("::")[2];
			var tuid = ta[0].split("::")[3]
			document.getElementById("usermewrap").style.display = "inline";
			if(ta[0].split("::")[0]=="1"){
				document.getElementById("adminlink").style.display = "";
				document.getElementById("adminlink").childNodes[0].innerHTML = ta[0].split("::")[1];
				//necessary to handle switching users on same browser window
				
				
				/*
				if(ta[0].split("::")[1]=="Super Admin"){
					document.getElementById("addprbtn").style.display = "inline";
					document.getElementById("addprmsg").style.display = "none";
					document.getElementById("adddpbtn").style.display = "inline";
					document.getElementById("adddpmsg").style.display = "none";
					document.getElementById("addinbtn").style.display = "inline";
					document.getElementById("addinmsg").style.display = "none";
				} else {
					document.getElementById("addprmsg").style.display = "inline";
					document.getElementById("addprbtn").style.display = "none";
					document.getElementById("adddpmsg").style.display = "inline";
					document.getElementById("adddpbtn").style.display = "none";
					document.getElementById("addinmsg").style.display = "inline";
					document.getElementById("addinbtn").style.display = "none";
				}
				*/
				
			}
			gebi('user-prop-select').innerHTML = '';
			var selects = ""
			for(var x=1;x<ta.length;x++){
				var aa = ta[x].split("::")
				
				if(_active_prop == 0){_active_prop = aa[0]}
				
				selects += "<option value="+aa[0]+">"+aa[1]+"</select>"
				//document.getElementById("prop_tab"+aa[0]).style.display = "";
				//document.getElementById("prop_tab"+aa[0]).childNodes[0].innerHTML = aa[1]				
			}
			gebi('user-prop-select').innerHTML = selects;
			if(ta.length==2){
				dspArray("user-prop-select","none");
			} 
			if(ta.length>2){
				dspArray("user-prop-select","");
			}
			
			//clean up tabs
			if(1==2){
			var list = document.getElementById("propTabList");
			var content = document.getElementById("tabViews");
			var ch = document.getElementById('propTabList').children
			for(var x=ch.length-1;x>0;x--){
				if(ch[x].children[0].innerHTML == "&nbsp;"){				
					var tn = ch[x].id.substr(8)
					list.removeChild(list.childNodes[x]);								
					document.getElementById("propTab"+tn).innerHTML = "";
					content.removeChild(document.getElementById("propTab"+tn));
				}
			}
			}
			
			$(".guesttitle").hide();
			$(".guestpage").hide();
			$(".modulepage").hide();
			$("#homecontainer").hide();
			$("#pgmodules").hide();
			$(".bg").hide();
			$(".lgo").css({float: "left",padding: "9px", width: "60px", height: "60px"})
			$(".navbar-nav li a").css({lineHeight:"6px"})
			$(".navbar").css({minHeight: "61px"})
			
			dspArray("loginfrm","none");
			dspArray("nickwrap","none")
			dspArray("registerfrm","none");
			dspArray("worktabs","");
			dspArray("pgreports","");
			dspArray("pgsupport","");
			dspArray("pgtraining","");
			dspArray("logoutlink","");
			
			tabbers.init();
			logindialog.dialog( "close" );
			
			init_sockets(tuid)
			
			$('.inputs').keydown(function (e) {
				 if (e.which === 13) {
					 var index = $('.inputs').index(this) + 1;
					 $('.inputs').eq(index).focus();
				 }
			 });
		
	}
	//$(function () {$('.footable').footable();});		 
	
	//this serves as a page loaded area
	_tabsloaded = 1;
	active_tab();
	//admin_tab(); //because it may be hidden
	//$('.footable').footable();
	
}};_h(a);}


var logindialog, loginform
	
	$(function() {			
			var
			// From http://www.whatwg.org/specs/web-apps/current-work/multipage/states-of-the-type-attribute.html#e-mail-state-%28type=email%29
			emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
			name = $( "#name" ),
			email = $( "#email" ),
			password = $( "#password" ),
			allFields = $( [] ).add( name ).add( email ).add( password ),
			tips = $( ".validateTips" );

			function updateTips( t ) {tips .text( t ).addClass( "ui-state-highlight" );setTimeout(function() {tips.removeClass( "ui-state-highlight", 1500 );}, 500 );}
			function checkFrmLength( o, n, min, max ) {if ( o.val().length > max || o.val().length < min ) {o.addClass( "ui-state-error" );updateTips( "Length of " + n + " must be between " + min + " and " + max + "." );return false;} else {return true;}}
			function checkRegexp( o, regexp, n ) {if ( !( regexp.test( o.val() ) ) ) {o.addClass( "ui-state-error" );updateTips( n );return false;} else {return true;}}
			
			function initContent() {
				var valid = true;
				allFields.removeClass( "ui-state-error" );
				valid = valid && checkFrmLength( email, "email", 1, 80 );
				if(checkFrmLength( password, "password", 1, 16 )){
					valid = valid && checkFrmLength( password, "password", 1, 16 );
					valid = valid && checkRegexp( password, /^([0-9a-zA-Z])+$/, "Password field only allow : a-z 0-9" );}
				valid = valid && checkRegexp( email, emailRegex, "eg. yourname@email.com" );				
				
				if ( valid ) {
					$( "#users tbody" ).append( "<tr><td>" + email.val() + "</td><td>" + password.val() + "</td></tr>" );					
					root_login("/home?e="+email.val()+"&p="+password.val()+"&r=1","worktabs");				
					
				}
				return valid;
			}

			logindialog = $( "#login-form" ).dialog({
				autoOpen: false,height: 250,width: 300,modal: true,
				buttons: {"Login": initContent,Cancel: function() {logindialog.dialog( "close" );}},
				close: function() {loginform[ 0 ].reset();allFields.removeClass( "ui-state-error" );}
			});
			loginform = logindialog.find( "form" ).on( "submit", function( event ) {event.preventDefault();initContent();});

			$(document).ready(function(){
				if(1==1){console.log('docready')}
				root_login("/home2?e=&p=&r=","worktabs");
				$(this).parents('.ui-dialog-buttonpane button:eq(0)').focus();
				var timeoutID = window.setTimeout(function(){
					$('#tickets-table-0').resize()}
					,1000)
				$('#tickets-table-0').footable({ calculateWidthOverride: function() { return {width: $(window).width()}; }, breakpoints: { phone: 480, tablet: 900 } });				
				$('#status-report-table').footable({calculateWidthOverride: function() {return { width: $(window).width()}; }, breakpoints: { phone: 480, tablet: 900 } });				
				$('#closed-tickets-table').footable({calculateWidthOverride: function() {return { width: $(window).width()}; }, breakpoints: { phone: 480, tablet: 900 } });				
				
				$('#associates-table').footable({ calculateWidthOverride: function() { return {width: $(window).width()}; }, breakpoints: { phone: 480, tablet: 900 } });				
				$('#groups-table').footable({ calculateWidthOverride: function() { return {width: $(window).width()}; }, breakpoints: { phone: 480, tablet: 900 } });				
				$('#properties-table').footable({calculateWidthOverride: function() {return { width: $(window).width()}; }, breakpoints: { phone: 480, tablet: 900 } });				
				$('#departments-table').footable({calculateWidthOverride: function() {return { width: $(window).width()}; }, breakpoints: { phone: 480, tablet: 900 } });				
				$('#inquiries-table').footable({calculateWidthOverride: function() {return { width: $(window).width()}; }, breakpoints: { phone: 480, tablet: 900 } });				
				$('#messages-table').footable({calculateWidthOverride: function() {return { width: $(window).width()}; }, breakpoints: { phone: 480, tablet: 900 } });				
				
				$(document).bind('keydown', 'ctrl+shift+f', function() {
					if(gebi('worktabs').style.display != "none"){		
						var c = gebi('groupTabContents').children;
						for(var i = 0; i < c.length; i++) {
							if(c[i].getAttribute('class')==="selected"){
								var as = c[i].id.substr(9)
								$('#tickets-filter-'+as).focus();
							}
						}
					}					
				});
			});
			
	});
	
	var statdialog, statform;
	
	$(function() {	
			function initstat() {
				
				stat_desc = $( "#statdesc" );
				stat_cmmt = $( "#statcmmt" );
				var allStatFields = $( [] ).add( stat_desc );
				var statNext;
				var statTips = $( ".validateTips" );
				
				var valid = true;
				allStatFields.removeClass( "ui-state-error" );
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
				valid = valid && checkFrmLength( stat_desc, "statdesc", 'ticket-notify', 2, 999 ) && checkFrmLength( stat_cmmt, "statcmmt", 'ticket-notifcust', 2, 999 );
				
				if ( $( "#statcmmt" ).val().length > 0 && gebi('ticket-notifcust').checked == false) {
					$( "#statcmmt" ).addClass( "ui-state-error" );
					alert("A guest comment was entered, but the option to include the comment was not selected.  Either select the option to include the guest comment or remove the comment.");
					valid = false;
				}
				
				if ( valid ) {
				
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
						closedialog.dialog("open");
					} else {
						update_ticket_dialog(stat_r+"&next="+stat_n+"&tostat="+stat_ts+"&prop="+_active_prop+"&statxt="+encode(stat_desc.val())+"&notify="+stat_ny+"&files="+stat_files+"&notifcust="+stat_ct+"&custxt="+encode(stat_cmmt.val())+"&silent="+stat_cl);
					}	
				} else {
					if(stat_ct == true){						
						closedialog.dialog("open");
					} else {
						update_ticket_dialog(stat_r+"&next="+stat_n+"&tostat="+stat_ts+"&prop="+_active_prop+"&statxt="+encode(stat_desc.val())+"&notify="+stat_ny+"&files="+stat_files+"&notifcust="+stat_ct+"&custxt="+encode(stat_cmmt.val())+"&silent="+stat_cl);
					}
				}
				clearTimeout(edtk_timeout);
				
				
				
				
				
				$(function () { 
					$('.footable').footable();
				});
				}
				return valid;
			}
			
			statdialog = $( "#stat-form" ).dialog({
				autoOpen: false,width: 400, position: { my: 'top', at: 'top+80' },
				modal: true,				
				buttons: {"OK": initstat,Cancel: function() {
					statdialog.dialog( "close" );
					dspArray("stat-form-fs-1","");
					dspArray("stat-form-wk-1","none");
					//dspArray("ticket-wrap-files","none");
					}},
				close: function() {statform[ 0 ].reset();
					//dspArray("ticket-wrap-files","none");
					}
			});
			statform = statdialog.find( "form" ).on( "submit", function( event ) {event.preventDefault();initstat();});
			
	});
		
function update_ticket_dialog(r){
	r+="&sort="+stat_s;
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){					
	
	statdialog.dialog( "close" );
	var ra = a.responseText.split("::::");
	if(stat_n === "next"){
		if(ra[0]==="box"){
			closedialog.dialog( "close" );
			dspArray("stat-form-fs-1","");
			dspArray("stat-form-wk-1","none");
			//dspArray("ticket-wrap-files","none");
			skd("ticket-form-"+stat_ps,ra[1]);	
				$('.inputs').keydown(function (e) {
					 if (e.which === 13) {
						 var index = $('.inputs').index(this) + 1;
						 $('.inputs').eq(index).focus();
					 }
				 });			
		}
		//in case of last record, fall through
		if(ra[0]==="tr"){
			gebi("ticket-trow-"+stat_ps+"-"+stat_id).innerHTML = ra[2];
			jQuery("time.timeago").timeago();
			$.localtime.setFormat("M-d-yyyy h:mm a");
			$.localtime.format();			
			dspArray("tickets-table-"+stat_ps,"");cd("ticket-form-"+stat_ps);dspArray("ticket-form-"+stat_ps,"none");
			closedialog.dialog( "close" );
			dspArray("stat-form-fs-1","");
			dspArray("stat-form-wk-1","none");
			//dspArray("ticket-wrap-files","none");			
		}
	}
	
	if(stat_n === "return"){
		if(ra[0]==="tr"){
			gebi("ticket-trow-"+stat_ps+"-"+stat_id).innerHTML = ra[2];
			jQuery("time.timeago").timeago();
			$.localtime.setFormat("M-d-yyyy h:mm a");
			$.localtime.format();			
			dspArray("tickets-table-"+stat_ps,"");cd("ticket-form-"+stat_ps);dspArray("ticket-form-"+stat_ps,"none");
			dspArray("stat-form-fs-1","");
			dspArray("stat-form-wk-1","none");
		} else {
			alert(ra);
		}
	}
		
	if(stat_n === "close"){
		cd("form-pan-cont");
		dspArray("form-pan-cont","none");
		dspArray("can-close","");
		dspArray("stat-form-fs-1","");
		dspArray("stat-form-wk-1","none");
	}
	if(stat_ts === "pending" || stat_ts === "awaiting" || stat_ts === "approved"){					
		if(stat_n === "return"){
			dspArray("tickets-table-"+stat_ps,"");cd("ticket-form-"+stat_ps);;dspArray("ticket-form-"+stat_ps,"none");										
		}
		sdtn("ticket-trow-"+stat_ps+"-"+stat_id); //temporary, hide for now
		var d = "groupCnt-"+stat_ps		
		var c = parseInt(gdi(d))
		if(c >= 1){c--;}
		upct(d,c);
		
		if(stat_ts === "pending"){
			var d = "groupCnt-4"
			var c = parseInt(gdi(d))
			c++;
			upct(d,c);
		}
		
		if(stat_ts === "awaiting"){
			var d = "groupCnt-6"
			var c = parseInt(gdi(d))
			c++;
			upct(d,c);
		}
		if(stat_ts === "approved"){
			closedialog.dialog( "close" );
		}		
	}	
	$("html, body").scrollTop(0)
	
}};_h(a);
}				
		
var usersdialog, usersform
	
	$(function() {			
			
			function initUserContent() {
				var valid = true;
				var v = gebi("propuserlist")[gebi("propuserlist").selectedIndex].value;
				var p = gdi("prop.pr.prop");				
				var a=_z("/propusradd?prop="+p+"&assoc="+v);a.onreadystatechange=function(){if(a.readyState==4){
					skd("propuserswrap",a.responseText);	
					
					}};_h(a);
				
				usersdialog.dialog( "close" );
				return valid;
				
			}

			usersdialog = $( "#users-form" ).dialog({
				autoOpen: false,width: 300,position: { my: 'top', at: 'top+80' },
				modal: true,
				buttons: {"Assign": initUserContent,Cancel: function() {usersdialog.dialog( "close" );}},
				close: function() {usersform[ 0 ].reset();}
			});
			usersform = usersdialog.find( "form" ).on( "submit", function( event ) {event.preventDefault();initUserContent();});
			
	});
		
		
var closedialog, closeform

	$(function() {

		function initCloseContent() {
				var stat_desc = $( "#statdesc" );									
				var valid = true;
				closedialog.dialog( "close" );
				update_ticket_dialog(stat_r+"&next="+stat_n+"&tostat="+stat_ts+"&prop="+_active_prop+"&statxt="+encode(stat_desc.val())+"&notify="+stat_ny+"&files="+stat_files+"&notifcust="+stat_ct+"&custxt="+encode(stat_cmmt.val())+"&silent="+stat_cl);				
				return valid;
			}

			closedialog = $( "#close-confirm" ).dialog({
				autoOpen: false,width: 300,position: { my: 'bottom', at: 'top+400' },
				modal: true,
				buttons: {"Continue": initCloseContent,Cancel: function() {
					closedialog.dialog( "close" );
					dspArray("stat-form-fs-1","");
					dspArray("stat-form-wk-1","none");
					}},
				close: function() {closeform[ 0 ].reset();}
			});
			closeform = closedialog.find( "form" ).on( "submit", function( event ) {event.preventDefault();initCloseContent();});
			
	});
	
	
function edtkticker() {
	keepcountdown-=1;
	if(keepcountdown>0){
		document.getElementById('keep-countdown').innerHTML = keepcountdown
		edtk_ticker = setTimeout(function(){ edtkticker(); }, 1000);
	} else {
		cancelkeep();
	}
}
	
function cancelkeep(){
	clearTimeout(edtk_timeout);
	clearTimeout(edtk_ticker);
	 keepcountdown = 0	
	 console.log('cancel ')
	var a=_z("\edit-ticket-cancel?");a.onreadystatechange=function(){if(a.readyState==4){
	}};_h(a);
	cd("ticket-form-"+edtk_prop+"-"+edtk_status);
	dspArray("tickets-table-"+edtk_prop+"-"+edtk_status,"");
	keepdialog.dialog( "close" );
}	
var keepcountdown = 0	
var keepdialog, keepform

	$(function() {

		function initKeepContent() {
				var valid = true;
				clearTimeout(edtk_ticker);
				clearTimeout(edtk_timeout);				
				keepcountdown = 0	
				var a=_z("\edit-ticket-keep?id="+edtk_id);a.onreadystatechange=function(){if(a.readyState==4){
				var tm = parseInt(a.responseText)				
				if(tm>0){
					edtk_timeout = setTimeout(function(){ 
					keepcountdown = 30
					clearTimeout(edtk_timeout);
					edtkticker();
					keepdialog.dialog( "open" ); 		
					}, tm * 1000);
				}
				}};_h(a);
				
				keepdialog.dialog( "close" );
				
				return valid;
			}

			keepdialog = $( "#keep-form" ).dialog({
				autoOpen: false,width: 300,position: { my: 'bottom', at: 'top+300' },
				modal: true,
				buttons: {"Keep Editing": initKeepContent,
					Cancel: function() {						
						cancelkeep();
					}
				},
				close: function() {
					keepform[ 0 ].reset();
				}
			});
			keepform = keepdialog.find( "form" ).on( "submit", function( event ) {event.preventDefault();initKeepContent();});
			
	});	