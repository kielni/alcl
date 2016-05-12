var alexa = require('alexa-app');
var app = new alexa.app('${skillName}');

app.launch(function(request,response) {
    response.say('hello ${skillName}');
});

exports.handler = app.lambda();
