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
        name = name.replace(/\W+/g, '');
        console.log('creating %s skill\n', name);
        // create directory
        var cwd = process.cwd()+'/';
        if (!fs.existsSync(cwd+'aws')) {
            fs.mkdirSync(cwd+'aws');
        }
        var replace = {
            'skillName': name,
        };
        // skill skeleton
        copyTemplate('package.json', replace, cwd);
        copyTemplate('index.js', replace, cwd);
        copyTemplate('.gitignore', replace, cwd);
        // aws config
        copyTemplate('create-function.json', replace, cwd+'aws/');
        copyTemplate('update-function-code.json', replace, cwd+'aws/');
        // install alexa-app
        exitOnError('npm install alexa-app');
        // create zip
        child_process.execSync('zip -r aws/lambda.zip * -x aws/*');
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
    .command('push')
    .description('update Lambda function code')
    .option('--profile [profile]', 'AWS profile; must have lambda:UpdateFunctionCode permission')
    .action(function(options) {
        // create zip
        exitOnError('zip aws/lambda.zip * -x aws/*');
        var aws = 'aws lambda update-function-code --region us-east-1 '+
            '--zip-file fileb://aws/lambda.zip '+
            '--cli-input-json file://aws/update-function-code.json';
        if (options.profile) {
            aws += ' --profile '+options.profile;
        }
        exitOnError(aws);
    });

program.parse(process.argv);

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
    var template = fs.readFileSync('templates/'+filename, 'utf8');
    var out = dest+filename;
    console.log('copy templates/'+filename+' to '+out);
    var compiled = _.template(template);
    fs.writeFileSync(out, compiled(replace));
}
