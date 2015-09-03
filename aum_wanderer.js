// Upload an image to imagebin.org
//var USERNAME=  'miniscalope@gmail.com';//'codjovi@free.fr';
//var PASSWORD = 'pCd14sVk';

var USERNAME=  'ponyblue@live.fr';
var PASSWORD = 'sebastien';

var VISIT_HISTORY = {};
var VISIT_INTERVAL = 20000;
var urlVisitedCount = 0;

var searchTerms = "entre 25 et 30 ans";
var page = require('webpage').create();
var system = require('system');
var fs = require('fs');

page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36';
//page.loadImages  = false;

var dayDate = new Date();
dayDate = dayDate.getDate() + "-" + dayDate.getMonth() + "-" + dayDate.getFullYear();
var HISTORY_FOLDER_PATH = 'history';
var FAILED_FOLDER_PATH = "failed";


if (system.args.length < 2) {
   console.log("Argument missing");
   phantom.exit(1);
}
if (system.args.length > 2) {
    searchTerms = system.args[3];
}
USERNAME = system.args[1];
PASSWORD = system.args[2];

try {
	fs.removeTree(HISTORY_FOLDER_PATH);
}
catch(ex){
	console.log("Cannot remove history folder : "+ HISTORY_FOLDER_PATH);
}
if(!fs.makeDirectory(HISTORY_FOLDER_PATH)){
	console.log("Cannot create history folder : "+ HISTORY_FOLDER_PATH);
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
	page.render(FAILED_FOLDER_PATH +"\\" + name+'.jpeg', {format: 'jpeg', quality: '100'});
}

function savePage(){
	page.render(HISTORY_FOLDER_PATH +"\\" +urlVisitedCount+'.jpeg', {format: 'jpeg', quality: '100'});
}

page.onLoadFinished = function() {
    console.log("page.onLoadFinished : "+arguments[0]);
	urlVisitedCount++;
	savePage();

};

page.onUrlChanged = function() {
    console.log("page.onUrlChanged");
	if(WANDERER_STATE == "WAIT_FOR_LOGIN"){
		if(arguments[0] === "https://www.adopteunmec.com/home"){
			WANDERER_STATE = "SEARCH_AND_VISIT";
			searchAndVisit();
		}else{
			 console.log("LOGIN FAILED");
			 saveFailedPage('login_'+USERNAME);
			 phantom.exit(0);
		}
	}
   // printArgs.apply(this, arguments);
  console.log("    " + arguments[0]);
};

page.onConsoleMessage = function(msg, lineNum, sourceId) {
  
};

var WANDERER_STATE ="";
//LOGIN
console.log("LOGIN.....");
page.open("https://www.adopteunmec.com/", function (status) {
	if(status !== "success") {
		console.log("Cannot acces login page");
		saveFailedPage('login_'+USERNAME);
		phantom.exit(0);
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
		console.log("SEARCH.....");
		console.log("Terms : " + searchTerms);
		var SEARCH_RESULT_COUNT = 24;
		var searchMoreUrl = "https://www.adopteunmec.com/gogole/more?count=" + SEARCH_RESULT_COUNT + "&q=" + encodeURIComponent(searchTerms);
			var rez = page.evaluate(function (searchMoreUrl, searchTerms, SEARCH_RESULT_COUNT) {
				var offset = 0;
				var profiles= [];
				var filteredProfiles = [];
				var totalCount = 0;
				do {
					var searchUrl = searchMoreUrl + "&offset=" + offset;
					 $.ajax({
						async: false,
						url: searchUrl,
						error: function(a,b,c){
							
						},
						success: function (data) {
							if('members' in data){
								filteredProfiles = data.members;
								totalCount = data.total;
							} else {
								filteredProfiles = data;
							}
							filteredProfiles = filteredProfiles.filter(function(item) { if(item.id !== '110958385' && item.dead !== true) return item; });
							profiles = profiles.concat(filteredProfiles);
						}
					});
					offset += SEARCH_RESULT_COUNT;
					
					var waitTime = new Date().getTime() + Math.floor((Math.random() * 30000) + 10000);
					
					while (waitTime >= new Date().getTime()) {
					}
		
				}
				while( filteredProfiles.length > 0 && filteredProfiles[0] !== 0);
				return { totalCount : totalCount , profiles : profiles };
			}, searchMoreUrl, searchTerms, SEARCH_RESULT_COUNT);
		console.log("Fetch result : "+ rez.profiles.length + "/" + rez.totalCount);
		// VISIT ALL PROFILES
		console.log("VISIT...");
		function visitProfile(url,profiles){
				url = "https://www.adopteunmec.com" + url;
				page.open( url, function (status) {
					var profile = profiles.shift();
					if(!profile){
						console.log("DONE.");
						phantom.exit(0);
					}
					if(status !== "success") {
						var profileId = page.url.split("/").pop();
						VISIT_HISTORY[profileId] = Math.floor(Date.now() / 1000);
						saveFailedPage('failed_profile_' + profileId);
					}
					setTimeout(visitProfile.bind(this,profile.url,profiles), getRandomVisitInterval(10000,VISIT_INTERVAL));
				});
		}
		var profile = rez.profiles.shift();
		if(!profile){
			console.log("DONE.");
			phantom.exit(0);
		}
		visitProfile(profile.url, rez.profiles);

	}, 2000);
}
