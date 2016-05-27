var alexa = require('alexa-app');
var app = new alexa.app('${skillName}');

app.launch(function(request, response) {
    response.say('hello ${skillName}');
});

app.intent('sampleIntent',
    {
        'slots': { 'WHEN': 'AMAZON.DATE' },
        'utterances': [
            'tell me about {-|WHEN}'
        ]
    },

    function(request, response) {
        response.say('${skillName} ', request.slot('name'));
    }
);


if (process.argv.length > 2) {
    var arg = process.argv[2];
    if (arg === '-s' || arg === '--schema') {
        console.log(app.schema());
    }
    if (arg === '-u' || arg === '--utterances') {
        console.log(app.utterances());
    }
}

module.exports = app;
