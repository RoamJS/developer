import type { APIGatewayProxyHandler } from "aws-lambda";
import headers from "roamjs-components/backend/headers";
import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";
import { dynamo, TableName } from "./common";

export const handler: APIGatewayProxyHandler = awsGetRoamJSUser(async (user) =>
  dynamo
    .query({
      TableName,
      IndexName: "user-index",
      KeyConditionExpression: "#u = :u",
      ExpressionAttributeNames: { "#u": "user" },
      ExpressionAttributeValues: {
        ":u": { S: user.id || process.env.ROAMJS_RELEASE_TOKEN },
      },
    })
    .promise()
    .then((r) => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          extensions: r.Items.map((i) => ({
            id: i.id.S,
            state: i.state.S,
          })),
        }),
        headers,
      };
    })
);
