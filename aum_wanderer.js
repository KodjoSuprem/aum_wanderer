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

phantom.onError = function(msg, trace) {
  var msgStack = ['PHANTOM ERROR: ' + msg];
  if (trace && trace.length) {
    msgStack.push('TRACE:');
    trace.forEach(function(t) {
      msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function +')' : ''));
    });
  }
  console.error(msgStack.join('\n'));
  phantom.exit(1);
};

function error(msg){
	console.log("ERROR: " + msg);
	phantom.exit(1);
}

if (system.args.length < 2) {
   error("usage - aum_wanderer.js username password \"search terms\" ville ");
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
			if(timestamp > profileMap[profileId]) // historyfile contains doubles chronologically oredered so we take only the latest entry
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
			if(searchTerms === "new"){
				 console.log("VISIT NEW");
				setTimeout(visitNewProfiles, 2000);
			}else{
				searchAndVisit();
			}
		} else { 
		
			saveFailedPage('login_'+USERNAME);
			error("LOGIN FAILED");

		}
	}
	// printArgs.apply(this, arguments);
	console.log("    " + url);
};

page.onConsoleMessage = function(msg, lineNum, sourceId) {
  console.log(msg);
};

var WANDERER_STATE = "";
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
		document.querySelector('form').submit();
	}, USERNAME, PASSWORD);
	WANDERER_STATE = "WAIT_FOR_LOGIN";
});

// MAKE A SEARCH
/*
	page.evaluate(function () {
				return $("a[href^='https://www.adopteunmec.com/profile/']").map(function(){ return this.href;});
			}
*/

function visitProfiles(profiles){
	var profile = null;
	var now = new Date();
	var SAME_PROFILE_INTERVAL = 2;
	var sameProfileIntervalTimestamp = now.setDate(now.getDate() + SAME_PROFILE_INTERVAL);
	sameProfileIntervalTimestamp = ~~(sameProfileIntervalTimestamp / 1000);
	var nowTimestamp  = ~~(new Date() / 1000);
	
	while((profile = profiles.shift()) && (profile.pertinence < 33  || (VISIT_HISTORY[profile.id] + (SAME_PROFILE_INTERVAL * 24 * 3600) > nowTimestamp) || profile.in_contact ));
	if(!profile){
		console.log("DONE.");
		phantom.exit(0);
	}
	console.log("ping: "+ profiles.length);
	if(!profile.url){
		
		setTimeout(visitProfiles.bind(this,profiles), getRandomVisitInterval(5000,VISIT_INTERVAL));
		return;
	}
		
	
	var url = "https://www.adopteunmec.com" + profile.url;
	
	console.log(url);
	page.open( url, function (status) {
		var profile = null;
		
		if(status !== "success") {
			var profileId = page.url.split("/").pop(); //can get profiled from profile.id
			//saveFailedPage('failed_profile_' + profileId);
		}
		setTimeout(visitProfiles.bind(this,profiles), getRandomVisitInterval(5000,VISIT_INTERVAL));
	});
}
var regions = [];
regions[1] ="Alsace";
regions[2] ="Aquitaine";
regions[3] ="Auvergne";
regions[4] ="Basse-Normandie";
regions[5] ="Bourgogne";
regions[6] ="Bretagne";
regions[7] ="Centre";
regions[8] ="Champagne-Ardenne";
regions[22] ="Corse";
regions[23] ="DOM-TOM";
regions[9] ="Franche-Comté";
regions[10] ="Haute-Normandie";
regions[11] ="Île-de-France";
regions[12] ="Languedoc-Roussillon";
regions[13] ="Limousin";
regions[14] ="Lorraine";
regions[15] ="Midi-Pyrénées";
regions[16] ="Nord-Pas-de-Calais";
regions[17] ="PACA";
regions[18] ="Pays de la Loire";
regions[19] ="Picardie";
regions[20] ="Poitou-Charentes";
regions[21] ="Rhône-Alpes";
function visitNewProfiles() {
	console.log("Fetch new profiles...");
	var newProfilesUrl = "https://www.adopteunmec.com/qsearch/ajax_quick";
	var ageMin = 25;
	var ageMax = 33;
	var regionId = ville;
	console.log("Age " + ageMin + " - " + ageMax + " - " + regions[regionId]);
	 
	var rez = page.evaluate(function (newProfilesUrl,ageMin, ageMax,regionId) {
		var rez = {}; // {members: [ [{}] ]}
		var requestData = {
		"new":1,
		"age[min]": ageMin,
		"age[max]": ageMax,
		"age_step": 1,
		"by": "region",
		"country":" fr",
		"region":regionId,
		/*
		
		*/
		"distance[min]":"",
		"distance[max]":"",
		"distance_step:":10
	};
		 $.ajax({
			async: false,
			type: "POST",
			url: newProfilesUrl,
			data: requestData,
			error: function(a,b,c){
				
			},
			success: function (data) {
				rez = data;
			}
		});
		return rez;
	}, newProfilesUrl, ageMin, ageMax,regionId);
	var profiles = [].concat.apply([], rez.members);
	profiles = profiles.map(function(profile){
		profile.url = "/profile/" + profile.id;
		profile.pertinence = 100;
		if(!profile.inContact) //do not visit profile already in contact list
			return profile;
	});
	console.log("Fetch result : "+ profiles.length);
	// VISIT ALL PROFILES
	console.log("VISIT NEW...");
	

	visitProfiles(profiles);
}

function searchAndVisit(){
	console.log("SEARCH AND VISIT...");
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
			
			if("message" in rez){ // si la réponse JSON contien un message on considere qu'on a pas trouvé
				error("ville not found " + ville);
			} else {
				if (rez.members[0].city.length !== ville.length) // l'orthographe est differente
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
			var totalProfile = null;
			do {
				var searchUrl = searchMoreUrl + "&offset=" + offset;
				 $.ajax({
					async: false,
					url: searchUrl,
					error: function(a,b,c){
						
					},
					success: function (data) {
						var filterFunction = function(item) { if(item.id != null && item.id !== '111159726' && item.id !== '114779627' && item.id !== '15145279' && item.id !== '11707311' && item.dead !== true) return item; };
						var profileList = [];
						if('members' in data){
							profiles = data;
							
							
							profileList = data.members;
							
							profiles.members = profileList.filter(filterFunction);
							
						} else {
							//console.log(JSON.stringify(data[0], null, 4));
							profileList =  Object.keys(data).map(function (key) { return data[key]; });
						
							profiles.members = profiles.members.concat(profileList.filter(filterFunction));
						
						}
						end = ((offset + SEARCH_RESULT_COUNT ) >=  profiles.total || profileList.length < 1 || profileList[0] === 0);
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
		

		visitProfiles(rez.members);
		
	}, 2000);
}
