#!/usr/bin/env node

var fs = require('fs'),
    program = require('commander'),
    child_process = require('child_process'),
    _ = require('lodash');

// .command('rmdir <dir> [otherDirs...]')
program
    .command('init <name>')
    .description('create a new Alexa skill')
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
        var aws = 'aws lambda create-function --region us-east-1 '+
            '--function-name '+name+' '+
            '--runtime nodejs4.3 --role '+options.role+' --handler index.handler '+
            '--zip-file fileb://aws/lambda.zip '+
            '--cli-input-json file://aws/create-function.json';
        if (options.profile) {
            aws += ' --profile '+options.profile;
        }
        exitOnError(aws);
        // https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions/testing123?tab=eventSources
        console.log('go add event source Alexa Skills Kit on '+
            'https://console.aws.amazon.com/lambda/home?'+
            'region=us-east-1#/functions/'+encodeURIComponent(name)+
            '?tab=eventSources');
        console.log('\ndone');
    });

program
    .command('setup <name>')
    .description('setup an Alexa skill for pushing')
    .option('-r, --role <arn>', 'lambda execution role ARN')
    .option('--profile [profile]', 'AWS profile; must have lambda:CreateFunction permission')
    .action(function(name, options) {
        name = name.replace(/\W+/g, '');
        var cwd = process.cwd()+'/';
        if (!fs.existsSync(cwd+'aws')) {
            fs.mkdirSync(cwd+'aws');
        }
        awsConfig(name);
        // create zip
        child_process.execSync('zip -r aws/lambda.zip . -x aws/*');
        console.log('\nalcl push to upload code to AWS');
    });

program
    .command('push')
    .description('update Lambda function code')
    .option('--profile [profile]', 'AWS profile; must have lambda:UpdateFunctionCode permission')
    .action(function(options) {
        // create zip
        exitOnError('zip -r aws/lambda.zip . -x aws/*');
        var aws = 'aws lambda update-function-code --region us-east-1 '+
            '--zip-file fileb://aws/lambda.zip '+
            '--cli-input-json file://aws/update-function-code.json';
        if (options.profile) {
            aws += ' --profile '+options.profile;
        }
        exitOnError(aws);
    });

program
    .command('test')
    .description('test Lambda function code')
    .option('--profile [profile]', 'AWS profile; must have lambda:ExecuteFunction permission')
    .action(function(options) {
        var name = null;
        // try to get function name from aws/update-function-code.json
        var update = JSON.parse(fs.readFileSync('aws/update-function-code.json', 'utf8'));
        if (update) {
            name = update.FunctionName;
        }
        if (!name) {
            console.log('error: cannot find function name; use --function-name <name>');
            return;
        }
        var payload = fs.readFileSync('aws/launch.json', 'utf8');
        if (!payload) {
            console.log('error: missing test payload in aws/launch.json');
            return;
        }
        payload = payload.replace(/\n/g, ' ').replace(/\s+/g, '');
        var outfile = 'aws/test.json';
        var aws = 'aws lambda invoke --region us-east-1 '+
            ' --function-name '+name+
            ' --payload '+"'"+payload+"'"+
            ' --log-type Tail ';
        if (options.profile) {
            aws += ' --profile '+options.profile;
        }
        aws += ' '+outfile;
        try {
            console.log('\n'+aws+'\n');
            /*
            {
                "LogResult": "base64 encoded output",
                "StatusCode": 200
            }
            */
            var output = JSON.parse(child_process.execSync(aws));
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

program.parse(process.argv);

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
