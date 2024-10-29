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

import  { CognitoIdentityProviderClient, AdminGetUserCommand, ListGroupsCommand, CreateGroupCommand, 
          UpdateGroupCommand, AdminRemoveUserFromGroupCommand, GetGroupCommand, ListUsersInGroupCommand,
          DeleteGroupCommand, AdminListGroupsForUserCommand, AdminAddUserToGroupCommand 
        } from '@aws-sdk/client-cognito-identity-provider';
import AccessValidator from 'access-validator';

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
const cognitoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};

/**
 * Performs CRUD operations for data lake groups interfacing primiarly with the data lake
 * Amazon Cogntio user pool.
 *
 * @class group
 */
let group = (function() {

    let accessValidator = new AccessValidator();

    /**
     * @class group
     * @constructor
     */
    class group {
    constructor() { }
    /**
         * Retrieves data lake groups from Amazon Cognito group pool .
         * @param {listGroups~requestCallback} cb - The callback that handles the response.
         */
    async listGroups(ticket, cb) {
      try {
        if (process.env.FEDERATED_LOGIN === 'true') {
          const params = {
            UserPoolId: process.env.USER_POOL_ID,
            Username: ticket.userid
          };

          const command = new AdminGetUserCommand(params);
          const data = await cognitoClient.send(command);

          let _groups = _.where(data.UserAttributes, { Name: 'custom:groups' });
          if (_groups.length > 0) {
            let _result = { "Groups": [] };
            _groups = _groups[0].Value.replace('[', '').replace(']', '').split(',');
            for (let i = _groups.length - 1; i >= 0; i--) {
              _result.Groups.push({
                "GroupName": _groups[i],
                "UserPoolId": process.env.USER_POOL_ID,
                "Description": "Imported from AD",
                "LastModifiedDate": "",
                "CreationDate": ""
              });
            }
            return cb(null, _result);
          }
        } else {
          const params = { UserPoolId: process.env.USER_POOL_ID };
          const command = new ListGroupsCommand(params);
          const data = await cognitoClient.send(command);
          return cb(null, data);
        }
      } catch (err) {
        console.log(err);
        return cb(err.message || { code: 502, message: "Failed to retrieve the group list." }, null);
      }
    }
    /**
         * Creates a new group in the data lake Amazon Cognito user pool.
         *
         * @param {string} groupName - The name of the group. Must be unique and satisfy regular expression pattern [\p{L}\p{M}\p{S}\p{N}\p{P}]+
         * @param {string} description - A string containing the description of the group.
         * @param {createGroup~requestCallback} cb - The callback that handles the response.
         */
    async createGroup(groupName, description, ticket, cb) {
      if (process.env.FEDERATED_LOGIN === 'true') {
        return cb({ code: 404, message: "Function not valid for federated login." }, null);
      }

      try {
        await accessValidator.validateAdminAccess(ticket);

        const params = {
          UserPoolId: process.env.USER_POOL_ID,
          GroupName: groupName,
          Description: description
        };

        const command = new CreateGroupCommand(params);
        await cognitoClient.send(command);
        return cb(null, { code: 200, message: `Group ${groupName} created.` });
      } catch (err) {
        console.log(err);
        if (err.name === 'GroupExistsException') {
          return cb({ code: 400, message: `Group ${groupName} already exists. Try to edit the existing one.` }, null);
        }
        return cb({ code: 502, message: `Failed to create the group. Ask datalake admin to check data-lake-admin-service logs for details.` }, null);
      }
    }
    /**
         * Updates the specified group with the specified attributes.
         *
         * @param {string} groupName - The name of the group to be updated.
         * @param {string} description - A string containing the description of the group.
         * @param {updateGroup~requestCallback} cb - The callback that handles the response.
         */
    async updateGroup(groupName, description, ticket, cb) {
      if (process.env.FEDERATED_LOGIN === 'true') {
        return cb({ code: 404, message: "Function not valid for federated login." }, null);
      }

      try {
        await accessValidator.validateAdminAccess(ticket);

        const params = {
          UserPoolId: process.env.USER_POOL_ID,
          GroupName: groupName,
          Description: description
        };

        const command = new UpdateGroupCommand(params);
        await cognitoClient.send(command);
        return cb(null, { code: 200, message: `Group ${groupName} updated.` });
      } catch (err) {
        console.log(err);
        return cb({ code: 502, message: `Failed to update the specified group. Params: groupName:${groupName} - description:${description}` }, null);
      }
    }
    /**
         * Remove the specified user from the specified group.
         *
         * @param {string} userId - Username of account to be removed from the user pool group.
         * @param {string} groupName - The name of the group to be updated.
         * @param {updateGroup~requestCallback} cb - The callback that handles the response.
         */
    async removeUserFromGroup(userId, groupName, ticket, cb) {
      if (process.env.FEDERATED_LOGIN === 'true') {
        return cb({ code: 404, message: "Function not valid for federated login." }, null);
      }

      try {
        await accessValidator.validateAdminAccess(ticket);

        const params = {
          GroupName: groupName,
          UserPoolId: process.env.USER_POOL_ID,
          Username: userId
        };

        const command = new AdminRemoveUserFromGroupCommand(params);
        await cognitoClient.send(command);
        return cb(null, { code: 200, message: `User ${userId} removed from group ${groupName}.` });
      } catch (err) {
        console.log(err);
        return cb({ code: 502, message: `Failed to remove User ${userId} from group ${groupName}.` }, null);
      }
    }
    /**
         * Retrieves a group from the data lake Amazon Cognito user pool.
         *
         * @param {string} groupName - The name of the group to retrive information.
         * @param {getGroup~requestCallback} cb - The callback that handles the response.
         */
    async getGroup(groupName, ticket, cb) {
      if (process.env.FEDERATED_LOGIN === 'true') {
        return cb({ code: 404, message: "Function not valid for federated login." }, null);
      }

      try {
        await accessValidator.validateAdminAccess(ticket);

        const params = { UserPoolId: process.env.USER_POOL_ID, GroupName: groupName };
        const getGroupCommand = new GetGroupCommand(params);
        const listUsersCommand = new ListUsersInGroupCommand(params);

        const [groupData, usersData] = await Promise.all([
          cognitoClient.send(getGroupCommand),
          cognitoClient.send(listUsersCommand)
        ]);

        let result = groupData.Group;
        result.UserList = [];

        usersData.Users.forEach(user => {
          let newUser = {
            user_id: user.Username,
            enabled: user.Enabled,
            status: user.UserStatus
          };

          user.Attributes.forEach(att => {
            if (att.Name === 'email') {
              newUser.email = att.Value;
            } else if (att.Name === 'custom:display_name') {
              newUser.name = att.Value;
            } else if (att.Name === 'custom:role') {
              newUser.role = att.Value;
            }
          });

          result.UserList.push(newUser);
        });

        return cb(null, result);
      } catch (err) {
        console.log(err);
        return cb({ code: 502, message: `Failed to retrieve the specified group. Params: groupName:${groupName}` }, null);
      }
    }
    /**
         * Deletes the specified group from the data lake Amazon Cognito user pool.
         * Currently only groups with no members can be deleted.
         *
         * @param {string} groupName - The name of the group to be deleted.
         * @param {deleteGroup~requestCallback} cb - The callback that handles the response.
         */
    async deleteGroup(groupName, ticket, cb) {
      if (process.env.FEDERATED_LOGIN === 'true') {
        return cb({ code: 404, message: "Function not valid for federated login." }, null);
      }

      try {
        await accessValidator.validateAdminAccess(ticket);

        const params = { UserPoolId: process.env.USER_POOL_ID, GroupName: groupName };
        const command = new DeleteGroupCommand(params);
        await cognitoClient.send(command);
        return cb(null, { code: 200, message: `Group ${groupName} deleted.` });
      } catch (err) {
        console.log(err);
        return cb({ code: 502, message: `Failed to delete the specified group. Params: groupName:${groupName}` }, null);
      }
    }
    /**
         * Lists the groups that the user belongs to.
         *
         * @param {string} userId - Username of account to list groups.
         * @param {getUserGroups~requestCallback} cb - The callback that handles the response.
         */
    async getUserGroups(userId, ticket, cb) {
      try {
        await accessValidator.validateAdminAccess(ticket);

        if (process.env.FEDERATED_LOGIN === 'true') {
          const params = {
            UserPoolId: process.env.USER_POOL_ID,
            Username: userId
          };

          const command = new AdminGetUserCommand(params);
          const data = await cognitoClient.send(command);

          let _groups = _.where(data.UserAttributes, { Name: 'custom:groups' });
          if (_groups.length > 0) {
            let _result = { "Groups": [] };
            _groups = _groups[0].Value.replace('[', '').replace(']', '').split(',');
            for (let i = _groups.length - 1; i >= 0; i--) {
              _result.Groups.push({
                "GroupName": _groups[i],
                "UserPoolId": process.env.USER_POOL_ID,
                "Description": "Imported from AD",
                "LastModifiedDate": "",
                "CreationDate": ""
              });
            }
            return cb(null, _result);
          }
        } else {
          const params = {
            UserPoolId: process.env.USER_POOL_ID,
            Username: userId
          };
          const command = new AdminListGroupsForUserCommand(params);
          const data = await cognitoClient.send(command);
          return cb(null, data);
        }
      } catch (err) {
        console.log(err);
        return cb(err.message || { code: 502, message: `Failed to list the groups that the user belongs to.` }, null);
      }
    }
    /**
         * Updates the list of groups that the user belongs to.
         *
         * @param {string} userId - Username of account to be updated.
         * @param {object} groupSet - List of groups that the user currently belongs to.
         * @param {updateUserMembership~requestCallback} cb - The callback that handles the response.
         */
    async updateUserMembership(userId, groupSet, ticket, cb) {
      if (process.env.FEDERATED_LOGIN === 'true') {
        return cb({ code: 404, message: "Function not valid for federated login." }, null);
      }

      try {
        await accessValidator.validateAdminAccess(ticket);

        const params = {
          UserPoolId: process.env.USER_POOL_ID,
          Username: userId
        };

        const listGroupsCommand = new AdminListGroupsForUserCommand(params);
        const data = await cognitoClient.send(listGroupsCommand);

        const currentGroupSet = data.Groups.map(group => group.GroupName);

        const groupsToAdd = groupSet.filter(group => !currentGroupSet.includes(group))
          .map(group => {
            const addParams = { GroupName: group, UserPoolId: process.env.USER_POOL_ID, Username: userId };
            const addCommand = new AdminAddUserToGroupCommand(addParams);
            return cognitoClient.send(addCommand);
          });

        const groupsToRemove = currentGroupSet.filter(group => !groupSet.includes(group))
          .map(group => {
            const removeParams = { GroupName: group, UserPoolId: process.env.USER_POOL_ID, Username: userId };
            const removeCommand = new AdminRemoveUserFromGroupCommand(removeParams);
            return cognitoClient.send(removeCommand);
          });

        await Promise.all([...groupsToAdd, ...groupsToRemove]);
        return cb(null, { code: 200, message: `${userId} membership list updated.` });
      } catch (err) {
        console.log(err);
        return cb({ code: 502, message: `Failed to update ${userId} membership list` }, null);
      }
    }
  }
  return group;
})();

export default group;
