import type { APIGatewayProxyHandler } from "aws-lambda";
import headers from "roamjs-components/backend/headers";
import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";

export const handler: APIGatewayProxyHandler = awsGetRoamJSUser(
  async (user) => {
    return {
      statusCode: 200,
      body: JSON.stringify({
        value: user.paths,
      }),
      headers,
    };
  }
);
