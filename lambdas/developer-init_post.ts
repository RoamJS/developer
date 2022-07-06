import { APIGatewayProxyHandler } from "aws-lambda";
import headers from "roamjs-components/backend/headers";
import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";
import putRoamJSUser from "roamjs-components/backend/putRoamJSUser";
import emailCatch from "roamjs-components/backend/emailCatch";

export const handler: APIGatewayProxyHandler = awsGetRoamJSUser(
  async (user) => {
    return putRoamJSUser({ token: user.token, data: { paths: [] } })
      .then(() => ({
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers,
      }))
      .catch(emailCatch("Init Developer"));
  }
);
