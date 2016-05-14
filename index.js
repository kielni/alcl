#!/usr/bin/env node

var fs = require('fs'),
    program = require('commander'),
    child_process = require('child_process'),
    _ = require('lodash');

// .command('rmdir <dir> [otherDirs...]')
program
    .command('init <name>')
    .description('create a new Alexa skill: create alexa-app skill template and Lambda function')
    .option('-r, --role <arn>', 'lambda execution role ARN')
    .option('--profile [profile]', 'AWS profile; must have lambda:CreateFunction permission')
    .action(function(name, options) {
        if (!options.role) {
            console.log('lambda execution role ARN is required');
            return;
        }
        name = name.replace(/\W+/g, '');
        console.log('creating %s skill\n', name);
        // create directory
        var cwd = process.cwd()+'/';
        if (!fs.existsSync(cwd+'aws')) {
            fs.mkdirSync(cwd+'aws');
        }
        var replace = {
            'skillName': name
        };
        // skill skeleton
        copyTemplate('package.json', replace, cwd);
        copyTemplate('index.js', replace, cwd);
        copyTemplate('.gitignore', replace, cwd);
        awsConfig(name);
        // install alexa-app
        exitOnError('npm install --save alexa-app');
        // create zip
        child_process.execSync('zip -r aws/lambda.zip . -x aws/*');
        // create a lambda function
        // ZipFile and FunctionName in json config don't work
        var config = [
            '--function-name '+name,
            '--runtime nodejs4.3',
            '--role '+options.role,
            ' --handler index.handler',
            '--zip-file fileb://aws/lambda.zip',
            '--cli-input-json file://aws/create-function.json'
        ];
        config = config.concat(awsOptions(options));
        exitOnError('aws lambda create-function '+config.join(' '));
        // https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions/testing123?tab=eventSources
        console.log('go add event source Alexa Skills Kit on '+
            'https://console.aws.amazon.com/lambda/home?'+
            'region=us-east-1#/functions/'+encodeURIComponent(name)+
            '?tab=eventSources');
        console.log('\ndone');
    });

program
    .command('setup <name>')
    .description('set up an Alexa skill: create AWS config files and zip in aws/')
    .action(function(name, options) {
        name = name.replace(/\W+/g, '');
        var cwd = process.cwd()+'/';
        if (!fs.existsSync(cwd+'aws')) {
            fs.mkdirSync(cwd+'aws');
        }
        awsConfig(name);
        console.log('\nalcl push to upload code to AWS');
    });

program
    .command('push')
    .description('zip and push Lambda code to AWS')
    .option('--profile [profile]', 'AWS profile; must have lambda:UpdateFunctionCode permission')
    .action(function(options) {
        // create zip
        exitOnError('zip -q -r aws/lambda.zip . -x aws/*');
        var config = [
            '--zip-file fileb://aws/lambda.zip',
            '--cli-input-json file://aws/update-function-code.json'
        ];
        config = config.concat(awsOptions(options));
        exitOnError('aws lambda update-function-code '+config.join(' '));
    });

program
    .command('test')
    .description('send request to test Lambda function; print log and results')
    .option('-f, --file [filename]', 'File containing test payload; default aws/launch.json')
    .option('--profile [profile]', 'AWS profile; must have lambda:ExecuteFunction permission')
    .action(function(options) {
        var name = null;
        // try to get function name from aws/update-function-code.json
        var update = JSON.parse(fs.readFileSync('aws/update-function-code.json', 'utf8'));
        if (update) {
            name = update.FunctionName;
        }
        if (!name) {
            console.log('error: cannot find function name in aws/update-function-code.json');
            return;
        }
        var filename = options.file || 'aws/launch.json';
        console.log('POSTing '+filename+' to '+name);
        var payload = fs.readFileSync(filename, 'utf8');
        if (!payload) {
            console.log('error: cannot load test payload from '+filename);
            return;
        }
        console.log(payload+'\n');
        payload = payload.replace(/\n/g, ' ').replace(/\s+/g, '');
        var outfile = 'aws/test.json';
        var config = [
            '--function-name '+name,
            "--payload '"+payload+"'",
            '--log-type Tail'
        ];
        config = config.concat(awsOptions(options));
        var cmd = 'aws lambda invoke '+config.join(' ')+' '+outfile;
        try {
            console.log(cmd+'\n');
            /*
            {
                "LogResult": "base64 encoded output",
                "StatusCode": 200
            }
            */
            var output = JSON.parse(child_process.execSync(cmd));
            var decoded = new Buffer(output.LogResult, 'base64');
            console.log('log\n--------------------------------');
            process.stdout.write(decoded.toString('ascii')+'\n');
            // get output from aws/output.json
            output = JSON.parse(fs.readFileSync(outfile, 'utf8'));
            console.log('output\n--------------------------------');
            process.stdout.write(JSON.stringify(output, null, 2)+'\n');
        } catch (e) {
            process.stdout.write(e.message);
            process.stdout.write(e);
            process.exit();
        }
    });

program
    .command('schema')
    .description('get skill schema for pasting into developer console')
    .action(function() {
        exitOnError('node index --schema');
    });

program
    .command('utter')
    .description('get skill utterances for pasting into developer console')
    .action(function() {
        exitOnError('node index --utterances');
    });

program.parse(process.argv);

function awsOptions(options) {
    var flags = [];
    flags.push('--region us-east-1');  // only supported in us-east-1 for now
    if (options.profile) {
        flags.push('--profile '+options.profile);
    }
    return flags;
}

function awsConfig(name) {
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
    var cwd = process.cwd()+'/';
    var replace = {
        'skillName': name,
        'uuid': uuid,
        'userId': 'user123456',
        'timestamp': (new Date()).toISOString()
    };
    // aws config
    copyTemplate('create-function.json', replace, cwd+'aws/');
    copyTemplate('update-function-code.json', replace, cwd+'aws/');
    copyTemplate('launch.json', replace, cwd+'aws/');
}

function exitOnError(cmd) {
    try {
        process.stdout.write('\n'+cmd+'\n');
        process.stdout.write(child_process.execSync(cmd));
    } catch (e) {
        process.stdout.write(e.message);
        process.stdout.write(e);
        process.exit();
    }
}

function copyTemplate(filename, replace, dest) {
    var template = fs.readFileSync(__dirname+'/templates/'+filename, 'utf8');
    var out = dest+filename;
    console.log('copy templates/'+filename+' to '+out);
    var compiled = _.template(template);
    fs.writeFileSync(out, compiled(replace));
}
