var _tabsloaded = 0;  //for page refresh and initial load
var _admin_tab = -1
var _active_tab = "groupTabContents-0"
function onTabSelected(tab, p) {
	if(_tabsloaded == 0) {return;}
	_active_tab = p
	active_tab();
}
var _last_ps_as = '';
function active_tab (){
	
	if(gebi('reports').style.display != "none"){	
		report_tab();
	}
	
	if(gebi('admin').style.display != "none"){		
		admin_tab();
	}
	
	if(gebi('worktabs').style.display != "none"){
		
		var c = gebi('groupTabContents').children;
		for(var i = 0; i < c.length; i++) {
			if(c[i].getAttribute('class')==="selected"){
				var as = c[i].id.substr(9)
			}
		}
	
		
		//expand(as);
		
		close_ticket_edits();
		ap = _active_prop
		if(_last_ps_as != ap+'-'+as){
			_last_ps_as = ap+'-'+as;
			if(as==0||as==2||as==4||as==6||as==8){			
				gebi("worktabs").style.display = "";
				divupt("/tickets?status="+as+"&prop="+ap,ap,as,"groupTabContent-"+as,"tickets-table-"+as,"add-ticket-working-"+as);
				if(false){console.log("/tickets?status="+as+"&prop="+ap)}
				dspArray("propTab","")
				var timeoutID = window.setTimeout(function(){$('#tickets-table-'+as).resize()},500)
			}
		}
	}
}

function admin(){
	sdtn("worktabs"); sdtn("pages"); sdtn("reports");
	dspArray("admin","");
	dspArray("adminTabs","");
	dspArray("admin-working","");
	console.log('admin')
	if(_admin_tab<0){
		_admin_tab=0
		var c = $("#adminTabs").children()
		for(var i=0;i<c.length;i++){			
			if(c[i].getAttribute('class')==="selected"){
				_admin_tab = c[i].id.substr(7);
				//$("#adminTab-"+_admin_tab+" table").resize();			
			}
		}	
	}
	if(close_ticket_edits()){return}	
	
	var a=_z('/admin?a='+_admin_tab);a.onreadystatechange=function(){if(a.readyState==4){
		console.log('admin response')
		gebi('adminTab-'+_admin_tab).innerHTML = a.responseText;
	
		var timeoutID = window.setTimeout(function(){
			$('#adminTab-'+_admin_tab+' table').resize();			
			},500)
		
		$('#adminTab-'+_admin_tab+' table').footable({ calculateWidthOverride: function() { return {width: $(window).width()}; }, breakpoints: { phone: 480, tablet: 1024 } });	
		$('#adminTab-'+_admin_tab+' table tfoot tr td').attr('colspan',$('#adminTab-'+_admin_tab+' table').find('tr:first th').length);
		$('#adminTab-'+_admin_tab+' table tfoot tr td').show();
		dspArray("admin-working","none");
	
		jQuery("time.timeago").timeago();
		$.localtime.setFormat("M-d-yyyy h:mm a");
		$.localtime.format();

}};_h(a);}


function close_ticket_edits(){
	var res = false;
	for(var x=0;x<7;x++){		
		if(gebi("ticket-form-"+x) != null) {
			if(gebi("ticket-form-"+x).style.display == ""){
				res = true;
			}
		}		
	}
	
	if (res==true){
		//var x=window.confirm("Close the current form and lose changes?")
		res = !x
	}
	
	if(res==false){
		for(var x=0;x<7;x++){
			var e = gdi("ticket-form-"+x);
			if(false){console.log('ticket-form-'+x+' '+e)}
			if(e && e!=""){
				if(false){console.log('clearing '+x)}
				var a=_z("\edit-ticket-cancel?t="+x);a.onreadystatechange=function(){if(a.readyState==4){
				}};_h(a);
				clearTimeout(edtk_timeout);
				cd("ticket-form-"+x);
				dspArray("tickets-table-"+x,"");				
			}
		}
	}
	return res
}

var _report_tab = 0;
function report_tab(){
	var c = gebi('reportTabs').children;
	for(var i = 0; i < c.length; i++) {
		if(c[i].getAttribute('class')==="selected"){
			_report_tab = c[i].id.substr(7);
			var d = gebi("reportTab-"+_report_tab).getElementsByClassName("footable")[0].id			
			reports(d);
		}
	}
}


function admin_tab(){
	var c = gebi('adminTabs').children;
	for(var i = 0; i < c.length; i++) {
		if(c[i].getAttribute('class')==="selected"){
			_admin_tab = i;
			//var d = gebi("adminTab-"+_admin_tab).getElementsByClassName("footable")[0].id
			//$("#adminTab-"+_admin_tab+" table").resize();
			admin(); break;
		}
	}
}

function active_menu(m){
	$('.navbar-toggle').click()
	var c = false
	if(m=="pgsupport"){
		$('#supportcontainer').hide();
		if(_root_status == "login"){
			$("#justdemo").hide();
			$(".guestpage").hide();
			$(".modulepage").hide();
			$("#blogcontainer").hide();
			$('#supportcontainer').fadeIn(1500);
		} else {
			page('/support?');
		}
	}
	if(!c){
		$("#blogcontainer").hide();	
		$("#workcontainer").show();	
		$("#usermewrap").show();				
		var c = gebi(m).parentNode.children;
		for(var i = 0; i < c.length; i++) {
			if(c[i].getAttribute('class')==="active"){
				c[i].setAttribute('class',"");
			}
		}
		gebi(m).setAttribute('class',"active");
	}	
}

var tstate = 0;
function expand(n){
	/*
	if(n>4){	
		if(tstate == 5){return}
		tstate = 5;
		var el = gebi('groupTab'+_active_prop+'-1').children[0]
		var t1=new Tween(el.style,'left',Tween.strongEaseOut,0,-58,1,'px');t1.start();
		var el = gebi('groupTab'+_active_prop+'-2').children[0]
		var t1=new Tween(el.style,'left',Tween.strongEaseOut,0,-169,1,'px');t1.start();
		var el = gebi('groupTab'+_active_prop+'-3').children[0]
		var t1=new Tween(el.style,'left',Tween.strongEaseOut,0,-234,1,'px');t1.start();
		var el = gebi('groupTab'+_active_prop+'-4').children[0]
		var t1=new Tween(el.style,'left',Tween.strongEaseOut,0,-244,1,'px');t1.start();
		//var el = gebi('groupTab'+_active_prop+'-5').children[0]
		//var t1=new Tween(el.style,'left',Tween.strongEaseOut,10,-228,1,'px');t1.start();
		//var el = gebi('groupTab'+_active_prop+'-6').children[0]
		//var t1=new Tween(el.style,'left',Tween.strongEaseOut,10,-229,1,'px');t1.start();
	}
	*/
	if(n==0||n==2||n==4||n==6){
		if(tstate == 0){return}
		tstate = 0;
		var el = gebi('groupTab'+_active_prop+'-2').children[0]
		var t1=new Tween(el.style,'left',Tween.strongEaseOut,-58,0,1,'px');t1.start();
		var el = gebi('groupTab'+_active_prop+'-2').children[0]
		var t1=new Tween(el.style,'left',Tween.strongEaseOut,-169,0,1,'px');t1.start();
		var el = gebi('groupTab'+_active_prop+'-3').children[0]
		var t1=new Tween(el.style,'left',Tween.strongEaseOut,-234,0,1,'px');t1.start();
		var el = gebi('groupTab'+_active_prop+'-4').children[0]
		var t1=new Tween(el.style,'left',Tween.strongEaseOut,-244,0,1,'px');t1.start();
		//var el = gebi('groupTab'+_active_prop+'-5').children[0]
		//var t1=new Tween(el.style,'left',Tween.strongEaseOut,-228,10,1,'px');t1.start();
		//var el = gebi('groupTab'+_active_prop+'-6').children[0]
		//var t1=new Tween(el.style,'left',Tween.strongEaseOut,-229,-48,1,'px');t1.start();
	}
}	


function clicktab(tab){
	var els = document.getElementsByTagName("a");
	for (var i = 0, l = els.length; i < l; i++) {
		var el = els[i];
		var len = el.href.length;
		if(el.href.substr(len-tab.length) === tab){			
			el.click();
		}
	}
}	



function divupt(r,p,s,d,dt,wk){
	 //$('#'+dt).remove();
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){	
	for(var i=0;i<7;i++){
		cd("groupTabContent-"+i);
	}
	gebi(d).innerHTML = a.responseText;
	tktct("/ticketct?status="+s+"&prop="+p)		
	$('#'+dt).footable({ calculateWidthOverride: function() { return {width: $(window).width()}; }, breakpoints: { phone: 480, tablet: 1024 } });	
	$('#'+dt+' tfoot tr td').attr('colspan',$('#'+dt).find('tr:first th').length);
	
	jQuery("time.timeago").timeago();
	$.localtime.setFormat("M-d-yyyy h:mm a");
	$.localtime.format();
	//$(".timeago" ).each(function( index, element ) {$(this).siblings().html("1")});	
	setTimeout(function(){ dspArray(wk,"none");dspArray(dt,""); }, 300);	
	
}};_h(a);}

function tktct(r){	
	var a=_z(r);a.onreadystatechange=function(){if(a.readyState==4){			
	var ra = a.responseText.split("::");
	for(var x=0;x<ra.length;x++){
		var n = ra[x].split(":")[0]
		var c = parseInt(ra[x].split(":")[1])
		var d = "groupCnt-"+n		
		upct(d,c)	
	}
}};_h(a);}

function upct(d,c){
	
	if(!gebi(d)){return;}
	sdi(d,c)
	if(c>0){
		if(c<10){
			gebi(d).style.padding = "2px 4px";
		} else {
			gebi(d).style.padding = "2px";
		}
		gebi(d).style.visibility = "";
	} else {
		gebi(d).style.visibility = "hidden";
	}
}
