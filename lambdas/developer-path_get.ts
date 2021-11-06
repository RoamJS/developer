import { APIGatewayProxyHandler } from "aws-lambda";
import { getRoamJSUser, headers } from "./common";

export const handler: APIGatewayProxyHandler = (event) => {
  return getRoamJSUser(event).then((r) => ({
    statusCode: 200,
    body: JSON.stringify({
      value: r.data.paths,
    }),
    headers,
  }));
};
