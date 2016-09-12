var request = require("request");
var nodemailer = require("nodemailer");
var firebase = require("firebase");

// CONFIG THIS
// DOWNLOAD "firebase.json" from your firebase project

function PackageMonitor(serviceAccount, databaseURL, emailService) {
    firebase.initializeApp({
	    serviceAccount: serviceAccount,
	    databaseURL: databaseURL
    });
    
    var packageRef = firebase.database().ref("package");
    var packages = {};
    var interval = null;
    
    function oldestPackageKey() {
        var rst = null;
        var rstVal = null;
        
        for (var key in packages) {
            var p = packages[key];
            if(p.lastCheck == null) {
                return key;
            } else if(rstVal == null || rstVal > p.lastCheck) {
                rst = key;
                rstVal = p.lastCheck;
            }
        }
        return rst;
    }
    
    packageRef.on("value", function(snapshot) {
    	var packs = snapshot.val();
    	if(Object.keys(packs).length != Object.keys(packages).length) {
    		packages = packs;
    		
    		if(interval != null) {
    		    clearInterval(interval);
    		}
            
            interval = setInterval(function(){
    		    var key = oldestPackageKey();
    		    if (key != null) {
    		        checkPackage(packages[key], key);
    		    }
            }, Math.floor( (60 * 60 * 24 * 1000) / ( 1 + Object.keys(packages).length )));
            
            console.log("[PACKAGE MONITOR] Start Monitor Every " +  Math.floor( (60 * 60 * 24 * 1000) / ( 1 + Object.keys(packages).length )) + " secs.");
    	}else{
    	    packages = packs;
    	}
    }, function (error) {
        console.log(error);
    });
    
    function checkPackage(pck, key) {
        
        request('https://play.google.com/store/apps/details?id='+ pck.id , function (error, response, body) {
            var invalid = (response.statusCode == 404);
            if (invalid && (pck.status == true)) {
                sendMailFor(pck.id, pck.name);
            }
            var updateData = {
                status: !invalid,
                lastCheck: Math.floor(new Date() / 1000)
            };
            console.log("key: " + key + ", data: " + !invalid);
            packageRef.child(key).update(updateData);
        });
    }
    
    function sendMailFor(id, name) {
    
        var emailRef = firebase.database().ref("email");
        
        emailRef.once("value", function(data) {
            var users = data.val();
            var mails = [];
            for (var mail in users) {
               mails.push(users[mail]);
            }
            
            var transporter = nodemailer.createTransport(emailService);
        
            // setup e-mail data with unicode symbols
            var mailOptions = {
                from: '"Package Monitor" <package.monitor@gmail.com>', 
                to: mails.join(','), // list of receivers
                subject: 'รายงานแอพหาย', // Subject line
                text: 'App name ' + name + ' id: ' + id , // plaintext body
                html: 'App name <b>' + name + '</b> <br/>id: <i>' + id + '</i>' // html body
            };
            
            // send mail with defined transport object
            transporter.sendMail(mailOptions, function(error, info) {
                if(error) {
                    console.log(error);
                }else{
                    console.log('Message sent: ' + info.response);
                }
            });
        });
    }

}

module.exports = PackageMonitor;
