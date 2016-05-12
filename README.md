# alcl - command line interface for Alexa Skill Lambda functions with alexa-app

[New Alexa Skills Kit Template: Build a Trivia Skill in under an Hour](https://developer.amazon.com/public/community/post/TxDJWS16KUPVKO/New-Alexa-Skills-Kit-Template-Build-a-Trivia-Skill-in-under-an-Hou) ... just 17 easy manual steps.  

Make some changes, make a zip file, open a browser, get dumped to login form, login, click Lambda, click the function, click Upload, choose a file, click Save.  Repeat? Yeah, no.

## prerequisites

- Node.js v4.3.2
- AWS account
- [AWS CLI](http://docs.aws.amazon.com/cli/latest/userguide/installing.html)
- AWS CLI profile with permissions:
    - lambda:CreateFunction
    - lambda:CreateEventSourceMapping
    - lambda:UpdateFunctionCode
    - iam:PassRole permissions
- [Lambda execution role](http://docs.aws.amazon.com/lambda/latest/dg/with-s3-example-create-iam-role.html)

See also:
- [Creating an AWS Lambda Function for a Custom Skill](https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/developing-an-alexa-skill-as-a-lambda-function)
- [Developing Alexa Skills Locally with Node.js](https://developer.amazon.com/public/community/post/Tx3DV6ANE5HTG9H/Big-Nerd-Ranch-Series-Developing-Alexa-Skills-Locally-with-Node-js-Setting-Up-Yo)


## install

    npm install -g alcl

## use

### create a new skill

    alcl init <skillName> -r <lambda_execution_role_ARN> --profile [profile]

- create package.json, index.js, and .gitignore files
- install the [alexa-app](https://www.npmjs.com/package/alexa-app) npm package
- create `create-function.json` and `update-function-code.json` config files in the `aws` subdirectory
- create a Lambda function named `skillName` in us-east-1 with `aws lambda create-function`

`skillName` is required

`lambda_execution_role_ARN` is required; format is arn:aws:iam::<id>:role/<role_name>

`profile` use this AWS CLI profile (optional)

Adding a Alexa Skills Kit event source doesn't seem to be supported through AWS CLI.  Set it up manually on https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions/_functionName_?tab=eventSources

### push updated code to AWS

    alxl push --profile [profile]

- zip the contents of the current directory, excluding `aws`
- upload the code with `aws lambda update-function-code`

`profile` use this AWS CLI profile (optional)

