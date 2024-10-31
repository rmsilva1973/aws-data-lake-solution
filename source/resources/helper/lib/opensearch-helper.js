'use strict';

import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws-v3';
import { CloudWatchLogsClient, PutResourcePolicyCommand, DeleteResourcePolicyCommand } from "@aws-sdk/client-cloudwatch-logs";
import { OpenSearchClient, UpdateDomainConfigCommand } from '@aws-sdk/client-opensearch';
import { CognitoIdentityProviderClient, ListUserPoolClientsCommand, UpdateUserPoolClientCommand  } from "@aws-sdk/client-cognito-identity-provider";

/**
 * Helper function to interact with the data lake Opensearch Serverless for data lake cfn custom resource.
 *
 * @class opensearchHelper
 */
let opensearchHelper = (function() {

  /**
   * @class opensearchHelper
   * @constructor
   */
  class opensearchHelper {
    constructor() { }

    /**
     * Creates a new search index in the data lake OpenSearch Service cluster.
     * @param {string} clusterUrl - URL for the data lake OpenSearch Service cluster.
     * @param {string} searchIndex - Name of new search index to create.
     * @param {saveAppConfigSettings~requestCallback} cb - The callback that handles the response.
     */
    createSearchIndex(aossUrl, searchIndex, cb) {
      const client = new Client({
        ...AwsSigv4Signer({
          region: process.env.AWS_REGION,
          service: 'aoss',
          getCredentials: () => {
            const credentialProvider = defaultProvider();
            return credentialProvider;
          }
        }),
        requestTimeout: 60000,
        node: aossUrl,
      });

      client.indices.create({
        index: searchIndex,
        body: {
          "mappings": {
            "properties": {
              "created_at": {
                "type": "date"
              },
              "deleted": {
                "type": "boolean"
              },
              "description": {
                "type": "text"
              },
              "groups": {
                "type": "keyword",
                "ignore_above": 12800
              },
              "name": {
                "type": "text"
              },
              "owner": {
                "type": "keyword",
                "ignore_above": 128
              },
              "package_id": {
                "type": "keyword",
                "ignore_above": 128
              },
              "updated_at": {
                "type": "date"
              }
            }
          }
        }
      })
      .then((resp) => {
        console.log(resp);
        return cb(null, resp);
      })
      .catch((err) => {
        console.log('The data lake opensearch returned an error!');
        console.log(err);
        return cb(err, null);
      });
    }

    /**
     * Configure Amazon Cognito authentication for Kibana and activate log publishing.
     *
     * @param {string} identityPoolId - Cogniot identity pool ID.
     * @param {string} roleArn - Configuration configuration role ARN.
     * @param {string} userPoolId - Cognito user pool ID.
     * @param {string} logGroupArn - ARN of the Cloudwatch log group to which log needs to be published.
     * @param {string} logGroupPolicyName - Cloudwatch log group policy name.
     *
     * @param {updateOpenSearchDomainConfig~requestCallback} cb - The callback that handles the response.
     */  
    updateOpenSearchDomainConfig(identityPoolId, roleArn, userPoolId, logGroupArn, logGroupPolicyName, cb) {
      const cwClient = new CloudWatchLogsClient();
      const params = {
        policydocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [{
            Effect: "Allow",
            Principal: { Service: "aoss,amazonaws.com" },
            Action: [
              "logs:PutLogEvents",
              "logs:CreateLogStream"
            ]
          }]
        })
      };
      const cwCommand = new PutResourcePolicyCommand(params);
      cwClient.send(cwCommand)
      .then((resp) => {
        const params = {
          DomainName: 'data-lake',
          CognitoOptions: {
            Enabled: true,
            IdentityPoolId: identityPoolId,
            RoleArn: roleArn,
            UserPoolId: userPoolId
          },
          LogPublishingOptions: {
            SEARCH_SLOW_LOGS: {
                CloudWatchLogsLogGroupArn: logGroupArn,
                Enabled: true
            },
            INDEX_SLOW_LOGS: {
              CloudWatchLogsLogGroupArn: logGroupArn,
              Enabled: true
            },
            ES_APPLICATION_LOGS: {
              CloudWatchLogsLogGroupArn: logGroupArn,
              Enabled: true
            }
          }
        };

        const aossClient = new OpenSearchClient();
        const command = new UpdateDomainConfigCommand(params);
        aossClient.send(command)
        .then((resp) => {
          return cb(null, resp)
        })
        .catch((err) => {
          console.log(err, err.stack);
          return cb(err, null)
        })
      })
      .catch((err) => {
        console.log(err, err.stack);
        return cb(err, null);
      });
    }
  }

  /**
   * Deletes a resource policy from this account. This revokes the access of the
   * identities in that policy to put log events to this account.
   *
   * @param {string} logGroupPolicyName - Cloudwatch log group policy name.
   *
   * @param {deleteResourcePolicy~requestCallback} cb - The callback that handles the response.
   */
  deleteResourcePolicy(logGroupPolicyName, cb) {
    const cwClient = new CloudWatchLogsClient();
    const params = { policyName: logGroupPolicyName };
    const cwCommand = new DeleteResourcePolicyCommand(params);
    
    cwClient.send(cwCommand)
      .then((resp) => {
        return cb(null, resp);
      })
      .catch((err) => {
        console.log(err, err.stack);
        return cb(err, null);
      });
  }

  /**
   * Federate cognito kibana authentication.
   *
   * @param {string} userPoolId - Cognito user pool ID.
   * @param {string} federatedLogin - Flag to indicate if federated access is activated
   * @param {string} adFsHostname - The identity provider name.
   *
   * @param {federateKibanaAccess~requestCallback} cb - The callback that handles the response.
   */
  federateKibanaAccess(userPoolId, adFsHostname, cb) {
    const coClient = new CognitoIdentityProviderClient();
    const params = {
      UserPoolId: userPoolId,
      MaxResults: 2
    }
    let command = new ListUserPoolClientsCommand(params);
    coClient.send(command)
    .then((resp) => {
      let poolClientData = resp.UserPoolClient;
      delete poolClientData.ClientSecret;
      delete poolClientData.LastModifiedDate;
      delete poolClientData.CreationDate;
      poolClientData.SuppoertedIdentityProviders = [adFsHostname];
      console.log(poolClientData);
      command = new UpdateUserPoolClientCommand(poolClientData);
      coClient.send(command)
      .then((resp) => {
        return cb(null, resp);
      })
      .catch((err) => {
        console.log(err, err.stack);
        return(null,data);
      });
    });
  }

  return opensearchHelper;
})();

export default opensearchHelper;