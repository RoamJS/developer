import { APIGatewayProxyHandler } from "aws-lambda";
import { dynamo, listAll, s3, TableName, userError } from "./common";
import headers from "roamjs-components/backend/headers";
import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";
import putRoamJSUser from "roamjs-components/backend/putRoamJSUser";
import emailCatch from "roamjs-components/backend/emailCatch";

export const handler: APIGatewayProxyHandler = awsGetRoamJSUser(
  async (user) => {
    return putRoamJSUser(user.token, { paths: [] })
      .then(() => ({
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers,
      }))
      .catch(emailCatch("Init Developer"));
  }
);
