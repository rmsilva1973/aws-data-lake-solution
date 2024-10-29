'use strict';

const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

let AccessLog = require('./access-log.js');

describe('AccessLog', function() {
    describe('#logEvent', function() {

        const ddbMock = mockClient(DynamoDBClient);
        const lambdaMock = mockClient(LambdaClient);

        afterEach(function() {
            ddbMock.reset();
            lambdaMock.reset();
        });

        it('should log an event when logging is enabled', function(done) {

            ddbMock.on(GetItemCommand).resolves({
                Item: {
                    setting: {
                        auditLogging: { BOOL: true }
                    }
                }
            });

            lambdaMock.on(InvokeCommand).resolves({
                StatusCode: 200,
                Payload: Buffer.from('"completed invoke"')
            });

            let _accessLog = new AccessLog();
            _accessLog.logEvent('test', 'test-service', 'sampleuser',
                'testing event',
                'success',
                function(err, data) {
                    if (err) done(err);
                    else done();
                }
            );
        });

        it('should not log an event when logging is disabled', function(done) {

            ddbMock.on(GetItemCommand).resolves({
                Item: {
                    setting: {
                        auditLogging: { BOOL: false }
                    }
                }
            });

            let _accessLog = new AccessLog();
            _accessLog.logEvent('test', 'test-service', 'sampleuser',
                'testing event',
                'success',
                function(err, data) {
                    if (err) done(err);
                    else done();
                }
            );
        });
    });
});