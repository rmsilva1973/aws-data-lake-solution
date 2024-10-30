'use strict';

import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws-v3';
import { CloudWatchLogsClient, PutResourcePolicyCommand } from "@aws-sdk/client-cloudwatch-logs";

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
    * Creates a new search index in the data lake Elasticsearch Service cluster.
    * @param {string} clusterUrl - URL for the data lake Elasticsearch Service cluster.
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
     * @param {updateElasticsearchDomainConfig~requestCallback} cb - The callback that handles the response.
     */  
    updateElasticsearchDomainConfig(identityPoolId, roleArn, userPoolId, logGroupArn, logGroupPolicyName, cb) {
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
      const command = new PutResourcePolicyCommand(params);
      cwClient.send(command)
      .then((resp) => {
        // Handle response if needed
      })
      .catch((err) => {
        console.log(err, err.stack);
        return cb(err, null);
      });
    }
  }

  return opensearchHelper;
})();

export default opensearchHelper;