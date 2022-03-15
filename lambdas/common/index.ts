import AWS from "aws-sdk";
import { APIGatewayProxyResult } from "aws-lambda";
import headers from "roamjs-components/backend/headers";

export const userError = (body: string): APIGatewayProxyResult => ({
  statusCode: 400,
  body,
  headers,
});

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

export const dynamo = new AWS.DynamoDB({
  apiVersion: "2012-08-10",
  credentials,
});

export const s3 = new AWS.S3({ apiVersion: "2006-03-01", credentials });
export const ses = new AWS.SES({ apiVersion: "2010-12-01", credentials });

export type DeveloperMetadata = { paths: string[] };

export const listAll = async (
  Prefix: string
): Promise<{
  objects: AWS.S3.ObjectList;
  prefixes: AWS.S3.CommonPrefixList;
}> => {
  const objects: AWS.S3.ObjectList = [];
  const prefixes: AWS.S3.CommonPrefixList = [];
  let ContinuationToken: string = undefined;
  let isTruncated = true;
  while (isTruncated) {
    const res = await s3
      .listObjectsV2({
        Bucket: "roamjs.com",
        Prefix,
        ContinuationToken,
        Delimiter: "/",
      })
      .promise();
    objects.push(...res.Contents);
    prefixes.push(...res.CommonPrefixes);
    ContinuationToken = res.ContinuationToken;
    isTruncated = res.IsTruncated;
  }
  return { objects, prefixes };
};

export const TableName =
  process.env.NODE_ENV === "development"
    ? "RoamJSExtensionsDev"
    : "RoamJSExtensions";
