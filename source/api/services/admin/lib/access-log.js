/*********************************************************************************************************************
*  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
*                                                                                                                    *
*  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
*  with the License. A copy of the License is located at                                                             *
*                                                                                                                    *
*      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
*                                                                                                                    *
*  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
*  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
*  and limitations under the License.                                                                                *
*********************************************************************************************************************/

/**
 * @author Solution Builders
 */

'use strict';

import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { fromEnv } from "@aws-sdk/credential-providers";
import { isEmpty } from 'underscore';

const dynamoConfig = {
    credentials: fromEnv(),
    region: process.env.AWS_REGION
};

/**
 * AccessLog receives a set of information related to an access event in the microservice.
 * AccessLog will wrap the access event information in an appropriate event message and invoke
 * the data lake logging microservice for delivery to the data lake audit log in Amazon
 * CloudWatch logs.
 *
 * @class AccessLog
 */
let AccessLog = (function() {

    /**
     * @class AccessLog
     * @constructor
     */
    class AccessLog {
        constructor() { }
        /**
             * Builds access log event message and invokes logging microservice to record the
             * access event to the data lake audit log.
             * @param {string} eventid - Request id of the event.
             * @param {string} servicename - Name of the microservice executing the request.
             * @param {string} userid - Username of the authenticate user send the request.
             * @param {string} operation - Description of the action executed by the request.
             * @param {string} result - Result of the executed action [fail/succeed].
             * @param {logEvent~requestCallback} cb - The callback that handles the response.
             */
        logEvent(eventid, servicename, userid, operation, result, cb) {

            getAuditLoggingConfigInfo(function (err, loggingEnabled) {
                if (err) {
                    console.log(err);
                    return cb(err, null);
                }

                // if logging is enabled, log event
                if (loggingEnabled) {
                    // build access event message
                    let _signature = [servicename, ':', eventid].join('');
                    let _message = [_signature, userid, operation, '[', result, ']'].join(' ');

                    let _payload = {
                        message: _message
                    };

                    // async event invocation to lambda [data-lake-logging-service] function
                    // to log access event
                    let params = {
                        FunctionName: 'data-lake-logging-service',
                        InvocationType: 'Event',
                        LogType: 'None',
                        Payload: JSON.stringify(_payload)
                    };

                    const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
                    const command = new InvokeCommand(params);

                    lambdaClient.send(command).then(
                        (data) => cb(null, 'logging triggered'),
                        (err) => {
                            console.log('Error occurred when triggering data lake access logging service.', err);
                            cb('logging trigger failed', null);
                        }
                    );
                } else {
                    return cb(null, 'logging not enabled');
                }

            });

        }
    }


    /**
     * Helper function to retrieve data lake audit logging configuration setting from
     * Amazon DynamoDB [data-lake-settings].
     * @param {getAuditLoggingConfigInfo~requestCallback} cb - The callback that handles the response.
     */
    let getAuditLoggingConfigInfo = function(cb) {
        console.log('Retrieving app-config information...');
        const params = {
            TableName: 'data-lake-settings',
            Key: {
                setting_id: 'app-config'
            }
        };

        const dynamoClient = new DynamoDBClient(dynamoConfig);
        const command = new GetItemCommand(params);

        dynamoClient.send(command).then(
            (data) => {
                if (!isEmpty(data.Item)) {
                    cb(null, data.Item.setting.auditLogging);
                } else {
                    cb('No valid audit logging app configuration data available.', null);
                }
            },
            (err) => {
                console.log(err);
                cb('Error retrieving app configuration settings [ddb].', null);
            }
        );
    };

    return AccessLog;

})();

export default AccessLog;