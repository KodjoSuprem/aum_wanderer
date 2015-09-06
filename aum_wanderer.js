var webpage = require('webpage');
var system = require('system');
var fs = require('fs');


var page = null;
var VISIT_HISTORY = {};
var VISIT_INTERVAL = 10000;
var urlVisitedCount = 0;
var searchTerms = "entre 25 et 30 ans";
var ville = null;
var HISTORY_FOLDER_PATH = 'history';
var FAILED_FOLDER_PATH = "failed";
var PROFILE_HISTORY_FILEPATH = "history.csv";
var SEP = (system.os.name === "windows") ? "\\": "/";


function error(msg){
	console.log("ERROR: " + msg);
	phantom.exit(1);
}

if (system.args.length < 2) {
   error("Arguments missing");
}
if (system.args.length > 2) {
    searchTerms = system.args[3];
}
if (system.args.length > 3) {
    ville = system.args[4];
}
var USERNAME = system.args[1];
var PASSWORD = system.args[2];

if(searchTerms.length < 1){
	error("No search terms");
}

if(!/\S+@\S+\.\S+/.test(USERNAME)){
	error("Bad user name");
}

if(PASSWORD.length < 1){
	error("Bad password");
}

try{
	//read history db
	var profileDb = fs.read(PROFILE_HISTORY_FILEPATH);
	var VISIT_HISTORY = profileDb.split("\n").reduce(function(profileMap, line){
		if(line === "")
			return profileMap;
		var entry = line.split(";");
		var profileId = entry[0];
		var timestamp = +entry[1];
		if(profileId in profileMap){
			if(timestamp > profileMap[profileId])
				profileMap[profileId] = timestamp;
		}
		else {
			profileMap[profileId] = timestamp;
		}
		return profileMap;
	}, {});
}
catch(ex){
	
}

try {
	fs.removeTree(HISTORY_FOLDER_PATH);
}
catch(ex){
	console.log("Cannot remove history folder : "+ HISTORY_FOLDER_PATH);
}
if(!fs.makeDirectory(HISTORY_FOLDER_PATH)){
	console.log("Cannot create history folder : "+ HISTORY_FOLDER_PATH);
}

function getDayDate() {
	var dayDate = new Date();
	return dayDate.getDate() + "_" + dayDate.getMonth() + "_" + dayDate.getFullYear();
}

function printArgs() {
    var i, ilen;
    for (i = 0, ilen = arguments.length; i < ilen; ++i) {
        console.log("    arguments[" + i + "] = " + JSON.stringify(arguments[i]));
    }
}
function getRandomVisitInterval(min, max){
	return Math.floor((Math.random() * max) + min);	
}


function saveFailedPage(name){
	page.render(FAILED_FOLDER_PATH + SEP+ name+'.jpeg', {format: 'jpeg', quality: '100'});
}

function savePage(){
	page.render(HISTORY_FOLDER_PATH +SEP + urlVisitedCount + '.jpeg', {format: 'jpeg', quality: '100'});
}

var page = webpage.create();
page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36';
//page.loadImages  = false;

page.onLoadFinished = function(status) {
    console.log("page.onLoadFinished : " + status);
	urlVisitedCount++;
	if(page.url.indexOf("profile") !== -1 ){
		try{
			var profileId = page.url.split("/").pop();
			var logEntry = profileId + ";" + ~~(new Date().getTime() /1000);
			fs.write(PROFILE_HISTORY_FILEPATH, logEntry + "\n",  'a');
		}
		catch(e){}
	}
	savePage();

};

page.onUrlChanged = function(url) {
    console.log("page.onUrlChanged");
	if(WANDERER_STATE == "WAIT_FOR_LOGIN"){
		if(url === "https://www.adopteunmec.com/home"){
			WANDERER_STATE = "SEARCH_AND_VISIT";
			searchAndVisit();
		} else { 
		
			saveFailedPage('login_'+USERNAME);
			error("LOGIN FAILED");

		}
	}
	// printArgs.apply(this, arguments);
	console.log("    " + url);
};

page.onConsoleMessage = function(msg, lineNum, sourceId) {
  
};

var WANDERER_STATE ="";
//LOGIN
console.log("LOGIN.....");
page.open("https://www.adopteunmec.com/", function (status) {
	if(status !== "success") {
		saveFailedPage('login_'+USERNAME);
		error("Cannot access login page");
	}
	console.log("Log in with "+ USERNAME + " - " + PASSWORD);
	page.evaluate(function (USERNAME,PASSWORD) {
		document.querySelector('input[name=username]').value = USERNAME;
		document.querySelector('input[name=password]').value = PASSWORD;
		document.querySelector('form[id=login]').submit();
	}, USERNAME, PASSWORD);
	WANDERER_STATE = "WAIT_FOR_LOGIN";
});

// MAKE A SEARCH
/*
	page.evaluate(function () {
				return $("a[href^='https://www.adopteunmec.com/profile/']").map(function(){ return this.href;});
			}
*/


function searchAndVisit(){
	
	setTimeout(function () {
		console.log("SEARCH : "+ searchTerms );
		var SEARCH_RESULT_COUNT = 24;
		
		if (ville){
			console.log("Test ville first : " + ville);
			var testVilleUrl = "https://www.adopteunmec.com/gogole/more?count=" + SEARCH_RESULT_COUNT + "&q=" + encodeURIComponent(ville);
			var rez = page.evaluate(function (testUrl) {
				var rez = {};
				 $.ajax({
					async: false,
					url: testUrl,
					error: function(a,b,c){
						
					},
					success: function (data) {
						//console.log(data);
						rez = data;
					}
				});
				return rez;
			}, testVilleUrl);
			
			if("message" in rez){
				error("ville not found " + ville);
			} else {
				if (rez.members[0].city.length !== ville.length)
					error("ville not found " + ville + " <> " + rez.members[0].city);
				console.log("ville found");
				var waitTime = new Date().getTime() + 2000; //wait for 2 sec before visiting
				while (waitTime >= new Date().getTime()) {
				}
			}
		}
		var searchMoreUrl = "https://www.adopteunmec.com/gogole/more?count=" + SEARCH_RESULT_COUNT + "&q=" + encodeURIComponent(searchTerms);
		var rez = page.evaluate(function (searchMoreUrl, SEARCH_RESULT_COUNT) {
			var offset = 0;
			var profiles = null;
			var end = false;
			do {
				var searchUrl = searchMoreUrl + "&offset=" + offset;
				 $.ajax({
					async: false,
					url: searchUrl,
					error: function(a,b,c){
						
					},
					success: function (data) {
						var filterFunction = function(item) { if(item.id !== '110958385' && item.dead !== true) return item; };
						var profileList = [];
						if('members' in data){
							profiles = data;
							profileList = data.members;
							profiles.members = profileList.filter(filterFunction);
						} else {
							profileList = data;
							profiles.members = profiles.members.concat(profileList.filter(filterFunction));
						}
						end = (profileList.length < 1 || profileList[0] === 0);
					}
				});
				if(profiles.message)
					break;
				offset += SEARCH_RESULT_COUNT;
				
				//synchronous wait
				var waitTime = new Date().getTime() + Math.floor(Math.random() * 1000);
				while (waitTime >= new Date().getTime()) {
				}
	
			}
			while(!end);
			return profiles;
		}, searchMoreUrl, SEARCH_RESULT_COUNT);
		if(rez.message){
			console.log("Fetch result contains a message: " + rez.message);
			console.log("visit only first batch of profiles...");
		}
		
		console.log("Fetch result : "+ rez.members.length + "/" + rez.total);
		// VISIT ALL PROFILES
		console.log("VISIT...");
		
		function visitProfiles(profiles){
			var profile = null;
			var now = new Date();
			var SAME_PROFILE_INTERVAL = 3;
			var sameProfileIntervalTimestamp = now.setDate(now.getDate() + SAME_PROFILE_INTERVAL);
			sameProfileIntervalTimestamp = ~~(sameProfileIntervalTimestamp / 1000);
			while(((profile = profiles.shift()) && profile.pertinence < 33 ) || (profile && (VISIT_HISTORY[profile.id] < sameProfileIntervalTimestamp) ));
			if(!profile){
				console.log("DONE.");
				phantom.exit(0);
			}
			
			var url = "https://www.adopteunmec.com" + profile.url;
			
			page.open( url, function (status) {
				var profile = null;
				
				if(status !== "success") {
					var profileId = page.url.split("/").pop(); //can get profiled from profile.id
					saveFailedPage('failed_profile_' + profileId);
				}
				setTimeout(visitProfiles.bind(this,profiles), getRandomVisitInterval(5000,VISIT_INTERVAL));
			});
		}
		visitProfiles(rez.members);
		
	}, 2000);
}
