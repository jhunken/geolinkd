var OAuth = require('oauth');
var request = require('request');
var config = require('../config');

var WorknikAPIKey = config.WorknikAPIKey;
function getRandomWord(callback) {

    var cachebuster = Math.round(new Date().getTime() / 1000);
    var params = 'hasDictionaryDef=false&minCorpusCount=0&maxCorpusCount=-1&minDictionaryCount=1&maxDictionaryCount=-1&minLength=5&maxLength=-1&api_key=' + WorknikAPIKey;
    var route = '/v4/words.json/randomWord?' + params + '&cb=' + cachebuster;
    var options = {

        uri: 'http://api.wordnik.com' + route, port: 80, path: route, method: 'get'

    };
    request(options, function (err, wnres, data) { //chunks are already aggregated
        console.log("Got response: " + wnres.statusCode);
        data = JSON.parse(data);
        return callback(data);
    });
}

function getDefinition(word, callback) {

    var params = 'limit=1&includeRelated=true&useCanonical=false&includeTags=false&worknikAPIKey=' + WorknikAPIKey;
    var route = '/v4/word.json/' + word + '/definitions?' + params;
    var options = {

        uri: 'http://api.wordnik.com' + route, port: 80, path: route, method: 'get'

    };
    request(options, function (err, wnres, data) { //chunks are already aggregated
        console.log("Got response: " + wnres.statusCode);
        data = JSON.parse(data);
        return callback(data[0].text);
    });
}
function getRandomCompany(res, callback) {
    //return random linkedin companyid

    //get random keyword from wordnik api
    getRandomWord(function (result) {
        var word = result.word;
        var oauth = new OAuth.OAuth('https://www.linkedin.com/uas/oauth2/authorization',
            'https://www.linkedin.com/uas/oauth2/accessToken',
            config.LinkedInAPIKey,
            config.LinkedInSecretKey,
            '1.0A',
            null,
            'HMAC-SHA1');
        //get random word here for keyword
        oauth.get('http://api.linkedin.com/v1/company-search?keywords=' + word + '&format=json',
            config.LinkedInOAuthUserToken,
            config.LinkedInOAuthUserSecret,
            function (e, data, ores) {
                if (e) console.error(e);
                console.log(require('util').inspect(data));
                if (JSON.parse(data).status == 403) {
                    //we got throttled
                    res.render('throttled', { data: data});
                } else {
                    if (JSON.parse(data).numResults == 0) {
                        //no hits, try again
                        getRandomCompany(res, callback);
                    } else {
                        if (JSON.parse(data).companies == null) {
                            //try again
                            getRandomCompany(res, callback);
                        } else {
                            var companyId = JSON.parse(data).companies.values[0].id;
                            getCompanyInfo(companyId, function (result) {
                                var companies = JSON.parse(result);
                                if (companies.locations == null) {
                                    //no location data, try again
                                    getRandomCompany(res, callback);
                                } else {
                                    var company = companies;

                                    //var companyData = JSON.parse(result);
                                    var street1 = company.locations.values[0].address.street1;
                                    var street2 = company.locations.values[0].address.street2;
                                    var city = company.locations.values[0].address.city;
                                    var state = company.locations.values[0].address.state;
                                    var country = company.locations.values[0].address.countryCode;
                                    //geolocate address
                                    var options = {

                                        uri: 'http://maps.googleapis.com/maps/api/geocode/json?address=' + street1 + ' ' + street2 + ',' + city + ',' + state + ',' + country + '&sensor=false', port: 80
                                        // , path: route
                                        , method: 'get'

                                    };
                                    request(options, function (err, wnres, data) { //chunks are already aggregated
                                        console.log("Got response: " + wnres.statusCode);
                                        googleData = JSON.parse(data);
                                        if (googleData.status == "ZERO_RESULTS") {
                                            //google couldn't find it, try again
                                            getRandomCompany(res, callback);
                                        } else {
                                            return callback(company, googleData);
                                        }
                                    });
                                }


                            });
                        }
                    }
                }
            });
    });


}
function getCompanyInfo(id, callback) {
    var oauth = new OAuth.OAuth('https://www.linkedin.com/uas/oauth2/authorization',
        'https://www.linkedin.com/uas/oauth2/accessToken',
        config.LinkedInAPIKey,
        config.LinkedInSecretKey,
        '1.0A',
        null,
        'HMAC-SHA1');
    oauth.get('http://api.linkedin.com/v1/companies/' + id + ':(id,name,ticker,description,locations:(address:(street1,street2,city,state,postal-code,country-code),is-headquarters))?format=json',
        config.LinkedInOAuthUserToken,
        config.LinkedInOAuthUserSecret,
        function (e, data, ores) {
            if (e) console.error(e);
            console.log(require('util').inspect(data));
            return callback(data);
        });
}

exports.index = function (req, res) {
    var companies = new Array();
    getRandomCompany(res, function (company, googleData) {
        companies.push(company);
        getRandomCompany(res, function (company, googleData) {
            companies.push(company);
            getRandomCompany(res, function (company, googleData) {
                companies.push(company);
                res.render('index', { googleData: googleData, companies: companies });
            });
        });

    });
};
